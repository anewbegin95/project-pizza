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
    venue_name: '22 Wooster', latitude: 40.7233, longitude: -74.003,
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
    venue_name: 'Chelsea Piers', latitude: 40.7466, longitude: -74.0084,
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
    venue_name: 'The Sultan Room', latitude: 40.7053, longitude: -73.9233,
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
    venue_name: 'Bohemian Hall', latitude: 40.7644, longitude: -73.9235,
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

// #298 — switching views must not disturb the filter/search state or the set
// it selects. The count is deliberately excluded from the round trip: as of
// #300 the Calendar view reports the month on screen rather than the filter
// match, so it is the one thing that legitimately differs by view.
test('search and filter state survives a trip through every view', async ({ page }) => {
  await gotoPopups(page)

  await page.locator('.search-bar__input').fill('market')
  await chooseFilter(page, 'borough', 'Manhattan')
  await expect(resultCards(page)).toHaveCount(1)
  await expect(page.locator('.results-count')).toHaveText('1 event found')

  const state = () =>
    page.evaluate(() => ({
      query: document.querySelector('.search-bar__input').value,
      borough: document.querySelector('.filter-chip[data-filter="borough"] .filter-chip__label').textContent,
      names: [...document.querySelectorAll('#popupsGrid .event-card__title')].map((el) => el.textContent),
    }))

  const before = await state()
  expect(before.query).toBe('market')
  expect(before.borough).toContain('Manhattan')
  expect(before.names).toEqual(['Chelsea Night Market'])

  for (const label of ['Calendar', 'Map', 'Calendar', 'List']) {
    await page.getByRole('button', { name: label }).click()
    expect(await state(), `state after switching to ${label}`).toEqual(before)
  }

  // Back in List, the count is the filter's answer again.
  await expect(page.locator('.results-count')).toHaveText('1 event found')
})

test('the results count answers for the list in both List and Map', async ({ page }) => {
  await gotoPopups(page)
  await expect(page.locator('.results-count')).toHaveText('4 events found')

  // In these two views the count is the filter's answer, not what is on
  // screen — the map shows only the events it can place, and still reports
  // four. What Calendar reports is different by design and is covered in
  // redesign-popups-calendar.spec.js.
  await page.getByRole('button', { name: 'Map' }).click()
  await expect(page.locator('.results-count')).toHaveText('4 events found')

  await page.locator('.search-bar__input').fill('chelsea')
  await expect(page.locator('.results-count')).toHaveText('1 event found')

  await page.getByRole('button', { name: 'List' }).click()
  await expect(page.locator('.results-count')).toHaveText('1 event found')
  await expect(resultCards(page)).toHaveCount(1)
})

test('clear all resets the controls from inside the calendar view', async ({ page }) => {
  await gotoPopups(page)

  await page.locator('.search-bar__input').fill('chelsea')
  await chooseFilter(page, 'borough', 'Manhattan')
  await expect(page.locator('.results-count')).toHaveText('1 event found')

  await page.getByRole('button', { name: 'Calendar' }).click()
  await page.locator('.filter-bar__clear').click()

  // The count is the calendar's while it is the active view, so assert the
  // controls reset and that the line is in the calendar's own form rather
  // than reverting to the list's.
  await expect(page.locator('.search-bar__input')).toHaveValue('')
  await expect(page.locator('.filter-chip[data-filter="borough"] .filter-chip__label')).toHaveText('Borough')
  await expect(page.locator('.results-count')).toHaveText(/events? in \w+ \d{4}$/)
  await expect(page.locator('html')).toHaveAttribute('data-view', 'calendar')

  // And it goes back to the list's form on the way out.
  await page.getByRole('button', { name: 'List' }).click()
  await expect(page.locator('.results-count')).toHaveText('4 events found')
})

// #301 — one filter, three views, no disagreement between them.
test('a single filter narrows List, Map and Calendar together', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-08-11T15:00:00Z'))
  await gotoPopups(page)

  await chooseFilter(page, 'borough', 'Brooklyn')

  // List: the one Brooklyn event.
  await expect(resultCards(page)).toHaveCount(1)
  expect(await renderedNames(page)).toEqual(['Bushwick Vintage Fair'])

  // Map: one pin for it.
  await page.getByRole('button', { name: 'Map' }).click()
  await expect(page.locator('.map-pin')).toHaveCount(1)

  // Calendar: the same event, and the month follows it rather than sitting
  // on an empty August.
  await page.getByRole('button', { name: 'Calendar' }).click()
  await expect(page.locator('.calendar__title')).toHaveText('September 2026')
  await expect(page.locator('.calendar-chip')).toHaveCount(1)
  await expect(page.locator('.calendar-chip')).toContainText(['Bushwick Vintage Fair'])

  // And clearing restores all three.
  await page.locator('.filter-bar__clear').click()
  await expect(page.locator('.results-count')).toHaveText(/events? in \w+ \d{4}$/)

  await page.getByRole('button', { name: 'List' }).click()
  await expect(resultCards(page)).toHaveCount(4)
})
