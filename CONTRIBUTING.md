# Contributing

NYC Slice of Life is a personal project with one maintainer.

**Pull requests from outside the project aren't accepted.** They'll be closed
unmerged, however good they are. Issues, pull requests and comments are
limited to collaborators through GitHub's interaction limits.

- **Found something wrong on the site?** Email
  [NYCSliceofLife@gmail.com](mailto:NYCSliceofLife@gmail.com).
- **Found a security problem?** Don't open an issue. See
  [SECURITY.md](.github/SECURITY.md).

## For collaborators

Every change starts as a GitHub issue and follows one path:

1. **Branch** from `staging` as `<issue-number>-<slug>`, e.g. `461-repo-hardening`.
2. **Write the failing test first.** Vitest for units, Playwright for
   behaviour. Conventions are in [docs/STANDARDS.md](docs/STANDARDS.md).
3. **Open the PR against `staging`, never `main`.** The staging gate runs the
   full suite: lint, unit, e2e, Lighthouse, link check and security scans.
4. **Release** by opening a PR from `staging` to `main`, and merge it with a
   **merge commit, not a squash**. A squash cuts the ancestry between the two
   branches, so the next release tries to re-apply work `main` already has.

Branch protection applies to admins too, so there's no merging past a red
check and no direct pushes to `staging` or `main`. That includes syncing
`main` back into `staging`: do it on a branch and open a PR.

[docs/branch-protection-checks.md](docs/branch-protection-checks.md) lists
every required check and repository setting.
