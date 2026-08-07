// Shared filter bar for the redesigned discovery pages: chip triggers,
// listbox dropdowns, clear-all, and the results count. Behaviour is gated on
// the redesign flag. Data filtering is not done here — state changes are
// published as `filters:change` for page code to consume.
// See REDESIGN.md sections 6.2/6.3.

// === CONSTANTS ===

/** Filters offered per page type, in display order. */
const FILTER_SETS = {
    popups: ['borough', 'neighborhood', 'type', 'dates'],
    'date-ideas': ['vibe', 'budget', 'neighborhood'],
};

const ACTIVE_CHIP_CLASS = 'filter-chip--active';

// === PURE STATE HELPERS ===

/** Builds an empty state object keyed by the page's filters. */
function createFilterState(filters) {
    return filters.reduce((state, filter) => {
        state[filter] = null;
        return state;
    }, {});
}

/**
 * Selects a value for a filter. Choosing the value that is already selected
 * clears it, so a chip can be toggled off without reaching for Clear all.
 * Unknown filters are ignored. Returns a new object.
 */
function selectOption(state, filter, value) {
    if (!Object.prototype.hasOwnProperty.call(state, filter)) return { ...state };
    const next = { ...state };
    next[filter] = next[filter] === value ? null : value;
    return next;
}

function clearFilter(state, filter) {
    const next = { ...state };
    if (Object.prototype.hasOwnProperty.call(next, filter)) next[filter] = null;
    return next;
}

function clearAll(state) {
    return createFilterState(Object.keys(state));
}

function getActiveCount(state) {
    return Object.values(state).filter(value => value !== null).length;
}

function isAnyActive(state) {
    return getActiveCount(state) > 0;
}

/** Chips show the selected option's label, falling back to the filter name. */
function getChipLabel(filterLabel, selectedLabel) {
    return selectedLabel || filterLabel;
}

/** e.g. "1 event found" / "16 events found". */
function getResultsCountText(count, noun = 'event') {
    return `${count} ${count === 1 ? noun : `${noun}s`} found`;
}

// === DOM WIRING ===

function closeDropdown(chip, dropdown) {
    if (!dropdown || dropdown.hidden) return;
    dropdown.hidden = true;
    chip.setAttribute('aria-expanded', 'false');
}

function openDropdown(chip, dropdown) {
    if (!dropdown) return;
    dropdown.hidden = false;
    chip.setAttribute('aria-expanded', 'true');
}

/**
 * Wires the filter bar found in `doc`. Chips without a dropdown (the "Pick
 * dates" slot awaiting the date picker) are left inert rather than opening an
 * empty menu.
 */
function initFilters(doc) {
    const bar = doc.querySelector('.filter-bar');
    if (!bar) return null;

    const pageType = bar.dataset.filterPage;
    const filters = FILTER_SETS[pageType];
    if (!filters) return null;

    const noun = pageType === 'date-ideas' ? 'date idea' : 'event';
    const groups = Array.from(bar.querySelectorAll('.filter-bar__group'));
    const clearButton = bar.querySelector('.filter-bar__clear');
    const resultsCount = doc.querySelector('.results-count');
    let state = createFilterState(filters);

    function closeAll(exceptChip) {
        groups.forEach(group => {
            const chip = group.querySelector('.filter-chip');
            if (chip === exceptChip) return;
            closeDropdown(chip, group.querySelector('.filter-dropdown'));
        });
    }

    function render() {
        groups.forEach(group => {
            const chip = group.querySelector('.filter-chip');
            const filter = chip.dataset.filter;
            const selected = state[filter];
            const options = Array.from(group.querySelectorAll('[role="option"]'));
            const selectedOption = options.find(option => option.dataset.value === selected);

            options.forEach(option => {
                option.setAttribute('aria-selected', String(option.dataset.value === selected));
            });

            const labelEl = chip.querySelector('.filter-chip__label');
            if (labelEl) {
                labelEl.textContent = getChipLabel(chip.dataset.label, selectedOption && selectedOption.dataset.label);
            }
            chip.classList.toggle(ACTIVE_CHIP_CLASS, Boolean(selected));
        });

        if (clearButton) clearButton.hidden = !isAnyActive(state);
        bar.dispatchEvent(
            new CustomEvent('filters:change', { bubbles: true, detail: { state: { ...state }, pageType } })
        );
    }

    groups.forEach(group => {
        const chip = group.querySelector('.filter-chip');
        const dropdown = group.querySelector('.filter-dropdown');

        chip.addEventListener('click', () => {
            // The dates chip has no dropdown yet; leave it inert.
            if (!dropdown) return;
            const willOpen = dropdown.hidden;
            closeAll(chip);
            if (willOpen) {
                openDropdown(chip, dropdown);
            } else {
                closeDropdown(chip, dropdown);
            }
        });

        if (!dropdown) return;

        dropdown.querySelectorAll('[role="option"]').forEach(option => {
            option.addEventListener('click', () => {
                state = selectOption(state, chip.dataset.filter, option.dataset.value);
                render();
                closeDropdown(chip, dropdown);
                chip.focus();
            });
        });
    });

    if (clearButton) {
        clearButton.addEventListener('click', () => {
            state = clearAll(state);
            closeAll(null);
            render();
        });
    }

    doc.addEventListener('keydown', event => {
        if (event.key !== 'Escape') return;
        const openGroup = groups.find(group => {
            const dropdown = group.querySelector('.filter-dropdown');
            return dropdown && !dropdown.hidden;
        });
        if (!openGroup) return;
        const chip = openGroup.querySelector('.filter-chip');
        closeDropdown(chip, openGroup.querySelector('.filter-dropdown'));
        chip.focus();
    });

    doc.addEventListener('click', event => {
        if (!bar.contains(event.target)) closeAll(null);
    });

    render();

    return {
        getState: () => ({ ...state }),
        setResultsCount: count => {
            if (resultsCount) resultsCount.textContent = getResultsCountText(count, noun);
        },
    };
}

// === BOOTSTRAP ===

if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        if (!window.REDESIGN_FLAG || !window.REDESIGN_FLAG.isEnabled()) return;
        initFilters(document);
    });
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        FILTER_SETS,
        createFilterState,
        selectOption,
        clearFilter,
        clearAll,
        isAnyActive,
        getActiveCount,
        getChipLabel,
        getResultsCountText,
        initFilters,
    };
}
