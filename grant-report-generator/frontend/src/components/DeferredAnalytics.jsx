import { Component, lazy, Suspense, useEffect, useRef, useState } from 'react'

const Analytics = lazy(() => import('./DashboardAnalytics'))
class ChartError extends Component {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() {
    return this.state.failed ? <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm">Charts could not load. Your grant records are still available. <button onClick={() => window.location.reload()} className="underline">Reload charts</button></p> : this.props.children
  }
}
export default function DeferredAnalytics(props) {
  const target = useRef(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    if (!('IntersectionObserver' in window)) {
      queueMicrotask(() => setVisible(true))
      return
    }
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { setVisible(true); observer.disconnect() }
    }, { rootMargin: '200px' })
    observer.observe(target.current)
    return () => observer.disconnect()
  }, [])
  return <div ref={target} className="min-h-48">
    {visible ? <ChartError><Suspense fallback={<p role="status" className="p-10 text-center text-sm text-slate-400">Loading charts and map...</p>}><Analytics {...props} /></Suspense></ChartError> : <p className="p-10 text-center text-sm text-slate-400">Charts load as you scroll.</p>}
  </div>
}
