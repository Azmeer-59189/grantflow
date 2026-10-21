import test from 'node:test'
import assert from 'node:assert/strict'
import { sortRecords, paginateRecords } from '../src/lib/records.js'

test('amounts sort numerically without mutating the source', () => {
  const rows = [{ grant_number: 'A', total_grant_amount_usd: 100 }, { grant_number: 'B', total_grant_amount_usd: 9 }]
  assert.deepEqual(sortRecords(rows, 'total_grant_amount_usd').map(row => row.grant_number), ['B', 'A'])
  assert.equal(rows[0].grant_number, 'A')
  assert.deepEqual(sortRecords(rows, 'total_grant_amount_usd', 'desc').map(row => row.grant_number), ['A', 'B'])
})
test('grant identifiers sort naturally and ties are stable across pages', () => {
  const rows = [{ grant_number: 'Grant-10', supplier: 'same' }, { grant_number: 'Grant-2', supplier: 'same' }]
  assert.equal(sortRecords(rows, 'grant_number')[0].grant_number, 'Grant-2')
  assert.equal(sortRecords(rows, 'supplier')[0].grant_number, 'Grant-2')
})
test('pagination clamps pages after filters reduce the result count', () => {
  const rows = Array.from({ length: 12 }, (_, index) => ({ grant_number: index }))
  const page = paginateRecords(rows, 9, 10)
  assert.equal(page.page, 2)
  assert.equal(page.start, 11)
  assert.equal(page.end, 12)
  assert.equal(page.rows.length, 2)
})
test('empty results produce an accessible empty first page', () => {
  assert.deepEqual(paginateRecords([], 5, 25), { rows: [], page: 1, pages: 1, start: 0, end: 0 })
})
test('pagination includes every row once', () => {
  const rows = Array.from({ length: 27 }, (_, id) => ({ grant_number: id }))
  const all = [1, 2, 3].flatMap(page => paginateRecords(rows, page, 10).rows)
  assert.deepEqual(all, rows)
})
