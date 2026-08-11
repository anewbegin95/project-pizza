const { test, expect } = require('@playwright/test')

const doc = (id, name, extra = {}) => ({
  _id: id,
  slug: id,
  name,
  start_datetime: '2026-08-13T15:00:00Z',
  category: 'market',
  borough: 'manhattan',
  neighborhood: 'SoHo',
  venue_name: 'A Venue',
  price: 'Free',
  short_description: 'Worth turning up for.',
  imageUrl: '/resources/images/images/default-popup-image.webp',
  display_overall: true,
  display_in_popups_page: true,
  ...extra,
})

// Four placeable across two boroughs and categories, plus one the geocoder has
// not reached yet.
const DOCUMENTS = [
  doc('soho', 'SoHo Market', { latitude: 40.7233, longitude: -74.0, category: 'market' }),
  doc('chelsea', 'Chelsea Food Fair', { latitude: 40.7465, longitude: -74.0014, category: 'food_drink' }),
  doc('bushwick', 'Bushwick Art Show', {
    latitude: 40.6944,
    longitude: -73.9213,
    borough: 'brooklyn',
    neighborhood: 'Bushwick',
    category: 'art_culture',
  }),
  doc('astoria', 'Astoria Music Night', {
    latitude: 40.7644,
    longitude: -73.923,
    borough: 'queens',
    neighborhood: 'Astoria',
    category: 'music',
  }),
  doc('nocoords', 'Somewhere Unplaced', { latitude: null, longitude: null }),
]

test.beforeEach(async ({ page }) => {
  // Tiles would otherwise hit the real OpenStreetMap servers from CI.
  await page.route('https://tile.openstreetmap.org/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'image/gif',
      body: Buffer.from('R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==', 'base64'),
    })
  )
  await page.route('https://41kk82h2.apicdn.sanity.io/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ result: DOCUMENTS }),
    })
  )
})

async function gotoMap(page) {
  await page.goto('/pop-ups.html?redesign=on')
  await expect(page.locator('.event-card').first()).toBeVisible()
  await page.getByRole('button', { name: 'Map' }).click()
  await expect(page.locator('.map-surface')).toBeVisible()
}

const pins = (page) => page.locator('.map-pin')

test('switching to Map renders a sized map with tiles', async ({ page }) => {
  await gotoMap(page)

  // Leaflet measures 0x0 if it is created inside a hidden panel.
  const size = await page.locator('.map-surface').evaluate((el) => {
    const rect = el.getBoundingClientRect()
    return { width: Math.round(rect.width), height: Math.round(rect.height) }
  })
  expect(size.width).toBeGreaterThan(300)
  expect(size.height).toBeGreaterThan(300)

  await expect(page.locator('.map-surface .leaflet-tile-loaded').first()).toBeVisible()
})

test('one pin per placeable result', async ({ page }) => {
  await gotoMap(page)

  // Four of the five documents have coordinates.
  await expect(pins(page)).toHaveCount(4)
})

test('events without coordinates are named rather than silently dropped', async ({ page }) => {
  await gotoMap(page)

  await expect(page.locator('.map-note')).toHaveText("1 event isn't on the map yet")
})

test('pins are coloured by category, per section 6.6', async ({ page }) => {
  await gotoMap(page)

  await expect(page.locator('.map-pin--market')).toHaveCount(1)
  await expect(page.locator('.map-pin--food-drink')).toHaveCount(1)
  await expect(page.locator('.map-pin--art-culture')).toHaveCount(1)
  await expect(page.locator('.map-pin--music')).toHaveCount(1)

  const background = await page.locator('.map-pin--market').evaluate(
    (el) => getComputedStyle(el).backgroundColor
  )
  expect(background).toBe('rgb(45, 106, 79)') // --nyc-pin-market
})

test('the legend lists the event types', async ({ page }) => {
  await gotoMap(page)

  const legend = page.locator('.map-legend')
  await expect(legend).toBeVisible()
  await expect(legend.locator('.map-legend__title')).toHaveText('Event Types')
  await expect(legend.locator('.map-legend__item')).toHaveCount(7)
})

test('filtering the results filters the pins', async ({ page }) => {
  await gotoMap(page)
  await expect(pins(page)).toHaveCount(4)

  await page.locator('.filter-chip[data-filter="borough"]').click()
  await page.locator('[role="option"][data-label="Brooklyn"]').click()

  await expect(pins(page)).toHaveCount(1)
  await expect(page.locator('.map-pin--art-culture')).toHaveCount(1)
  // The unplaced event is Manhattan, so it drops out of the note too.
  await expect(page.locator('.map-note')).toBeHidden()
})

test('searching while on the map updates the pins', async ({ page }) => {
  await gotoMap(page)

  await page.locator('.search-bar__input').fill('astoria')

  await expect(pins(page)).toHaveCount(1)
  await expect(page.locator('.map-pin--music')).toHaveCount(1)
})

test('clicking a pin opens the same detail modal as a card', async ({ page }) => {
  await gotoMap(page)

  await page.locator('.map-pin--music').click()

  const detail = page.locator('.modal--detail')
  await expect(detail).toBeVisible()
  await expect(detail.getByRole('heading', { name: 'Astoria Music Night' })).toBeVisible()

  await page.keyboard.press('Escape')
  await expect(detail).toHaveCount(0)
  // Still on the map, not bounced back to the list.
  await expect(page.locator('.map-surface')).toBeVisible()
})

test('the toggle preserves filter state across List and Map', async ({ page }) => {
  await gotoMap(page)

  await page.locator('.filter-chip[data-filter="borough"]').click()
  await page.locator('[role="option"][data-label="Brooklyn"]').click()
  await expect(pins(page)).toHaveCount(1)

  await page.getByRole('button', { name: 'List' }).click()
  await expect(page.locator('.event-card')).toHaveCount(1)
  await expect(page.locator('.filter-chip[data-filter="borough"]')).toHaveClass(/filter-chip--active/)

  await page.getByRole('button', { name: 'Map' }).click()
  await expect(pins(page)).toHaveCount(1)
  await expect(page.locator('.results-count')).toHaveText('1 event found')
})

test('an empty result set leaves a map with no pins rather than breaking', async ({ page }) => {
  await gotoMap(page)

  await page.locator('.search-bar__input').fill('nothing matches this')

  await expect(pins(page)).toHaveCount(0)
  await expect(page.locator('.map-surface')).toBeVisible()
  await expect(page.locator('.map-note')).toBeHidden()
})

test('the map works on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await gotoMap(page)

  await expect(pins(page)).toHaveCount(4)
  const overflows = await page.evaluate(() => {
    const el = document.querySelector('.map-surface')
    return el.getBoundingClientRect().width > window.innerWidth
  })
  expect(overflows).toBe(false)
})

test('the map stays absent with the flag off', async ({ page }) => {
  await page.goto('/pop-ups.html?redesign=off')

  await expect(page.locator('.map-surface')).toHaveCount(0)
  await expect(page.locator('.view-toggle')).toBeHidden()
})

test('the map view loads with no page errors', async ({ page }) => {
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))

  await gotoMap(page)
  await page.locator('.map-pin--music').click()

  expect(errors).toEqual([])
})

test('no console errors from a blocked script or style', async ({ page }) => {
  const blocked = []
  page.on('console', (message) => {
    if (message.type() === 'error') blocked.push(message.text())
  })

  await gotoMap(page)

  // Leaflet is vendored precisely so the CSP does not block it.
  expect(blocked.filter((text) => /content security policy/i.test(text))).toEqual([])
})
