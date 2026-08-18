const { test, expect } = require('@playwright/test')

/** Raw Sanity documents, i.e. what the DATE_IDEAS query returns before mapping. */
const DOCUMENTS = [
  {
    _id: 'brooklyn-bridge-walk',
    slug: 'brooklyn-bridge-walk',
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
    _id: 'cloisters-afternoon',
    slug: 'cloisters-afternoon',
    name: 'An Afternoon at the Cloisters',
    vibe: 'cultural',
    budget: 'under_30',
    borough: 'manhattan',
    neighborhood: 'Washington Heights',
    venue_name: 'The Met Cloisters',
    price: '$22',
    location: 'Washington Heights, Manhattan',
    short_description: 'Medieval galleries, walled gardens and a view of the Hudson.',
    display_overall: true,
  },
  {
    _id: 'astoria-beer-garden',
    slug: 'astoria-beer-garden',
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

/**
 * Navigates and waits for date-ideas.js to have replaced the prebuilt static
 * tiles with the stub's. Cards are still legacy tiles in both flag states —
 * #306 is what swaps them for the shared event cards.
 */
async function gotoDateIdeas(page, { flag = 'on' } = {}) {
  await page.goto(`/date-ideas.html?redesign=${flag}`)
  await expect(page.locator('#dateIdeasGrid .popup-tile')).toHaveCount(DOCUMENTS.length)
}

/** Replaces the grid contents with shared event cards and returns their locator. */
async function renderCards(page) {
  await page.evaluate((data) => {
    const grid = document.getElementById('dateIdeasGrid')
    grid.innerHTML = ''
    for (const idea of data) {
      grid.appendChild(
        window.NycCards.buildEventCard(
          {
            id: idea.slug,
            name: idea.name,
            vibe: idea.vibe,
            budget: idea.budget,
            borough: idea.borough,
            neighborhood: idea.neighborhood,
            venue_name: idea.venue_name,
            price: idea.price,
            short_desc: idea.short_description,
            img: 'resources/images/images/default-popup-image.webp',
          },
          { type: 'date-idea' }
        )
      )
    }
  }, DOCUMENTS)
  return page.locator('.event-card')
}

test('the shell loads with no page errors', async ({ page }) => {
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))

  await gotoDateIdeas(page)

  expect(errors).toEqual([])
})

test('cards stack in a single column instead of two across', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await gotoDateIdeas(page)
  const cards = await renderCards(page)

  await expect(cards).toHaveCount(DOCUMENTS.length)

  const boxes = await cards.evaluateAll((nodes) =>
    nodes.map((node) => {
      const rect = node.getBoundingClientRect()
      return { top: Math.round(rect.top), left: Math.round(rect.left), width: Math.round(rect.width) }
    })
  )

  // One column: every card shares a left edge and width, and each sits below
  // the last. The legacy grid pairs them two across above 900px.
  expect(new Set(boxes.map((box) => box.left)).size).toBe(1)
  expect(new Set(boxes.map((box) => box.width)).size).toBe(1)
  expect(boxes[0].top).toBeLessThan(boxes[1].top)
  expect(boxes[1].top).toBeLessThan(boxes[2].top)
})

