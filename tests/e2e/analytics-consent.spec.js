/**
 * GA4-behind-consent e2e tests (issue #398, part of the #160 analytics PRD).
 *
 * NAMING: this file must NOT be called `redesign-analytics-consent.spec.js`.
 * `playwright.config.js` sets `testIgnore: '**\/redesign-*.spec.js'` while the
 * redesign is parked (#403), so that prefix would mean these never run — a
 * green board over zero coverage on the one gate with a legal posture attached.
 *
 * The first test in this file is the one the milestone rests on: load every
 * page, decline, browse, and assert that nothing at all reached Google. It is
 * written as request interception rather than a cookie check on purpose —
 * "no cookie" is a much weaker claim than "no request", and the NY AG guide's
 * named failure mode is a control that looks like it works and does not.
 *
 * Requests to Google are stubbed as well as recorded, so a CI machine with no
 * egress cannot turn a real failure into a pass or a pass into a flake.
 */
const { test, expect } = require('@playwright/test')

const MEASUREMENT_ID = 'G-JYLM80LHT2'
const GOOGLE_URL_PATTERN = /googletagmanager\.com|google-analytics\.com|analytics\.google\.com/

const PAGES = [
  '/',
  '/pop-ups.html',
  '/date-ideas.html',
  '/calendar.html',
  '/pop-up.html',
  '/date-idea.html',
  '/about.html',
  '/contact_us.html',
  '/privacy_policy.html',
]

const BANNER = { role: 'region', name: /cookie|analytics|consent/i }

/**
 * Records every request to a Google analytics origin and stubs the response, so
 * the assertions never depend on the runner having egress. The recorder is
 * installed with `page.on` as well, which catches anything a route pattern
 * would miss.
 */
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

async function getState(page) {
  return page.evaluate(() => window.NycConsent.getState())
}

async function ready(page) {
  await page.waitForFunction(() => Boolean(window.NycConsent) && Boolean(window.NycAnalytics))
}

/** Browsing that a real visitor would do, without leaving the page. */
async function browse(page) {
  await page.mouse.wheel(0, 2000)
  await page.waitForTimeout(250)
  await page.mouse.wheel(0, -1000)
  await page.evaluate(() => window.dispatchEvent(new Event('resize')))
  await page.waitForTimeout(250)
}

test.describe('the consent gate', () => {
  // THE test. Everything else in this milestone is downstream of it holding.
  test('declining means zero requests to Google from any page', async ({ page }) => {
    const requests = await watchGoogle(page)

    await page.goto('/about.html')
    await ready(page)
    await page.getByRole(BANNER.role, { name: BANNER.name })
      .getByRole('button', { name: /^decline$/i })
      .click()
    expect(await getState(page)).toBe('denied')

    for (const url of PAGES) {
      await page.goto(url)
      await ready(page)
      expect(await getState(page), `state on ${url}`).toBe('denied')
      await browse(page)
      expect(requests, `requests after browsing ${url}`).toEqual([])
    }

    expect(requests).toEqual([])
  })

  // Opt-in means silence is a no. Ignoring the bar has to be as inert as
  // refusing it, or the banner is decorative and the site tracks by default.
  test('ignoring the banner means zero requests to Google from any page', async ({ page }) => {
    const requests = await watchGoogle(page)

    for (const url of PAGES) {
      await page.goto(url)
      await ready(page)
      expect(await getState(page), `state on ${url}`).toBe('unset')
      await browse(page)
      expect(requests, `requests after browsing ${url}`).toEqual([])
    }
  })

  test('no gtag global and no _ga cookie exist before consent', async ({ page }) => {
    await watchGoogle(page)
    await page.goto('/about.html')
    await ready(page)
    await browse(page)

    expect(await page.evaluate(() => typeof window.gtag)).toBe('undefined')
    expect(await page.evaluate(() => window.dataLayer)).toBeUndefined()
    const cookies = await page.context().cookies()
    expect(cookies.filter((cookie) => cookie.name.startsWith('_ga'))).toEqual([])
  })

  test('accepting loads gtag.js for the configured measurement id', async ({ page }) => {
    const requests = await watchGoogle(page)

    await page.goto('/about.html')
    await ready(page)
    expect(requests).toEqual([])

    await page.getByRole(BANNER.role, { name: BANNER.name })
      .getByRole('button', { name: /^accept$/i })
      .click()

    await expect.poll(() => requests.length).toBeGreaterThan(0)
    expect(requests.some((url) => url.includes(`gtag/js?id=${MEASUREMENT_ID}`))).toBe(true)
  })

  test('reloading after accepting reloads gtag and does not re-prompt', async ({ page }) => {
    const requests = await watchGoogle(page)

    await page.goto('/about.html')
    await ready(page)
    await page.getByRole(BANNER.role, { name: BANNER.name })
      .getByRole('button', { name: /^accept$/i })
      .click()
    await expect.poll(() => requests.length).toBeGreaterThan(0)

    requests.length = 0
    await page.reload()
    await ready(page)

    expect(await getState(page)).toBe('granted')
    await expect(page.locator('.nyc-consent')).toHaveCount(0)
    await expect.poll(() => requests.length).toBeGreaterThan(0)
  })

  test('withdrawing from the footer halts sends and clears the _ga cookies', async ({ page }) => {
    await watchGoogle(page)
    await page.goto('/about.html')
    await ready(page)

    await page.getByRole(BANNER.role, { name: BANNER.name })
      .getByRole('button', { name: /^accept$/i })
      .click()
    await page.evaluate(() => { document.cookie = '_ga=GA1.1.stub; path=/' })

    await page.getByRole('button', { name: /cookie settings/i }).click()
    await page.getByRole(BANNER.role, { name: BANNER.name })
      .getByRole('button', { name: /^decline$/i })
      .click()

    expect(await getState(page)).toBe('denied')
    expect(await page.evaluate(() => window[`ga-disable-${'G-JYLM80LHT2'}`])).toBe(true)
    const cookies = await page.context().cookies()
    expect(cookies.filter((cookie) => cookie.name.startsWith('_ga'))).toEqual([])
  })
})

