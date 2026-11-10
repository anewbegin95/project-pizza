/**
 * Refresh Static Event Listings workflow (issue #431).
 *
 * The old workflow pushed to `automation/refresh-static-events`, which nothing
 * ever merged: the branch ended up 209 commits ahead and 158 behind main while
 * every marker pair in pop-ups.html and date-ideas.html stayed empty in
 * production. The pipeline now lands through `staging` like any other change.
 *
 * It hands a person a link to open the PR rather than opening it itself, for
 * the same reasons as rollback-main.yml (#464): a PR opened with GITHUB_TOKEN
 * triggers none of staging's required checks, so it could never merge, and
 * creating one needs "Allow GitHub Actions to create and approve pull
 * requests", which stays off. A branch pushed with GITHUB_TOKEN also cannot
 * re-run checks on a later push, so each run gets its own branch.
 */
const fs = require('node:fs')
const path = require('node:path')

const workflowsDir = path.resolve(__dirname, '..', '..', '.github', 'workflows')
const read = (name) => fs.readFileSync(path.join(workflowsDir, name), 'utf8')

// Same helper as rollback-workflow.spec.js: the shell that actually runs.
function runScripts(source) {
  const lines = source.split('\n')
  const scripts = []
  lines.forEach((line, index) => {
    const match = line.match(/^(\s*)(?:-\s*)?run:\s*(.*)$/)
    if (!match) return
    const indent = match[1].length
    if (match[2] && match[2] !== '|' && match[2] !== '>') {
      scripts.push(match[2])
      return
    }
    for (let next = index + 1; next < lines.length; next += 1) {
      const body = lines[next]
      if (body.trim() && body.search(/\S/) <= indent) break
      scripts.push(body)
    }
  })
  return scripts.join('\n')
}

describe('Refresh Static Event Listings workflow', () => {
  const workflow = read('refresh-static-events.yml')
  const shell = runScripts(workflow)

  it('finds the shell it is checking', () => {
    expect(shell).toMatch(/prebuild-events\.js/)
  })

  it('starts from staging, not main', () => {
    expect(workflow).toMatch(/uses: actions\/checkout@[0-9a-f]{40}[^\n]*\n\s+with:\n\s+ref: staging/)
  })

  it('never pushes to main or staging directly', () => {
    expect(shell).not.toMatch(/git push\b[^\n]*\b(?:main|staging)\b/)
  })

  it('pushes a per-run automation branch and nothing that is reused across runs', () => {
    expect(shell).toMatch(/automation\/refresh-static-events-/)
    expect(shell).toMatch(/GITHUB_RUN_ID|date /)
    expect(shell).toMatch(/git push (?:-u )?origin "\$\{?BRANCH\}?"/)
  })

  it('links a pull request into staging in the run summary', () => {
    expect(shell).toMatch(/GITHUB_STEP_SUMMARY/)
    expect(shell).toMatch(/compare\/staging\.\.\.\$\{?BRANCH\}?/)
  })

  it('does not try to open the PR itself', () => {
    expect(workflow).not.toMatch(/peter-evans\/create-pull-request/)
    expect(shell).not.toMatch(/gh pr create/)
  })

  it('does not mark the commit [skip ci], so the PR a person opens runs the gate', () => {
    expect(shell).not.toMatch(/\[skip ci\]/)
  })

  it('stages sitemap.xml and llms.txt alongside the two pages', () => {
    const add = shell.match(/git add ([^\n]+)/)
    expect(add).not.toBeNull()
    expect(add[1]).toContain('pop-ups.html')
    expect(add[1]).toContain('date-ideas.html')
    expect(add[1]).toContain('sitemap.xml')
    expect(add[1]).toContain('llms.txt')
  })

  it('runs generate-llms-txt.js, which no workflow ran before', () => {
    expect(shell).toMatch(/node scripts\/generate-llms-txt\.js/)
  })

  it('installs nothing: both scripts use only https, fs and path', () => {
    expect(shell).not.toMatch(/npm (?:ci|install)/)
  })

  it('asks for nothing beyond pushing a branch', () => {
    const permissions = workflow.match(/^permissions:\n((?:\s{2}.+\n)+)/m)
    expect(permissions).not.toBeNull()
    expect(permissions[1].trim().split('\n').map((line) => line.trim())).toEqual(['contents: write'])
  })
})

describe('Geocode workflow', () => {
  it('installs nothing: geocode-popups.js uses only https, fs and path', () => {
    expect(runScripts(read('geocode-popups.yml'))).not.toMatch(/npm (?:ci|install)/)
  })
})

describe('the scripts those workflows run', () => {
  const scriptsDir = path.resolve(__dirname, '..', '..', 'scripts')

  // If one of these grows a dependency, the workflows above must install it again.
  ;['prebuild-events.js', 'generate-llms-txt.js', 'geocode-popups.js'].forEach((name) => {
    it(`${name} requires only node built-ins`, () => {
      const source = fs.readFileSync(path.join(scriptsDir, name), 'utf8')
      const required = [...source.matchAll(/require\(['"]([^'"]+)['"]\)/g)].map((match) => match[1])
      expect(required.length).toBeGreaterThan(0)
      required.forEach((id) => expect(['https', 'fs', 'path', 'node:https', 'node:fs', 'node:path']).toContain(id))
    })
  })
})
