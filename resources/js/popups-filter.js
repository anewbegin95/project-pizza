// Filter and search state for the redesigned Pop-Ups page. Subscribes to the
// `search:change` and `filters:change` events the shared components publish
// and reduces them to one predicate over the mapped pop-up list. Rendering
// stays with the page — this module decides *what* shows, not how.
// See REDESIGN.md sections 6.2/6.3 and docs/redesign-components.md.
//
// Wrapped in an IIFE: classic scripts share one global lexical scope, and a
// duplicate top-level declaration silently kills a whole file.
(function (global) {
    'use strict';

    // === CONSTANTS ===

    /** Fields the search box looks at, matching what its placeholder promises. */
    const SEARCH_FIELDS = ['name', 'venue_name', 'neighborhood'];

    const EASTERN_ZONE = 'America/New_York';

    const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

    const RANGE_SEPARATOR = '..';

    // === PURE HELPERS ===

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

    /** Case-insensitive substring match across the searchable fields. */
    function matchesQuery(entry, query) {
        const needle = String(query == null ? '' : query).trim().toLowerCase();
        if (!needle) return true;
        if (!entry) return false;

        return SEARCH_FIELDS.some((field) => {
            const value = entry[field];
            return typeof value === 'string' && value.toLowerCase().includes(needle);
        });
    }

    /** The "All …" option carries an empty value, which reads as unset. */
    function isSet(value) {
        return value !== null && value !== undefined && value !== '';
    }

    function matchesFilters(entry, state) {
        if (!state) return true;
        if (!entry) return false;

        if (!matchesQuery(entry, state.query)) return false;
        if (isSet(state.borough) && entry.borough !== state.borough) return false;
        if (isSet(state.neighborhood) && entry.neighborhood !== state.neighborhood) return false;
        if (isSet(state.type) && entry.category !== state.type) return false;
        if (isSet(state.dates) && !overlapsRange(entry, parseDateRange(state.dates))) return false;
        return true;
    }

    function filterPopups(entries, state) {
        const list = Array.isArray(entries) ? entries : [];
        if (!state) return list.slice();
        return list.filter((entry) => matchesFilters(entry, state));
    }

    /**
     * The neighborhoods actually present in the data, so the dropdown cannot
     * drift from the content or hide events behind a stale option list.
     */
    function getDistinctNeighborhoods(entries) {
        const seen = new Map();
        for (const entry of Array.isArray(entries) ? entries : []) {
            const name = entry && typeof entry.neighborhood === 'string' ? entry.neighborhood.trim() : '';
            if (name && !seen.has(name)) seen.set(name, { value: name, label: name });
        }
        return [...seen.values()].sort((a, b) =>
            a.label.localeCompare(b.label, 'en', { sensitivity: 'base' })
        );
    }

    // === DOM WIRING ===

    /**
     * Merges the two event streams into one state object and reports every
     * change. The components stay unaware of each other; this is the only
     * place that knows a query and a set of chips describe one result set.
     */
    function createFilterController(doc, { onChange } = {}) {
        let state = { query: '', borough: null, neighborhood: null, type: null, dates: null };

        function publish() {
            if (typeof onChange === 'function') onChange({ ...state });
        }

        doc.addEventListener('search:change', (event) => {
            state = { ...state, query: (event.detail && event.detail.query) || '' };
            publish();
        });

        doc.addEventListener('filters:change', (event) => {
            const incoming = (event.detail && event.detail.state) || {};
            state = { ...state, ...incoming };
            publish();
        });

        return {
            getState: () => ({ ...state }),
            apply: (entries) => filterPopups(entries, state),
        };
    }

    const api = {
        SEARCH_FIELDS,
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
