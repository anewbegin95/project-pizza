// Calendar view for the redesigned Pop-Ups page: a month grid of the filtered
// pop-ups, with month navigation and the same detail modal a card or a map pin
// opens. Unlike List and Map it keeps past pop-ups — see
// docs/redesign-components.md section 5 — so navigation reaches backwards as
// well as forwards.
//
// The grid itself comes from NycDatePicker.getMonthGrid rather than a second
// implementation; what is new here is working out which days an event covers,
// how far navigation can go, and how a multi-day run is cut into week rows.
//
// Wrapped in an IIFE: classic scripts share one global lexical scope, and a
// duplicate top-level declaration silently kills a whole file.
(function (global) {
    'use strict';

    // === CONSTANTS ===

    const EASTERN_ZONE = 'America/New_York';

    const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

    /** Chips per cell before the rest collapse into "+N more", as calendar.js does. */
    const MAX_VISIBLE = { desktop: 4, mobile: 2 };

    const DAY_MS = 24 * 60 * 60 * 1000;

    // === PURE HELPERS ===

    /**
     * Date-only strings are anchored at noon UTC. `new Date('2026-08-25')` is
     * UTC midnight — the previous evening in New York — which would put an
     * all-day event on the wrong cell.
     */
    function toDate(value) {
        if (!value) return null;
        const raw = String(value);
        const parsed = DATE_ONLY.test(raw) ? new Date(`${raw}T12:00:00.000Z`) : new Date(raw);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    /**
     * The calendar day an instant falls on, in New York. Day boundaries are
     * local, not UTC: an event running 22:00Z–03:00Z is one evening here, and
     * reading it in UTC would smear it across two cells.
     */
    function toDayKey(date) {
        // en-CA gives YYYY-MM-DD, which sorts lexicographically.
        return date.toLocaleDateString('en-CA', { timeZone: EASTERN_ZONE });
    }

    /** 'YYYY-MM-DD' back to an instant, anchored at noon UTC so it stays put. */
    function fromDayKey(key) {
        const [year, month, day] = String(key).split('-').map(Number);
        return new Date(Date.UTC(year, month - 1, day, 12));
    }

    /** Every day an entry covers, inclusive, as sorted 'YYYY-MM-DD' strings. */
    function getEventDays(entry) {
        const start = toDate(entry && entry.start_datetime);
        if (!start) return [];

        const startKey = toDayKey(start);
        const end = toDate(entry.end_datetime);
        let endKey = end ? toDayKey(end) : startKey;
        // A bad range in the CMS should not spin this loop.
        if (endKey < startKey) endKey = startKey;

        const days = [];
        const limit = fromDayKey(endKey).getTime();
        for (let cursor = fromDayKey(startKey).getTime(); cursor <= limit; cursor += DAY_MS) {
            days.push(new Date(cursor).toISOString().slice(0, 10));
        }
        return days;
    }

    /**
     * Entries keyed by every day they cover, so a run appears in each of its
     * cells. Days with nothing on them are absent rather than empty.
     */
    function groupByDay(entries) {
        const byDay = new Map();
        for (const entry of Array.isArray(entries) ? entries : []) {
            for (const day of getEventDays(entry)) {
                if (!byDay.has(day)) byDay.set(day, []);
                byDay.get(day).push(entry);
            }
        }
        return byDay;
    }

    /**
     * The months navigation can reach: from the earliest to the latest day any
     * entry touches. A run ending in September makes September reachable even
     * if nothing starts there. Null when nothing is dated.
     */
    function getMonthRange(entries) {
        let first = null;
        let last = null;
        for (const entry of Array.isArray(entries) ? entries : []) {
            const days = getEventDays(entry);
            if (days.length === 0) continue;
            if (first === null || days[0] < first) first = days[0];
            const end = days[days.length - 1];
            if (last === null || end > last) last = end;
        }
        if (first === null) return null;
        return { first: first.slice(0, 7), last: last.slice(0, 7) };
    }

    function canGoPrev(monthKey, range) {
        return Boolean(range) && String(monthKey) > range.first;
    }

    function canGoNext(monthKey, range) {
        return Boolean(range) && String(monthKey) < range.last;
    }

    /**
     * How many events touch a month. A multi-day run counts once however many
     * of its days fall inside, and counts in every month it reaches.
     */
    function countInMonth(entries, monthKey) {
        let count = 0;
        for (const entry of Array.isArray(entries) ? entries : []) {
            if (getEventDays(entry).some((day) => day.slice(0, 7) === monthKey)) count += 1;
        }
        return count;
    }

    /** Splits a day's entries into the ones a cell shows and the rest. */
    function getCellEvents(entries, max) {
        const list = Array.isArray(entries) ? entries : [];
        const limit = Math.max(0, Number(max) || 0);
        return {
            visible: list.slice(0, limit),
            overflow: Math.max(0, list.length - limit),
        };
    }

    /**
     * Cuts multi-day runs into the piece that belongs to one week row, so a bar
     * can be laid across the row's columns. Single-day entries are left out —
     * the cells render those as chips.
     * @returns {{entry: object, startColumn: number, span: number,
     *            continuesBefore: boolean, continuesAfter: boolean}[]}
     */
    function getWeekSegments(entries, weekCells) {
        const cells = Array.isArray(weekCells) ? weekCells : [];
        if (cells.length === 0) return [];

        const rowStart = cells[0].iso;
        const rowEnd = cells[cells.length - 1].iso;
        const segments = [];

        for (const entry of Array.isArray(entries) ? entries : []) {
            const days = getEventDays(entry);
            if (days.length < 2) continue;

            const from = days[0];
            const to = days[days.length - 1];
            if (to < rowStart || from > rowEnd) continue;

            const startColumn = cells.findIndex((cell) => cell.iso >= from);
            const endColumn = cells.reduce((last, cell, index) => (cell.iso <= to ? index : last), 0);

            segments.push({
                entry,
                startColumn,
                span: endColumn - startColumn + 1,
                continuesBefore: from < rowStart,
                continuesAfter: to > rowEnd,
            });
        }

        return segments;
    }

    // === DOM ===

    const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    function el(doc, tag, className, text) {
        const node = doc.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined) node.textContent = text;
        return node;
    }

    /** Category modifier for a chip or bar, matching the map's pin classes. */
    function getCategoryModifier(category) {
        const pins = global && global.NycPopupsMap;
        if (pins && typeof pins.getPinModifier === 'function') return pins.getPinModifier(category);
        return String(category || '').replace(/_/g, '-') || 'other';
    }

    function addMonths(monthKey, delta) {
        const [year, month] = String(monthKey).split('-').map(Number);
        const shifted = new Date(Date.UTC(year, month - 1 + delta, 1, 12));
        return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}`;
    }

    function formatMonthLabel(monthKey) {
        const list = global && global.NycPopupsList;
        if (list && typeof list.formatMonthHeading === 'function') return list.formatMonthHeading(monthKey);
        return monthKey;
    }

    /** '2026-08-11' for today in New York, so "today" matches the grid's days. */
    function getTodayKey() {
        return toDayKey(new Date());
    }

    function buildChip(doc, entry) {
        const chip = el(doc, 'button', `calendar-chip calendar-chip--${getCategoryModifier(entry.category)}`);
        chip.type = 'button';
        chip.appendChild(el(doc, 'span', 'calendar-chip__dot'));
        // The label is its own element because text-overflow: ellipsis does not
        // apply to an anonymous flex item — a bare text node hard-clips mid-word.
        chip.appendChild(el(doc, 'span', 'calendar-chip__label', entry.name || 'Untitled'));
        chip.dataset.entryId = entry.id || '';
        return chip;
    }

    function buildBar(doc, segment) {
        const {entry} = segment;
        const bar = el(doc, 'button', `calendar-bar calendar-bar--${getCategoryModifier(entry.category)}`);
        bar.type = 'button';
        bar.style.gridColumn = `${segment.startColumn + 1} / span ${segment.span}`;
        bar.dataset.span = String(segment.span);
        bar.dataset.entryId = entry.id || '';
        if (segment.continuesBefore) bar.classList.add('calendar-bar--continues-before');
        if (segment.continuesAfter) bar.classList.add('calendar-bar--continues-after');
        bar.appendChild(el(doc, 'span', 'calendar-chip__label', entry.name || 'Untitled'));
        return bar;
    }

    /**
     * Mounts the calendar into `container`. The entries it draws are whatever
     * `getEntries` returns — the page hands it the calendar-visible set, which
     * unlike List and Map still contains past pop-ups.
     */
    function initCalendar(doc, container, {getEntries, onSelect, onMonthChange, maxVisible} = {}) {
        if (!doc || !container) return null;

        let monthKey = getTodayKey().slice(0, 7);

        function currentEntries() {
            return typeof getEntries === 'function' ? getEntries() : [];
        }

        function announce(entries) {
            if (typeof onMonthChange !== 'function') return;
            onMonthChange({
                monthKey,
                label: formatMonthLabel(monthKey),
                count: countInMonth(entries, monthKey),
            });
        }

        function render() {
            const entries = currentEntries();
            const range = getMonthRange(entries);
            const byDay = groupByDay(entries);
            const todayKey = getTodayKey();
            const cap = maxVisible || MAX_VISIBLE.desktop;

            container.textContent = '';
            const root = el(doc, 'div', 'calendar');

            const header = el(doc, 'div', 'calendar__header');
            header.appendChild(el(doc, 'h2', 'calendar__title', formatMonthLabel(monthKey)));
            const nav = el(doc, 'div', 'calendar__nav');
            const today = el(doc, 'button', 'calendar__today', 'Today');
            today.type = 'button';
            const prev = el(doc, 'button', 'calendar__prev', '‹');
            prev.type = 'button';
            prev.setAttribute('aria-label', 'Previous month');
            prev.disabled = !canGoPrev(monthKey, range);
            const next = el(doc, 'button', 'calendar__next', '›');
            next.type = 'button';
            next.setAttribute('aria-label', 'Next month');
            next.disabled = !canGoNext(monthKey, range);
            nav.append(today, prev, next);
            header.appendChild(nav);
            root.appendChild(header);

            today.addEventListener('click', () => {
                monthKey = todayKey.slice(0, 7);
                render();
            });
            prev.addEventListener('click', () => {
                monthKey = addMonths(monthKey, -1);
                render();
            });
            next.addEventListener('click', () => {
                monthKey = addMonths(monthKey, 1);
                render();
            });

            const grid = el(doc, 'div', 'calendar-grid');
            const weekdays = el(doc, 'div', 'calendar-weekdays');
            for (const name of WEEKDAYS) weekdays.appendChild(el(doc, 'div', 'calendar-weekday', name));
            grid.appendChild(weekdays);

            const [year, month] = monthKey.split('-').map(Number);
            const picker = global && global.NycDatePicker;
            const cells = picker && typeof picker.getMonthGrid === 'function'
                ? picker.getMonthGrid(year, month - 1)
                : [];

            for (let start = 0; start < cells.length; start += 7) {
                const weekCells = cells.slice(start, start + 7);
                const week = el(doc, 'div', 'calendar-week');

                for (const cell of weekCells) {
                    const dayNode = el(doc, 'div', 'calendar-cell');
                    dayNode.dataset.date = cell.iso;
                    if (!cell.inMonth) dayNode.classList.add('calendar-cell--outside');
                    if (cell.iso === todayKey) dayNode.classList.add('calendar-cell--today');
                    if (cell.iso < todayKey) dayNode.classList.add('calendar-cell--past');
                    dayNode.appendChild(el(doc, 'span', 'calendar-cell__day', String(cell.day)));

                    // Runs are drawn as bars across the row; the cell lists the
                    // single-day entries only, so the two do not double up.
                    const single = (byDay.get(cell.iso) || []).filter(
                        (entry) => getEventDays(entry).length < 2
                    );
                    if (single.length > 0) dayNode.classList.add('calendar-cell--has-events');
                    const {visible, overflow} = getCellEvents(single, cap);
                    for (const entry of visible) dayNode.appendChild(buildChip(doc, entry));
                    if (overflow > 0) {
                        const more = el(doc, 'button', 'calendar-more', `+${overflow} more`);
                        more.type = 'button';
                        dayNode.appendChild(more);
                    }
                    week.appendChild(dayNode);
                }

                const segments = getWeekSegments(currentEntries(), weekCells);
                if (segments.length > 0) {
                    const bars = el(doc, 'div', 'calendar-bars');
                    for (const segment of segments) bars.appendChild(buildBar(doc, segment));
                    week.appendChild(bars);
                }

                grid.appendChild(week);
            }

            root.appendChild(grid);
            container.appendChild(root);
            announce(entries);
        }

        // Delegated, so re-rendering on every filter change needs no re-binding.
        container.addEventListener('click', (event) => {
            const trigger = event.target.closest('.calendar-chip, .calendar-bar');
            if (!trigger || typeof onSelect !== 'function') return;
            const entry = currentEntries().find((item) => String(item.id) === trigger.dataset.entryId);
            if (entry) onSelect(entry);
        });

        return {
            render,
            show: render,
            getMonth: () => monthKey,
        };
    }

    const api = {
        MAX_VISIBLE,
        WEEKDAYS,
        initCalendar,
        addMonths,
        getEventDays,
        groupByDay,
        getMonthRange,
        canGoPrev,
        canGoNext,
        countInMonth,
        getCellEvents,
        getWeekSegments,
    };

    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (global) global.NycPopupsCalendar = api;
})(typeof window !== 'undefined' ? window : null);
