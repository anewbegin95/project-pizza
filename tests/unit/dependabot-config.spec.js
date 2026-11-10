/**
 * Dependency automation (issue #441).
 *
 * Until #441, all three pieces of dependency automation were inert: the
 * auto-merge workflow sat one directory above `.github/workflows/` and never
 * loaded, `sanity/` (the only production dependencies) had no version-update
 * entry, and every major update was ignored forever. Dependabot also targeted
 * `main` only, so `staging` drifted until a release; that drift is how a
 * React split reached `main` and froze it for eight days (#463).
 *
 * The design these tests hold in place:
 * - Version updates land on `staging`, where the full gate runs, never `main`.
 *   (Security updates still go to `main`; Dependabot doesn't let them be
 *   retargeted.)
 * - Minor and patch updates are grouped into one PR per directory and
 *   auto-merged once that gate is green. Majors arrive as individual PRs for a
 *   person to review.
 * - Each directory runs on its own day. `staging` requires PRs to be up to
 *   date, so two grouped PRs opened at once would leave the second stuck
 *   behind the first.
 */
const fs = require('node:fs')
const path = require('node:path')
const yaml = require('js-yaml')

const root = path.resolve(__dirname, '..', '..')
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8')
const AUTO_MERGE = '.github/workflows/dependabot-auto-merge.yml'

describe('Dependabot configuration', () => {
  const config = yaml.load(read('.github/dependabot.yml'))
  const entries = config.updates
  const npm = (directory) =>
    entries.find((entry) => entry['package-ecosystem'] === 'npm' && entry.directory === directory)

  it('covers both npm workspaces and the workflow actions', () => {
    expect(npm('/')).toBeDefined()
    expect(npm('/sanity')).toBeDefined()
    expect(entries.find((entry) => entry['package-ecosystem'] === 'github-actions')).toBeDefined()
  })

  it('targets staging with every version update', () => {
    expect(entries.map((entry) => entry['target-branch'])).toEqual(entries.map(() => 'staging'))
  })

  it('groups minor and patch updates, and leaves majors out of the group', () => {
    for (const entry of entries) {
      const groups = Object.values(entry.groups || {})
      expect(groups, `${entry['package-ecosystem']} ${entry.directory}`).toHaveLength(1)
      expect([...groups[0]['update-types']].sort()).toEqual(['minor', 'patch'])
    }
  })

  it('no longer ignores every major update forever', () => {
    const blanketMajorIgnore = entries.some((entry) =>
      (entry.ignore || []).some(
        (rule) =>
          rule['dependency-name'] === '*' &&
          (rule['update-types'] || []).includes('version-update:semver-major'),
      ),
    )
    expect(blanketMajorIgnore).toBe(false)
  })

  it('runs each directory on a different day so grouped PRs never race', () => {
    const days = entries.map((entry) => entry.schedule && entry.schedule.day)
    expect(days.every(Boolean)).toBe(true)
    expect(new Set(days).size).toBe(days.length)
  })
})

