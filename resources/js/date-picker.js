// Dual-month date range picker for the "Pick dates" filter chip.
// See REDESIGN.md section 6.3. Gated on the redesign flag; the range is
// published for page code to query against (#295).
//
// Wrapped so its helpers never collide with the other classic scripts on the
// page, which all share one global lexical scope.
(function (global) {
    'use strict';

    // === CONSTANTS ===

    const WEEKDAY_INITIALS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

    const MONTH_NAMES = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December',
    ];

    const MONTH_ABBREVIATIONS = [
        'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ];

    // === PURE DATE HELPERS ===
    // Everything works on YYYY-MM-DD strings and UTC arithmetic, so a
    // calendar day never shifts with the viewer's timezone.

    function pad(value) {
        return String(value).padStart(2, '0');
    }

    function toIso(year, month, day) {
        return `${year}-${pad(month + 1)}-${pad(day)}`;
    }

    function parseIso(iso) {
        const match = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (!match) return null;
        return {year: +match[1], month: +match[2] - 1, day: +match[3]};
    }

    /** Steps a {year, month} pair, rolling over the year in both directions. */
    function addMonths(cursor, delta) {
        const total = cursor.year * 12 + cursor.month + delta;
        return {year: Math.floor(total / 12), month: ((total % 12) + 12) % 12};
    }

    function getDaysInMonth(year, month) {
        return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    }

    function getMonthLabel(year, month) {
        return `${MONTH_NAMES[month]} ${year}`;
    }

    /**
     * Builds whole Sunday-start weeks covering the month, including the
     * neighbouring days that pad the first and last rows.
     */
    function getMonthGrid(year, month) {
        const firstWeekday = new Date(Date.UTC(year, month, 1)).getUTCDay();
        const daysInMonth = getDaysInMonth(year, month);
        const totalCells = Math.ceil((firstWeekday + daysInMonth) / 7) * 7;
        const cells = [];

        for (let index = 0; index < totalCells; index += 1) {
            const offset = index - firstWeekday;
            const date = new Date(Date.UTC(year, month, 1 + offset));
            cells.push({
                iso: toIso(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
                day: date.getUTCDate(),
                weekday: index % 7,
                inMonth: offset >= 0 && offset < daysInMonth,
            });
        }

        return cells;
    }

    /**
     * Applies a click to the range: first pick sets the start, second
     * completes it (swapping if picked backwards), and picking again once a
     * full range exists starts over.
     */
    function selectRangeDate(range, iso) {
        if (!range.start || range.end) return {start: iso, end: null};
        if (iso < range.start) return {start: iso, end: range.start};
        return {start: range.start, end: iso};
    }

    function isInRange(iso, range) {
        if (!range.start) return false;
        if (!range.end) return iso === range.start;
        return iso >= range.start && iso <= range.end;
    }

    function isRangeEdge(iso, range) {
        return iso === range.start || iso === range.end;
    }

    function formatDay(iso, withYear) {
        const parts = parseIso(iso);
        if (!parts) return '';
        const base = `${MONTH_ABBREVIATIONS[parts.month]} ${parts.day}`;
        return withYear ? `${base}, ${parts.year}` : base;
    }

    /** Chip label for the current range, empty when nothing is picked. */
    function formatRangeLabel(range) {
        if (!range.start) return '';
        if (!range.end || range.end === range.start) return formatDay(range.start);
        const crossesYears = range.start.slice(0, 4) !== range.end.slice(0, 4);
        return `${formatDay(range.start, crossesYears)} – ${formatDay(range.end, crossesYears)}`;
    }

    /** Serialises the range for filter state; null when nothing is picked. */
    function toRangeValue(range) {
        if (!range.start) return null;
        return range.end && range.end !== range.start
            ? `${range.start}..${range.end}`
            : range.start;
    }

    // === DOM ===

    function el(doc, tag, className, text) {
        const node = doc.createElement(tag);
        if (className) node.className = className;
        if (text) node.textContent = text;
        return node;
    }

    function todayIso() {
        const now = new Date();
        return toIso(now.getFullYear(), now.getMonth(), now.getDate());
    }

    /**
     * Renders the picker into `panel` and keeps the chip's label in step.
     * The chosen range is pushed into the filter bar's state so Clear all and
     * the results count treat it like any other filter.
     */
    function initDatePicker(doc, chip, panel, options) {
        const settings = options || {};
        const onApply = settings.onApply || function () {};
        const onClear = settings.onClear || function () {};

        const now = new Date();
        let cursor = {year: now.getFullYear(), month: now.getMonth()};
        let range = {start: null, end: null};
        let dayNodes = [];

        const months = el(doc, 'div', 'date-picker__months');
        const footer = el(doc, 'div', 'date-picker__footer');
        const clearButton = el(doc, 'button', 'date-picker__clear', 'Clear');
        const doneButton = el(doc, 'button', 'date-picker__done', 'Done');
        clearButton.type = 'button';
        doneButton.type = 'button';
        footer.appendChild(clearButton);
        footer.appendChild(doneButton);

        panel.classList.add('date-picker');
        panel.setAttribute('role', 'dialog');
        panel.setAttribute('aria-label', 'Choose a date range');
        panel.appendChild(months);
        panel.appendChild(footer);

        function renderMonth(offset) {
            const {year, month} = addMonths(cursor, offset);
            const wrapper = el(doc, 'div', 'date-picker__month');

            const header = el(doc, 'div', 'date-picker__header');
            if (offset === 0) {
                const prev = el(doc, 'button', 'date-picker__nav date-picker__nav--prev', '‹');
                prev.type = 'button';
                prev.setAttribute('aria-label', 'Previous month');
                prev.addEventListener('click', () => {
                    cursor = addMonths(cursor, -1);
                    render();
                });
                header.appendChild(prev);
            }
            header.appendChild(el(doc, 'span', 'date-picker__month-label', getMonthLabel(year, month)));
            if (offset === 1) {
                const next = el(doc, 'button', 'date-picker__nav date-picker__nav--next', '›');
                next.type = 'button';
                next.setAttribute('aria-label', 'Next month');
                next.addEventListener('click', () => {
                    cursor = addMonths(cursor, 1);
                    render();
                });
                header.appendChild(next);
            }
            wrapper.appendChild(header);

            const grid = el(doc, 'div', 'date-picker__grid');
            WEEKDAY_INITIALS.forEach((initial, index) => {
                const weekday = el(doc, 'span', 'date-picker__weekday', initial);
                weekday.setAttribute('aria-hidden', 'true');
                weekday.dataset.weekday = String(index);
                grid.appendChild(weekday);
            });

            const today = todayIso();
            getMonthGrid(year, month).forEach(cell => {
                const day = el(doc, 'button', 'date-picker__day', String(cell.day));
                day.type = 'button';
                day.dataset.iso = cell.iso;
                day.dataset.day = String(cell.day);
                day.setAttribute('aria-label', cell.iso);
                if (!cell.inMonth) day.classList.add('date-picker__day--outside');
                if (cell.iso === today) day.classList.add('date-picker__day--today');
                if (isRangeEdge(cell.iso, range)) {
                    day.classList.add('date-picker__day--edge');
                    day.setAttribute('aria-pressed', 'true');
                } else if (isInRange(cell.iso, range)) {
                    day.classList.add('date-picker__day--in-range');
                }
                day.addEventListener('click', () => {
                    range = selectRangeDate(range, cell.iso);
                    // Restyle in place rather than rebuilding: replacing the
                    // clicked button would detach it mid-event, and listeners
                    // further up would then treat the click as coming from
                    // outside the picker.
                    applyRangeStyles();
                });
                dayNodes.push({node: day, iso: cell.iso});
                grid.appendChild(day);
            });

            wrapper.appendChild(grid);
            return wrapper;
        }

        /** Reflects the current range onto the already-rendered day buttons. */
        function applyRangeStyles() {
            dayNodes.forEach(({node, iso}) => {
                const edge = isRangeEdge(iso, range);
                node.classList.toggle('date-picker__day--edge', edge);
                node.classList.toggle('date-picker__day--in-range', !edge && isInRange(iso, range));
                if (edge) {
                    node.setAttribute('aria-pressed', 'true');
                } else {
                    node.removeAttribute('aria-pressed');
                }
            });
        }

        function render() {
            dayNodes = [];
            months.textContent = '';
            months.appendChild(renderMonth(0));
            months.appendChild(renderMonth(1));
        }

        clearButton.addEventListener('click', () => {
            range = {start: null, end: null};
            render();
            onClear();
        });

        doneButton.addEventListener('click', () => {
            onApply(toRangeValue(range), formatRangeLabel(range));
        });

        render();

        return {
            getRange: () => ({...range}),
            reset: () => {
                range = {start: null, end: null};
                render();
            },
        };
    }

    const api = {
        WEEKDAY_INITIALS,
        initDatePicker,
        addMonths,
        getMonthGrid,
        getMonthLabel,
        selectRangeDate,
        isInRange,
        isRangeEdge,
        formatRangeLabel,
        toRangeValue,
    };

    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (global) global.NycDatePicker = api;
})(typeof window !== 'undefined' ? window : null);
