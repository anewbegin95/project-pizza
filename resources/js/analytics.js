/**
 * GA4 loader, gated on consent (issue #398, part of the #160 analytics PRD).
 *
 * Exposes `window.NycAnalytics` and subscribes to the `consent:change` event
 * published by `resources/js/consent.js`. It never reads localStorage itself
 * and never polls: the consent module owns the state, this module only reacts
 * to it.
 *
 * THE CONTRACT, in one line: on anything other than `granted`, this file does
 * nothing at all — no script tag, no dataLayer, no cookie, no beacon, no
 * network request of any kind. Under an opt-in model "we set no cookie" is a
 * much weaker claim than "we sent nothing", and it is the stronger one that
 * `privacy_policy.html` now makes on the site's behalf.
 *
 * ---------------------------------------------------------------------------
 * THIS IS NOT A REDESIGN COMPONENT — DO NOT ADD A FLAG GATE.
 * ---------------------------------------------------------------------------
 * CLAUDE.md's house rule gates every new component in both halves. That rule is
 * inverted here for the same reason it is inverted in consent.js: the redesign
 * flag is OFF in every environment and the redesign is parked (#403). A gate
 * here would leave the live site showing a consent bar whose "Accept" loads
 * nothing — the "controls that do not actually work" failure mode the NY AG's
 * *Website Privacy Controls* guide names, and the exact thing the banner exists
 * to avoid. `redesign_flag` is *reported* as a page_view parameter; it is never
 * consulted as a condition.
 *
 * Note on withdrawal: gtag.js cannot be torn out of a page once it has loaded.
 * What is possible — and what this does — is to set Google's own
 * `ga-disable-<id>` switch, which halts every further send, and to expire the
 * `_ga*` cookies. The privacy policy describes exactly that, rather than
 * claiming a teardown that no browser can perform without a reload.
 */
