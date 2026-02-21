## Summary
- Describe the change in 1-3 bullets.

## Security Checklist
- [ ] I did not commit secrets (API keys, tokens, `.env`, private keys).
- [ ] If I touched dependencies, I verified `npm audit` results are acceptable.
- [ ] If I touched `sanity/`, ESLint passes (`npx eslint .` in `sanity/`).
- [ ] If I changed frontend scripts/styles, I verified CSP/security-related changes do not break local or production behavior.
- [ ] I validated any external domains added to frontend code are required and trusted.

## Testing
- [ ] I tested locally.
- [ ] I tested affected pages/flows.
- [ ] Frontend checks pass locally: `npm run lint:css`, `npm run lint:html`, `npm run test:unit`.
- [ ] Smoke checks pass locally (or in CI): `npm run test:e2e`.
- [ ] If UX/perf-impacting changes were made, I reviewed Lighthouse CI results.
- [ ] I verified no broken local links/assets were introduced.
- [ ] I reviewed CI results for this PR.

## Branch Gate Awareness
- [ ] I am targeting the correct branch (`staging` for integration; `main` only for production-ready changes).
- [ ] For PRs to `main`, I confirmed deploy/health-check impact and rollback notes (if needed).

## Notes
- Any follow-up work, risks, or rollout notes.
