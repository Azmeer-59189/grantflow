import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './supabase'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import AddGrant from './pages/AddGrant'
import EditGrant from './pages/EditGrant'


function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check if user is already logged in
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    // Listen for login/logout
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => setSession(session)
    )

    return () => subscription.unsubscribe()
  }, [])

  // Don't render anything until we know auth status
  if (loading) return null

  return (
    <BrowserRouter>
      <Routes>
        {/* Public — redirect to dashboard if already logged in */}
        <Route
          path="/login"
          element={!session ? <Login /> : <Navigate to="/" />}
        />

        {/* Protected — redirect to login if not logged in */}
        <Route
          path="/"
          element={session
            ? <Dashboard session={session} />
            : <Navigate to="/login" />}
        />
        <Route
          path="/add-grant"
          element={session
            ? <AddGrant />
            : <Navigate to="/login" />}
        />

        // Add this route
        <Route
          path="/edit-grant/:grantNumber"
          element={session
            ? <EditGrant />
            : <Navigate to="/login" />}
        />

        {/* Catch all unknown routes */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App