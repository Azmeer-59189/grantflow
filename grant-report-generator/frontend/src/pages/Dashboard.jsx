import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useAccess } from '../context/Access'
import { useToast } from '../context/toastContext'
import useSavedViews from '../hooks/useSavedViews'
import { apiFetch } from '../lib/api'
import { attentionItems, REPORT_DUE_DAYS } from '../lib/attention'
import { downloadCsv, toCsv } from '../lib/csv'
import { grantStage, STAGE_OPTIONS } from '../lib/pipeline'
import { paginateRecords, sortRecords, SORT_FIELDS } from '../lib/records'
import AppShell from '../components/AppShell'
import DeferredAnalytics from '../components/DeferredAnalytics'
import GrantDrawer from '../components/GrantDrawer'
import { Alert, Button, Card, EmptyState, Icon, Modal, Skeleton, StatusPill } from '../components/ui'

// ── Constants ───────────────────────────────────────────────────────────────
const CHAPTERS = ['FOIHUS', 'IDF', 'TIH UAE', 'IHN UK', 'FOIH Germany', 'FOIH Switzerland']
const COUNTRIES = ['United States', 'Canada', 'United Kingdom', 'Germany', 'Switzerland', 'UAE']
const ALL_SECTIONS_ON = {
  overview: true, financial: true, dates: true,
  shipping: true, grn: true, location: true,
  item: true, pictures: true, report: true,
}
const ALL_SECTIONS_OFF = Object.fromEntries(Object.keys(ALL_SECTIONS_ON).map(k => [k, false]))
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

// Records table columns. `hidden` ones start switched off in the column picker.
const COLUMNS = [
  { key: 'grant_number', label: 'Grant number', fixed: true },
  { key: 'country', label: 'Country' },
  { key: 'chapter', label: 'Chapter' },
  { key: 'supplier', label: 'Supplier' },
  { key: 'item', label: 'Item' },
  { key: 'department', label: 'Department', hidden: true },
  { key: 'project_type', label: 'Project type', hidden: true },
  { key: 'total_grant_amount_usd', label: 'Total (USD)', money: true },
  { key: 'current_payment_usd', label: 'Paid (USD)', money: true },
  { key: 'remaining_payment_usd', label: 'Remaining (USD)', money: true, hidden: true },
  { key: 'payment_status', label: 'Payment', status: true },
  { key: 'report_status', label: 'Report', status: true },
  { key: 'shipping_documents_status', label: 'Shipping', status: true, hidden: true },
  { key: 'stage', label: 'Next step' },
  { key: 'location', label: 'Location', hidden: true },
]

const num = v => Number(v) || 0
const usd = v => (v || v === 0 ? `$${Number(v).toLocaleString()}` : '—')
const usd0 = v => `$${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
const compactUsd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 })
const label = key => key.replaceAll('_', ' ').replace(/^\w/, c => c.toUpperCase())

function useColumnChoice(userId) {
  const key = `grantflow:columns:v1:${userId}`
  const [visible, setVisible] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(key) || 'null')
      if (Array.isArray(saved)) return new Set(saved)
    } catch { /* fall back to defaults */ }
    return new Set(COLUMNS.filter(c => !c.hidden).map(c => c.key))
  })
  function toggle(columnKey) {
    const next = new Set(visible)
    if (next.has(columnKey)) next.delete(columnKey)
    else next.add(columnKey)
    setVisible(next)
    try { localStorage.setItem(key, JSON.stringify([...next])) } catch { /* per-browser convenience only */ }
  }
  return { columns: COLUMNS.filter(c => c.fixed || visible.has(c.key)), visible, toggle }
}

// ── Overview pieces ─────────────────────────────────────────────────────────
function StatTile({ icon, label: title, value, note, tone = 'brand' }) {
  const chip = { brand: 'bg-brand-50 text-brand-600', amber: 'bg-amber-50 text-amber-600', rose: 'bg-rose-50 text-rose-600' }[tone]
  return (
    <div className="workspace-card rounded-2xl border border-slate-200/80 bg-white p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{title}</p>
        <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${chip}`}><Icon name={icon} className="h-[18px] w-[18px]" /></span>
      </div>
      <p className="mt-2 text-3xl font-semibold tabular-nums tracking-tight text-slate-900">{value}</p>
      {note && <p className="mt-1 text-xs text-slate-500">{note}</p>}
    </div>
  )
}

