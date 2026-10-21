import { Children, isValidElement } from 'react'

const slug = title => `section-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`

// A field's name, also when it is wrapped in a layout <div>.
function fieldName(child) {
  if (!isValidElement(child)) return null
  return child.props.name || (isValidElement(child.props.children) ? child.props.children.props.name : null) || null
}

// Splits children at each `sectionMarker` element into section cards, with a
// sticky menu that jumps to each section and shows how much of it is filled.
export default function GrantSections({ children, form = {}, aside }) {
  const sections = []
  Children.toArray(children).forEach(child => {
    if (isValidElement(child) && child.props.sectionMarker) {
      sections.push({ title: child.props.title, children: [], names: [] })
    } else if (sections.length) {
      sections.at(-1).children.push(child)
      const name = fieldName(child)
      if (name) sections.at(-1).names.push(name)
    }
  })
  const filled = section => section.names.filter(name => String(form[name] ?? '').trim()).length

  return (
    <div className="grid gap-8 lg:grid-cols-[230px_minmax(0,1fr)]">
      <aside className="hidden lg:block">
        <div className="sticky top-8 space-y-4">
          {aside}
          <nav aria-label="Form sections" className="rounded-2xl border border-slate-200/80 bg-white p-2">
            {sections.map((section, index) => {
              const done = filled(section)
              const complete = section.names.length > 0 && done === section.names.length
              return (
                <a key={section.title} href={`#${slug(section.title)}`}
                   className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-600 transition hover:bg-slate-50 hover:text-slate-900">
                  <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold
                    ${complete ? 'bg-brand-600 text-white' : done ? 'bg-brand-100 text-brand-700' : 'bg-slate-100 text-slate-500'}`}>
                    {complete ? '✓' : index + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{section.title}</span>
                  <span className="text-xs tabular-nums text-slate-400">{done}/{section.names.length}</span>
                </a>
              )
            })}
          </nav>
        </div>
      </aside>

      <div className="min-w-0 space-y-6">
        {sections.map((section, index) => (
          <section key={section.title} id={slug(section.title)} aria-labelledby={`${slug(section.title)}-title`}
                   className="workspace-card scroll-mt-6 rounded-2xl border border-slate-200/80 bg-white">
            <header className="flex items-center justify-between gap-3 border-b border-slate-100 px-6 py-4">
              <h2 id={`${slug(section.title)}-title`} className="flex items-center gap-3 text-[15px] font-semibold text-slate-900">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-50 text-xs font-semibold text-brand-600">{String(index + 1).padStart(2, '0')}</span>
                {section.title}
              </h2>
              <span className="text-xs tabular-nums text-slate-400">{filled(section)} of {section.names.length} filled</span>
            </header>
            <div className="grid grid-cols-1 gap-x-6 gap-y-5 p-6 sm:grid-cols-2">{section.children}</div>
          </section>
        ))}
      </div>
    </div>
  )
}
