# Branch Protection Required Checks

This document defines the recommended required status checks for GitHub branch protection rules.

## Why this matters

Branch protection must match workflow **job names** exactly. If names are wrong or incomplete, merges may bypass intended quality gates or be blocked unexpectedly.

## `staging` branch (integration gate)

Create/update branch protection for `staging` and mark these checks as required:

- Build verification
- CSS/HTML lint + unit tests
- Broken link and missing asset check
- Lighthouse CI
- E2E smoke tests
- Sanity Lint + npm audit
- Secret scan (Gitleaks)
- Review dependency changes

### Optional check

- Snyk (optional)

Only mark this as required if `SNYK_TOKEN` is configured and expected for all PR contexts. Otherwise, keep it non-required.

## `main` branch (production gate)

Create/update branch protection for `main` and mark these checks as required:

- Pre-deploy checks
- Sanity Lint + npm audit
- Secret scan (Gitleaks)
- Review dependency changes

`Pre-deploy checks` was listed here long before the live rule had it. Until
2026-10-23 (#461) `main` gated only on the three security checks, so the unit,
e2e and Studio-build suite never blocked a merge to production. Compare the
live rule against this list whenever you touch either one:

```bash
gh api repos/anewbegin95/project-pizza/branches/main/protection \
  -q '[.required_status_checks.checks[].context] | sort | join("\n")'
```

### Optional check

- Snyk (optional)

Only mark this as required if `SNYK_TOKEN` is configured and expected for all PR contexts.

## Notes on deploy health check

- `Deployment status + health check` runs on `push` to `main` (post-merge), not PRs.
- Because it does not run on PR events, it should be monitored as a post-merge deployment gate, not as a PR required check.

## Notes on security audit scope

Three gates, deliberately at different floors (#441):

| Gate | Scope | Blocks at |
|---|---|---|
| `Review dependency changes` | packages a PR **adds or changes** | high |
| `Sanity Lint + npm audit`, sanity step | `sanity/` production deps already in the tree | critical |
| `Sanity Lint + npm audit`, root step | root workspace, dev tooling included | critical |

The tree audits stay at critical because `sanity/`'s production tree carries
high advisories (undici and others) that only clear with a breaking Sanity
change. `npm audit fix --force` wants `sanity@5.14.1`. At high, every PR would
fail on debt no PR caused. Dependency review still stops a PR from *adding* a
high. Raise the tree floors to high when the Sanity tree clears it.

## Rules beyond required checks

Set on both `main` and `staging` (#461):

- **Enforced for administrators** (`enforce_admins`). The maintainer can't
  merge past a red or pending check, or push straight to either branch. Sync
  `main` into `staging` on a branch with a PR, not a direct push.
- **Require branches to be up to date** (`strict`). A PR has to be rebased or
  merged with its base before it can merge.
- **Pull request required**, with **0 approvals**. GitHub doesn't let an author
  approve their own PR, so with one maintainer, any approval requirement would
  either block every PR or need a bypass that gets clicked every time.
  `.github/CODEOWNERS` requests the maintainer's review on every PR instead.
- Force pushes and branch deletion are off.

### Dependabot PRs

Two rules bite only Dependabot, and both look like something else when they do.

- **The `Access` ruleset blocks every Dependabot PR that targets `main`.** It
  sets `require_extra_approval_for_unattributed_changes`, so a PR authored by
  `dependabot[bot]` needs one approval even though the branch requires 0. The
  PR reports `BLOCKED` with every check green, which reads like a missing
  check. Rulesets are separate from classic branch protection and don't appear
  in the protection API — `gh api repos/anewbegin95/project-pizza/rules/branches/main`
  is the one that shows them. Admins hold an always-bypass. This is a reason to
  keep version updates on `staging`, where the ruleset doesn't apply.
- **Never click "Update branch" on a Dependabot PR.** It pushes a merge commit
  authored by the maintainer, and `dependabot/fetch-metadata` returns nothing
  unless every commit on the branch is Dependabot's — so the auto-merge job
  fails with `PR is not from Dependabot` and the PR can never auto-merge again.
  Comment `@dependabot rebase` instead: Dependabot re-pushes the branch under
  its own authorship and the job runs clean. `strict` makes this tempting,
  because every open Dependabot PR goes stale as soon as another one lands.

### Break glass

If production needs a revert and the gate can't go green (for example `Pre-deploy
checks` failing for an unrelated reason), lift admin enforcement just long
enough to land it, then put it back:

```bash
gh api -X DELETE repos/anewbegin95/project-pizza/branches/main/protection/enforce_admins
# git revert <sha> locally, then push to main as admin
gh api -X POST repos/anewbegin95/project-pizza/branches/main/protection/enforce_admins
```

`Rollback Main` doesn't help here: it produces a PR, and that PR needs the same green gate. See `docs/rollback-and-recovery.md`.

## Actions policy

Settings → Actions → General, set 2026-10-23 (#461):

- **Allowed actions:** GitHub-owned, plus `gitleaks/gitleaks-action@*`,
  `lycheeverse/lychee-action@*`, `snyk/actions/node@*` and
  `dependabot/fetch-metadata@*` (added for auto-merge, #441). Anything else
  fails at run time.
- **Every `uses:` is pinned to a full commit SHA**, with its release in a
  trailing comment (`@<sha> # v4.4.0`). Dependabot's `github-actions`
  ecosystem bumps both together.
- **`sha_pinning_required` is on** (since 2026-10-23, after #469 shipped the
  pins to `main`). An unpinned `uses:` fails at run time on any branch,
  including scheduled workflows on `main` and Dependabot branches cut before
  the pins landed. Rebase those with `@dependabot rebase`.

`tests/unit/workflow-actions.spec.js` checks both rules at PR time. To add an
action, update its `ALLOWED_ACTIONS` list and the repository setting in the
same PR.

Fork PRs: workflows from first-time contributors wait for approval, and every
PR-triggered workflow uses `pull_request`, never `pull_request_target`, so a
fork's code never runs with secrets.

## Interaction limits

Set to **collaborators only** on 2026-10-23, **expiring 2027-04-23**. Six
months is GitHub's maximum, so it has to be renewed by hand:

```bash
gh api -X PUT repos/anewbegin95/project-pizza/interaction-limits \
  -f limit=collaborators_only -f expiry=six_months
```

## Setup path in GitHub

For each branch (`staging`, `main`):

1. Repository Settings → Branches
2. Add/Edit branch protection rule
3. Enable required status checks
4. Select check names listed above
5. Save

## Maintenance

Whenever a workflow job name changes, update this document and branch protection rules in the same PR.
