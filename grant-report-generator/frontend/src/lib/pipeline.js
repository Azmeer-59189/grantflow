import { monthKey, parseSheetDate } from './dates.js'

const filled = value => value !== null && value !== undefined && String(value).trim() !== ''
const CLEARED_SHIPPING = new Set(['Received', 'Received with comments', 'Received with discrepancy', 'Not required', 'Not applicable'])
const CLEARED_GRN = new Set(['Received', 'Received with comments', 'Not required'])
const num = value => Number(value) || 0

// Each grant sits at its first milestone that is not done yet.
export const STAGES = [
  { key: 'application', label: 'Application to send', done: g => filled(g.grant_application_sent_date) },
  { key: 'approval', label: 'Awaiting approval', done: g => filled(g.date_of_approval_by_khaleeq_sb) },
  { key: 'payment', label: 'Awaiting payment', done: g => filled(g.payment_date) || g.payment_status === 'Complete' },
  { key: 'shipping', label: 'Awaiting shipping documents', done: g => CLEARED_SHIPPING.has(g.shipping_documents_status) },
  { key: 'grn', label: 'Awaiting goods receipt', done: g => CLEARED_GRN.has(g.grn_receiving_status) },
  { key: 'installation', label: 'Awaiting installation', done: g => filled(g.installation_date) },
  { key: 'report', label: 'Report in progress', done: g => g.report_status === 'Complete' },
]
export const DONE_STAGE = { key: 'done', label: 'Complete', done: () => true }
export const STAGE_OPTIONS = [...STAGES, DONE_STAGE]

export function grantStage(grant) {
  return STAGES.find(stage => !stage.done(grant)) || DONE_STAGE
}

export function pipelineCounts(grants) {
  const counts = Object.fromEntries(STAGE_OPTIONS.map(stage => [stage.key, 0]))
  grants.forEach(grant => { counts[grantStage(grant).key] += 1 })
  return STAGE_OPTIONS.map(stage => ({ key: stage.key, label: stage.label, count: counts[stage.key] }))
}

// Milestones shown on a grant's timeline, in process order.
export const MILESTONES = [
  { label: 'Application sent', date: 'grant_application_sent_date' },
  { label: 'Signed by Dr. Zafar', date: 'date_dr_zafar_signed_application' },
  { label: 'Signed by CEO', date: 'date_ceo_signed_application' },
  { label: 'Approved by Khaleeq Sb', date: 'date_of_approval_by_khaleeq_sb' },
  { label: 'Emailed to chapter', date: 'date_of_email_to_int_chapter' },
  { label: 'Grant received', date: 'grant_receiving_date' },
  { label: 'Payment made', date: 'payment_date' },
  { label: 'Shipping documents', status: 'shipping_documents_status', done: g => CLEARED_SHIPPING.has(g.shipping_documents_status) },
  { label: 'Goods received', date: 'receiving_date', status: 'grn_receiving_status', done: g => CLEARED_GRN.has(g.grn_receiving_status) || filled(g.receiving_date) },
  { label: 'Installed', date: 'installation_date' },
  { label: 'Report complete', status: 'report_status', done: g => g.report_status === 'Complete' },
]

export function timelineSteps(grant) {
  const steps = MILESTONES.map(milestone => ({
    label: milestone.label,
    date: milestone.date ? grant[milestone.date] : '',
    status: milestone.status ? grant[milestone.status] : '',
    done: milestone.done ? milestone.done(grant) : filled(grant[milestone.date]),
  }))
  const next = steps.findIndex(step => !step.done)
  return steps.map((step, index) => ({ ...step, state: step.done ? 'done' : index === next ? 'next' : 'todo' }))
}

// Paid and still-to-pay USD per chapter, largest grant value first.
export function fundingByChapter(grants) {
  const byChapter = {}
  grants.forEach(grant => {
    const chapter = grant.chapter || 'No chapter'
    const total = num(grant.total_grant_amount_usd)
    const paid = Math.min(num(grant.current_payment_usd), total || Infinity)
    byChapter[chapter] ??= { chapter, total: 0, paid: 0 }
    byChapter[chapter].total += total
    byChapter[chapter].paid += paid
  })
  return Object.values(byChapter)
    .map(row => ({ ...row, remaining: Math.max(row.total - row.paid, 0) }))
    .filter(row => row.total > 0)
    .sort((a, b) => b.total - a.total)
}

export function valueByCountry(grants) {
  const byCountry = {}
  grants.forEach(grant => {
    const country = grant.country || 'Unknown'
    byCountry[country] ??= { country, value: 0, count: 0 }
    byCountry[country].value += num(grant.total_grant_amount_usd)
    byCountry[country].count += 1
  })
  return Object.values(byCountry).sort((a, b) => b.value - a.value)
}

// Payments by month of payment date. Months without payments show as 0 so
// gaps are visible; only the most recent `limit` months are kept.
export function paymentsByMonth(grants, limit = 18) {
  const sums = {}
  grants.forEach(grant => {
    const date = parseSheetDate(grant.payment_date)
    const amount = num(grant.current_payment_usd)
    if (!date || !amount) return
    const key = monthKey(date)
    sums[key] = (sums[key] || 0) + amount
  })
  const keys = Object.keys(sums).sort()
  if (!keys.length) return []
  const months = []
  let [year, month] = keys[0].split('-').map(Number)
  const last = keys.at(-1)
  for (;;) {
    const key = `${year}-${String(month).padStart(2, '0')}`
    months.push({ month: key, payment: Math.round(sums[key] || 0) })
    if (key === last) break
    month += 1
    if (month > 12) { month = 1; year += 1 }
  }
  return months.slice(-limit)
}
