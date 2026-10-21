import { parseSheetDate } from './dates.js'

const DAY = 24 * 60 * 60 * 1000
export const REPORT_DUE_DAYS = 90
const PICTURES_DONE = new Set(['Yes', 'Consumable', 'Not applicable'])

// Grants someone should act on, most serious first. Each item names the
// problem in words; severity only orders the list.
export function attentionItems(grants, today = new Date()) {
  const items = []
  for (const grant of grants) {
    if (String(grant.shipping_documents_status || '').toLowerCase().includes('discrepancy')) {
      items.push({ grant, severity: 0, icon: 'alert', title: 'Shipping discrepancy', detail: grant.shipping_documents_comment || 'Shipping documents were received with a discrepancy.' })
    }
    const paid = parseSheetDate(grant.payment_date)
    const days = paid ? Math.floor((today - paid) / DAY) : 0
    if (paid && days > REPORT_DUE_DAYS && grant.report_status !== 'Complete') {
      items.push({ grant, severity: 1, icon: 'clock', title: `Paid ${days} days ago, report not complete`, detail: `Report status: ${grant.report_status || 'not set'}`, days })
    }
    if (String(grant.installation_date || '').trim() && !PICTURES_DONE.has(grant.pictures_status)) {
      items.push({ grant, severity: 2, icon: 'camera', title: 'Installed without pictures', detail: 'Add pictures or mark them as not applicable.' })
    }
  }
  return items.sort((a, b) => a.severity - b.severity || (b.days || 0) - (a.days || 0))
}
