// Shared filtering core for the redesigned discovery pages. Holds the parts
// that are the same whatever is being filtered: the text search, the equality
// checks behind the chips, the data-driven dropdown options, and the merge of
// the `search:change` and `filters:change` events into one state object.
//
// What differs per page is configuration, not code — which fields the search
// looks at, which state key reads which entry field, and any predicate that is
// not an equality check (Pop-Ups' date range). popups-filter.js and
// dateideas-filter.js are those two configurations; neither reimplements this.
// See REDESIGN.md sections 6.2/6.3 and docs/redesign-components.md.
//
// Wrapped in an IIFE: classic scripts share one global lexical scope, and a
// duplicate top-level declaration silently kills a whole file.
(function (global) {
    'use strict';

    // === PURE HELPERS ===

    /** The "All …" option carries an empty value, which reads as unset. */
    function isSet(value) {
        return value !== null && value !== undefined && value !== '';
    }

    /**
     * Case-insensitive substring match across the given fields. The field list
     * is per-page: each search box promises something different in its
     * placeholder, and matching body copy makes results feel arbitrary.
     */
    function matchesQuery(entry, query, fields) {
        const needle = String(query == null ? '' : query).trim().toLowerCase();
        if (!needle) return true;
        if (!entry) return false;

        return (Array.isArray(fields) ? fields : []).some((field) => {
            const value = entry[field];
            return typeof value === 'string' && value.toLowerCase().includes(needle);
        });
    }

    /**
     * The values actually present in the data for one field, as dropdown
     * options, so a filter list cannot drift from the content or hide entries
     * behind a stale option.
     */
    function getDistinctValues(entries, field) {
        const seen = new Map();
        for (const entry of Array.isArray(entries) ? entries : []) {
            const raw = entry && typeof entry[field] === 'string' ? entry[field].trim() : '';
            if (raw && !seen.has(raw)) seen.set(raw, { value: raw, label: raw });
        }
        return [...seen.values()].sort((a, b) =>
            a.label.localeCompare(b.label, 'en', { sensitivity: 'base' })
        );
    }

    /**
     * Builds the page's predicate from its configuration.
     *
     * `fields` maps a state key to the entry field it filters on — they are not
     * always the same word, since Pop-Ups' "type" chip reads `category`. A
     * state key with no entry in the map is ignored rather than compared
     * against a field the entry does not have, so a stray key from elsewhere
     * cannot silently empty the page.
     *
     * `extra` carries anything that is not an equality check: each is
     * `(entry, state) => boolean` and all must pass.
     *
     * @param {{searchFields?: string[], fields?: Object, extra?: Function[]}} config
     * @returns {(entry: Object, state: Object) => boolean}
     */
    function createMatcher(config) {
        const settings = config || {};
        const searchFields = settings.searchFields || [];
        const fields = settings.fields || {};
        const extra = settings.extra || [];

        return function matches(entry, state) {
            if (!state) return true;
            if (!entry) return false;

            if (!matchesQuery(entry, state.query, searchFields)) return false;

            for (const key of Object.keys(fields)) {
                if (!isSet(state[key])) continue;
                if (entry[fields[key]] !== state[key]) return false;
            }

            return extra.every((predicate) => predicate(entry, state));
        };
    }

    /** Applies a matcher across a list, preserving order. */
    function filterEntries(entries, state, matches) {
        const list = Array.isArray(entries) ? entries : [];
        if (!state) return list.slice();
        return list.filter((entry) => matches(entry, state));
    }

    // === DOM WIRING ===

    /**
     * Merges the two event streams into one state object and reports every
     * change. The components stay unaware of each other; this is the only
     * place that knows a query and a set of chips describe one result set.
     *
     * @param {Document} doc
     * @param {{initialState: Object, matches: Function, onChange?: Function}} options
     * @returns {{getState: Function, apply: Function}}
     */
    function createFilterController(doc, options) {
        const settings = options || {};
        const matches = settings.matches;
        let state = { ...settings.initialState };

        function publish() {
            if (typeof settings.onChange === 'function') settings.onChange({ ...state });
        }

        doc.addEventListener('search:change', (event) => {
            state = { ...state, query: (event && event.detail && event.detail.query) || '' };
            publish();
        });

        doc.addEventListener('filters:change', (event) => {
            const incoming = (event && event.detail && event.detail.state) || {};
            state = { ...state, ...incoming };
            publish();
        });

        return {
            getState: () => ({ ...state }),
            apply: (entries) => filterEntries(entries, state, matches),
        };
    }

    const api = {
        isSet,
        matchesQuery,
        getDistinctValues,
        createMatcher,
        filterEntries,
        createFilterController,
    };

    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (global) global.NycResultsFilter = api;
})(typeof window !== 'undefined' ? window : null);
