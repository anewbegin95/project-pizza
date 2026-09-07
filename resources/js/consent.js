/**
 * Consent management for analytics (issue #396, part of the #160 PRD).
 *
 * Exposes `window.NycConsent` with `getState()`, `grant()`, `deny()`,
 * `renderBanner(doc)` and `openSettings(doc)`, and publishes `consent:change`
 * on the document alongside the existing `filters:change` / `search:change`
 * seam convention.
 *
 * NOTHING CONSUMES THIS YET. The bootstrap deliberately does not render the
 * banner: showing a consent bar while the site sets no cookie and loads no
 * tracker would itself be the misrepresentation the NY AG's *Website Privacy
 * Controls* guide targets. Issue 3 of #160 adds the one line that renders it,
 * in the same PR that rewrites privacy_policy.html.
 *
 * ---------------------------------------------------------------------------
 * THIS IS NOT A REDESIGN COMPONENT — DO NOT ADD A FLAG GATE.
 * ---------------------------------------------------------------------------
 * CLAUDE.md's house rule is that every new component is gated in both halves:
 * CSS scoped to `:root[data-redesign='on']`, JS bootstraps returning early
 * unless `window.REDESIGN_FLAG` says the redesign is on. That rule is inverted
 * here, on purpose.
 *
 * The redesign flag defaults OFF in every environment, and the redesign itself
 * is parked (#403). Gating consent behind it would mean that on the live site
 * the banner never renders, the footer control does nothing, and — once the
 * analytics loader lands — the site would either track everyone with no way to
 * refuse, or track nobody while displaying nothing. Both are compliance
 * failures, and neither would show up in a flag-on test run.
 *
 * Consent is a property of the site, not of a design. It renders in both flag
 * states on all nine pages. `resources/css/consent.css` carries the same note.
 */
