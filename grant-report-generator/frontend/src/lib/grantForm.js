// Shared by the Add and Edit grant forms.

export const NUMBER_FIELDS = [
  'total_grant_amount_orig', 'total_grant_amount_usd', 'sub_grant_amount',
  'current_payment_orig', 'current_payment_usd',
  'remaining_payment_orig', 'remaining_payment_usd',
  'quantity', 'no_of_beneficiaries',
]

// Mirrors REQUIRED_FOR_STATUS in backend/services/data_processor.py
// (tests/grantForm.test.mjs fails if the two drift apart).
export const STATUS_FIELDS = [
  'country', 'chapter', 'grant_number', 'project_type', 'department',
  'supplier', 'item', 'po_wo_number', 'sub_grant_no',
  'link_to_complete_documents', 'secondary_currency',
  'total_grant_amount_orig', 'total_grant_amount_usd',
  'current_payment_orig', 'current_payment_usd',
  'remaining_payment_orig', 'remaining_payment_usd',
  'payment_status', 'payment_reference',
  'grant_receiving_date', 'grant_application_sent_date',
  'date_dr_zafar_signed_application', 'date_of_approval_by_khaleeq_sb',
  'date_of_email_to_int_chapter', 'payment_date',
  'date_ceo_signed_application',
  'shipping_documents_status', 'shipping_documents_comment',
  'link_to_shipping_documents', 'commercial_invoice_no',
  'bill_of_lading', 'packing_list_reference',
  'grn_receiving_status', 'receiving_date', 'grn_number',
  'link_to_grn', 'grn_receiving_comments', 'installation_date',
  'location', 'building_name', 'floor', 'room',
  'item_model', 'item_serial_number', 'quantity',
  'ihhn_asset_tag_number', 'department_for_pictures',
  'picture', 'pictures_status', 'no_of_beneficiaries',
  'item_description',
]

// Zero means "not entered" for these (mirrors NONZERO_FOR_STATUS).
export const NONZERO_FIELDS = ['total_grant_amount_orig', 'total_grant_amount_usd', 'quantity', 'no_of_beneficiaries']

function isFilled(field, value) {
  if (value === null || value === undefined || !String(value).trim()) return false
  if (NONZERO_FIELDS.includes(field)) return Number(value) !== 0
  return true
}

// Preview only; the server calculates the saved status the same way.
export function calcReportStatus(form) {
  if (!STATUS_FIELDS.every(field => isFilled(field, form[field]))) return 'Incomplete Information'
  return isFilled('link_to_utilization_report', form.link_to_utilization_report) ? 'Complete' : 'Pending'
}

const blank = value => value === null || value === undefined || String(value).trim() === ''

// Blank number fields are sent as null so the Sheet keeps them blank.
export function toPayload(form) {
  const payload = { ...form }
  for (const field of NUMBER_FIELDS) {
    const number = parseFloat(form[field])
    payload[field] = blank(form[field]) || !Number.isFinite(number) ? null : number
  }
  return payload
}

// API values -> form values. Keeps a real 0, turns null into ''.
export function toForm(grant, template) {
  return Object.fromEntries(Object.keys(template).map(key => [key, grant[key] ?? template[key]]))
}

const AMOUNTS = { total: 'total_grant_amount', current: 'current_payment' }
const money = value => (Math.round(value * 100) / 100).toFixed(2)

// Recalculate USD values from the original-currency amounts, then remaining.
// With no usable rate the USD value is cleared rather than guessed.
export function applyAmounts(form, rate, which = ['total', 'current']) {
  const next = { ...form }
  for (const key of which) {
    const orig = form[`${AMOUNTS[key]}_orig`]
    if (blank(orig)) continue
    next[`${AMOUNTS[key]}_usd`] = rate > 0 ? money(parseFloat(orig) * rate) : ''
  }
  for (const suffix of ['orig', 'usd']) {
    const total = next[`total_grant_amount_${suffix}`]
    const current = next[`current_payment_${suffix}`]
    next[`remaining_payment_${suffix}`] = blank(total) ? '' : money(parseFloat(total) - (parseFloat(current) || 0))
  }
  return next
}

// The rate behind amounts already saved, so editing keeps the historic rate.
export function impliedRate(form) {
  for (const key of Object.values(AMOUNTS)) {
    const orig = parseFloat(form[`${key}_orig`])
    const usd = parseFloat(form[`${key}_usd`])
    if (orig > 0 && usd > 0) return Number((usd / orig).toFixed(6))
  }
  return null
}
