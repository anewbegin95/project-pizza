/**
 * Consent module unit tests (issue #396, part of the #160 analytics PRD).
 *
 * Covers the state machine, its storage, and the browser opt-out signals.
 * The banner's rendered behaviour lives in `tests/e2e/consent.spec.js` — this
 * file only asserts, statically, that its stylesheet is NOT gated behind the
 * redesign flag, because that gate is the single failure mode that would
 * silently disable consent on the live site.
 */
const fs = require('node:fs')
const path = require('node:path')

const {
  STORAGE_KEY,
  STATES,
  readStoredState,
  hasOptOutSignal,
  resolveState,
  createConsent,
} = require('../../resources/js/consent.js')

const projectRoot = path.resolve(__dirname, '..', '..')

function read(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), 'utf8')
}

function expectCssToMatch(css, pattern) {
  const regexSpecialCharacters = new Set(['\\', '^', '$', '.', '*', '+', '?', '(', ')', '[', ']', '{', '}', '|'])
  const escapedPattern = [...pattern]
    .map((character) => (regexSpecialCharacters.has(character) ? `\\${character}` : character))
    .join('')
  expect(css).toMatch(new RegExp(escapedPattern.replaceAll(/\s+/g, '\\s*')))
}

/** Minimal Storage stand-in. `entries` exposes what was actually persisted. */
function createStorage(initial = {}) {
  const data = new Map(Object.entries(initial))
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => { data.set(key, String(value)) },
    removeItem: (key) => { data.delete(key) },
    entries: data,
  }
}

/** Storage that throws on every access, as Safari does with storage disabled. */
function createHostileStorage() {
  return {
    getItem: () => { throw new Error('SecurityError: storage is disabled') },
    setItem: () => { throw new Error('SecurityError: storage is disabled') },
    removeItem: () => { throw new Error('SecurityError: storage is disabled') },
  }
}

function createConsentFor({ storage = createStorage(), navigator = {}, doc = new EventTarget() } = {}) {
  return { consent: createConsent({ storage, navigator, document: doc }), storage, doc }
}

describe('state machine', () => {
  it('starts unset when nothing has been chosen', () => {
    const { consent } = createConsentFor()
    expect(consent.getState()).toBe(STATES.UNSET)
  })

  it('moves unset -> granted on grant()', () => {
    const { consent } = createConsentFor()
    consent.grant()
    expect(consent.getState()).toBe(STATES.GRANTED)
  })

  it('moves unset -> denied on deny()', () => {
    const { consent } = createConsentFor()
    consent.deny()
    expect(consent.getState()).toBe(STATES.DENIED)
  })

  it('lets a granted visitor withdraw, which is the point of the footer link', () => {
    const { consent } = createConsentFor()
    consent.grant()
    consent.deny()
    expect(consent.getState()).toBe(STATES.DENIED)
  })
})

describe('persistence', () => {
  it('round-trips a granted choice through storage', () => {
    const storage = createStorage()
    createConsent({ storage, navigator: {}, document: new EventTarget() }).grant()

    const reloaded = createConsent({ storage, navigator: {}, document: new EventTarget() })
    expect(reloaded.getState()).toBe(STATES.GRANTED)
  })

  it('round-trips a denied choice through storage, so it is never re-asked', () => {
    const storage = createStorage()
    createConsent({ storage, navigator: {}, document: new EventTarget() }).deny()

    const reloaded = createConsent({ storage, navigator: {}, document: new EventTarget() })
    expect(reloaded.getState()).toBe(STATES.DENIED)
    expect(reloaded.shouldShowBanner()).toBe(false)
  })

  it('falls back to unset when the key is absent', () => {
    expect(readStoredState(createStorage())).toBe(STATES.UNSET)
  })

  it('falls back to unset when the stored value is corrupt', () => {
    expect(readStoredState(createStorage({ [STORAGE_KEY]: 'maybe' }))).toBe(STATES.UNSET)
    expect(readStoredState(createStorage({ [STORAGE_KEY]: '{"state":"granted"}' }))).toBe(STATES.UNSET)
    expect(readStoredState(createStorage({ [STORAGE_KEY]: '' }))).toBe(STATES.UNSET)
  })

  // Opt-in means an unreadable store must fail closed, not open.
  it('falls back to unset when storage throws, and grant() does not blow up', () => {
    const consent = createConsent({ storage: createHostileStorage(), navigator: {}, document: new EventTarget() })
    expect(consent.getState()).toBe(STATES.UNSET)
    expect(() => consent.grant()).not.toThrow()
    expect(consent.getState()).toBe(STATES.UNSET)
  })
})

