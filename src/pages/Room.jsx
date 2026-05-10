import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import FoodCard from '../components/FoodCard'
import AddFoodModal from '../components/AddFoodModal'
import MemoryModal from '../components/MemoryModal'
import RandomPickModal from '../components/RandomPickModal'
import ToastContainer, { useToast } from '../components/Toast'
import {
  addFood,
  createMemory,
  deleteFood,
  fetchFoods,
  fetchMemories,
  fetchRoom,
  toggleFoodFavorite,
  updateFood,
} from '../lib/dataApi'
import { supabase } from '../lib/supabase'

const PRIMARY_FILTERS = [
  { id: 'active', label: '먹고 싶은 것' },
  { id: 'history', label: '우리의 추억' },
  { id: 'nearby', label: '가까운 순' },
]

function formatVisitedDate(value) {
  return new Intl.DateTimeFormat('ko-KR', {
    month: 'short',
    day: 'numeric',
  }).format(new Date(value))
}

function getDistanceKm(origin, food) {
  if (!origin || food.latitude == null || food.longitude == null) return null

  const toRadians = (value) => value * (Math.PI / 180)
  const earthRadiusKm = 6371
  const dLat = toRadians(food.latitude - origin.latitude)
  const dLng = toRadians(food.longitude - origin.longitude)
  const lat1 = toRadians(origin.latitude)
  const lat2 = toRadians(food.latitude)

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2)

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function formatDistance(distanceKm) {
  if (distanceKm == null) return ''
  if (distanceKm < 1) return `${Math.round(distanceKm * 1000)}m`
  return `${distanceKm.toFixed(1)}km`
}

