import { Children, isValidElement } from 'react'

export default function GrantSections({ children }) {
  const sections = []
  Children.toArray(children).forEach(child => {
    if (isValidElement(child) && child.props.sectionMarker) {
      sections.push({ title: child.props.title, children: [] })
    } else if (sections.length) sections.at(-1).children.push(child)
  })
  return <div className="space-y-4">{sections.map((section, index) => (
    <details key={section.title} open={index === 0} className="group rounded-xl border border-slate-200 bg-white">
      <summary className="flex cursor-pointer list-none items-center justify-between rounded-xl px-5 py-4 text-sm font-semibold text-slate-800 hover:bg-slate-50">
        <span><span className="mr-3 text-xs font-medium text-brand-500">{String(index + 1).padStart(2, '0')}</span>{section.title}</span>
        <span aria-hidden="true" className="text-lg text-slate-400 group-open:rotate-45">+</span>
      </summary>
      <div className="grid grid-cols-1 gap-x-6 gap-y-5 border-t border-slate-100 p-5 sm:grid-cols-2">{section.children}</div>
    </details>
  ))}</div>
}
