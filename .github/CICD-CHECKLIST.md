# CI/CD Internal Checklist

## Staging branch (integration gate)

- [x] Build verification (`sanity/npm run build`)
- [x] Dependency review
- [x] ESLint (`sanity/`)
- [x] CSS lint (Stylelint)
- [x] HTML lint (HTMLHint)
- [x] Unit tests (Vitest)
- [x] Link check (Lychee)
- [x] Lighthouse CI
- [x] Security scan (`npm audit`, optional Snyk)
- [x] Secret scan (Gitleaks)
- [x] E2E smoke tests (Playwright)
- [x] Branch enforcement on PRs and pushes to `staging`

## Main branch (production gate)

- [x] Build verification before deploy
- [x] Minimal smoke/E2E tests
- [x] Deployment status + health check post-merge
- [x] Rollback and recovery docs/automation
- [x] Branch enforcement on PRs to `main` and post-merge checks

## Ops references

- Branch protection mapping: `docs/branch-protection-checks.md`
