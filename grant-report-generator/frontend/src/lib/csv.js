// Cells starting with these are run as formulas by Excel/Sheets; prefix them
// so exported text can never execute when the file is opened.
const FORMULA_START = /^[=+\-@\t\r]/

export function csvCell(value) {
  if (value === null || value === undefined) return ''
  let text = String(value)
  if (typeof value !== 'number' && FORMULA_START.test(text)) text = `'${text}`
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

export function toCsv(rows, columns) {
  const header = columns.map(column => csvCell(column.label)).join(',')
  const body = rows.map(row => columns.map(column => csvCell(row[column.key])).join(','))
  return [header, ...body].join('\r\n')
}

export function downloadCsv(filename, csv) {
  // BOM so Excel opens UTF-8 (currency symbols, accents) correctly.
  const url = URL.createObjectURL(new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}
