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

/** Where each page renders its results, so the count can report on them. */
const RESULTS_CONTAINERS = {
    popups: '#popupsGrid',
    'date-ideas': '#dateIdeasGrid',
};

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

/**
 * Resolves where roving focus should land inside a listbox. `currentIndex` is
 * -1 when focus is still on the chip, so the list is entered from whichever
 * end matches the direction. Returns null for unhandled keys or empty lists.
 */
function getNextOptionIndex(currentIndex, key, length) {
    if (length === 0) return null;
    if (key === 'Home') return 0;
    if (key === 'End') return length - 1;
    if (key !== 'ArrowDown' && key !== 'ArrowUp') return null;
    if (currentIndex === -1) return key === 'ArrowDown' ? 0 : length - 1;
    const step = key === 'ArrowDown' ? 1 : -1;
    return (currentIndex + step + length) % length;
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

        const options = Array.from(dropdown.querySelectorAll('[role="option"]'));

        // Options are focusable programmatically only; arrow keys move a
        // roving focus through them, per the listbox pattern.
        options.forEach(option => {
            option.tabIndex = -1;
        });

        function choose(option) {
            state = selectOption(state, chip.dataset.filter, option.dataset.value);
            render();
            closeDropdown(chip, dropdown);
            chip.focus();
        }

        options.forEach(option => {
            option.addEventListener('click', () => choose(option));
        });

        group.addEventListener('keydown', event => {
            const index = options.indexOf(event.target);
            const isArrow = event.key === 'ArrowDown' || event.key === 'ArrowUp';

            // Home/End only apply once focus is already inside the list.
            if (!isArrow && index === -1) return;

            if ((event.key === 'Enter' || event.key === ' ') && index !== -1) {
                event.preventDefault();
                choose(options[index]);
                return;
            }

            const nextIndex = getNextOptionIndex(index, event.key, options.length);
            if (nextIndex === null) return;

            event.preventDefault();
            if (isArrow && dropdown.hidden) {
                closeAll(chip);
                openDropdown(chip, dropdown);
            }
            options[nextIndex].focus();
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

    function setResultsCount(count) {
        if (resultsCount) resultsCount.textContent = getResultsCountText(count, noun);
    }

    // The count reflects whatever the page has rendered; results arrive
    // asynchronously from Sanity, so watch the container rather than
    // reporting a stale zero.
    const resultsContainer = doc.querySelector(RESULTS_CONTAINERS[pageType] || '');
    if (resultsContainer && resultsCount) {
        const syncCount = () => setResultsCount(resultsContainer.childElementCount);
        syncCount();
        if (typeof MutationObserver !== 'undefined') {
            new MutationObserver(syncCount).observe(resultsContainer, { childList: true });
        }
    }

    render();

    return {
        getState: () => ({ ...state }),
        setResultsCount,
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
        getNextOptionIndex,
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
