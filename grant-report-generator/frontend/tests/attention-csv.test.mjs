import test from 'node:test'
import assert from 'node:assert/strict'
import { attentionItems } from '../src/lib/attention.js'
import { csvCell, toCsv } from '../src/lib/csv.js'

const today = new Date('2026-10-21T00:00:00Z')

test('discrepancies come first, then overdue reports by age, then missing pictures', () => {
  const items = attentionItems([
    { grant_number: 'PICS', installation_date: '2026-09-01', pictures_status: '' },
    { grant_number: 'OLD', payment_date: '2026-01-01', report_status: 'Pending' },
    { grant_number: 'OLDER', payment_date: '2025-06-01', report_status: 'Incomplete Information' },
    { grant_number: 'SHIP', shipping_documents_status: 'Received with discrepancy' },
  ], today)
  assert.deepEqual(items.map(item => item.grant.grant_number), ['SHIP', 'OLDER', 'OLD', 'PICS'])
  assert.match(items[1].title, /^Paid \d+ days ago/)
})

test('finished or recent grants need no attention', () => {
  const items = attentionItems([
    { grant_number: 'DONE', payment_date: '2025-01-01', report_status: 'Complete' },
    { grant_number: 'RECENT', payment_date: '2026-10-01', report_status: 'Pending' },
    { grant_number: 'SERIAL', payment_date: '46280', report_status: 'Pending' },   // 15 Sep 2026
    { grant_number: 'PICTURED', installation_date: '2026-09-01', pictures_status: 'Not applicable' },
  ], today)
  assert.deepEqual(items, [])
})

test('CSV quotes commas, quotes and line breaks', () => {
  assert.equal(csvCell('plain'), 'plain')
  assert.equal(csvCell('a, b'), '"a, b"')
  assert.equal(csvCell('say "hi"'), '"say ""hi"""')
  assert.equal(csvCell('line\nbreak'), '"line\nbreak"')
  assert.equal(csvCell(null), '')
})

test('CSV cells can never run as spreadsheet formulas', () => {
  for (const attack of ['=HYPERLINK("http://x")', '+1+1', '-2+3', '@SUM(A1)']) {
    assert.ok(csvCell(attack).replace(/^"/, '').startsWith("'"), attack)
  }
  assert.equal(csvCell(-25), '-25')   // real negative numbers stay numbers
})

test('CSV has a header row and one line per grant', () => {
  const csv = toCsv([{ a: 1, b: 'x' }, { a: 2, b: 'y' }], [{ key: 'a', label: 'A' }, { key: 'b', label: 'B' }])
  assert.equal(csv, 'A,B\r\n1,x\r\n2,y')
})
