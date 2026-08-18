// Filter and search state for the redesigned Pop-Ups page. The filtering
// itself lives in results-filter.js, which both discovery pages share; this is
// the Pop-Ups configuration of it, plus the date-range matching that is
// pop-ups-only — date ideas are evergreen and have no dates chip.
//
// The public API is unchanged: pop-ups.js and the calendar call the same names
// they always have.
// See REDESIGN.md sections 6.2/6.3 and docs/redesign-components.md.
//
// Wrapped in an IIFE: classic scripts share one global lexical scope, and a
// duplicate top-level declaration silently kills a whole file.
(function (global) {
    'use strict';

    // Browser: results-filter.js is loaded first and has set the global.
    // Node (unit tests): fall back to require. Guarded so a missing global in
    // the browser fails as a clear undefined rather than on `require`.
    const core =
        (global && global.NycResultsFilter) ||
        (typeof require === 'function' ? require('./results-filter.js') : null);

    // === CONFIGURATION ===

    /** Fields the search box looks at, matching what its placeholder promises. */
    const SEARCH_FIELDS = ['name', 'venue_name', 'neighborhood'];

    /** Chip state key -> the entry field it filters on. "type" reads `category`. */
    const FILTER_FIELDS = {
        borough: 'borough',
        neighborhood: 'neighborhood',
        type: 'category',
    };

    const EASTERN_ZONE = 'America/New_York';

    const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

    const RANGE_SEPARATOR = '..';

    // === DATE RANGE (pop-ups only) ===

    /**
     * Date-only strings are anchored at noon UTC. `new Date('2026-07-25')` is
     * UTC midnight — the previous evening in Eastern time — which renders and
     * filters all-day events a day early.
     */
    function toDate(value) {
        if (!value) return null;
        const raw = String(value);
        const parsed = DATE_ONLY.test(raw) ? new Date(`${raw}T12:00:00.000Z`) : new Date(raw);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    /**
     * The calendar day an instant falls on in New York, as YYYY-MM-DD. Ranges
     * are day-granular, so comparing days rather than instants keeps an event
     * at 6pm on the last day of a range inside it.
     */
    function toDayKey(date) {
        if (!date) return null;
        return date.toLocaleDateString('en-CA', { timeZone: EASTERN_ZONE });
    }

    /** Reads "2026-07-15" or "2026-07-15..2026-07-22". Returns null if unusable. */
    function parseDateRange(value) {
        if (!value) return null;
        const [rawFrom, rawTo] = String(value).split(RANGE_SEPARATOR);
        if (!DATE_ONLY.test(rawFrom || '')) return null;
        if (rawTo !== undefined && !DATE_ONLY.test(rawTo)) return null;

        const from = toDate(rawFrom);
        const to = toDate(rawTo || rawFrom);
        if (!from || !to) return null;
        return from <= to ? { from, to } : { from: to, to: from };
    }

    /**
     * True when any part of the entry falls inside the range. A month-long
     * installation should surface for a range anywhere inside its run, not
     * only for the week it opened. Undated entries drop out of a dated search.
     */
    function overlapsRange(entry, range) {
        if (!range) return true;
        if (!entry) return false;

        const start = toDate(entry.start_datetime);
        if (!start) return false;
        const end = toDate(entry.end_datetime) || start;

        const startDay = toDayKey(start);
        const endDay = toDayKey(end);
        return startDay <= toDayKey(range.to) && endDay >= toDayKey(range.from);
    }

    /** The date range is not an equality check, so it rides in as a predicate. */
    function matchesDates(entry, state) {
        if (!core.isSet(state.dates)) return true;
        return overlapsRange(entry, parseDateRange(state.dates));
    }

    const matches = core.createMatcher({
        searchFields: SEARCH_FIELDS,
        fields: FILTER_FIELDS,
        extra: [matchesDates],
    });

    // === PUBLIC HELPERS ===

    function createInitialState() {
        return { query: '', borough: null, neighborhood: null, type: null, dates: null };
    }

    function matchesQuery(entry, query) {
        return core.matchesQuery(entry, query, SEARCH_FIELDS);
    }

    function matchesFilters(entry, state) {
        return matches(entry, state);
    }

    function filterPopups(entries, state) {
        return core.filterEntries(entries, state, matches);
    }

    /**
     * The neighborhoods actually present in the data, so the dropdown cannot
     * drift from the content or hide events behind a stale option list.
     */
    function getDistinctNeighborhoods(entries) {
        return core.getDistinctValues(entries, 'neighborhood');
    }

    function createFilterController(doc, options) {
        return core.createFilterController(doc, {
            initialState: createInitialState(),
            matches,
            onChange: (options || {}).onChange,
        });
    }

    const api = {
        SEARCH_FIELDS,
        FILTER_FIELDS,
        createInitialState,
        matchesQuery,
        matchesFilters,
        filterPopups,
        parseDateRange,
        overlapsRange,
        getDistinctNeighborhoods,
        createFilterController,
    };

    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (global) global.NycPopupsFilter = api;
})(typeof window !== 'undefined' ? window : null);
