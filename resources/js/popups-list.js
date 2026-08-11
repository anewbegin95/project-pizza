// Result presentation for the redesigned Pop-Ups list: month grouping, the
// shared event cards, and the no-results state. Deciding *which* entries show
// is popups-filter.js; this only renders what it is handed.
// See REDESIGN.md section 6.4.
//
// Wrapped in an IIFE: classic scripts share one global lexical scope, and a
// duplicate top-level declaration silently kills a whole file.
(function (global) {
    'use strict';

    // === CONSTANTS ===

    const EASTERN_ZONE = 'America/New_York';

    const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

    const EMPTY_MESSAGE = 'No pop-ups match these filters.';

    const EMPTY_ACTION_LABEL = 'Clear all filters';

    // === PURE HELPERS ===

    /**
     * Date-only strings are anchored at noon UTC. `new Date('2026-09-01')` is
     * UTC midnight — the previous evening in Eastern time — which would file an
     * all-day event under the previous month's heading.
     */
    function toDate(value) {
        if (!value) return null;
        const raw = String(value);
        const parsed = DATE_ONLY.test(raw) ? new Date(`${raw}T12:00:00.000Z`) : new Date(raw);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    /** The 'YYYY-MM' an entry belongs to, in New York time. Null when undated. */
    function getMonthKey(entry) {
        const start = toDate(entry && entry.start_datetime);
        if (!start) return null;
        // en-CA gives YYYY-MM-DD, which slices cleanly and sorts lexicographically.
        return start.toLocaleDateString('en-CA', { timeZone: EASTERN_ZONE }).slice(0, 7);
    }

    /** '2026-08' -> 'August 2026'. */
    function formatMonthHeading(key) {
        const [year, month] = String(key).split('-');
        const date = new Date(Date.UTC(Number(year), Number(month) - 1, 1, 12));
        return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
    }

    /**
     * Groups entries into chronological months. Entries keep their date order
     * within a group — featured ones are not hoisted, matching the mock, where
     * the featured card sits in the run rather than on top. A multi-month run
     * appears once, under the month it starts in. Undated entries collect into
     * a trailing group with no heading rather than being dropped.
     */
    function groupByMonth(entries) {
        const list = Array.isArray(entries) ? entries.slice() : [];
        const byKey = new Map();
        const undated = [];

        for (const entry of list) {
            const key = getMonthKey(entry);
            if (key === null) {
                undated.push(entry);
                continue;
            }
            if (!byKey.has(key)) byKey.set(key, []);
            byKey.get(key).push(entry);
        }

        const groups = [...byKey.keys()]
            .sort()
            .map((key) => ({
                key,
                label: formatMonthHeading(key),
                items: byKey.get(key).sort((a, b) => toDate(a.start_datetime) - toDate(b.start_datetime)),
            }));

        if (undated.length > 0) groups.push({ key: null, label: '', items: undated });
        return groups;
    }

    // === DOM ===

    function createElement(doc, tag, className, text) {
        const element = doc.createElement(tag);
        if (className) element.className = className;
        if (text !== undefined) element.textContent = text;
        return element;
    }

    /**
     * The only dead end in the flow, so it offers the way out rather than
     * leaving people to guess which of four filters to undo. The button asks
     * the filter bar to clear, which also empties the search box (#295).
     */
    function buildEmptyState(doc, { onClear } = {}) {
        const wrapper = createElement(doc, 'div', 'results-empty');
        wrapper.setAttribute('role', 'status');
        wrapper.appendChild(createElement(doc, 'p', 'results-empty__message', EMPTY_MESSAGE));

        const button = createElement(doc, 'button', 'ui-btn ui-btn--primary results-empty__action', EMPTY_ACTION_LABEL);
        button.type = 'button';
        button.addEventListener('click', () => {
            if (typeof onClear === 'function') onClear();
        });
        wrapper.appendChild(button);
        return wrapper;
    }

    function buildGroup(doc, group, buildCard) {
        const section = createElement(doc, 'section', 'event-group');

        if (group.label) {
            const heading = createElement(doc, 'h2', 'event-group__heading', group.label);
            // Ties the group's cards to their month for assistive tech.
            section.setAttribute('aria-labelledby', `month-${group.key}`);
            heading.id = `month-${group.key}`;
            section.appendChild(heading);
        }

        for (const entry of group.items) {
            const card = buildCard(entry);
            if (card) section.appendChild(card);
        }
        return section;
    }

    /**
     * Replaces the contents of `container` with the grouped results, or the
     * empty state when there are none.
     */
    function renderResults(container, entries, options = {}) {
        if (!container) return;
        const doc = options.doc || container.ownerDocument;
        const buildCard =
            options.buildCard ||
            ((entry) => global.NycCards && global.NycCards.buildEventCard(entry, { type: 'popup' }));

        container.replaceChildren();

        const list = Array.isArray(entries) ? entries : [];
        if (list.length === 0) {
            container.appendChild(buildEmptyState(doc, options));
            return;
        }

        for (const group of groupByMonth(list)) {
            container.appendChild(buildGroup(doc, group, buildCard));
        }
    }

    const api = {
        EMPTY_MESSAGE,
        EMPTY_ACTION_LABEL,
        getMonthKey,
        formatMonthHeading,
        groupByMonth,
        buildEmptyState,
        renderResults,
    };

    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (global) global.NycPopupsList = api;
})(typeof window !== 'undefined' ? window : null);
