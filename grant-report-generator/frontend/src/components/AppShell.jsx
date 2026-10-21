import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAccess } from '../context/Access'
import { supabase } from '../supabase'
import { buttonClass } from './buttonStyles'
import { Icon } from './ui'

const ROLE_LABEL = { viewer: 'Viewer', editor: 'Editor', admin: 'Administrator', owner: 'Owner' }

function navItems(role) {
  const items = [
    { to: '/', label: 'Overview', icon: 'dashboard', match: (path, view) => path === '/' && view !== 'records' },
    { to: '/?view=records', label: 'Records', icon: 'records', match: (path, view) => path === '/' && view === 'records' },
    { to: '/history', label: 'Report history', icon: 'file', match: path => path === '/history' },
    { to: '/audit', label: 'Grant activity', icon: 'activity', match: path => path === '/audit' },
  ]
  const admin = ['admin', 'owner'].includes(role)
    ? [{ to: '/access', label: 'Team access', icon: 'team', match: path => path === '/access' }]
    : []
  return { items, admin }
}

function Sidebar({ onNavigate }) {
  const { role, session } = useAccess()
  const location = useLocation()
  const navigate = useNavigate()
  const view = new URLSearchParams(location.search).get('view')
  const { items, admin } = navItems(role)
  const canEdit = ['editor', 'admin', 'owner'].includes(role)
  const email = session?.user?.email || ''

  const link = item => {
    const active = item.match(location.pathname, view)
    return (
      <Link key={item.to} to={item.to} onClick={onNavigate} aria-current={active ? 'page' : undefined}
            className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition
              ${active ? 'bg-brand-50 text-brand-700' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`}>
        <Icon name={item.icon} className={`h-[18px] w-[18px] ${active ? 'text-brand-600' : 'text-slate-400 group-hover:text-slate-600'}`} />
        {item.label}
        {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-brand-500" />}
      </Link>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <Link to="/" onClick={onNavigate} className="flex items-center gap-3 px-6 pb-6 pt-7">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-lg font-bold text-white shadow-md shadow-brand-600/25">G<span className="text-brand-200">.</span></span>
        <span>
          <span className="block text-lg font-bold tracking-tight text-slate-900">GrantFlow</span>
          <span className="block text-[11px] font-medium tracking-wide text-slate-400">IHHN &amp; FOIH GRANTS</span>
        </span>
      </Link>

      {canEdit && (
        <div className="px-4 pb-5">
          <button type="button" onClick={() => { onNavigate?.(); navigate('/add-grant') }} className={`${buttonClass('primary')} w-full`}>
            <Icon name="plus" className="h-4 w-4" />New grant
          </button>
        </div>
      )}

      <nav className="flex-1 space-y-6 overflow-y-auto px-4" aria-label="Main navigation">
        <div>
          <p className="mb-2 px-3 text-[10px] font-semibold tracking-[0.16em] text-slate-400">WORKSPACE</p>
          <div className="space-y-1">{items.map(link)}</div>
        </div>
        {admin.length > 0 && (
          <div>
            <p className="mb-2 px-3 text-[10px] font-semibold tracking-[0.16em] text-slate-400">ADMIN</p>
            <div className="space-y-1">{admin.map(link)}</div>
          </div>
        )}
      </nav>

      <div className="m-4 rounded-2xl border border-slate-200/80 bg-slate-50/70 p-3.5">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">{email[0]?.toUpperCase() || 'G'}</span>
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-slate-700">{email}</p>
            <p className="text-[11px] text-slate-400">{ROLE_LABEL[role] || 'Viewer'}</p>
          </div>
        </div>
        <button type="button" onClick={() => supabase.auth.signOut()}
                className="mt-3 flex items-center gap-2 text-xs font-medium text-slate-500 hover:text-rose-600">
          <Icon name="logout" className="h-3.5 w-3.5" />Sign out
        </button>
      </div>
    </div>
  )
}

// Page frame: sidebar, top bar, page heading and content.
export default function AppShell({ title, subtitle, actions, back, children, width = 'max-w-[1400px]' }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()
  useEffect(() => {
    if (!menuOpen) return
    const onKey = event => { if (event.key === 'Escape') setMenuOpen(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [menuOpen])

  return (
    <div className="flex min-h-screen bg-canvas">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-r border-slate-200/80 bg-white lg:block">
        <Sidebar />
      </aside>

      {menuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setMenuOpen(false)} />
          <aside className="drawer-left absolute inset-y-0 left-0 w-72 bg-white shadow-2xl">
            <button type="button" onClick={() => setMenuOpen(false)} aria-label="Close menu"
                    className="absolute right-3 top-6 rounded-lg p-2 text-slate-400 hover:bg-slate-100"><Icon name="close" className="h-5 w-5" /></button>
            <Sidebar onNavigate={() => setMenuOpen(false)} />
          </aside>
        </div>
      )}

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-slate-200/70 bg-white/85 px-4 backdrop-blur md:px-8 lg:hidden">
          <button type="button" onClick={() => setMenuOpen(true)} aria-label="Open menu" className="rounded-lg p-2 text-slate-600 hover:bg-slate-100">
            <Icon name="menu" className="h-5 w-5" />
          </button>
          <span className="text-base font-semibold text-slate-900">GrantFlow</span>
        </header>

        <main key={location.pathname} className={`page-in mx-auto ${width} px-4 pb-16 pt-6 md:px-8 md:pt-8 lg:px-10`}>
          {back && (
            <Link to={back.to} className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-brand-700">
              <Icon name="arrowLeft" className="h-4 w-4" />{back.label}
            </Link>
          )}
          {(title || actions) && (
            <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
              <div className="min-w-0">
                <h1 className="text-[28px] font-semibold leading-tight tracking-tight text-slate-900">{title}</h1>
                {subtitle && <p className="mt-1.5 text-sm text-slate-500">{subtitle}</p>}
              </div>
              {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  )
}
