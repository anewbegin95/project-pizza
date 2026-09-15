# Analytics Events

> **Status:** All eight events ship on `staging` (#399, PR #413). **Nothing is
> collected from real visitors yet** — `main` is 127 commits behind `staging`,
> so production has no consent module, no GA4 loader and no events module. Every
> hit currently in the property came from verification and is tagged
> `env: development`.
> **The measurement clock starts at the `staging` → `main` release**, not at the
> date of this file.
> **PRD:** issue #160 (§5 is the event design). **Instrumentation:** #399.
> **This issue:** #400.
> **Property:** GA4 `G-JYLM80LHT2`, one property for staging *and* production —
> see §7.

---

## 1. How a hit gets sent

Three ungated files, loaded in this order in the `<head>` of all nine pages,
all deferred, so document order decides:

| File | Global | Job |
|---|---|---|
| `resources/js/consent.js` | `window.NycConsent` | Owns consent state; publishes `consent:change` |
| `resources/js/analytics.js` | `window.NycAnalytics` | On `granted` only: injects `gtag.js`, configures it, sends one `page_view`. Exposes `track()` |
| `resources/js/analytics-events.js` | `window.NycAnalyticsEvents` | Resolves clicks into event names + parameters, hands them to `track()` |

Two properties of that chain matter when reading any report:

- **The consent gate lives in exactly one function.** `NycAnalytics.track()`
  refuses unless consent is a stored `granted`. The events module never touches
  `window.gtag` or `dataLayer` — `tests/unit/analytics-events.spec.js` fails if
  either name appears in it.
- **None of the three is behind the redesign flag,** deliberately, and each
  carries a comment saying so. The flag is off in every environment and the
  redesign is parked (#403); a gate would mean a consent bar whose Accept
  collects nothing. Unit tests fail if a flag check appears in any of them.

---

## 2. Event dictionary

Eight events. `page_view` is GA4's own, sent explicitly with `send_page_view:
false` so its parameters are visible at the call site; the other seven are
custom. All resolution rules live in `resolveClick()` in
`resources/js/analytics-events.js`.

| Event | Parameters | Question it answers |
|---|---|---|
| `page_view` | `page_type`, `env`, `redesign_flag` | Entry points, drop-off |
| `content_open` | `content_type`, `surface`, `entry_id`, `position` | **Where do people find events?** |
| `nav_click` | `nav_location`, `link_text`, `destination` | Which routes people take, and whether the mobile menu is used |
| `calendar_month_change` | `direction`, `months_from_current` | Does anyone browse beyond this month? |
| `social_click` | `platform`, `location` | Which placement actually earns social clicks |
| `outbound_click` | `content_type`, `entry_id`, `destination_domain` | **The success metric** — did anyone visit the event's own site? |
| `content_save` | `entry_id` | Strongest intent signal on the site |
| `menu_open` | — | Mobile navigation usage |

### `page_view`

Sent once per page load by `analytics.js`, immediately after `gtag('config',
…)`. `page_type` derives from `location.pathname` against a fixed map
(`PAGE_TYPES`); anything unmapped reports `other` rather than leaking a raw
path. The nine values: `home`, `popups`, `popup_detail`, `date_ideas`,
`date_idea_detail`, `calendar`, `about`, `contact`, `privacy`.

### `content_open`

Fires when a visitor opens a pop-up or date idea, **from any of four
surfaces**. This is one event rather than four so that a single breakdown
answers where discovery happens.

| `surface` | Fired by | `entry_id` from | `position` |
|---|---|---|---|
| `list` | A `.popup-tile` on Pop-Ups or Date Ideas | `data-analytics-id`, else the `id=` query param of the tile's `href` | index among sibling tiles |
| `carousel` | A `.carousel-slide` or `.carousel-title` on the homepage | `data-analytics-id` | `data-analytics-position` |
| `calendar` | A `.calendar-popup-bar` on the calendar grid | `data-analytics-id`, **else** `data-event-id` — see §6 | *absent by design* |
| `calendar_more` | A `.popup-tile` inside `.day-popups-grid` (the "+N more" day modal) | as `list` | index among sibling tiles |

`calendar_more` is the fourth surface and is easy to miss: the day modal reuses
the Pop-Ups grid markup, so the enclosing `.day-popups-grid` is the only thing
separating a calendar discovery from a list one.

`position` is absent on `calendar` on purpose — a bar sits on a date grid, not
in an ordered list, so an invented ordinal would be worse than none.

`content_type` is `popup` or `date_idea`.

### `nav_click`

Any link inside the header, footer or homepage quick-nav that is not a social
destination.

- `nav_location`: `header` | `header_mobile` | `footer` | `home_quicknav`.
  `header_mobile` is the `.collapsible-menu`. The two are checked in that order
  because the collapsible menu sits *inside* `.site-header`; the same
  destinations appear in both and only one is visible at a time, so without
  this split desktop and mobile navigation are indistinguishable.
- `link_text`: the site's own fixed label, whitespace-collapsed, capped at 100
  characters. Never user input.
- `destination`: the link's `href` as authored.

### `calendar_month_change`

Prev/next on the calendar header.

- `direction`: `prev` | `next`.
- `months_from_current`: whole signed months between **the month being landed
  on** and the real current month. `0` is this month, `1` is next month, `-2`
  is two months back. Derived from `data-analytics-month` on
  `.calendar-header` (`calendar.js:108`), read in the capture phase — so it
  names the month being *left* — with the direction then applied.

### `social_click`

Matched on the **host** of the href, never on the whole URL, so a path
containing the word "instagram" on an unrelated domain is not an Instagram
click. `mailto:` is matched by scheme.

- `platform`: `instagram` | `tiktok` | `substack` | `email`.
- `location`: `header` | `footer` | `home`.

The header's Substack link is a `social_click`, **not** a `nav_click` — each
placement gets one answer rather than one split across two events. Note that
`social_click`'s `location` does not split header from mobile header: that
question belongs to `nav_click`'s `nav_location`, and answering it twice would
answer it worse.

`mailto:` is here because GA4 enhanced measurement does not treat it as an
outbound click and never will.

### `outbound_click`

The detail pages' "Learn More" link (`#popupExternalLink`). `content_type` and
`entry_id` come from the *page's own* location, not the link.
`destination_domain` is the hostname alone — never the path or query, which is
where PII would hide.

This is the one event that duplicates something GA4 collects automatically.
The automatic outbound `click` does not record *where on the page* the link
was, which is the whole point of the custom one.

### `content_save`

"Add to Calendar" on a detail page — the ICS download. Covers both the single
link and the per-day links a multi-day pop-up renders. `entry_id` comes from
the page's query string.

**It does not double-count with the automatic `file_download`** — confirmed
empirically, not reasoned. Four ICS clicks (two `blob:` URLs, two `href="#"`)
produced four `content_save` and **zero** `file_download`; a control
`/fake-report.pdf` link clicked under identical conditions produced exactly one
`file_download`, proving enhanced measurement was live and listening. GA4 does
not match against the `download` attribute, which is where the `.ics` name
lives.

### `menu_open`

The mobile menu toggle, **on open only**. "Toggle" conflates opening and
closing, so the event fires only when the menu is currently closed — readable
in the capture phase, before the component's own handler flips the class.

---

## 3. What comes free, and what is off

Enhanced measurement, configured in the GA4 UI. No code.

| Feature | State | Note |
|---|---|---|
| Page views | ON | Suppressed in config (`send_page_view: false`); `analytics.js` sends one explicitly |
| Scrolls (90%) | ON | Pairs with `position` to answer question 2 |
| Outbound clicks | ON | Covers Instagram, TikTok, Substack, "Learn More" — but without page placement |
| File downloads | ON | Does not fire on ICS saves; see `content_save` |
| Form interactions | ON | No forms on the site today |
| Video engagement | ON | No embedded video today |
| **Site search** | **ON — should be off** | #399 says leave it off. Harmless in practice: there is no search on the live site, so it can never fire. Left alone deliberately — account setting, owner decision |

Automatic dimensions needing no work: device category, traffic source/medium,
landing page, engagement time, geography. **Device category alone answers
question 3.**

Off by design and not to be turned on: Google Signals, demographics and
interests, ad personalisation. The New York Child Data Protection Act does not
apply to this site precisely because it never collects or infers age; Signals
would undo that.

---

## 4. Parameters and the eight custom dimensions

**A GA4 custom dimension that is not registered is not queryable.** Unregistered
parameters are collected and then invisible — they appear in no exploration, no
report, and no segment. Registration is a setup gate, not documentation trivia.

All eight are **registered and confirmed queryable** (verified 2026-09-07),
event-scoped, with parameter names matching the code exactly:

| Dimension | Scope | Values |
|---|---|---|
| `page_type` | event | `home`, `popups`, `popup_detail`, `date_ideas`, `date_idea_detail`, `calendar`, `about`, `contact`, `privacy`, `other` |
| `env` | event | `development`, `staging`, `production`, `unknown` |
| `content_type` | event | `popup`, `date_idea` |
| `surface` | event | `list`, `carousel`, `calendar`, `calendar_more` |
| `entry_id` | event | Sanity document id |
| `position` | event | integer index, 0-based |
| `nav_location` | event | `header`, `header_mobile`, `footer`, `home_quicknav` |
| `platform` | event | `instagram`, `tiktok`, `substack`, `email` |

Registered ≠ populating. **For the first 24–48 hours after the release, a
dimension that has never received a value looks identical to a broken one.**
Confirm each is actually populating before concluding anything is wrong.

`env` carries this description in the property, and it is load-bearing:

> staging and production share this property — filter every report on
> `env=production`.

**One parameter vocabulary across all events.** `entry_id` means the same thing
everywhere; it is never `content_id` in one event and `entry_id` in another.
Two parameters are deliberately *not* registered as dimensions: `link_text` and
`destination` on `nav_click`, and `destination_domain` on `outbound_click` —
useful in DebugView, not worth one of the 50 slots.

### PII rules — non-negotiable

- No parameter carries free text a visitor typed.
- `link_text` is the site's own fixed navigation labels.
- `entry_id` is a Sanity document id — site content, not user data.
- No raw path or query string is ever sent as a parameter value.

---

## 5. Naming convention

**`object_verb`, lowercase, snake_case.** `content_open`, `social_click`,
`calendar_month_change`.

Chosen over verb-first (`view_page`, `click_social`) for one decisive reason:
**`page_view` is an automatic GA4 event and cannot be renamed.** A verb-first
convention would be violated on day one by the property's highest-volume event,
permanently; a custom `view_page` alongside it would double-count and populate
none of GA4's built-in page reports. Object-first also matches the rest of the
automatic set this site collects — `scroll`, `click`, `file_download`.

*Recorded honestly:* GA4's **recommended ecommerce** events genuinely are
verb-first (`view_item`, `add_to_cart`). Verb-first is not wrong in general; it
is wrong next to the automatic events this site actually collects, and there
are no commerce flows here.

### Rules for any event added later

- **Lowercase snake_case.** GA4 event names are case-sensitive —
  `Click_Social` and `click_social` are two different events forever.
- **Never put variable data in the name.** `content_open` plus an `entry_id`
  parameter, never `open_popup_abc123`. Variable names blow the 500-unique-name
  cap and cannot be queried.
- **Under 40 characters**, or the event cannot be marked as a conversion.
- **Avoid reserved names:** `first_visit`, `session_start`, `screen_view`,
  `user_engagement`, `error`, and the `app_*` / `firebase_*` / `ga_*` families.
- **One parameter vocabulary**, as above.
- **Renames are permanent seams.** GA4 does not retroactively rename historical
  data, so a rename leaves a discontinuity that has to be explained forever.

Three names already moved for exactly this reason, before any code existed:
`calendar_nav` → `calendar_month_change` (drops the abbreviation),
`add_to_calendar` → `content_save` (the first two names referred to *two
different calendars* — this site's calendar page, and the visitor's own via
ICS), and `menu_toggle` → `menu_open`.

---

## 6. Traps

**1. The carousel autoplays.** It advances every 5s
(`CAROUSEL_ROTATION_INTERVAL`, `carousel.js:11`). **Never instrument a render
path.** Every rule in the events module hangs off a real interaction — a click,
or Enter/Space on something that navigates. Hanging an event off rendering
would log carousel engagement on every homepage visit from visitors who never
touched it, corrupting the one report this milestone exists to produce. The
first test in `tests/e2e/analytics-events.spec.js` loads the homepage, waits
through two auto-advances and asserts zero events — and checks the carousel
actually advanced, so an empty carousel cannot pass it silently.

**2. Header nav links are duplicated.** The same destinations sit in
`.main-nav` and `.collapsible-menu`. Only one is visible at a time, so
`nav_location` must distinguish `header` from `header_mobile`.

**3. Navigation race on synchronous handlers.** Tiles, carousel slides and
calendar bars all assign `window.location.href` synchronously. The config sets
`transport_type: 'beacon'` so a hit survives unload — but see §10 for what
gtag v2 actually does with that. **Never delay navigation to wait for a
callback:** making the site feel slower to collect analytics is not an
acceptable trade.

**4. `mailto:` is not an outbound click.** Enhanced measurement does not track
it. The footer and homepage email links are `social_click` with
`platform: 'email'`.

**5. The listeners are bound in the capture phase — this is required, not
stylistic.** Calendar bars (`calendar.js:313`), "+N more" links
(`calendar.js:373`) and carousel dots all call `stopPropagation()` in their own
handlers, so a bubble-phase delegated listener on `document` would never see a
single calendar click. Capture also reads the DOM *before* those handlers mutate
it, which is what makes `menu_open` (fires only when the menu is currently
closed) and `calendar_month_change` (reads the month being left, then applies
the direction) deterministic rather than ordering-dependent.

**6. `data-event-id` on a calendar bar is not a document id.** It is a
per-occurrence key used for segment highlighting (`calendar.js:287`), so a
multi-day pop-up carries several. **`data-analytics-id` takes precedence**;
getting this backwards splits one pop-up into several `entry_id`s in every
report.

**7. `page_type` and `env` are not on the events.** They ride the `gtag(
'config', …)` call in `analytics.js`, so GA4 stamps them onto everything from
the page. Inspecting a `content_open` payload and not finding them does not
mean it is broken.

**8. Two surfaces are silent on purpose — do not "fix" them.**

- **Carousel dots.** A dot changes slide and opens nothing, and no event in §5
  covers changing slide. Inventing a ninth name would be permanent.
- **The footer's "Cookie settings" button.** A privacy control is not
  navigation, and counting it as one would be its own small dishonesty.

**9. `data-analytics-*` attributes exist only where a class cannot carry the
value:** carousel slides and the carousel title (one slide is in the DOM at a
time, so index and id are otherwise unrecoverable), Pop-Ups tiles (a `<div>`
with no `href` until #404), and the calendar header's `data-analytics-month`.

**10. Test filenames.** `playwright.config.js` sets `testIgnore:
'**/redesign-*.spec.js'`. `tests/e2e/analytics-events.spec.js`,
`tests/e2e/analytics-consent.spec.js` and `tests/e2e/consent.spec.js` must keep
their exact names — a `redesign-` prefix would silently skip them.

**11. Sanity's CORS allowlist rejects every local origin**, so tiles, slides and
calendar bars render empty against a local server and click tests would pass
vacuously. `tests/e2e/helpers/sanity-stub.js` stubs the origin with fixtures,
which is also what makes `entry_id` and `position` assertable.

**12. Lighthouse never consents**, so gtag never loads in a CI run. If the
performance score moves, suspect the consent gate before the budget.

---

## 7. The two caveats that belong on every report

These are not disclaimers to be skipped. Both belong in this file **and** in the
GA4 property description, so they travel with the data rather than living in a
repo file nobody opens.

### 1. The sample is biased, not just partial

Opt-in consent means the data covers **consenting visitors only** — typically
40–70% of traffic, and **not a random sample**. Privacy-conscious and technical
visitors decline at higher rates than everyone else, so the missing slice is
systematically different from the measured one.

**Consequences:** treat every number as directional. Compare surfaces against
each other, not against absolute targets. **Do not compute precise conversion
rates** — the denominator is unknowable.

### 2. Staging and production share one property

Filter every report on `env = production`. Forgetting this quietly inflates
every number with your own testing. `env` comes from the `data-env` attribute
written by `redesign-flag.js`, which was deliberately kept when the rest of the
parked redesign was unloaded (#402).

### Property description — paste verbatim

> NYC Slice of Life. Opt-in consent: data covers consenting visitors only,
> typically 40–70% of traffic and NOT a random sample — privacy-conscious
> visitors decline at higher rates. Directional only; do not compute precise
> conversion rates. Staging and production share this property: filter every
> report on env=production. Event dictionary: docs/analytics-events.md in the
> project-pizza repo.

---

## 8. The five questions, and the explorations that answer them

**Build these after the release, once several days of real traffic exist.**
Every one of them starts by applying the `env = production` filter; it is
omitted from each recipe below only to avoid repeating it five times.

GA4 path: **Explore → Blank → Free form**, unless noted.

### Q1. Where do people find events?

- Dimensions: `surface`, `content_type`
- Metric: Event count
- Filter: Event name `exactly matches` `content_open`
- Read: the share of `content_open` by `surface` — carousel vs list vs calendar
  vs calendar_more. This decides where content belongs in the new design.

### Q2. Does anything below the fold get clicked?

- Dimensions: `position`, `page_type`
- Metric: Event count
- Filter: Event name `exactly matches` `content_open`; `surface` `exactly
  matches` `list`
- Read: the distribution of `position`. A distribution that dies after the
  first few indices means lists are too long or too dense.
- Pair with a second exploration on the automatic `scroll` event (90% depth) by
  `page_type`, to separate "nobody scrolled" from "people scrolled and did not
  click".

### Q3. What is the device mix?

- Dimension: Device category (automatic)
- Metric: Active users, Event count
- No custom dimensions needed. **On its own this reshapes a redesign** — if
  mobile dominates, the new design is mobile-first and desktop is the
  adaptation.

### Q4. Where do people enter and leave?

- Use the built-in **Reports → Engagement → Landing page** for entries.
- For paths, use **Explore → Path exploration**, starting node `page_view`,
  broken down by `page_type`.
- Read: which page is the front door (it may not be the homepage), and where
  sessions end.

### Q5. Does anyone reach an event's own site?

- Dimensions: `content_type`, `entry_id`
- Metric: Event count
- Filter: Event name `matches regex` `outbound_click|content_save`
- Read: the ratio of `outbound_click` + `content_save` to `content_open`. This
  is the closest thing to a conversion this site has, and the best proxy for
  whether a listing did its job. **Ratio only — see caveat 1.**

---

## 9. Decision rules

Written down **before** any data exists, which is the only moment this is free.
"What would change your mind" is easy to agree today and much harder once there
are numbers worth rationalising against.

**Both owners agree these before reviewing any report.** They are commitments
about what a result means, not predictions about what it will be.

| If the data shows | Then |
|---|---|
| The carousel drives a large share of `content_open` relative to its three slides | Featured content earns real prominence in the new design |
| Almost no `content_open` carries a high `position`, *and* scroll depth shows people did scroll | Lists are too long or too dense — shorten, or add pagination |
| Almost no `content_open` carries a high `position`, *and* scroll depth shows people did **not** scroll | The problem is above the fold, not in the list — fix what greets people |
| `outbound_click` is near zero relative to `content_open` | Detail pages are not doing their job. A **content** problem, not a layout one — more layout iteration will not fix it |
| Mobile dominates the device mix | The new design is mobile-first; desktop is the adaptation |
| `calendar_month_change` is near zero beyond the current month | The calendar is a "what's on now" surface, not a planning tool — design it as one |
| `nav_location = header_mobile` dwarfs `header` | Invest in the mobile menu; the desktop nav is a minority path |

**A rule not listed here is not a decision rule.** Adding one after seeing the
data is exactly the thing this section exists to prevent — if a new rule is
genuinely needed, add it here, say why, and note that it was added after the
fact.

---

## 10. Debugging runbook

Three things that cost real time to work out and will cost it again otherwise.

**gtag v2 sends over `fetch(keepalive)`, not `navigator.sendBeacon`**, and
batches until the page is hidden. `transport_type: 'beacon'` is therefore not
honoured literally. It is still unload-safe, so the synchronous-navigation race
(§6 trap 3) is genuinely handled — but two consequences follow:
`performance.getEntriesByType('resource')` shows **nothing**, and no hit appears
at all until a `visibilitychange` / `pagehide`. Hook `window.fetch` and force a
flush, or you will conclude events are not sending when they are.

**`gtag('config', ID, {debug_mode: true})` called after the initial config does
not route events to DebugView.** Wrapping `window.gtag` to inject `debug_mode`
into every event does work.

**Enhanced measurement events never pass through `window.gtag`.** They are
internal to gtag.js, so the wrapper above cannot make `file_download`, `click`
or `scroll` visible in DebugView. For anything automatic, use **Realtime →
Event count by Event name**, which is debug-independent. (Also confirmed:
enhanced measurement listeners still fire when the click's default is
prevented.)

---

## 11. Kill switch

Full runbook in [`rollback-and-recovery.md`](rollback-and-recovery.md) §
"Analytics kill switch". In short: **the property-level pause is the only lever
that works until the release lands** — the deploy lever has nothing to revert in
production yet.

---

## 12. Sequencing

`main` is 127 commits behind `staging`. Until the release:

- **Doable now, no data required:** this document, the decision rules (§9), the
  kill switch runbook, both caveats in the doc and in the property description.
- **After the release, once a few days of real traffic exist:** build and verify
  the five explorations (§8), and confirm the eight dimensions are *populating*,
  not merely registered.

The "clock starts the day this ships" in #160 §1 starts at that release.
