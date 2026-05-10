import { supabase } from './supabase'
import { parseMapLink } from './mapLinks'

function normalizeError(error, fallback) {
  if (!error) return fallback
  const message = error.message || error.details || ''

  if (message.includes('already_connected')) {
    return '이미 파트너와 연결되어 있어요.'
  }

  if (message.includes('couple_full')) {
    return '이미 두 명이 연결된 초대 코드예요.'
  }

  if (message.includes('invalid_invite_code')) {
    return '초대 코드를 찾을 수 없어요.'
  }

  if (message.includes('not_authenticated')) {
    return '로그인이 필요해요.'
  }

  if (message.includes('invite_code_generation_failed')) {
    return '초대 코드 생성에 실패했어요. 다시 시도해 주세요.'
  }

  return message || fallback
}

function isMissingColumnError(error, column) {
  const message = `${error?.message || ''} ${error?.details || ''}`.toLowerCase()
  return message.includes(column.toLowerCase()) && message.includes('schema cache')
}

function isMissingTableError(error, table) {
  const message = `${error?.message || ''} ${error?.details || ''}`.toLowerCase()
  return message.includes(table.toLowerCase()) && (message.includes('does not exist') || message.includes('404'))
}

function isMissingFunctionError(error) {
  const message = `${error?.message || ''} ${error?.details || ''}`.toLowerCase()
  return message.includes('function') && (message.includes('does not exist') || message.includes('not found'))
}

function generateInviteCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

async function resolveMapUrl(mapUrl, placeName, location) {
  if (!mapUrl) {
    return { data: { map_url: null, latitude: null, longitude: null }, error: null }
  }

  const { data, error } = await supabase.functions.invoke('resolve-map-link', {
    body: {
      mapUrl,
      placeName,
      location,
    },
  })

  if (!error && data) {
    return {
      data: {
        map_url: data.mapUrl || mapUrl,
        latitude: data.latitude ?? null,
        longitude: data.longitude ?? null,
      },
      error: null,
    }
  }

  const parsed = parseMapLink(mapUrl)
  if (parsed.ok) {
    return {
      data: {
        map_url: parsed.normalizedUrl || mapUrl,
        latitude: parsed.latitude ?? null,
        longitude: parsed.longitude ?? null,
      },
      error: null,
    }
  }

  return {
    data: {
      map_url: mapUrl,
      latitude: null,
      longitude: null,
    },
    error: null,
  }
}

export async function getMyRooms(userId) {
  const { data: couple, error: rpcError } = await supabase.rpc('get_my_couple')

  if (!rpcError) {
    const rooms = (couple || []).map((room) => {
      const {
        member_count: memberCount,
        partner_id: partnerId,
        partner_nickname: partnerNickname,
        partner_avatar_url: partnerAvatarUrl,
        ...roomData
      } = room

      return {
        ...roomData,
        member_count: memberCount,
        partner: partnerId ? {
          id: partnerId,
          nickname: partnerNickname,
          avatar_url: partnerAvatarUrl,
        } : null,
      }
    })
    return { data: rooms, error: null }
  }

  if (!isMissingFunctionError(rpcError)) {
    return { data: [], error: normalizeError(rpcError, '커플 정보를 불러오지 못했어요.') }
  }

  const { data, error } = await supabase
    .from('room_members')
    .select('room_id, rooms(*)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    return { data: [], error: normalizeError(error, '방 목록을 불러오지 못했어요.') }
  }

  const rooms = (data || []).map((row) => row.rooms).filter(Boolean)
  return { data: rooms, error: null }
}

export async function getMyProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('nickname, avatar_url')
    .eq('id', userId)
    .maybeSingle()

  if (error && !isMissingTableError(error, 'profiles')) {
    return { data: null, error: normalizeError(error, '프로필을 불러오지 못했어요.') }
  }

  return {
    data: {
      nickname: data?.nickname || '',
      avatar_url: data?.avatar_url || null,
    },
    error: null,
  }
}

export async function updateMyProfile({ userId, nickname, avatarUrl }) {
  const cleanedNickname = nickname.trim()

  if (!cleanedNickname) {
    return { data: null, error: '닉네임을 입력해 주세요.' }
  }

  const { error: authError } = await supabase.auth.updateUser({
    data: { nickname: cleanedNickname },
  })

  if (authError) {
    return { data: null, error: normalizeError(authError, '프로필 저장에 실패했어요.') }
  }

  const { data, error } = await supabase
    .from('profiles')
    .upsert({
      id: userId,
      nickname: cleanedNickname,
      avatar_url: avatarUrl || null,
      updated_at: new Date().toISOString(),
    })
    .select('nickname, avatar_url')
    .single()

  if (error && !isMissingTableError(error, 'profiles')) {
    return { data: null, error: normalizeError(error, '프로필 저장에 실패했어요.') }
  }

  return {
    data: data || { nickname: cleanedNickname, avatar_url: avatarUrl || null },
    error: null,
  }
}

