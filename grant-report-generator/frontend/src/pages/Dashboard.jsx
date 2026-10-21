import { useAccess } from '../context/Access'
import useSavedViews from '../hooks/useSavedViews'
import { sortRecords, paginateRecords, SORT_FIELDS } from '../lib/records'
import DeferredAnalytics from '../components/DeferredAnalytics'
import GrantTimeline from '../components/GrantTimeline'
import { formatDate } from '../lib/dates'
import { grantStage, STAGE_OPTIONS } from '../lib/pipeline'
import { apiFetch } from '../lib/api'
import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../supabase'
// ── Constants ───────────────────────────────────────────────────────────────
const CHAPTERS = ['FOIHUS', 'IDF', 'TIH UAE', 'IHN UK', 'FOIH Germany', 'FOIH Switzerland']
const COUNTRIES = ['United States', 'Canada', 'United Kingdom', 'Germany', 'Switzerland', 'UAE']
const ALL_SECTIONS_ON = {
  overview: true, financial: true, dates: true,
  shipping: true, grn: true, location: true,
  item: true, pictures: true, report: true,
}
const ALL_SECTIONS_OFF = Object.fromEntries(
  Object.keys(ALL_SECTIONS_ON).map(k => [k, false])
)
const SECTION_LABELS = [
  { key: 'overview', label: 'Grant overview' },
  { key: 'financial', label: 'Financial summary' },
  { key: 'dates', label: 'Key dates' },
  { key: 'shipping', label: 'Shipping & documents' },
  { key: 'grn', label: 'GRN / receiving' },
  { key: 'location', label: 'Installation & location' },
  { key: 'item', label: 'Item details' },
  { key: 'pictures', label: 'Pictures' },
  { key: 'report', label: 'Report status' },
]

const num = v => parseFloat(v) || 0
const usd = v => (v ? `$${Number(v).toLocaleString()}` : '—')
const usd0 = v => `$${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}`

