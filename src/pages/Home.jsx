import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

function generateInviteCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

// ── Tab: Rooms List ───────────────────────────────────────────
function RoomsTab({ session }) {
  const [rooms, setRooms] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    const fetchRooms = async () => {
      const { data } = await supabase
        .from('room_members')
        .select('room_id, rooms(id, title, invite_code, created_at)')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })

      if (data) {
        setRooms(data.map((m) => m.rooms).filter(Boolean))
      }
      setLoading(false)
    }

    fetchRooms()
  }, [session.user.id])

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
      </div>
    )
  }

  if (rooms.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon">🍽️</div>
        <p className="empty-title">아직 참여한 방이 없어요</p>
        <p className="empty-sub">아래 탭에서 방을 만들거나 코드로 입장해봐요!</p>
      </div>
    )
  }

  return (
    <ul className="room-list">
      {rooms.map((room, i) => (
        <li
          key={room.id}
          className="room-card"
          style={{ animationDelay: `${i * 50}ms` }}
          onClick={() => navigate(`/room/${room.id}`)}
        >
          <div className="room-card-emoji">🍜</div>
          <div className="room-card-info">
            <p className="room-card-title">{room.title}</p>
            <p className="room-card-meta">코드: {room.invite_code}</p>
          </div>
          <span className="room-card-arrow">›</span>
        </li>
      ))}
    </ul>
  )
}

// ── Tab: Profile ──────────────────────────────────────────────
function ProfileTab({ session }) {
  const [avatarUrl, setAvatarUrl] = useState(null)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef(null)

  useEffect(() => {
    supabase
      .from('profiles')
      .select('avatar_url')
      .eq('id', session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.avatar_url) setAvatarUrl(data.avatar_url)
      })
  }, [session.user.id])

  const handleAvatarClick = () => fileInputRef.current?.click()

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    const ext = file.name.split('.').pop()
    const path = `${session.user.id}/avatar.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true })

    if (!uploadError) {
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(path)

      await supabase
        .from('profiles')
        .upsert({ id: session.user.id, avatar_url: publicUrl, updated_at: new Date().toISOString() })

      setAvatarUrl(publicUrl + '?t=' + Date.now())
    }

    setUploading(false)
  }

  const handleSignOut = () => supabase.auth.signOut()

  return (
    <div className="profile-section">
      <div className="avatar-wrapper" onClick={handleAvatarClick}>
        {avatarUrl ? (
          <img src={avatarUrl} alt="프로필" className="avatar-img" />
        ) : (
          <div className="avatar-placeholder">🐰</div>
        )}
        <div className="avatar-edit-badge">
          {uploading ? '⏳' : '✎'}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
      </div>

      <p className="profile-email">{session.user.email}</p>

      <div className="profile-actions">
        <button className="btn-secondary" onClick={handleSignOut}>
          로그아웃
        </button>
      </div>
    </div>
  )
}

// ── Tab: Create / Join Room ───────────────────────────────────
function CreateTab({ session, onRoomJoined }) {
  const [mode, setMode] = useState('create')
  const [inviteCode, setInviteCode] = useState('')
  const [roomTitle, setRoomTitle] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const handleCreate = async () => {
    setError('')
    setLoading(true)

    let code = generateInviteCode()
    let room = null

    for (let i = 0; i < 5; i++) {
      const { data, error: roomErr } = await supabase
        .from('rooms')
        .insert({
          invite_code: code,
          title: roomTitle.trim() || '우리의 맛집 리스트',
        })
        .select()
        .single()

      if (!roomErr) { room = data; break }
      code = generateInviteCode()
    }

    if (!room) {
      setError('방 생성에 실패했어요. 다시 시도해 주세요.')
      setLoading(false)
      return
    }

    const { error: memberErr } = await supabase
      .from('room_members')
      .insert({ room_id: room.id, user_id: session.user.id })

    if (memberErr) {
      setError('방 참여에 실패했어요. 다시 시도해 주세요.')
      setLoading(false)
      return
    }

    setLoading(false)
    navigate(`/room/${room.id}`)
  }

  const handleJoin = async () => {
    setError('')
    if (!inviteCode.trim()) {
      setError('초대 코드를 입력해 주세요.')
      return
    }

    setLoading(true)

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

    const { error: joinErr } = await supabase
      .from('room_members')
      .insert({ room_id: room.id, user_id: session.user.id })

    if (joinErr && joinErr.code !== '23505') {
      setError('방 참여에 실패했어요. 다시 시도해 주세요.')
      setLoading(false)
      return
    }

    setLoading(false)
    navigate(`/room/${room.id}`)
  }

  return (
    <div className="create-room-section">
      <h2 className="section-heading">방 만들기 / 입장</h2>

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
        <div className="join-content" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="input-group">
            <label htmlFor="room-title">방 이름 (선택)</label>
            <input
              id="room-title"
              type="text"
              placeholder="ex) 우리 먹방 리스트 🍜"
              value={roomTitle}
              onChange={(e) => setRoomTitle(e.target.value)}
              maxLength={30}
            />
          </div>
          <p className="join-desc">
            방을 만들면 <strong>8자리 초대 코드</strong>가 생성돼요.
            파트너에게 코드를 공유해서 같이 써봐요!
          </p>
          {error && <p className="form-error">{error}</p>}
          <button className="btn-primary" onClick={handleCreate} disabled={loading}>
            {loading ? '방 만드는 중…' : '방 만들기 ✨'}
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
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
            {loading ? '입장 중…' : '입장하기 🚀'}
          </button>
        </div>
      )}
    </div>
  )
}

// ── Home Page ─────────────────────────────────────────────────
export default function Home({ session }) {
  const [tab, setTab] = useState('rooms')

  const tabs = [
    { id: 'rooms', icon: '🏠', label: '방 목록' },
    { id: 'create', icon: '✨', label: '방 만들기' },
    { id: 'profile', icon: '🐰', label: '내 정보' },
  ]

  return (
    <div className="home-layout">
      <header className="home-header">
        <div className="home-header-title">
          <span className="home-header-logo">🍽️</span>
          Couple Food
        </div>
      </header>

      <main className="home-content">
        {tab === 'rooms' && <RoomsTab session={session} />}
        {tab === 'create' && <CreateTab session={session} />}
        {tab === 'profile' && <ProfileTab session={session} />}
      </main>

      <nav className="tab-bar">
        {tabs.map((t) => (
          <button
            key={t.id}
            className={`tab-bar-item${tab === t.id ? ' active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            <span className="tab-icon">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  )
}
