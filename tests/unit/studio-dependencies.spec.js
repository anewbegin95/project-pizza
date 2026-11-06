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

function allVersionsOf(name) {
  const suffix = `node_modules/${name}`
  return Object.entries(lockfile.packages)
    .filter(([key]) => key === suffix || key.endsWith(`/${suffix}`))
    .map(([key, entry]) => ({ key, version: entry.version }))
}

function atLeast(version, floor) {
  const a = version.split('.').map(Number)
  const b = floor.split('.').map(Number)
  for (let i = 0; i < 3; i += 1) {
    if (a[i] !== b[i]) return a[i] > b[i]
  }
  return true
}

describe('Sanity Studio dependencies', () => {
  it('installs react and react-dom at exactly the same version', () => {
    expect(installed('react')).toBeDefined()
    expect(installed('react-dom')).toBe(installed('react'))
  })

  /**
   * undici reaches the Studio only transitively, through
   * `sanity` -> `@module-federation/vite` -> `@module-federation/dts-plugin`,
   * which declares `undici 7.29.1` as an EXACT version. No lockfile-only
   * update can move past an exact pin, so Dependabot proposes nothing and the
   * eight advisories fixed in 7.30.1 stayed open with no PR to merge --
   * among them GHSA-2m5v-pch6-74hx, a TLS certificate validation bypass, at
   * runtime scope because the path runs through a production dependency.
   *
   * `sanity/package.json` carries an `overrides` entry to force it. JSON takes
   * no comments, so this test is where the reason lives.
   *
   * Drop the override (and this test) once `dts-plugin` ships a range that
   * admits 7.30.1 on its own. An override that outlives its purpose is worse
   * than none: the `minimatch` one removed in #441 had come to pin 10.x, which
   * sits INSIDE the vulnerable range of a later advisory, so it held the
   * Studio below the fix rather than above it.
   */
  it('resolves every copy of undici to a patched version', () => {
    const copies = allVersionsOf('undici')
    expect(copies.length).toBeGreaterThan(0)
    const unpatched = copies.filter((c) => !atLeast(c.version, '7.30.1'))
    expect(unpatched).toEqual([])
  })
})
