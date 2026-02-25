import { useEffect, useState } from 'react'
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import Login from './pages/Login'
import Join from './pages/Join'
import Room from './pages/Room'

function App() {
  const [session, setSession] = useState(undefined) // undefined = loading
  const [roomId, setRoomId] = useState(undefined)
  const navigate = useNavigate()

  // Auth state listener
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  // Check room membership whenever session changes
  useEffect(() => {
    if (!session) {
      setRoomId(null)
      return
    }

    supabase
      .from('room_members')
      .select('room_id')
      .eq('user_id', session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        setRoomId(data?.room_id ?? null)
      })
  }, [session])

  // Loading state
  if (session === undefined || (session && roomId === undefined)) {
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
        element={
          !session
            ? <Login />
            : <Navigate to={roomId ? '/room' : '/join'} replace />
        }
      />
      <Route
        path="/join"
        element={
          !session
            ? <Navigate to="/login" replace />
            : roomId
            ? <Navigate to="/room" replace />
            : <Join onJoined={(id) => { setRoomId(id); navigate('/room') }} />
        }
      />
      <Route
        path="/room"
        element={
          !session
            ? <Navigate to="/login" replace />
            : !roomId
            ? <Navigate to="/join" replace />
            : <Room session={session} roomId={roomId} />
        }
      />
      <Route
        path="*"
        element={
          <Navigate
            to={!session ? '/login' : roomId ? '/room' : '/join'}
            replace
          />
        }
      />
    </Routes>
  )
}

export default App
