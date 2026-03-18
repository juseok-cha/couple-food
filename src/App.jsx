import { useEffect, useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import Login from './pages/Login'
import Home from './pages/Home'
import Room from './pages/Room'

function App() {
  const [session, setSession] = useState(undefined) // undefined = loading

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  if (session === undefined) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
      </div>
    )
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={!session ? <Login /> : <Navigate to="/home" replace />}
      />
      <Route
        path="/home"
        element={!session ? <Navigate to="/login" replace /> : <Home session={session} />}
      />
      <Route
        path="/room/:roomId"
        element={!session ? <Navigate to="/login" replace /> : <Room session={session} />}
      />
      <Route
        path="*"
        element={<Navigate to={session ? '/home' : '/login'} replace />}
      />
    </Routes>
  )
}

export default App
