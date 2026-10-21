import test, { before, after } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'

let server
before(async () => { server = await createServer({ server: { middlewareMode: true }, appType: 'custom' }) })
after(async () => { await server?.close() })

test('grant sections keep every field inside its own collapsible group', async () => {
  const { default: Sections } = await server.ssrLoadModule('/src/components/GrantSections.jsx')
  const marker = title => React.createElement('div', { sectionMarker: true, title, key: title })
  const html = renderToStaticMarkup(React.createElement(Sections, null,
    marker('Basic'), React.createElement('input', { name: 'supplier', key: 'supplier' }),
    marker('Financial'), React.createElement('input', { name: 'amount', key: 'amount' })))
  assert.equal((html.match(/<details/g) || []).length, 2)
  assert.equal((html.match(/ open=""/g) || []).length, 1)
  assert.ok(html.indexOf('name="supplier"') < html.indexOf('Financial'))
  assert.ok(html.indexOf('name="amount"') > html.indexOf('Financial'))
})
test('completion includes numeric zero and reports unsaved changes', async () => {
  const { default: Progress } = await server.ssrLoadModule('/src/components/FormProgress.jsx')
  const html = renderToStaticMarkup(React.createElement(Progress, { form: { country: 'Canada', chapter: 'IDF', grant_number: '0', project_type: 'Expansion', supplier: 'A', item: 'B' }, dirty: true }))
  assert.match(html, /6 of 6 complete/)
  assert.match(html, /Unsaved changes/)
  assert.match(html, /<progress/)
})
