export const SORT_FIELDS = ['grant_number', 'country', 'chapter', 'supplier', 'item', 'department', 'project_type', 'total_grant_amount_usd', 'current_payment_usd', 'remaining_payment_usd', 'payment_status', 'report_status', 'shipping_documents_status', 'location']
const NUMERIC = new Set(['total_grant_amount_usd', 'current_payment_usd', 'remaining_payment_usd'])
export function sortRecords(rows, field, direction = 'asc') {
  if (!SORT_FIELDS.includes(field)) return [...rows]
  const sign = direction === 'desc' ? -1 : 1
  return [...rows].sort((a, b) => {
    const result = NUMERIC.has(field)
      ? (Number(a[field]) || 0) - (Number(b[field]) || 0)
      : String(a[field] ?? '').localeCompare(String(b[field] ?? ''), undefined, { numeric: true, sensitivity: 'base' })
    return result * sign || String(a.grant_number).localeCompare(String(b.grant_number), undefined, { numeric: true })
  })
}
export function paginateRecords(rows, requestedPage, pageSize) {
  const size = [10, 25, 50, 100].includes(pageSize) ? pageSize : 25
  const pages = Math.max(1, Math.ceil(rows.length / size))
  const page = Math.max(1, Math.min(requestedPage, pages))
  return { rows: rows.slice((page - 1) * size, page * size), page, pages, start: rows.length ? (page - 1) * size + 1 : 0, end: Math.min(page * size, rows.length) }
}
