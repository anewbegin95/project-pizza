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
check and no direct pushes to `staging` or `main`.

**When `main` has commits `staging` doesn't**, usually a security update, the
release can't be a plain `staging` → `main` PR. Cut `release/<date>` from
`staging`, merge `origin/main` into it, resolve any conflicts there, and open
that branch's PR into `main`. Don't sync through a PR into `staging` instead:
one squash discards the merge, and the next release conflicts again. That
happened twice in a row in October 2026.

## Dependabot

Configured in `.github/dependabot.yml` (#441):

- **Version updates** open against `staging`, one directory a day: root on
  Monday, `sanity/` on Tuesday, workflow actions on Wednesday.
- **Minor and patch** updates are grouped into one PR per directory and
  **merge themselves** once every required `staging` check is green
  (`.github/workflows/dependabot-auto-merge.yml`). Nothing reaches `main`
  until a person releases `staging`.
- **Left for a person:** majors (one PR each), a PR whose packages changed
  maintainers, and any Dependabot PR someone else has pushed to.
- **Security updates** always open against `main`. Merge them there; the next
  release absorbs them as described above.
- **A grouped PR stuck "behind" `staging`:** comment `@dependabot rebase`. Don't
  click "Update branch": that adds a commit that isn't Dependabot's, and the
  PR stops being eligible to merge itself.

[docs/branch-protection-checks.md](docs/branch-protection-checks.md) lists
every required check and repository setting.
