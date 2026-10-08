import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, LabelList,
  ComposedChart, Area
} from 'recharts'
import {
  ComposableMap, Geographies, Geography, ZoomableGroup
} from 'react-simple-maps'

// ── Constants ───────────────────────────────────────────────────────────────
const CHAPTERS = ['FOIHUS', 'IDF', 'TIH UAE', 'IHN UK', 'FOIH Germany', 'FOIH Switzerland']
const COUNTRIES = ['United States', 'Canada', 'United Kingdom', 'Germany', 'Switzerland', 'UAE']
const GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json'

// Map geometry names -> our country names
const GEO_NAME_MAP = {
  'United States of America': 'United States',
  'United Kingdom': 'United Kingdom',
  'Germany': 'Germany',
  'Switzerland': 'Switzerland',
  'United Arab Emirates': 'UAE',
  'Canada': 'Canada',
}

// Chart colors. Status colors are the same everywhere in the app.
const STATUS_COLORS = {
  'Complete': '#059669',
  'Pending': '#d97706',
  'Incomplete Information': '#e11d48',
}
const PROJECT_COLORS = { 'Expansion': '#1f5668', 'Non-Expansion': '#7fbccb' }
const BRAND_LINE = '#2f8099'
const AMBER_LINE = '#d97706'

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

const TOOLTIP_STYLE = {
  borderRadius: '8px', border: '1px solid #e2e8f0',
  boxShadow: '0 6px 20px rgba(15,38,48,0.10)', fontSize: '12px', padding: '8px 12px',
}

// ── Small helpers ───────────────────────────────────────────────────────────
const num = v => parseFloat(v) || 0
const usd = v => (v ? `$${Number(v).toLocaleString()}` : '—')
const usd0 = v => `$${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}`

// Dates can arrive as ISO text or as Google Sheets serial numbers
function formatDate(v) {
  if (!v) return ''
  const s = String(v).trim()
  const n = Number(s)
  let d
  if (!Number.isNaN(n) && n > 20000 && n < 80000) {
    d = new Date(Date.UTC(1899, 11, 30 + Math.floor(n)))
  } else if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    d = new Date(s.slice(0, 10) + 'T00:00:00Z')
  } else {
    return s
  }
  return d.toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
  })
}

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

