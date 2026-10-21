import { useState } from 'react'
const FIELDS = ['country', 'chapter', 'department', 'payment', 'report', 'stage', 'search', 'sortField', 'sortDirection']
export default function useSavedViews(userId) {
  const key = `grantflow:views:v1:${userId}`
  const [views, setViews] = useState(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || '[]')
      return Array.isArray(parsed) ? parsed.filter(view => typeof view?.name === 'string' && view.filters && typeof view.filters === 'object').slice(0, 10) : []
    } catch { return [] }
  })
  const [error, setError] = useState('')
  function persist(next) {
    try { localStorage.setItem(key, JSON.stringify(next)); setViews(next); setError(''); return true }
    catch { setError('This browser could not save your views. Check browser storage settings.'); return false }
  }
  function save(name, filters) {
    name = name.trim().slice(0, 60)
    if (!name) { setError('Enter a name for this view.'); return false }
    const remaining = views.filter(view => view.name !== name)
    if (remaining.length >= 10) { setError('You can save up to 10 views. Delete one first.'); return false }
    const clean = Object.fromEntries(FIELDS.filter(field => typeof filters[field] === 'string').map(field => [field, filters[field]]))
    return persist([...remaining, { name, filters: clean }])
  }
  return { views, error, save, remove: name => persist(views.filter(view => view.name !== name)) }
}
