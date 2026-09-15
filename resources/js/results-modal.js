// Opens the shared detail modal from a result card, and keeps the browser
// history in step so Back dismisses the modal rather than leaving the list.
// The modal itself (focus trap, dismissal, scroll lock) is modal.js; this is
// only the glue between a card and that component, and it is the same glue on
// both discovery pages.
//
// What differs per page is the return label and which detail page a history
// entry points at, so both arrive as options. popups-modal.js and
// dateideas-modal.js are those two configurations.
// See REDESIGN.md section 6.5 and docs/redesign-components.md.
//
// Wrapped in an IIFE: classic scripts share one global lexical scope, and a
// duplicate top-level declaration silently kills a whole file.
(function (global) {
    'use strict';

    // === CONSTANTS ===

    const CARD_SELECTOR = '.event-card';

    /** Marks the history entry this module pushed, so popstate can tell. */
    const HISTORY_FLAG = 'nycDetailModal';

    // === PURE HELPERS ===

    /** Reads the entry id out of a card's href, e.g. 'pop-up.html?id=flavia'. */
    function getEntryId(href) {
        if (!href) return null;
        const query = String(href).split('?')[1];
        if (!query) return null;
        const match = /(?:^|&)id=([^&]*)/.exec(query);
        return match ? decodeURIComponent(match[1]) : null;
    }

    function findEntry(entries, id) {
        if (!id || !Array.isArray(entries)) return null;
        return entries.find(entry => String(entry.id) === String(id)) || null;
    }

    /**
     * A modified click means the person asked the browser for something else —
     * a new tab, a new window, a download — so the card has to stay a plain
     * link for those. Only a plain left click becomes a modal.
     */
    function isPlainLeftClick(event) {
        return (
            event.button === 0 &&
            !event.metaKey &&
            !event.ctrlKey &&
            !event.shiftKey &&
            !event.altKey &&
            !event.defaultPrevented
        );
    }

    // === DOM WIRING ===

    /**
     * Delegates clicks within `container`. `getEntries` supplies the current
     * list, so filtering and re-rendering need no re-binding.
     */
    function initDetailModal(doc, container, options = {}) {
        if (!doc || !container) return null;
        const { getEntries, type = 'popup', returnLabel, detailHref: hrefFor } = options;

        let open = null;
        // True while the history entry this module pushed is still current.
        let pushed = false;
        const view = doc.defaultView || global;

        function closeOpen() {
            if (!open) return;
            const handle = open;
            open = null;
            handle.close();
        }

        function onModalClosed() {
            open = null;
            // Dismissed from inside the modal, so drop the entry we pushed.
            // Skipped when popstate already removed it.
            if (pushed) {
                pushed = false;
                view.history.back();
            }
        }

        function detailHref(entry) {
            if (typeof hrefFor === 'function') return hrefFor(entry);
            return `pop-up.html?id=${encodeURIComponent(entry.id || '')}`;
        }

        function openFor(entry, href) {
            if (!global.NycModal) return;
            // Re-opening while one is up would strand the first history entry.
            if (open) closeOpen();

            // The pushed URL is the entry's own detail page, so a copied or
            // reloaded link still resolves to real content.
            view.history.pushState({ [HISTORY_FLAG]: entry.id }, '', href);
            pushed = true;

            open = global.NycModal.openDetailModal(entry, {
                document: doc,
                type,
                returnLabel,
                onClose: onModalClosed,
            });
        }

        container.addEventListener('click', event => {
            const card = event.target.closest(CARD_SELECTOR);
            if (!card || !container.contains(card)) return;
            if (!isPlainLeftClick(event)) return;

            const entry = findEntry(
                typeof getEntries === 'function' ? getEntries() : [],
                getEntryId(card.getAttribute('href'))
            );
            if (!entry) return;

            event.preventDefault();
            openFor(entry, card.getAttribute('href'));
        });

        view.addEventListener('popstate', () => {
            // The entry is already gone, so closing must not call back().
            pushed = false;
            closeOpen();
        });

        return {
            close: closeOpen,
            isOpen: () => open !== null,
            /** Opens an entry directly — used by map pins, which are not links. */
            openEntry: entry => {
                if (entry) openFor(entry, detailHref(entry));
            },
        };
    }

    // === BOOTSTRAP ===

    const api = {
        CARD_SELECTOR,
        getEntryId,
        findEntry,
        isPlainLeftClick,
        initDetailModal,
    };

    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (global) global.NycResultsDetail = api;
})(typeof window !== 'undefined' ? window : null);
