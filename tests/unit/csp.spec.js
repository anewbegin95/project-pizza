/**
 * Content Security Policy tests (issue #397, part of the #160 analytics PRD).
 *
 * The policy is declared in ten places: a `<meta http-equiv>` tag in each of the
 * nine HTML pages, plus the `/*` block in `_headers`. Nothing keeps those in
 * step, so this file does.
 *
 * Note on `_headers`: it is only honoured by hosts such as Netlify and
 * Cloudflare Pages. This site deploys to GitHub Pages, which does not emit it,
 * so the `<meta http-equiv>` CSP is the only policy actually enforced in
 * production. `_headers` is kept in sync so it does not become a misleading
 * record of a policy the site no longer has — not because it protects prod.
 *
 * Directives are compared as parsed name -> source-set maps rather than as raw
 * strings, so whitespace, source ordering, or HTML attribute ordering cannot
 * produce a false failure.
 */
const fs = require('node:fs')
const path = require('node:path')

const projectRoot = path.resolve(__dirname, '..', '..')

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

const SANITY_ORIGINS = [
  'https://41kk82h2.apicdn.sanity.io',
  'https://41kk82h2.api.sanity.io',
]

/**
 * gtag.js is served from googletagmanager; GA4 collection uses the rest.
 *
 * KNOWN WEAKNESS, accepted deliberately. Allowing this origin in `script-src`
 * re-opens arbitrary script execution to anyone who finds an HTML-injection
 * primitive on this site: they can load `?id=GTM-<their own container>` and run
 * its Custom HTML tags. Google's CSP Evaluator flags the origin for this.
 *
 * Note that #397 and #160 §1 justify the allowance with "gtag.js direct, no GTM
 * container." That is a good reason not to hand an arbitrary-JS path to anyone
 * with console access, but it is NOT what contains an attacker: CSP allowlists
 * an origin, not a container, so our own choice of loader constrains nothing an
 * attacker does.
 *
 * A path restriction was tried and rejected (measured in a browser against this
 * exact policy, 2026-08-29):
 *   - `script-src .../gtag/js` does block `gtm.js?id=GTM-...`, but
 *   - `gtag/js?id=GTM-...` serves the container payload anyway
 *     (`{"resource":{"macros":[],"tags":[],"predicates":[]}}`), so the bypass
 *     survives, while
 *   - `/gtag/destination` — a legitimate GA4 endpoint — gets blocked.
 * Zero security gain, real breakage risk. Do not re-add it thinking it helps.
 *
 * The only actual fix is a nonce or hash on the gtag bootstrap, which lets this
 * entry be dropped from `script-src` entirely. That needs the script tag to
 * exist, so it belongs to the activation PR (#160 issue 3), not here.
 */
const GA4_SCRIPT_SOURCE = 'https://www.googletagmanager.com'
const GA4_CONNECT_ORIGINS = [
  'https://www.google-analytics.com',
  'https://*.google-analytics.com',
  'https://*.analytics.google.com',
  'https://www.googletagmanager.com',
]

function read(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), 'utf8')
}

/**
 * Parse a CSP header value into `{ directiveName: [sources] }`, with sources
 * sorted so ordering differences never fail a comparison.
 */
function parseCsp(policy) {
  const directives = {}
  policy
    .split(';')
    .map(part => part.trim())
    .filter(Boolean)
    .forEach(part => {
      const [name, ...sources] = part.split(/\s+/)
      directives[name.toLowerCase()] = sources.slice().sort()
    })
  return directives
}

/**
 * Pull the `content` value off the CSP `<meta>` tag without assuming the
 * attributes appear in any particular order.
 */
