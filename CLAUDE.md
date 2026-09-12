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

- Schema lives in `sanity/schemaTypes/` (`popup.ts`, `dateIdea.ts`, `featuredPost.ts`). `docs/popup-schema.md` and `docs/dateidea-schema.md` are the field references for the `pop-ups` and `date_ideas` document types — keep them in sync when editing `popup.ts` / `dateIdea.ts`.
- `resources/js/sanity-client.js` defines `window.SANITY_CONFIG` (project ID, dataset, API version) and `window.sanityFetch(query, params)`, a thin fetch wrapper around Sanity's public GROQ HTTP API (CDN, read-only, no token, `perspective=published`).
- `resources/js/sanity-queries.js` defines `window.SANITY_QUERIES` (`POPUPS`, `POPUP_BY_ID`, `DATE_IDEAS`, `DATE_IDEA_BY_ID`, `FEATURED_POSTS`) — the canonical GROQ query strings used by page scripts (`pop-ups.js`, `calendar.js`, `pop-up-details.js`, `date-ideas.js`, `date-idea-details.js`).
- **Query duplication**: `scripts/prebuild-events.js` maintains its own copies of the `POPUPS`/`DATE_IDEAS` GROQ queries (Node script, can't `require` the browser globals). When changing a query or schema field used in listings, update it in *both* `resources/js/sanity-queries.js` and `scripts/prebuild-events.js`, and update `docs/popup-schema.md` / `docs/dateidea-schema.md` if the field is documented there.
- `display_overall` / `display_in_calendar` / `display_in_popups_page` / `display_in_carousel` are independent visibility toggles per pop-up; the latter two are also computed server-side in GROQ to auto-hide events whose end date has passed.
- `location` is the single location field on both `pop-ups` and `date_ideas`; `venue_name`/`address` are retired and hidden in Studio (`address` survives only as a geocoding fallback for older documents). `scripts/geocode-popups.js` (Nominatim, scheduled via `.github/workflows/geocode-popups.yml`) reads `location` and writes read-only `latitude`/`longitude`/`borough` back into Sanity for both document types. Queries are bounded to an NYC box and re-checked on the response, or the fallback query chain matches places hundreds of miles away. `neighborhood` is hidden but **not** derived — ZIP codes and Nominatim are both too coarse. See `docs/popup-schema.md`.
- Fields hidden from the Studio form but still read by the site: `category` (Type filter, map pin icons), `price`, `budget`. Existing values keep working; new documents simply have none, so those filters degrade over time by design pending analytics.

### Prebuild static rendering (`scripts/prebuild-events.js`)

A Node script (no browser APIs) that queries Sanity directly over HTTPS and rewrites `pop-ups.html`/`date-ideas.html` in place, replacing the content between `<!-- STATIC_POPUPS_START -->`/`END` and `<!-- STATIC_DATE_IDEAS_START -->`/`END` marker comments (and a JSON-LD block) with server-rendered tiles. This exists purely for no-JS visibility/SEO; the client-side JS still fetches live data and refreshes the grid on load. Runs automatically as an npm `prebuild` lifecycle hook.

### Redesign feature flag (`resources/js/redesign-flag.js`)

Environment-aware feature flag gating an in-progress redesign, loaded first (blocking, not deferred) in every page's `<head>`. Resolves on/off via, in priority order: `?redesign=on|off` URL param > `window.REDESIGN_CONFIG` (optionally loaded from a separate untracked `resources/js/redesign-config.js`) > hostname-based environment default (dev/staging/prod all default OFF). See README for full config API.

### Consent module (`resources/js/consent.js`, ungated)

Ships the consent state machine and banner UI for the #160 analytics work (#396), **live since #398**: the bootstrap builds `window.NycConsent`, binds the footer control, and mounts the bar. `resources/js/analytics.js` is its only consumer.

- State is `granted` | `denied` | `unset`, in **localStorage** under `nyc-consent`, not a cookie. Anything unrecognised (absent, corrupt, storage throwing) reads as `unset`, which under opt-in means not tracked.
- **GPC (`navigator.globalPrivacyControl`) or DNT (`navigator.doNotTrack`) resolves `denied` and the banner is never auto-shown.** The signal is a default for people who never answered, not a veto: an explicitly stored choice outranks it, so the Accept button in the footer control always does what it says.
- Publishes `consent:change` on `document`, same seam convention as `filters:change` / `search:change`.
- `renderBanner(doc)` is guarded and mounts only when a choice is still open; `openSettings(doc)` (the footer link) always mounts. `denied` is permanent — the site never re-prompts.
- The footer's "Cookie settings" button is bound by **delegation from `document`**, because `partials-loader.js` injects the footer with `insertAdjacentHTML` and `pop-ups.js` re-injects it after its Sanity fetch.
- **This is not a redesign component and must not be gated** — not the CSS, not the JS. The flag defaults off in every environment and the redesign is parked (#403), so a gate would disable consent on the live site. Both files carry a comment saying why, and `tests/unit/consent.spec.js` fails if a redesign scope or flag check appears in either.
- Accept and Decline share one class with no modifier and sit in equal grid columns; `tests/e2e/consent.spec.js` compares their computed styles. That file must keep its exact name — `playwright.config.js` sets `testIgnore: '**/redesign-*.spec.js'`, so a `redesign-` prefix would silently skip it. Same rule for `tests/e2e/analytics-consent.spec.js`.
- **The bar mounts on `document.fonts.ready`, not immediately.** It is bottom-anchored, so the web-font swap reflowed its message, grew it ~20px and jumped it upward — that doubled CLS on every page (0.086 → 0.19) and cost ~7 Lighthouse performance points when #398 first turned it on. A 2s timer caps the wait so a stalled font request can never suppress the choice.

### Analytics loader (`resources/js/analytics.js`, ungated)

GA4 behind the consent gate (#398). Exposes `window.NycAnalytics`, subscribes to `consent:change`, and on `granted` — and nothing else — injects `gtag.js` for `G-JYLM80LHT2`, configures it, and sends one `page_view`.

- **On `denied` / `unset` / anything unrecognised it does nothing at all**: no script tag, no `dataLayer`, no cookie, no request. `tests/e2e/analytics-consent.spec.js` asserts that with Playwright request interception across all nine pages; it is the load-bearing test of the milestone.
- **Ungated for the same reason consent.js is**, and `tests/unit/analytics.spec.js` fails if a flag check appears. `redesign_flag` is *reported* as a `page_view` parameter, never consulted as a condition.
- Loaded **after** `consent.js` in every page's `<head>` — both deferred, so document order decides, and the loader reads `NycConsent.getState()` at bootstrap to serve a returning visitor who already granted.
- Config sets `anonymize_ip`, `allow_google_signals: false`, `allow_ad_personalization_signals: false`, `allow_linker: false`, `transport_type: 'beacon'` (§2.4: tiles and slides assign `location.href` synchronously), and `send_page_view: false` so the one `page_view` is explicit. `page_type` and `env` also ride the config, so #399's events inherit them.
- Withdrawal sets Google's `ga-disable-G-JYLM80LHT2` switch and expires the `_ga*` cookies. gtag cannot be torn out of a loaded page; `privacy_policy.html` describes exactly this rather than overclaiming.
- **Lighthouse never consents, so gtag never loads in a CI run.** If the performance score moves, suspect the gate before the budget.

### Click instrumentation (`resources/js/analytics-events.js`, ungated)

The eight custom events of #160 §5, shipped by #399. One IIFE exposing
`window.NycAnalyticsEvents`, loaded after `analytics.js` on all nine pages.
Everything it resolves goes out through `NycAnalytics.track(name, params)` —
**the events module never touches `window.gtag` or `dataLayer`**, so the consent
gate stays in exactly one file. `tests/unit/analytics-events.spec.js` fails if
either name appears here.

- **Never instrument a render path.** The carousel auto-advances every 5s
  (`carousel.js:179`); hanging events off rendering would log phantom
  engagement on every homepage visit. Every rule keys off a real interaction.
  The first test in `tests/e2e/analytics-events.spec.js` loads the homepage,
  waits through two auto-advances and asserts zero events — it fails if you
  get this wrong, and it checks the carousel actually advanced so an empty
  carousel cannot pass it silently.
- **The listeners are bound in the capture phase.** Calendar bars
  (`calendar.js:296`), "+N more" links and carousel dots all call
  `stopPropagation()` in their own handlers, so a bubble-phase listener on
  `document` would never see a calendar click at all. Capture also means the
  DOM is read *before* those handlers mutate it, which is what makes
  `menu_open` (fires only when the menu is currently closed) and
  `calendar_month_change` (reads the month being left, then applies the
  direction) deterministic rather than ordering-dependent.
- **`page_type` and `env` are not on the events.** They ride the gtag `config`
  call in `analytics.js`, so GA4 stamps them on everything from the page.
- **`data-analytics-*` attributes exist only where a class cannot carry the
  value**: carousel slides and the carousel title (`carousel.js` — one slide is
  in the DOM at a time, so index and id are unrecoverable otherwise), pop-ups
  tiles (`pop-ups.js` — a `<div>` with no href until #404), and the calendar
  header's `data-analytics-month`. On calendar bars, **`data-analytics-id`
  takes precedence over `data-event-id`**: the latter is a per-occurrence
  segment key, so a multi-day pop-up carries several and would count as
  several entries.
- Deliberately silent: **carousel dots** (they open nothing, and no event in §5
  covers changing slide — a ninth name would be permanent) and the footer's
  **Cookie settings** button (a privacy control is not navigation). A social
  destination inside the header nav — the Substack link — is a `social_click`,
  not a `nav_click`, so each placement has one answer rather than one split
  across two events.
- **Ungated for the same reason `consent.js` and `analytics.js` are**, and the
  unit spec fails if a flag check appears. `tests/e2e/analytics-events.spec.js`
  must keep its exact name — `playwright.config.js` sets
  `testIgnore: '**/redesign-*.spec.js'`.
- **Sanity's CORS allowlist rejects every local origin**, so tiles, slides and
  calendar bars render empty against a local server and the click tests would
  pass vacuously. `tests/e2e/helpers/sanity-stub.js` stubs the origin with
  fixtures, which also makes `entry_id` and `position` assertable.

### Redesign shared components (`docs/redesign-components.md`)

Epic 3 built the redesign's shared UI — collage hero, search bar + List/Map toggle, filter bar/chips/dropdowns, date range picker, event cards, detail modal, interior-page shell. Epic 4 wired all of it up on Pop-Ups. **`docs/redesign-components.md` is the reference**: component inventory, public APIs, the events they publish, deviations from REDESIGN.md, and the traps below. Read it before building on them.

- **Everything is gated, in both halves.** CSS rules are scoped to `:root[data-redesign='on'], body.redesign-enabled`, and anything that must not appear flag-off carries an unscoped `display: none` default. JS bootstraps return early unless `window.REDESIGN_FLAG.isEnabled()`. A component doing only one half leaks into the legacy experience.
  - **One deliberate exception: the consent bar** (`resources/js/consent.js`, `resources/css/consent.css`) — see below. It is ungated in both halves on purpose. Do not "fix" it.
- **New JS modules are wrapped in an IIFE exposing a single `window.NycX`** (`NycCards`, `NycModal`, `NycFilters`, `NycDatePicker`, and the Pop-Ups modules `NycPopupsFilter`, `NycPopupsList`, `NycPopupsDetail`, `NycPopupsMap`). Classic scripts share one global lexical scope, so a duplicate top-level `const` silently kills the whole file — this happened with `EASTERN_TIMEZONE` between `cards.js` and `pop-ups.js`. An e2e test asserts each redesign page loads with zero page errors.
- **Components publish events rather than calling each other**: `viewtoggle:change`, `search:change`, `filters:change`, `filters:clear`. On Pop-Ups these are consumed by `popups-filter.js` and `popups-map.js`; Date Ideas re-uses them in Epic 6.
- **Anchor date-only strings at noon UTC.** `new Date('2026-07-25')` is UTC midnight, i.e. the previous evening in Eastern time, so all-day events render a day early. `prebuild-events.js`, `cards.js`, `modal.js`, `popups-filter.js` and `popups-list.js` all do this.
  - **The mirror-image version bites in legacy code too: `new Date(year, month, day)` is *local* midnight.** Fed to `formatDateId` (which reads a date in `America/New_York`), it resolves to the **previous** day for every visitor at or east of UTC. That emptied the calendar's "+N more" modal for all of Europe, Africa, Asia and Australia, and was invisible in local runs because a US-Eastern machine never hits it — a UTC CI runner found it. `calendar.js` now uses `Date.UTC(year, month, day, 12, 0, 0)` in both places. `tests/e2e/calendar-day-modal.spec.js` pins `timezoneId: 'UTC'` to keep it caught; a calendar test that only ever runs in Eastern proves very little.
- **`height: 100%` on an image inside an auto-sized grid area** resolves to the image's intrinsic height, so the source image ends up setting the container's height rather than filling it. Fixed twice — event cards (#376) and the detail modal (#380) — by taking the image out of flow. Related: a grid item with `overflow-y: auto` also needs `min-height: 0`, or the overflow never engages and content is clipped with no scrollbar.
- **Legacy element and id selectors reach redesign components.** Bare `button` in `buttons.css` did (retired in #372), and `section#popupsGrid` in `popups.css` still sets padding at `!important` that no stack of classes can out-specify. Before retiring one, snapshot computed styles across pages in **both flag states** and diff — #372 found four legacy buttons with no styles of their own, including the menu toggle's 44px touch target.

### Pop-Ups page composition (Epic 4)

`pop-ups.html` is the fully wired reference for the redesign. Its own files, on top of the shared components:

- `resources/css/popups-redesign.css` — results region, single-column card list, month-group headings, no-results state, List/Map panel switching (driven by `data-view` on `<html>`)
- `resources/js/popups-filter.js` — merges search and filter state into one predicate over the fetched list
- `resources/js/popups-list.js` — month grouping, card rendering, the empty state
- `resources/js/popups-modal.js` — card click → detail modal, plus history so Back dismisses it
- `resources/js/popups-map.js` + `resources/css/map.css` — Leaflet map, pins, legend

**Third-party scripts must be self-hosted.** Every page sets `script-src 'self'` in its CSP, so a CDN `<script>` is blocked — REDESIGN.md predates the policy and §6.6's "Leaflet via CDN" is not possible. Leaflet is vendored in `resources/vendor/leaflet/` (see its README). Check the page's `<meta http-equiv="Content-Security-Policy">` before planning anything third-party.

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
- **Tests**: CSS is unit-tested by reading the file and regex-asserting selectors/tokens (`expectCssToMatch`); pure JS is unit-tested via the `module.exports` guard; behaviour is tested in Playwright against `?redesign=on` with a companion flag-off assertion. Colour assertions must `await` `element.getAnimations()` before sampling — `getComputedStyle` immediately after a hover or class change reads a mid-transition blend and passes vacuously.
