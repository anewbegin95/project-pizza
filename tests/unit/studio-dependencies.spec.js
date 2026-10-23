/**
 * Sanity Studio dependency invariants (issue #463).
 *
 * Dependabot bumps packages in `sanity/` one at a time and only on `main`.
 * When `sanity` 6.15.0 landed there, the lockfile re-resolved `react` to
 * 19.3.0 and left `react-dom` at 19.2.7. The Studio refuses to build with
 * mismatched versions, and `main`'s gate stayed red for eight days before
 * anyone looked. This file reports the split at PR time instead.
 */
const fs = require('node:fs')
const path = require('node:path')

const lockfile = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '..', '..', 'sanity', 'package-lock.json'), 'utf8'),
)

function installed(name) {
  const entry = lockfile.packages[`node_modules/${name}`]
  return entry && entry.version
}

describe('Sanity Studio dependencies', () => {
  it('installs react and react-dom at exactly the same version', () => {
    expect(installed('react')).toBeDefined()
    expect(installed('react-dom')).toBe(installed('react'))
  })
})
