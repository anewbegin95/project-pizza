// Result presentation for the redesigned Date Ideas page: the shared event
// cards and the no-results state. Deciding *which* entries show is
// dateideas-filter.js; this only renders what it is handed.
//
// There is no grouping. Pop-Ups groups its cards by month, but date ideas are
// evergreen — there is no date to group on, and REDESIGN.md 7.2 asks for a
// plain list of cards. The replace, the empty check and the empty state markup
// come from results-list.js; the wording is the part that is ours.
// See REDESIGN.md sections 6.4 and 7.2.
//
// Wrapped in an IIFE: classic scripts share one global lexical scope, and a
// duplicate top-level declaration silently kills a whole file.
(function (global) {
    'use strict';

    // Browser: results-list.js is loaded first and has set the global.
    // Node (unit tests): fall back to require.
    const core =
        (global && global.NycResultsList) ||
        (typeof require === 'function' ? require('./results-list.js') : null);

    // === CONSTANTS ===

    const EMPTY_MESSAGE = 'No date ideas match these filters.';

    const EMPTY_ACTION_LABEL = 'Clear all filters';

    // === DOM ===

    /** The Date Ideas wording of the shared empty state. */
    function buildEmptyState(doc, { onClear } = {}) {
        return core.buildEmptyState(doc, {
            message: EMPTY_MESSAGE,
            actionLabel: EMPTY_ACTION_LABEL,
            onClear,
        });
    }

    /**
     * Replaces the contents of `container` with the cards, or the empty state
     * when there are none.
     */
    function renderResults(container, entries, options = {}) {
        const buildCard =
            options.buildCard ||
            ((entry) => global.NycCards && global.NycCards.buildEventCard(entry, { type: 'date-idea' }));

        core.renderResults(container, entries, {
            doc: options.doc,
            message: EMPTY_MESSAGE,
            actionLabel: EMPTY_ACTION_LABEL,
            onClear: options.onClear,
            // Flat: one card per entry, in the order it was handed.
            renderBody: (target, list) => {
                for (const entry of list) {
                    const card = buildCard(entry);
                    if (card) target.appendChild(card);
                }
            },
        });
    }

    const api = {
        EMPTY_MESSAGE,
        EMPTY_ACTION_LABEL,
        buildEmptyState,
        renderResults,
    };

    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (global) global.NycDateIdeasList = api;
})(typeof window !== 'undefined' ? window : null);
