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
   * js-yaml, the 3.x line: five advisories against the copy `@vercel/frameworks`
   * holds, the widest being GHSA-2883-xcg3-v3hh (`maxTotalMergeKeys` does not
   * limit CPU use for empty merge sources, high, fixed in 3.15.2). The others
   * -- GHSA-5p4m-2wfm-xmqj, GHSA-52cp-r559-cp3m, GHSA-h67p-54hq-rp68 and
   * GHSA-mh29-5h37-fv8m -- all fix at or below 3.15.2, so one floor clears
   * them. Runtime scope: the path runs through a production dependency.
   *
   * `@vercel/frameworks` declares `js-yaml 3.13.1` as an EXACT version, and no
   * lockfile-only update passes an exact pin, so Dependabot proposed nothing.
   *
   * The override is SCOPED to `@vercel/frameworks` rather than flat, because
   * this workspace holds two js-yaml lines that need different majors: a flat
   * `^3.15.2` would drag the hoisted 4.x copy back a major, and a flat
   * `^4.3.2` would push `@vercel/frameworks` across the 3->4 break (4.x
   * dropped `safeLoad`/`safeDump` and changed the default schema) to satisfy
   * an advisory that has a 3.x fix.
   *
   * The floor is expressed as "nothing at or below 3.15.1" with no lower
   * bound, which also covers the two advisories whose ranges are unbounded
   * below (`< 3.15.0`, `< 3.14.2`). A 4.x copy is above this ceiling and so
   * is unaffected by this case; the next one owns it.
   *
   * Retire this and the override once `@vercel/frameworks` declares a range
   * that admits 3.15.2.
   */
  it('leaves no copy of js-yaml in the 3.x merge-key DoS range', () => {
    const range = { atOrAbove: '0.0.0', atOrBelow: '3.15.1' }
    expect(copiesOf(locks.sanity, 'js-yaml').length).toBeGreaterThan(0)
    expect(vulnerable(locks.sanity, 'js-yaml', range)).toEqual([])
  })

  /**
   * js-yaml, the 4.x line: the same four-advisory pile against the hoisted
   * copy, widest again GHSA-2883-xcg3-v3hh (`>= 4.0.0, < 4.3.2`), then
   * GHSA-5p4m-2wfm-xmqj, GHSA-52cp-r559-cp3m and GHSA-h67p-54hq-rp68.
   * Development scope.
   *
   * There is NO override for this one, deliberately. `@eslint/eslintrc`
   * declares `^4.1.1`, and 4.3.2 satisfies that range, so the fix is reachable
   * by a plain lockfile update -- an override here would be a standing pin
   * answering a problem `npm update` solves, which is how the `minimatch` pin
   * removed in #441 came to hold the tree below a later fix.
   *
   * Dependabot had not proposed it because PR #336 (js-yaml 4.1.1 -> 4.3.0 in
   * `/sanity`, based on `main`) was closed on 2026-07-08, which suppresses a
   * version. The lockfile update was taken directly instead.
   *
   * This case has no retirement condition: it is not guarding an override,
   * it is pinning the floor the lockfile was moved to, and it should outlive
   * any override in this file.
   */
  it('leaves no copy of js-yaml in the 4.x merge-key DoS range', () => {
    const range = { atOrAbove: '4.0.0', atOrBelow: '4.3.1' }
    expect(copiesOf(locks.sanity, 'js-yaml').length).toBeGreaterThan(0)
    expect(vulnerable(locks.sanity, 'js-yaml', range)).toEqual([])
  })

  /**
   * smol-toml: three advisories, widest GHSA-r4xh-jqrq-34v2 (quadratic-time
   * `parse()` from `parseKey` rescanning to end of document, medium, fixed in
   * 1.9.0), plus GHSA-7w5x-hrqm-74c2 (`<= 1.7.0`) and GHSA-v3rj-xjv7-4jmq
   * (`< 1.6.1`). Runtime scope. One floor at 1.9.0 clears all three.
   *
   * Two copies, only one of which needed the override. `@vercel/frameworks`
   * declares `smol-toml 1.5.2` as an EXACT version -- hence the scoped
   * override, alongside its js-yaml. The hoisted copy was at 1.8.0 under
   * `@sanity/cli`'s `^1.6.1`, which admits 1.9.0, so that one moved by
   * lockfile update and got no override, for the same reason js-yaml 4.x
   * did not.
   *
   * Retire the override and fold this case down to the hoisted copy once
   * `@vercel/frameworks` declares a range that admits 1.9.0.
   */
  it('leaves no copy of smol-toml inside the parse DoS range', () => {
    const range = { atOrAbove: '0.0.0', atOrBelow: '1.8.0' }
    expect(copiesOf(locks.sanity, 'smol-toml').length).toBeGreaterThan(0)
    expect(vulnerable(locks.sanity, 'smol-toml', range)).toEqual([])
  })
})
