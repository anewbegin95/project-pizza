# Rollback and Recovery

## Purpose

This runbook defines how to recover quickly if a merge to `main` causes a production issue.

## Detection

Production regressions are detected by `Main Deployment Gate` via:

- Pre-deploy checks (build + smoke/E2E)
- Post-merge health checks against:
  - `/`
  - `/pop-ups.html`
  - `/contact_us.html`

## Immediate response

1. Confirm failing check in GitHub Actions.
2. Identify the culprit commit SHA from `main` history.
3. Trigger `Rollback Main` workflow with that SHA.
4. Verify rollback commit lands on `main`.
5. Confirm health checks pass.

## Automated rollback workflow

Workflow: `.github/workflows/rollback-main.yml`

- Trigger: manual (`workflow_dispatch`)
- Input: `commit_sha`
- Behavior:
  - Reverts normal commits with `git revert --no-edit`
  - Reverts merge commits with `git revert -m 1 --no-edit`
  - Pushes revert commit to `main`

## Recovery validation

After rollback:

1. Ensure `Main Deployment Gate` is green.
2. Confirm public site pages return HTTP 200.
3. Spot-check homepage content and key navigation.

## Follow-up

- Open incident issue with root cause and timeline.
- Create fix PR targeting `staging` first.
- Merge to `main` only after staging checks are green.