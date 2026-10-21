const REQUIRED = ['country', 'chapter', 'grant_number', 'project_type', 'supplier', 'item']

export default function FormProgress({ form, dirty }) {
  const completed = REQUIRED.filter(key => String(form[key] ?? '').trim()).length
  return <div className="mb-5 rounded-xl border border-brand-100 bg-brand-50 p-4">
    <div className="mb-2 flex flex-wrap justify-between gap-2 text-xs">
      <span className="font-medium text-brand-800">Required fields: {completed} of {REQUIRED.length} complete</span>
      <span className="text-slate-500">{dirty ? 'Unsaved changes' : 'No unsaved changes'}</span>
    </div>
    <progress aria-label="Required grant fields completed" value={completed} max={REQUIRED.length} className="h-1.5 w-full accent-brand-600" />
    <p className="mt-2 text-xs text-slate-500">Complete additional sections as information becomes available. Report readiness is calculated separately.</p>
  </div>
}
