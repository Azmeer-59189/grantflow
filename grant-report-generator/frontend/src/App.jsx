import { lazy, Suspense, useEffect, useState } from 'react'
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom'
import { supabase } from './supabase'
import { apiFetch } from './lib/api'
import { AccessContext, useAccess } from './context/Access'
import Login from './pages/Login'
import { ToastProvider } from './context/Toast'

const Dashboard = lazy(() => import('./pages/Dashboard'))
const AddGrant = lazy(() => import('./pages/AddGrant'))
const EditGrant = lazy(() => import('./pages/EditGrant'))
const History = lazy(() => import('./pages/History'))
const Audit = lazy(() => import('./pages/Audit'))
const Access = lazy(() => import('./pages/Access'))

function Loading() {
  return (
    <div role="status" className="flex min-h-screen items-center justify-center bg-canvas">
      <span className="flex items-center gap-3 text-sm text-slate-500">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />Loading workspace...
      </span>
    </div>
  )
}
function Protected({ page, editor = false, admin = false }) {
  const { session, role, loading, error } = useAccess()
  if (loading) return <Loading />
  if (!session) return <Navigate to="/login" replace />
  if (error) return <div role="alert" className="p-8 text-rose-700">{error}<button onClick={() => window.location.reload()} className="ml-3 underline">Retry</button><button onClick={() => supabase.auth.signOut()} className="ml-3 underline">Sign out</button></div>
  if (editor && !['editor', 'admin', 'owner'].includes(role)) return <Navigate to="/" replace />
  if (admin && !['admin', 'owner'].includes(role)) return <Navigate to="/" replace />
  const pages = { dashboard: <Dashboard session={session} />, add: <AddGrant />, edit: <EditGrant />, history: <History />, audit: <Audit />, access: <Access /> }
  return <Suspense fallback={<Loading />}>{pages[page]}</Suspense>
}
function LoginRoute() {
  const { session, loading } = useAccess()
  if (loading) return <Loading />
  return session ? <Navigate to="/" replace /> : <Login />
}
const router = createBrowserRouter([
  { path: '/login', element: <LoginRoute /> },
  { path: '/', element: <Protected page="dashboard" /> },
  { path: '/add-grant', element: <Protected page="add" editor /> },
  { path: '/edit-grant/:grantNumber', element: <Protected page="edit" editor /> },
  { path: '/history', element: <Protected page="history" /> },
  { path: '/audit', element: <Protected page="audit" /> },
  { path: '/access', element: <Protected page="access" admin /> },
  { path: '*', element: <Navigate to="/" replace /> },
])

export default function App() {
  const [access, setAccess] = useState({ session: null, role: 'viewer', loading: true, error: '' })
  useEffect(() => {
    let active = true
    let revision = 0
    async function update(session) {
      const current = ++revision
      if (!session) { if (active) setAccess({ session: null, role: 'viewer', loading: false, error: '' }); return }
      try {
        const response = await apiFetch(`${import.meta.env.VITE_API_URL}/api/me`)
        const data = await response.json()
        if (!response.ok) throw new Error(data.detail || 'Could not load account permissions.')
        if (active && current === revision) setAccess({ session, role: data.role, loading: false, error: '' })
      } catch (error) {
        if (active && current === revision) setAccess({ session, role: 'viewer', loading: false, error: error.message })
      }
    }
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (!active) return
      if (error) setAccess({ session: null, role: 'viewer', loading: false, error: error.message })
      else update(session)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      // Defer Auth calls outside Supabase's auth-state callback lock.
      queueMicrotask(() => { if (active) update(session) })
    })
    return () => { active = false; subscription.unsubscribe() }
  }, [])
  return <AccessContext.Provider value={access}><ToastProvider><RouterProvider router={router} /></ToastProvider></AccessContext.Provider>
}
