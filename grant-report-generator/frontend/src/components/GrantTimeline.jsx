import { formatDate } from '../lib/dates'
import { timelineSteps } from '../lib/pipeline'

const MARKERS = {
  done: { ring: 'border-brand-700 bg-brand-700 text-white', text: 'text-slate-800', sr: 'Done' },
  next: { ring: 'border-brand-600 bg-white ring-4 ring-brand-100', text: 'font-semibold text-brand-800', sr: 'Next step' },
  todo: { ring: 'border-slate-300 bg-white', text: 'text-slate-400', sr: 'Not yet' },
}

export default function GrantTimeline({ grant }) {
  const steps = timelineSteps(grant)
  const done = steps.filter(step => step.done).length
  const next = steps.find(step => step.state === 'next')
  return (
    <section aria-label="Grant progress">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-100 pb-2">
        <h3 className="text-sm font-semibold text-brand-800">Progress</h3>
        <p className="text-xs text-slate-500">
          {done} of {steps.length} milestones
          {next ? <> · Next: <span className="font-medium text-slate-700">{next.label}</span></> : ' · All done'}
        </p>
      </div>
      {/* Meter: the track is a lighter step of the same ramp as the fill */}
      <div role="progressbar" aria-label="Milestones completed" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={done}
           className="mb-4 h-1.5 w-full overflow-hidden rounded-full bg-brand-100">
        <div className="h-full rounded-full bg-brand-700" style={{ width: `${(done / steps.length) * 100}%` }} />
      </div>
      {/* columns flow top-to-bottom, so each connector meets the step below it */}
      <ol className="gap-x-8 sm:columns-2">
        {steps.map((step, index) => {
          const marker = MARKERS[step.state]
          const detail = step.date ? formatDate(step.date) : step.status
          return (
            <li key={step.label} className="relative flex break-inside-avoid gap-3 pb-3">
              {index < steps.length - 1 && <span aria-hidden="true" className={`absolute bottom-0 left-[9px] top-5 w-px ${step.done ? 'bg-brand-200' : 'bg-slate-200'}`} />}
              <span className={`relative z-[1] mt-0.5 flex h-[19px] w-[19px] shrink-0 items-center justify-center rounded-full border-2 ${marker.ring}`}>
                {step.state === 'done' && (
                  <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" aria-hidden="true"><path d="M2.5 6.2l2.2 2.2 4.8-4.8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                )}
              </span>
              <div className="min-w-0">
                <p className={`text-sm ${marker.text}`}><span className="sr-only">{marker.sr}: </span>{step.label}</p>
                {detail && <p className="text-xs text-slate-500">{detail}</p>}
              </div>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
