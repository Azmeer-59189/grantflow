import { useState } from 'react'
import { supabase } from '../supabase'

function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  async function handleLogin(e) {
    e?.preventDefault()
    setLoading(true)
    setError('')
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message)
    } catch {
      setError('Unable to connect. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const inputClass = `w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5
    text-sm text-slate-900 placeholder:text-slate-400 transition
    focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100`

  return (
    <div className="grid min-h-screen bg-white lg:grid-cols-[1.05fr_1fr]">
      <section className="login-art relative m-4 hidden flex-col justify-between overflow-hidden rounded-3xl p-10 lg:flex xl:p-14">
        <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-lg font-bold text-white">G.</span><span className="text-xl font-semibold tracking-tight text-slate-900">GrantFlow</span></div>
        <div className="relative z-10 my-12 max-w-lg">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/60 px-3 py-1.5 text-xs font-medium text-brand-700"><span className="h-1.5 w-1.5 rounded-full bg-brand-500" />Built for your grants team</span>
          <h2 className="mt-7 text-5xl font-semibold leading-[1.12] tracking-[-0.04em] text-slate-900 xl:text-6xl">Good work.<br />Clear progress.<br /><span className="text-brand-600">Every grant.</span></h2>
          <p className="mt-6 max-w-sm text-base leading-relaxed text-slate-500">One thoughtful workspace for your funding, project progress, and donor reports.</p>
          <div className="mt-10 rounded-2xl border border-white/90 bg-white/75 p-5 shadow-[0_12px_40px_-20px_rgba(50,50,100,0.25)]">
            <p className="mb-5 text-[10px] font-semibold tracking-[0.16em] text-slate-400">FROM FUNDING TO IMPACT</p>
            <div className="grid grid-cols-3 gap-3">
              {[['01', 'Manage', 'Grants & payments'], ['02', 'Track', 'Delivery & progress'], ['03', 'Report', 'Chapter-ready files']].map(([number, title, description]) => (
                <div key={number}><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-xs font-semibold text-brand-600">{number}</span><p className="mt-3 text-sm font-semibold text-slate-800">{title}</p><p className="mt-1 text-[11px] leading-relaxed text-slate-400">{description}</p></div>
              ))}
            </div>
          </div>
        </div>
        <p className="text-xs text-slate-500">IHHN & FOIH <span className="mx-2 text-slate-300">/</span> International grants workspace</p>
      </section>
      <section className="flex min-h-screen flex-col justify-between px-6 py-8 sm:px-12 lg:px-16">
        <div className="flex items-center gap-2 text-lg font-semibold text-slate-900 lg:invisible"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-sm text-white">G.</span>GrantFlow</div>
        <form onSubmit={handleLogin} className="mx-auto w-full max-w-sm py-12">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-brand-600">Your workspace awaits</p>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Welcome back.</h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-500">Sign in to manage your grants and see what&apos;s moving forward.</p>
          {error && <div role="alert" className="mt-6 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-sm text-rose-700">{error}</div>}
          <div className="mt-8 space-y-5">
            <div><label htmlFor="email" className="mb-2 block text-sm font-medium text-slate-700">Work email</label><input id="email" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@organization.org" className={inputClass} /></div>
            <div><label htmlFor="password" className="mb-2 block text-sm font-medium text-slate-700">Password</label><div className="relative"><input id="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter your password" className={`${inputClass} pr-16`} /><button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} className="absolute inset-y-0 right-3 text-xs font-medium text-slate-400 hover:text-brand-700">{showPassword ? 'Hide' : 'Show'}</button></div></div>
          </div>
          <button type="submit" disabled={loading} className="mt-7 flex w-full items-center justify-center gap-3 rounded-xl bg-brand-600 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-60">{loading ? 'Signing in...' : 'Sign in to workspace'}<span aria-hidden="true">&rarr;</span></button>
          <p className="mt-6 text-center text-xs leading-relaxed text-slate-400">Need access? Contact your workspace administrator.</p>
        </form>
        <p className="text-center text-[11px] text-slate-400">GrantFlow <span className="mx-1.5">/</span> A little more clarity. A lot more impact.</p>
      </section>
    </div>
  )
}

export default Login
