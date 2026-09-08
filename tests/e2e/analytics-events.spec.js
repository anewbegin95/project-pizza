/**
 * Click-instrumentation e2e tests (issue #399, part of the #160 analytics PRD).
 *
 * NAMING: this file must NOT be called `redesign-analytics-events.spec.js`.
 * `playwright.config.js` sets `testIgnore: '**\/redesign-*.spec.js'` while the
 * redesign is parked (#403), so that prefix would silently skip every
 * assertion below.
 *
 * OBSERVATION POINT: `window.dataLayer`. Requests to Google are stubbed so the
 * suite never depends on the runner having egress, which means the real
 * gtag.js never runs and no `/collect` request is ever made. What the site
 * itself controls — and all this issue can be responsible for — is the exact
 * sequence of `gtag('event', ...)` calls, and those land in `dataLayer`
 * whether or not Google answers.
 *
 * Consent is granted first in every test, for two reasons: events cannot fire
 * without it, and the consent bar is fixed to the bottom of the viewport at
 * z-index 1100, where it would intercept clicks on footer links.
 */
const { test, expect } = require('@playwright/test')
const { stubSanity, todayPopups } = require('./helpers/sanity-stub')

const GOOGLE_URL_PATTERN = /googletagmanager\.com|google-analytics\.com|analytics\.google\.com/
const CAROUSEL_ROTATION_INTERVAL_MS = 5000

const BANNER = { role: 'region', name: /cookie|analytics|consent/i }

/** Stubs and records Google traffic — same rationale as analytics-consent.spec.js. */
async function watchGoogle(page) {
  const requests = []

  page.on('request', (request) => {
    if (GOOGLE_URL_PATTERN.test(request.url())) {
      requests.push(request.url())
    }
  })

  await page.route(GOOGLE_URL_PATTERN, (route) => route.fulfill({
    status: 200,
    contentType: 'application/javascript',
    body: '/* stubbed gtag.js */',
  }))

  return requests
}

async function ready(page) {
  await page.waitForFunction(() => Boolean(window.NycConsent) && Boolean(window.NycAnalytics))
}

/** Every `gtag('event', name, params)` the page has made so far. */
async function events(page) {
  return page.evaluate(() => (window.dataLayer || [])
    .map((entry) => Array.from(entry))
    .filter((entry) => entry[0] === 'event')
    .map((entry) => ({ name: entry[1], params: entry[2] || {} })))
}

async function eventsNamed(page, name) {
  return (await events(page)).filter((event) => event.name === name)
}

/** Accepts through the banner, which is also what clears it out of the way. */
async function accept(page) {
  await page.getByRole(BANNER.role, { name: BANNER.name })
    .getByRole('button', { name: /^accept$/i })
    .click()
  await expect(page.locator('.nyc-consent')).toHaveCount(0)
}

async function visit(page, url) {
  await stubSanity(page)
  await watchGoogle(page)
  await page.goto(url)
  await ready(page)
  await accept(page)
}

/**
 * THE data-integrity test of this issue, and the reason the instrumentation
 * hangs off the four real interactions rather than the render path.
 *
 * `nextSlide()` advances on a 5s timer (`resources/js/carousel.js:179`), so a
 * listener on rendering would log carousel engagement on every homepage visit
 * from a visitor who never touched it — phantom engagement in the one report
 * this milestone exists to produce.
 *
 * The auto-advance is asserted to have actually happened. Without that, a
 * carousel that failed to render at all would pass this test silently, which
 * is precisely what happens against live Sanity from a local origin.
 */
