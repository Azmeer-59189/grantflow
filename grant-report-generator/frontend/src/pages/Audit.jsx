import { useEffect, useState } from 'react'
import { apiFetch } from '../lib/api'
import AppShell from '../components/AppShell'
import { Alert, Button, EmptyState, Icon, Skeleton, StatusPill } from '../components/ui'

const ACTION_STYLE = {
  create: ['bg-emerald-50 text-emerald-600', 'plus', 'Created'],
  update: ['bg-brand-50 text-brand-600', 'edit', 'Updated'],
}

export default function Audit() {
  const [filter, setFilter] = useState('')
  const [grant, setGrant] = useState('')
  const [page, setPage] = useState(0)
  const [result, setResult] = useState({ key: '', rows: [], error: '' })
  const key = `${grant}:${page}`
  useEffect(() => {
    let active = true
    const params = new URLSearchParams({ limit: '50', offset: String(page * 50) })
    if (grant) params.set('grant_number', grant)
    apiFetch(`${import.meta.env.VITE_API_URL}/api/audit?${params}`)
      .then(async response => {
        const rows = await response.json()
        if (!response.ok) throw new Error(rows.detail || 'Could not load activity.')
        if (active) setResult({ key, rows, error: '' })
      }).catch(error => { if (active) setResult({ key, rows: [], error: error.message }) })
    return () => { active = false }
  }, [grant, page, key])
  const loading = result.key !== key
  return (
    <AppShell title="Grant activity" subtitle="Who changed each grant, when, and which fields changed. Direct edits in Google Sheets are outside this log." width="max-w-5xl">
      <form className="mb-6 flex flex-wrap gap-2" onSubmit={event => { event.preventDefault(); setGrant(filter.trim()); setPage(0) }}>
        <label className="relative min-w-64 flex-1">
          <span className="sr-only">Exact grant number</span>
          <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={filter} onChange={event => setFilter(event.target.value)} placeholder="Filter by exact grant number"
                 className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-100" />
        </label>
        <button type="submit" className="h-10 rounded-xl bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700">Filter</button>
        {grant && <Button variant="ghost" icon="close" onClick={() => { setFilter(''); setGrant(''); setPage(0) }}>Clear</Button>}
      </form>

      {loading ? (
        <div className="space-y-3" role="status" aria-label="Loading activity">{[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-20 rounded-2xl" />)}</div>
      ) : result.error ? <Alert>{result.error}</Alert> : (
        <>
          {!result.rows.length && (
            <div className="rounded-2xl border border-slate-200/80 bg-white"><EmptyState icon="activity" title="No activity here">Changes made through GrantFlow appear here.</EmptyState></div>
          )}
          <ol className="relative space-y-3 before:absolute before:bottom-4 before:left-[27px] before:top-4 before:w-px before:bg-slate-200">
            {result.rows.map(row => {
              const [chip, icon, verb] = ACTION_STYLE[row.action] || ACTION_STYLE.update
              const changes = Object.entries(row.changes || {})
              return (
                <li key={row.id} className="relative">
                  <details className="group workspace-card rounded-2xl border border-slate-200/80 bg-white">
                    <summary className="flex cursor-pointer list-none items-center gap-4 p-4">
                      <span className={`relative z-[1] flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ring-4 ring-canvas ${chip}`}><Icon name={icon} className="h-4 w-4" /></span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm text-slate-900"><span className="font-semibold">{row.grant_number}</span> <span className="text-slate-500">{verb.toLowerCase()} · {changes.length} field{changes.length === 1 ? '' : 's'}</span></span>
                        <span className="block truncate text-xs text-slate-500">{row.actor_email || row.actor_id} · {new Date(row.created_at).toLocaleString()}</span>
                      </span>
                      <StatusPill value={row.status} />
                      <Icon name="chevronDown" className="h-4 w-4 text-slate-400 transition group-open:rotate-180" />
                    </summary>
                    <div className="border-t border-slate-100 px-4 pb-4">
                      {row.status === 'rejected' && <p className="mt-3 text-xs text-slate-500">This change was refused before reaching the Google Sheet. Nothing was written.</p>}
                      {['pending', 'unconfirmed'].includes(row.status) && <p className="mt-3 text-xs text-amber-700">Confirm the current Google Sheet values before retrying this change.</p>}
                      <div className="mt-3 overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead className="text-slate-500"><tr><th className="p-2 font-medium">Field</th><th className="p-2 font-medium">Before</th><th className="p-2 font-medium">After</th></tr></thead>
                          <tbody>{changes.map(([field, change]) => (
                            <tr key={field} className="border-t border-slate-100">
                              <td className="p-2 font-medium text-slate-700">{field.replaceAll('_', ' ')}</td>
                              <td className="max-w-64 break-words p-2 text-slate-400 line-through decoration-slate-300">{String(change.before ?? '—')}</td>
                              <td className="max-w-64 break-words p-2 text-slate-900">{String(change.after ?? '—')}</td>
                            </tr>
                          ))}</tbody>
                        </table>
                      </div>
                    </div>
                  </details>
                </li>
              )
            })}
          </ol>
          <div className="mt-6 flex items-center justify-between text-sm">
            <span className="text-slate-500">Page {page + 1}</span>
            <div className="flex gap-2">
              <Button size="sm" icon="arrowLeft" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</Button>
              <Button size="sm" disabled={result.rows.length < 50} onClick={() => setPage(page + 1)}>Next<Icon name="arrowRight" className="h-3.5 w-3.5" /></Button>
            </div>
          </div>
        </>
      )}
    </AppShell>
  )
}