describe('Dependabot auto-merge workflow', () => {
  it('lives where GitHub loads workflows', () => {
    expect(fs.existsSync(path.join(root, AUTO_MERGE))).toBe(true)
    expect(fs.existsSync(path.join(root, '.github/dependabot-auto-merge.yml'))).toBe(false)
  })

  // Everything below needs the file; guard so a missing file fails above, once.
  const source = fs.existsSync(path.join(root, AUTO_MERGE)) ? read(AUTO_MERGE) : ''
  const workflow = source ? yaml.load(source) : { on: {}, jobs: {} }
  const jobs = Object.values(workflow.jobs || {})
  const steps = jobs.flatMap((job) => job.steps || [])
  const shell = steps.map((step) => step.run || '').join('\n')
  const conditions = [...jobs.map((job) => job.if || ''), ...steps.map((step) => step.if || '')].join('\n')

  it('runs on pull_request, never pull_request_target', () => {
    // pull_request_target runs with a write token and secrets in the base
    // repository's context. Dependabot PRs get what they need from
    // pull_request plus an explicit permissions block.
    expect(Object.keys(workflow.on || {})).toEqual(['pull_request'])
  })

  it('acts only on Dependabot PRs into staging', () => {
    expect(workflow.on.pull_request && workflow.on.pull_request.branches).toEqual(['staging'])
    expect(jobs).toHaveLength(1)
    expect(jobs[0].if).toMatch(/github\.event\.pull_request\.user\.login == 'dependabot\[bot\]'/)
  })

  it('auto-merges minor and patch updates only', () => {
    expect(conditions).toMatch(/version-update:semver-patch/)
    expect(conditions).toMatch(/version-update:semver-minor/)
    expect(conditions).not.toMatch(/version-update:semver-major/)
  })

  it('refuses when a package changed maintainers', () => {
    expect(conditions).toMatch(/maintainer-changes\s*!=\s*'true'/)
  })

  it('merges with a merge commit, through the required checks', () => {
    expect(shell).toMatch(/gh pr merge --auto --merge "\$PR_URL"/)
  })

  it('never interpolates expressions into the shell', () => {
    expect(shell).not.toMatch(/\$\{\{/)
  })

  it('asks for exactly the permissions it needs', () => {
    expect(workflow.permissions).toEqual({ contents: 'write', 'pull-requests': 'write' })
  })
})

describe('Dependency hygiene', () => {
  const rootPackage = JSON.parse(read('package.json'))
  const sanityPackage = JSON.parse(read('sanity/package.json'))

  // Overrides force a version past what a package declares, so each one must
  // still earn its place. Checked 2026-10-23: `basic-ftp` resolved nothing,
  // and the `minimatch` ReDoS fix (GHSA-3ppc-4f35-3m26) has been backported
  // to the 3.x and 9.x lines that eslint, rimraf and tmp declare, so forcing
  // 10.x on them protected nothing. Adding an override means adding it here,
  // with the advisory or bug it answers.
  //
  // `tests/unit/dependency-overrides.spec.js` holds the resolution check for
  // every entry below -- what each one actually resolves to in the committed
  // lockfiles -- and the retirement condition for each. This test is the
  // inventory: nothing more than these, and nothing undocumented.
  //
  // `esbuild` (GHSA-gv7w-rqvm-qjhr, high): `vite` 7.3.5 declared `^0.27.0`,
  // locking in a vulnerable 0.27.7 nested copy (9df6e5b).
  //
  // `undici` answers eight advisories fixed in 7.30.1, GHSA-2m5v-pch6-74hx
  // (TLS certificate validation bypass, high) among them. It is unreachable
  // without the override: `@module-federation/dts-plugin`, pulled in through
  // `sanity` -> `@module-federation/vite`, declares `undici 7.29.1` as an
  // exact version, and no lockfile-only update passes an exact pin -- so
  // Dependabot proposed nothing while the alerts stayed open at runtime
  // scope. Retire it once dts-plugin declares a range that admits 7.30.1.
  //
  // `minimatch` (GHSA-g3hv-75wg-m249, glob-parts amplification DoS, fixed in
  // 11.0.1) is in BOTH workspaces, because a caret range stops at the next
  // major and every declarer holding a vulnerable copy is on one: root `glob`
  // declares `^10.2.2`, `@oclif/core` `^10.2.5`, `typescript-eslint`'s
  // `typescript-estree` `^9.0.5`. Note this is a different advisory from the
  // ReDoS the override removed above answered -- 10.x is inside this one's
  // range, which is how that pin came to hold the tree below a fix.
  //
  // `qs` (GHSA-6pq8-jhm2-2vcw, uncaught TypeError in `stringify`, fixed in
  // 6.16.1): #489 bumped express into `~6.16.0` and moved its nested copy,
  // but `body-parser` declares `qs ~6.15.1` -- a tilde, capped at 6.15.x --
  // so that copy could not follow. Root only; `sanity/` has no qs.
  it('carries only overrides that still answer something', () => {
    expect(Object.keys(rootPackage.overrides || {})).toEqual(['minimatch', 'qs'])
    expect(Object.keys(sanityPackage.overrides || {})).toEqual(['esbuild', 'minimatch', 'undici'])
  })

  it('audits the root workspace, not only sanity/', () => {
    const security = yaml.load(read('.github/workflows/security-ci.yml'))
    const auditSteps = Object.values(security.jobs)
      .flatMap((job) => (job.steps || []).map((step) => ({ step, job })))
      .filter(({ step }) => /npm audit/.test(step.run || ''))
    const directory = ({ step, job }) =>
      step['working-directory'] || (job.defaults && job.defaults.run && job.defaults.run['working-directory']) || '.'
    const rootAudit = auditSteps.find((found) => directory(found) === '.')
    expect(rootAudit, 'an npm audit step running in the repository root').toBeDefined()
    expect(rootAudit.step.run).toMatch(/npm audit --audit-level=critical/)
  })
})
