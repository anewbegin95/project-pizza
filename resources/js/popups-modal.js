// The Pop-Ups configuration of the shared card-to-modal glue in
// results-modal.js: the return label, and the detail page a history entry
// points at. The behaviour itself — click delegation, the history push so Back
// dismisses, the plain-left-click check that keeps a modified click a real
// link — is shared with Date Ideas and lives there.
//
// The public API is unchanged: pop-ups.js and the map call the same names.
// See REDESIGN.md section 6.5.
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

    const RETURN_LABEL = 'Return to all pop-ups';

    /** Where a history entry points, so a copied or reloaded link resolves. */
    function detailHref(entry) {
        return `pop-up.html?id=${encodeURIComponent((entry && entry.id) || '')}`;
    }

    function initDetailModal(doc, container, options = {}) {
        return core.initDetailModal(doc, container, {
            getEntries: options.getEntries,
            type: options.type || 'popup',
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
    if (global) global.NycPopupsDetail = api;
})(typeof window !== 'undefined' ? window : null);
