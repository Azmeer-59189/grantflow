import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiFetch } from '../lib/api'

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
  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-8">
      <Link to="/" className="text-sm font-medium text-brand-600 hover:text-brand-800">Back to dashboard</Link>
      <h1 className="my-6 text-3xl font-semibold tracking-tight">Report history</h1>
      {error && <p role="alert">{error}</p>}
      {!error && rows === null && <p>Loading history...</p>}
      {rows?.length === 0 && <p>No reports have been generated yet.</p>}
      {rows?.length > 0 && <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white p-3 shadow-sm"><table className="w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="p-3">Generated</th><th>Format</th><th>Grants</th><th>Payment (USD)</th><th>Beneficiaries</th></tr></thead>
        <tbody>{rows.map(row => <tr key={row.id} className="border-t border-slate-100 hover:bg-brand-50/50">
          <td className="p-3">{new Date(row.generated_at).toLocaleString()}</td>
          <td>{row.format}</td><td>{row.row_count}</td>
          <td>{Number(row.total_received).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
          <td>{row.total_beneficiaries}</td>
        </tr>)}</tbody>
      </table></div>}
      <p className="mt-6 text-sm text-slate-500">History records report generation. Downloaded files are temporary and are not retained.</p>
    </main>
  )
}