function HeroCard({ total, paid, count }) {
  const share = total ? Math.min(100, Math.round((paid / total) * 100)) : 0
  return (
    <div className="hero-card relative overflow-hidden rounded-2xl p-6 text-white shadow-lg shadow-brand-700/20 sm:col-span-2 xl:col-span-1 xl:row-span-1">
      <p className="text-sm font-medium text-brand-100">Total grant value</p>
      <p className="mt-2 text-[44px] font-semibold leading-none tracking-tight tabular-nums">{usd0(total)}</p>
      <p className="mt-2 text-sm text-brand-100">across {count} grant{count === 1 ? '' : 's'}</p>
      <div className="mt-6">
        <div className="mb-2 flex items-baseline justify-between text-sm">
          <span className="font-semibold">{share}% paid</span>
          <span className="text-brand-100">{compactUsd.format(paid)} paid · {compactUsd.format(Math.max(total - paid, 0))} to go</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-white/20" role="progressbar" aria-label="Share of grant value paid" aria-valuenow={share} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full rounded-full bg-white" style={{ width: `${share}%` }} />
        </div>
      </div>
    </div>
  )
}

const SEVERITY = ['bg-rose-50 text-rose-600', 'bg-amber-50 text-amber-600', 'bg-slate-100 text-slate-500']

