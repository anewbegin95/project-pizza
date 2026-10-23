/**
 * Rollback Main workflow (issue #464).
 *
 * `main` requires a pull request and enforces it for admins, so the old
 * workflow's `git push origin main` was always rejected. It was the incident
 * runbook's main tool and had never been run. It now reverts onto a
 * `rollback/` branch and hands a person a one-click link to open the PR.
 * A PR opened by a person triggers `main`'s required checks the normal way;
 * one opened with GITHUB_TOKEN would trigger none of them, and creating one
 * would also need "Allow GitHub Actions to create and approve pull requests",
 * which stays off.
 */
const fs = require('node:fs')
const path = require('node:path')

const workflow = fs.readFileSync(
  path.resolve(__dirname, '..', '..', '.github', 'workflows', 'rollback-main.yml'),
  'utf8',
)

// The shell that actually runs: every `run:` block, joined. Block scalars
// (`run: |`) continue until indentation drops back to the `run:` key's level.
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

describe('Rollback Main workflow', () => {
  const shell = runScripts(workflow)

  it('finds the shell it is checking', () => {
    expect(shell).toMatch(/git revert/)
  })

  it('never pushes to main', () => {
    expect(shell).not.toMatch(/git push\b[^\n]*\bmain\b/)
  })

  it('reverts onto a rollback/ branch cut from main and pushes that', () => {
    expect(shell).toMatch(/rollback\//)
    expect(shell).toMatch(/git (?:switch|checkout) (?:-c|-b) "\$\{?BRANCH\}?" origin\/main/)
    expect(shell).toMatch(/git push (?:-u )?origin "\$\{?BRANCH\}?"/)
  })

  it('keeps first-parent reverts for merge commits', () => {
    expect(shell).toMatch(/git revert -m 1/)
  })

  it('refuses a SHA that is malformed or not on main', () => {
    expect(shell).toMatch(/\[0-9a-f\]\{7,40\}/)
    expect(shell).toMatch(/git merge-base --is-ancestor "\$\{?TARGET_SHA\}?" origin\/main/)
  })

  it('never interpolates the input into a shell script', () => {
    // `${{ ... }}` in a run block is pasted in before the shell parses it.
    expect(shell).not.toMatch(/\$\{\{[^}]*inputs/)
    expect(workflow).toMatch(/TARGET_SHA:\s*\$\{\{\s*(?:github\.event\.)?inputs\.commit_sha\s*\}\}/)
  })

  it('hands the person running it a link to open the PR', () => {
    expect(shell).toMatch(/GITHUB_STEP_SUMMARY/)
    expect(shell).toMatch(/compare\/main\.\.\.\$\{?BRANCH\}?/)
  })

  it('asks for nothing beyond pushing a branch', () => {
    const permissions = workflow.match(/^permissions:\n((?:\s{2}.+\n)+)/m)
    expect(permissions).not.toBeNull()
    expect(permissions[1].trim().split('\n').map((line) => line.trim())).toEqual(['contents: write'])
  })
})