function metaCspOf(page) {
  const html = read(page)
  const metaTag = html.match(/<meta\b[^>]*http-equiv=["']Content-Security-Policy["'][^>]*>/i)
  if (!metaTag) {
    throw new Error(`${page} has no Content-Security-Policy meta tag`)
  }
  // Match on the attribute's own quote character: the policy itself contains
  // single quotes (`'self'`), so a naive [^"'] class truncates it.
  const content = metaTag[0].match(/\bcontent=(["'])([\s\S]*?)\1/i)
  if (!content) {
    throw new Error(`${page} CSP meta tag has no content attribute`)
  }
  return parseCsp(content[2])
}

function headersCsp() {
  const line = read('_headers').match(/^\s*Content-Security-Policy:\s*(.+)$/m)
  if (!line) {
    throw new Error('_headers has no Content-Security-Policy line')
  }
  return parseCsp(line[1])
}

describe('the nine meta CSPs stay identical to each other', () => {
  const reference = metaCspOf(PAGES[0])

  PAGES.slice(1).forEach(page => {
    it(`${page} declares the same policy as ${PAGES[0]}`, () => {
      expect(metaCspOf(page)).toEqual(reference)
    })
  })
})

describe('the meta CSP and _headers agree on every shared directive', () => {
  // `_headers` carries directives a meta tag cannot express (frame-ancestors)
  // or that belong to the transport (upgrade-insecure-requests), so the two
  // are compared over the directives they have in common.
  const meta = metaCspOf(PAGES[0])
  const headers = headersCsp()
  const shared = Object.keys(meta).filter(name => name in headers)

  it('shares the directives that carry the origin allowances', () => {
    expect(shared).toEqual(
      expect.arrayContaining(['script-src', 'connect-src', 'object-src', 'base-uri'])
    )
  })

  shared.forEach(name => {
    it(`${name} matches`, () => {
      expect(headers[name]).toEqual(meta[name])
    })
  })
})

describe('script-src', () => {
  // An exact set, not a `contains`: this is what catches 'unsafe-inline' or
  // 'unsafe-eval' being slipped in alongside the GA4 allowance.
  PAGES.forEach(page => {
    it(`${page} allows exactly 'self' and the gtag.js origin — no 'unsafe-inline'`, () => {
      expect(metaCspOf(page)['script-src']).toEqual(["'self'", GA4_SCRIPT_SOURCE].sort())
    })
  })

  it('_headers allows exactly the same two sources', () => {
    expect(headersCsp()['script-src']).toEqual(["'self'", GA4_SCRIPT_SOURCE].sort())
  })
})

describe('no GTM container is introduced', () => {
  // #160 §1: gtag.js direct, no GTM container, because a container is a
  // permanent arbitrary-JS injection path for anyone with console access.
  //
  // The CSP cannot enforce this (see GA4_SCRIPT_SOURCE above), so it is
  // enforced here instead. This is the whole mechanism behind that decision —
  // if this test is deleted, the decision is unenforced.
  PAGES.forEach(page => {
    it(`${page} loads no GTM container`, () => {
      const html = read(page)
      expect(html).not.toContain('googletagmanager.com/gtm.js')
      expect(html).not.toMatch(/\bGTM-[A-Z0-9]+/)
    })
  })
})

describe('connect-src', () => {
  PAGES.forEach(page => {
    it(`${page} permits the Sanity and GA4 origins`, () => {
      const sources = metaCspOf(page)['connect-src']
      expect(sources).toEqual(
        expect.arrayContaining(["'self'", ...SANITY_ORIGINS, ...GA4_CONNECT_ORIGINS])
      )
    })
  })

  it('_headers permits the Sanity and GA4 origins', () => {
    expect(headersCsp()['connect-src']).toEqual(
      expect.arrayContaining(["'self'", ...SANITY_ORIGINS, ...GA4_CONNECT_ORIGINS])
    )
  })
})

describe('the hardening directives survive the relaxation', () => {
  PAGES.forEach(page => {
    it(`${page} keeps object-src 'none' and base-uri 'self'`, () => {
      const directives = metaCspOf(page)
      expect(directives['object-src']).toEqual(["'none'"])
      expect(directives['base-uri']).toEqual(["'self'"])
    })
  })

  it("_headers keeps object-src 'none' and base-uri 'self'", () => {
    const directives = headersCsp()
    expect(directives['object-src']).toEqual(["'none'"])
    expect(directives['base-uri']).toEqual(["'self'"])
  })

  it('no page adds a third-party origin beyond Google and Sanity', () => {
    // Guards the "no other third-party origin is added" promise in #397.
    const allowed = [
      "'self'",
      "'none'",
      "'unsafe-inline'",
      'data:',
      'https:',
      'https://www.instagram.com',
      'https://instagram.com',
      'https://fonts.googleapis.com',
      'https://fonts.gstatic.com',
      ...SANITY_ORIGINS,
      ...GA4_CONNECT_ORIGINS,
      GA4_SCRIPT_SOURCE,
    ]
    const sources = new Set(Object.values(metaCspOf(PAGES[0])).flat())
    expect([...sources].filter(source => !allowed.includes(source))).toEqual([])
  })
})
