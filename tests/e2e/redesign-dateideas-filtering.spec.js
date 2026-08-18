const { test, expect } = require('@playwright/test')

/** Raw Sanity documents, i.e. what the DATE_IDEAS query returns before mapping. */
const DOCUMENTS = [
  {
    _id: 'walk',
    slug: 'walk',
    name: 'Sunset Walk Across the Brooklyn Bridge',
    vibe: 'romantic',
    budget: 'free',
    borough: 'brooklyn',
    neighborhood: 'DUMBO',
    venue_name: 'Brooklyn Bridge',
    price: 'Free',
    location: 'DUMBO, Brooklyn',
    short_description: 'Time it for golden hour and finish with pizza underneath.',
    display_overall: true,
  },
  {
    _id: 'cloisters',
    slug: 'cloisters',
    name: 'An Afternoon at the Cloisters',
    vibe: 'cultural',
    budget: 'under_30',
    borough: 'manhattan',
    neighborhood: 'Washington Heights',
    venue_name: 'The Met Cloisters',
    price: '$22',
    location: 'Washington Heights, Manhattan',
    short_description: 'Medieval galleries and a long view of the Hudson.',
    display_overall: true,
  },
  {
    _id: 'beer',
    slug: 'beer',
    name: 'Beer Garden Evening in Astoria',
    vibe: 'chill',
    budget: '30_to_75',
    borough: 'queens',
    neighborhood: 'Astoria',
    venue_name: 'Bohemian Hall',
    price: '$40',
    location: 'Astoria, Queens',
    short_description: 'Long communal tables under the trees, open till late.',
    display_overall: true,
  },
  {
    // Shares "free" with the Budget list but on the other field — the pair that
    // catches a matcher wired to the wrong one.
    _id: 'stargazing',
    slug: 'stargazing',
    name: 'Rooftop Stargazing in DUMBO',
    vibe: 'free',
    budget: '75_plus',
    borough: 'brooklyn',
    neighborhood: 'DUMBO',
    venue_name: 'Dumbo House',
    price: '$90',
    location: 'DUMBO, Brooklyn',
    short_description: 'A telescope, a skyline and a very expensive cocktail.',
    display_overall: true,
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

/** Shared event cards with the flag on (#306); legacy tiles without it. */
const resultTiles = (page) => page.locator('#dateIdeasGrid .event-card')

const legacyTiles = (page) => page.locator('#dateIdeasGrid .popup-tile')

async function renderedNames(page) {
  return page.locator('#dateIdeasGrid .event-card__title').allTextContents()
}

async function gotoDateIdeas(page, { flag = 'on' } = {}) {
  await page.goto(`/date-ideas.html?redesign=${flag}`)
  const items = flag === 'on' ? resultTiles(page) : legacyTiles(page)
  await expect(items).toHaveCount(DOCUMENTS.length)
}

/**
 * Opens a chip's dropdown and picks the option with the given label, scoped to
 * that chip's own group. Vibe and Budget both offer a "Free" option, so a
 * bar-wide selector matches two elements.
 */
async function chooseFilter(page, filter, label) {
  const group = page.locator(`.filter-bar__group:has(.filter-chip[data-filter="${filter}"])`)
  await group.locator('.filter-chip').click()
  await group.locator(`[role="option"][data-label="${label}"]`).click()
}

test('the page loads with no page errors', async ({ page }) => {
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))

  await gotoDateIdeas(page)

  expect(errors).toEqual([])
})

test('search narrows the results to matching date ideas', async ({ page }) => {
  await gotoDateIdeas(page)

  await page.locator('.search-bar__input').fill('cloisters')
  await expect(resultTiles(page)).toHaveCount(1)
  expect(await renderedNames(page)).toEqual(['An Afternoon at the Cloisters'])

  // Venue and neighborhood are searchable too, not just the name.
  await page.locator('.search-bar__input').fill('bohemian')
  expect(await renderedNames(page)).toEqual(['Beer Garden Evening in Astoria'])

  await page.locator('.search-bar__input').fill('astoria')
  expect(await renderedNames(page)).toEqual(['Beer Garden Evening in Astoria'])
})

