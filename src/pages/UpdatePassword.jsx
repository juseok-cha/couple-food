import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function UpdatePassword() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setMessage('')

    if (password.length < 6) {
      setError('비밀번호는 6자 이상이어야 해요.')
      return
    }

    setLoading(true)

    const { error: updateError } = await supabase.auth.updateUser({ password })

    if (updateError) {
      setError(updateError.message)
    } else {
      setMessage('비밀번호가 변경됐어요. 다시 로그인해 주세요.')
      await supabase.auth.signOut()
      setTimeout(() => navigate('/login', { replace: true }), 1200)
    }

    setLoading(false)
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-logo">🍽️</div>
        <h1 className="auth-title">새 비밀번호</h1>
        <p className="auth-subtitle">앞으로 사용할 비밀번호를 입력해 주세요</p>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="input-group">
            <label htmlFor="new-password">새 비밀번호</label>
            <input
              id="new-password"
              type="password"
              placeholder="6자 이상"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
            />
          </div>

          {error && <p className="form-error">{error}</p>}
          {message && <p className="form-success">{message}</p>}

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? '변경 중...' : '비밀번호 변경'}
          </button>
        </form>
      </div>
    </div>
  )
}
