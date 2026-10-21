// Button styles, shared by <Button> and links/buttons that need the same look.
const BUTTON = {
  primary: 'bg-brand-600 text-white shadow-sm shadow-brand-600/20 hover:bg-brand-700',
  secondary: 'border border-slate-200 bg-white text-slate-700 shadow-xs hover:border-brand-200 hover:bg-brand-50/50 hover:text-brand-800',
  ghost: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
  danger: 'bg-rose-600 text-white hover:bg-rose-700',
}
const SIZE = { sm: 'h-8 gap-1.5 rounded-lg px-3 text-xs', md: 'h-10 gap-2 rounded-xl px-4 text-sm' }

export function buttonClass(variant = 'secondary', size = 'md') {
  return `inline-flex shrink-0 items-center justify-center font-medium transition disabled:opacity-50 ${BUTTON[variant]} ${SIZE[size]}`
}
