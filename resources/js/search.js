// Shared search bar and List/Map view toggle for the redesigned discovery
// pages. Behaviour is gated on the redesign flag; data filtering lives
// elsewhere (see REDESIGN.md section 6.2).

// === CONSTANTS ===

/** View modes offered by the toggle, in display order. */
const VIEWS = ['list', 'map'];

const ACTIVE_BUTTON_CLASS = 'view-toggle__btn--active';

// === PURE HELPERS ===

function isValidView(view) {
    return VIEWS.includes(view);
}

/**
 * Resolves the toggle's next state. Requesting the active view, or an unknown
 * view, leaves the current view untouched.
 * @returns {{view: string, changed: boolean}}
 */
function getNextToggleState(currentView, requestedView) {
    if (!isValidView(requestedView) || requestedView === currentView) {
        return { view: currentView, changed: false };
    }
    return { view: requestedView, changed: true };
}

/** Reflects the active view onto the toggle buttons (class + aria-pressed). */
function applyToggleState(buttons, activeView) {
    buttons.forEach(button => {
        const isActive = button.dataset.view === activeView;
        if (isActive) {
            button.classList.add(ACTIVE_BUTTON_CLASS);
        } else {
            button.classList.remove(ACTIVE_BUTTON_CLASS);
        }
        button.setAttribute('aria-pressed', String(isActive));
    });
}

/** Normalizes a raw search query for case-insensitive matching later. */
function normalizeSearchInput(value) {
    return String(value == null ? '' : value)
        .trim()
        .replace(/\s+/g, ' ')
        .toLowerCase();
}

// === DOM WIRING ===

/**
 * Wires the view toggle and search input within the given document. Emits
 * `viewtoggle:change` and `search:change` so filtering/map code can react
 * without this module knowing about them.
 */
function initSearchBar(doc) {
    const container = doc.querySelector('.search-bar-container');
    if (!container) return null;

    const buttons = Array.from(container.querySelectorAll('.view-toggle__btn'));
    const input = container.querySelector('.search-bar__input');
    let currentView = VIEWS[0];

    buttons.forEach(button => {
        button.addEventListener('click', () => {
            const next = getNextToggleState(currentView, button.dataset.view);
            if (!next.changed) return;
            currentView = next.view;
            applyToggleState(buttons, currentView);
            container.dispatchEvent(
                new CustomEvent('viewtoggle:change', {
                    bubbles: true,
                    detail: { view: currentView },
                })
            );
        });
    });

    if (buttons.length > 0) applyToggleState(buttons, currentView);

    if (input) {
        input.addEventListener('input', () => {
            container.dispatchEvent(
                new CustomEvent('search:change', {
                    bubbles: true,
                    detail: { query: normalizeSearchInput(input.value) },
                })
            );
        });
    }

    return { getView: () => currentView };
}

// === BOOTSTRAP ===

if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        if (!window.REDESIGN_FLAG || !window.REDESIGN_FLAG.isEnabled()) return;
        initSearchBar(document);
    });
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        VIEWS,
        isValidView,
        getNextToggleState,
        applyToggleState,
        normalizeSearchInput,
        initSearchBar,
    };
}
