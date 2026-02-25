import { useState } from 'react'
import { supabase } from '../lib/supabase'

// Generates a random 8-character alphanumeric invite code
function generateInviteCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export default function Join({ onJoined }) {
  const [mode, setMode] = useState('create') // 'create' | 'join'
  const [inviteCode, setInviteCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleCreate = async () => {
    setError('')
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()

    // Check if user already has a room (shouldn't happen, but guard anyway)
    const { data: existing } = await supabase
      .from('room_members')
      .select('room_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (existing) {
      onJoined(existing.room_id)
      return
    }

    // Create room
    let code = generateInviteCode()
    let room = null

    // Retry if code collision (extremely unlikely but safe)
    for (let i = 0; i < 5; i++) {
      const { data, error: roomErr } = await supabase
        .from('rooms')
        .insert({ invite_code: code })
        .select()
        .single()

      if (!roomErr) {
        room = data
        break
      }
      code = generateInviteCode()
    }

    if (!room) {
      setError('방 생성에 실패했어요. 다시 시도해 주세요.')
      setLoading(false)
      return
    }

    // Add creator as member
    const { error: memberErr } = await supabase
      .from('room_members')
      .insert({ room_id: room.id, user_id: user.id })

    if (memberErr) {
      setError('방 참여에 실패했어요. 다시 시도해 주세요.')
      setLoading(false)
      return
    }

    onJoined(room.id)
  }

  const handleJoin = async () => {
    setError('')
    if (!inviteCode.trim()) {
      setError('초대 코드를 입력해 주세요.')
      return
    }

    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()

    // Find room by invite code
    const { data: room, error: roomErr } = await supabase
      .from('rooms')
      .select('id')
      .eq('invite_code', inviteCode.trim().toUpperCase())
      .maybeSingle()

    if (roomErr || !room) {
      setError('존재하지 않는 초대 코드예요.')
      setLoading(false)
      return
    }

    // Check room capacity (max 2 members)
    const { count } = await supabase
      .from('room_members')
      .select('*', { count: 'exact', head: true })
      .eq('room_id', room.id)

    if (count >= 2) {
      setError('이미 2명이 있는 방이에요. 초대 코드를 다시 확인해 주세요.')
      setLoading(false)
      return
    }

    // Join room
    const { error: joinErr } = await supabase
      .from('room_members')
      .insert({ room_id: room.id, user_id: user.id })

    if (joinErr) {
      setError('이미 참여한 방이에요.')
      setLoading(false)
      return
    }

    onJoined(room.id)
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-logo">💑</div>
        <h1 className="auth-title">함께할 방을 만들어요</h1>
        <p className="auth-subtitle">둘만의 음식 리스트를 공유해봐요</p>

        <div className="tab-group">
          <button
            className={`tab-btn${mode === 'create' ? ' active' : ''}`}
            onClick={() => { setMode('create'); setError('') }}
          >
            새 방 만들기
          </button>
          <button
            className={`tab-btn${mode === 'join' ? ' active' : ''}`}
            onClick={() => { setMode('join'); setError('') }}
          >
            코드로 입장
          </button>
        </div>

        {mode === 'create' ? (
          <div className="join-content">
            <p className="join-desc">
              방을 만들면 <strong>8자리 초대 코드</strong>가 생성돼요.<br />
              파트너에게 코드를 공유해 함께 사용하세요.
            </p>
            {error && <p className="form-error">{error}</p>}
            <button className="btn-primary" onClick={handleCreate} disabled={loading}>
              {loading ? '방 만드는 중…' : '방 만들기'}
            </button>
          </div>
        ) : (
          <div className="join-content">
            <div className="input-group">
              <label htmlFor="invite-code">초대 코드</label>
              <input
                id="invite-code"
                type="text"
                placeholder="ABCD1234"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                maxLength={8}
                autoComplete="off"
                className="code-input"
              />
            </div>
            {error && <p className="form-error">{error}</p>}
            <button className="btn-primary" onClick={handleJoin} disabled={loading}>
              {loading ? '입장 중…' : '입장하기'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
