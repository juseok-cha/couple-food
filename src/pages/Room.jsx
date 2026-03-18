import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import FoodCard from '../components/FoodCard'
import AddFoodModal from '../components/AddFoodModal'
import RandomPickModal from '../components/RandomPickModal'
import ToastContainer, { useToast } from '../components/Toast'

export default function Room({ session }) {
  const { roomId } = useParams()
  const navigate = useNavigate()
  const { addToast } = useToast()

  const [foods, setFoods] = useState([])
  const [roomTitle, setRoomTitle] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [showRandom, setShowRandom] = useState(false)
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(true)

  // Fetch room info
  useEffect(() => {
    supabase
      .from('rooms')
      .select('invite_code, title')
      .eq('id', roomId)
      .single()
      .then(({ data }) => {
        if (data) {
          setInviteCode(data.invite_code)
          setRoomTitle(data.title || '우리의 맛집 리스트')
        }
      })
  }, [roomId])

  // Fetch foods
  const fetchFoods = useCallback(async () => {
    const { data } = await supabase
      .from('foods')
      .select('*')
      .eq('room_id', roomId)
      .order('created_at', { ascending: false })

    if (data) setFoods(data)
    setLoading(false)
  }, [roomId])

  useEffect(() => {
    fetchFoods()
  }, [fetchFoods])

  // Realtime subscription — alert when others add food
  useEffect(() => {
    const channel = supabase
      .channel(`room-${roomId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'foods', filter: `room_id=eq.${roomId}` },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newFood = payload.new
            setFoods((prev) => [newFood, ...prev])

            // Alert only when added by someone else
            if (newFood.added_by !== session.user.id) {
              addToast?.(`"${newFood.name}" 이(가) 추가됐어요! 🍽️`, '🔔')
            }
          } else if (payload.eventType === 'DELETE') {
            setFoods((prev) => prev.filter((f) => f.id !== payload.old.id))
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [roomId, session.user.id, addToast])

  const handleDelete = async (id) => {
    await supabase.from('foods').delete().eq('id', id)
  }

  const handleAdd = async (food) => {
    await supabase.from('foods').insert({
      ...food,
      room_id: roomId,
      added_by: session.user.id,
    })
    setShowAdd(false)
  }

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(inviteCode)
    } catch {
      const el = document.createElement('textarea')
      el.value = inviteCode
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="room-layout">
      <ToastContainer />

      {/* Header */}
      <header className="room-header">
        <div className="room-header-left">
          <button className="back-btn" onClick={() => navigate('/home')} title="뒤로가기">
            ‹
          </button>
          <span className="room-header-title">{roomTitle}</span>
        </div>
        <div className="room-header-right">
          {inviteCode && (
            <button className="invite-btn" onClick={handleCopyCode} title="초대 코드 복사">
              <span className="invite-code">{inviteCode}</span>
              <span className="invite-icon">{copied ? '✓' : '🔗'}</span>
            </button>
          )}
        </div>
      </header>

      {/* Main content */}
      <main className="room-main">
        {loading ? (
          <div className="loading-screen">
            <div className="loading-spinner" />
          </div>
        ) : foods.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🍜</div>
            <p className="empty-title">아직 먹고 싶은 음식이 없어요</p>
            <p className="empty-sub">+ 버튼을 눌러 첫 번째 음식을 추가해봐요!</p>
          </div>
        ) : (
          <ul className="food-list">
            {foods.map((food, i) => (
              <FoodCard
                key={food.id}
                food={food}
                currentUserId={session.user.id}
                onDelete={handleDelete}
                style={{ animationDelay: `${i * 40}ms` }}
              />
            ))}
          </ul>
        )}
      </main>

      {/* Bottom action bar */}
      <div className="action-bar">
        <button
          className="action-btn random-btn"
          onClick={() => setShowRandom(true)}
          disabled={foods.length === 0}
          title="랜덤 뽑기"
        >
          🎲
          <span>랜덤 뽑기</span>
        </button>
        <button
          className="action-btn add-btn"
          onClick={() => setShowAdd(true)}
          title="음식 추가"
        >
          +
          <span>추가하기</span>
        </button>
      </div>

      {/* Modals */}
      {showAdd && (
        <AddFoodModal onClose={() => setShowAdd(false)} onAdd={handleAdd} />
      )}
      {showRandom && foods.length > 0 && (
        <RandomPickModal foods={foods} onClose={() => setShowRandom(false)} />
      )}
    </div>
  )
}
