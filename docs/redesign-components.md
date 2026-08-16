# Redesign Shared Components

> **Status:** Epics 3 and 4 complete on `staging`; Epic 5 (the Calendar view)
> in progress. Every component below is built and tested, and **Pop-Ups wires
> all of them to live data** (#294–#300) — read `pop-ups.html` and its
> `popups-*.js` modules as the worked example.
> **Not yet wired:** Date Ideas (Epic 6) and Home (Epic 7).
> **Spec:** `REDESIGN.md` §6. **Responsive targets:** `docs/RESPONSIVE-QA.md`.
> **Note:** `REDESIGN.md` predates the site's CSP; where they conflict, the CSP
> wins and the deviation is recorded in §5.

Everything here is gated behind the redesign feature flag, which is **OFF in all
environments**. Nothing in this document is user-visible today; append
`?redesign=on` to any URL to see it.

---

## 1. Component inventory

| Area | CSS | JS | Global | Spec |
|---|---|---|---|---|
| Collage hero | `hero.css` (`.hero--collage`) | — | — | §6.1 |
| Search bar + view toggle | `search.css` | `search.js` | — | §6.2 |
| Filter bar, chips, dropdowns | `filters.css` | `filters.js` | `window.NycFilters` | §6.2/6.3 |
| Date range picker | `filters.css` (`.date-picker*`) | `date-picker.js` | `window.NycDatePicker` | §6.3 |
| Event cards | `cards.css` | `cards.js` | `window.NycCards` | §6.4 |
| Detail modal | `modals.css` (`.modal--detail*`) | `modal.js` | `window.NycModal` | §6.5 |
| Interior page shell | `interior.css` | — | — | *derived, see §5* |
| Map view (Pop-Ups) | `map.css` | `popups-map.js` | `window.NycPopupsMap` | §6.6 |
| Calendar view (Pop-Ups) | `popups-calendar.css` | `popups-calendar.js` | `window.NycPopupsCalendar` | *derived, see §5* |

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
openModal({ className, cardClassName, returnLabel, onClose, build })  // → { close(), element, card }
openDetailModal(data, { type, returnLabel })  // → { close(), element, card }
buildGoogleCalendarUrl(data)  // '' when the entry has no date
getShareData(data, { type, origin })
formatDetailDateTime(start, end)
```
`openModal` is **the shell**: overlay, return bar, focus trapping, Escape /
return-bar / overlay dismissal, focus restoration and the scroll lock. `build`
fills the card and may return `{ labelledBy }` to set `aria-labelledby`.
`openDetailModal` is a caller of it, as is the calendar's day modal (#300) —
extracted so the two cannot drift apart. Callers own the data.

### `window.NycFilters` — `filters.js` (set on bootstrap)
```js
getState()                       // { borough: null, type: 'market', … }
setFilter(filter, value, label)  // external setter; null clears
setOptions(filter, options)      // replace a dropdown's options from data
setResultsCount(n)               // usually unnecessary — see below
setCountOwner(fn | null)         // a view takes the count line over
refreshCount()                   // re-read it from whoever owns it
```
The results count already observes its container and reports what is rendered,
so page code normally does not call `setResultsCount`.

`setCountOwner` exists for a view whose result set is **not** the list's — the
Pop-Ups calendar, which keeps past pop-ups and reports the month on screen.
The `MutationObserver` watches `#popupsGrid`, and the list re-renders behind
the calendar on every filter change, so without an owner the line silently
reverts to the list's count. Pass `null` to hand it back.

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

### `window.NycPopupsCalendar` — `popups-calendar.js` (pop-ups page only)
```js
initCalendar(doc, container, { getEntries, onSelect, onMonthChange, maxVisible })
getEventDays(entry)             // every 'YYYY-MM-DD' it covers, in New York time
groupByDay(entries)             // Map of day → entries
getMonthRange(entries)          // { first: '2026-02', last: '2026-09' } | null
canGoPrev(monthKey, range) / canGoNext(monthKey, range)
countInMonth(entries, monthKey) // a run counts once, in every month it reaches
getCellEvents(entries, max)     // { visible, overflow }
getWeekSegments(entries, weekCells)  // runs cut to one week row
assignBarRows(segments)         // → { segments (each with .row), rows }
getMaxVisible(isNarrow)         // 4, or 2 on a phone
openDayModal(doc, iso, entries, { onSelect })
```
The grid comes from `NycDatePicker.getMonthGrid` and the month label from
`NycPopupsList.formatMonthHeading` — there is one implementation of each.
Category colours reuse the map's `--nyc-pin-*` palette and `getPinModifier`,
so a category reads the same in Map and Calendar. `onMonthChange` reports
`{ monthKey, label, count }`, which the page turns into the count line.

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
| `viewtoggle:change` | `search.js` | `{ view: 'list' \| 'map' \| 'calendar' }` |
| `search:change` | `search.js` | `{ query }` (trimmed, collapsed, lowercased) |
| `filters:change` | `filters.js` | `{ state, pageType }` |
| `filters:clear` | `filters.js` | — (Clear all was pressed) |

The active view is also reflected as `data-view` on `<html>`, so CSS can respond
without JS. The date range appears in `filters:change` as `state.dates`, either
`"2026-07-15"` or `"2026-07-15..2026-07-22"`.

**`search.js` holds no list of view names** (#298). It reads the views a page
offers from its `.view-toggle__btn[data-view]` elements and opens on whichever
carries `view-toggle__btn--active`, so a page can only be switched to a view it
has a button for. Adding a view is a markup change plus a CSS rule; the module
does not change. Pop-Ups offers three, Date Ideas has no toggle at all.

`filters:clear` fires *before* the accompanying `filters:change` and exists so
Clear all can reset controls the filter bar does not own — `search.js` listens
for it and empties the search box. Keeping it an event rather than a direct
call is what stops the two modules depending on each other.

**Consumed by:** `popups-filter.js` (#295) merges `search:change` and
`filters:change` into the pop-ups result set; `popups-map.js` (#299) listens for
`viewtoggle:change` to create the map the first time it is shown; the calendar
(#300) listens for the same event to render itself and to take the results
count over while it is the active view. All are wired on Pop-Ups; Date Ideas
re-uses the same events in Epic 6.

---

## 5. Deviations from REDESIGN.md

Recorded so they are not re-litigated:

- **Interior pages** (`interior.css`, #293) — §7 specs Pop-Ups, Date Ideas and
  Home only. The About/Contact/Privacy shell is **derived from the design
  system**, not from a mock. Adjust `interior.css` if one lands.
- ~~**View toggle is List/Map**, not List/Map/Calendar~~ — resolved by #298.
  §6.2 specifies two buttons and Epic 3 shipped two; Calendar became the third
  in Epic 5.
- **The monthly calendar's UI is derived** (#300). §6 has no mock for one — its
  only calendar is the date-range picker in §6.3 — so it is assembled from
  parts that are specified: the picker's language for the grid (pink circle on
  today, muted days outside the month, hairline dividers), the event card's
  day-name treatment for the weekday row (§6.4), the list view's display face
  for the month title, and the map's pin palette for categories (§6.6).
  Adjust `popups-calendar.css` if a mock lands.
- **Mobile keeps events in their cells**, rather than moving them to a day
  panel below the grid (#300). Per-day density does not justify a separate
  menu: of the days that have anything at all, 57 have one event and 36 have
  two, with a tail to ten. Cells show two chips then `+N more`, as
  `calendar.js` does at `getMaxVisible()`; the colour moves from a dot to a
  left border to buy back width, and the whole cell opens the day modal so a
  truncated title stays reachable.
- **The Calendar view keeps past pop-ups**, so it carries a different result
  set from List and Map. `display_in_popups_page` is expiry-filtered in GROQ,
  which is why List and Map only ever show what is still to come;
  `display_in_calendar` is returned raw, which is how `calendar.html` browses
  past months. The Calendar view takes the legacy rule —
  `master_display && display_in_calendar`, no expiry filter — from the same
  single fetch, so no extra request is needed. Search and the filter chips
  apply to it identically; only the time horizon and that one editorial toggle
  differ. This keeps `display_in_calendar` meaningful after #302 retires the
  legacy page, and makes month navigation work in both directions (bounded by
  the earliest and latest matching event).
- **The results count follows the active view.** In List and Map it is what it
  has always been — how many events match the filters — and `filters.js`
  derives it by counting `.event-card` inside `#popupsGrid`, which makes the
  list panel's presence in the DOM while hidden load-bearing. In Calendar it
  describes the month on screen instead ("14 events in August 2026") and
  changes as you navigate, because that view carries past pop-ups and one
  number cannot honestly describe both sets. It is still view-independent as
  of #298 only because the calendar panel is empty; #300 implements this.
  Note the trap: `filters.js` observes `#popupsGrid` for mutations, so the
  calendar has to own the line while it is active or a list re-render will
  silently overwrite it.
- **The calendar follows the filters; the filters do not follow the calendar**
  (#301). Filtering to a month the calendar is not on pulls it there
  (`clampMonth`), because the filtered set redefines the navigable range and
  the old month can fall outside it entirely — leaving an empty grid with
  results the arrows cannot reach. The reverse is deliberately not wired:
  paging to another month is looking around, not filtering, and writing it
  back would silently rewrite a filter the reader set (and fight the clamp).
  With nothing matching there is no range, so the month stays put.
- **Data-driven filter options come from every pool the page can show**
  (#301). The Neighborhood list is built from the List pool *and* the calendar
  pool, since the calendar keeps past pop-ups — otherwise a neighborhood only
  a past event uses is visible in the calendar but missing from the dropdown.
- **Filter state is not in the URL.** #301's body mentions serialization and a
  global state store; neither exists — state lives in `search.js` and
  `filters.js` and is published as events. Shareable filtered URLs are tracked
  separately.
- **Recurring events are not expanded into occurrences**, in any view. The
  schema carries the recurrence fields and `mapSanityPopup` maps them, but
  nothing on the site turns them into dates; a calendar is the first surface
  where that would be visible. No published pop-up currently sets
  `recurring`, so this is tracked as its own issue rather than as part of
  Epic 5.
- **Date ideas have no date filter.** §7.2 gives them Vibe/Budget/Neighborhood;
  they are evergreen. The picker is page-agnostic and mounts wherever a dates
  chip exists.
- **`.filter-chip__chevron`**, not the spec's `.filter-chip .chevron` — Stylelint
  enforces a BEM class pattern.
- **Leaflet is vendored, not loaded from a CDN** (#299) — §6.6 says CDN, but
  `script-src 'self'` blocks that. See `resources/vendor/leaflet/README.md`.
- **`beauty` has no pin colour.** §6.6 colours seven categories; the schema has
  eight. `beauty`, and anything added later, falls through to a neutral
  `--nyc-pin-other` rather than disappearing from the map.
- **The no-results state is derived** (#296) — §6.3 specifies only the results
  count. It carries a message and a *Clear all filters* action.
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

**`text-overflow: ellipsis` does not apply to an anonymous flex item.** A bare
text node inside a `display: flex` button is not an inline formatting context,
so an overflowing title is **hard-clipped mid-word** — "Chelsea Night Mar" —
rather than trailing off. It needs its own element (`.calendar-chip__label`)
carrying `min-width: 0; overflow: hidden; text-overflow: ellipsis`. The legacy
calendar has the same defect today, visible on any narrow cell. Found building
#300's mockup, so it cost a cycle before the code existed.

**A test that cannot fail is worse than no test.** #300's mobile chip cap
(`MAX_VISIBLE.mobile`) was asserted in a unit test and never actually applied —
every viewport showed four. The e2e written to catch it *passed while the bug
was live*, because the fixture day held exactly two events and fitted under
either cap; it only started failing once a third was added. Same family as the
transition-timing trap below: an assertion that cannot tell the two states
apart passes vacuously. Check a new test fails for the right reason before
trusting it.

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