for (const width of [1440, 1024, 768]) {
  test(`cards line up with the search bar and filter bar at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await gotoDateIdeas(page)
    await renderCards(page)

    const edges = await page.evaluate(() => {
      // Inner edges of an element — where its children actually start and stop.
      const inner = (selector) => {
        const element = document.querySelector(selector)
        const rect = element.getBoundingClientRect()
        const computed = getComputedStyle(element)
        return {
          left: rect.left + parseFloat(computed.paddingLeft),
          right: rect.right - parseFloat(computed.paddingRight),
        }
      }
      const card = document.querySelector('.event-card').getBoundingClientRect()
      return {
        search: inner('.search-bar-container'),
        filters: inner('.filter-bar'),
        card: { left: card.left, right: card.right },
      }
    })

    expect(Math.abs(edges.card.left - edges.search.left)).toBeLessThanOrEqual(1)
    expect(Math.abs(edges.card.right - edges.search.right)).toBeLessThanOrEqual(1)
    expect(Math.abs(edges.card.left - edges.filters.left)).toBeLessThanOrEqual(1)
    expect(Math.abs(edges.card.right - edges.filters.right)).toBeLessThanOrEqual(1)
  })
}

test('the results region never overflows the container width', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 900 })
  await gotoDateIdeas(page)
  await renderCards(page)

  const { cardWidth, containerMax } = await page.evaluate(() => ({
    cardWidth: document.querySelector('.event-card').getBoundingClientRect().width,
    containerMax: parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue('--container-max-width')
    ),
  }))

  expect(cardWidth).toBeLessThanOrEqual(containerMax)
})

test('the page offers no view toggle', async ({ page }) => {
  // A map does not apply to evergreen date ideas (REDESIGN.md section 7.2), so
  // search.js never stamps data-view here and nothing may depend on it.
  await gotoDateIdeas(page)

  await expect(page.locator('.view-toggle')).toHaveCount(0)
  expect(await page.evaluate(() => document.documentElement.getAttribute('data-view'))).toBeNull()

  // The list still shows without one — its visibility cannot hang off data-view.
  const display = await page.evaluate(
    () => getComputedStyle(document.querySelector('.results__panel--list')).display
  )
  expect(display).not.toBe('none')
})

test('the redesign chrome belongs to the flag only', async ({ page }) => {
  await gotoDateIdeas(page)
  await expect(page.locator('.results-divider')).toBeVisible()
  await expect(page.locator('.search-bar-container')).toBeVisible()
  await expect(page.locator('.filter-bar')).toBeVisible()
  await expect(page.locator('.results-count')).toBeVisible()

  // The divider shipped in the Epic 3 markup but its flag-off default lived in
  // popups-redesign.css, which this page does not link — so a stray rule was
  // visible on the legacy page. Moving it to results.css is what fixes it.
  await gotoDateIdeas(page, { flag: 'off' })
  await expect(page.locator('.results-divider')).toBeHidden()
  await expect(page.locator('.search-bar-container')).toBeHidden()
  await expect(page.locator('.filter-bar')).toBeHidden()
  await expect(page.locator('.results-count')).toBeHidden()
})

test('the legacy grid keeps its own layout with the flag off', async ({ page }) => {
  await gotoDateIdeas(page, { flag: 'off' })

  // Baseline captured from the page before this issue touched it. Unlike
  // section#popupsGrid, the date ideas rule is restated at the same weight in
  // its own media queries, so the padding really does change below 975px.
  for (const [width, expected] of [
    [1440, { columns: 2, padding: { top: '16px', left: '16px' } }],
    [1024, { columns: 2, padding: { top: '16px', left: '16px' } }],
    [900, { columns: 1, padding: { top: '0px', left: '16px' } }],
    [600, { columns: 1, padding: { top: '0px', left: '16px' } }],
    [450, { columns: 1, padding: { top: '0px', left: '16px' } }],
  ]) {
    await page.setViewportSize({ width, height: 900 })
    const layout = await page.locator('#dateIdeasGrid').evaluate((grid) => {
      const computed = getComputedStyle(grid)
      return {
        tracks: computed.gridTemplateColumns.split(' ').length,
        paddingTop: computed.paddingTop,
        paddingLeft: computed.paddingLeft,
      }
    })

    expect(layout.tracks, `column count at ${width}px`).toBe(expected.columns)
    expect(layout.paddingTop, `padding-top at ${width}px`).toBe(expected.padding.top)
    expect(layout.paddingLeft, `padding-left at ${width}px`).toBe(expected.padding.left)
  }
})

test('the legacy tiles still render with the flag off', async ({ page }) => {
  // #306 replaces these with shared event cards; until then the shell only
  // restyles the region around them, and the legacy render must survive.
  await gotoDateIdeas(page, { flag: 'off' })
  await expect(page.locator('#dateIdeasGrid .popup-tile').first()).toBeVisible()
  await expect(page.locator('#dateIdeasGrid .popup-tile__details h3').first()).toHaveText(DOCUMENTS[0].name)
})