test.describe('the carousel autoplays and that is not engagement', () => {
  test('two auto-advances on the homepage emit no events at all', async ({ page }) => {
    await visit(page, '/')

    // Two slides coexist for the length of the slide-in/slide-out transition,
    // so every name on screen is collected rather than asserting a single one.
    const slideNames = page.locator('.carousel-popup-name')
    await expect(slideNames.first()).toBeVisible()

    const before = await events(page)
    expect(before.map((event) => event.name)).toEqual(['page_view'])

    const seen = new Set()
    await expect.poll(async () => {
      (await slideNames.allTextContents()).forEach((name) => seen.add(name))
      return seen.size
    }, { timeout: CAROUSEL_ROTATION_INTERVAL_MS * 3, intervals: [250] }).toBeGreaterThanOrEqual(3)

    const after = await events(page)
    expect(after.map((event) => event.name)).toEqual(['page_view'])
    expect(await eventsNamed(page, 'content_open')).toEqual([])
  })
})

/**
 * Records every `gtag('event', ...)` into sessionStorage as it is pushed, so
 * the record survives the unload a tile click causes.
 *
 * This is how "before navigation completes" is actually proved. Reading
 * `window.dataLayer` after a click can only ever observe a page that has not
 * navigated yet; the pop-ups tile assigns `window.location.href` synchronously
 * in its own handler (§2.4), so an event that fired too late would leave no
 * trace at all rather than a failing assertion.
 */
async function recordAcrossNavigation(page) {
  await page.addInitScript(() => {
    const KEY = 'nyc-test-events'
    window.dataLayer = window.dataLayer || []
    const push = window.dataLayer.push.bind(window.dataLayer)
    window.dataLayer.push = function record(...args) {
      args.forEach((entry) => {
        const call = Array.from(entry)
        if (call[0] !== 'event') {
          return
        }
        const stored = JSON.parse(window.sessionStorage.getItem(KEY) || '[]')
        stored.push({ name: call[1], params: call[2] || {} })
        window.sessionStorage.setItem(KEY, JSON.stringify(stored))
      })
      return push(...args)
    }
  })
}

async function recordedEvents(page) {
  return page.evaluate(() => JSON.parse(window.sessionStorage.getItem('nyc-test-events') || '[]'))
}

async function clearRecorded(page) {
  await page.evaluate(() => window.sessionStorage.removeItem('nyc-test-events'))
}

