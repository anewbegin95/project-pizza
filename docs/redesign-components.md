# Redesign Shared Components

> **Status:** Epic 3 complete — every component below is built, tested and merged to `staging`.
> **Not yet wired:** no page fetches data into these components yet. That is Epic 4 (#294–#299).
> **Spec:** `REDESIGN.md` §6. **Responsive targets:** `docs/RESPONSIVE-QA.md`.

Everything here is gated behind the redesign feature flag, which is **OFF in all
environments**. Nothing in this document is user-visible today; append
`?redesign=on` to any URL to see it.

---

## 1. Component inventory

| Area | CSS | JS | Global | Spec |
|---|---|---|---|---|
| Collage hero | `hero.css` (`.hero--collage`) | — | — | §6.1 |
| Search bar + List/Map toggle | `search.css` | `search.js` | — | §6.2 |
| Filter bar, chips, dropdowns | `filters.css` | `filters.js` | `window.NycFilters` | §6.2/6.3 |
| Date range picker | `filters.css` (`.date-picker*`) | `date-picker.js` | `window.NycDatePicker` | §6.3 |
| Event cards | `cards.css` | `cards.js` | `window.NycCards` | §6.4 |
| Detail modal | `modals.css` (`.modal--detail*`) | `modal.js` | `window.NycModal` | §6.5 |
| Interior page shell | `interior.css` | — | — | *derived, see §5* |

Each page `<link>`s and `<script>`s only what it uses; there is no bundler.

---

## 2. The gating contract

Two halves, and both are required — a component that only does one leaks into the
legacy experience.

**CSS.** Redesign rules are scoped to the dual selector, and anything that must
not appear when the flag is off carries an unscoped `display: none` default:

```css
.filter-bar { display: none; }                    /* legacy default */

:root[data-redesign='on'] .filter-bar,
body.redesign-enabled .filter-bar { display: flex; /* … */ }
```

Hidden elements leave the accessibility tree, which is why Lighthouse (which
audits flag-off pages) is unaffected by all of this.

**JS.** Bootstraps return early unless the flag is on, and are guarded for Node
so unit tests can import the module:

```js
if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        if (!window.REDESIGN_FLAG || !window.REDESIGN_FLAG.isEnabled()) return;
        initThing(document);
    });
}
```

---

## 3. Public APIs

### `window.NycCards` — `cards.js`
```js
buildEventCard(data, { type = 'popup' | 'date-idea' })  // → <a class="event-card">
getCategoryTag(category)   // "🍕 Food & Drink"
getVibeTag(vibe)           // "🌹 Romantic"
getAreaLabel(neighborhood, borough)  // "SoHo, Manhattan"
formatCardDate(start, end) // { dayName, dayNumber, monthYear, through }
isFreePrice(price)
```
`data` is a **mapped** pop-up or date idea — the shape `mapSanityPopup` /
`mapSanityDateIdea` produce (`name`, `start_datetime`, `category`, `venue_name`,
`price`, `is_featured`, `img`, `short_desc`, …), not a raw Sanity document.

### `window.NycModal` — `modal.js`
```js
openDetailModal(data, { type, returnLabel })  // → { close(), element }
buildGoogleCalendarUrl(data)  // '' when the entry has no date
getShareData(data, { type, origin })
formatDetailDateTime(start, end)
```
The modal owns focus trapping, Escape / return-bar / overlay dismissal, focus
restoration and the scroll lock. Callers own the data.

### `window.NycFilters` — `filters.js` (set on bootstrap)
```js
getState()                       // { borough: null, type: 'market', … }
setFilter(filter, value, label)  // external setter; null clears
setOptions(filter, options)      // replace a dropdown's options from data
setResultsCount(n)               // usually unnecessary — see below
```
The results count already observes its container and reports what is rendered,
so page code normally does not call `setResultsCount`.

`setOptions` takes `[{ value, label }]`, keeps the leading "All …" row, and
drops a selection the new data no longer offers. #295 uses it to build the
Neighborhood list from the loaded pop-ups so the options cannot drift from the
content. Every dropdown leads with an **"All …" option carrying an empty
value**, which `selectOption` reads as clearing the filter.

### `window.NycPopupsFilter` — `popups-filter.js` (pop-ups page only)
```js
createFilterController(doc, { onChange })  // → { getState(), apply(entries) }
filterPopups(entries, state)
matchesFilters(entry, state)
matchesQuery(entry, query)      // name, venue_name, neighborhood
parseDateRange(value)           // "2026-07-15" | "2026-07-15..2026-07-22"
overlapsRange(entry, range)
getDistinctNeighborhoods(entries)
```
Merges `search:change` and `filters:change` into one state object and decides
*what* shows; the page still owns rendering. Date ranges match on **overlap**,
so a multi-day run surfaces for any range touching it. Recurring events match
only their base span — nothing on the site expands recurrence into occurrences.

### `window.NycDatePicker` — `date-picker.js`
```js
initDatePicker(document, chip, panel, { onApply, onClear })
```
Mounted automatically by `filters.js` when a `.filter-dropdown--dates` panel
exists. The pure helpers (`getMonthGrid`, `selectRangeDate`, `formatRangeLabel`,
`toRangeValue`) are exported for reuse.

---

## 4. Events published

Components announce state rather than reaching into each other. Epic 4 subscribes.

| Event | Fired by | `detail` |
|---|---|---|
| `viewtoggle:change` | `search.js` | `{ view: 'list' \| 'map' }` |
| `search:change` | `search.js` | `{ query }` (trimmed, collapsed, lowercased) |
| `filters:change` | `filters.js` | `{ state, pageType }` |
| `filters:clear` | `filters.js` | — (Clear all was pressed) |

The active view is also reflected as `data-view` on `<html>`, so CSS can respond
without JS. The date range appears in `filters:change` as `state.dates`, either
`"2026-07-15"` or `"2026-07-15..2026-07-22"`.

`filters:clear` fires *before* the accompanying `filters:change` and exists so
Clear all can reset controls the filter bar does not own — `search.js` listens
for it and empties the search box. Keeping it an event rather than a direct
call is what stops the two modules depending on each other.

**Consumed by:** `popups-filter.js` (#295) merges `search:change` and
`filters:change` into the pop-ups result set. Still unconsumed:
`viewtoggle:change`, which #299 needs for the map.

---

## 5. Deviations from REDESIGN.md

Recorded so they are not re-litigated:

- **Interior pages** (`interior.css`, #293) — §7 specs Pop-Ups, Date Ideas and
  Home only. The About/Contact/Privacy shell is **derived from the design
  system**, not from a mock. Adjust `interior.css` if one lands.
- **View toggle is List/Map**, not List/Map/Calendar. §6.2 specifies two
  buttons; the Calendar view belongs to Epic 5.
- **Date ideas have no date filter.** §7.2 gives them Vibe/Budget/Neighborhood;
  they are evergreen. The picker is page-agnostic and mounts wherever a dates
  chip exists.
- **`.filter-chip__chevron`**, not the spec's `.filter-chip .chevron` — Stylelint
  enforces a BEM class pattern.
- **Dropdowns lead with an "All …" option** carrying an empty value (#295),
  per §6.3. Epic 3 shipped without one, so clearing a single filter meant
  re-selecting the active option — a gesture nobody discovers.
- ~~**Cards still render two-across**~~ — resolved by #294. The results region
  in `popups-redesign.css` stacks them to `--container-max-width` and aligns
  them with the search and filter bars.

---

## 6. Traps worth knowing

Each of these cost a debugging cycle during Epic 3.

**Classic scripts share one global lexical scope.** A duplicate top-level
`const` in any file silently kills that whole file — `cards.js` once declared
`EASTERN_TIMEZONE`, which `pop-ups.js` already had, and nothing rendered. New
modules are wrapped in an IIFE exposing a single `window.NycX`. An e2e test
asserts every redesign page loads with zero page errors.

**`buttons.css` used to style the bare `button` selector** — *resolved in #372*.
It applied the legacy pink palette and `padding: 8px 32px` to every button on
the page, and `button:hover` at (0,1,1) outranked the `.ui-*` primitives at
(0,1,0), so hover states won by default. It turned filter chips fuchsia (#289)
and blew date-picker cells out to 80px (#290). The selector is gone and the
defensive restatements in `filters.css` with it.

The lesson generalises: **an element selector in a legacy stylesheet reaches
your component too.** Retiring one is not free — four legacy buttons
(`.menu-toggle`, both calendar month arrows, `.return-button`) had *no styles of
their own* and silently depended on it, as did three redesign components. The
way to do it safely is to snapshot the computed styles of every affected element
on every page in both flag states, make the change, and diff; see the audit
described in #372's PR.

**`section#popupsGrid` in `popups.css` sets padding at `!important`**, and an
id outranks any stack of classes, so a gated rule cannot out-specify it however
many selectors you pile on. It also outranks the media queries in its own file,
which means the legacy grid is 16px on all sides at *every* width — not the
`0 16px` those blocks appear to specify. Deleting it therefore changes the
flag-off page below 975px. `popups-redesign.css` neutralises it with one
matching override instead. Cost a cycle in #294; the lesson generalises to any
`#id` rule in the legacy stylesheets.

**Date-only strings shift a day.** `new Date('2026-07-25')` is UTC midnight —
the previous evening in Eastern time — so all-day events render a day early.
Anchor date-only values at **noon UTC**, as `prebuild-events.js`, `cards.js` and
`modal.js` all do.

---

## 7. Testing conventions

- **CSS** is unit-tested by reading the file and regex-asserting tokens and
  selectors (`expectCssToMatch`, see `tests/unit/design-system-foundation.spec.js`).
- **Pure JS** is unit-tested directly; modules export via a `module.exports`
  guard inside the IIFE.
- **Behaviour** is tested in Playwright against `?redesign=on`, with a companion
  assertion that the component is invisible flag-off.
- **Colour assertions must await transitions.** `getComputedStyle` right after a
  hover or class change samples a mid-fade blend, which silently makes
  assertions pass:

  ```js
  await el.evaluate(async (node) => {
    await Promise.all(node.getAnimations().map((a) => a.finished))
    return getComputedStyle(node).backgroundColor
  })
  ```
  Assert `el.matches(':hover')` too, so a hover that never applied fails loudly
  instead of passing vacuously.
- The in-app browser preview **freezes CSS transitions while its pane is
  backgrounded**; measure colours in Playwright, not there.
