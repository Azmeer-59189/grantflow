import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiFetch } from '../lib/api'

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
  return <main className="mx-auto max-w-5xl px-4 py-10 sm:px-8">
    <Link to="/" className="text-sm text-brand-600">Back to dashboard</Link>
    <h1 className="mt-6 text-3xl font-semibold tracking-tight">Grant activity</h1>
    <p className="mt-2 text-sm text-slate-500">Who changed each grant, when, and which fields changed. Direct edits in Google Sheets are outside this log.</p>
    <form className="my-6 flex gap-3" onSubmit={event => { event.preventDefault(); setGrant(filter.trim()); setPage(0) }}>
      <input aria-label="Exact grant number" value={filter} onChange={event => setFilter(event.target.value)} placeholder="Exact grant number" className="min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" />
      <button className="rounded-lg bg-brand-600 px-4 py-2 text-sm text-white">Filter</button>
      <button type="button" onClick={() => { setFilter(''); setGrant(''); setPage(0) }} className="text-sm text-brand-600">Clear</button>
    </form>
    {loading ? <p role="status">Loading activity...</p> : result.error ? <p role="alert" className="text-rose-700">{result.error}</p> : <>
      {!result.rows.length && <p className="text-sm text-slate-500">No activity on this page.</p>}
      <div className="space-y-3">{result.rows.map(row => <details key={row.id} className="rounded-xl border border-slate-200 bg-white p-4">
        <summary className="cursor-pointer text-sm"><span className="font-semibold">{row.grant_number}</span> · {row.action} · <span className="font-medium">{row.status}</span><span className="mt-1 block text-xs text-slate-500">{row.actor_email || row.actor_id} · {new Date(row.created_at).toLocaleString()}</span></summary>
        {row.status !== 'completed' && <p className="mt-3 text-xs text-amber-700">Confirm the current Google Sheet values before retrying this change.</p>}
        <div className="mt-4 overflow-x-auto"><table className="w-full text-left text-xs"><thead><tr><th className="p-2">Field</th><th className="p-2">Before</th><th className="p-2">After</th></tr></thead><tbody>{Object.entries(row.changes || {}).map(([field, change]) => <tr key={field} className="border-t border-slate-100"><td className="p-2">{field.replaceAll('_', ' ')}</td><td className="max-w-64 break-words p-2">{String(change.before ?? '—')}</td><td className="max-w-64 break-words p-2">{String(change.after ?? '—')}</td></tr>)}</tbody></table></div>
      </details>)}</div>
      <div className="mt-6 flex items-center gap-4 text-sm"><button disabled={page === 0} onClick={() => setPage(page - 1)} className="disabled:opacity-40">Previous</button><span>Page {page + 1}</span><button disabled={result.rows.length < 50} onClick={() => setPage(page + 1)} className="disabled:opacity-40">Next</button></div>
    </>}
  </main>
}
