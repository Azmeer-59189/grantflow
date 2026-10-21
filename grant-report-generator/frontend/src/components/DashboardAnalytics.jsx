import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts'
import { lazy, Suspense, useState } from 'react'
import { formatMonth } from '../lib/dates'
import { fundingByChapter, paymentsByMonth, pipelineCounts, valueByCountry } from '../lib/pipeline'

// Validated with the dataviz palette checks (light surface). The lighter step
// is below 3:1 contrast, so every chart that uses it also labels its values.
const SERIES = '#595bd0'      // brand-600, single-series marks
const PAID = '#4b49b5'        // brand-700
const REMAINING = '#8991f4'   // brand-400
const GRID = '#eef0f4'

// The map library and world geometry load only when someone picks the map view.
const CountryMap = lazy(() => import('./CountryMap'))

const STATUS_COLORS = {
  'Complete': '#059669',
  'Pending': '#d97706',
  'Incomplete Information': '#e11d48',
}
const PROJECT_COLORS = { 'Expansion': PAID, 'Non-Expansion': REMAINING }

const TOOLTIP_STYLE = {
  borderRadius: '8px', border: '1px solid #e2e8f0',
  boxShadow: '0 6px 20px rgba(15,38,48,0.10)', fontSize: '12px', padding: '8px 12px',
}

// ── Small helpers ───────────────────────────────────────────────────────────
const compactUsd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 })
const fullUsd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
const pct = (part, whole) => (whole ? Math.round((part / whole) * 100) : 0)

