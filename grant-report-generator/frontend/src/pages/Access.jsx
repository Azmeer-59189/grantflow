import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiFetch } from '../lib/api'
import { useAccess } from '../context/Access'

export default function Access() {
  const { role, session } = useAccess()
  const requestSequence = useRef(0)
  const [page, setPage] = useState(1)
  const [users, setUsers] = useState([])
  const [history, setHistory] = useState([])
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [pending, setPending] = useState(null)
  const [saving, setSaving] = useState(false)
  const load = useCallback(async () => {
    const sequence = ++requestSequence.current
    setLoading(true)
    setError('')
    try {
      const [userResponse, historyResponse] = await Promise.all([
        apiFetch(`${import.meta.env.VITE_API_URL}/api/access/users?page=${page}`),
        apiFetch(`${import.meta.env.VITE_API_URL}/api/access/history?offset=${offset}`),
      ])
      const [people, entries] = await Promise.all([userResponse.json(), historyResponse.json()])
      if (!userResponse.ok || !historyResponse.ok) throw new Error(people.detail || entries.detail || 'Could not load access management.')
      if (sequence === requestSequence.current) { setUsers(people); setHistory(entries) }
    } catch (error) { if (sequence === requestSequence.current) setError(error.message) }
    finally { if (sequence === requestSequence.current) setLoading(false) }
  }, [page, offset])
  useEffect(() => {
    let active = true
    queueMicrotask(() => { if (active) load() })
    return () => { active = false; requestSequence.current += 1 }
  }, [load])
  async function save() {
    setSaving(true); setError('')
    try {
      const response = await apiFetch(`${import.meta.env.VITE_API_URL}/api/access/users/${pending.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role: pending.role }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.detail || 'Could not change access.')
      if (pending.id === session.user.id) { window.location.assign('/'); return }
      setNotice(`Access updated for ${pending.email}.`); setPending(null)
      await load()
    } catch (error) { await load(); setError(error.message) }
    finally { setSaving(false) }
  }
  const choices = role === 'owner' ? ['viewer', 'editor', 'admin', 'owner', 'disabled'] : ['viewer', 'editor', 'disabled']
  return <main className="mx-auto max-w-5xl px-4 py-10 sm:px-8">
    <Link to="/" className="text-sm text-brand-600">Back to dashboard</Link>
    <h1 className="mt-6 text-3xl font-semibold tracking-tight">Team access</h1>
    <p className="mt-2 text-sm text-slate-500">Owners manage administrators and ownership. Administrators manage editors and viewers. The last owner is protected.</p>
    <p className="mt-2 text-xs text-slate-500">Revoking access blocks GrantFlow API requests and uploads; it does not delete the Supabase account or previously public attachments. New accounts must first be provisioned in Supabase.</p>
    {notice && <p role="status" className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{notice}</p>}
    {error && <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
    {pending && <section role="region" aria-label="Confirm access change" className="my-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
      <p className="text-sm">Change <strong>{pending.email}</strong> from <strong>{pending.previous}</strong> to <strong>{pending.role}</strong>?</p>
      <p className="mt-2 text-xs text-amber-800">{pending.role === 'disabled' ? 'This blocks their next GrantFlow request.' : pending.role === 'owner' ? 'This grants full control over team access and ownership.' : 'The change takes effect on subsequent API requests.'}</p>
      <div className="mt-3 flex gap-3"><button disabled={saving} onClick={save} className="rounded-lg bg-brand-600 px-4 py-2 text-sm text-white">{saving ? 'Saving...' : 'Confirm change'}</button><button disabled={saving} onClick={() => setPending(null)} className="text-sm text-slate-600">Cancel</button></div>
    </section>}
    {loading && <p role="status" className="my-4 text-sm text-slate-500">Loading team...</p>}
    <div className="my-6 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-4"><table className="w-full text-left text-sm"><thead><tr><th className="p-3">Account</th><th className="p-3">Current role</th><th className="p-3">Change access</th></tr></thead><tbody>{users.map(user => {
      const protectedUser = role !== 'owner' && ['owner', 'admin'].includes(user.role)
      return <tr key={user.id} className="border-t border-slate-100"><td className="p-3">{user.email || user.id}{user.id === session.user.id && <span className="ml-2 text-xs text-slate-400">You</span>}</td><td className="p-3 font-medium">{user.role}</td><td className="p-3"><select aria-label={`Change access for ${user.email || user.id}`} value="" disabled={protectedUser || saving || loading} onChange={event => setPending({ id: user.id, email: user.email || user.id, previous: user.role, role: event.target.value })} className="rounded-lg border border-slate-200 px-3 py-2"><option value="">{protectedUser ? 'Owner manages this account' : 'Choose a role'}</option>{choices.filter(choice => choice !== user.role).map(choice => <option key={choice} value={choice}>{choice === 'disabled' ? 'Revoke access' : choice}</option>)}</select></td></tr>
    })}</tbody></table>{!users.length && !loading && <p className="p-3 text-sm text-slate-500">No users on this page.</p>}</div>
    <div className="flex items-center gap-4 text-sm"><button disabled={page === 1 || loading || saving} onClick={() => { setPage(page - 1); setPending(null) }}>Previous</button><span>Page {page}</span><button disabled={users.length < 50 || loading || saving} onClick={() => { setPage(page + 1); setPending(null) }}>Next</button></div>
    <h2 className="mb-4 mt-10 text-xl font-semibold">Permission history</h2>
    <div className="space-y-2">{history.map(entry => <div key={entry.id} className="rounded-xl border border-slate-200 bg-white p-4 text-sm"><p>{entry.target_email || entry.target_id}: <strong>{entry.previous_role}</strong> → <strong>{entry.new_role}</strong></p><p className="mt-1 text-xs text-slate-500">By {entry.actor_email || entry.actor_id} · {new Date(entry.created_at).toLocaleString()}</p></div>)}</div>
    {!history.length && !loading && <p className="text-sm text-slate-500">No permission changes on this page.</p>}
    <div className="mt-4 flex gap-4 text-sm"><button disabled={!offset || loading || saving} onClick={() => setOffset(offset - 50)}>Previous changes</button><button disabled={history.length < 50 || loading || saving} onClick={() => setOffset(offset + 50)}>More changes</button></div>
  </main>
}