function AttentionCard({ grants, onOpen }) {
  const items = attentionItems(grants)
  const shown = items.slice(0, 6)
  return (
    <Card title="Needs attention" className="lg:col-span-2"
          subtitle={items.length ? `${items.length} item${items.length === 1 ? '' : 's'}: discrepancies, reports overdue after ${REPORT_DUE_DAYS} days, missing pictures` : undefined}
          padded={false}>
      {items.length === 0 ? (
        <EmptyState icon="check" title="Nothing needs attention">No discrepancies, overdue reports or missing pictures.</EmptyState>
      ) : (
        <ul className="divide-y divide-slate-100 px-2 pb-2 pt-3">
          {shown.map((item, index) => (
            <li key={`${item.grant.grant_number}-${index}`}>
              <button type="button" onClick={() => onOpen(item.grant)}
                      className="group flex w-full items-center gap-4 rounded-xl px-3 py-3 text-left transition hover:bg-slate-50">
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${SEVERITY[item.severity]}`}><Icon name={item.icon} className="h-4 w-4" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-slate-900">{item.title}</span>
                  <span className="block truncate text-xs text-slate-500">{item.grant.grant_number} · {item.grant.supplier} · {item.detail}</span>
                </span>
                <Icon name="arrowRight" className="h-4 w-4 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-brand-600" />
              </button>
            </li>
          ))}
          {items.length > shown.length && <li className="px-3 py-3 text-xs text-slate-500">and {items.length - shown.length} more</li>}
        </ul>
      )}
    </Card>
  )
}

function TopGrantsCard({ grants, onOpen }) {
  const top = [...grants].sort((a, b) => num(b.total_grant_amount_usd) - num(a.total_grant_amount_usd)).slice(0, 5)
  const max = num(top[0]?.total_grant_amount_usd) || 1
  return (
    <Card title="Largest grants" subtitle="By total value (USD)" padded={false}>
      {top.length === 0 ? <EmptyState title="No grants yet" /> : (
        <ol className="space-y-1 px-2 pb-3 pt-3">
          {top.map(g => (
            <li key={g.grant_number}>
              <button type="button" onClick={() => onOpen(g)} className="w-full rounded-xl px-3 py-2.5 text-left transition hover:bg-slate-50">
                <span className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="truncate font-medium text-slate-800">{g.grant_number}</span>
                  <span className="shrink-0 font-semibold tabular-nums text-slate-900">{compactUsd.format(num(g.total_grant_amount_usd))}</span>
                </span>
                <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-brand-50">
                  <span className="block h-full rounded-full bg-brand-500" style={{ width: `${(num(g.total_grant_amount_usd) / max) * 100}%` }} />
                </span>
                <span className="mt-1 block truncate text-xs text-slate-500">{g.supplier} — {g.item}</span>
              </button>
            </li>
          ))}
        </ol>
      )}
    </Card>
  )
}

function OverviewSkeleton() {
  return (
    <div aria-hidden="true" className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-[1.6fr_1fr_1fr_1fr]">
        <Skeleton className="h-48 rounded-2xl sm:col-span-2 xl:col-span-1" />
        {[0, 1, 2].map(i => <Skeleton key={i} className="h-48 rounded-2xl" />)}
      </div>
      <div className="grid gap-6 lg:grid-cols-3"><Skeleton className="h-72 rounded-2xl lg:col-span-2" /><Skeleton className="h-72 rounded-2xl" /></div>
    </div>
  )
}

// ── Main component ──────────────────────────────────────────────────────────
function Dashboard({ session }) {
  const navigate = useNavigate()
  const location = useLocation()
  const toast = useToast()
  const [params, setParams] = useSearchParams()
  const view = params.get('view') === 'records' ? 'records' : 'overview'
  const { role } = useAccess()
  const canEdit = ['editor', 'admin', 'owner'].includes(role)
  const saved = useSavedViews(session.user.id)
  const columnChoice = useColumnChoice(session.user.id)
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

  // Messages handed over from the add/edit pages show once as a toast.
  useEffect(() => {
    const notice = location.state?.notice
    if (!notice) return
    toast.show(notice)
    navigate(`${location.pathname}${location.search}`, { replace: true, state: null })
  }, [location, navigate, toast])

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
      toast.show(`${format === 'pdf' ? 'PDF' : 'Word'} report downloaded for ${grantNumber}.`)
      setSelectedGrant(null)
    } catch (err) {
      toast.show(`Could not generate report: ${err.message}`, 'error')
    } finally {
      setReportLoading(false)
    }
  }

  // ── Derived data ──────────────────────────────────────────────────────
  const grants = data?.grants || []
  const filteredGrants = grants.filter(g => !activeChapter || g.chapter === activeChapter)
  const totalValue = filteredGrants.reduce((s, g) => s + num(g.total_grant_amount_usd), 0)
  const totalPaid = filteredGrants.reduce((s, g) => s + Math.min(num(g.current_payment_usd), num(g.total_grant_amount_usd) || Infinity), 0)
  const completeReports = filteredGrants.filter(g => g.report_status === 'Complete').length
  const incompleteInfo = filteredGrants.filter(g => g.report_status === 'Incomplete Information').length
  const pendingReports = filteredGrants.length - completeReports
  const discrepancies = filteredGrants.filter(g => g.shipping_documents_status?.toLowerCase().includes('discrepancy')).length

  const q = filterSearch.toLowerCase()
  const recordRows = grants
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
    const savedView = saved.views.find(v => v.name === name)
    if (!savedView) return
    const f = savedView.filters
    setFilterCountry(f.country || ''); setFilterChapter(f.chapter || ''); setFilterDept(f.department || '')
    setFilterPayment(f.payment || ''); setFilterReport(f.report || ''); setFilterSearch(f.search || ''); setFilterStage(f.stage || '')
    setSortField(SORT_FIELDS.includes(f.sortField) ? f.sortField : 'grant_number')
    setSortDirection(f.sortDirection === 'desc' ? 'desc' : 'asc')
  }
  function saveView() {
    if (saved.save(viewName, { country: filterCountry, chapter: filterChapter, department: filterDept, payment: filterPayment, report: filterReport, search: filterSearch, stage: filterStage, sortField, sortDirection })) {
      setSelectedView(viewName.trim().slice(0, 60)); setViewName('')
      toast.show('View saved.')
    }
  }
  function clearFilters() {
    setFilterCountry(''); setFilterChapter(''); setFilterDept('')
    setFilterPayment(''); setFilterReport(''); setFilterSearch(''); setFilterStage(''); setSelectedView('')
  }
  const anyFilter = filterCountry || filterChapter || filterDept || filterPayment || filterReport || filterSearch || filterStage

  // Pipeline bars open the records filtered to that stage (and chapter, if one is selected).
  function showStage(stage) {
    clearFilters()
    setFilterChapter(activeChapter)
    setFilterStage(stage)
    setParams({ view: 'records' })
    window.scrollTo({ top: 0 })
  }

  function exportCsv() {
    const keys = Object.keys(grants[0] || {}).filter(key => key !== 'version')
    const columns = [...keys.map(key => ({ key, label: label(key) })), { key: 'next_step', label: 'Next step' }]
    const rows = sortedRows.map(g => ({ ...g, next_step: grantStage(g).label }))
    downloadCsv(`grantflow-records-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(rows, columns))
    toast.show(`Exported ${rows.length} grant${rows.length === 1 ? '' : 's'}.`)
  }

  const editGrant = g => navigate(`/edit-grant/${encodeURIComponent(g.grant_number)}`)
  const select = 'h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-100'

  const refresh = (
    <Button icon="refresh" onClick={fetchGrants} disabled={loading} className={loading ? '[&_svg]:animate-spin' : ''}>
      {loading ? 'Refreshing' : 'Refresh'}
    </Button>
  )

  const banners = <>
    {data?.cache_warning && <div className="mb-4"><Alert tone="warning">{data.cache_warning}</Alert></div>}
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
    {error && <div className="mb-4"><Alert action={<button type="button" onClick={fetchGrants} className="shrink-0 font-semibold underline">Try again</button>}>{error}</Alert></div>}
  </>

  return (
    <>
      {view === 'overview' ? (
        <AppShell
          title="Overview"
          subtitle={activeChapter ? `Showing grants for ${activeChapter}` : 'Funding, progress and reports across every chapter.'}
          actions={refresh}
        >
          {banners}
          {!canEdit && <div className="mb-4"><Alert tone="info">View-only access: you can review grants, activity and reports. An administrator can grant editing access.</Alert></div>}

          <div className="mb-6 flex flex-wrap gap-2" role="group" aria-label="Filter by chapter">
            {['', ...CHAPTERS].map(ch => {
              const active = activeChapter === ch
              return (
                <button key={ch || 'all'} type="button" onClick={() => setActiveChapter(ch)} aria-pressed={active}
                        className={`h-9 rounded-full border px-4 text-xs font-medium transition
                          ${active ? 'border-brand-600 bg-brand-600 text-white shadow-sm shadow-brand-600/25' : 'border-slate-200 bg-white text-slate-600 hover:border-brand-300 hover:text-brand-800'}`}>
                  {ch || 'All chapters'}
                </button>
              )
            })}
          </div>

          {!data && loading ? <OverviewSkeleton /> : data && (
            <>
              <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-[1.6fr_1fr_1fr_1fr]">
                <HeroCard total={totalValue} paid={totalPaid} count={filteredGrants.length} />
                <StatTile icon="records" label="Grants" value={filteredGrants.length} note={`${completeReports} with a complete report`} />
                <StatTile icon="clock" label="Reports open" value={pendingReports} tone="amber" note={`${incompleteInfo} missing information`} />
                <StatTile icon="alert" label="Discrepancies" value={discrepancies} tone="rose" note="Shipping or invoice issues" />
              </section>

              <div className="mb-6 grid gap-6 lg:grid-cols-3 [&>*]:min-w-0">
                <AttentionCard grants={filteredGrants} onOpen={setDetailGrant} />
                <TopGrantsCard grants={filteredGrants} onOpen={setDetailGrant} />
              </div>

              <DeferredAnalytics filteredGrants={filteredGrants} onStageSelect={showStage} />
            </>
          )}
        </AppShell>
      ) : (
        <AppShell
          title="Records"
          subtitle={data ? `${grants.length} grants in the ledger` : 'Every grant in the Google Sheet'}
          actions={<>
            <Button icon="download" onClick={exportCsv} disabled={!sortedRows.length}>Export CSV</Button>
            {refresh}
          </>}
        >
          {banners}

          {/* Toolbar */}
          <div className="mb-4 space-y-3 rounded-2xl border border-slate-200/80 bg-white p-4">
            <div className="flex flex-wrap items-center gap-2">
              <label className="relative min-w-64 flex-1 basis-full 2xl:basis-0">
                <span className="sr-only">Search grants</span>
                <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input type="search" value={filterSearch} onChange={e => setFilterSearch(e.target.value)}
                       placeholder="Search grant number, supplier or item"
                       className={`${select} w-full pl-9 placeholder:text-slate-400`} />
              </label>
              <select aria-label="Filter by country" value={filterCountry} onChange={e => setFilterCountry(e.target.value)} className={select}>
                <option value="">All countries</option>{COUNTRIES.map(o => <option key={o}>{o}</option>)}
              </select>
              <select aria-label="Filter by chapter" value={filterChapter} onChange={e => setFilterChapter(e.target.value)} className={select}>
                <option value="">All chapters</option>{CHAPTERS.map(o => <option key={o}>{o}</option>)}
              </select>
              <select aria-label="Filter by department" value={filterDept} onChange={e => setFilterDept(e.target.value)} className={select}>
                <option value="">All departments</option>{[...new Set(grants.map(g => g.department).filter(Boolean))].map(o => <option key={o}>{o}</option>)}
              </select>
              <select aria-label="Filter by payment status" value={filterPayment} onChange={e => setFilterPayment(e.target.value)} className={select}>
                <option value="">All payments</option>{['Pending', 'Partial', 'Complete'].map(o => <option key={o}>{o}</option>)}
              </select>
              <select aria-label="Filter by report status" value={filterReport} onChange={e => setFilterReport(e.target.value)} className={select}>
                <option value="">All reports</option>{['Complete', 'Pending', 'Incomplete Information'].map(o => <option key={o}>{o}</option>)}
              </select>
              <select aria-label="Filter by stage" value={filterStage} onChange={e => setFilterStage(e.target.value)} className={select}>
                <option value="">All stages</option>{STAGE_OPTIONS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
              {anyFilter && <Button variant="ghost" icon="close" onClick={clearFilters}>Clear</Button>}
            </div>
            <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
              <label className="flex items-center gap-2 text-xs text-slate-500">Sort
                <select aria-label="Sort records by" value={sortField} onChange={e => setSortField(e.target.value)} className={`${select} h-8 text-xs`}>
                  {SORT_FIELDS.map(field => <option key={field} value={field}>{label(field)}</option>)}
                </select>
              </label>
              <Button size="sm" onClick={() => setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')}>{sortDirection === 'asc' ? 'Ascending' : 'Descending'}</Button>
              <details className="relative">
                <summary className="inline-flex h-8 cursor-pointer list-none items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-brand-50/50">
                  <Icon name="columns" className="h-3.5 w-3.5" />Columns
                </summary>
                <div className="absolute left-0 z-20 mt-2 w-56 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
                  {COLUMNS.filter(c => !c.fixed).map(c => (
                    <label key={c.key} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-slate-700 hover:bg-slate-50">
                      <input type="checkbox" checked={columnChoice.visible.has(c.key)} onChange={() => columnChoice.toggle(c.key)} className="h-4 w-4 rounded" />
                      {c.label}
                    </label>
                  ))}
                </div>
              </details>
              <span className="mx-1 hidden h-5 w-px bg-slate-200 sm:block" />
              <select aria-label="Saved views" value={selectedView} onChange={e => applyView(e.target.value)} className={`${select} h-8 text-xs`}>
                <option value="">Saved views</option>{saved.views.map(v => <option key={v.name} value={v.name}>{v.name}</option>)}
              </select>
              <input aria-label="New saved view name" maxLength={60} value={viewName} onChange={e => setViewName(e.target.value)} placeholder="Name this view" className={`${select} h-8 w-36 text-xs`} />
              <Button size="sm" onClick={saveView}>Save view</Button>
              {selectedView && <Button size="sm" variant="ghost" onClick={() => { if (saved.remove(selectedView)) setSelectedView('') }}>Delete view</Button>}
              {saved.error && <p role="alert" className="text-xs text-rose-600">{saved.error}</p>}
            </div>
          </div>

          {/* Table */}
          <section className="workspace-card overflow-hidden rounded-2xl border border-slate-200/80 bg-white">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5 text-sm text-slate-600">
              <p>Showing <span className="font-semibold text-slate-900">{pagination.start}–{pagination.end}</span> of {recordRows.length} matches</p>
              <label className="flex items-center gap-2 text-xs text-slate-500">Rows
                <select aria-label="Rows per page" value={pageSize} onChange={e => setPageSize(Number(e.target.value))} className={`${select} h-8 text-xs`}>
                  {[10, 25, 50, 100].map(size => <option key={size}>{size}</option>)}
                </select>
              </label>
            </div>

            {!data && loading ? (
              <div className="space-y-3 p-5" aria-hidden="true">{Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-10" />)}</div>
            ) : grants.length === 0 ? (
              <EmptyState title="No grants yet" action={canEdit && <Button variant="primary" icon="plus" onClick={() => navigate('/add-grant')}>Add the first grant</Button>}>
                Grants you add appear here and in the Google Sheet.
              </EmptyState>
            ) : recordRows.length === 0 ? (
              <EmptyState icon="search" title="No grants match these filters" action={<Button onClick={clearFilters}>Clear filters</Button>} />
            ) : (
              <div className="max-h-[70vh] overflow-auto">
                <table data-workspace-table="true" className="w-full text-sm">
                  <thead>
                    <tr className="text-left">
                      {columnChoice.columns.map(c => (
                        <th key={c.key} scope="col"
                            className={`sticky top-0 z-[2] whitespace-nowrap border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold text-slate-500
                              ${c.money ? 'text-right' : ''} ${c.fixed ? 'left-0 z-[3] shadow-[1px_0_0_#e2e8f0]' : ''}`}>
                          {c.label}
                        </th>
                      ))}
                      <th scope="col" className="sticky top-0 z-[2] border-b border-slate-200 bg-slate-50 px-4 py-3 text-right text-xs font-semibold text-slate-500">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {pagination.rows.map(grant => (
                      <tr key={grant.grant_number} className="group cursor-pointer" onClick={() => setDetailGrant(grant)}>
                        {columnChoice.columns.map(c => {
                          if (c.fixed) {
                            return (
                              <th key={c.key} scope="row" className="sticky left-0 z-[1] whitespace-nowrap bg-white px-4 py-3 text-left font-medium text-brand-700 shadow-[1px_0_0_#eef0f4] group-hover:bg-[#f7f7ff]">
                                <button type="button" onClick={e => { e.stopPropagation(); setDetailGrant(grant) }} className="hover:underline">{grant.grant_number}</button>
                              </th>
                            )
                          }
                          const value = c.key === 'stage' ? grantStage(grant).label : grant[c.key]
                          return (
                            <td key={c.key} className={`whitespace-nowrap px-4 py-3 ${c.money ? 'text-right tabular-nums text-slate-900' : 'text-slate-600'} ${c.key === 'item' ? 'max-w-56 truncate' : ''}`}>
                              {c.status ? <StatusPill value={value} /> : c.money ? usd(value) : (value || '—')}
                            </td>
                          )
                        })}
                        <td className="whitespace-nowrap px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                          <div className="flex justify-end gap-1.5">
                            <Button size="sm" variant="ghost" icon="edit" disabled={!canEdit} title={!canEdit ? 'Editor access required' : undefined} onClick={() => editGrant(grant)}>Edit</Button>
                            <Button size="sm" icon="file" onClick={() => setSelectedGrant(grant)}>Report</Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3.5 text-sm">
              <span className="text-slate-500">Page {pagination.page} of {pagination.pages}</span>
              <div className="flex gap-2">
                <Button size="sm" icon="arrowLeft" disabled={pagination.page <= 1} onClick={() => setPaging({ key: filterKey, page: pagination.page - 1 })}>Previous</Button>
                <Button size="sm" disabled={pagination.page >= pagination.pages} onClick={() => setPaging({ key: filterKey, page: pagination.page + 1 })}>Next<Icon name="arrowRight" className="h-3.5 w-3.5" /></Button>
              </div>
            </div>
          </section>
        </AppShell>
      )}

      <GrantDrawer
        grant={detailGrant} canEdit={canEdit}
        onClose={() => setDetailGrant(null)}
        onEdit={() => { editGrant(detailGrant); setDetailGrant(null) }}
        onReport={() => { setSelectedGrant(detailGrant); setDetailGrant(null) }}
      />

      {/* ── Report dialog ─────────────────────────────────────────────── */}
      <Modal open={Boolean(selectedGrant)} onClose={() => !reportLoading && setSelectedGrant(null)} label="Generate report">
        {selectedGrant && <>
          <div className="border-b border-slate-200 px-6 py-5">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600"><Icon name="file" /></span>
              <div className="min-w-0">
                <h2 className="text-lg font-semibold text-slate-900">Generate report</h2>
                <p className="truncate text-sm text-slate-500">{selectedGrant.grant_number} — {selectedGrant.supplier}</p>
              </div>
            </div>
          </div>
          <div className="overflow-y-auto px-6 py-5">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-medium text-slate-700">Sections to include</p>
              <div className="flex gap-3 text-xs">
                <button type="button" onClick={() => setSelectedSections(ALL_SECTIONS_ON)} className="font-medium text-brand-700 hover:text-brand-900">Select all</button>
                <button type="button" onClick={() => setSelectedSections(ALL_SECTIONS_OFF)} className="text-slate-500 hover:text-slate-700">Clear</button>
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {SECTION_LABELS.map(section => (
                <label key={section.key}
                       className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-sm transition
                         ${selectedSections[section.key] ? 'border-brand-200 bg-brand-50/60 text-slate-800' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                  <input type="checkbox" checked={selectedSections[section.key]}
                         onChange={e => setSelectedSections(prev => ({ ...prev, [section.key]: e.target.checked }))}
                         className="h-4 w-4 rounded" />
                  {section.label}
                </label>
              ))}
            </div>
            <p className="mt-4 rounded-xl bg-slate-50 p-3 text-xs text-slate-500">
              With every section selected, chapters that have their own template use it. Selecting fewer sections uses the standard layout.
            </p>
          </div>
          <div className="flex gap-2 border-t border-slate-200 px-6 py-4">
            <Button variant="primary" icon="download" className="flex-1"
                    onClick={() => downloadReport(selectedGrant.grant_number, 'pdf')}
                    disabled={reportLoading || !Object.values(selectedSections).some(Boolean)}>
              {reportLoading ? 'Generating…' : 'PDF'}
            </Button>
            <Button icon="download" className="flex-1"
                    onClick={() => downloadReport(selectedGrant.grant_number, 'word')}
                    disabled={reportLoading || !Object.values(selectedSections).some(Boolean)}>
              {reportLoading ? 'Generating…' : 'Word'}
            </Button>
            <Button variant="ghost" onClick={() => setSelectedGrant(null)} disabled={reportLoading}>Cancel</Button>
          </div>
        </>}
      </Modal>
    </>
  )
}

export default Dashboard