describe('browser opt-out signals', () => {
  it('reads Global Privacy Control', () => {
    expect(hasOptOutSignal({ globalPrivacyControl: true })).toBe(true)
    expect(hasOptOutSignal({ globalPrivacyControl: false })).toBe(false)
  })

  it('reads Do Not Track', () => {
    expect(hasOptOutSignal({ doNotTrack: '1' })).toBe(true)
    expect(hasOptOutSignal({ doNotTrack: 'yes' })).toBe(true)
  })

  // DNT "0" is an explicit opt-in to tracking, not an opt-out — but it is also
  // not consent, so it must leave the state alone rather than granting.
  it('treats Do Not Track "0" and an absent signal as no signal at all', () => {
    expect(hasOptOutSignal({ doNotTrack: '0' })).toBe(false)
    expect(hasOptOutSignal({ doNotTrack: null })).toBe(false)
    expect(hasOptOutSignal({})).toBe(false)
    expect(hasOptOutSignal(undefined)).toBe(false)
  })

  it('resolves GPC to denied without writing anything or offering a banner', () => {
    const { consent, storage } = createConsentFor({ navigator: { globalPrivacyControl: true } })
    expect(consent.getState()).toBe(STATES.DENIED)
    expect(consent.shouldShowBanner()).toBe(false)
    expect(storage.entries.size).toBe(0)
  })

  it('resolves DNT "1" to denied without writing anything or offering a banner', () => {
    const { consent, storage } = createConsentFor({ navigator: { doNotTrack: '1' } })
    expect(consent.getState()).toBe(STATES.DENIED)
    expect(consent.shouldShowBanner()).toBe(false)
    expect(storage.entries.size).toBe(0)
  })

  it('leaves DNT "0" at unset rather than reading it as consent', () => {
    const { consent } = createConsentFor({ navigator: { doNotTrack: '0' } })
    expect(consent.getState()).toBe(STATES.UNSET)
  })

  // The signal is a default for people who never answered. Someone who opened
  // the footer control and clicked Accept has answered, and an Accept button
  // that silently does nothing is the "controls that do not work" failure mode
  // the NY AG guide names. A stored choice therefore outranks the signal.
  it('lets a stored choice outrank the signal in both directions', () => {
    const grantedUnderGpc = createConsent({
      storage: createStorage({ [STORAGE_KEY]: STATES.GRANTED }),
      navigator: { globalPrivacyControl: true },
      document: new EventTarget(),
    })
    expect(grantedUnderGpc.getState()).toBe(STATES.GRANTED)

    const deniedWithoutSignal = createConsent({
      storage: createStorage({ [STORAGE_KEY]: STATES.DENIED }),
      navigator: {},
      document: new EventTarget(),
    })
    expect(deniedWithoutSignal.getState()).toBe(STATES.DENIED)
  })

  it('resolveState composes storage and signal without a module instance', () => {
    expect(resolveState(createStorage(), {})).toBe(STATES.UNSET)
    expect(resolveState(createStorage(), { globalPrivacyControl: true })).toBe(STATES.DENIED)
    expect(resolveState(createStorage({ [STORAGE_KEY]: STATES.GRANTED }), {})).toBe(STATES.GRANTED)
  })
})

describe('consent:change', () => {
  it('publishes the new state on grant', () => {
    const seen = []
    const doc = new EventTarget()
    doc.addEventListener('consent:change', (event) => seen.push(event.detail.state))

    createConsent({ storage: createStorage(), navigator: {}, document: doc }).grant()
    expect(seen).toEqual([STATES.GRANTED])
  })

  it('publishes the new state on deny', () => {
    const seen = []
    const doc = new EventTarget()
    doc.addEventListener('consent:change', (event) => seen.push(event.detail.state))

    createConsent({ storage: createStorage(), navigator: {}, document: doc }).deny()
    expect(seen).toEqual([STATES.DENIED])
  })

  it('publishes once per real change, not on a repeat of the same answer', () => {
    const seen = []
    const doc = new EventTarget()
    doc.addEventListener('consent:change', (event) => seen.push(event.detail.state))

    const consent = createConsent({ storage: createStorage(), navigator: {}, document: doc })
    consent.deny()
    consent.deny()
    consent.grant()
    expect(seen).toEqual([STATES.DENIED, STATES.GRANTED])
  })
})

