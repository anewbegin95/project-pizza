// Filter and search state for the redesigned Date Ideas page. The filtering
// itself lives in results-filter.js, which both discovery pages share; this is
// the Date Ideas configuration of it — which fields the search reads and which
// chip filters which field.
//
// Date ideas are evergreen, so REDESIGN.md section 7.2 gives them Vibe, Budget
// and Neighborhood and no date filter. There is no view toggle either. Both are
// recorded as deliberate deviations in docs/redesign-components.md section 5.
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

    /**
     * Chip state key -> the entry field it filters on. Here the two happen to
     * agree; on Pop-Ups "type" reads `category`. Note that `vibe` and `budget`
     * share the value "free", so a matcher wired to the wrong field would still
     * look right on an entry where the two agree.
     */
    const FILTER_FIELDS = {
        vibe: 'vibe',
        budget: 'budget',
        neighborhood: 'neighborhood',
    };

    const matches = core.createMatcher({ searchFields: SEARCH_FIELDS, fields: FILTER_FIELDS });

    // === PUBLIC HELPERS ===

    /** The state the page starts in: a query and the three chips, nothing else. */
    function createInitialState() {
        return { query: '', vibe: null, budget: null, neighborhood: null };
    }

    function matchesQuery(entry, query) {
        return core.matchesQuery(entry, query, SEARCH_FIELDS);
    }

    function matchesFilters(entry, state) {
        return matches(entry, state);
    }

    function filterDateIdeas(entries, state) {
        return core.filterEntries(entries, state, matches);
    }

    /**
     * The neighborhoods actually present in the date ideas, so the dropdown
     * cannot drift from the content. Unlike Pop-Ups there is only one pool —
     * no calendar keeping past entries alongside the list.
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
        filterDateIdeas,
        getDistinctNeighborhoods,
        createFilterController,
    };

    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (global) global.NycDateIdeasFilter = api;
})(typeof window !== 'undefined' ? window : null);