function statusTone(value) {
  const green = ['Complete', 'Report Complete', 'Received', 'Paid']
  const red = ['Overdue', 'Discrepancy', 'Not Received', 'Incomplete Information',
    'Not received', 'Received with discrepancy']
  const gray = ['Not required', 'Not applicable']
  if (green.includes(value)) return 'green'
  if (red.includes(value)) return 'red'
  if (gray.includes(value)) return 'gray'
  return 'amber'
}
const TONES = {
  green: { pill: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20', dot: 'bg-emerald-500' },
  amber: { pill: 'bg-amber-50 text-amber-800 ring-amber-600/20', dot: 'bg-amber-500' },
  red:   { pill: 'bg-rose-50 text-rose-700 ring-rose-600/20', dot: 'bg-rose-500' },
  gray:  { pill: 'bg-slate-100 text-slate-600 ring-slate-500/20', dot: 'bg-slate-400' },
}

// ── Icons (inline, no extra package) ────────────────────────────────────────
const ICONS = {
  dashboard: 'M4 4h6v7H4zM14 4h6v4h-6zM14 12h6v8h-6zM4 15h6v5H4z',
  records: 'M4 6h16M4 12h16M4 18h10',
  history: 'M3 12a9 9 0 109-9 9 9 0 00-7 3M3 3v4h4M12 7v5l3 2',
  refresh: 'M20 7v5h-5M4 17v-5h5M6 7a7 7 0 0112-1l2 6M4 12l2 6a7 7 0 0012-1',
  plus: 'M12 5v14M5 12h14',
  logout: 'M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9',
  alert: 'M12 9v4M12 17h.01M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z',
  external: 'M7 17L17 7M8 7h9v9',
  close: 'M6 6l12 12M18 6L6 18',
}
function Icon({ name, className = 'h-5 w-5' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
         strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  )
}

// ── Shared building blocks ──────────────────────────────────────────────────
function StatusPill({ value }) {
  if (!value) return <span className="text-slate-400">—</span>
  const t = TONES[statusTone(value)]
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${t.pill}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${t.dot}`} />
      {value}
    </span>
  )
}

function FilterSelect({ value, onChange, placeholder, options }) {
  return (
    <select
      value={value} onChange={e => onChange(e.target.value)}
      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700
                 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100"
    >
      <option value="">{placeholder}</option>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  )
}

function DetailSection({ title, children }) {
  return (
    <section>
      <h3 className="mb-3 border-b border-slate-100 pb-2 text-sm font-semibold text-brand-800">{title}</h3>
      <dl className="grid gap-x-8 gap-y-3.5 sm:grid-cols-2">{children}</dl>
    </section>
  )
}
function DetailField({ label, value, tone }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className={`mt-0.5 text-sm font-medium ${tone || 'text-slate-900'}`}>{value || '—'}</dd>
    </div>
  )
}
function DetailStatus({ label, value }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-1"><StatusPill value={value} /></dd>
    </div>
  )
}
function DetailLink({ label, value }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-sm">
        {value ? (
          <a href={value} target="_blank" rel="noreferrer"
             className="inline-flex items-center gap-1 font-medium text-brand-600 hover:text-brand-800 hover:underline">
            Open link <Icon name="external" className="h-3.5 w-3.5" />
          </a>
        ) : <span className="text-slate-400">—</span>}
      </dd>
    </div>
  )
}
function Note({ title, tone = 'slate', children }) {
  const tones = {
    slate: 'border-slate-200 bg-slate-50 text-slate-600',
    amber: 'border-amber-200 bg-amber-50 text-amber-800',
    brand: 'border-brand-100 bg-brand-50 text-brand-800',
  }
  return (
    <div className={`rounded-lg border p-3.5 sm:col-span-2 ${tones[tone]}`}>
      <p className="mb-1 text-xs font-semibold">{title}</p>
      <p className="text-sm text-slate-700">{children}</p>
    </div>
  )
}

// ── Main component ──────────────────────────────────────────────────────────
function Dashboard({ session }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { role } = useAccess()
  const canEdit = ['editor', 'admin', 'owner'].includes(role)
  const saved = useSavedViews(session.user.id)
  const [viewName, setViewName] = useState('')
  const [selectedView, setSelectedView] = useState('')
  const [sortField, setSortField] = useState('grant_number')
  const [sortDirection, setSortDirection] = useState('asc')
  const [pageSize, setPageSize] = useState(25)
  const [paging, setPaging] = useState({ key: '', page: 1 })
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedGrant, setSelectedGrant] = useState(null)
  const [reportLoading, setReportLoading] = useState(false)
  const [detailGrant, setDetailGrant] = useState(null)
  const [activeNav, setActiveNav] = useState('dashboard')
  const [activeChapter, setActiveChapter] = useState('')
  const [selectedSections, setSelectedSections] = useState(ALL_SECTIONS_ON)

  // Records filters
  const [filterCountry, setFilterCountry] = useState('')
  const [filterChapter, setFilterChapter] = useState('')
  const [filterDept, setFilterDept] = useState('')
  const [filterPayment, setFilterPayment] = useState('')
  const [filterReport, setFilterReport] = useState('')
  const [filterSearch, setFilterSearch] = useState('')
  const [filterStage, setFilterStage] = useState('')

  useEffect(() => { fetchGrants() }, [])

  async function fetchGrants() {
    try {
      setLoading(true)
      const response = await apiFetch(`${import.meta.env.VITE_API_URL}/api/grants`)
      const json = await response.json()
      if (!response.ok) throw new Error(json.detail || 'Failed to load')
      setData(json)
      setError('')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut()
  }

  async function downloadReport(grantNumber, format) {
    setReportLoading(true)
    try {
      const response = await apiFetch(
        `${import.meta.env.VITE_API_URL}/api/reports/${format}/${encodeURIComponent(grantNumber)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sections: selectedSections }),
        }
      )
      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(error.detail || 'Report generation failed')
      }
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `grant-${grantNumber}.${format === 'pdf' ? 'pdf' : 'docx'}`
      a.click()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      alert('Could not generate report: ' + err.message)
    } finally {
      setReportLoading(false)
    }
  }

  // ── Derived data ──────────────────────────────────────────────────────
  const filteredGrants = data?.grants?.filter(g =>
    !activeChapter || g.chapter === activeChapter
  ) || []

  const totalGrantValueUSD = filteredGrants.reduce((s, g) => s + num(g.total_grant_amount_usd), 0)
  const totalCount = filteredGrants.length
  const highestGrant = filteredGrants.reduce((max, g) =>
    num(g.total_grant_amount_usd) > num(max?.total_grant_amount_usd) ? g : max, null)
  const pendingReports = filteredGrants.filter(
    g => g.report_status === 'Pending' || g.report_status === 'Incomplete Information'
  ).length
  const discrepancies = filteredGrants.filter(
    g => g.shipping_documents_status?.toLowerCase().includes('discrepancy')
  )
  const shippingIssues = discrepancies.length

  const q = filterSearch.toLowerCase()
  const recordRows = (data?.grants || [])
    .filter(g => !filterCountry || g.country === filterCountry)
    .filter(g => !filterChapter || g.chapter === filterChapter)
    .filter(g => !filterDept || g.department === filterDept)
    .filter(g => !filterPayment || g.payment_status === filterPayment)
    .filter(g => !filterReport || g.report_status === filterReport)
    .filter(g => !filterStage || grantStage(g).key === filterStage)
    .filter(g => !q ||
      g.grant_number?.toLowerCase().includes(q) ||
      g.supplier?.toLowerCase().includes(q) ||
      g.item?.toLowerCase().includes(q))
  const filterKey = JSON.stringify([filterCountry, filterChapter, filterDept, filterPayment, filterReport, filterSearch, filterStage, sortField, sortDirection, pageSize])
  const sortedRows = sortRecords(recordRows, sortField, sortDirection)
  const pagination = paginateRecords(sortedRows, paging.key === filterKey ? paging.page : 1, pageSize)
  function applyView(name) {
    setSelectedView(name)
    const view = saved.views.find(view => view.name === name)
    if (!view) return
    const f = view.filters
    setFilterCountry(f.country || ''); setFilterChapter(f.chapter || ''); setFilterDept(f.department || '')
    setFilterPayment(f.payment || ''); setFilterReport(f.report || ''); setFilterSearch(f.search || ''); setFilterStage(f.stage || '')
    setSortField(SORT_FIELDS.includes(f.sortField) ? f.sortField : 'grant_number')
    setSortDirection(f.sortDirection === 'desc' ? 'desc' : 'asc')
  }
  function saveView() {
    if (saved.save(viewName, { country: filterCountry, chapter: filterChapter, department: filterDept, payment: filterPayment, report: filterReport, search: filterSearch, stage: filterStage, sortField, sortDirection })) {
      setSelectedView(viewName.trim().slice(0, 60)); setViewName('')
    }
  }
  // Pipeline bars open the records filtered to that stage (and chapter, if one is selected).
  function showStage(stage) {
    clearFilters()
    setFilterChapter(activeChapter)
    setFilterStage(stage)
    setActiveNav('records')
  }

  const anyFilter = filterCountry || filterChapter || filterDept ||
    filterPayment || filterReport || filterSearch || filterStage

  function clearFilters() {
    setFilterCountry(''); setFilterChapter(''); setFilterDept('')
    setFilterPayment(''); setFilterReport(''); setFilterSearch(''); setFilterStage(''); setSelectedView('')
  }

  const NAV = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'records', label: 'Records' },
  ]
  const th = 'sticky top-0 z-[1] whitespace-nowrap bg-slate-50 px-4 py-3 text-xs font-semibold text-slate-500'

  return (
    <div className="flex min-h-screen bg-canvas">
      {data?.cache_warning && <div role="alert" className="fixed bottom-4 left-4 right-4 z-50 rounded-lg border border-amber-400 bg-amber-50 p-4 text-sm text-amber-900">{data.cache_warning}</div>}

      {/* ── Side rail ─────────────────────────────────────────────── */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-slate-200/80 bg-white md:flex">
        <div className="flex items-center gap-3 px-6 py-8">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-lg font-bold text-white shadow-sm">G<span className="text-brand-200">.</span></span>
          <div><div className="text-lg font-bold tracking-tight text-slate-900">GrantFlow</div><div className="text-[11px] font-medium tracking-wide text-slate-400">GRANTS WORKSPACE</div></div>
        </div>
        <div className="mx-4 mb-7 rounded-xl border border-slate-200/80 bg-slate-50/80 px-3.5 py-3">
          <p className="text-xs font-semibold text-slate-700">IHHN & FOIH</p>
          <p className="mt-0.5 text-xs text-slate-400">International grants team</p>
        </div>
        <nav className="flex-1 space-y-1.5 px-4" aria-label="Main navigation">
          {['admin', 'owner'].includes(role) && <button onClick={() => navigate('/access')} className="flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-medium text-brand-700 hover:bg-brand-50"><Icon name="records" className="h-[18px] w-[18px]" />Team access</button>}
          <button onClick={() => navigate('/audit')} className="flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-medium text-slate-500 hover:bg-slate-50"><Icon name="history" className="h-[18px] w-[18px]" />Grant activity</button>
          <p className="mb-3 px-3 text-[10px] font-semibold tracking-[0.16em] text-slate-400">WORKSPACE</p>
          {NAV.map(item => (
            <button key={item.id} onClick={() => setActiveNav(item.id)} aria-current={activeNav === item.id ? 'page' : undefined}
              className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-medium transition ${activeNav === item.id ? 'bg-brand-50 text-brand-700' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`}>
              <Icon name={item.id} className="h-[18px] w-[18px]" />{item.label}
              {activeNav === item.id && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-brand-500" />}
            </button>
          ))}
          <button onClick={() => navigate('/history')} className="flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-900"><Icon name="history" className="h-[18px] w-[18px]" />Report history</button>
          <button disabled={!canEdit} title={!canEdit ? 'Editor access required' : undefined} onClick={() => navigate('/add-grant')} className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-brand-700"><Icon name="plus" className="h-4 w-4" />Add new grant</button>
        </nav>
        <div className="m-4 rounded-xl border border-slate-200/80 p-3.5">
          <div className="flex items-center gap-2.5"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700">{session.user.email?.[0]?.toUpperCase() || 'G'}</span><div className="min-w-0"><p className="text-xs font-semibold text-slate-700">Your workspace</p><p className="truncate text-[11px] text-slate-400">{session.user.email}</p></div></div>
          <button onClick={handleLogout} className="mt-3 flex items-center gap-2 text-xs font-medium text-slate-500 hover:text-rose-600"><Icon name="logout" className="h-3.5 w-3.5" />Sign out</button>
        </div>
      </aside>

      {/* ── Main ──────────────────────────────────────────────────── */}
      <div className="min-w-0 flex-1">

        {/* Mobile bar */}
        <div className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 md:hidden">
          <span className="text-base font-semibold text-brand-900">GrantFlow</span>
          <div className="flex gap-1.5">
            {NAV.map(n => (
              <button
                key={n.id}
                onClick={() => setActiveNav(n.id)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium
                  ${activeNav === n.id ? 'bg-brand-700 text-white' : 'border border-slate-200 text-slate-600'}`}
              >
                {n.label}
              </button>
            ))}
          </div>
          <button onClick={handleLogout} className="text-xs text-slate-500">Sign out</button>
        </div>

        <div className="mx-auto max-w-[1400px] p-4 md:p-8 lg:px-10">
          {['admin', 'owner'].includes(role) && <button onClick={() => navigate('/access')} className="mb-3 mr-4 text-xs font-medium text-brand-600 md:hidden">Team access</button>}
          {location.state?.notice && <p role="status" className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{location.state.notice}</p>}
          {data?.row_errors?.length > 0 && (
            <details className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <summary className="cursor-pointer font-medium">
                {data.row_errors.length} {data.row_errors.length === 1 ? 'problem' : 'problems'} in the Google Sheet. Affected values are shown as blank until fixed there.
              </summary>
              <ul className="mt-3 list-disc space-y-1 pl-5 text-xs">
                {data.row_errors.map(message => <li key={message}>{message}</li>)}
              </ul>
            </details>
          )}
          {!canEdit && <p className="mb-4 rounded-xl border border-brand-100 bg-brand-50 p-4 text-sm text-brand-700">View-only access: you can review grants, activity, and reports. An administrator can grant editing access.</p>}
          <button onClick={() => navigate('/audit')} className="mb-3 text-xs font-medium text-brand-600 md:hidden">Grant activity</button>
          <div className="mb-8 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 pb-5">
            <p className="text-xs font-medium text-slate-400">Workspace <span className="mx-2 text-slate-300">/</span><span className="text-slate-700">{activeNav === 'dashboard' ? 'Overview' : 'Grant records'}</span></p>
            <div className="flex items-center gap-3">
              <button onClick={() => navigate('/history')} className="text-xs font-medium text-slate-500 hover:text-brand-700 md:hidden">History</button>
              <button onClick={fetchGrants} disabled={loading} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 hover:border-brand-200 hover:text-brand-700 disabled:opacity-50"><Icon name="refresh" className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />{loading ? 'Refreshing' : 'Refresh data'}</button>
            </div>
          </div>

          {/* ═══ DASHBOARD VIEW ═══ */}
          {activeNav === 'dashboard' && (
            <>
              <div className="mb-6">
                <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Your grants at a glance</h1>
                <p className="mt-1 text-sm text-slate-500">
                  {activeChapter
                    ? `Showing grants for ${activeChapter}`
                    : 'Track funding, follow progress, and keep every chapter moving.'}
                </p>
              </div>

              {/* Chapter filter */}
              <div className="mb-6 flex flex-wrap gap-2" role="group" aria-label="Filter by chapter">
                {['', ...CHAPTERS].map(ch => {
                  const active = activeChapter === ch
                  return (
                    <button
                      key={ch || 'all'}
                      onClick={() => setActiveChapter(ch)}
                      aria-pressed={active}
                      className={`rounded-lg border px-3.5 py-2 text-xs font-medium transition
                        ${active
                          ? 'border-brand-700 bg-brand-700 text-white'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-brand-300 hover:text-brand-800'}`}
                    >
                      {ch || 'All chapters'}
                    </button>
                  )
                })}
              </div>

              {loading && <p className="py-12 text-center text-slate-400">Loading grants…</p>}
              {error && (
                <div role="alert" className="mb-6 flex items-center justify-between gap-4 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                  <span>{error}</span>
                  <button onClick={fetchGrants} className="font-semibold underline">Try again</button>
                </div>
              )}

              {data && (
                <>
                  {/* KPI band */}
                  <section className="kpi-grid mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-[1.4fr_1fr_1fr_1fr_1.3fr]">
                    <div className="p-5">
                      <p className="text-sm text-slate-500">Total grant value</p>
                      <p className="mt-1 text-3xl font-semibold tabular-nums tracking-tight text-brand-800">
                        {usd0(totalGrantValueUSD)}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">USD, all grants shown</p>
                    </div>
                    <div className="p-5">
                      <p className="text-sm text-slate-500">Records</p>
                      <p className="mt-1 text-3xl font-semibold tabular-nums text-slate-900">{totalCount}</p>
                    </div>
                    <div className="p-5">
                      <p className="flex items-center gap-2 text-sm text-slate-500">
                        <span className="h-2 w-2 rounded-full bg-amber-500" /> Reports pending
                      </p>
                      <p className="mt-1 text-3xl font-semibold tabular-nums text-slate-900">{pendingReports}</p>
                    </div>
                    <div className="p-5">
                      <p className="flex items-center gap-2 text-sm text-slate-500">
                        <span className="h-2 w-2 rounded-full bg-rose-500" /> Discrepancies
                      </p>
                      <p className="mt-1 text-3xl font-semibold tabular-nums text-slate-900">{shippingIssues}</p>
                    </div>
                    <div className="min-w-0 p-5">
                      <p className="text-sm text-slate-500">Highest grant</p>
                      {highestGrant ? (
                        <>
                          <p className="mt-1 text-xl font-semibold tabular-nums text-slate-900">
                            {usd0(num(highestGrant.total_grant_amount_usd))}
                          </p>
                          <p className="mt-1 truncate text-xs font-medium text-slate-600">{highestGrant.grant_number}</p>
                          <p className="truncate text-xs text-slate-400">{highestGrant.supplier} — {highestGrant.item}</p>
                        </>
                      ) : <p className="mt-1 text-sm text-slate-400">No grants yet</p>}
                    </div>
                  </section>

                  {/* Discrepancy alert */}
                  {discrepancies.length > 0 && (
                    <section className="mb-6 rounded-xl border border-rose-200 bg-rose-50 p-5">
                      <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-rose-800">
                        <Icon name="alert" className="h-4 w-4" />
                        Shipping or invoice discrepancies ({discrepancies.length})
                      </h3>
                      {discrepancies.slice(0, 8).map(g => (
                        <div key={g.grant_number}
                             className="flex items-center justify-between border-t border-rose-100 py-2 text-sm first:border-t-0">
                          <span className="text-slate-700">{g.grant_number} — {g.item}</span>
                          <button onClick={() => setDetailGrant(g)}
                                  className="ml-4 text-sm font-medium text-rose-700 underline hover:text-rose-900">
                            View
                          </button>
                        </div>
                      ))}
                    </section>
                  )}

                  <DeferredAnalytics filteredGrants={filteredGrants} onStageSelect={showStage} />
                </>
              )}
            </>
          )}

          {/* ═══ RECORDS VIEW ═══ */}
          {activeNav === 'records' && (
            <>
              <div className="mb-6 flex items-end justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Records</h1>
                  <p className="mt-1 text-sm text-slate-500">
                    {data?.total_grants || 0} grants in the ledger
                  </p>
                </div>
                <button
                  disabled={!canEdit} title={!canEdit ? 'Editor access required' : undefined} onClick={() => navigate('/add-grant')}
                  className="flex items-center gap-2 rounded-lg bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-800"
                >
                  <Icon name="plus" className="h-4 w-4" /> Add grant
                </button>
              </div>

              {data && (
                <div className="mb-5 flex flex-wrap items-center gap-3">
                  <FilterSelect value={filterCountry} onChange={setFilterCountry} placeholder="All countries" options={COUNTRIES} />
                  <FilterSelect value={filterChapter} onChange={setFilterChapter} placeholder="All chapters" options={CHAPTERS} />
                  <FilterSelect value={filterDept} onChange={setFilterDept} placeholder="All departments"
                                options={[...new Set(data.grants.map(g => g.department).filter(Boolean))]} />
                  <FilterSelect value={filterPayment} onChange={setFilterPayment} placeholder="All payment statuses"
                                options={['Pending', 'Partial', 'Complete']} />
                  <FilterSelect value={filterReport} onChange={setFilterReport} placeholder="All report statuses"
                                options={['Complete', 'Pending', 'Incomplete Information']} />
                  <select
                    aria-label="Filter by stage" value={filterStage} onChange={e => setFilterStage(e.target.value)}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700
                               focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100"
                  >
                    <option value="">All stages</option>
                    {STAGE_OPTIONS.map(stage => <option key={stage.key} value={stage.key}>{stage.label}</option>)}
                  </select>
                  <input
                    type="search" value={filterSearch} onChange={e => setFilterSearch(e.target.value)}
                    placeholder="Search grant number, supplier or item"
                    className="min-w-64 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700
                               placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100"
                  />
                  {anyFilter && (
                    <button onClick={clearFilters} className="px-2 text-sm font-medium text-brand-700 hover:text-brand-900">
                      Clear filters
                    </button>
                  )}
                </div>
              )}

              {data && <div className="mb-5 space-y-3 rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <label className="text-xs text-slate-500">Sort by <select aria-label="Sort records by" value={sortField} onChange={event => setSortField(event.target.value)} className="ml-2 rounded-lg border border-slate-200 px-2 py-2 text-sm">{SORT_FIELDS.map(field => <option key={field} value={field}>{field.replaceAll('_', ' ')}</option>)}</select></label>
                  <button onClick={() => setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')} className="rounded-lg border border-slate-200 px-3 py-2 text-xs">{sortDirection === 'asc' ? 'Ascending' : 'Descending'}</button>
                  <label className="text-xs text-slate-500">Rows <select aria-label="Rows per page" value={pageSize} onChange={event => setPageSize(Number(event.target.value))} className="ml-2 rounded-lg border border-slate-200 px-2 py-2 text-sm">{[10, 25, 50, 100].map(size => <option key={size}>{size}</option>)}</select></label>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <select aria-label="Saved views" value={selectedView} onChange={event => applyView(event.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm"><option value="">Saved views</option>{saved.views.map(view => <option key={view.name} value={view.name}>{view.name}</option>)}</select>
                  <input aria-label="New saved view name" maxLength={60} value={viewName} onChange={event => setViewName(event.target.value)} placeholder="Name this view" className="min-w-0 rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                  <button onClick={saveView} className="rounded-lg bg-brand-50 px-3 py-2 text-xs font-medium text-brand-700">Save view</button>
                  <button onClick={() => { setFilterReport('Pending'); setSelectedView('') }} className="rounded-lg border border-slate-200 px-3 py-2 text-xs">Pending reports</button>
                  {selectedView && <button onClick={() => { if (saved.remove(selectedView)) setSelectedView('') }} className="px-2 text-xs text-rose-600">Delete view</button>}
                </div>
                <p className="text-xs text-slate-400">Views are saved for your account in this browser. Saving an existing name replaces that view.</p>
                {saved.error && <p role="alert" className="text-xs text-rose-600">{saved.error}</p>}
              </div>}
              {loading && <p className="py-12 text-center text-slate-400">Loading grants…</p>}
              {error && !data && (
                <div role="alert" className="mb-6 flex items-center justify-between gap-4 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                  <span>{error}</span>
                  <button onClick={fetchGrants} className="font-semibold underline">Try again</button>
                </div>
              )}

              {!loading && data && (
                <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                  <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
                    <p className="text-sm text-slate-600">
                      Showing <span className="font-semibold text-slate-900">{pagination.start}-{pagination.end}</span> of {recordRows.length} matches ({data.grants.length} total)
                    </p>
                    <button onClick={fetchGrants} className="text-sm font-medium text-brand-700 hover:text-brand-900">
                      Refresh
                    </button>
                  </div>

                  {data.grants.length === 0 ? (
                    <div className="px-6 py-16 text-center text-slate-500">
                      No grants yet. Select <span className="font-medium text-slate-700">Add grant</span> to enter the first one.
                    </div>
                  ) : (
                    <div className="max-h-[68vh] overflow-auto">
                      <table data-workspace-table="true" className="w-full text-sm" style={{ minWidth: '1760px' }}>
                        <thead>
                          <tr className="border-b border-slate-200 text-left">
                            <th className={th}>Grant number</th>
                            <th className={th}>Country</th>
                            <th className={th}>Chapter</th>
                            <th className={th}>Supplier</th>
                            <th className={th}>Item</th>
                            <th className={th}>Department</th>
                            <th className={th}>Project type</th>
                            <th className={`${th} text-right`}>Total grant (USD)</th>
                            <th className={`${th} text-right`}>Payment (USD)</th>
                            <th className={`${th} text-right`}>Remaining (USD)</th>
                            <th className={th}>Payment</th>
                            <th className={th}>Report</th>
                            <th className={th}>Shipping</th>
                            <th className={th}>Next step</th>
                            <th className={th}>Location</th>
                            <th className={`${th} text-right`}>Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {recordRows.length === 0 && (
                            <tr>
                              <td colSpan={16} className="px-6 py-12 text-center text-slate-500">
                                No grants match these filters.{' '}
                                <button onClick={clearFilters} className="font-medium text-brand-700 underline">Clear filters</button>
                              </td>
                            </tr>
                          )}
                          {pagination.rows.map(grant => (
                            <tr
                              key={grant.grant_number}
                              className="cursor-pointer transition hover:bg-brand-50/60"
                              onClick={() => setDetailGrant(grant)}
                            >
                              <td className="whitespace-nowrap px-4 py-3 font-medium text-brand-800">{grant.grant_number}</td>
                              <td className="whitespace-nowrap px-4 py-3 text-slate-600">{grant.country}</td>
                              <td className="whitespace-nowrap px-4 py-3 text-slate-600">{grant.chapter}</td>
                              <td className="whitespace-nowrap px-4 py-3 text-slate-800">{grant.supplier}</td>
                              <td className="max-w-56 truncate whitespace-nowrap px-4 py-3 text-slate-600">{grant.item}</td>
                              <td className="whitespace-nowrap px-4 py-3 text-slate-600">{grant.department}</td>
                              <td className="whitespace-nowrap px-4 py-3 text-slate-500">{grant.project_type || '—'}</td>
                              <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-slate-900">{usd(grant.total_grant_amount_usd)}</td>
                              <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-slate-900">{usd(grant.current_payment_usd)}</td>
                              <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-amber-700">{usd(grant.remaining_payment_usd)}</td>
                              <td className="whitespace-nowrap px-4 py-3"><StatusPill value={grant.payment_status} /></td>
                              <td className="whitespace-nowrap px-4 py-3"><StatusPill value={grant.report_status} /></td>
                              <td className="whitespace-nowrap px-4 py-3"><StatusPill value={grant.shipping_documents_status} /></td>
                              <td className="whitespace-nowrap px-4 py-3 text-slate-600">{grantStage(grant).label}</td>
                              <td className="whitespace-nowrap px-4 py-3 text-slate-500">{grant.location || '—'}</td>
                              <td className="whitespace-nowrap px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                                <div className="flex justify-end gap-2">
                                  <button
                                    disabled={!canEdit} title={!canEdit ? 'Editor access required' : undefined} onClick={() => navigate(`/edit-grant/${encodeURIComponent(grant.grant_number)}`)}
                                    className="rounded-md border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => setSelectedGrant(grant)}
                                    className="rounded-md bg-brand-700 px-3 py-1 text-xs font-medium text-white transition hover:bg-brand-800"
                                  >
                                    Report
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  <div className="flex items-center justify-between border-t border-slate-200 px-5 py-4 text-sm">
                    <span className="text-slate-500">Page {pagination.page} of {pagination.pages}</span>
                    <div className="flex gap-4"><button disabled={pagination.page <= 1} onClick={() => setPaging({ key: filterKey, page: pagination.page - 1 })} className="text-brand-700 disabled:opacity-30">Previous</button><button disabled={pagination.page >= pagination.pages} onClick={() => setPaging({ key: filterKey, page: pagination.page + 1 })} className="text-brand-700 disabled:opacity-30">Next</button></div>
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Detail modal ──────────────────────────────────────────── */}
      {detailGrant && (() => {
        const g = detailGrant
        const currency = g.secondary_currency || 'USD'
        const orig = v => (v ? `${currency} ${Number(v).toLocaleString()}` : '—')
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
               onClick={() => setDetailGrant(null)}>
            <div className="flex max-h-[92vh] w-full max-w-3xl flex-col rounded-2xl bg-white shadow-2xl"
                 role="dialog" aria-modal="true" aria-label={`Grant ${g.grant_number}`}
                 onClick={e => e.stopPropagation()}>
              <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-4">
                <div className="min-w-0">
                  <h2 className="truncate text-lg font-semibold text-slate-900">{g.grant_number}</h2>
                  <p className="mt-0.5 truncate text-sm text-slate-500">{g.supplier} — {g.item}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    disabled={!canEdit} title={!canEdit ? 'Editor access required' : undefined} onClick={() => { setDetailGrant(null); navigate(`/edit-grant/${encodeURIComponent(g.grant_number)}`) }}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => { setSelectedGrant(g); setDetailGrant(null) }}
                    className="rounded-lg bg-brand-700 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-brand-800"
                  >
                    Generate report
                  </button>
                  <button
                    onClick={() => setDetailGrant(null)} aria-label="Close"
                    className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                  >
                    <Icon name="close" className="h-5 w-5" />
                  </button>
                </div>
              </div>

              <div className="space-y-8 overflow-y-auto px-6 py-6">
                <GrantTimeline grant={g} />

                <DetailSection title="Grant overview">
                  <DetailField label="Year" value={g.year} />
                  <DetailField label="Country" value={g.country} />
                  <DetailField label="Chapter" value={g.chapter} />
                  <DetailField label="Project type" value={g.project_type} />
                  <DetailField label="Department" value={g.department} />
                  <DetailField label="Supplier" value={g.supplier} />
                  <DetailField label="Item" value={g.item} />
                  <DetailField label="PO / WO number" value={g.po_wo_number} />
                  <DetailField label="Sub grant no." value={g.sub_grant_no} />
                  <DetailLink label="Complete documents" value={g.link_to_complete_documents} />
                </DetailSection>

                <DetailSection title="Financial summary">
                  <DetailField label="Secondary currency" value={currency} />
                  <DetailField label={`Total grant (${currency})`} value={orig(g.total_grant_amount_orig)} />
                  <DetailField label="Total grant (USD)" value={usd(g.total_grant_amount_usd)} tone="text-brand-700" />
                  <DetailField label={`Current payment (${currency})`} value={orig(g.current_payment_orig)} />
                  <DetailField label="Current payment (USD)" value={usd(g.current_payment_usd)} tone="text-emerald-700" />
                  <DetailField label="Remaining (USD)" value={usd(g.remaining_payment_usd)} tone="text-amber-700" />
                  <DetailStatus label="Payment status" value={g.payment_status} />
                  <DetailLink label="Payment reference" value={g.payment_reference} />
                </DetailSection>

                <DetailSection title="Key dates">
                  <DetailField label="Grant receiving date" value={formatDate(g.grant_receiving_date)} />
                  <DetailField label="Application sent" value={formatDate(g.grant_application_sent_date)} />
                  <DetailField label="Dr. Zafar signed" value={formatDate(g.date_dr_zafar_signed_application)} />
                  <DetailField label="CEO signed" value={formatDate(g.date_ceo_signed_application)} />
                  <DetailField label="Khaleeq Sb approval" value={formatDate(g.date_of_approval_by_khaleeq_sb)} />
                  <DetailField label="Email to int. chapter" value={formatDate(g.date_of_email_to_int_chapter)} />
                  <DetailField label="Payment date" value={formatDate(g.payment_date)} />
                </DetailSection>

                <DetailSection title="Shipping & documents">
                  <DetailStatus label="Shipping status" value={g.shipping_documents_status} />
                  <DetailField label="Commercial invoice" value={g.commercial_invoice_no} />
                  <DetailField label="Bill of lading" value={g.bill_of_lading} />
                  <DetailField label="Packing list ref." value={g.packing_list_reference} />
                  <DetailLink label="Shipping documents" value={g.link_to_shipping_documents} />
                  {g.shipping_documents_comment && (
                    <Note title="Shipping comment" tone="amber">{g.shipping_documents_comment}</Note>
                  )}
                </DetailSection>

                <DetailSection title="GRN / receiving">
                  <DetailStatus label="GRN status" value={g.grn_receiving_status} />
                  <DetailField label="Receiving date" value={formatDate(g.receiving_date)} />
                  <DetailField label="GRN number" value={g.grn_number} />
                  <DetailLink label="Link to GRN" value={g.link_to_grn} />
                  {g.grn_receiving_comments && <Note title="GRN comments">{g.grn_receiving_comments}</Note>}
                </DetailSection>

                <DetailSection title="Installation & location">
                  <DetailField label="Installation date" value={formatDate(g.installation_date)} />
                  <DetailField label="Location" value={g.location} />
                  <DetailField label="Building name" value={g.building_name} />
                  <DetailField label="Floor" value={g.floor} />
                  <DetailField label="Room" value={g.room} />
                </DetailSection>

                <DetailSection title="Item details">
                  <DetailField label="Item model" value={g.item_model} />
                  <DetailField label="Serial number" value={g.item_serial_number} />
                  <DetailField label="Quantity" value={g.quantity} />
                  <DetailField label="IHHN asset tag" value={g.ihhn_asset_tag_number} />
                  <DetailField label="Beneficiaries" value={g.no_of_beneficiaries} />
                  {g.item_description && <Note title="Item description" tone="brand">{g.item_description}</Note>}
                </DetailSection>

                <DetailSection title="Pictures">
                  <DetailStatus label="Pictures status" value={g.pictures_status} />
                  <DetailField label="Department for pictures" value={g.department_for_pictures} />
                  <DetailLink label="Picture" value={g.picture} />
                </DetailSection>

                <DetailSection title="Report">
                  <DetailStatus label="Report status" value={g.report_status} />
                  <DetailLink label="Utilization report" value={g.link_to_utilization_report} />
                </DetailSection>
              </div>
            </div>
          </div>
        )
      })()}

      {/* ── Report modal ──────────────────────────────────────────── */}
      {selectedGrant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
             onClick={() => !reportLoading && setSelectedGrant(null)}>
          <div className="flex max-h-[92vh] w-full max-w-lg flex-col rounded-2xl bg-white shadow-2xl"
               role="dialog" aria-modal="true" aria-label="Generate report"
               onClick={e => e.stopPropagation()}>
            <div className="border-b border-slate-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-slate-900">Generate report</h2>
              <p className="mt-0.5 truncate text-sm text-slate-500">
                {selectedGrant.grant_number} — {selectedGrant.supplier}
              </p>
            </div>

            <div className="overflow-y-auto px-6 py-5">
              <p className="mb-3 text-sm font-medium text-slate-700">Sections to include</p>
              <p className="mb-3 text-xs text-slate-500">Complete reports use the chapter template when available. Selecting fewer sections uses the standard report layout.</p>
              <div className="grid gap-1 sm:grid-cols-2">
                {SECTION_LABELS.map(section => (
                  <label key={section.key}
                         className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 transition hover:bg-slate-50">
                    <input
                      type="checkbox"
                      checked={selectedSections[section.key]}
                      onChange={e => setSelectedSections(prev => ({ ...prev, [section.key]: e.target.checked }))}
                      className="h-4 w-4 rounded accent-brand-700"
                    />
                    <span className="text-sm text-slate-700">{section.label}</span>
                  </label>
                ))}
              </div>
              <div className="mt-3 flex gap-3 border-t border-slate-100 pt-3 text-sm">
                <button onClick={() => setSelectedSections(ALL_SECTIONS_ON)}
                        className="font-medium text-brand-700 hover:text-brand-900">Select all</button>
                <span className="text-slate-300">|</span>
                <button onClick={() => setSelectedSections(ALL_SECTIONS_OFF)}
                        className="text-slate-500 hover:text-slate-700">Clear all</button>
              </div>
              <p className="mt-4 text-xs text-slate-400">
                Chapters with their own report template ignore this selection and use the fixed form.
              </p>
            </div>

            <div className="flex gap-3 border-t border-slate-200 px-6 py-4">
              <button
                onClick={() => downloadReport(selectedGrant.grant_number, 'pdf')}
                disabled={reportLoading || !Object.values(selectedSections).some(Boolean)}
                className="flex-1 rounded-lg bg-rose-600 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:opacity-50"
              >
                {reportLoading ? 'Generating…' : 'Download PDF'}
              </button>
              <button
                onClick={() => downloadReport(selectedGrant.grant_number, 'word')}
                disabled={reportLoading || !Object.values(selectedSections).some(Boolean)}
                className="flex-1 rounded-lg bg-brand-700 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-800 disabled:opacity-50"
              >
                {reportLoading ? 'Generating…' : 'Download Word'}
              </button>
              <button
                onClick={() => setSelectedGrant(null)} disabled={reportLoading}
                className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Dashboard
