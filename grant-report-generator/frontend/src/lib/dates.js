// Dates arrive as ISO text, as Google Sheets serial numbers, or as free text.

export function parseSheetDate(value) {
  if (value === null || value === undefined) return null
  const text = String(value).trim()
  if (!text) return null
  const serial = Number(text)
  if (!Number.isNaN(serial) && serial > 20000 && serial < 80000) {
    return new Date(Date.UTC(1899, 11, 30 + Math.floor(serial)))
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return new Date(text.slice(0, 10) + 'T00:00:00Z')
  return null
}

// Unparseable text is shown as typed.
export function formatDate(value) {
  const date = parseSheetDate(value)
  if (!date) return value ? String(value).trim() : ''
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
}

export const monthKey = date => `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`

export function formatMonth(key) {
  const [year, month] = key.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString('en-GB', { month: 'short', year: '2-digit', timeZone: 'UTC' })
}
