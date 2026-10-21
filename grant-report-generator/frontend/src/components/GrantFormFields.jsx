// Field components shared by the Add and Edit grant forms.
import { StatusPill } from './ui'

const fieldBase = `h-10 w-full rounded-xl border px-3.5 text-sm transition placeholder:text-slate-400
  focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-100`
export const inputClass = `${fieldBase} border-slate-200 bg-white text-slate-900 shadow-xs`
// Calculated or locked values: visibly not editable.
const lockedClass = `${fieldBase} cursor-not-allowed border-slate-100 bg-slate-50 text-slate-500`
export const labelClass = 'mb-1.5 block text-sm font-medium text-slate-700'

function Label({ name, label, required }) {
  return (
    <label htmlFor={name} className={labelClass}>
      {label} {required && <span className="text-rose-500" aria-hidden="true">*</span>}
    </label>
  )
}

// Marks the start of a form section; GrantSections turns these into cards.
export function SectionHeader() { return null }

export function TextField({ name, label, placeholder, required, value, onChange, disabled }) {
  return (
    <div>
      <Label name={name} label={label} required={required} />
      <input type="text" id={name} name={name} value={value} onChange={onChange} placeholder={placeholder || ''}
             disabled={disabled} required={required} className={disabled ? lockedClass : inputClass} />
    </div>
  )
}

export function NumberField({ name, label, readOnly, hint, value, onChange }) {
  return (
    <div>
      <Label name={name} label={label} />
      <input type="number" id={name} name={name} value={value} onChange={onChange} readOnly={readOnly}
             min="0" step="0.01" inputMode="decimal" aria-describedby={hint ? `${name}_hint` : undefined}
             className={`${readOnly ? lockedClass : inputClass} tabular-nums`} />
      {hint && <p id={`${name}_hint`} className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  )
}

export function DateField({ name, label, value, onChange }) {
  return (
    <div>
      <Label name={name} label={label} />
      <input type="date" id={name} name={name} value={value} onChange={onChange} className={inputClass} />
    </div>
  )
}

export function SelectField({ name, label, options, required, value, onChange }) {
  return (
    <div>
      <Label name={name} label={label} required={required} />
      <select id={name} name={name} value={value} onChange={onChange} required={required} className={inputClass}>
        <option value="">Select…</option>
        {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
      </select>
    </div>
  )
}

export function LinkField({ name, label, value, onChange }) {
  return (
    <div>
      <Label name={name} label={label} />
      <div className="flex gap-2">
        <input type="url" id={name} name={name} value={value} onChange={onChange} placeholder="https://" className={`${inputClass} flex-1`} />
        {value && (
          <a href={value} target="_blank" rel="noreferrer"
             className="inline-flex h-10 shrink-0 items-center rounded-xl border border-slate-200 px-3.5 text-xs font-medium text-brand-700 hover:bg-brand-50">
            Open
          </a>
        )}
      </div>
    </div>
  )
}

export function TextareaField({ name, label, value, onChange }) {
  return (
    <div>
      <Label name={name} label={label} />
      <textarea id={name} name={name} value={value} onChange={onChange} rows={3}
                className={`${inputClass} h-auto resize-y py-2.5`} />
    </div>
  )
}

export function ReadOnlyField({ id, label, value, hint }) {
  return (
    <div>
      <label htmlFor={id} className={labelClass}>{label}</label>
      <input id={id} type="text" value={value} readOnly className={lockedClass} />
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  )
}

// Sticky bar with the live report status and the save action.
export function FormSaveBar({ status, dirty, error, saving, disabled, saveLabel, savingLabel, onSave, onCancel }) {
  return (
    <div className="sticky bottom-4 z-20 mt-8 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-slate-200 bg-white/95 p-3 pl-5 shadow-[0_12px_40px_-12px_rgb(25_30_55_/_25%)] backdrop-blur">
      <span className="flex items-center gap-2 text-xs text-slate-500">Report status <StatusPill value={status} /></span>
      <span className={`text-xs ${dirty ? 'font-medium text-amber-700' : 'text-slate-400'}`}>{dirty ? 'Unsaved changes' : 'No unsaved changes'}</span>
      {error && <span role="alert" className="min-w-0 flex-1 basis-full text-xs font-medium text-rose-700 sm:basis-auto">{error}</span>}
      <div className="ml-auto flex gap-2">
        <button type="button" onClick={onCancel} className="h-10 rounded-xl px-4 text-sm font-medium text-slate-600 hover:bg-slate-100">Cancel</button>
        <button type="button" onClick={onSave} disabled={saving || disabled}
                className="h-10 rounded-xl bg-brand-600 px-5 text-sm font-semibold text-white shadow-sm shadow-brand-600/25 transition hover:bg-brand-700 disabled:opacity-50">
          {saving ? savingLabel : saveLabel}
        </button>
      </div>
    </div>
  )
}