export async function createRoomWithMembership({ userId, roomTitle }) {
  const { data: rpcRoom, error: rpcError } = await supabase
    .rpc('create_couple', { room_title: roomTitle || '우리의 맛집 리스트' })
    .maybeSingle()

  if (!rpcError && rpcRoom) {
    return { data: rpcRoom, error: null }
  }

  if (rpcError && !isMissingFunctionError(rpcError)) {
    return { data: null, error: normalizeError(rpcError, '초대 코드 생성에 실패했어요.') }
  }

  let code = generateInviteCode()
  let room = null
  let lastError = null

  for (let i = 0; i < 5; i++) {
    let insert = await supabase
      .from('rooms')
      .insert({ invite_code: code, title: roomTitle || '우리의 맛집 리스트' })
      .select('*')
      .single()

    if (insert.error && isMissingColumnError(insert.error, 'title')) {
      insert = await supabase
        .from('rooms')
        .insert({ invite_code: code })
        .select('*')
        .single()
    }

    if (!insert.error) {
      room = insert.data
      break
    }

    lastError = insert.error
    code = generateInviteCode()
  }

  if (!room) {
    return { data: null, error: normalizeError(lastError, '방 생성에 실패했어요.') }
  }

  const { error: memberError } = await supabase
    .from('room_members')
    .insert({ room_id: room.id, user_id: userId })

  if (memberError) {
    return { data: null, error: normalizeError(memberError, '방 참여에 실패했어요.') }
  }

  return { data: room, error: null }
}

export async function joinRoomByInviteCode({ userId, inviteCode }) {
  const { data: rpcRoom, error: rpcError } = await supabase
    .rpc('join_couple_by_invite_code', { invite_code_input: inviteCode })
    .maybeSingle()

  if (!rpcError && rpcRoom) {
    return { data: rpcRoom, error: null }
  }

  if (rpcError && !isMissingFunctionError(rpcError)) {
    return { data: null, error: normalizeError(rpcError, '커플 연결에 실패했어요.') }
  }

  const { data: room, error: roomError } = await supabase
    .from('rooms')
    .select('id, title, invite_code')
    .eq('invite_code', inviteCode)
    .maybeSingle()

  if (roomError || !room) {
    return { data: null, error: '초대 코드를 찾을 수 없어요.' }
  }

  const { error: joinError } = await supabase
    .from('room_members')
    .insert({ room_id: room.id, user_id: userId })

  if (joinError && joinError.code !== '23505') {
    return { data: null, error: normalizeError(joinError, '방 입장에 실패했어요.') }
  }

  return { data: room, error: null }
}

export async function fetchRoom(roomId) {
  const { data, error } = await supabase
    .from('rooms')
    .select('*')
    .eq('id', roomId)
    .single()

  if (error) {
    return { data: null, error: normalizeError(error, '방 정보를 불러오지 못했어요.') }
  }

  return { data, error: null }
}

export async function fetchFoods(roomId) {
  const { data, error } = await supabase
    .from('foods')
    .select('*')
    .eq('room_id', roomId)
    .order('created_at', { ascending: false })

  if (error) {
    return { data: [], error: normalizeError(error, '음식 목록을 불러오지 못했어요.') }
  }

  return { data: data || [], error: null }
}

export async function addFood({ roomId, userId, food }) {
  const { data: resolvedMap, error: mapError } = await resolveMapUrl(
    food.map_url,
    food.place_name || food.name,
    food.location,
  )

  if (mapError) {
    return { data: null, error: normalizeError(mapError, '지도 링크를 처리하지 못했어요.') }
  }

  let insert = await supabase
    .from('foods')
    .insert({
      ...food,
      map_url: resolvedMap.map_url,
      place_name: food.place_name || null,
      latitude: resolvedMap.latitude,
      longitude: resolvedMap.longitude,
      price_level: food.price_level || null,
      is_favorite: Boolean(food.is_favorite),
      room_id: roomId,
      added_by: userId,
    })
    .select('*')
    .single()

  if (insert.error && isMissingColumnError(insert.error, 'added_by')) {
    insert = await supabase
      .from('foods')
      .insert({ ...food, room_id: roomId })
      .select('*')
      .single()
  }

  if (insert.error) {
    return { data: null, error: normalizeError(insert.error, '음식을 추가하지 못했어요.') }
  }

  return { data: insert.data, error: null }
}

