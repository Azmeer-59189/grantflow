import { useEffect, useState } from 'react'
import { apiFetch } from '../lib/api'
import AppShell from '../components/AppShell'
import { Alert, EmptyState, Skeleton } from '../components/ui'

export default function History() {
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    apiFetch(`${import.meta.env.VITE_API_URL}/api/reports/history`)
      .then(async response => {
        const data = await response.json()
        if (!response.ok) throw new Error(data.detail || 'Could not load history.')
        if (active) setRows(data)
      })
      .catch(error => { if (active) setError(error.message) })
    return () => { active = false }
  }, [])
  const th = 'px-5 py-3 text-xs font-semibold text-slate-500'
  return (
    <AppShell title="Report history" subtitle="Every PDF and Word report generated. Files are created on demand and not stored." width="max-w-5xl">
      {error && <div className="mb-4"><Alert>{error}</Alert></div>}
      <section className="workspace-card overflow-hidden rounded-2xl border border-slate-200/80 bg-white">
        {!error && rows === null ? (
          <div className="space-y-3 p-5" role="status" aria-label="Loading history">{[0, 1, 2, 3, 4].map(i => <Skeleton key={i} className="h-10" />)}</div>
        ) : rows?.length === 0 ? (
          <EmptyState icon="file" title="No reports yet">Reports you generate from a grant appear here.</EmptyState>
        ) : rows?.length > 0 && (
          <div className="overflow-x-auto">
            <table data-workspace-table="true" className="w-full text-left text-sm">
              <thead className="border-b border-slate-200"><tr>
                <th className={th}>Generated</th><th className={th}>Format</th><th className={`${th} text-right`}>Grants</th>
                <th className={`${th} text-right`}>Payment (USD)</th><th className={`${th} text-right`}>Beneficiaries</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-100">{rows.map(row => (
                <tr key={row.id}>
                  <td className="whitespace-nowrap px-5 py-3.5 text-slate-700">{new Date(row.generated_at).toLocaleString()}</td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${row.format === 'PDF' ? 'bg-rose-50 text-rose-700 ring-rose-600/20' : 'bg-brand-50 text-brand-700 ring-brand-600/20'}`}>{row.format}</span>
                  </td>
                  <td className="px-5 py-3.5 text-right tabular-nums">{row.row_count}</td>
                  <td className="px-5 py-3.5 text-right tabular-nums">{Number(row.total_received).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  <td className="px-5 py-3.5 text-right tabular-nums">{row.total_beneficiaries}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>
    </AppShell>
  )
}