test.describe('browser opt-out signals', () => {
  test('a GPC signal suppresses the banner and every request', async ({ page }) => {
    const requests = await watchGoogle(page)
    await page.addInitScript(() => {
      Object.defineProperty(window.navigator, 'globalPrivacyControl', { get: () => true })
    })

    for (const url of ['/', '/about.html', '/pop-ups.html']) {
      await page.goto(url)
      await ready(page)
      expect(await getState(page), `state on ${url}`).toBe('denied')
      await expect(page.locator('.nyc-consent'), `banner on ${url}`).toHaveCount(0)
      await browse(page)
    }

    expect(requests).toEqual([])
  })

  test('a Do Not Track signal suppresses the banner and every request', async ({ page }) => {
    const requests = await watchGoogle(page)
    await page.addInitScript(() => {
      Object.defineProperty(window.navigator, 'doNotTrack', { get: () => '1' })
    })

    await page.goto('/about.html')
    await ready(page)

    expect(await getState(page)).toBe('denied')
    await expect(page.locator('.nyc-consent')).toHaveCount(0)
    await browse(page)
    expect(requests).toEqual([])
  })
})

test.describe('activation: the banner now mounts on its own', () => {
  PAGES.forEach((url) => {
    test(`${url} shows the bar to a visitor who has not answered`, async ({ page }) => {
      await watchGoogle(page)
      await page.goto(url)
      await ready(page)

      const banner = page.getByRole(BANNER.role, { name: BANNER.name })
      await expect(banner).toBeVisible()
      await expect(banner.getByRole('button', { name: /^accept$/i })).toBeVisible()
      await expect(banner.getByRole('button', { name: /^decline$/i })).toBeVisible()
    })
  })
})

test.describe('zero page errors with the loader shipped', () => {
  const FLAG_STATES = [
    { name: 'flag off', suffix: '' },
    { name: 'flag on', suffix: '?redesign=on' },
  ]

  FLAG_STATES.forEach(({ name, suffix }) => {
    test(`every page loads clean with ${name}`, async ({ page }) => {
      const errors = []
      page.on('pageerror', (error) => errors.push(`${page.url()}: ${error.message}`))
      await watchGoogle(page)

      for (const url of PAGES) {
        await page.goto(`${url}${suffix}`)
        await ready(page)
      }

      expect(errors).toEqual([])
    })
  })
})

test.describe('the privacy policy page', () => {
  test('describes GA4, the retention period and the way out', async ({ page }) => {
    await watchGoogle(page)
    await page.goto('/privacy_policy.html')
    await ready(page)

    const policy = page.locator('main')
    await expect(policy).toContainText('Google Analytics')
    await expect(policy).toContainText('Google LLC')
    await expect(policy).toContainText('2 months')
    await expect(policy).toContainText('Global Privacy Control')
    await expect(policy).not.toContainText('analytics tools at this time')
  })

  test('offers a consent control on the page itself, not only in the footer', async ({ page }) => {
    await watchGoogle(page)
    await page.goto('/privacy_policy.html')
    await ready(page)
    await page.getByRole(BANNER.role, { name: BANNER.name })
      .getByRole('button', { name: /^decline$/i })
      .click()

    // Scoped to the policy text: this page's #footer-placeholder sits inside
    // <main>, so `main` would match the footer's control too and prove nothing
    // about the one the policy copy points at.
    await page.locator('.privacy-text').getByRole('button', { name: /cookie settings/i }).click()
    await expect(page.getByRole(BANNER.role, { name: BANNER.name })).toBeVisible()
  })
})
