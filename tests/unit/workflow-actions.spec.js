/**
 * Workflow action pinning (issue #461).
 *
 * The repo's Actions policy is an allowlist (GitHub-owned plus three named
 * third-party actions), and `sha_pinning_required` is switched on once these
 * pins reach `main`. Both are enforced by GitHub at run time, where a miss
 * fails the job — including the scheduled workflows nobody is watching. This
 * file moves that failure to PR time.
 *
 * ALLOWED_ACTIONS mirrors Settings → Actions → General. Change both together,
 * and record the change in docs/branch-protection-checks.md.
 */
const fs = require('node:fs')
const path = require('node:path')

const projectRoot = path.resolve(__dirname, '..', '..')
const workflowsDir = path.join(projectRoot, '.github', 'workflows')

const ALLOWED_ACTIONS = [
  /^actions\//, // GitHub-owned
  /^github\//, // GitHub-owned
  /^gitleaks\/gitleaks-action$/,
  /^lycheeverse\/lychee-action$/,
  /^snyk\/actions\/node$/,
]

const USES_LINE = /^\s*(?:-\s*)?uses:\s*([^\s#]+)\s*(#.*)?$/

function collectUses() {
  return fs
    .readdirSync(workflowsDir)
    .filter((file) => /\.ya?ml$/.test(file))
    .flatMap((file) =>
      fs
        .readFileSync(path.join(workflowsDir, file), 'utf8')
        .split('\n')
        .map((line, index) => ({ line, where: `${file}:${index + 1}` }))
        .filter(({ line }) => USES_LINE.test(line))
        .map(({ line, where }) => {
          const [, ref, comment] = line.match(USES_LINE)
          const at = ref.lastIndexOf('@')
          return { where, action: ref.slice(0, at), version: ref.slice(at + 1), comment }
        }),
    )
}

describe('workflow actions', () => {
  const uses = collectUses()

  it('finds the workflows it is guarding', () => {
    // Guards against a parsing change that matches nothing and passes vacuously.
    expect(uses.length).toBeGreaterThanOrEqual(20)
  })

  it('pins every action to a full commit SHA', () => {
    const unpinned = uses
      .filter(({ version }) => !/^[0-9a-f]{40}$/.test(version))
      .map(({ where, action, version }) => `${where} ${action}@${version}`)
    expect(unpinned).toEqual([])
  })

  it('says which release each pin is, so a reviewer can read it', () => {
    const unlabelled = uses
      .filter(({ comment }) => !/^#\s*(v\d+(\.\d+){0,2}|master|main)\b/.test(comment || ''))
      .map(({ where, action }) => `${where} ${action}`)
    expect(unlabelled).toEqual([])
  })

  it('uses only actions on the repository allowlist', () => {
    const blocked = uses
      .filter(({ action }) => !ALLOWED_ACTIONS.some((pattern) => pattern.test(action)))
      .map(({ where, action }) => `${where} ${action}`)
    expect(blocked).toEqual([])
  })

  it('has Dependabot keep the pins current', () => {
    const dependabot = fs.readFileSync(path.join(projectRoot, '.github', 'dependabot.yml'), 'utf8')
    expect(dependabot).toMatch(/package-ecosystem:\s*["']?github-actions["']?/)
  })
})
