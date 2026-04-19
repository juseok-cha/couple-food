import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import FoodCard from '../components/FoodCard'
import AddFoodModal from '../components/AddFoodModal'
import RandomPickModal from '../components/RandomPickModal'
import ToastContainer, { useToast } from '../components/Toast'
import {
  addFood,
  deleteFood,
  fetchFoods,
  fetchRoom,
  markFoodEaten,
  toggleFoodFavorite,
  updateFood,
} from '../lib/dataApi'
import { supabase } from '../lib/supabase'

const FILTERS = [
  { id: 'active', label: '먹고 싶은 것' },
  { id: 'favorites', label: '즐겨찾기' },
  { id: 'history', label: '먹은 기록' },
]

export default function Room({ session }) {
  const { roomId } = useParams()
  const navigate = useNavigate()
  const { addToast } = useToast()

  const [foods, setFoods] = useState([])
  const [roomTitle, setRoomTitle] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [editingFood, setEditingFood] = useState(null)
  const [showRandom, setShowRandom] = useState(false)
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('active')
  const [categoryFilter, setCategoryFilter] = useState('all')

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

  useEffect(() => {
    loadRoom()
    loadFoods()
  }, [loadRoom, loadFoods])

  useEffect(() => {
    const channel = supabase
      .channel(`room-${roomId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'foods',
        filter: `room_id=eq.${roomId}`,
      }, (payload) => {
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
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [roomId, session.user.id, addToast])

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

  const handleMarkEaten = async (food) => {
    const { data, error: eatenError } = await markFoodEaten(food.id)

    if (eatenError) {
      setError(eatenError)
      return
    }

    setFoods((prev) => prev.map((item) => (item.id === food.id ? data : item)))
    setError('')
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

  const categories = Array.from(new Set(foods.map((food) => food.category).filter(Boolean))).sort()
  const activeFoods = foods.filter((food) => !food.eaten_at)
  const searchedFoods = foods.filter((food) => {
    const haystack = [
      food.name,
      food.location,
      food.category,
      food.notes,
      food.person,
    ].filter(Boolean).join(' ').toLowerCase()

    const matchesSearch = haystack.includes(search.trim().toLowerCase())
    const matchesCategory = categoryFilter === 'all' || food.category === categoryFilter
    const matchesFilter =
      filter === 'active' ? !food.eaten_at :
      filter === 'favorites' ? food.is_favorite :
      Boolean(food.eaten_at)

    return matchesSearch && matchesCategory && matchesFilter
  })

  const randomFoods = activeFoods.length ? activeFoods : foods

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
                placeholder="메뉴, 장소, 메모 검색"
                aria-label="음식 검색"
              />

              <div className="food-filter-row">
                {FILTERS.map((item) => (
                  <button
                    key={item.id}
                    className={`filter-chip${filter === item.id ? ' active' : ''}`}
                    onClick={() => setFilter(item.id)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {categories.length > 0 && (
                <div className="food-filter-row">
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
            </section>

            {searchedFoods.length === 0 ? (
              <div className="empty-state compact">
                <div className="empty-icon">🔎</div>
                <p className="empty-title">조건에 맞는 음식이 없어요</p>
                <p className="empty-sub">검색어를 줄이거나 다른 필터를 골라보세요.</p>
              </div>
            ) : (
              <ul className="food-list">
                {searchedFoods.map((food, index) => (
                  <FoodCard
                    key={food.id}
                    food={food}
                    currentUserId={session.user.id}
                    onDelete={handleDelete}
                    onEdit={setEditingFood}
                    onMarkEaten={handleMarkEaten}
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
      {showRandom && randomFoods.length > 0 && (
        <RandomPickModal
          foods={randomFoods}
          onClose={() => setShowRandom(false)}
          onMarkEaten={handleMarkEaten}
        />
      )}
    </div>
  )
}