test('the vibe chip filters the results', async ({ page }) => {
  await gotoDateIdeas(page)

  await chooseFilter(page, 'vibe', 'Romantic')
  expect(await renderedNames(page)).toEqual(['Sunset Walk Across the Brooklyn Bridge'])

  await chooseFilter(page, 'vibe', 'Cultural')
  expect(await renderedNames(page)).toEqual(['An Afternoon at the Cloisters'])
})

test('the budget chip filters the results', async ({ page }) => {
  await gotoDateIdeas(page)

  await chooseFilter(page, 'budget', 'Under $30')
  expect(await renderedNames(page)).toEqual(['An Afternoon at the Cloisters'])

  await chooseFilter(page, 'budget', '$75+')
  expect(await renderedNames(page)).toEqual(['Rooftop Stargazing in DUMBO'])
})

test('the neighborhood chip filters the results', async ({ page }) => {
  await gotoDateIdeas(page)

  await chooseFilter(page, 'neighborhood', 'DUMBO')
  expect(await renderedNames(page)).toEqual([
    'Sunset Walk Across the Brooklyn Bridge',
    'Rooftop Stargazing in DUMBO',
  ])
})

test('vibe and budget do not read each other, though both offer "Free"', async ({ page }) => {
  // The one pair that a matcher wired to the wrong field would still get right
  // on any entry where the two agree. These two deliberately disagree.
  await gotoDateIdeas(page)

  await chooseFilter(page, 'vibe', 'Free')
  expect(await renderedNames(page)).toEqual(['Rooftop Stargazing in DUMBO'])

  await chooseFilter(page, 'vibe', 'All Vibes')
  await chooseFilter(page, 'budget', 'Free')
  expect(await renderedNames(page)).toEqual(['Sunset Walk Across the Brooklyn Bridge'])
})

test('chips combine with each other and with the search', async ({ page }) => {
  await gotoDateIdeas(page)

  await chooseFilter(page, 'neighborhood', 'DUMBO')
  await expect(resultTiles(page)).toHaveCount(2)

  await chooseFilter(page, 'budget', '$75+')
  expect(await renderedNames(page)).toEqual(['Rooftop Stargazing in DUMBO'])

  await page.locator('.search-bar__input').fill('sunset')
  await expect(resultTiles(page)).toHaveCount(0)

  await page.locator('.search-bar__input').fill('stargazing')
  expect(await renderedNames(page)).toEqual(['Rooftop Stargazing in DUMBO'])
})

test('the results count follows the filtered set', async ({ page }) => {
  await gotoDateIdeas(page)
  await expect(page.locator('.results-count')).toHaveText('4 date ideas found')

  await chooseFilter(page, 'vibe', 'Romantic')
  await expect(page.locator('.results-count')).toHaveText('1 date idea found')

  await page.locator('.search-bar__input').fill('nothing matches this')
  await expect(page.locator('.results-count')).toHaveText('0 date ideas found')
})

test('the "All …" option clears a single filter', async ({ page }) => {
  // Without one, clearing a filter means re-selecting the active option — a
  // gesture nobody discovers (#295).
  await gotoDateIdeas(page)

  await chooseFilter(page, 'vibe', 'Romantic')
  await expect(resultTiles(page)).toHaveCount(1)

  await chooseFilter(page, 'vibe', 'All Vibes')
  await expect(resultTiles(page)).toHaveCount(DOCUMENTS.length)
})

