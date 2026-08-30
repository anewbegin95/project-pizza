/**
 * Consent banner e2e tests (issue #396, part of the #160 analytics PRD).
 *
 * NAMING: this file must NOT be called `redesign-consent.spec.js`.
 * `playwright.config.js` sets `testIgnore: '**\/redesign-*.spec.js'` while the
 * redesign is parked (#403), so that name would silently never run — a green
 * board over zero coverage on the one component with a legal posture attached.
 *
 * "Both flag states" here means the bar must be indifferent to the flag, not
 * gated by it. Since #402 unloaded the parked assets there is no redesign UI
 * behind `?redesign=on` any more, but `redesign-flag.js` still runs on every
 * page and still flips `data-redesign`, so the two states remain the right
 * check for the bar's deliberate *lack* of scoping.
 *
 * about.html is the host page: it makes no Sanity request, so its console stays
 * clean regardless of the CORS allowlist, and it carries the shared footer.
 */
const { test, expect } = require('@playwright/test')

/** Mount the banner the way the activation PR eventually will — explicitly. */
async function renderBanner(page) {
  return page.evaluate(() => Boolean(window.NycConsent.renderBanner()))
}

async function getState(page) {
  return page.evaluate(() => window.NycConsent.getState())
}

/**
 * Reads the properties that decide whether one button reads as the primary
 * action. Waits out any transition first: `getComputedStyle` sampled straight
 * after mount returns a mid-transition blend, which would let two genuinely
 * different buttons compare equal.
 */
async function actionStyles(locator) {
  return locator.evaluate(async (el) => {
    await Promise.all(el.getAnimations().map((animation) => animation.finished))
    const style = getComputedStyle(el)
    const box = el.getBoundingClientRect()
    return {
      width: Math.round(box.width),
      height: Math.round(box.height),
      background: style.backgroundColor,
      color: style.color,
      border: style.border,
      fontWeight: style.fontWeight,
      fontSize: style.fontSize,
      fontFamily: style.fontFamily,
      textTransform: style.textTransform,
      padding: style.padding,
      textDecorationLine: style.textDecorationLine,
      opacity: style.opacity,
    }
  })
}

const FLAG_STATES = [
  { name: 'flag off', url: '/about.html' },
  { name: 'flag on', url: '/about.html?redesign=on' },
]

test.describe('banner mounts identically in both flag states', () => {
  FLAG_STATES.forEach(({ name, url }) => {
    test(`renders on demand with ${name}`, async ({ page }) => {
      await page.goto(url)

      // Guard against a vacuous pass: confirm the flag actually differs.
      const redesign = await page.evaluate(() => document.documentElement.getAttribute('data-redesign'))
      expect(redesign).toBe(name === 'flag on' ? 'on' : null)

      expect(await renderBanner(page)).toBe(true)

      const banner = page.getByRole('region', { name: /cookie|analytics|consent/i })
      await expect(banner).toBeVisible()
      await expect(banner.getByRole('button', { name: /^accept$/i })).toBeVisible()
      await expect(banner.getByRole('button', { name: /^decline$/i })).toBeVisible()
    })

    test(`gives Accept and Decline identical computed styles with ${name}`, async ({ page }) => {
      await page.goto(url)
      await renderBanner(page)

      const banner = page.getByRole('region', { name: /cookie|analytics|consent/i })
      const accept = banner.getByRole('button', { name: /^accept$/i })
      const decline = banner.getByRole('button', { name: /^decline$/i })

      const acceptStyles = await actionStyles(accept)
      const declineStyles = await actionStyles(decline)

      expect(acceptStyles).toEqual(declineStyles)
      // A pair that is identical because neither rendered would pass the line
      // above without proving anything.
      expect(acceptStyles.width).toBeGreaterThan(0)
      expect(acceptStyles.height).toBeGreaterThan(0)
    })
  })
})

test('ignoring the banner leaves the visitor untracked', async ({ page }) => {
  await page.goto('/about.html')
  await renderBanner(page)

  expect(await getState(page)).toBe('unset')
  await expect(page.getByRole('region', { name: /cookie|analytics|consent/i })).toBeVisible()
  expect(await getState(page)).toBe('unset')
})

test('nothing renders on load, so the page is visually unchanged', async ({ page }) => {
  await page.goto('/about.html')
  await page.waitForFunction(() => Boolean(window.NycConsent))
  await expect(page.locator('.nyc-consent')).toHaveCount(0)
})

test('Decline persists across a reload and is never re-prompted', async ({ page }) => {
  await page.goto('/about.html')
  await renderBanner(page)

  const banner = page.getByRole('region', { name: /cookie|analytics|consent/i })
  await banner.getByRole('button', { name: /^decline$/i }).click()

  await expect(page.locator('.nyc-consent')).toHaveCount(0)
  expect(await getState(page)).toBe('denied')

  await page.reload()
  await page.waitForFunction(() => Boolean(window.NycConsent))
  expect(await getState(page)).toBe('denied')

  // Even asked directly, the banner declines to re-prompt a settled visitor.
  expect(await renderBanner(page)).toBe(false)
  await expect(page.locator('.nyc-consent')).toHaveCount(0)
})