export async function updateFood(foodId, updates) {
  let resolvedUpdates = { ...updates }

  if (Object.prototype.hasOwnProperty.call(updates, 'map_url')) {
    const { data: resolvedMap, error: mapError } = await resolveMapUrl(
      updates.map_url,
      updates.place_name || updates.name,
      updates.location,
    )

    if (mapError) {
      return { data: null, error: normalizeError(mapError, '지도 링크를 처리하지 못했어요.') }
    }

    resolvedUpdates = {
      ...resolvedUpdates,
      map_url: resolvedMap.map_url,
      latitude: resolvedMap.latitude,
      longitude: resolvedMap.longitude,
    }
  }

  const { data, error } = await supabase
    .from('foods')
    .update({
      ...resolvedUpdates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', foodId)
    .select('*')
    .single()

  if (error) {
    return { data: null, error: normalizeError(error, '음식을 수정하지 못했어요.') }
  }

  return { data, error: null }
}

export async function markFoodEaten(foodId) {
  return updateFood(foodId, { eaten_at: new Date().toISOString() })
}

export async function toggleFoodFavorite(food) {
  return updateFood(food.id, { is_favorite: !food.is_favorite })
}

export async function deleteFood(foodId) {
  const { error } = await supabase.from('foods').delete().eq('id', foodId)

  if (error) {
    return { error: normalizeError(error, '음식을 삭제하지 못했어요.') }
  }

  return { error: null }
}

export async function fetchMemories(roomId) {
  const { data, error } = await supabase
    .from('memories')
    .select('*, foods(id, name, location, place_name, category)')
    .eq('room_id', roomId)
    .order('visited_at', { ascending: false })

  if (error) {
    return { data: [], error: normalizeError(error, '추억 목록을 불러오지 못했어요.') }
  }

  return { data: data || [], error: null }
}

export async function uploadMemoryPhoto({ roomId, userId, file }) {
  const ext = file.name.includes('.') ? file.name.split('.').pop() : 'jpg'
  const path = `${roomId}/${userId}/${Date.now()}-memory.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('memory-photos')
    .upload(path, file, { upsert: false })

  if (uploadError) {
    return { data: null, error: normalizeError(uploadError, '사진을 올리지 못했어요.') }
  }

  const { data: { publicUrl } } = supabase.storage
    .from('memory-photos')
    .getPublicUrl(path)

  return { data: `${publicUrl}?t=${Date.now()}`, error: null }
}

export async function createMemory({ roomId, foodId, userId, file, note, visitedAt }) {
  let photoUrl = null

  if (file) {
    const { data, error } = await uploadMemoryPhoto({ roomId, userId, file })
    if (error) {
      return { data: null, error }
    }
    photoUrl = data
  }

  const { data: memory, error: memoryError } = await supabase
    .from('memories')
    .insert({
      room_id: roomId,
      food_id: foodId,
      created_by: userId,
      photo_url: photoUrl,
      note: note?.trim() || null,
      visited_at: visitedAt,
    })
    .select('*, foods(id, name, location, place_name, category)')
    .single()

  if (memoryError) {
    return { data: null, error: normalizeError(memoryError, '추억을 저장하지 못했어요.') }
  }

  const { error: updateError } = await updateFood(foodId, { eaten_at: visitedAt })
  if (updateError) {
    return { data: null, error: updateError }
  }

  return { data: memory, error: null }
}

export async function uploadAvatar({ userId, file }) {
  const ext = file.name.includes('.') ? file.name.split('.').pop() : 'png'
  const path = `${userId}/avatar.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(path, file, { upsert: true })

  if (uploadError) {
    return { data: null, error: normalizeError(uploadError, '이미지를 올리지 못했어요.') }
  }

  const { data: { publicUrl } } = supabase.storage
    .from('avatars')
    .getPublicUrl(path)

  const { error: authError } = await supabase.auth.updateUser({
    data: { avatar_url: publicUrl },
  })

  if (authError) {
    return { data: null, error: normalizeError(authError, '프로필 저장에 실패했어요.') }
  }

  const { error: profileError } = await supabase
    .from('profiles')
    .upsert({ id: userId, avatar_url: publicUrl })

  if (profileError && !isMissingTableError(profileError, 'profiles')) {
    return { data: null, error: normalizeError(profileError, '프로필 저장에 실패했어요.') }
  }

  return { data: `${publicUrl}?t=${Date.now()}`, error: null }
}
