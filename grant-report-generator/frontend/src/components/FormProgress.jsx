const REQUIRED = ['country', 'chapter', 'grant_number', 'project_type', 'supplier', 'item']

export default function FormProgress({ form, dirty }) {
  const completed = REQUIRED.filter(key => String(form[key] ?? '').trim()).length
  return <div className="rounded-2xl border border-brand-100 bg-gradient-to-br from-brand-50 to-white p-4">
    <p className="text-xs font-semibold text-brand-800">Required fields: {completed} of {REQUIRED.length} complete</p>
    <div role="progressbar" aria-label="Required grant fields completed" aria-valuemin={0} aria-valuemax={REQUIRED.length} aria-valuenow={completed}
         className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-brand-100">
      <div className="h-full rounded-full bg-brand-600 transition-[width]" style={{ width: `${(completed / REQUIRED.length) * 100}%` }} />
    </div>
    <p className={`mt-2.5 text-xs ${dirty ? 'font-medium text-amber-700' : 'text-slate-500'}`}>{dirty ? 'Unsaved changes' : 'No unsaved changes'}</p>
    <p className="mt-1 text-[11px] leading-relaxed text-slate-500">Fill in other sections as information arrives. Report readiness is calculated separately.</p>
  </div>
}