test('a chip shows its selection and Clear all resets everything', async ({ page }) => {
  await gotoDateIdeas(page)

  const vibeChip = page.locator('.filter-chip[data-filter="vibe"]')
  await expect(vibeChip).toHaveText(/Vibe/)

  await chooseFilter(page, 'vibe', 'Romantic')
  await chooseFilter(page, 'budget', 'Free')
  await page.locator('.search-bar__input').fill('sunset')
  await expect(resultTiles(page)).toHaveCount(1)

  // The selected chip reads as selected, not as its generic label.
  await expect(vibeChip).toHaveText(/Romantic/)
  await expect(vibeChip).toHaveClass(/filter-chip--active/)

  const clearAll = page.locator('.filter-bar__clear')
  await expect(clearAll).toBeVisible()
  await clearAll.click()

  await expect(resultTiles(page)).toHaveCount(DOCUMENTS.length)
  await expect(vibeChip).toHaveText(/Vibe/)
  await expect(vibeChip).not.toHaveClass(/filter-chip--active/)
  // Clear all means all of it: the search box empties too.
  await expect(page.locator('.search-bar__input')).toHaveValue('')
  await expect(clearAll).toBeHidden()
})

test('the neighborhood options come from the loaded content', async ({ page }) => {
  await gotoDateIdeas(page)

  await page.locator('.filter-chip[data-filter="neighborhood"]').click()
  const options = await page
    .locator('.filter-bar__group [role="listbox"][aria-label="Neighborhood"] [role="option"]')
    .allTextContents()

  // The "All …" row is kept, and the rest are exactly the neighborhoods in the
  // data, sorted — not the hardcoded no-JS fallback list.
  expect(options).toEqual(['All Neighborhoods', 'Astoria', 'DUMBO', 'Washington Heights'])
})

test('a neighborhood only past content used cannot linger in the list', async ({ page }) => {
  // Date ideas have one pool — unlike Pop-Ups, no calendar keeps older entries
  // — so the options are exactly what the page can show.
  await page.route('https://41kk82h2.apicdn.sanity.io/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ result: [DOCUMENTS[0]] }),
    })
  )
  await page.goto('/date-ideas.html?redesign=on')
  await expect(resultTiles(page)).toHaveCount(1)

  await page.locator('.filter-chip[data-filter="neighborhood"]').click()
  const options = await page
    .locator('.filter-bar__group [role="listbox"][aria-label="Neighborhood"] [role="option"]')
    .allTextContents()
  expect(options).toEqual(['All Neighborhoods', 'DUMBO'])
})

test('filtering survives a narrow viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 })
  await gotoDateIdeas(page)

  await chooseFilter(page, 'vibe', 'Chill')
  expect(await renderedNames(page)).toEqual(['Beer Garden Evening in Astoria'])
  await expect(page.locator('.results-count')).toHaveText('1 date idea found')

  // The filter bar is still usable rather than pushed off-screen.
  const overflows = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth
  )
  expect(overflows).toBe(false)
})

test('the filter wiring does not run at all with the flag off', async ({ page }) => {
  await gotoDateIdeas(page, { flag: 'off' })

  // The controls are hidden and the legacy page renders every date idea.
  await expect(page.locator('.search-bar-container')).toBeHidden()
  await expect(page.locator('.filter-bar')).toBeHidden()
  await expect(legacyTiles(page)).toHaveCount(DOCUMENTS.length)
  await expect(resultTiles(page)).toHaveCount(0)

  // Those three assertions alone cannot tell the two states apart: with the
  // flag off nothing publishes search:change or filters:change, so a filter
  // controller that ran anyway would render everything and still pass. The
  // dropdown is the one observable difference — setOptions rewrites it from
  // the loaded content, so untouched fallback options mean it never ran.
  //
  // Two guards stop it, and either alone is enough: date-ideas.js checks the
  // flag before wiring, and filters.js never sets window.NycFilters when the
  // flag is off. So this fails only if *both* are removed — verified by
  // mutation. Neither guard is independently observable from outside; that is
  // a property of the page, not a gap in the assertion.
  const options = await page
    .locator('.filter-bar__group [role="listbox"][aria-label="Neighborhood"] [role="option"]')
    .allTextContents()
  expect(options).toEqual([
    'All Neighborhoods',
    'Corona',
    'Fordham',
    'Lincoln Square',
    'Meatpacking District',
    'Midtown',
    'Washington Heights',
  ])
})
