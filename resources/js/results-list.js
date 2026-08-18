// Shared result rendering for the redesigned discovery pages: the replace,
// the empty check, and the no-results state. What a page does with a non-empty
// list is its own business — Pop-Ups groups by month, Date Ideas renders a
// plain list of cards — and arrives as `renderBody`.
//
// The empty state is here rather than in either page because its markup has to
// match `.results-empty` in results.css, and one stylesheet with two builders
// is exactly how the two drift apart. Only the wording is per-page.
// See REDESIGN.md section 6.4 and docs/redesign-components.md.
//
// Wrapped in an IIFE: classic scripts share one global lexical scope, and a
// duplicate top-level declaration silently kills a whole file.
(function (global) {
    'use strict';

    function createElement(doc, tag, className, text) {
        const element = doc.createElement(tag);
        if (className) element.className = className;
        if (text !== undefined) element.textContent = text;
        return element;
    }

    /**
     * The only dead end in the flow, so it offers the way out rather than
     * leaving people to guess which filter to undo. The button asks the filter
     * bar to clear, which also empties the search box (#295).
     *
     * @param {Document} doc
     * @param {{message: string, actionLabel: string, onClear?: Function}} options
     */
    function buildEmptyState(doc, options) {
        const settings = options || {};
        const wrapper = createElement(doc, 'div', 'results-empty');
        wrapper.setAttribute('role', 'status');
        wrapper.appendChild(createElement(doc, 'p', 'results-empty__message', settings.message || ''));

        const button = createElement(
            doc,
            'button',
            'ui-btn ui-btn--primary results-empty__action',
            settings.actionLabel || ''
        );
        button.type = 'button';
        button.addEventListener('click', () => {
            if (typeof settings.onClear === 'function') settings.onClear();
        });
        wrapper.appendChild(button);
        return wrapper;
    }

    /**
     * Replaces the contents of `container` with the results, or the empty
     * state when there are none.
     *
     * @param {Element} container
     * @param {Array} entries
     * @param {{renderBody: Function, message: string, actionLabel: string,
     *          onClear?: Function, doc?: Document}} options
     */
    function renderResults(container, entries, options) {
        if (!container) return;
        const settings = options || {};
        const doc = settings.doc || container.ownerDocument;

        container.replaceChildren();

        const list = Array.isArray(entries) ? entries : [];
        if (list.length === 0) {
            container.appendChild(buildEmptyState(doc, settings));
            return;
        }

        if (typeof settings.renderBody === 'function') settings.renderBody(container, list, doc);
    }

    const api = {
        buildEmptyState,
        renderResults,
    };

    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (global) global.NycResultsList = api;
})(typeof window !== 'undefined' ? window : null);
