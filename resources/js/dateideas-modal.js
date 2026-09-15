// The Date Ideas configuration of the shared card-to-modal glue in
// results-modal.js: the return label, and the detail page a history entry
// points at. The behaviour itself is shared with Pop-Ups and lives there.
//
// The modal adapts itself to evergreen content — with no date there is no date
// line and nothing to add to a calendar — which modal.js already handles by
// omitting both. See REDESIGN.md sections 6.5 and 7.2.
//
// Wrapped in an IIFE: classic scripts share one global lexical scope, and a
// duplicate top-level declaration silently kills a whole file.
(function (global) {
    'use strict';

    // Browser: results-modal.js is loaded first and has set the global.
    // Node (unit tests): fall back to require.
    const core =
        (global && global.NycResultsDetail) ||
        (typeof require === 'function' ? require('./results-modal.js') : null);

    const CARD_SELECTOR = core.CARD_SELECTOR;

    const RETURN_LABEL = 'Return to all date ideas';

    /**
     * Where a history entry points, so a copied or reloaded link resolves.
     *
     * Only reached through `openEntry`, for a trigger that is not itself a
     * link — Pop-Ups uses it for map pins, and Date Ideas has no map, so
     * nothing calls it here today. It is still worth setting: the shared
     * module defaults to `pop-up.html`, so a page that leaves it out is wrong
     * the moment anything does. Covered by a unit test rather than an e2e,
     * since no interaction on this page reaches it.
     */
    function detailHref(entry) {
        return `date-idea.html?id=${encodeURIComponent((entry && entry.id) || '')}`;
    }

    function initDetailModal(doc, container, options = {}) {
        return core.initDetailModal(doc, container, {
            getEntries: options.getEntries,
            type: 'date-idea',
            returnLabel: RETURN_LABEL,
            detailHref,
        });
    }

    const api = {
        CARD_SELECTOR,
        RETURN_LABEL,
        detailHref,
        getEntryId: core.getEntryId,
        findEntry: core.findEntry,
        isPlainLeftClick: core.isPlainLeftClick,
        initDetailModal,
    };

    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (global) global.NycDateIdeasDetail = api;
})(typeof window !== 'undefined' ? window : null);
