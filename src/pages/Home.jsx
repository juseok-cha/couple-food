import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  createRoomWithMembership,
  getMyProfile,
  getMyRooms,
  joinRoomByInviteCode,
  updateMyProfile,
  uploadAvatar,
} from '../lib/dataApi'
import { supabase } from '../lib/supabase'

export default function Home({ session }) {
  const navigate = useNavigate()
  const fileInputRef = useRef(null)

  const [avatarUrl, setAvatarUrl] = useState(session.user.user_metadata?.avatar_url || null)
  const [nickname, setNickname] = useState(session.user.user_metadata?.nickname || '')
  const [savedNickname, setSavedNickname] = useState(session.user.user_metadata?.nickname || '')
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [savingProfile, setSavingProfile] = useState(false)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState('')
  const [connectedRoom, setConnectedRoom] = useState(null)
  const [memberCount, setMemberCount] = useState(0)
  const [mode, setMode] = useState('invite')
  const [inviteCodeInput, setInviteCodeInput] = useState('')
  const [copied, setCopied] = useState(false)
  const [shared, setShared] = useState(false)

  const fetchMyCouple = useCallback(async () => {
    setError('')

    const { data: rooms, error: roomsError } = await getMyRooms(session.user.id)

    if (roomsError) {
      setError(roomsError)
      return
    }

    const room = rooms[0] || null
    setConnectedRoom(room)
    setMemberCount(room?.member_count || 0)

    if (!room) {
      setMemberCount(0)
      return
    }
  }, [session.user.id])

  useEffect(() => {
    let active = true

    const loadHome = async () => {
      setLoading(true)

      const { data: profile, error: profileError } = await getMyProfile(session.user.id)

      if (!active) return

      if (profileError) {
        setError(profileError)
      } else if (profile) {
        const nextNickname = profile.nickname || session.user.user_metadata?.nickname || ''
        const nextAvatarUrl = profile.avatar_url || session.user.user_metadata?.avatar_url || null

        setNickname(nextNickname)
        setSavedNickname(nextNickname)
        setAvatarUrl(nextAvatarUrl)
      }

      await fetchMyCouple()

      if (active) {
        setLoading(false)
      }
    }

    loadHome()

    return () => {
      active = false
    }
  }, [fetchMyCouple, session.user.id, session.user.user_metadata])

  useEffect(() => {
    if (!connectedRoom?.id) return undefined

    const channel = supabase
      .channel(`couple-members-${connectedRoom.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'room_members',
        filter: `room_id=eq.${connectedRoom.id}`,
      }, () => {
        fetchMyCouple()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [connectedRoom?.id, fetchMyCouple])

  const partnerName = connectedRoom?.partner?.nickname || '파트너'
  const isConnectedWithPartner = Boolean(connectedRoom?.partner || memberCount >= 2)

  const handleCreateInvite = async () => {
    setError('')
    setActionLoading(true)

    const { data, error: createError } = await createRoomWithMembership({
      userId: session.user.id,
      roomTitle: '우리의 저녁 리스트',
    })

    if (createError) {
      setError(createError)
      setActionLoading(false)
      return
    }

    setConnectedRoom(data)
    await fetchMyCouple()
    setActionLoading(false)
  }

  const handleAcceptInvite = async () => {
    const cleanedCode = inviteCodeInput.trim().toUpperCase()
    setError('')

    if (!cleanedCode) {
      setError('파트너가 보낸 초대 코드를 입력해 주세요.')
      return
    }

    setActionLoading(true)

    const { data, error: joinError } = await joinRoomByInviteCode({
      userId: session.user.id,
      inviteCode: cleanedCode,
    })

    if (joinError) {
      setError(joinError)
      setActionLoading(false)
      return
    }

    setInviteCodeInput('')
    setConnectedRoom(data)
    await fetchMyCouple()
    setActionLoading(false)
  }

  const handleSaveProfile = async () => {
    setError('')
    setSavingProfile(true)

    const { data, error: profileError } = await updateMyProfile({
      userId: session.user.id,
      nickname,
      avatarUrl,
    })

    if (profileError) {
      setError(profileError)
    } else {
      setNickname(data.nickname)
      setSavedNickname(data.nickname)
    }

    setSavingProfile(false)
  }

  const copyInviteCode = async () => {
    if (!connectedRoom?.invite_code) return false

    try {
      await navigator.clipboard.writeText(connectedRoom.invite_code)
    } catch {
      const textarea = document.createElement('textarea')
      textarea.value = connectedRoom.invite_code
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
    }

    return true
  }

  const handleCopyInviteCode = async () => {
    const didCopy = await copyInviteCode()
    if (!didCopy) return

    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleShareInvite = async () => {
    if (!connectedRoom?.invite_code) return

    const shareText = `Couple Food에서 우리 저녁 리스트에 들어와줘. 초대 코드: ${connectedRoom.invite_code}`

    try {
      if (navigator.share) {
        await navigator.share({
          title: 'Couple Food 초대',
          text: shareText,
        })
      } else {
        await copyInviteCode()
      }
    } catch {
      await copyInviteCode()
    }

    setShared(true)
    setTimeout(() => setShared(false), 2000)
  }

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    setError('')
    setUploadingAvatar(true)

    const { data, error: uploadError } = await uploadAvatar({ userId: session.user.id, file })

    if (uploadError) {
      setError(uploadError)
    } else {
      setAvatarUrl(data)
      if (savedNickname) {
        await updateMyProfile({ userId: session.user.id, nickname: savedNickname, avatarUrl: data })
      }
    }

    setUploadingAvatar(false)
    event.target.value = ''
  }

  const handleSignOut = () => supabase.auth.signOut()

  return (
    <div className="home-layout">
      <header className="home-header">
        <div className="home-header-title">
          <span className="home-header-logo">🍽️</span>
          Couple Food
        </div>
      </header>

      <main className="home-content couple-home-content">
        {loading ? (
          <div className="loading-screen">
            <div className="loading-spinner" />
          </div>
        ) : (
          <>
            <section className="couple-hero-card">
              <div className="couple-profile-row">
                <div className="avatar-wrapper" onClick={() => fileInputRef.current?.click()}>
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="프로필" className="avatar-img" />
                  ) : (
                    <div className="avatar-placeholder">🐰</div>
                  )}
                  <div className="avatar-edit-badge">{uploadingAvatar ? '⏳' : '✎'}</div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={handleFileChange}
                  />
                </div>

                <div className="couple-profile-copy">
                  <p className="profile-email">{session.user.email}</p>
                  <p className="couple-status">
                    {savedNickname ? `${savedNickname}로 표시돼요.` : '파트너에게 보일 닉네임을 정해요.'}
                  </p>
                </div>
              </div>

              <div className="couple-profile-form">
                <input
                  type="text"
                  value={nickname}
                  onChange={(event) => setNickname(event.target.value)}
                  placeholder="닉네임"
                  maxLength={20}
                  aria-label="닉네임"
                />
                <button
                  className="btn-secondary small"
                  onClick={handleSaveProfile}
                  disabled={savingProfile || nickname.trim() === savedNickname}
                >
                  {savingProfile ? '저장 중' : '저장'}
                </button>
              </div>

              {connectedRoom ? (
                <>
                  <p className="couple-status good">
                    {isConnectedWithPartner ? `${partnerName}님과 연결됐어요.` : '파트너를 기다리는 중이에요.'}
                  </p>
                  {!isConnectedWithPartner && (
                    <div className="couple-waiting-box">
                      <p className="couple-code">초대 코드: {connectedRoom.invite_code}</p>
                      <p className="join-desc">이 코드를 파트너에게 보내면 같은 저녁 리스트에 연결돼요.</p>
                    </div>
                  )}
                  {connectedRoom.partner && (
                    <div className="partner-card">
                      <div className="partner-avatar">
                        {connectedRoom.partner.avatar_url ? (
                          <img src={connectedRoom.partner.avatar_url} alt="파트너 프로필" />
                        ) : (
                          <span>💌</span>
                        )}
                      </div>
                      <div>
                        <p className="partner-label">내 파트너</p>
                        <p className="partner-name">{partnerName}</p>
                      </div>
                    </div>
                  )}
                  <div className="couple-actions">
                    {!isConnectedWithPartner && (
                      <>
                        <button className="btn-secondary" onClick={handleShareInvite}>
                          {shared ? '공유 준비 완료' : '초대 공유'}
                        </button>
                        <button className="btn-secondary" onClick={handleCopyInviteCode}>
                          {copied ? '복사 완료' : '코드 복사'}
                        </button>
                      </>
                    )}
                    <button className="btn-primary" onClick={() => navigate(`/room/${connectedRoom.id}`)}>
                      공유 저녁 리스트 열기
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="couple-status">아직 커플 연결 전이에요. 아래에서 바로 시작해요.</p>

                  <div className="tab-group">
                    <button
                      className={`tab-btn${mode === 'invite' ? ' active' : ''}`}
                      onClick={() => { setMode('invite'); setError('') }}
                    >
                      초대 보내기
                    </button>
                    <button
                      className={`tab-btn${mode === 'accept' ? ' active' : ''}`}
                      onClick={() => { setMode('accept'); setError('') }}
                    >
                      초대 받기
                    </button>
                  </div>

                  {mode === 'invite' ? (
                    <div className="couple-panel">
                      <p className="join-desc">내 초대 코드를 만들고 파트너에게 공유해요.</p>
                      <button className="btn-primary" onClick={handleCreateInvite} disabled={actionLoading}>
                        {actionLoading ? '코드 생성 중...' : '내 초대 코드 만들기'}
                      </button>
                    </div>
                  ) : (
                    <div className="couple-panel">
                      <div className="input-group">
                        <label htmlFor="invite-code">파트너 초대 코드</label>
                        <input
                          id="invite-code"
                          type="text"
                          placeholder="ABCD1234"
                          value={inviteCodeInput}
                          onChange={(event) => setInviteCodeInput(event.target.value.toUpperCase())}
                          maxLength={8}
                          autoComplete="off"
                          className="code-input"
                        />
                      </div>
                      <button className="btn-primary" onClick={handleAcceptInvite} disabled={actionLoading}>
                        {actionLoading ? '연결 중...' : '파트너와 연결하기'}
                      </button>
                    </div>
                  )}
                </>
              )}

              {error && <p className="form-error">{error}</p>}
            </section>

            <button className="btn-ghost couple-logout" onClick={handleSignOut}>
              로그아웃
            </button>
          </>
        )}
      </main>
    </div>
  )
}
