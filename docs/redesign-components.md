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
setResultsCount(n)               // usually unnecessary — see below
```
The results count already observes its container and reports what is rendered,
so page code normally does not call `setResultsCount`.

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

The active view is also reflected as `data-view` on `<html>`, so CSS can respond
without JS. The date range appears in `filters:change` as `state.dates`, either
`"2026-07-15"` or `"2026-07-15..2026-07-22"`.

**Nothing consumes these yet.** #295 wires search and filter state to results,
#296 renders the list, #297 the modal flow, #299 the map.

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
- **Cards still render two-across** because `.popups-grid` keeps its legacy
  `minmax(480px, 1fr)`. §6.4 wants single-column stacking; that is #294's job,
  and it also resolves the search bar not lining up with the cards.

---

## 6. Traps worth knowing

Each of these cost a debugging cycle during Epic 3.

**Classic scripts share one global lexical scope.** A duplicate top-level
`const` in any file silently kills that whole file — `cards.js` once declared
`EASTERN_TIMEZONE`, which `pop-ups.js` already had, and nothing rendered. New
modules are wrapped in an IIFE exposing a single `window.NycX`. An e2e test
asserts every redesign page loads with zero page errors.

**`buttons.css` styles the bare `button` selector** with the legacy pink palette
and `padding: 8px 32px`, at a specificity that beats the `.ui-*` primitives. It
turned filter chips fuchsia on hover and blew date-picker cells out to 80px.
Components currently restate their own colours and padding to defend against it.
Tracked in **#372**, which should land before the flag is switched on.

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
