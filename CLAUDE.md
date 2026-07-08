# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

NYC Slice of Life (project-pizza) is a static site (vanilla HTML/CSS/JS, no framework/bundler) for an NYC pop-up events guide, deployed to GitHub Pages. Content (pop-ups, date ideas, featured posts) is authored in a **Sanity** headless CMS and fetched client-side at runtime via public GROQ queries. There are two independent npm workspaces: the root (site + CI tooling) and `sanity/` (the Sanity Studio app).

## Commands

Run from repo root unless noted.

```bash
# Local dev server (serves static HTML directly)
npx serve .
# or, matching what Playwright/CI use:
npx http-server . -p 4173

# Lint
npm run lint:css          # Stylelint on resources/css/**/*.css
npm run lint:html         # HTMLHint on **/*.html

# Tests
npm run test:unit                                    # Vitest, all unit tests
npx vitest run --globals tests/unit/<file>.spec.js    # single unit test file
npm run test:e2e                                      # Playwright e2e (spins up http-server automatically)
npx playwright test tests/e2e/<file>.spec.js          # single e2e file

# Lighthouse CI (perf/a11y/best-practices/SEO assertions)
npm run lighthouse:ci

# Prebuild (runs automatically via npm's `prebuild` lifecycle hook before other scripts)
node scripts/prebuild-events.js        # fetches Sanity data, injects static HTML into pop-ups.html / date-ideas.html
node scripts/generate-llms-txt.js      # regenerates llms.txt
```

Sanity Studio (`sanity/` subdirectory, separate package.json/node_modules):

```bash
cd sanity
npm run dev       # Studio dev server
npm run build     # Studio build (also run in CI as a build-verification gate)
npm run deploy    # Deploy Studio
npx eslint .       # Sanity-specific lint (uses @sanity/eslint-config-studio)
```

## Architecture

### Static HTML + client-side data fetching, no build step for the site itself

Each top-level page (`index.html`, `pop-ups.html`, `date-ideas.html`, `calendar.html`, `pop-up.html`, `date-idea.html`, etc.) is a standalone HTML file. There is no bundler/transpiler for the site — CSS and JS files are linked directly. `<html data-title>` / `data-description` attributes drive per-page `<title>` and meta tag injection (see below).

### Partials system (`partials/`)

`resources/js/partials-loader.js` fetches `partials/head.html`, `partials/header.html`, and `partials/footer.html` at runtime and injects them into the DOM (head content appended to `<head>`, header prepended to `<body>`, footer into `#footer-placeholder`). It also sets `<title>`, canonical URL, and Open Graph tags from the page's `data-title`/`data-description` attributes. Because this happens client-side, `scripts/prebuild-events.js` separately pre-renders static HTML for event listings so content is visible without JS (see below).

### Sanity CMS integration

- Schema lives in `sanity/schemaTypes/` (`popup.ts`, `dateIdea.ts`, `featuredPost.ts`). `docs/popup-schema.md` is the field reference for the `pop-ups` document type — keep it in sync when editing `popup.ts`.
- `resources/js/sanity-client.js` defines `window.SANITY_CONFIG` (project ID, dataset, API version) and `window.sanityFetch(query, params)`, a thin fetch wrapper around Sanity's public GROQ HTTP API (CDN, read-only, no token, `perspective=published`).
- `resources/js/sanity-queries.js` defines `window.SANITY_QUERIES` (`POPUPS`, `POPUP_BY_ID`, `DATE_IDEAS`, `DATE_IDEA_BY_ID`, `FEATURED_POSTS`) — the canonical GROQ query strings used by page scripts (`pop-ups.js`, `calendar.js`, `pop-up-details.js`, `date-ideas.js`, `date-idea-details.js`).
- **Query duplication**: `scripts/prebuild-events.js` maintains its own copies of the `POPUPS`/`DATE_IDEAS` GROQ queries (Node script, can't `require` the browser globals). When changing a query or schema field used in listings, update it in *both* `resources/js/sanity-queries.js` and `scripts/prebuild-events.js`, and update `docs/popup-schema.md` if the field is documented there.
- `display_overall` / `display_in_calendar` / `display_in_popups_page` / `display_in_carousel` are independent visibility toggles per pop-up; the latter two are also computed server-side in GROQ to auto-hide events whose end date has passed.
- Coordinates for map views are intended to be geocoded from the `address` field at build time — not yet implemented (see `docs/popup-schema.md`).

### Prebuild static rendering (`scripts/prebuild-events.js`)

A Node script (no browser APIs) that queries Sanity directly over HTTPS and rewrites `pop-ups.html`/`date-ideas.html` in place, replacing the content between `<!-- STATIC_POPUPS_START -->`/`END` and `<!-- STATIC_DATE_IDEAS_START -->`/`END` marker comments (and a JSON-LD block) with server-rendered tiles. This exists purely for no-JS visibility/SEO; the client-side JS still fetches live data and refreshes the grid on load. Runs automatically as an npm `prebuild` lifecycle hook.

### Redesign feature flag (`resources/js/redesign-flag.js`)

Environment-aware feature flag gating an in-progress redesign, loaded first (blocking, not deferred) in every page's `<head>`. Resolves on/off via, in priority order: `?redesign=on|off` URL param > `window.REDESIGN_CONFIG` (optionally loaded from a separate untracked `resources/js/redesign-config.js`) > hostname-based environment default (dev/staging/prod all default OFF). See README for full config API.

### CI/CD gates (branch-specific, see `.github/workflows/`)

- **`staging` branch** (`staging-integration-gate.yml`): Sanity Studio build, Stylelint, HTMLHint, Vitest unit tests, Lychee link check, Lighthouse CI, Playwright e2e smoke tests — plus `security-ci.yml` (ESLint + `npm audit` in `sanity/`, Gitleaks, optional Snyk) and dependency review.
- **`main` branch** (`main-deploy-gate.yml`): pre-deploy checks (unit tests, e2e smoke, Studio build) on PRs; post-merge (`push`) job runs a deployment health check by curling `/`, `/pop-ups.html`, `/contact_us.html` on the production URL from `CNAME`.
- Required check names must exactly match workflow job names — see `docs/branch-protection-checks.md` if adding/renaming jobs.
- Rollback: `.github/workflows/rollback-main.yml` (manual `workflow_dispatch`, takes a `commit_sha`, reverts via `git revert`). Full runbook in `docs/rollback-and-recovery.md`.
- CI status/checklist tracked in `.github/CICD-CHECKLIST.md`.

## Coding conventions

Full detail in `docs/STANDARDS.md`; CI enforces a subset via Stylelint. Highlights:

- **CSS**: lowercase-hyphenated, BEM-ish (`.block__element--modifier`); custom properties must use one of the prefixes `--nyc-*`, `--space-*`, `--font-*`, `--shadow-*`, `--radius-*`, `--container-*`, `--section-*`, `--carousel-*` (enforced by `.stylelintrc.json`).
- **JS**: camelCase functions/variables, PascalCase classes, UPPER_SNAKE_CASE constants (e.g. `POPUPS_QUERY`).
- One CSS file per page/feature under `resources/css/`, linked explicitly in each HTML file's `<head>` (no automatic bundling — new pages must add their own `<link>` tags).
