const { test, expect } = require('@playwright/test')

/** Raw Sanity documents, i.e. what the GROQ query returns before mapping. */
const DOCUMENTS = [
  {
    _id: 'flavia',
    slug: 'flavia',
    name: 'Flavia Flavor Lounge',
    start_datetime: '2026-07-23T15:00:00Z',
    end_datetime: '2026-07-24T23:00:00Z',
    category: 'food_drink',
    borough: 'manhattan',
    neighborhood: 'SoHo',
    venue_name: '22 Wooster',
    price: 'Free',
    short_description: 'Complimentary coffee and tea in a loft space.',
    display_overall: true,
    display_in_popups_page: true,
  },
  {
    _id: 'chelsea',
    slug: 'chelsea',
    name: 'Chelsea Night Market',
    start_datetime: '2026-08-15T22:00:00Z',
    end_datetime: '2026-08-16T04:00:00Z',
    category: 'market',
    borough: 'manhattan',
    neighborhood: 'Chelsea',
    venue_name: 'Chelsea Piers',
    price: '$15',
    short_description: 'Forty vendors and live music after dark.',
    display_overall: true,
    display_in_popups_page: true,
  },
  {
    _id: 'bushwick',
    slug: 'bushwick',
    name: 'Bushwick Vintage Fair',
    start_datetime: '2026-09-05T14:00:00Z',
    end_datetime: '2026-09-05T20:00:00Z',
    category: 'vintage_thrift',
    borough: 'brooklyn',
    neighborhood: 'Bushwick',
    venue_name: 'The Sultan Room',
    price: 'Free',
    short_description: 'Archive denim, band tees and 70s glassware.',
    display_overall: true,
    display_in_popups_page: true,
  },
  {
    _id: 'astoria',
    slug: 'astoria',
    name: 'Astoria Beer Garden Sessions',
    start_datetime: '2026-09-12T18:00:00Z',
    end_datetime: '2026-09-12T23:00:00Z',
    category: 'music',
    borough: 'queens',
    neighborhood: 'Astoria',
    venue_name: 'Bohemian Hall',
    price: '$10',
    short_description: 'Live sets under the trees.',
    display_overall: true,
    display_in_popups_page: true,
  },
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

/** Names currently rendered in the results grid, in order.
 *  #296 replaced the legacy tiles with grouped event cards. */
async function renderedNames(page) {
  return page.locator('#popupsGrid .event-card__title').allTextContents()
}

/** Results are nested inside month groups, so count cards rather than children. */
const resultCards = (page) => page.locator('#popupsGrid .event-card')

async function gotoPopups(page, { flag = 'on' } = {}) {
  await page.goto(`/pop-ups.html?redesign=${flag}`)
  const items = flag === 'on' ? resultCards(page) : page.locator('#popupsGrid .popup-tile')
  await expect(items).toHaveCount(DOCUMENTS.length)
}

/** Opens a chip's dropdown and picks the option with the given label. */
async function chooseFilter(page, filter, label) {
  await page.locator(`.filter-chip[data-filter="${filter}"]`).click()
  await page.locator(`.filter-bar__group [role="option"][data-label="${label}"]`).click()
}

test('search narrows the results to matching events', async ({ page }) => {
  await gotoPopups(page)

  await page.locator('.search-bar__input').fill('chelsea')
  await expect(resultCards(page)).toHaveCount(1)
  expect(await renderedNames(page)).toEqual(['Chelsea Night Market'])

  // Venue and neighborhood are searchable too, not just the name.
  await page.locator('.search-bar__input').fill('wooster')
  expect(await renderedNames(page)).toEqual(['Flavia Flavor Lounge'])

  await page.locator('.search-bar__input').fill('bushwick')
  expect(await renderedNames(page)).toEqual(['Bushwick Vintage Fair'])
})

test('the results count follows the filtered set', async ({ page }) => {
  await gotoPopups(page)
  await expect(page.locator('.results-count')).toHaveText('4 events found')

  await page.locator('.search-bar__input').fill('chelsea')
  await expect(page.locator('.results-count')).toHaveText('1 event found')

  await page.locator('.search-bar__input').fill('nothing matches this')
  await expect(page.locator('.results-count')).toHaveText('0 events found')
})

test('chips filter the results and combine with each other', async ({ page }) => {
  await gotoPopups(page)

  await chooseFilter(page, 'borough', 'Manhattan')
  expect(await renderedNames(page)).toEqual(['Flavia Flavor Lounge', 'Chelsea Night Market'])

  await chooseFilter(page, 'type', 'Market')
  expect(await renderedNames(page)).toEqual(['Chelsea Night Market'])

  // A combination with no matches is empty rather than falling back to all.
  await chooseFilter(page, 'borough', 'Brooklyn')
  expect(await renderedNames(page)).toEqual([])
})

test('a chip reflects its selection and clears from the All option', async ({ page }) => {
  await gotoPopups(page)

  const chip = page.locator('.filter-chip[data-filter="borough"]')
  await expect(chip).not.toHaveClass(/filter-chip--active/)

  await chooseFilter(page, 'borough', 'Queens')
  await expect(chip.locator('.filter-chip__label')).toHaveText('Queens')
  await expect(chip).toHaveClass(/filter-chip--active/)
  expect(await renderedNames(page)).toEqual(['Astoria Beer Garden Sessions'])

  await chooseFilter(page, 'borough', 'All Boroughs')
  await expect(chip.locator('.filter-chip__label')).toHaveText('Borough')
  await expect(chip).not.toHaveClass(/filter-chip--active/)
  await expect(resultCards(page)).toHaveCount(4)
})

test('the neighborhood options come from the loaded data', async ({ page }) => {
  await gotoPopups(page)

  const options = await page
    .locator('.filter-chip[data-filter="neighborhood"] ~ .filter-dropdown [role="option"]')
    .allTextContents()

  // Astoria and Bushwick are in the data but not in the page's static list;
  // Williamsburg and East Village are in the static list but not the data.
  expect(options).toEqual(['All Neighborhoods', 'Astoria', 'Bushwick', 'Chelsea', 'SoHo'])

  await chooseFilter(page, 'neighborhood', 'Astoria')
  expect(await renderedNames(page)).toEqual(['Astoria Beer Garden Sessions'])
})

test('the date range filters on overlap and clears again', async ({ page }) => {
  await gotoPopups(page)

  await page.evaluate(() => {
    window.NycFilters.setFilter('dates', '2026-08-01..2026-08-31', 'Aug 1 – Aug 31')
  })
  expect(await renderedNames(page)).toEqual(['Chelsea Night Market'])

  await page.evaluate(() => window.NycFilters.setFilter('dates', null))
  await expect(resultCards(page)).toHaveCount(4)
})

test('Clear all resets the chips and the search box together', async ({ page }) => {
  await gotoPopups(page)

  await page.locator('.search-bar__input').fill('chelsea')
  await chooseFilter(page, 'borough', 'Manhattan')
  await expect(resultCards(page)).toHaveCount(1)

  const clear = page.locator('.filter-bar__clear')
  await expect(clear).toBeVisible()
  await clear.click()

  await expect(page.locator('.search-bar__input')).toHaveValue('')
  await expect(page.locator('.filter-chip[data-filter="borough"] .filter-chip__label')).toHaveText('Borough')
  await expect(resultCards(page)).toHaveCount(4)
  await expect(clear).toBeHidden()
})

test('filtering works the same on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await gotoPopups(page)

  await chooseFilter(page, 'type', 'Music')
  expect(await renderedNames(page)).toEqual(['Astoria Beer Garden Sessions'])

  await page.locator('.filter-bar__clear').click()
  await expect(resultCards(page)).toHaveCount(4)
})

test('the flag-off page renders everything and ignores the controls', async ({ page }) => {
  await gotoPopups(page, { flag: 'off' })

  await expect(page.locator('.search-bar-container')).toBeHidden()
  await expect(page.locator('.filter-bar')).toBeHidden()

  // Publishing the events the hidden controls would have sent must not
  // re-render the legacy page.
  await page.evaluate(() => {
    document.dispatchEvent(new CustomEvent('search:change', { detail: { query: 'chelsea' } }))
  })
  // Legacy tiles, not cards, and still all four of them.
  await expect(page.locator('#popupsGrid .popup-tile')).toHaveCount(4)
  await expect(resultCards(page)).toHaveCount(0)
})

test('the page loads with no errors once filtering is wired', async ({ page }) => {
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))

  await gotoPopups(page)

  expect(errors).toEqual([])
})
