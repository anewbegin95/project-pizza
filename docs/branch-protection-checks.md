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

### Optional check

- Snyk (optional)

Only mark this as required if `SNYK_TOKEN` is configured and expected for all PR contexts.

## Notes on deploy health check

- `Deployment status + health check` runs on `push` to `main` (post-merge), not PRs.
- Because it does not run on PR events, it should be monitored as a post-merge deployment gate, not as a PR required check.

## Notes on security audit scope

- `Sanity Lint + npm audit` currently runs `npm audit --omit=dev --audit-level=critical`.
- This keeps merge-blocking focused on production dependency risk.
- Dev-tooling/transitive dependency vulnerabilities should be handled in dedicated dependency-upgrade issues/PRs.

## Setup path in GitHub

For each branch (`staging`, `main`):

1. Repository Settings → Branches
2. Add/Edit branch protection rule
3. Enable required status checks
4. Select check names listed above
5. Save

## Maintenance

Whenever a workflow job name changes, update this document and branch protection rules in the same PR.
