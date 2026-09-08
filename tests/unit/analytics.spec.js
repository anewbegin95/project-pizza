/**
 * GA4 loader unit tests (issue #398, part of the #160 analytics PRD).
 *
 * The loader is the enforcement point for the whole compliance posture: under
 * an opt-in model, "denied" and "unset" have to mean *no network activity at
 * all*, not merely "no cookie". Every assertion below is written against that
 * reading, and the module is dependency-injected so those paths can be tested
 * without a browser.
 *
 * The last two describes are static file assertions rather than behaviour:
 * they guard the two ways this could be silently switched off — a redesign
 * flag gate on the loader, and the false sentence returning to the privacy
 * policy.
 */
const fs = require('node:fs')
const path = require('node:path')

const {
  MEASUREMENT_ID,
  GTAG_SRC,
  SCRIPT_ID,
  derivePageType,
  readEnv,
  readRedesignFlag,
  createAnalytics,
} = require('../../resources/js/analytics.js')

const projectRoot = path.resolve(__dirname, '..', '..')

function read(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), 'utf8')
}

/** Comments have to name the flag to explain its absence; rules must not. */
function stripComments(source) {
  return source
    .replaceAll(/\/\*[\s\S]*?\*\//g, '')
    .replaceAll(/^[ \t]*\/\/.*$/gm, '')
}

/**
 * Applies a `document.cookie` write to a jar the way a browser would, so that
 * an expiry in the past actually removes the entry. Without this, "clears the
 * cookies" could pass on a module that merely wrote a string somewhere.
 */
function applyCookieWrite(jar, write) {
  const [pair, ...attributes] = String(write).split(';')
  const separator = pair.indexOf('=')
  if (separator === -1) {
    return
  }
  const name = pair.slice(0, separator).trim()
  const value = pair.slice(separator + 1).trim()

  const expires = attributes
    .map((attribute) => attribute.trim())
    .find((attribute) => attribute.toLowerCase().startsWith('expires='))
  const maxAge = attributes
    .map((attribute) => attribute.trim())
    .find((attribute) => attribute.toLowerCase().startsWith('max-age='))

  const expired = (expires && new Date(expires.slice('expires='.length)).getTime() <= Date.now())
    || (maxAge && Number(maxAge.slice('max-age='.length)) <= 0)

  if (expired) {
    jar.delete(name)
    return
  }
  jar.set(name, value)
}

function createFakeDocument({ env = 'production', cookies = {} } = {}) {
  const bus = new EventTarget()
  const injected = []
  const jar = new Map(Object.entries(cookies))

  const doc = {
    documentElement: {
      getAttribute: (name) => (name === 'data-env' ? env : null),
    },
    head: {
      appendChild(node) {
        injected.push(node)
        return node
      },
    },
    createElement(tagName) {
      return {
        tagName: String(tagName).toUpperCase(),
        setAttribute(name, value) { this[name] = value },
      }
    },
    getElementById: (id) => injected.find((node) => node.id === id) || null,
    addEventListener: (...args) => bus.addEventListener(...args),
    removeEventListener: (...args) => bus.removeEventListener(...args),
    dispatchEvent: (...args) => bus.dispatchEvent(...args),
    injected,
    cookieWrites: [],
    cookieJar: jar,
  }

  Object.defineProperty(doc, 'cookie', {
    get: () => [...jar].map(([name, value]) => `${name}=${value}`).join('; '),
    set: (value) => {
      doc.cookieWrites.push(value)
      applyCookieWrite(jar, value)
    },
  })

  return doc
}

/** Stand-in for `window.NycConsent`: only `getState` is consumed. */
function createStubConsent(state = 'unset') {
  return {
    current: state,
    getState() { return this.current },
  }
}

function setUp({ state = 'unset', pathname = '/pop-ups.html', env = 'production', redesign = false, cookies = {} } = {}) {
  const doc = createFakeDocument({ env, cookies })
  const consent = createStubConsent(state)
  const scope = { REDESIGN_FLAG: { enabled: redesign, environment: env } }
  const analytics = createAnalytics({
    document: doc,
    scope,
    consent,
    location: { pathname, hostname: 'nycsliceoflife.com' },
  })
  return { doc, consent, scope, analytics }
}

/** Publishes the event the consent module publishes, with the same shape. */
function publishConsent(doc, state) {
  doc.dispatchEvent(new CustomEvent('consent:change', { detail: { state } }))
}

function loaderScripts(doc) {
  return doc.injected.filter((node) => node.src === GTAG_SRC)
}

function dataLayerCalls(scope) {
  return (scope.dataLayer || []).map((entry) => [...entry])
}

describe('nothing loads without consent', () => {
  it('injects no script and defines no gtag global when the visitor has not answered', () => {
    const { doc, scope, analytics } = setUp({ state: 'unset' })
    analytics.start()

    expect(doc.injected).toEqual([])
    expect(scope.gtag).toBeUndefined()
    expect(scope.dataLayer).toBeUndefined()
    expect(analytics.isLoaded()).toBe(false)
  })

  it('injects no script and defines no gtag global when the visitor declined', () => {
    const { doc, scope, analytics } = setUp({ state: 'denied' })
    analytics.start()

    expect(doc.injected).toEqual([])
    expect(scope.gtag).toBeUndefined()
    expect(scope.dataLayer).toBeUndefined()
  })

  // A decline arriving as an event has to be as inert as a decline read from
  // storage at bootstrap; the banner path is the one most visitors take.
  it('stays inert when a decline arrives over consent:change', () => {
    const { doc, scope, analytics } = setUp({ state: 'unset' })
    analytics.start()
    publishConsent(doc, 'denied')

    expect(doc.injected).toEqual([])
    expect(scope.gtag).toBeUndefined()
    expect(doc.cookieWrites).toEqual([])
  })

  it('touches nothing when consent:change carries an unrecognised state', () => {
    const { doc, scope, analytics } = setUp({ state: 'unset' })
    analytics.start()
    publishConsent(doc, 'probably')

    expect(doc.injected).toEqual([])
    expect(scope.gtag).toBeUndefined()
  })
})

describe('loading on grant', () => {
  it('injects the gtag loader once a grant arrives', () => {
    const { doc, analytics } = setUp({ state: 'unset' })
    analytics.start()
    publishConsent(doc, 'granted')

    const scripts = loaderScripts(doc)
    expect(scripts).toHaveLength(1)
    expect(scripts[0].async).toBe(true)
    expect(scripts[0].src).toContain(MEASUREMENT_ID)
    expect(analytics.isLoaded()).toBe(true)
  })

  it('loads immediately for a visitor who granted on an earlier visit', () => {
    const { doc, analytics } = setUp({ state: 'granted' })
    analytics.start()

    expect(loaderScripts(doc)).toHaveLength(1)
  })

  // The footer control can be opened and answered any number of times, and
  // pop-ups.js re-injects the footer, so repeats are the normal case.
  it('injects exactly once however many times the grant repeats', () => {
    const { doc, analytics } = setUp({ state: 'unset' })
    analytics.start()
    publishConsent(doc, 'granted')
    publishConsent(doc, 'granted')
    publishConsent(doc, 'granted')

    expect(loaderScripts(doc)).toHaveLength(1)
    expect(doc.injected).toHaveLength(1)
  })

  it('does not re-inject after a withdrawal and a fresh grant', () => {
    const { doc, analytics } = setUp({ state: 'unset' })
    analytics.start()
    publishConsent(doc, 'granted')
    publishConsent(doc, 'denied')
    publishConsent(doc, 'granted')

    expect(loaderScripts(doc)).toHaveLength(1)
  })
})

describe('the configuration sent to GA4', () => {
  it('turns off ads signals, personalisation and outbound link decoration', () => {
    const { doc, scope, analytics } = setUp({ state: 'granted' })
    analytics.start()

    const config = dataLayerCalls(scope).find((call) => call[0] === 'config')
    expect(config[1]).toBe(MEASUREMENT_ID)
    expect(config[2]).toMatchObject({
      anonymize_ip: true,
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
      allow_linker: false,
    })
  })

  // §2.4: tiles, slides and calendar bars assign window.location.href
  // synchronously, which can cut off an XHR beacon mid-flight.
  it('uses beacon transport so a synchronous navigation cannot cut off a send', () => {
    const { scope, analytics } = setUp({ state: 'granted' })
    analytics.start()

    const config = dataLayerCalls(scope).find((call) => call[0] === 'config')
    expect(config[2].transport_type).toBe('beacon')
  })

  it('sends page_view explicitly rather than twice', () => {
    const { scope, analytics } = setUp({ state: 'granted' })
    analytics.start()

    const config = dataLayerCalls(scope).find((call) => call[0] === 'config')
    expect(config[2].send_page_view).toBe(false)

    const pageViews = dataLayerCalls(scope).filter((call) => call[0] === 'event' && call[1] === 'page_view')
    expect(pageViews).toHaveLength(1)
  })
})

describe('page_view parameters', () => {
  it('carries page_type, env and redesign_flag', () => {
    const { scope, analytics } = setUp({
      state: 'granted',
      pathname: '/pop-ups.html',
      env: 'production',
      redesign: false,
    })
    analytics.start()

    const pageView = dataLayerCalls(scope).find((call) => call[0] === 'event' && call[1] === 'page_view')
    expect(pageView[2]).toMatchObject({
      page_type: 'popups',
      env: 'production',
      redesign_flag: false,
    })
  })

  it('reports redesign_flag true when the flag is on', () => {
    const { scope, analytics } = setUp({ state: 'granted', redesign: true })
    analytics.start()

    const pageView = dataLayerCalls(scope).find((call) => call[0] === 'event' && call[1] === 'page_view')
    expect(pageView[2].redesign_flag).toBe(true)
  })

  // `env` is what excludes staging traffic from every report (§5), so it has to
  // survive onto the shared config as well as the page_view itself.
  it('puts page_type and env on the config so later events inherit them', () => {
    const { scope, analytics } = setUp({ state: 'granted', pathname: '/calendar.html', env: 'staging' })
    analytics.start()

    const config = dataLayerCalls(scope).find((call) => call[0] === 'config')
    expect(config[2]).toMatchObject({ page_type: 'calendar', env: 'staging' })
  })

  it('sends a fresh page_view when a visitor grants mid-visit', () => {
    const { doc, scope, analytics } = setUp({ state: 'unset' })
    analytics.start()
    expect(scope.dataLayer).toBeUndefined()

    publishConsent(doc, 'granted')
    expect(dataLayerCalls(scope).filter((call) => call[1] === 'page_view')).toHaveLength(1)
  })
})

describe('page_type derivation', () => {
  it('maps every page of the live site to a stable name', () => {
    expect(derivePageType('/')).toBe('home')
    expect(derivePageType('/index.html')).toBe('home')
    expect(derivePageType('/pop-ups.html')).toBe('popups')
    expect(derivePageType('/pop-up.html')).toBe('popup_detail')
    expect(derivePageType('/date-ideas.html')).toBe('date_ideas')
    expect(derivePageType('/date-idea.html')).toBe('date_idea_detail')
    expect(derivePageType('/calendar.html')).toBe('calendar')
    expect(derivePageType('/about.html')).toBe('about')
    expect(derivePageType('/contact_us.html')).toBe('contact')
    expect(derivePageType('/privacy_policy.html')).toBe('privacy')
  })

  it('falls back to other rather than leaking an unexpected path', () => {
    expect(derivePageType('/some-new-page.html')).toBe('other')
    expect(derivePageType('')).toBe('other')
    expect(derivePageType(undefined)).toBe('other')
  })

  // GA4 event and parameter values are case-sensitive and permanent (§5).
  it('never returns a value that would need renaming later', () => {
    const paths = ['/', '/pop-ups.html', '/pop-up.html', '/date-ideas.html', '/date-idea.html',
      '/calendar.html', '/about.html', '/contact_us.html', '/privacy_policy.html', '/nope']
    paths.forEach((pathname) => {
      expect(derivePageType(pathname)).toMatch(/^[a-z][a-z0-9_]*$/)
    })
  })
})

describe('environment and flag reads', () => {
  it('reads env from the data-env attribute redesign-flag.js sets', () => {
    expect(readEnv(createFakeDocument({ env: 'staging' }))).toBe('staging')
  })

  it('falls back to unknown rather than reporting a wrong environment', () => {
    expect(readEnv({ documentElement: { getAttribute: () => null } })).toBe('unknown')
    expect(readEnv(null)).toBe('unknown')
  })

  it('reads the redesign flag without assuming it is present', () => {
    expect(readRedesignFlag({ REDESIGN_FLAG: { enabled: true } })).toBe(true)
    expect(readRedesignFlag({ REDESIGN_FLAG: { enabled: false } })).toBe(false)
    expect(readRedesignFlag({})).toBe(false)
    expect(readRedesignFlag(null)).toBe(false)
  })
})

describe('withdrawal after granting', () => {
  it('halts sends through Google’s own opt-out switch', () => {
    const { doc, scope, analytics } = setUp({ state: 'granted' })
    analytics.start()
    expect(scope[`ga-disable-${MEASUREMENT_ID}`]).toBe(false)

    publishConsent(doc, 'denied')
    expect(scope[`ga-disable-${MEASUREMENT_ID}`]).toBe(true)
    expect(analytics.isActive()).toBe(false)
  })

  it('clears the _ga cookies the grant caused to be set', () => {
    const { doc, analytics } = setUp({
      state: 'granted',
      cookies: { _ga: 'GA1.1.123', [`_ga_${MEASUREMENT_ID.slice(2)}`]: 'GS1.1.456', other_cookie: 'keep' },
    })
    analytics.start()
    publishConsent(doc, 'denied')

    expect(doc.cookieJar.has('_ga')).toBe(false)
    expect(doc.cookieJar.has(`_ga_${MEASUREMENT_ID.slice(2)}`)).toBe(false)
  })

  it('leaves cookies the site did not set alone', () => {
    const { doc, analytics } = setUp({ state: 'granted', cookies: { _ga: 'GA1.1.1', other_cookie: 'keep' } })
    analytics.start()
    publishConsent(doc, 'denied')

    expect(doc.cookieJar.get('other_cookie')).toBe('keep')
  })

  it('sends nothing further after a withdrawal', () => {
    const { doc, scope, analytics } = setUp({ state: 'granted' })
    analytics.start()
    const before = dataLayerCalls(scope).length

    publishConsent(doc, 'denied')
    expect(dataLayerCalls(scope).filter((call) => call[1] === 'page_view')).toHaveLength(1)
    expect(dataLayerCalls(scope).length).toBe(before)
  })

  it('resumes on a fresh grant by lifting the opt-out and re-sending page_view', () => {
    const { doc, scope, analytics } = setUp({ state: 'granted' })
    analytics.start()
    publishConsent(doc, 'denied')
    publishConsent(doc, 'granted')

    expect(scope[`ga-disable-${MEASUREMENT_ID}`]).toBe(false)
    expect(dataLayerCalls(scope).filter((call) => call[1] === 'page_view')).toHaveLength(2)
    expect(analytics.isActive()).toBe(true)
  })

  // Nothing was ever loaded, so there is nothing to clear and no reason to
  // write a cookie in order to delete one.
  it('writes no cookie when a visitor declines without ever granting', () => {
    const { doc, analytics } = setUp({ state: 'unset' })
    analytics.start()
    publishConsent(doc, 'denied')

    expect(doc.cookieWrites).toEqual([])
  })
})

describe('analytics.js is deliberately ungated', () => {
  const js = read('resources/js/analytics.js')
  const code = stripComments(js)

  // Same inversion as consent.js: the flag is off in every environment and the
  // redesign is parked (#403), so a gate here would mean the site either never
  // collects, or collects with a banner nobody can see.
  it('never consults the redesign flag as a gate', () => {
    expect(code).not.toContain('isEnabled')
    expect(code).not.toMatch(/REDESIGN_FLAG[^.]*\.enabled\s*\)\s*\{?\s*return/)
  })

  it('records why the house gating rule is inverted here', () => {
    expect(js).toMatch(/NOT a redesign component/i)
  })

  it('names no origin other than the two the CSP already allows', () => {
    const origins = code.match(/https:\/\/[a-z0-9.-]+/gi) || []
    origins.forEach((origin) => {
      expect(origin).toMatch(/^https:\/\/(www\.googletagmanager\.com|www\.google-analytics\.com)$/)
    })
  })
})

describe('the loader is shipped by every page, after consent.js', () => {
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
    it(`${page} defers the loader and orders it after the consent module`, () => {
      const html = read(page)
      expect(html).toMatch(/<script src="resources\/js\/analytics\.js" defer><\/script>/)
      // Deferred scripts run in document order, and the loader reads
      // NycConsent.getState() at bootstrap to serve a returning visitor.
      expect(html.indexOf('resources/js/analytics.js'))
        .toBeGreaterThan(html.indexOf('resources/js/consent.js'))
    })
  })
})

describe('the privacy policy tells the truth about GA4', () => {
  const html = read('privacy_policy.html')

  // Google's terms require the vendor named, the data, the retention period and
  // the consent basis. Generic boilerplate is a contractual violation (§3.5).
  it('names Google Analytics and Google LLC', () => {
    expect(html).toContain('Google Analytics')
    expect(html).toContain('Google LLC')
  })

  it('states the retention period and the consent basis', () => {
    expect(html).toMatch(/2 months/)
    expect(html).toMatch(/Accept/)
  })

  it('documents the browser signals the site honours', () => {
    expect(html).toContain('Global Privacy Control')
    expect(html).toMatch(/Do Not Track/)
  })

  it('tells the visitor how to withdraw', () => {
    expect(html).toMatch(/Cookie settings/)
  })

  // The regression guard. This sentence was true until GA4 shipped; leaving it
  // or restoring it is an affirmatively false statement about the site (§3.2).
  it('no longer claims the site uses no analytics tools', () => {
    expect(html).not.toContain('analytics tools at this time')
  })

  it('no longer carries the stale April 2025 effective date', () => {
    expect(html).not.toContain('April 24, 2025')
  })
})
