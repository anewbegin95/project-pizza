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
 * clears it, so a chip can be toggled off without reaching for Clear all. The
 * "All …" option carries an empty value and always clears. Unknown filters are
 * ignored. Returns a new object.
 */
function selectOption(state, filter, value) {
    if (!Object.prototype.hasOwnProperty.call(state, filter)) return { ...state };
    const next = { ...state };
    const chosen = value === '' || value === undefined ? null : value;
    next[filter] = next[filter] === chosen ? null : chosen;
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
                // With nothing chosen the "All …" row is the selection, so the
                // listbox always has exactly one selected option.
                const isAll = option.dataset.value === '';
                const isSelected = selected ? option.dataset.value === selected : isAll;
                option.setAttribute('aria-selected', String(isSelected));
            });

            // A group with no options (the date picker) supplies its own
            // label through dataset.selectedLabel rather than an option. It is
            // only trusted while the filter is actually set, so Clear all
            // cannot leave a stale range on the chip.
            const ownLabel = options.length === 0 && selected ? chip.dataset.selectedLabel : null;
            const labelEl = chip.querySelector('.filter-chip__label');
            if (labelEl) {
                labelEl.textContent = getChipLabel(
                    chip.dataset.label,
                    options.length === 0 ? ownLabel : selectedOption && selectedOption.dataset.label
                );
            }
            if (options.length === 0 && !selected) delete chip.dataset.selectedLabel;
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

        // Read live: setOptions can replace the list after the data loads, and
        // a captured array would leave the keyboard walking detached nodes.
        const getOptions = () => Array.from(dropdown.querySelectorAll('[role="option"]'));

        // Options are focusable programmatically only; arrow keys move a
        // roving focus through them, per the listbox pattern.
        getOptions().forEach(option => {
            option.tabIndex = -1;
        });

        function choose(option) {
            state = selectOption(state, chip.dataset.filter, option.dataset.value);
            render();
            closeDropdown(chip, dropdown);
            chip.focus();
        }

        getOptions().forEach(option => {
            option.addEventListener('click', () => choose(option));
        });

        group.addEventListener('keydown', event => {
            const options = getOptions();
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
            // Announced separately from filters:change so the search box can
            // reset itself without this module reaching into it.
            bar.dispatchEvent(new CustomEvent('filters:clear', { bubbles: true }));
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
        // A target detached by its own handler is not an outside click.
        if (!event.target.isConnected) return;
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
        /**
         * Replaces a dropdown's options with ones derived from the loaded
         * data, so the list cannot drift from the content. The leading
         * "All …" row is kept, and a selection that survives the rebuild is
         * kept too — a refetch should not silently drop the active filter.
         */
        setOptions: (filter, options) => {
            const group = Array.from(bar.querySelectorAll('.filter-bar__group')).find(
                candidate => {
                    const chip = candidate.querySelector('.filter-chip');
                    return chip && chip.dataset.filter === filter;
                }
            );
            if (!group) return;
            const dropdown = group.querySelector('.filter-dropdown');
            if (!dropdown) return;

            const allOption = dropdown.querySelector('[role="option"][data-value=""]');
            dropdown.replaceChildren();
            if (allOption) dropdown.appendChild(allOption);

            for (const { value, label } of options) {
                const option = doc.createElement('li');
                option.className = 'filter-dropdown__option';
                option.setAttribute('role', 'option');
                option.setAttribute('aria-selected', 'false');
                option.tabIndex = -1;
                option.dataset.value = value;
                option.dataset.label = label;
                option.textContent = label;
                option.addEventListener('click', () => {
                    state = selectOption(state, filter, option.dataset.value);
                    render();
                    closeDropdown(group.querySelector('.filter-chip'), dropdown);
                    group.querySelector('.filter-chip').focus();
                });
                dropdown.appendChild(option);
            }

            // Drop a selection the new data no longer offers.
            const values = new Set(options.map(option => option.value));
            if (state[filter] && !values.has(state[filter])) {
                state = { ...state, [filter]: null };
            }
            render();
        },
        /**
         * Sets a filter from outside the bar — used by the date picker, whose
         * chip has no option list of its own. Passing a null value clears it.
         */
        setFilter: (filter, value, label) => {
            if (!Object.prototype.hasOwnProperty.call(state, filter)) return;
            state = { ...state, [filter]: value || null };
            const chip = bar.querySelector(`.filter-chip[data-filter="${filter}"]`);
            if (chip) {
                if (value) {
                    chip.dataset.selectedLabel = label || '';
                } else {
                    delete chip.dataset.selectedLabel;
                }
            }
            render();
        },
    };
}

// === BOOTSTRAP ===

if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        if (!window.REDESIGN_FLAG || !window.REDESIGN_FLAG.isEnabled()) return;
        const controller = initFilters(document);
        if (!controller) return;
        window.NycFilters = controller;

        // Mount the date picker into the dates chip's panel, when both the
        // chip and the picker module are present on this page.
        const datesPanel = document.querySelector('.filter-dropdown--dates');
        const datesChip = document.querySelector('.filter-chip[data-filter="dates"]');
        if (datesPanel && datesChip && window.NycDatePicker) {
            const picker = window.NycDatePicker.initDatePicker(document, datesChip, datesPanel, {
                onApply: (value, label) => {
                    controller.setFilter('dates', value, label);
                    datesPanel.hidden = true;
                    datesChip.setAttribute('aria-expanded', 'false');
                    datesChip.focus();
                },
                onClear: () => controller.setFilter('dates', null),
            });
            // Clear all resets the calendar as well as the chip.
            document.addEventListener('filters:change', event => {
                if (!event.detail.state.dates) picker.reset();
            });
        }
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
