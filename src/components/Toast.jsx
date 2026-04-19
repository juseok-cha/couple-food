import { useState, useEffect, useCallback } from 'react'

let _addToast = null

export function useToast() {
  return { addToast: _addToast }
}

export default function ToastContainer() {
  const [toasts, setToasts] = useState([])

  const addToast = useCallback((message, emoji = '🍽️') => {
    const id = Date.now()
    setToasts((prev) => [...prev, { id, message, emoji }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 3500)
  }, [])

  useEffect(() => {
    _addToast = addToast
    return () => { _addToast = null }
  }, [addToast])

  if (toasts.length === 0) return null

  return (
    <div className="toast-container">
      {toasts.map((t) => (
        <div key={t.id} className="toast">
          <span className="toast-emoji">{t.emoji}</span>
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  )
}
