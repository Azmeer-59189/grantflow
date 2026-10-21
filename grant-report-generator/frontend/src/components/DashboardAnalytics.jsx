import { useState } from 'react'
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, LabelList,
  ComposedChart, Area
} from 'recharts'
import {
  ComposableMap, Geographies, Geography, ZoomableGroup
} from 'react-simple-maps'

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

const STATUS_COLORS = {
  'Complete': '#059669',
  'Pending': '#d97706',
  'Incomplete Information': '#e11d48',
}
const PROJECT_COLORS = { 'Expansion': '#6563cf', 'Non-Expansion': '#c4c7ed' }
const BRAND_LINE = '#6563cf'
const AMBER_LINE = '#d97706'

const TOOLTIP_STYLE = {
  borderRadius: '8px', border: '1px solid #e2e8f0',
  boxShadow: '0 6px 20px rgba(15,38,48,0.10)', fontSize: '12px', padding: '8px 12px',
}

// ── Small helpers ───────────────────────────────────────────────────────────
const num = value => Number(value) || 0
const usd0 = value => `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
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

function Card({ title, subtitle, action, children, className = '' }) {
  return (
    <section className={`workspace-card rounded-2xl border border-slate-200/80 bg-white ${className}`}>
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
  if (!ourName) return '#ebedf3'
  if (activeChapter) {
    const ch = stats.chapters[ourName]
    if (!ch || !ch.has(activeChapter)) return '#ebedf3'
  }
  const value = stats.values[ourName] || 0
  if (value === 0) return '#dbddf0'
  const intensity = value / stats.max
  if (intensity > 0.7) return '#403e94'
  if (intensity > 0.4) return '#6563cf'
  if (intensity > 0.1) return '#9094e2'
  return '#c4c7ed'
}

// ── Detail modal pieces ─────────────────────────────────────────────────────

export default function DashboardAnalytics({ filteredGrants, activeChapter }) {
  const totalCount = filteredGrants.length
  const [mapZoom, setMapZoom] = useState({ coordinates: [10, 30], zoom: 1 })
  const [mapTooltip, setMapTooltip] = useState(null)
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

  return <>
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
                        {['#c4c7ed', '#9094e2', '#6563cf', '#403e94'].map(c => (
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
                          <Bar dataKey="value" radius={[5, 5, 0, 0]} fill="#6563cf">
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
}
