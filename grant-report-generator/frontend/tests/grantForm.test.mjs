import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { STATUS_FIELDS, NONZERO_FIELDS, calcReportStatus, toPayload, toForm, applyAmounts, impliedRate } from '../src/lib/grantForm.js'

const backend = readFileSync(new URL('../../backend/services/data_processor.py', import.meta.url), 'utf8')
const pythonSet = name => {
  const body = backend.match(new RegExp(`${name} = \\{([\\s\\S]*?)\\}`))[1]
  return [...body.matchAll(/"([a-z_]+)"/g)].map(match => match[1]).sort()
}

test('report status fields match the backend exactly', () => {
  assert.deepEqual([...STATUS_FIELDS].sort(), pythonSet('REQUIRED_FOR_STATUS'))
  assert.deepEqual([...NONZERO_FIELDS].sort(), pythonSet('NONZERO_FOR_STATUS'))
})

test('blank or zero quantity keeps a grant incomplete', () => {
  const full = Object.fromEntries(STATUS_FIELDS.map(field => [field, 'x']))
  Object.assign(full, { quantity: '2', no_of_beneficiaries: '3', total_grant_amount_orig: '5', total_grant_amount_usd: '5', remaining_payment_usd: '0' })
  assert.equal(calcReportStatus(full), 'Pending')
  assert.equal(calcReportStatus({ ...full, quantity: '0' }), 'Incomplete Information')
  assert.equal(calcReportStatus({ ...full, quantity: '' }), 'Incomplete Information')
  assert.equal(calcReportStatus({ ...full, link_to_utilization_report: 'https://x' }), 'Complete')
})

test('blank numbers are sent as null, real zeros are kept', () => {
  const payload = toPayload({ quantity: '', no_of_beneficiaries: '0', total_grant_amount_usd: '12.5', supplier: 'A' })
  assert.equal(payload.quantity, null)
  assert.equal(payload.no_of_beneficiaries, 0)
  assert.equal(payload.total_grant_amount_usd, 12.5)
  assert.equal(payload.supplier, 'A')
  assert.deepEqual(toForm({ quantity: null, remaining_payment_usd: 0 }, { quantity: '', remaining_payment_usd: '' }), { quantity: '', remaining_payment_usd: 0 })
})

test('USD amounts are cleared, not guessed, when there is no rate', () => {
  const form = { total_grant_amount_orig: '100', total_grant_amount_usd: '100', current_payment_orig: '40', current_payment_usd: '40' }
  const missing = applyAmounts(form, null)
  assert.equal(missing.total_grant_amount_usd, '')
  assert.equal(missing.remaining_payment_orig, '60.00')
  assert.equal(missing.remaining_payment_usd, '')
  const converted = applyAmounts(form, 0.73)
  assert.equal(converted.total_grant_amount_usd, '73.00')
  assert.equal(converted.current_payment_usd, '29.20')
  assert.equal(converted.remaining_payment_usd, '43.80')
})

test('editing keeps the rate implied by the saved amounts', () => {
  assert.equal(impliedRate({ total_grant_amount_orig: 200, total_grant_amount_usd: 146 }), 0.73)
  assert.equal(impliedRate({ total_grant_amount_orig: '', current_payment_orig: 10, current_payment_usd: 7 }), 0.7)
  assert.equal(impliedRate({}), null)
})
