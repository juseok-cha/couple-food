import { useState } from 'react'
import { supabase } from '../lib/supabase'

function getAuthErrorMessage(error, fallback) {
  const message = error?.message || ''

  if (message.toLowerCase().includes('email rate limit exceeded')) {
    return 'Supabase 이메일 발송 제한에 걸렸어요. 잠시 후 다시 시도하거나 Supabase에서 이메일 확인을 꺼주세요.'
  }

  if (message.toLowerCase().includes('email not confirmed')) {
    return '이메일 확인이 아직 끝나지 않았어요. 메일함을 확인하거나 개발 중에는 Supabase에서 이메일 확인을 꺼주세요.'
  }

  return fallback || message || '요청을 처리하지 못했어요.'
}

export default function Login() {
  const [mode, setMode] = useState('login') // 'login' | 'signup' | 'reset'
  const [userId, setUserId] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setMessage('')
    setLoading(true)

    if (mode === 'reset') {
      const { error } = await supabase.auth.resetPasswordForEmail(userId, {
        redirectTo: `${window.location.origin}/update-password`,
      })

      if (error) {
        setError(getAuthErrorMessage(error, '비밀번호 재설정 메일을 보내지 못했어요.'))
      } else {
        setMessage('비밀번호 재설정 메일을 보냈어요. 이메일을 확인해 주세요.')
      }
    } else if (mode === 'signup') {
      const { error } = await supabase.auth.signUp({ email: userId, password })
      if (error) {
        setError(getAuthErrorMessage(error, '회원가입에 실패했어요.'))
      } else {
        setMessage('가입 완료! 이메일을 확인하거나 바로 로그인해 주세요.')
        setMode('login')
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email: userId, password })
      if (error) {
        setError(getAuthErrorMessage(error, '아이디(이메일) 또는 비밀번호가 올바르지 않아요.'))
      }
      // On success App.jsx will redirect automatically via onAuthStateChange
    }

    setLoading(false)
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-logo">🍽️</div>
        <h1 className="auth-title">Couple Food</h1>
        <p className="auth-subtitle">아이디/비밀번호 만들고, 파트너와 함께 저녁 리스트를 써요</p>

        <div className="tab-group">
          <button
            className={`tab-btn${mode === 'login' ? ' active' : ''}`}
            onClick={() => { setMode('login'); setError(''); setMessage('') }}
          >
            로그인
          </button>
          <button
            className={`tab-btn${mode === 'signup' ? ' active' : ''}`}
            onClick={() => { setMode('signup'); setError(''); setMessage('') }}
          >
            회원가입
          </button>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="input-group">
            <label htmlFor="user-id">아이디 (이메일)</label>
            <input
              id="user-id"
              type="email"
              placeholder="아이디로 쓸 이메일"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              required
              autoComplete="username"
            />
          </div>

          {mode !== 'reset' && (
            <div className="input-group">
              <label htmlFor="password">비밀번호</label>
              <input
                id="password"
                type="password"
                placeholder={mode === 'signup' ? '6자 이상' : '••••••••'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              />
            </div>
          )}

          {error && <p className="form-error">{error}</p>}
          {message && <p className="form-success">{message}</p>}

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? '잠깐만요…' : mode === 'reset' ? '재설정 메일 받기' : mode === 'login' ? '로그인' : '가입하기'}
          </button>

          {mode === 'login' && (
            <button
              type="button"
              className="auth-link-btn"
              onClick={() => { setMode('reset'); setError(''); setMessage('') }}
            >
              비밀번호를 잊으셨나요?
            </button>
          )}

          {mode === 'reset' && (
            <button
              type="button"
              className="auth-link-btn"
              onClick={() => { setMode('login'); setError(''); setMessage('') }}
            >
              로그인으로 돌아가기
            </button>
          )}
        </form>
      </div>
    </div>
  )
}