export default function Room({ session }) {
  const { roomId } = useParams()
  const navigate = useNavigate()
  const { addToast } = useToast()

  const [foods, setFoods] = useState([])
  const [memories, setMemories] = useState([])
  const [roomTitle, setRoomTitle] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [editingFood, setEditingFood] = useState(null)
  const [memoryFood, setMemoryFood] = useState(null)
  const [showRandom, setShowRandom] = useState(false)
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('active')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [nearbyError, setNearbyError] = useState('')
  const [userCoords, setUserCoords] = useState(null)

  const loadRoom = useCallback(async () => {
    const { data, error: roomError } = await fetchRoom(roomId)

    if (roomError) {
      setError(roomError)
      return
    }

    setInviteCode(data.invite_code)
    setRoomTitle(data.title || '우리의 맛집 리스트')
  }, [roomId])

  const loadFoods = useCallback(async () => {
    setLoading(true)

    const { data, error: foodsError } = await fetchFoods(roomId)

    setFoods(data)
    setError(foodsError || '')
    setLoading(false)
  }, [roomId])

  const loadMemories = useCallback(async () => {
    const { data, error: memoriesError } = await fetchMemories(roomId)

    setMemories(data)
    if (memoriesError) {
      setError(memoriesError)
    }
  }, [roomId])

  useEffect(() => {
    loadRoom()
    loadFoods()
    loadMemories()
  }, [loadRoom, loadFoods, loadMemories])

  useEffect(() => {
    const channel = supabase
      .channel(`room-${roomId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'foods',
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newFood = payload.new

            setFoods((prev) => {
              if (prev.some((food) => food.id === newFood.id)) return prev
              return [newFood, ...prev]
            })

            if (newFood.added_by && newFood.added_by !== session.user.id) {
              addToast?.(`"${newFood.name}" 이(가) 추가됐어요!`, '🔔')
            }
          }

          if (payload.eventType === 'DELETE') {
            setFoods((prev) => prev.filter((food) => food.id !== payload.old.id))
          }

          if (payload.eventType === 'UPDATE') {
            setFoods((prev) => prev.map((food) => (
              food.id === payload.new.id ? payload.new : food
            )))
          }
        },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'memories',
          filter: `room_id=eq.${roomId}`,
        },
        async (payload) => {
          await loadMemories()

          if (payload.eventType === 'INSERT' && payload.new.created_by !== session.user.id) {
            addToast?.('새로운 추억이 저장됐어요.', '📸')
          }
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [roomId, session.user.id, addToast, loadMemories])

  const handleDelete = async (id) => {
    const food = foods.find((item) => item.id === id)
    const foodName = food?.name || '이 음식'

    if (!window.confirm(`${foodName}을(를) 삭제할까요?`)) {
      return
    }

    const { error: deleteError } = await deleteFood(id)

    if (deleteError) {
      setError(deleteError)
      return
    }

    setFoods((prev) => prev.filter((food) => food.id !== id))
    setError('')
  }

  const handleAdd = async (food) => {
    const { data, error: addError } = await addFood({ roomId, userId: session.user.id, food })

    if (addError) {
      setError(addError)
      return
    }

    setFoods((prev) => {
      if (prev.some((foodItem) => foodItem.id === data.id)) return prev
      return [data, ...prev]
    })
    setShowAdd(false)
    setError('')
  }

  const handleUpdate = async (id, updates) => {
    const { data, error: updateError } = await updateFood(id, updates)

    if (updateError) {
      setError(updateError)
      return
    }

    setFoods((prev) => prev.map((food) => (food.id === id ? data : food)))
    setEditingFood(null)
    setError('')
  }

  const handleMarkVisited = async (food) => {
    setMemoryFood(food)
    setError('')
  }

  const handleSaveMemory = async ({ food, file, note, visitedAt }) => {
    const { data, error: memoryError } = await createMemory({
      roomId,
      foodId: food.id,
      userId: session.user.id,
      file,
      note,
      visitedAt,
    })

    if (memoryError) {
      setError(memoryError)
      return { error: memoryError }
    }

    setMemories((prev) => {
      if (prev.some((memory) => memory.id === data.id)) return prev
      return [data, ...prev]
    })
    setFoods((prev) => prev.map((item) => (
      item.id === food.id ? { ...item, eaten_at: visitedAt } : item
    )))
    setMemoryFood(null)
    setError('')
    addToast?.('추억이 저장됐어요.', '📸')
    return { error: null }
  }

  const handleToggleFavorite = async (food) => {
    const { data, error: favoriteError } = await toggleFoodFavorite(food)

    if (favoriteError) {
      setError(favoriteError)
      return
    }

    setFoods((prev) => prev.map((item) => (item.id === food.id ? data : item)))
    setError('')
  }

  const handleOpenMap = (food) => {
    if (!food.map_url) return
    window.open(food.map_url, '_blank', 'noopener,noreferrer')
  }

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(inviteCode)
    } catch {
      const textarea = document.createElement('textarea')
      textarea.value = inviteCode
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
    }

    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleFilterChange = async (nextFilter) => {
    if (nextFilter !== 'nearby') {
      setFilter(nextFilter)
      setNearbyError('')
      return
    }

    const fallbackFilter = filter === 'nearby' ? 'active' : filter

    if (userCoords) {
      setFilter('nearby')
      setNearbyError('')
      return
    }

    if (!navigator.geolocation) {
      setNearbyError('가까운 순으로 보려면 위치 기능이 가능한 브라우저가 필요해요.')
      setFilter(fallbackFilter)
      return
    }

    try {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000,
        })
      })

      setUserCoords({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      })
      setFilter('nearby')
      setNearbyError('')
    } catch {
      setNearbyError('가까운 순으로 보려면 위치 권한이 필요해요.')
      setFilter(fallbackFilter)
    }
  }

  const categories = useMemo(
    () => Array.from(new Set(foods.map((food) => food.category).filter(Boolean))).sort(),
    [foods],
  )

  const normalizedSearch = search.trim().toLowerCase()

  const activeFoods = useMemo(
    () => foods.filter((food) => !food.eaten_at),
    [foods],
  )

  const filteredFoods = useMemo(() => {
    const baseFoods =
      filter === 'active' ? activeFoods :
      filter === 'favorites' ? foods.filter((food) => food.is_favorite) :
      filter === 'nearby'
        ? activeFoods
            .filter((food) => food.latitude != null && food.longitude != null)
            .map((food) => ({
              ...food,
              distanceKm: getDistanceKm(userCoords, food),
            }))
            .sort((left, right) => (left.distanceKm ?? Number.MAX_SAFE_INTEGER) - (right.distanceKm ?? Number.MAX_SAFE_INTEGER))
        : []

    return baseFoods.filter((food) => {
      const haystack = [
        food.name,
        food.place_name,
        food.location,
        food.category,
        food.notes,
        food.person,
      ].filter(Boolean).join(' ').toLowerCase()

      const matchesSearch = haystack.includes(normalizedSearch)
      const matchesCategory = categoryFilter === 'all' || food.category === categoryFilter

      return matchesSearch && matchesCategory
    })
  }, [activeFoods, categoryFilter, filter, foods, normalizedSearch, userCoords])

  const filteredMemories = useMemo(() => memories.filter((memory) => {
    const haystack = [
      memory.note,
      memory.foods?.name,
      memory.foods?.place_name,
      memory.foods?.location,
    ].filter(Boolean).join(' ').toLowerCase()

    return haystack.includes(normalizedSearch)
  }), [memories, normalizedSearch])

  const randomFoods = activeFoods.length ? activeFoods : foods
  const isHistoryView = filter === 'history'
  const isNearbyView = filter === 'nearby'
  const isFavoritesView = filter === 'favorites'

  return (
    <div className="room-layout">
      <ToastContainer />

      <header className="room-header">
        <div className="room-header-left">
          <button className="back-btn" onClick={() => navigate('/home')} title="뒤로가기">‹</button>
          <span className="room-header-title">{roomTitle}</span>
        </div>
        {inviteCode && (
          <button className="invite-btn" onClick={handleCopyCode} title="초대 코드 복사">
            <span className="invite-code">{inviteCode}</span>
            <span className="invite-icon">{copied ? '✓' : '🔗'}</span>
          </button>
        )}
      </header>

      <main className="room-main">
        {error && <p className="form-error persistent">{error}</p>}
        {nearbyError && <p className="form-error persistent">{nearbyError}</p>}

        {loading ? (
          <div className="loading-screen">
            <div className="loading-spinner" />
          </div>
        ) : foods.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🍜</div>
            <p className="empty-title">아직 음식이 없어요</p>
            <p className="empty-sub">아래 + 버튼으로 첫 메뉴를 추가해 보세요.</p>
          </div>
        ) : (
          <>
            <section className="food-tools">
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={isHistoryView ? '가게 이름이나 메모 검색' : '메뉴, 장소, 메모 검색'}
                aria-label="음식 검색"
              />

              <div className="food-mode-row">
                {PRIMARY_FILTERS.map((item) => (
                  <button
                    key={item.id}
                    className={`mode-chip${filter === item.id ? ' active' : ''}`}
                    onClick={() => handleFilterChange(item.id)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {!isHistoryView && categories.length > 0 && (
                <div className="food-filter-row secondary">
                  <button
                    className={`filter-chip favorite-toggle-chip${isFavoritesView ? ' active' : ''}`}
                    onClick={() => handleFilterChange(isFavoritesView ? 'active' : 'favorites')}
                  >
                    {isFavoritesView ? '전체 보기' : '즐겨찾기만'}
                  </button>
                  <button
                    className={`filter-chip${categoryFilter === 'all' ? ' active' : ''}`}
                    onClick={() => setCategoryFilter('all')}
                  >
                    전체
                  </button>
                  {categories.map((category) => (
                    <button
                      key={category}
                      className={`filter-chip${categoryFilter === category ? ' active' : ''}`}
                      onClick={() => setCategoryFilter(category)}
                    >
                      {category}
                    </button>
                  ))}
                </div>
              )}

              {!isHistoryView && categories.length === 0 && (
                <div className="food-filter-row secondary">
                  <button
                    className={`filter-chip favorite-toggle-chip${isFavoritesView ? ' active' : ''}`}
                    onClick={() => handleFilterChange(isFavoritesView ? 'active' : 'favorites')}
                  >
                    {isFavoritesView ? '전체 보기' : '즐겨찾기만'}
                  </button>
                </div>
              )}
            </section>

            {isNearbyView && (
              <p className="filter-helper">지도 위치가 확인된 음식만 가까운 순으로 보여줘요.</p>
            )}

            {isHistoryView ? (
              filteredMemories.length === 0 ? (
                <div className="empty-state compact">
                  <div className="empty-icon">📸</div>
                  <p className="empty-title">아직 추억이 없어요</p>
                  <p className="empty-sub">방문 완료를 누르면 사진과 메모를 함께 남길 수 있어요.</p>
                </div>
              ) : (
                <section className="memory-list">
                  {filteredMemories.map((memory, index) => (
                    <article
                      key={memory.id}
                      className="memory-card"
                      style={{ animationDelay: `${index * 40}ms` }}
                    >
                      {memory.photo_url ? (
                        <img
                          className="memory-card-photo"
                          src={memory.photo_url}
                          alt={`${memory.foods?.place_name || memory.foods?.name || '추억'} 사진`}
                        />
                      ) : (
                        <div className="memory-card-photo placeholder">📸</div>
                      )}

                      <div className="memory-card-body">
                        <div className="memory-card-head">
                          <p className="memory-card-title">
                            {memory.foods?.place_name || memory.foods?.name || '우리의 추억'}
                          </p>
                          <p className="memory-card-date">{formatVisitedDate(memory.visited_at)}</p>
                        </div>

                        {memory.foods?.location && (
                          <p className="memory-card-location">📍 {memory.foods.location}</p>
                        )}

                        {memory.note && (
                          <p className="memory-card-note">{memory.note}</p>
                        )}
                      </div>
                    </article>
                  ))}
                </section>
              )
            ) : filteredFoods.length === 0 ? (
              <div className="empty-state compact">
                <div className="empty-icon">{isNearbyView ? '📍' : '🔎'}</div>
                <p className="empty-title">
                  {isNearbyView ? '가까운 가게가 없어요' : '조건에 맞는 음식이 없어요'}
                </p>
                <p className="empty-sub">
                  {isNearbyView
                    ? '위도와 경도가 있는 음식만 가까운 순으로 보여줘요.'
                    : '검색어를 줄이거나 다른 필터를 골라보세요.'}
                </p>
              </div>
            ) : (
              <ul className="food-list">
                {filteredFoods.map((food, index) => (
                  <FoodCard
                    key={food.id}
                    food={food}
                    currentUserId={session.user.id}
                    distanceText={isNearbyView ? formatDistance(food.distanceKm) : ''}
                    onOpenMap={handleOpenMap}
                    onDelete={handleDelete}
                    onEdit={setEditingFood}
                    onMarkEaten={handleMarkVisited}
                    onToggleFavorite={handleToggleFavorite}
                    style={{ animationDelay: `${index * 40}ms` }}
                  />
                ))}
              </ul>
            )}
          </>
        )}
      </main>

      <div className="action-bar">
        <button
          className="action-btn random-btn"
          onClick={() => setShowRandom(true)}
          disabled={randomFoods.length === 0}
          title="랜덤 뽑기"
        >
          🎲<span>랜덤 뽑기</span>
        </button>
        <button className="action-btn add-btn" onClick={() => setShowAdd(true)} title="음식 추가">
          +<span>추가하기</span>
        </button>
      </div>

      {showAdd && <AddFoodModal onClose={() => setShowAdd(false)} onAdd={handleAdd} />}
      {editingFood && (
        <AddFoodModal
          food={editingFood}
          onClose={() => setEditingFood(null)}
          onAdd={handleAdd}
          onSave={handleUpdate}
        />
      )}
      {memoryFood && (
        <MemoryModal
          food={memoryFood}
          onClose={() => setMemoryFood(null)}
          onSave={handleSaveMemory}
        />
      )}
      {showRandom && randomFoods.length > 0 && (
        <RandomPickModal
          foods={randomFoods}
          onClose={() => setShowRandom(false)}
          onMarkEaten={handleMarkVisited}
        />
      )}
    </div>
  )
}