test('Accept persists across a reload', async ({ page }) => {
  await page.goto('/about.html')
  await renderBanner(page)

  await page.getByRole('region', { name: /cookie|analytics|consent/i })
    .getByRole('button', { name: /^accept$/i })
    .click()
  expect(await getState(page)).toBe('granted')

  await page.reload()
  await page.waitForFunction(() => Boolean(window.NycConsent))
  expect(await getState(page)).toBe('granted')
  await expect(page.locator('.nyc-consent')).toHaveCount(0)
})

test('the footer link reopens the choice and flips granted to denied in one click', async ({ page }) => {
  await page.goto('/about.html')
  await page.waitForFunction(() => Boolean(window.NycConsent))
  await page.evaluate(() => window.NycConsent.grant())
  expect(await getState(page)).toBe('granted')

  // The footer arrives from a fetched partial, so the module has to be bound by
  // delegation rather than to an element that existed at parse time.
  await page.getByRole('button', { name: /cookie settings/i }).click()

  const banner = page.getByRole('region', { name: /cookie|analytics|consent/i })
  await expect(banner).toBeVisible()
  await banner.getByRole('button', { name: /^decline$/i }).click()

  expect(await getState(page)).toBe('denied')
  await expect(page.locator('.nyc-consent')).toHaveCount(0)
})

test('withdrawal is exactly as easy as granting, in both directions', async ({ page }) => {
  await page.goto('/about.html')
  await page.waitForFunction(() => Boolean(window.NycConsent))

  const cookieSettings = page.getByRole('button', { name: /cookie settings/i })
  const banner = page.getByRole('region', { name: /cookie|analytics|consent/i })

  await cookieSettings.click()
  await banner.getByRole('button', { name: /^decline$/i }).click()
  expect(await getState(page)).toBe('denied')

  await cookieSettings.click()
  await banner.getByRole('button', { name: /^accept$/i }).click()
  expect(await getState(page)).toBe('granted')
})

test('publishes consent:change on the document', async ({ page }) => {
  await page.goto('/about.html')
  await page.waitForFunction(() => Boolean(window.NycConsent))

  await page.evaluate(() => {
    window.seenConsentStates = []
    document.addEventListener('consent:change', (event) => {
      window.seenConsentStates.push(event.detail.state)
    })
  })

  await renderBanner(page)
  await page.getByRole('region', { name: /cookie|analytics|consent/i })
    .getByRole('button', { name: /^accept$/i })
    .click()

  expect(await page.evaluate(() => window.seenConsentStates)).toEqual(['granted'])
})

test('the banner is keyboard reachable with a sane focus order', async ({ page }) => {
  await page.goto('/about.html')
  await renderBanner(page)

  const banner = page.getByRole('region', { name: /cookie|analytics|consent/i })

  // Accessible name for the region, per the PRD's a11y requirement.
  await expect(banner).toHaveAttribute('aria-label', /.+/)

  await banner.getByRole('button', { name: /^accept$/i }).focus()
  expect(await page.evaluate(() => document.activeElement.textContent.trim())).toBe('Accept')

  // Decline sits immediately after Accept: refusal is never an extra step away.
  await page.keyboard.press('Tab')
  expect(await page.evaluate(() => document.activeElement.textContent.trim())).toBe('Decline')

  // A focus ring must survive `a:focus, button:focus { outline: none }` in
  // buttons.css, or the bar is unusable by keyboard.
  const focusRing = await banner.getByRole('button', { name: /^decline$/i }).evaluate(async (el) => {
    await Promise.all(el.getAnimations().map((animation) => animation.finished))
    const style = getComputedStyle(el)
    return { outlineWidth: style.outlineWidth, outlineStyle: style.outlineStyle }
  })
  expect(focusRing.outlineStyle).not.toBe('none')
  expect(parseFloat(focusRing.outlineWidth)).toBeGreaterThan(0)

  await page.keyboard.press('Enter')
  expect(await getState(page)).toBe('denied')
})

test('renders and settles with zero page errors', async ({ page }) => {
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))

  await page.goto('/about.html')
  await page.waitForFunction(() => Boolean(window.NycConsent))
  await renderBanner(page)
  await page.getByRole('region', { name: /cookie|analytics|consent/i })
    .getByRole('button', { name: /^decline$/i })
    .click()
  await page.reload()
  await page.waitForFunction(() => Boolean(window.NycConsent))

  expect(errors).toEqual([])
})

test('the module is present on every page that ships it', async ({ page }) => {
  const pages = [
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

  for (const url of pages) {
    await page.goto(url)
    await page.waitForFunction(() => Boolean(window.NycConsent))
    expect(await getState(page), `state on ${url}`).toBe('unset')
    await expect(page.locator('.nyc-consent'), `no banner on ${url}`).toHaveCount(0)
  }
})
