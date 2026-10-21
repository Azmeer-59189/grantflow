// Shared building blocks for every GrantFlow page.
import { useEffect, useRef } from 'react'
import { buttonClass } from './buttonStyles'

// ── Icons (inline, no extra package) ────────────────────────────────────────
const ICONS = {
  dashboard: 'M4 4h6v7H4zM14 4h6v4h-6zM14 12h6v8h-6zM4 15h6v5H4z',
  records: 'M4 6h16M4 12h16M4 18h10',
  history: 'M3 12a9 9 0 109-9 9 9 0 00-7 3M3 3v4h4M12 7v5l3 2',
  activity: 'M3 12h4l3 8 4-16 3 8h4',
  team: 'M16 20v-1a4 4 0 00-4-4H6a4 4 0 00-4 4v1M9 11a4 4 0 100-8 4 4 0 000 8zM22 20v-1a4 4 0 00-3-3.9M16 3.1a4 4 0 010 7.8',
  refresh: 'M20 7v5h-5M4 17v-5h5M6 7a7 7 0 0112-1l2 6M4 12l2 6a7 7 0 0012-1',
  plus: 'M12 5v14M5 12h14',
  logout: 'M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9',
  alert: 'M12 9v4M12 17h.01M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z',
  external: 'M7 17L17 7M8 7h9v9',
  close: 'M6 6l12 12M18 6L6 18',
  menu: 'M4 6h16M4 12h16M4 18h16',
  search: 'M11 19a8 8 0 100-16 8 8 0 000 16zM21 21l-4.3-4.3',
  download: 'M12 4v12M7 11l5 5 5-5M5 20h14',
  columns: 'M4 4h6v16H4zM14 4h6v16h-6z',
  edit: 'M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4',
  file: 'M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8zM14 3v5h5',
  check: 'M5 12.5l4.5 4.5L19 7',
  clock: 'M12 21a9 9 0 100-18 9 9 0 000 18zM12 7v5l3 2',
  package: 'M21 8l-9-5-9 5 9 5 9-5zM3 8v8l9 5 9-5V8M12 13v8',
  camera: 'M4 7h3l2-3h6l2 3h3a1 1 0 011 1v11a1 1 0 01-1 1H4a1 1 0 01-1-1V8a1 1 0 011-1zM12 17a4 4 0 100-8 4 4 0 000 8z',
  arrowLeft: 'M19 12H5M11 18l-6-6 6-6',
  arrowRight: 'M5 12h14M13 6l6 6-6 6',
  chevronDown: 'M6 9l6 6 6-6',
  dollar: 'M12 3v18M17 7.5C17 5.6 14.8 5 12 5S7 6 7 8s2 2.7 5 3.3 5 1.4 5 3.7-2.2 3-5 3-5-.9-5-3',
}

export function Icon({ name, className = 'h-5 w-5', strokeWidth = 1.8 }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth}
         strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  )
}

// ── Buttons ─────────────────────────────────────────────────────────────────
export function Button({ variant = 'secondary', size = 'md', icon, children, className = '', ...props }) {
  return (
    <button type="button" className={`${buttonClass(variant, size)} ${className}`} {...props}>
      {icon && <Icon name={icon} className={size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'} />}
      {children}
    </button>
  )
}

// ── Surfaces ────────────────────────────────────────────────────────────────
export function Card({ title, subtitle, action, children, className = '', padded = true }) {
  return (
    <section className={`workspace-card rounded-2xl border border-slate-200/80 bg-white ${className}`}>
      {(title || action) && (
        <header className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5">
          <div>
            <h2 className="text-[15px] font-semibold text-slate-900">{title}</h2>
            {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      <div className={padded ? 'p-5' : ''}>{children}</div>
    </section>
  )
}

export function EmptyState({ icon = 'records', title, children, action }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600"><Icon name={icon} /></span>
      <p className="text-sm font-semibold text-slate-800">{title}</p>
      {children && <p className="mt-1 max-w-sm text-sm text-slate-500">{children}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function Skeleton({ className = 'h-4 w-full' }) {
  return <span aria-hidden="true" className={`block animate-pulse rounded-lg bg-slate-200/70 ${className}`} />
}

export function Alert({ tone = 'error', children, action }) {
  const tones = {
    error: 'border-rose-200 bg-rose-50 text-rose-800',
    warning: 'border-amber-200 bg-amber-50 text-amber-900',
    info: 'border-brand-100 bg-brand-50 text-brand-800',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  }
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`flex items-start justify-between gap-4 rounded-xl border p-4 text-sm ${tones[tone]}`}>
      <div className="flex min-w-0 gap-3">
        <Icon name={tone === 'success' ? 'check' : 'alert'} className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="min-w-0">{children}</div>
      </div>
      {action}
    </div>
  )
}

// ── Status pills: the label always carries the meaning, the color supports it ──
function statusTone(value) {
  const green = ['Complete', 'Report Complete', 'Received', 'Paid', 'completed', 'Yes']
  const red = ['Overdue', 'Discrepancy', 'Not Received', 'Incomplete Information',
    'Not received', 'Received with discrepancy', 'unconfirmed']
  const gray = ['Not required', 'Not applicable', 'rejected', 'Consumable']
  if (green.includes(value)) return 'green'
  if (red.includes(value)) return 'red'
  if (gray.includes(value)) return 'gray'
  return 'amber'
}
const TONES = {
  green: { pill: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20', dot: 'bg-emerald-500' },
  amber: { pill: 'bg-amber-50 text-amber-800 ring-amber-600/20', dot: 'bg-amber-500' },
  red: { pill: 'bg-rose-50 text-rose-700 ring-rose-600/20', dot: 'bg-rose-500' },
  gray: { pill: 'bg-slate-100 text-slate-600 ring-slate-500/20', dot: 'bg-slate-400' },
}

export function StatusPill({ value, tone }) {
  if (!value) return <span className="text-slate-400">—</span>
  const t = TONES[tone || statusTone(value)]
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${t.pill}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${t.dot}`} />
      {value}
    </span>
  )
}

// ── Dialogs: Escape closes, focus moves in and returns, Tab stays inside ─────
function useDialog(open, onClose) {
  const panel = useRef(null)
  const close = useRef(onClose)
  useEffect(() => { close.current = onClose })
  useEffect(() => {
    if (!open) return
    const onClose = () => close.current()
    const previous = document.activeElement
    const focusable = () => [...panel.current.querySelectorAll('button:not([disabled]), a[href], input:not([disabled]), select, textarea, [tabindex="0"]')]
    focusable()[0]?.focus()
    function onKey(event) {
      if (event.key === 'Escape') { event.stopPropagation(); onClose() }
      if (event.key !== 'Tab') return
      const items = focusable()
      if (!items.length) return
      const first = items[0], last = items.at(-1)
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      previous?.focus?.()
    }
  }, [open])
  return panel
}

export function Modal({ open, onClose, label, children, size = 'max-w-lg' }) {
  const panel = useDialog(open, onClose)
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <div ref={panel} role="dialog" aria-modal="true" aria-label={label} onClick={event => event.stopPropagation()}
           className={`flex max-h-[92vh] w-full ${size} flex-col overflow-hidden rounded-2xl bg-white shadow-2xl`}>
        {children}
      </div>
    </div>
  )
}

export function Drawer({ open, onClose, label, children }) {
  const panel = useDialog(open, onClose)
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/30 backdrop-blur-[2px]" onClick={onClose}>
      <div ref={panel} role="dialog" aria-modal="true" aria-label={label} onClick={event => event.stopPropagation()}
           className="drawer-panel flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl">
        {children}
      </div>
    </div>
  )
}