(function createAnalyticsModule(globalScope) {
  'use strict';

  const MEASUREMENT_ID = 'G-JYLM80LHT2';
  const GTAG_ORIGIN = 'https://www.googletagmanager.com';
  const GTAG_SRC = `${GTAG_ORIGIN}/gtag/js?id=${MEASUREMENT_ID}`;
  const SCRIPT_ID = 'nyc-ga4-loader';
  const DISABLE_KEY = `ga-disable-${MEASUREMENT_ID}`;

  const CONSENT_EVENT = 'consent:change';
  const GRANTED = 'granted';

  const GA_COOKIE_PREFIX = '_ga';
  const EXPIRED = 'Thu, 01 Jan 1970 00:00:00 GMT';

  /**
   * `page_type` values are permanent: GA4 does not rewrite historical data, so
   * a rename later leaves a discontinuity that has to be explained forever
   * (§5). Anything unmapped reports `other` rather than leaking a raw path.
   */
  const PAGE_TYPES = {
    '': 'home',
    'index.html': 'home',
    'pop-ups.html': 'popups',
    'pop-up.html': 'popup_detail',
    'date-ideas.html': 'date_ideas',
    'date-idea.html': 'date_idea_detail',
    'calendar.html': 'calendar',
    'about.html': 'about',
    'contact_us.html': 'contact',
    'privacy_policy.html': 'privacy',
  };

  function derivePageType(pathname) {
    if (typeof pathname !== 'string' || pathname === '') {
      return 'other';
    }
    const file = pathname.slice(pathname.lastIndexOf('/') + 1).toLowerCase();
    return Object.prototype.hasOwnProperty.call(PAGE_TYPES, file) ? PAGE_TYPES[file] : 'other';
  }

  /**
   * `env` is what excludes staging traffic from every report (§5). It comes
   * from the `data-env` attribute `redesign-flag.js` writes, deliberately kept
   * when the rest of the parked redesign was unloaded (#402).
   */
  function readEnv(documentLike) {
    if (!documentLike || !documentLike.documentElement) {
      return 'unknown';
    }
    return documentLike.documentElement.getAttribute('data-env') || 'unknown';
  }

  /** Reported, never consulted as a gate — see the header comment. */
  function readRedesignFlag(scope) {
    return Boolean(scope && scope.REDESIGN_FLAG && scope.REDESIGN_FLAG.enabled === true);
  }

  /**
   * GA sets its cookies on the registrable domain, so clearing has to be tried
   * against the host and each of its parents. Writing to a domain that does not
   * apply is a no-op, which makes the shotgun safe.
   */
  function domainCandidates(hostname) {
    if (typeof hostname !== 'string' || hostname === '') {
      return [];
    }
    const labels = hostname.split('.');
    const candidates = [];
    for (let index = 0; index <= labels.length - 2; index += 1) {
      const domain = labels.slice(index).join('.');
      candidates.push(domain, `.${domain}`);
    }
    return candidates;
  }

  /**
   * Expires every `_ga*` cookie. Returns the names it acted on, and writes
   * nothing at all when there are none — a visitor who declined without ever
   * granting should not have a cookie written at them in order to delete one.
   */
  function expireAnalyticsCookies(documentLike, hostname) {
    if (!documentLike || typeof documentLike.cookie !== 'string') {
      return [];
    }

    const names = documentLike.cookie
      .split(';')
      .map((entry) => entry.split('=')[0].trim())
      .filter((name) => name.startsWith(GA_COOKIE_PREFIX));

    if (names.length === 0) {
      return [];
    }

    const domains = domainCandidates(hostname);
    names.forEach((name) => {
      documentLike.cookie = `${name}=; expires=${EXPIRED}; path=/`;
      domains.forEach((domain) => {
        documentLike.cookie = `${name}=; expires=${EXPIRED}; path=/; domain=${domain}`;
      });
    });

    return names;
  }

  function createAnalytics(options) {
    const settings = options || {};
    const doc = settings.document;
    const scope = settings.scope;
    const consent = settings.consent;
    const locationLike = settings.location || {};

    let loaded = false;
    let active = false;

    function sharedParameters() {
      return {
        page_type: derivePageType(locationLike.pathname),
        env: readEnv(doc),
        redesign_flag: readRedesignFlag(scope),
      };
    }

    function injectLoader() {
      if (loaded || !doc || typeof doc.createElement !== 'function') {
        return;
      }
      if (typeof doc.getElementById === 'function' && doc.getElementById(SCRIPT_ID)) {
        loaded = true;
        return;
      }

      const script = doc.createElement('script');
      script.id = SCRIPT_ID;
      script.async = true;
      script.src = GTAG_SRC;

      const parent = doc.head || doc.documentElement;
      if (!parent || typeof parent.appendChild !== 'function') {
        return;
      }
      parent.appendChild(script);
      loaded = true;
    }

    function ensureGtag() {
      scope.dataLayer = scope.dataLayer || [];
      if (typeof scope.gtag !== 'function') {
        scope.gtag = function gtag() {
          scope.dataLayer.push(arguments);
        };
      }
      return scope.gtag;
    }

    function activate() {
      if (active) {
        return;
      }
      active = true;

      scope[DISABLE_KEY] = false;
      injectLoader();

      const gtag = ensureGtag();
      const parameters = sharedParameters();

      gtag('js', new Date());
      gtag('config', MEASUREMENT_ID, Object.assign({
        // No ads signals, no cross-device or demographic inference (§3.2), and
        // no automatic decoration of outbound links with a client id.
        anonymize_ip: true,
        allow_google_signals: false,
        allow_ad_personalization_signals: false,
        allow_linker: false,
        // Tiles, carousel slides and calendar bars assign window.location.href
        // synchronously, which can cut off an in-flight XHR beacon (§2.4).
        transport_type: 'beacon',
        // Sent explicitly below instead, so there is exactly one page_view and
        // its parameters are visible at the call site.
        send_page_view: false,
      }, parameters));
      gtag('event', 'page_view', parameters);
    }

    /**
     * Runs for `denied`, `unset`, and anything unrecognised. When nothing was
     * ever loaded this is pure bookkeeping: no dataLayer is created and no
     * cookie is written.
     */
    function deactivate() {
      active = false;
      scope[DISABLE_KEY] = true;
      expireAnalyticsCookies(doc, locationLike.hostname);
    }

    /**
     * The one way a custom event reaches GA4 (#399). `active` is the consent
     * gate, so keeping the send here rather than letting the events module call
     * `window.gtag` itself keeps that gate in a single file — a second call
     * site would be a second thing to get wrong, on the one control the NY AG
     * guide says has to actually work.
     *
     * `page_type` and `env` are deliberately absent: they ride the `config`
     * call above, so GA4 stamps them onto every event from this page already.
     *
     * Returns whether anything was sent, which is what makes the refusal path
     * testable rather than merely invisible.
     */
    function track(name, parameters) {
      if (!active || typeof name !== 'string' || name === '') {
        return false;
      }
      const gtag = ensureGtag();
      gtag('event', name, Object.assign({}, parameters));
      return true;
    }

    function handleState(state) {
      if (state === GRANTED) {
        activate();
      } else {
        deactivate();
      }
    }

    function start() {
      if (doc && typeof doc.addEventListener === 'function') {
        doc.addEventListener(CONSENT_EVENT, (event) => {
          handleState(event && event.detail ? event.detail.state : null);
        });
      }
      handleState(consent && typeof consent.getState === 'function' ? consent.getState() : null);
    }

    return {
      start,
      handleState,
      track,
      isLoaded: () => loaded,
      isActive: () => active,
    };
  }

  const api = {
    MEASUREMENT_ID,
    GTAG_SRC,
    SCRIPT_ID,
    DISABLE_KEY,
    PAGE_TYPES,
    derivePageType,
    readEnv,
    readRedesignFlag,
    domainCandidates,
    expireAnalyticsCookies,
    createAnalytics,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  if (typeof window !== 'undefined') {
    window.nycAnalyticsModule = api;
    window.NycAnalytics = createAnalytics({
      document: window.document,
      scope: window,
      consent: window.NycConsent,
      location: window.location,
    });
    window.NycAnalytics.start();
  }
}(typeof globalThis !== 'undefined' ? globalThis : this));
