import { useCallback, useEffect, useRef, useState } from 'react'
import { apiFetch } from '../lib/api'
import { useAccess } from '../context/Access'
import AppShell from '../components/AppShell'
import { Alert, Button, Skeleton } from '../components/ui'

const ROLE_STYLE = {
  owner: 'bg-brand-600 text-white ring-brand-600',
  admin: 'bg-brand-50 text-brand-700 ring-brand-600/20',
  editor: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  viewer: 'bg-slate-100 text-slate-600 ring-slate-500/20',
  disabled: 'bg-rose-50 text-rose-700 ring-rose-600/20',
}
const RoleBadge = ({ role }) => <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium capitalize ring-1 ring-inset ${ROLE_STYLE[role] || ROLE_STYLE.viewer}`}>{role === 'disabled' ? 'Revoked' : role}</span>

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
  const select = 'h-9 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-100 disabled:bg-slate-50'
  return (
    <AppShell title="Team access" width="max-w-5xl"
              subtitle="Owners manage administrators and ownership. Administrators manage editors and viewers. The last owner is protected.">
      <div className="mb-6"><Alert tone="info">Revoking access blocks GrantFlow requests and uploads. It does not delete the Supabase account or files already shared. New accounts must first be created in Supabase.</Alert></div>
      {notice && <div className="mb-4"><Alert tone="success">{notice}</Alert></div>}
      {error && <div className="mb-4"><Alert>{error}</Alert></div>}

      {pending && (
        <section role="region" aria-label="Confirm access change" className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <p className="text-sm text-slate-800">Change <strong>{pending.email}</strong> from <RoleBadge role={pending.previous} /> to <RoleBadge role={pending.role} />?</p>
          <p className="mt-2 text-xs text-amber-800">{pending.role === 'disabled' ? 'This blocks their next GrantFlow request.' : pending.role === 'owner' ? 'This grants full control over team access and ownership.' : 'The change takes effect on their next request.'}</p>
          <div className="mt-4 flex gap-2">
            <Button variant="primary" disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Confirm change'}</Button>
            <Button variant="ghost" disabled={saving} onClick={() => setPending(null)}>Cancel</Button>
          </div>
        </section>
      )}

      <section className="workspace-card overflow-hidden rounded-2xl border border-slate-200/80 bg-white">
        <header className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="text-[15px] font-semibold text-slate-900">Members</h2>
          <div className="flex items-center gap-2 text-sm">
            <Button size="sm" disabled={page === 1 || loading || saving} onClick={() => { setPage(page - 1); setPending(null) }}>Previous</Button>
            <span className="text-xs text-slate-500">Page {page}</span>
            <Button size="sm" disabled={users.length < 50 || loading || saving} onClick={() => { setPage(page + 1); setPending(null) }}>Next</Button>
          </div>
        </header>
        {loading && !users.length ? (
          <div className="space-y-3 p-5" role="status" aria-label="Loading team">{[0, 1, 2].map(i => <Skeleton key={i} className="h-12" />)}</div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {users.map(user => {
              const protectedUser = role !== 'owner' && ['owner', 'admin'].includes(user.role)
              const name = user.email || user.id
              return (
                <li key={user.id} className="flex flex-wrap items-center gap-4 px-5 py-3.5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-sm font-semibold text-brand-700">{name[0]?.toUpperCase()}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-slate-900">{name}{user.id === session.user.id && <span className="ml-2 text-xs font-normal text-slate-400">You</span>}</span>
                  </span>
                  <RoleBadge role={user.role} />
                  <select aria-label={`Change access for ${name}`} value="" disabled={protectedUser || saving || loading}
                          onChange={event => setPending({ id: user.id, email: name, previous: user.role, role: event.target.value })} className={select}>
                    <option value="">{protectedUser ? 'Managed by owner' : 'Change role…'}</option>
                    {choices.filter(choice => choice !== user.role).map(choice => <option key={choice} value={choice}>{choice === 'disabled' ? 'Revoke access' : choice}</option>)}
                  </select>
                </li>
              )
            })}
            {!users.length && !loading && <li className="p-5 text-sm text-slate-500">No users on this page.</li>}
          </ul>
        )}
      </section>

      <h2 className="mb-4 mt-10 text-lg font-semibold text-slate-900">Permission history</h2>
      <section className="workspace-card rounded-2xl border border-slate-200/80 bg-white">
        <ul className="divide-y divide-slate-100">
          {history.map(entry => (
            <li key={entry.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-3.5 text-sm">
              <span className="font-medium text-slate-900">{entry.target_email || entry.target_id}</span>
              <RoleBadge role={entry.previous_role} /><span className="text-slate-400" aria-label="to">→</span><RoleBadge role={entry.new_role} />
              <span className="w-full text-xs text-slate-500 sm:ml-auto sm:w-auto">By {entry.actor_email || entry.actor_id} · {new Date(entry.created_at).toLocaleString()}</span>
            </li>
          ))}
          {!history.length && !loading && <li className="p-5 text-sm text-slate-500">No permission changes on this page.</li>}
        </ul>
      </section>
      <div className="mt-4 flex gap-2">
        <Button size="sm" disabled={!offset || loading || saving} onClick={() => setOffset(offset - 50)}>Newer changes</Button>
        <Button size="sm" disabled={history.length < 50 || loading || saving} onClick={() => setOffset(offset + 50)}>Older changes</Button>
      </div>
    </AppShell>
  )
}