function Card({ title, subtitle, action, children, className = '' }) {
  return (
    <section className={`workspace-card rounded-2xl border border-slate-200/80 bg-white ${className}`}>
      {(title || action) && (
        <header className="flex flex-wrap items-start justify-between gap-4 px-5 pt-5">
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

function Swatch({ color }) {
  return <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: color }} />
}

// Every chart keeps its numbers available as a table.
function TableView({ columns, rows }) {
  return (
    <details className="mt-4 text-xs">
      <summary className="cursor-pointer font-medium text-slate-500 hover:text-brand-700">View as table</summary>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-left">
          <thead className="text-slate-500"><tr>{columns.map(c => <th key={c.label} className={`p-2 font-medium ${c.numeric ? 'text-right' : ''}`}>{c.label}</th>)}</tr></thead>
          <tbody>{rows.map((row, index) => (
            <tr key={index} className="border-t border-slate-100">
              {columns.map(c => <td key={c.label} className={`p-2 text-slate-700 ${c.numeric ? 'text-right tabular-nums' : ''}`}>{c.value(row)}</td>)}
            </tr>
          ))}</tbody>
        </table>
      </div>
    </details>
  )
}

// A horizontal bar: square at the baseline, 4px rounded data end, <= 24px thick.
function HBar({ width, color }) {
  return <span className="block h-5 rounded-r-[4px]" style={{ width: `${width}%`, background: color, minWidth: width > 0 ? 3 : 0 }} />
}

// ── Pipeline ────────────────────────────────────────────────────────────────
function PipelineCard({ grants, onStageSelect }) {
  const stages = pipelineCounts(grants)
  const max = Math.max(...stages.map(s => s.count), 1)
  return (
    <Card className="mb-6" title="Where grants are now"
          subtitle="Each grant is counted once, at its next milestone. Select a stage to see those grants.">
      {grants.length === 0 ? <Empty>No grants yet</Empty> : <>
        <ol className="space-y-1">
          {stages.map(stage => (
            <li key={stage.key}>
              <button type="button" onClick={() => onStageSelect?.(stage.key)} disabled={!stage.count}
                      className="group grid w-full grid-cols-[minmax(8rem,13rem)_1fr_5.5rem] items-center gap-3 rounded-lg px-2 py-1.5 text-left transition hover:bg-brand-50/60 disabled:opacity-100 disabled:hover:bg-transparent">
                <span className={`truncate text-sm ${stage.key === 'done' ? 'font-medium text-slate-800' : 'text-slate-600'}`}>{stage.label}</span>
                <span className="relative"><HBar width={(stage.count / max) * 100} color={SERIES} /></span>
                <span className="text-right text-sm tabular-nums">
                  <span className="font-semibold text-slate-900">{stage.count}</span>
                  <span className="ml-1.5 text-xs text-slate-400">{pct(stage.count, grants.length)}%</span>
                </span>
              </button>
            </li>
          ))}
        </ol>
        <TableView rows={stages} columns={[
          { label: 'Stage', value: s => s.label },
          { label: 'Grants', value: s => s.count, numeric: true },
          { label: 'Share', value: s => `${pct(s.count, grants.length)}%`, numeric: true },
        ]} />
      </>}
    </Card>
  )
}

// ── Paid vs. still to pay ───────────────────────────────────────────────────
function FundingCard({ grants }) {
  const rows = fundingByChapter(grants)
  const max = Math.max(...rows.map(r => r.total), 1)
  const legend = (
    <div className="flex gap-4 text-xs text-slate-500">
      <span className="flex items-center gap-1.5"><Swatch color={PAID} />Paid</span>
      <span className="flex items-center gap-1.5"><Swatch color={REMAINING} />Still to pay</span>
    </div>
  )
  return (
    <Card title="Paid vs. still to pay" subtitle="USD by chapter" action={rows.length > 0 && legend}>
      {rows.length === 0 ? <Empty>No grant amounts yet</Empty> : <>
        <ul className="space-y-4">
          {rows.map(row => (
            <li key={row.chapter} className="group relative" tabIndex={0}>
              <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
                <span className="font-medium text-slate-700">{row.chapter}</span>
                <span className="tabular-nums text-slate-500">
                  <span className="font-semibold text-slate-900">{pct(row.paid, row.total)}% paid</span>
                  <span className="ml-2 text-xs">{compactUsd.format(row.paid)} of {compactUsd.format(row.total)}</span>
                </span>
              </div>
              {/* 2px surface gap between the segments */}
              <div className="flex gap-[2px]" style={{ width: `${(row.total / max) * 100}%` }}>
                {row.paid > 0 && <span className={`block h-5 ${row.remaining > 0 ? '' : 'rounded-r-[4px]'}`} style={{ flexGrow: row.paid, background: PAID }} />}
                {row.remaining > 0 && <span className="block h-5 rounded-r-[4px]" style={{ flexGrow: row.remaining, background: REMAINING }} />}
              </div>
              <div role="tooltip" className="pointer-events-none absolute right-0 top-full z-10 mt-1 hidden min-w-48 rounded-lg border border-slate-200 bg-white p-3 text-xs shadow-lg group-hover:block group-focus:block">
                <p className="mb-1 font-semibold text-slate-900">{row.chapter}</p>
                <p className="flex items-center justify-between gap-4 text-slate-600"><span className="flex items-center gap-1.5"><Swatch color={PAID} />Paid</span><span className="tabular-nums">{fullUsd.format(row.paid)}</span></p>
                <p className="flex items-center justify-between gap-4 text-slate-600"><span className="flex items-center gap-1.5"><Swatch color={REMAINING} />Still to pay</span><span className="tabular-nums">{fullUsd.format(row.remaining)}</span></p>
              </div>
            </li>
          ))}
        </ul>
        <TableView rows={rows} columns={[
          { label: 'Chapter', value: r => r.chapter },
          { label: 'Paid (USD)', value: r => fullUsd.format(r.paid), numeric: true },
          { label: 'Still to pay (USD)', value: r => fullUsd.format(r.remaining), numeric: true },
          { label: 'Total (USD)', value: r => fullUsd.format(r.total), numeric: true },
        ]} />
      </>}
    </Card>
  )
}

// ── Grant value by country ──────────────────────────────────────────────────
const COUNTRY_VIEW_KEY = 'grantflow:country-view'

function CountryCard({ grants }) {
  const rows = valueByCountry(grants)
  const max = Math.max(...rows.map(r => r.value), 1)
  const [view, setView] = useState(() => {
    try { return localStorage.getItem(COUNTRY_VIEW_KEY) === 'map' ? 'map' : 'bars' } catch { return 'bars' }
  })
  function choose(next) {
    setView(next)
    try { localStorage.setItem(COUNTRY_VIEW_KEY, next) } catch { /* per-browser convenience only */ }
  }
  const toggle = (
    <div role="group" aria-label="Chart type" className="inline-flex rounded-xl bg-slate-100 p-1">
      {[['bars', 'Bars'], ['map', 'Map']].map(([key, text]) => (
        <button key={key} type="button" aria-pressed={view === key} onClick={() => choose(key)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition
                  ${view === key ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
          {text}
        </button>
      ))}
    </div>
  )
  return (
    <Card title="Grant value by country" subtitle={view === 'map' ? 'Darker countries hold more grant value' : 'Total USD, largest first'} action={rows.length > 0 && toggle}>
      {rows.length === 0 ? <Empty>No data yet</Empty> : <>
        {view === 'map' ? (
          <Suspense fallback={<div className="flex h-80 items-center justify-center rounded-xl bg-slate-50 text-sm text-slate-400">Loading map…</div>}>
            <CountryMap rows={rows} />
          </Suspense>
        ) : (
        <ul className="space-y-2">
          {rows.map(row => (
            <li key={row.country} className="grid grid-cols-[minmax(6rem,9rem)_1fr_auto] items-center gap-3 text-sm"
                title={`${row.country}: ${fullUsd.format(row.value)} across ${row.count} grant${row.count === 1 ? '' : 's'}`}>
              <span className="truncate text-slate-600">{row.country}</span>
              <HBar width={(row.value / max) * 100} color={SERIES} />
              <span className="text-right tabular-nums">
                <span className="font-semibold text-slate-900">{compactUsd.format(row.value)}</span>
                <span className="ml-1.5 text-xs text-slate-400">{row.count}</span>
              </span>
            </li>
          ))}
        </ul>
        )}
        <TableView rows={rows} columns={[
          { label: 'Country', value: r => r.country },
          { label: 'Grants', value: r => r.count, numeric: true },
          { label: 'Value (USD)', value: r => fullUsd.format(r.value), numeric: true },
        ]} />
      </>}
    </Card>
  )
}

// ── Payments per month ──────────────────────────────────────────────────────
function PaymentsCard({ grants }) {
  const months = paymentsByMonth(grants)
  return (
    <Card className="mb-6" title="Payments per month" subtitle="Current payment (USD) by payment date, last 18 months with payments">
      {months.length === 0 ? <Empty height="h-48">No payments with a payment date yet.</Empty> : <>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={months} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="month" tickFormatter={formatMonth} tick={{ fontSize: 11, fill: '#64748b' }}
                   axisLine={{ stroke: '#e2e8f0' }} tickLine={false} interval="preserveStartEnd" />
            <YAxis tickFormatter={v => compactUsd.format(v)} tick={{ fontSize: 11, fill: '#94a3b8' }}
                   axisLine={false} tickLine={false} width={56} />
            <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(89,91,208,0.06)' }}
                     labelFormatter={formatMonth} formatter={value => [fullUsd.format(value), 'Payments']} />
            <Bar dataKey="payment" fill={SERIES} radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
        <TableView rows={months} columns={[
          { label: 'Month', value: m => formatMonth(m.month) },
          { label: 'Payments (USD)', value: m => fullUsd.format(m.payment), numeric: true },
        ]} />
      </>}
    </Card>
  )
}

// ── Donuts ──────────────────────────────────────────────────────────────────
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
                     paddingAngle={2} strokeWidth={0} isAnimationActive={false}>
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

export default function DashboardAnalytics({ filteredGrants, onStageSelect }) {
  function countBy(getKey, order) {
    const counts = {}
    filteredGrants.forEach(g => {
      const k = getKey(g)
      if (k !== undefined && k !== null) counts[k] = (counts[k] || 0) + 1
    })
    return order.map(name => ({ name, value: counts[name] || 0 })).filter(d => d.value > 0)
  }
  const projectTypeData = countBy(g => g.project_type, ['Expansion', 'Non-Expansion'])
  const reportStatusData = countBy(g => g.report_status, ['Complete', 'Pending', 'Incomplete Information'])

  return <>
    <PipelineCard grants={filteredGrants} onStageSelect={onStageSelect} />
    <div className="mb-6 grid gap-6 lg:grid-cols-2 [&>*]:min-w-0">
      <FundingCard grants={filteredGrants} />
      <CountryCard grants={filteredGrants} />
    </div>
    <PaymentsCard grants={filteredGrants} />
    <div className="grid gap-6 lg:grid-cols-2 [&>*]:min-w-0">
      <DonutCard
        title="Report status" subtitle={`${filteredGrants.length} grants in total`}
        data={reportStatusData} colorFor={n => STATUS_COLORS[n] || '#94a3b8'}
      />
      <DonutCard
        title="Project type" subtitle="Expansion and non-expansion grants"
        data={projectTypeData} colorFor={n => PROJECT_COLORS[n] || '#94a3b8'}
      />
    </div>
  </>
}