function Card({ title, subtitle, action, children, className = '' }) {
  return (
    <section className={`rounded-xl border border-slate-200 bg-white ${className}`}>
      {(title || action) && (
        <header className="flex items-start justify-between gap-4 px-5 pt-5">
          <div>
            <h3 className="text-[15px] font-semibold text-slate-900">{title}</h3>
            {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      <div className="p-5">{children}</div>
    </section>
  )
}

function Empty({ children, height = 'h-40' }) {
  return (
    <div className={`flex ${height} items-center justify-center rounded-lg bg-slate-50 px-6 text-center text-sm text-slate-400`}>
      {children}
    </div>
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

function DonutCard({ title, subtitle, data, colorFor }) {
  const total = data.reduce((s, d) => s + d.value, 0)
  return (
    <Card title={title} subtitle={subtitle}>
      {data.length === 0 ? <Empty>No data yet</Empty> : (
        <div className="flex items-center gap-6">
          <div className="relative h-44 w-44 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data} dataKey="value" innerRadius={54} outerRadius={80}
                     paddingAngle={2} strokeWidth={0}>
                  {data.map(d => <Cell key={d.name} fill={colorFor(d.name)} />)}
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-semibold tabular-nums text-slate-900">{total}</span>
              <span className="text-xs text-slate-500">grants</span>
            </div>
          </div>
          <ul className="flex-1 space-y-3">
            {data.map(d => (
              <li key={d.name} className="flex items-center justify-between gap-3 text-sm">
                <span className="flex items-center gap-2 text-slate-600">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: colorFor(d.name) }} />
                  {d.name}
                </span>
                <span className="font-semibold tabular-nums text-slate-900">{d.value}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  )
}

// ── Map helpers ─────────────────────────────────────────────────────────────
function computeCountryStats(grants) {
  const values = {}, counts = {}, chapters = {}
  grants.forEach(g => {
    const country = g.country || 'Unknown'
    values[country] = (values[country] || 0) + num(g.total_grant_amount_usd)
    counts[country] = (counts[country] || 0) + 1
    if (!chapters[country]) chapters[country] = new Set()
    if (g.chapter) chapters[country].add(g.chapter)
  })
  return { values, counts, chapters, max: Math.max(...Object.values(values), 1) }
}

function mapFill(geoName, stats, activeChapter) {
  const ourName = GEO_NAME_MAP[geoName]
  if (!ourName) return '#e3ebef'
  if (activeChapter) {
    const ch = stats.chapters[ourName]
    if (!ch || !ch.has(activeChapter)) return '#e3ebef'
  }
  const value = stats.values[ourName] || 0
  if (value === 0) return '#c9dbe2'
  const intensity = value / stats.max
  if (intensity > 0.7) return '#163a47'
  if (intensity > 0.4) return '#1f5668'
  if (intensity > 0.1) return '#3f93ab'
  return '#8fc3d1'
}

// ── Detail modal pieces ─────────────────────────────────────────────────────
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
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedGrant, setSelectedGrant] = useState(null)
  const [reportLoading, setReportLoading] = useState(false)
  const [detailGrant, setDetailGrant] = useState(null)
  const [activeNav, setActiveNav] = useState('dashboard')
  const [activeChapter, setActiveChapter] = useState('')
  const [mapZoom, setMapZoom] = useState({ coordinates: [10, 30], zoom: 1 })
  const [mapTooltip, setMapTooltip] = useState(null)
  const [selectedSections, setSelectedSections] = useState(ALL_SECTIONS_ON)

  // Records filters
  const [filterCountry, setFilterCountry] = useState('')
  const [filterChapter, setFilterChapter] = useState('')
  const [filterDept, setFilterDept] = useState('')
  const [filterPayment, setFilterPayment] = useState('')
  const [filterReport, setFilterReport] = useState('')
  const [filterSearch, setFilterSearch] = useState('')

  useEffect(() => { fetchGrants() }, [])

  async function fetchGrants() {
    try {
      setLoading(true)
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/grants`)
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
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/reports/${format}/${grantNumber}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sections: selectedSections }),
        }
      )
      if (!response.ok) throw new Error('Report generation failed')
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

  function countBy(getKey, order) {
    const counts = {}
    filteredGrants.forEach(g => {
      const k = getKey(g)
      if (k !== undefined && k !== null) counts[k] = (counts[k] || 0) + 1
    })
    const names = order || Object.keys(counts)
    return names
      .map(name => ({ name, value: counts[name] || 0 }))
      .filter(d => d.value > 0)
  }

  const projectTypeData = countBy(g => g.project_type, ['Expansion', 'Non-Expansion'])
  const reportStatusData = countBy(g => g.report_status, ['Complete', 'Pending', 'Incomplete Information'])
  const countryData = countBy(g => g.country || 'Unknown').sort((a, b) => b.value - a.value)

  function getActivityData() {
    const dated = filteredGrants
      .filter(g => g.grant_receiving_date)
      .map(g => ({ date: g.grant_receiving_date, payment: num(g.current_payment_usd) }))
      .sort((a, b) => new Date(a.date) - new Date(b.date))
    if (dated.length === 0) return []
    const grouped = {}
    dated.forEach(({ date, payment }) => {
      if (!grouped[date]) grouped[date] = { date, count: 0, payment: 0 }
      grouped[date].count += 1
      grouped[date].payment += payment
    })
    let cumCount = 0, cumPayment = 0
    return Object.values(grouped)
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .map(d => {
        cumCount += d.count
        cumPayment += d.payment
        return { date: d.date, grants: cumCount, payment: Math.round(cumPayment) }
      })
  }
  const activityData = getActivityData()
  const mapStats = computeCountryStats(filteredGrants)

  const q = filterSearch.toLowerCase()
  const recordRows = (data?.grants || [])
    .filter(g => !filterCountry || g.country === filterCountry)
    .filter(g => !filterChapter || g.chapter === filterChapter)
    .filter(g => !filterDept || g.department === filterDept)
    .filter(g => !filterPayment || g.payment_status === filterPayment)
    .filter(g => !filterReport || g.report_status === filterReport)
    .filter(g => !q ||
      g.grant_number?.toLowerCase().includes(q) ||
      g.supplier?.toLowerCase().includes(q) ||
      g.item?.toLowerCase().includes(q))
  const anyFilter = filterCountry || filterChapter || filterDept ||
    filterPayment || filterReport || filterSearch

  function clearFilters() {
    setFilterCountry(''); setFilterChapter(''); setFilterDept('')
    setFilterPayment(''); setFilterReport(''); setFilterSearch('')
  }

  const NAV = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'records', label: 'Records' },
  ]
  const th = 'sticky top-0 z-[1] whitespace-nowrap bg-slate-50 px-4 py-3 text-xs font-semibold text-slate-500'

  return (
    <div className="flex min-h-screen bg-canvas">

      {/* ── Side rail ─────────────────────────────────────────────── */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col bg-brand-900 text-white md:flex">
        <div className="flex items-center gap-3 px-5 py-6">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 font-bold ring-1 ring-white/20">G</span>
          <div className="leading-tight">
            <div className="text-base font-semibold">GrantFlow</div>
            <div className="text-xs text-brand-300">IHHN and FOIH grants</div>
          </div>
        </div>
        <nav className="mt-2 flex-1 space-y-1 px-3">
          {NAV.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveNav(item.id)}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition
                ${activeNav === item.id
                  ? 'bg-white/10 text-white'
                  : 'text-brand-200 hover:bg-white/5 hover:text-white'}`}
            >
              <Icon name={item.id} className="h-[18px] w-[18px]" />
              {item.label}
            </button>
          ))}
          <button
            onClick={() => navigate('/add-grant')}
            className="mt-3 flex w-full items-center gap-3 rounded-lg border border-white/15 px-3 py-2.5
                       text-sm font-medium text-white transition hover:bg-white/10"
          >
            <Icon name="plus" className="h-[18px] w-[18px]" />
            Add grant
          </button>
        </nav>
        <div className="border-t border-white/10 px-5 py-4">
          <p className="truncate text-xs text-brand-300">{session.user.email}</p>
          <button
            onClick={handleLogout}
            className="mt-2 flex items-center gap-2 text-sm text-brand-200 transition hover:text-white"
          >
            <Icon name="logout" className="h-4 w-4" /> Sign out
          </button>
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

        <div className="mx-auto max-w-[1400px] p-4 md:p-8">

          {/* ═══ DASHBOARD VIEW ═══ */}
          {activeNav === 'dashboard' && (
            <>
              <div className="mb-6">
                <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Dashboard</h1>
                <p className="mt-1 text-sm text-slate-500">
                  {activeChapter
                    ? `Showing grants for ${activeChapter}`
                    : 'Grant utilization across all chapters'}
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
                      className={`rounded-full border px-4 py-1.5 text-sm font-medium transition
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
                  <section className="mb-6 grid overflow-hidden rounded-xl border border-slate-200 bg-white
                                      md:grid-cols-[1.4fr_1fr_1fr_1fr_1.3fr] md:divide-x md:divide-slate-200
                                      max-md:divide-y max-md:divide-slate-200">
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

                  {/* Donuts */}
                  <div className="mb-6 grid gap-6 lg:grid-cols-2">
                    <DonutCard
                      title="Project type" subtitle="Expansion and non-expansion grants"
                      data={projectTypeData} colorFor={n => PROJECT_COLORS[n] || '#94a3b8'}
                    />
                    <DonutCard
                      title="Report status" subtitle={`${totalCount} grants in total`}
                      data={reportStatusData} colorFor={n => STATUS_COLORS[n] || '#94a3b8'}
                    />
                  </div>

                  {/* Map */}
                  <Card
                    className="mb-6"
                    title="Where grants are deployed"
                    subtitle="Darker countries hold more grant value. Scroll to zoom, drag to move."
                    action={
                      <button
                        onClick={() => setMapZoom({ coordinates: [0, 20], zoom: 1 })}
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
                      >
                        Reset view
                      </button>
                    }
                  >
                    <div className="relative overflow-hidden rounded-lg bg-brand-50/60" style={{ height: '400px' }}>
                      <ComposableMap
                        projection="geoMercator"
                        projectionConfig={{ scale: 130, center: [10, 30] }}
                        style={{ width: '100%', height: '100%' }}
                      >
                        <ZoomableGroup
                          zoom={mapZoom.zoom}
                          center={mapZoom.coordinates}
                          onMoveEnd={({ coordinates, zoom }) => setMapZoom({ coordinates, zoom })}
                          minZoom={0.5} maxZoom={8}
                        >
                          <Geographies geography={GEO_URL}>
                            {({ geographies }) => geographies.map(geo => {
                              const geoName = geo.properties.name
                              const ourName = GEO_NAME_MAP[geoName]
                              const isHighlighted = ourName && mapStats.values[ourName] !== undefined
                              return (
                                <Geography
                                  key={geo.rsmKey}
                                  geography={geo}
                                  fill={mapFill(geoName, mapStats, activeChapter)}
                                  stroke="#ffffff"
                                  strokeWidth={0.5}
                                  style={{
                                    default: { outline: 'none' },
                                    hover: {
                                      fill: isHighlighted ? '#d97706' : '#d1dbe1',
                                      outline: 'none',
                                      cursor: isHighlighted ? 'pointer' : 'default',
                                    },
                                    pressed: { outline: 'none' },
                                  }}
                                  onMouseEnter={() => {
                                    if (ourName && mapStats.counts[ourName]) {
                                      setMapTooltip({
                                        name: ourName,
                                        grants: mapStats.counts[ourName],
                                        value: mapStats.values[ourName] || 0,
                                        chapters: mapStats.chapters[ourName]
                                          ? [...mapStats.chapters[ourName]].join(', ') : '—',
                                      })
                                    }
                                  }}
                                  onMouseLeave={() => setMapTooltip(null)}
                                />
                              )
                            })}
                          </Geographies>
                        </ZoomableGroup>
                      </ComposableMap>

                      {mapTooltip && (
                        <div className="pointer-events-none absolute right-4 top-4 min-w-52 rounded-lg border border-slate-200 bg-white p-4 shadow-lg">
                          <p className="mb-1.5 text-sm font-semibold text-slate-900">{mapTooltip.name}</p>
                          <p className="text-xs text-slate-500">Chapter: <span className="font-medium text-slate-700">{mapTooltip.chapters}</span></p>
                          <p className="text-xs text-slate-500">Grants: <span className="font-medium text-slate-700">{mapTooltip.grants}</span></p>
                          <p className="text-xs text-slate-500">Total value: <span className="font-semibold text-brand-700">{usd0(mapTooltip.value)}</span></p>
                        </div>
                      )}

                      <div className="absolute bottom-4 left-4 flex items-center gap-2 rounded-md bg-white/90 px-2.5 py-1.5 text-xs text-slate-500">
                        <span>Lower</span>
                        {['#8fc3d1', '#3f93ab', '#1f5668', '#163a47'].map(c => (
                          <span key={c} className="h-2.5 w-5 rounded-sm" style={{ background: c }} />
                        ))}
                        <span>Higher</span>
                      </div>
                    </div>
                  </Card>

                  {/* Records by country */}
                  <Card className="mb-6" title="Records by country" subtitle="Number of grants per country">
                    {countryData.length === 0 ? <Empty>No data yet</Empty> : (
                      <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={countryData} margin={{ top: 18, right: 10, left: -20, bottom: 30 }} barSize={34}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#eef2f5" vertical={false} />
                          <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#5b6b78' }}
                                 angle={-20} textAnchor="end" interval={0} axisLine={false} tickLine={false} />
                          <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#94a3b8' }}
                                 axisLine={false} tickLine={false} />
                          <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(31,86,104,0.05)' }} />
                          <Bar dataKey="value" radius={[5, 5, 0, 0]} fill="#1f5668">
                            <LabelList dataKey="value" position="top"
                                       style={{ fontSize: '12px', fill: '#475569', fontWeight: 600 }} />
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </Card>

                  {/* Activity */}
                  <Card
                    title="Grant activity over time"
                    subtitle="Running totals by grant receiving date"
                    action={
                      <div className="flex gap-4 text-xs text-slate-500">
                        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: BRAND_LINE }} />Grants</span>
                        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: AMBER_LINE }} />Payments (USD)</span>
                      </div>
                    }
                  >
                    {activityData.length < 2 ? (
                      <Empty height="h-48">Add grants with different receiving dates to see activity over time.</Empty>
                    ) : (
                      <ResponsiveContainer width="100%" height={270}>
                        <ComposedChart data={activityData} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                          <defs>
                            <linearGradient id="grantsGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor={BRAND_LINE} stopOpacity={0.18} />
                              <stop offset="95%" stopColor={BRAND_LINE} stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="paymentGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor={AMBER_LINE} stopOpacity={0.14} />
                              <stop offset="95%" stopColor={AMBER_LINE} stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#eef2f5" vertical={false} />
                          <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }}
                                 axisLine={false} tickLine={false} interval="preserveStartEnd"
                                 tickFormatter={formatDate} />
                          <YAxis yAxisId="left" orientation="left" allowDecimals={false}
                                 tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={30} />
                          <YAxis yAxisId="right" orientation="right"
                                 tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={50}
                                 tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                          <Tooltip
                            contentStyle={TOOLTIP_STYLE}
                            labelFormatter={formatDate}
                            formatter={(value, name) => [
                              name === 'payment' ? `$${value.toLocaleString()}` : value,
                              name === 'payment' ? 'Payments (USD)' : 'Grants',
                            ]}
                          />
                          <Area yAxisId="left" type="monotone" dataKey="grants" stroke={BRAND_LINE} strokeWidth={2.5}
                                fill="url(#grantsGrad)" dot={{ fill: BRAND_LINE, r: 4, strokeWidth: 0 }}
                                activeDot={{ r: 6, fill: BRAND_LINE, strokeWidth: 0 }} />
                          <Area yAxisId="right" type="monotone" dataKey="payment" stroke={AMBER_LINE} strokeWidth={2.5}
                                fill="url(#paymentGrad)" dot={{ fill: AMBER_LINE, r: 4, strokeWidth: 0 }}
                                activeDot={{ r: 6, fill: AMBER_LINE, strokeWidth: 0 }} />
                        </ComposedChart>
                      </ResponsiveContainer>
                    )}
                  </Card>
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
                  onClick={() => navigate('/add-grant')}
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
                      Showing <span className="font-semibold text-slate-900">{recordRows.length}</span> of {data.grants.length}
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
                      <table className="w-full text-sm" style={{ minWidth: '1600px' }}>
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
                            <th className={th}>Location</th>
                            <th className={`${th} text-right`}>Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {recordRows.length === 0 && (
                            <tr>
                              <td colSpan={15} className="px-6 py-12 text-center text-slate-500">
                                No grants match these filters.{' '}
                                <button onClick={clearFilters} className="font-medium text-brand-700 underline">Clear filters</button>
                              </td>
                            </tr>
                          )}
                          {recordRows.map(grant => (
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
                              <td className="whitespace-nowrap px-4 py-3 text-slate-500">{grant.location || '—'}</td>
                              <td className="whitespace-nowrap px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                                <div className="flex justify-end gap-2">
                                  <button
                                    onClick={() => navigate(`/edit-grant/${grant.grant_number}`)}
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
                    onClick={() => { setDetailGrant(null); navigate(`/edit-grant/${g.grant_number}`) }}
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