test.describe('content_open reaches GA4 before the page navigates away', () => {
  test('a pop-ups list tile records its surface, id and position first', async ({ page }) => {
    await recordAcrossNavigation(page)
    await visit(page, '/pop-ups.html')

    const tiles = page.locator('#popupsGrid .popup-tile')
    await expect(tiles.first()).toBeVisible()
    await clearRecorded(page)

    await tiles.nth(1).click()
    await page.waitForURL(/pop-up\.html\?id=/)

    const opened = (await recordedEvents(page)).filter((event) => event.name === 'content_open')
    expect(opened).toHaveLength(1)
    expect(opened[0].params).toMatchObject({
      content_type: 'popup',
      surface: 'list',
      entry_id: 'fixture-popup-2',
      position: 1,
    })
  })

  test('a date ideas tile records the other content_type', async ({ page }) => {
    await recordAcrossNavigation(page)
    await visit(page, '/date-ideas.html')

    const tiles = page.locator('#dateIdeasGrid .popup-tile')
    await expect(tiles.first()).toBeVisible()
    await clearRecorded(page)

    await tiles.first().click()
    await page.waitForURL(/date-idea\.html\?id=/)

    const opened = (await recordedEvents(page)).filter((event) => event.name === 'content_open')
    expect(opened[0].params).toMatchObject({
      content_type: 'date_idea',
      surface: 'list',
      entry_id: 'fixture-date-idea-1',
      position: 0,
    })
  })

  test('a carousel slide records the carousel surface', async ({ page }) => {
    await recordAcrossNavigation(page)
    await visit(page, '/')

    await expect(page.locator('.carousel-slide').first()).toBeVisible()
    await clearRecorded(page)

    await page.locator('.carousel-slide').first().click()
    await page.waitForURL(/pop-up\.html\?id=/)

    const opened = (await recordedEvents(page)).filter((event) => event.name === 'content_open')
    expect(opened).toHaveLength(1)
    expect(opened[0].params).toMatchObject({ surface: 'carousel', content_type: 'popup' })
    expect(opened[0].params.entry_id).toMatch(/^fixture-popup-/)
    expect(typeof opened[0].params.position).toBe('number')
  })

  // §2.4's race, on the surface where it is worst: the bar calls
  // stopPropagation() and assigns location.href in the same handler.
  test('a calendar bar records the calendar surface despite stopPropagation', async ({ page }) => {
    await recordAcrossNavigation(page)
    await stubSanity(page, { popups: todayPopups(2) })
    await watchGoogle(page)
    await page.goto('/calendar.html')
    await ready(page)
    await accept(page)

    const bar = page.locator('.calendar-popup-bar').first()
    await expect(bar).toBeVisible()
    await clearRecorded(page)

    await bar.click()
    await page.waitForURL(/pop-up\.html\?id=/)

    const opened = (await recordedEvents(page)).filter((event) => event.name === 'content_open')
    expect(opened).toHaveLength(1)
    expect(opened[0].params).toMatchObject({ surface: 'calendar', content_type: 'popup' })
    expect(opened[0].params.entry_id).toMatch(/^fixture-popup-/)
  })

  // The "+N more" modal reuses the pop-ups grid markup, so this is the one
  // surface a class check alone cannot separate from a list click.
  test('a tile in the +N more modal records the calendar_more surface', async ({ page }) => {
    await recordAcrossNavigation(page)
    await stubSanity(page, { popups: todayPopups(8) })
    await watchGoogle(page)
    await page.goto('/calendar.html')
    await ready(page)
    await accept(page)

    const moreLink = page.locator('.calendar-more-link').first()
    await expect(moreLink).toBeVisible()
    await moreLink.click()

    const tile = page.locator('.day-popups-grid .popup-tile').first()
    await expect(tile).toBeVisible()
    await clearRecorded(page)

    await tile.click()
    await page.waitForURL(/pop-up\.html\?id=/)

    const opened = (await recordedEvents(page)).filter((event) => event.name === 'content_open')
    expect(opened).toHaveLength(1)
    expect(opened[0].params).toMatchObject({ surface: 'calendar_more', content_type: 'popup' })
    expect(opened[0].params.entry_id).toMatch(/^fixture-popup-/)
  })
})

