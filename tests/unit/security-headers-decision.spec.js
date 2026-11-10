/**
 * Production security headers (issue #433).
 *
 * `_headers` is only read by hosts such as Netlify and Cloudflare Pages. The
 * site is branch-served GitHub Pages, so none of it is ever sent: HSTS,
 * X-Frame-Options, nosniff, Permissions-Policy and the cache lifetimes are all
 * absent from live responses, and only the <meta> CSP applies. That was a
 * warning comment in `_headers` that nobody had closed the loop on.
 *
 * This keeps the loop closed. Every header the file declares has to be
 * accounted for in the written decision in `.github/SECURITY.md`, so a header
 * cannot be added to a file production ignores without someone deciding what
 * that means.
 */
const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..', '..')
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')

const headersFile = read('_headers')
const security = read('.github/SECURITY.md')

/** Header names declared in the file, ignoring the leading doc comment. */
function declaredHeaders(source) {
  const body = source.replace(/\/\*\*[\s\S]*?\*\//, '')
  const names = new Set()
  body.split('\n').forEach((line) => {
    const match = line.match(/^\s+([A-Za-z][A-Za-z-]+):\s/)
    if (match) names.add(match[1])
  })
  return [...names]
}

/** The "Response headers" section of SECURITY.md, up to the next H2. */
function decisionSection(source) {
  const start = source.search(/^## Response headers/m)
  if (start === -1) return ''
  const rest = source.slice(start + 3)
  const next = rest.search(/^## /m)
  return next === -1 ? rest : rest.slice(0, next)
}

describe('_headers declares what this test expects to find', () => {
  it('finds the headers it is meant to check', () => {
    const names = declaredHeaders(headersFile)
    expect(names).toContain('Strict-Transport-Security')
    expect(names).toContain('X-Frame-Options')
    expect(names).toContain('Cache-Control')
  })
})

describe('SECURITY.md records the decision', () => {
  const section = decisionSection(security)

  it('has a Response headers section', () => {
    expect(section).not.toBe('')
  })

  it('names the hosting reality and the chosen path', () => {
    expect(section).toMatch(/GitHub Pages/)
    expect(section).toMatch(/\*\*Decision:/)
  })

  it('names the upgrade path, with the date the live headers were last checked', () => {
    expect(section).toMatch(/Cloudflare/)
    expect(section).toMatch(/Verified \d{4}-\d{2}-\d{2}/)
  })

  declaredHeaders(headersFile).forEach((name) => {
    it(`accounts for ${name}`, () => {
      expect(section).toContain(name)
    })
  })

  it('accounts for frame-ancestors, which a <meta> CSP cannot carry', () => {
    expect(section).toContain('frame-ancestors')
  })
})

describe('_headers says it is inert here', () => {
  const comment = headersFile.match(/\/\*\*[\s\S]*?\*\//)[0]

  it('states that production does not serve it and points at the decision', () => {
    expect(comment).toMatch(/GitHub Pages/)
    expect(comment).toMatch(/not (?:served|emitted|sent)/i)
    expect(comment).toContain('.github/SECURITY.md')
  })
})

describe('csp.spec.js says it tests a file production does not serve', () => {
  it('carries the note', () => {
    expect(read('tests/unit/csp.spec.js')).toMatch(/does not serve `_headers`|never served by production/)
  })
})
