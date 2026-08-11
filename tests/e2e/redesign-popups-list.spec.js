const { test, expect } = require('@playwright/test')

const IMG = '/resources/images/images/default-popup-image.webp'

const doc = (id, name, start, extra = {}) => ({
  _id: id,
  slug: id,
  name,
  start_datetime: start,
  category: 'market',
  borough: 'manhattan',
  neighborhood: 'SoHo',
  venue_name: 'A Venue',
  price: 'Free',
  short_description: 'Something worth turning up for.',
  imageUrl: IMG,
  display_overall: true,
  display_in_popups_page: true,
  ...extra,
})

// Deliberately out of order, spanning three months, with one featured entry
// mid-run and one all-day event on a month boundary.
const DOCUMENTS = [
  doc('sept-fair', 'September Fair', '2026-09-05T14:00:00Z'),
  doc('aug-market', 'August Market', '2026-08-13T15:00:00Z'),
  doc('aug-featured', 'August Featured Show', '2026-08-20T14:00:00Z', { is_featured: true }),
  doc('oct-late', 'October Late Show', '2026-10-02T14:00:00Z'),
  doc('aug-allday', 'August All Day', null, { start_date: '2026-08-31', end_date: '2026-08-31', all_day: true }),
]

test.beforeEach(async ({ page }) => {
  await page.route('https://41kk82h2.apicdn.sanity.io/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ result: DOCUMENTS }),
    })
  )
})

async function gotoList(page, flag = 'on') {
  await page.goto(`/pop-ups.html?redesign=${flag}`)
  if (flag === 'on') await expect(page.locator('.event-card').first()).toBeVisible()
}

test('results render as event cards rather than legacy tiles', async ({ page }) => {
  await gotoList(page)

  await expect(page.locator('.event-card')).toHaveCount(5)
  await expect(page.locator('#popupsGrid .popup-tile')).toHaveCount(0)
})

test('cards are grouped under month headings in chronological order', async ({ page }) => {
  await gotoList(page)

  await expect(page.locator('.event-group__heading')).toHaveText([
    'August 2026',
    'September 2026',
    'October 2026',
  ])

  // Within August, date order — and the featured card is not hoisted.
  const august = page.locator('.event-group').first()
  await expect(august.locator('.event-card__title')).toHaveText([
    'August Market',
    'August Featured Show',
    'August All Day',
  ])
})

test('an all-day event on a month boundary lands in the right month', async ({ page }) => {
  await gotoList(page)

  // 2026-08-31 parsed as UTC midnight would be 30 August in New York — still
  // August — but the same bug files 1 September events under August. Assert the
  // 31st stays in August rather than slipping to September.
  const august = page.locator('.event-group').first()
  await expect(august.locator('.event-card__title')).toContainText(['August All Day'])
  await expect(august.locator('.event-card__day-number').last()).toHaveText('31')
})

test('the featured entry uses the featured card treatment', async ({ page }) => {
  await gotoList(page)

  const featured = page.locator('.event-card--featured')
  await expect(featured).toHaveCount(1)
  await expect(featured.locator('.event-card__title')).toHaveText('August Featured Show')
})

test('the results count reports events, not month groups', async ({ page }) => {
  await gotoList(page)

  // Five cards across three groups: counting children would say 3.
  await expect(page.locator('.results-count')).toHaveText('5 events found')
})

test('the empty state offers a way out and restores the results', async ({ page }) => {
  await gotoList(page)

  await page.locator('.search-bar__input').fill('nothing matches this')

  const empty = page.locator('.results-empty')
  await expect(empty).toBeVisible()
  await expect(empty).toContainText('No pop-ups match these filters')
  await expect(page.locator('.event-card')).toHaveCount(0)
  await expect(page.locator('.event-group__heading')).toHaveCount(0)
  await expect(page.locator('.results-count')).toHaveText('0 events found')

  await empty.getByRole('button', { name: 'Clear all filters' }).click()

  await expect(page.locator('.search-bar__input')).toHaveValue('')
  await expect(page.locator('.event-card')).toHaveCount(5)
  await expect(empty).toBeHidden()
})

test('filtering re-groups the remaining results', async ({ page }) => {
  await gotoList(page)

  await page.locator('.search-bar__input').fill('september')

  await expect(page.locator('.event-group__heading')).toHaveText(['September 2026'])
  await expect(page.locator('.event-card')).toHaveCount(1)
})

test('the month heading is a real heading for screen readers', async ({ page }) => {
  await gotoList(page)

  const heading = page.getByRole('heading', { level: 2, name: 'August 2026' })
  await expect(heading).toBeVisible()

  // Each group is labelled by its month, so the cards are announced in context.
  const labelled = await page.locator('.event-group').first().getAttribute('aria-labelledby')
  expect(labelled).toBe(await heading.getAttribute('id'))
})

test('groups and the empty state stay invisible with the flag off', async ({ page }) => {
  await gotoList(page, 'off')

  await expect(page.locator('#popupsGrid .popup-tile')).toHaveCount(5)
  await expect(page.locator('.event-card')).toHaveCount(0)
  await expect(page.locator('.event-group__heading')).toHaveCount(0)
  await expect(page.locator('.results-empty')).toHaveCount(0)
})

test('the list page loads with no errors', async ({ page }) => {
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))

  await gotoList(page)

  expect(errors).toEqual([])
})