test.describe('navigation, on markup that is injected after load', () => {
  // partials-loader.js injects the header and footer with insertAdjacentHTML
  // well after DOMContentLoaded, so a listener bound to .site-header at load
  // would silently miss every one of these.
  test('a header link fires nav_click from the injected header', async ({ page }) => {
    await recordAcrossNavigation(page)
    // `.main-nav` is display:none below 1300px (header.css), where the
    // collapsible menu takes over. Playwright's default viewport is 1280.
    await page.setViewportSize({ width: 1440, height: 900 })
    await visit(page, '/about.html')
    await clearRecorded(page)

    await page.locator('.main-nav').getByRole('link', { name: 'Pop-Ups' }).click()
    await page.waitForURL(/pop-ups\.html/)

    const nav = (await recordedEvents(page)).filter((event) => event.name === 'nav_click')
    expect(nav[0].params).toMatchObject({ nav_location: 'header', link_text: 'Pop-Ups' })
  })

  test('a footer link fires nav_click from the injected footer', async ({ page }) => {
    await recordAcrossNavigation(page)
    await visit(page, '/about.html')
    await clearRecorded(page)

    await page.locator('.site-footer__links').getByRole('link', { name: 'Date Ideas' }).click()
    await page.waitForURL(/date-ideas\.html/)

    const nav = (await recordedEvents(page)).filter((event) => event.name === 'nav_click')
    expect(nav[0].params).toMatchObject({ nav_location: 'footer', link_text: 'Date Ideas' })
  })

  // §2.3: without this the desktop and mobile menus are indistinguishable.
  test('the collapsible menu reports header_mobile, and opening it reports menu_open', async ({ page }) => {
    await visit(page, '/about.html')
    await page.setViewportSize({ width: 390, height: 844 })

    await page.locator('.menu-toggle').click()
    await expect(page.locator('.collapsible-menu.open')).toHaveCount(1)
    expect((await events(page)).filter((event) => event.name === 'menu_open')).toHaveLength(1)

    // Closing it again is not an open, and must not be counted as one.
    await page.locator('.menu-toggle').click()
    await expect(page.locator('.collapsible-menu.open')).toHaveCount(0)
    expect((await events(page)).filter((event) => event.name === 'menu_open')).toHaveLength(1)

    await recordAcrossNavigation(page)
    await page.locator('.menu-toggle').click()
    await page.locator('.collapsible-menu').getByRole('link', { name: 'About Us' }).click()
    await page.waitForURL(/about\.html/)
  })

  test('a homepage quick-nav button reports home_quicknav', async ({ page }) => {
    await recordAcrossNavigation(page)
    await visit(page, '/')
    await clearRecorded(page)

    await page.getByRole('link', { name: 'Upcoming NYC Pop-Ups' }).click()
    await page.waitForURL(/pop-ups\.html/)

    const nav = (await recordedEvents(page)).filter((event) => event.name === 'nav_click')
    expect(nav[0].params).toMatchObject({ nav_location: 'home_quicknav' })
  })

  test('the footer mailto is the only way the email link is ever counted', async ({ page }) => {
    await visit(page, '/about.html')

    const email = page.locator('.site-footer__contact a')
    await expect(email).toHaveAttribute('href', /^mailto:/)
    // The href is neutralised so the click cannot hand the browser off to a
    // mail client; what is under test is the event, not the mail handler.
    await email.evaluate((node) => { node.setAttribute('href', 'mailto:blocked'); node.removeAttribute('target') })
    await page.evaluate(() => window.addEventListener('click', (event) => event.preventDefault(), true))
    await email.click()

    const social = (await events(page)).filter((event) => event.name === 'social_click')
    expect(social).toHaveLength(1)
    expect(social[0].params).toEqual({ platform: 'email', location: 'footer' })
  })
})

test.describe('the calendar month controls', () => {
  async function openCalendar(page) {
    await stubSanity(page, { popups: todayPopups(2) })
    await watchGoogle(page)
    await page.goto('/calendar.html')
    await ready(page)
    await accept(page)
    await expect(page.locator('.calendar-header')).toBeVisible()
  }

  test('next and prev report their direction and distance from this month', async ({ page }) => {
    await openCalendar(page)

    await page.locator('.calendar-header__next-month').click()
    await page.locator('.calendar-header__next-month').click()
    await page.locator('.calendar-header__prev-month').click()

    const changes = (await events(page)).filter((event) => event.name === 'calendar_month_change')
    expect(changes.map((event) => event.params.direction)).toEqual(['next', 'next', 'prev'])
    expect(changes.map((event) => event.params.months_from_current)).toEqual([1, 2, 1])
  })
})

