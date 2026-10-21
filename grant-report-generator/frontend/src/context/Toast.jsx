import { useCallback, useMemo, useRef, useState } from 'react'
import { Icon } from '../components/ui'
import { ToastContext } from './toastContext'

const TONES = {
  success: ['border-emerald-200', 'text-emerald-600', 'check'],
  error: ['border-rose-200', 'text-rose-600', 'alert'],
  info: ['border-brand-200', 'text-brand-600', 'alert'],
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const nextId = useRef(0)
  const dismiss = useCallback(id => setToasts(list => list.filter(toast => toast.id !== id)), [])
  const show = useCallback((message, tone = 'success') => {
    const id = ++nextId.current
    setToasts(list => [...list.slice(-3), { id, message, tone }])
    setTimeout(() => dismiss(id), tone === 'error' ? 9000 : 5000)
  }, [dismiss])
  const value = useMemo(() => ({ show }), [show])
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2">
        {toasts.map(toast => {
          const [border, iconColor, icon] = TONES[toast.tone] || TONES.info
          return (
            <div key={toast.id} role={toast.tone === 'error' ? 'alert' : 'status'}
                 className={`toast-in pointer-events-auto flex items-start gap-3 rounded-xl border bg-white p-4 text-sm text-slate-700 shadow-lg ${border}`}>
              <Icon name={icon} className={`mt-0.5 h-4 w-4 shrink-0 ${iconColor}`} />
              <p className="flex-1">{toast.message}</p>
              <button type="button" onClick={() => dismiss(toast.id)} aria-label="Dismiss" className="text-slate-400 hover:text-slate-600">
                <Icon name="close" className="h-4 w-4" />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}