(function createConsentModule(globalScope) {
  'use strict';

  const STORAGE_KEY = 'nyc-consent';

  const STATES = {
    GRANTED: 'granted',
    DENIED: 'denied',
    UNSET: 'unset',
  };

  const STORABLE_STATES = [STATES.GRANTED, STATES.DENIED];

  const BANNER_CLASS = 'nyc-consent';
  const BANNER_ID = 'nyc-consent-banner';
  const SETTINGS_SELECTOR = '[data-consent-settings]';
  const CHANGE_EVENT = 'consent:change';

  const BANNER_LABEL = 'Cookie and analytics consent';
  const BANNER_MESSAGE = 'We would like to use Google Analytics to see which pop-ups and pages people '
    + 'actually find useful. Nothing is loaded and nothing is stored unless you accept, and you can '
    + 'change your mind at any time from the “Cookie settings” link in the footer.';
  const PRIVACY_POLICY_HREF = '/privacy_policy.html';
  const PRIVACY_POLICY_TEXT = 'Read our Privacy Policy';

  /**
   * Reads the stored choice. Anything that is not one of the two storable
   * states — absent, corrupt, or a value written by an older build — reads as
   * `unset`, which under an opt-in model means "not tracked". Storage access
   * itself can throw (Safari with site data disabled), so it fails closed.
   */
  function readStoredState(storage) {
    if (!storage || typeof storage.getItem !== 'function') {
      return STATES.UNSET;
    }
    try {
      const stored = storage.getItem(STORAGE_KEY);
      return STORABLE_STATES.includes(stored) ? stored : STATES.UNSET;
    } catch {
      return STATES.UNSET;
    }
  }

  /** Persists a choice, or silently gives up when storage is unavailable. */
  function writeStoredState(storage, state) {
    if (!storage || typeof storage.setItem !== 'function') {
      return false;
    }
    if (!STORABLE_STATES.includes(state)) {
      return false;
    }
    try {
      storage.setItem(STORAGE_KEY, state);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Global Privacy Control or Do Not Track. Either one is an answer already
   * given, so the banner is never shown to a visitor who sends one — asking
   * again is the dark pattern.
   *
   * `doNotTrack` of "0" is an explicit opt-in to tracking. It is not an
   * opt-out, but neither is it consent, so it reads as no signal at all.
   */
  function hasOptOutSignal(navigatorLike) {
    if (!navigatorLike) {
      return false;
    }
    if (navigatorLike.globalPrivacyControl === true) {
      return true;
    }
    const doNotTrack = navigatorLike.doNotTrack;
    return doNotTrack === '1' || doNotTrack === 'yes' || doNotTrack === 1;
  }

  /**
   * The signal is a default for people who have never answered, not a veto over
   * people who have. Someone who opened the footer control and clicked Accept
   * has answered; an Accept button that silently did nothing would be the
   * "controls that do not actually work" failure mode the AG guide names.
   * A stored choice therefore outranks the signal, in both directions.
   */
  function resolveState(storage, navigatorLike) {
    const stored = readStoredState(storage);
    if (stored !== STATES.UNSET) {
      return stored;
    }
    return hasOptOutSignal(navigatorLike) ? STATES.DENIED : STATES.UNSET;
  }

  function createElement(doc, tagName, className) {
    const element = doc.createElement(tagName);
    if (className) {
      element.className = className;
    }
    return element;
  }

  /**
   * Builds the bar. Accept and Decline are the same element with the same
   * single class and no modifier, so they cannot drift apart into a styled
   * primary action and a de-emphasised refusal.
   */
  function buildBanner(doc) {
    const banner = createElement(doc, 'div', BANNER_CLASS);
    banner.id = BANNER_ID;
    banner.setAttribute('role', 'region');
    banner.setAttribute('aria-label', BANNER_LABEL);

    const inner = createElement(doc, 'div', 'nyc-consent__inner');

    const message = createElement(doc, 'p', 'nyc-consent__message');
    message.textContent = `${BANNER_MESSAGE} `;

    const policyLink = createElement(doc, 'a', 'nyc-consent__link');
    policyLink.setAttribute('href', PRIVACY_POLICY_HREF);
    policyLink.textContent = PRIVACY_POLICY_TEXT;
    message.appendChild(policyLink);

    const actions = createElement(doc, 'div', 'nyc-consent__actions');
    ['accept', 'decline'].forEach((action) => {
      const button = createElement(doc, 'button', 'nyc-consent__button');
      button.type = 'button';
      button.dataset.consentAction = action;
      button.textContent = action === 'accept' ? 'Accept' : 'Decline';
      actions.appendChild(button);
    });

    inner.appendChild(message);
    inner.appendChild(actions);
    banner.appendChild(inner);
    return banner;
  }

  function createConsent(options) {
    const settings = options || {};
    const storage = settings.storage;
    const navigatorLike = settings.navigator;
    const boundDocument = settings.document;

    function getState() {
      return resolveState(storage, navigatorLike);
    }

    /**
     * True only for a visitor who has neither answered nor sent a signal.
     * `denied` is permanent and `granted` needs no confirming, so this is what
     * keeps the site from ever re-prompting.
     */
    function shouldShowBanner() {
      return getState() === STATES.UNSET;
    }

    function publish(doc, state) {
      const target = doc || boundDocument;
      if (!target || typeof target.dispatchEvent !== 'function') {
        return;
      }
      target.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: { state } }));
    }

    function setState(state, doc) {
      const previous = getState();
      writeStoredState(storage, state);
      const next = getState();
      if (next !== previous) {
        publish(doc, next);
      }
      dismissBanner(doc);
      return next;
    }

    function grant(doc) {
      return setState(STATES.GRANTED, doc);
    }

    function deny(doc) {
      return setState(STATES.DENIED, doc);
    }

    function dismissBanner(doc) {
      const target = doc || boundDocument;
      if (!target || typeof target.getElementById !== 'function') {
        return;
      }
      const existing = target.getElementById(BANNER_ID);
      if (existing && existing.parentNode) {
        existing.parentNode.removeChild(existing);
      }
    }

    function mountBanner(doc) {
      const target = doc || boundDocument;
      if (!target || !target.body) {
        return null;
      }
      const existing = target.getElementById(BANNER_ID);
      if (existing) {
        return existing;
      }

      const banner = buildBanner(target);
      banner.addEventListener('click', (event) => {
        const button = event.target.closest('[data-consent-action]');
        if (!button) {
          return;
        }
        if (button.dataset.consentAction === 'accept') {
          grant(target);
        } else {
          deny(target);
        }
      });

      target.body.appendChild(banner);
      return banner;
    }

    /**
     * Mounts the bar only for a visitor who still has a choice to make.
     * Returns the element, or null when the visitor has already answered or
     * sent an opt-out signal.
     */
    function renderBanner(doc) {
      if (!shouldShowBanner()) {
        return null;
      }
      return mountBanner(doc);
    }

    /**
     * The footer control. Unlike `renderBanner` this always mounts: the visitor
     * asked to see it, which is the opposite of the site re-prompting them, and
     * withdrawal has to be exactly as easy as granting was.
     */
    function openSettings(doc) {
      return mountBanner(doc);
    }

    return {
      STATES,
      getState,
      grant,
      deny,
      shouldShowBanner,
      renderBanner,
      openSettings,
      dismissBanner,
    };
  }

  /**
   * The footer is fetched and injected with `insertAdjacentHTML`, and pop-ups.js
   * re-injects it after its Sanity fetch resolves, so there is no element to
   * bind to at bootstrap and any element bound to could be replaced later.
   * Delegation from the document survives both.
   */
  function bindSettingsControl(doc, consent) {
    if (!doc || typeof doc.addEventListener !== 'function') {
      return;
    }
    doc.addEventListener('click', (event) => {
      const target = event.target;
      if (!target || typeof target.closest !== 'function') {
        return;
      }
      if (!target.closest(SETTINGS_SELECTOR)) {
        return;
      }
      event.preventDefault();
      consent.openSettings(doc);
    });
  }

  /** localStorage getter that survives browsers where touching it throws. */
  function getLocalStorage(scope) {
    try {
      return scope.localStorage;
    } catch {
      return null;
    }
  }

  const api = {
    STORAGE_KEY,
    STATES,
    readStoredState,
    writeStoredState,
    hasOptOutSignal,
    resolveState,
    buildBanner,
    createConsent,
    bindSettingsControl,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  if (typeof window !== 'undefined') {
    window.nycConsentModule = api;
    window.NycConsent = createConsent({
      storage: getLocalStorage(window),
      navigator: window.navigator,
      document: window.document,
    });
    bindSettingsControl(window.document, window.NycConsent);
    // No banner is mounted here, on purpose — see the header comment. Issue 3
    // of #160 is what turns it on.
  }
}(typeof globalThis !== 'undefined' ? globalThis : this));