test.describe('the detail pages', () => {
  test('Learn More fires outbound_click with the domain it left for', async ({ page }) => {
    await recordAcrossNavigation(page)
    await stubSanity(page)
    await watchGoogle(page)
    await page.goto('/pop-up.html?id=fixture-popup-1')
    await ready(page)
    await accept(page)

    const learnMore = page.locator('#popupExternalLink')
    await expect(learnMore).toBeVisible()
    await learnMore.evaluate((node) => node.removeAttribute('target'))
    await page.evaluate(() => window.addEventListener('click', (event) => event.preventDefault(), true))
    await learnMore.click()

    const outbound = (await events(page)).filter((event) => event.name === 'outbound_click')
    expect(outbound).toHaveLength(1)
    expect(outbound[0].params).toEqual({
      content_type: 'popup',
      entry_id: 'fixture-popup-1',
      destination_domain: 'example-popup-1.test',
    })
  })

  test('Add to Calendar fires content_save', async ({ page }) => {
    await stubSanity(page)
    await watchGoogle(page)
    await page.goto('/pop-up.html?id=fixture-popup-1')
    await ready(page)
    await accept(page)

    // A multi-day pop-up renders one link per day instead of the single
    // #popupICSLink, which stays hidden. Both are content_save (unit-tested).
    const ics = page.locator('.popup-detail .ics-links-container a.modal-link').first()
    await expect(ics).toBeVisible()
    await ics.evaluate((node) => node.removeAttribute('target'))
    await page.evaluate(() => window.addEventListener('click', (event) => event.preventDefault(), true))
    await ics.click()

    const saves = (await events(page)).filter((event) => event.name === 'content_save')
    expect(saves).toHaveLength(1)
    expect(saves[0].params).toEqual({ entry_id: 'fixture-popup-1' })
  })
})

/**
 * The compliance assertion, restated for the events this issue adds. #398
 * proved the loader sends nothing without a grant; this proves the new module
 * did not open a second path around it.
 */
test.describe('with consent denied, clicking anything reaches Google not at all', () => {
  test('a full browse and click tour issues zero requests', async ({ page }) => {
    await stubSanity(page, { popups: todayPopups(2) })
    const requests = await watchGoogle(page)

    await page.goto('/about.html')
    await ready(page)
    await page.getByRole(BANNER.role, { name: BANNER.name })
      .getByRole('button', { name: /^decline$/i })
      .click()

    // Each of these navigates — the slide and the title by assigning
    // location.href, which no preventDefault can hold — so the page is
    // reloaded between them rather than chained.
    const targets = [
      '.carousel-slide',
      '.carousel-title',
      '.home-menu a',
      '.social-media-cta .social-icon-link',
      '.menu-toggle',
      '.site-footer__links a',
    ]

    for (const selector of targets) {
      await page.goto('/')
      await ready(page)
      expect(await page.evaluate(() => window.NycConsent.getState()), selector).toBe('denied')
      const target = page.locator(selector).first()
      await expect(target, `${selector} is present to click`).toBeAttached()
      await target.click({ force: true })
      await page.waitForTimeout(150)
      expect(requests, `requests after clicking ${selector}`).toEqual([])
    }

    await page.goto('/')
    await ready(page)

    expect(await page.evaluate(() => window.dataLayer)).toBeUndefined()
    expect(await page.evaluate(() => typeof window.gtag)).toBe('undefined')
    expect(requests).toEqual([])
  })
})

test.describe('zero page errors with the events module shipped', () => {
  const PAGES = [
    '/', '/pop-ups.html', '/date-ideas.html', '/calendar.html', '/pop-up.html',
    '/date-idea.html', '/about.html', '/contact_us.html', '/privacy_policy.html',
  ]

  // Classic scripts share one global lexical scope, so a duplicate top-level
  // const in a new file silently kills the whole file it collides with.
  const FLAG_STATES = [
    { name: 'flag off', suffix: '' },
    { name: 'flag on', suffix: '?redesign=on' },
  ]

  FLAG_STATES.forEach(({ name, suffix }) => {
    test(`every page loads clean with ${name}`, async ({ page }) => {
      const errors = []
      page.on('pageerror', (error) => errors.push(`${page.url()}: ${error.message}`))
      await stubSanity(page)
      await watchGoogle(page)

      for (const url of PAGES) {
        await page.goto(`${url}${suffix}`)
        await ready(page)
        await page.waitForFunction(() => Boolean(window.NycAnalyticsEvents))
      }

      expect(errors).toEqual([])
    })
  })
})
