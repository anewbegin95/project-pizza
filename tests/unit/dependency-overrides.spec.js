/**
 * What each `overrides` entry actually resolves to, in both workspaces.
 *
 * An override forces a version past what some package declares, so it is a
 * standing claim that the tree is safe. Nothing else checks that claim: npm
 * will happily keep an override that resolves to a version inside a LATER
 * advisory's vulnerable range, which is exactly what the `minimatch` override
 * removed in #441 had come to do -- it pinned 10.x to answer a ReDoS, and
 * 10.x sits inside the range of GHSA-g3hv-75wg-m249, which came later. It
 * held the tree below that fix while still looking like protection.
 *
 * `tests/unit/dependabot-config.spec.js` owns the inventory (which overrides
 * exist, and the advisory each one answers). This file owns the resolution:
 * given the lockfiles as committed, is any copy still vulnerable? Add a case
 * here whenever an override goes in, and delete it when the override retires.
 *
 * The assertions are written as "no copy inside the vulnerable range" rather
 * than "every copy at or above the fix", because a tree can be safe without
 * the override: the `^3.1.2` declarers of minimatch resolve 3.1.5, below the
 * range entirely. Phrasing it as the range means this file keeps telling the
 * truth after an override is retired, instead of failing for the wrong reason.
 */
const fs = require('node:fs')
const path = require('node:path')

const repoRoot = path.resolve(__dirname, '..', '..')

function lockfile(...segments) {
  return JSON.parse(fs.readFileSync(path.resolve(repoRoot, ...segments, 'package-lock.json'), 'utf8'))
}

const locks = {
  root: lockfile('.'),
  sanity: lockfile('sanity'),
}

/** Every copy of `name` in a lockfile, hoisted or nested. */
function copiesOf(lock, name) {
  const suffix = `node_modules/${name}`
  return Object.entries(lock.packages)
    .filter(([key]) => key === suffix || key.endsWith(`/${suffix}`))
    .map(([key, entry]) => ({ key, version: entry.version }))
}

/** -1, 0 or 1. Release versions only; nothing here ships a prerelease. */
function compare(a, b) {
  const left = a.split('.').map(Number)
  const right = b.split('.').map(Number)
  for (let i = 0; i < 3; i += 1) {
    const diff = (left[i] || 0) - (right[i] || 0)
    if (diff !== 0) return diff > 0 ? 1 : -1
  }
  return 0
}

/** Copies that fall within an advisory's vulnerable range, inclusive. */
function vulnerable(lock, name, { atOrAbove, atOrBelow }) {
  return copiesOf(lock, name).filter(
    (copy) => compare(copy.version, atOrAbove) >= 0 && compare(copy.version, atOrBelow) <= 0,
  )
}

describe('Dependency override resolution', () => {
  /**
   * GHSA-g3hv-75wg-m249 -- denial of service by glob-parts amplification
   * (CWE-405), fixed in 11.0.1, vulnerable from 7.0.0. Not the ReDoS the
   * retired override answered; a different advisory against the same package,
   * which is how 10.x ended up both pinned and vulnerable.
   *
   * Three declarers hold copies inside the range and none can reach
   * the fix on its own, because a caret range stops at the next major:
   * root `glob` declares `^10.2.2`, and in `sanity/` `@oclif/core` declares
   * `^10.2.5` while `@typescript-eslint/typescript-estree` declares `^9.0.5`.
   * So Dependabot has nothing to propose and the alerts sit open.
   *
   * The override is in BOTH `package.json` files and is deliberately broad:
   * it also lifts the `^3.1.2` declarers (eslint, rimraf, tmp and the eslint
   * plugins) eight majors, from a 3.1.5 that was never vulnerable. That is
   * the cost of npm's flat override syntax -- it cannot say "only the 10.x
   * copies". Verified it holds: `npx eslint .` in `sanity/` passes under
   * 11.x, and the Studio builds.
   *
   * Retire it, and this case, once glob, @oclif/core and typescript-estree
   * all declare ranges that admit 11.0.1.
   */
  it('leaves no copy of minimatch inside the amplification DoS range', () => {
    const range = { atOrAbove: '7.0.0', atOrBelow: '11.0.0' }
    expect(copiesOf(locks.root, 'minimatch').length).toBeGreaterThan(0)
    expect(copiesOf(locks.sanity, 'minimatch').length).toBeGreaterThan(0)
    expect(vulnerable(locks.root, 'minimatch', range)).toEqual([])
    expect(vulnerable(locks.sanity, 'minimatch', range)).toEqual([])
  })

  /**
   * GHSA-6pq8-jhm2-2vcw -- `qs.stringify` with `arrayFormat: 'comma'` throws
   * an uncaught TypeError on an array element whose own `toString` is not
   * callable (denial of service, CVSS 5.3), fixed in 6.16.1, vulnerable from
   * 6.7.0. #489 moved express's own nested copy by bumping express into
   * `~6.16.0`, but `body-parser` declares `qs ~6.15.1` -- a tilde, capped at
   * 6.15.x -- so its copy stayed at 6.15.2 and the alert stayed open.
   *
   * Root workspace only; `sanity/` has no copy of qs.
   *
   * Retire this and the override once body-parser declares a range that
   * admits 6.16.1.
   */
  it('leaves no copy of qs inside the stringify DoS range', () => {
    const range = { atOrAbove: '6.7.0', atOrBelow: '6.16.0' }
    expect(copiesOf(locks.root, 'qs').length).toBeGreaterThan(0)
    expect(vulnerable(locks.root, 'qs', range)).toEqual([])
  })

  /**
   * undici: eight advisories fixed in 7.30.1, GHSA-2m5v-pch6-74hx (TLS
   * certificate validation bypass, high) among them. Unreachable without the
   * override, because `@module-federation/dts-plugin` -- pulled in through
   * `sanity` -> `@module-federation/vite` -- declares `undici 7.29.1` as an
   * EXACT version, and no lockfile-only update passes an exact pin. Runtime
   * scope, since the path runs through a production dependency.
   *
   * Retire it once dts-plugin ships a range that admits 7.30.1.
   */
  it('leaves no copy of undici below the patched version', () => {
    const copies = copiesOf(locks.sanity, 'undici')
    expect(copies.length).toBeGreaterThan(0)
    expect(copies.filter((copy) => compare(copy.version, '7.30.1') < 0)).toEqual([])
  })

  /**
   * esbuild: GHSA-gv7w-rqvm-qjhr (high). `vite` 7.3.5 declared `^0.27.0`, so
   * the vulnerable 0.27.7 was locked in as a nested copy with no bump able to
   * reach past it (9df6e5b). The floor is a `>=` rather than a caret because
   * the point was to escape a major, not to track one.
   *
   * Retire it once nothing in `sanity/` declares an esbuild range below
   * 0.28.1.
   */
  it('keeps every copy of esbuild at the override floor', () => {
    const copies = copiesOf(locks.sanity, 'esbuild')
    expect(copies.length).toBeGreaterThan(0)
    expect(copies.filter((copy) => compare(copy.version, '0.28.1') < 0)).toEqual([])
  })
})
