const { test, expect } = require('@playwright/test')

const DOCUMENTS = [
  {
    _id: 'chelsea', slug: 'chelsea', name: 'Chelsea Night Market',
    start_datetime: '2026-08-12T22:00:00Z', end_datetime: '2026-08-13T03:00:00Z',
    category: 'market', borough: 'manhattan', neighborhood: 'Chelsea', venue_name: 'Chelsea Piers',
    price: '$15', short_description: 'Forty vendors and live music after dark.',
    display_overall: true, display_in_popups_page: true, display_in_calendar: true,
  },
]

test.beforeEach(async ({ page }) => {
  await page.route('https://41kk82h2.apicdn.sanity.io/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ result: DOCUMENTS }) })
  )
  await page.clock.setFixedTime(new Date('2026-08-11T15:00:00Z'))
})

/** The Calendar entry in the injected header nav. */
const headerCalendarLink = (page) => page.locator('header a', { hasText: /^Calendar$/ }).first()

// --- Flag ON -------------------------------------------------------------

test('the legacy calendar hands over to the Pop-Ups calendar view', async ({ page }) => {
  await page.goto('/calendar.html?redesign=on')

  await expect(page).toHaveURL(/pop-ups\.html\?view=calendar/)
  await expect(page.locator('.calendar-grid')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Calendar' })).toHaveAttribute('aria-pressed', 'true')
})

test('the handover keeps the reader in the redesign', async ({ page }) => {
  // The flag came from the URL, so it has to survive the hop or the reader
  // lands on the legacy Pop-Ups page having asked for the new calendar.
  await page.goto('/calendar.html?redesign=on')

  // Assert the hop happened first: without this the test passes on the
  // un-redirected legacy page, which also carries data-redesign="on".
  await expect(page).toHaveURL(/pop-ups\.html/)
  await expect(page).toHaveURL(/redesign=on/)
  await expect(page.locator('html')).toHaveAttribute('data-redesign', 'on')
})

test('a shared link opens Pop-Ups directly in calendar view', async ({ page }) => {
  await page.goto('/pop-ups.html?redesign=on&view=calendar')

  await expect(page.locator('html')).toHaveAttribute('data-view', 'calendar')
  await expect(page.locator('.calendar-grid')).toBeVisible()
  await expect(page.getByRole('button', { name: 'List' })).toHaveAttribute('aria-pressed', 'false')
})

test('a view the page does not offer falls back to List', async ({ page }) => {
  await page.goto('/pop-ups.html?redesign=on&view=gallery')

  await expect(page.locator('html')).toHaveAttribute('data-view', 'list')
  await expect(page.getByRole('button', { name: 'List' })).toHaveAttribute('aria-pressed', 'true')
})

test('the view parameter is inert on a page with no toggle', async ({ page }) => {
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))

  await page.goto('/date-ideas.html?redesign=on&view=calendar')

  await expect(page.getByRole('group', { name: /view mode/i })).toHaveCount(0)
  expect(errors).toEqual([])
})

test('the nav Calendar link points into Pop-Ups', async ({ page }) => {
  await page.goto('/pop-ups.html?redesign=on')

  // The flag is on here only because the URL says so, so the link carries it
  // over — otherwise following it walks straight back out of the redesign.
  await expect(headerCalendarLink(page)).toHaveAttribute('href', '/pop-ups.html?view=calendar&redesign=on')
  await expect(page.locator('.site-footer__link', { hasText: /^Calendar$/ })).toHaveAttribute(
    'href',
    '/pop-ups.html?view=calendar&redesign=on'
  )
})

test('following the nav Calendar link lands in calendar view', async ({ page }) => {
  await page.goto('/pop-ups.html?redesign=on')
  await page.locator('#popupsGrid .event-card').first().waitFor()

  // The footer link rather than the header one: .main-nav is display:none at
  // this width on this site, so the header's Calendar link is not clickable
  // without opening the collapsible menu first. Same retargeted href either
  // way, and the header's is asserted above.
  await page.locator('.site-footer__link', { hasText: /^Calendar$/ }).click()

  await expect(page).toHaveURL(/view=calendar/)
  await expect(page.locator('.calendar-grid')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Calendar' })).toHaveAttribute('aria-pressed', 'true')
})

// --- Flag OFF: nothing may change ----------------------------------------

test('the legacy calendar still renders itself with the flag off', async ({ page }) => {
  await page.goto('/calendar.html')

  await expect(page).toHaveURL(/calendar\.html/)
  await expect(page.locator('.calendar-grid')).toBeVisible()
  await expect(page.locator('.calendar-month-year')).toHaveText('August 2026')
})

test('the nav Calendar link is untouched with the flag off', async ({ page }) => {
  await page.goto('/pop-ups.html')

  await expect(headerCalendarLink(page)).toHaveAttribute('href', '/calendar.html')
  await expect(page.locator('.site-footer__link', { hasText: /^Calendar$/ })).toHaveAttribute(
    'href',
    '/calendar.html'
  )
})

test('the view parameter does nothing with the flag off', async ({ page }) => {
  await page.goto('/pop-ups.html?view=calendar')

  await expect(page.locator('.results__panel--calendar')).toBeHidden()
  await expect(page.locator('#popupsGrid .popup-tile')).toHaveCount(1)
})

test('the legacy calendar loads with no page errors either way', async ({ page }) => {
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))

  await page.goto('/calendar.html')
  expect(errors).toEqual([])

  await page.goto('/calendar.html?redesign=on')
  await expect(page.locator('.calendar-grid')).toBeVisible()
  expect(errors).toEqual([])
})
