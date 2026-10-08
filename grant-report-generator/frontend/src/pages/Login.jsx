import { useState } from 'react'
import { supabase } from '../supabase'

function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e) {
    e?.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
    setLoading(false)
  }

  const inputClass = `w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5
    text-sm text-slate-900 placeholder:text-slate-400 transition
    focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100`

  return (
    <div className="grid min-h-screen lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">

      {/* Brand panel */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-brand-900 p-12 text-white lg:flex">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 text-lg font-bold ring-1 ring-white/20">
            G
          </span>
          <span className="text-xl font-semibold tracking-tight">GrantFlow</span>
        </div>

        <div className="max-w-md">
          <h2 className="text-4xl font-semibold leading-tight tracking-tight">
            Every grant, from approval to utilization report.
          </h2>
          <p className="mt-5 text-base leading-relaxed text-brand-200">
            Track payments, shipments and installations, and produce each
            chapter's report in the format its donors expect.
          </p>
        </div>

        <p className="text-sm text-brand-300">
          Internal system for the IHHN and FOIH grants team
        </p>

        {/* soft shapes */}
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-brand-700/40" />
        <div className="pointer-events-none absolute -bottom-32 right-10 h-80 w-80 rounded-full bg-brand-800/70" />
      </div>

      {/* Form */}
      <div className="flex items-center justify-center bg-white px-6 py-12">
        <form onSubmit={handleLogin} className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-800 font-bold text-white">G</span>
            <span className="text-lg font-semibold text-brand-900">GrantFlow</span>
          </div>

          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Sign in</h1>
          <p className="mt-1.5 text-sm text-slate-500">
            Use the account your administrator created for you.
          </p>

          {error && (
            <div role="alert" className="mt-6 rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-700">
              {error}
            </div>
          )}

          <div className="mt-6 space-y-5">
            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-slate-700">Email</label>
              <input
                id="email" type="email" autoComplete="email" required
                value={email} onChange={e => setEmail(e.target.value)}
                placeholder="you@organization.org" className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-slate-700">Password</label>
              <input
                id="password" type="password" autoComplete="current-password" required
                value={password} onChange={e => setPassword(e.target.value)}
                placeholder="Your password" className={inputClass}
              />
            </div>
          </div>

          <button
            type="submit" disabled={loading}
            className="mt-7 w-full rounded-lg bg-brand-700 py-2.5 text-sm font-semibold text-white
                       transition hover:bg-brand-800 focus-visible:ring-4 focus-visible:ring-brand-200 disabled:opacity-60"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default Login
