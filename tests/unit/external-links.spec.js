/**
 * Issue #432: every link that opens a new tab must carry rel="noopener".
 * Without it the opened page gets a window.opener handle. Reads the markup rather than a rendered DOM, so the partials are
 * covered too: they are injected at runtime and never appear in the page files.
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(__dirname, '../..')
const files = [
  ...fs.readdirSync(root).filter((name) => name.endsWith('.html')),
  ...fs.readdirSync(path.join(root, 'partials')).map((name) => `partials/${name}`),
]

describe('target="_blank" links', () => {
  it('finds the files it is meant to scan', () => {
    expect(files.length).toBeGreaterThanOrEqual(12)
  })

  files.forEach((file) => {
    it(`${file} opens no new tab without rel="noopener"`, () => {
      const html = fs.readFileSync(path.join(root, file), 'utf8')
      const anchors = html.match(/<a\b[^>]*>/g) || []
      const offenders = anchors.filter(
        (tag) => /target=["']_blank["']/.test(tag) && !/rel=["'][^"']*\bnoopener\b/.test(tag)
      )
      expect(offenders).toEqual([])
    })
  })
})