describe('banner visibility rules', () => {
  it('offers the banner only to a visitor who has not answered and sends no signal', () => {
    const { consent } = createConsentFor()
    expect(consent.shouldShowBanner()).toBe(true)
  })

  it('stops offering it once the visitor answers, in either direction', () => {
    const granted = createConsentFor()
    granted.consent.grant()
    expect(granted.consent.shouldShowBanner()).toBe(false)

    const denied = createConsentFor()
    denied.consent.deny()
    expect(denied.consent.shouldShowBanner()).toBe(false)
  })
})

/** Comments have to name the flag to explain its absence; rules must not. */
function stripComments(source) {
  return source
    .replaceAll(/\/\*[\s\S]*?\*\//g, '')
    .replaceAll(/^[ \t]*\/\/.*$/gm, '')
}

describe('consent.css is deliberately ungated', () => {
  const css = read('resources/css/consent.css')
  const rules = stripComments(css)

  it('styles the bar with no redesign scoping', () => {
    expectCssToMatch(rules, '.nyc-consent {')
    expect(rules).not.toContain('data-redesign')
    expect(rules).not.toContain('redesign-enabled')
  })

  it('gives Accept and Decline one shared class with no appearance modifier', () => {
    expectCssToMatch(rules, '.nyc-consent__button {')
    expect(rules).not.toContain('.nyc-consent__button--')
  })

  it('pins the bar so it cannot shift layout', () => {
    expectCssToMatch(rules, 'position: fixed;')
  })

  // The comment is the guard rail: a future reader "fixing" the missing gate
  // has to delete a paragraph explaining why it is missing.
  it('records why the house gating rule is inverted here', () => {
    expect(css).toMatch(/NOT a redesign component/i)
  })
})

describe('consent.js is deliberately ungated', () => {
  const js = read('resources/js/consent.js')
  const code = stripComments(js)

  it('never consults the redesign flag', () => {
    expect(code).not.toContain('REDESIGN_FLAG')
    expect(code).not.toContain('isEnabled')
  })

  it('records why the house gating rule is inverted here', () => {
    expect(js).toMatch(/NOT a redesign component/i)
  })

  // Issue #396 ships the mechanism with the banner unrendered; nothing may
  // auto-show it until the activation PR.
  it('does not auto-render the banner at bootstrap', () => {
    expect(code.slice(code.indexOf("typeof window !== 'undefined'"))).not.toContain('renderBanner(')
  })
})

describe('the consent assets are loaded by every page', () => {
  const PAGES = [
    'index.html',
    'pop-ups.html',
    'date-ideas.html',
    'calendar.html',
    'pop-up.html',
    'date-idea.html',
    'about.html',
    'contact_us.html',
    'privacy_policy.html',
  ]

  PAGES.forEach((page) => {
    it(`${page} links the stylesheet and defers the script`, () => {
      const html = read(page)
      expect(html).toContain('resources/css/consent.css')
      expect(html).toMatch(/<script src="resources\/js\/consent\.js" defer><\/script>/)
    })
  })
})

describe('the footer offers a permanent way back', () => {
  const footer = read('partials/footer.html')

  it('carries a Cookie settings control the module can bind to', () => {
    expect(footer).toContain('data-consent-settings')
    expect(footer).toMatch(/Cookie settings/i)
  })

  // partials-loader.js injects the footer with insertAdjacentHTML, which never
  // runs <script> tags, and pop-ups.js re-injects it after its Sanity fetch.
  // A real <button> plus delegation from the module is what survives both.
  it('uses a real button rather than a link with no destination', () => {
    expect(footer).toMatch(/<button[^>]*data-consent-settings/)
    expect(footer).toMatch(/<button[^>]*type="button"/)
  })
})
