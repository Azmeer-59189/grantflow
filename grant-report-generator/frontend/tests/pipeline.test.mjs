import test from 'node:test'
import assert from 'node:assert/strict'
import { parseSheetDate, formatDate } from '../src/lib/dates.js'
import { grantStage, pipelineCounts, timelineSteps, fundingByChapter, paymentsByMonth } from '../src/lib/pipeline.js'

const complete = {
  grant_application_sent_date: '2026-01-02', date_of_approval_by_khaleeq_sb: '2026-01-10',
  payment_date: '2026-02-01', shipping_documents_status: 'Received', grn_receiving_status: 'Received',
  installation_date: '2026-03-01', report_status: 'Complete',
}

test('sheet serial numbers and ISO dates parse to the same day', () => {
  assert.equal(parseSheetDate('46296').toISOString().slice(0, 10), '2026-10-01')
  assert.equal(parseSheetDate('2026-10-01').toISOString().slice(0, 10), '2026-10-01')
  assert.equal(parseSheetDate('soon'), null)
  assert.equal(formatDate('soon'), 'soon')
})

test('each grant sits at its first unfinished milestone', () => {
  assert.equal(grantStage({}).key, 'application')
  assert.equal(grantStage({ ...complete, installation_date: '' }).key, 'installation')
  assert.equal(grantStage({ ...complete, payment_date: '', payment_status: 'Complete' }).key, 'done')
  assert.equal(grantStage({ ...complete, shipping_documents_status: 'Partial shipment documents' }).key, 'shipping')
  const counts = pipelineCounts([{}, complete, { ...complete, report_status: 'Pending' }])
  assert.equal(counts.reduce((sum, stage) => sum + stage.count, 0), 3)
  assert.deepEqual(counts.filter(s => s.count).map(s => s.key), ['application', 'report', 'done'])
})

test('timeline marks done steps and only one next step', () => {
  const steps = timelineSteps({ grant_application_sent_date: '2026-01-02', date_ceo_signed_application: '2026-01-05' })
  assert.equal(steps[0].state, 'done')
  assert.equal(steps[1].state, 'next')
  assert.equal(steps[2].state, 'done')
  assert.equal(steps.filter(s => s.state === 'next').length, 1)
  assert.ok(timelineSteps(complete).some(s => s.state === 'next'))
})

test('funding never shows more paid than the grant value', () => {
  const rows = fundingByChapter([
    { chapter: 'IDF', total_grant_amount_usd: 100, current_payment_usd: 40 },
    { chapter: 'IDF', total_grant_amount_usd: 50, current_payment_usd: 80 },
    { chapter: 'FOIHUS', total_grant_amount_usd: 500, current_payment_usd: null },
  ])
  assert.deepEqual(rows.map(r => r.chapter), ['FOIHUS', 'IDF'])
  assert.deepEqual(rows[1], { chapter: 'IDF', total: 150, paid: 90, remaining: 60 })
})

test('monthly payments fill gaps and sort correctly across date formats', () => {
  const months = paymentsByMonth([
    { payment_date: '46296', current_payment_usd: 10 },      // Oct 2026 as a serial
    { payment_date: '2026-07-15', current_payment_usd: 5 },
    { payment_date: '2026-07-20', current_payment_usd: 5 },
    { payment_date: '', current_payment_usd: 99 },
  ])
  assert.deepEqual(months, [
    { month: '2026-07', payment: 10 }, { month: '2026-08', payment: 0 },
    { month: '2026-09', payment: 0 }, { month: '2026-10', payment: 10 },
  ])
})
