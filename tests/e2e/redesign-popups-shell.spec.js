const { test, expect } = require('@playwright/test')

const POPUPS = [
  {
    id: 'flavia-lounge',
    name: 'Flavia Flavor Lounge',
    start_datetime: '2026-07-23T15:00:00.000Z',
    end_datetime: '2026-07-24T23:00:00.000Z',
    category: 'food_drink',
    venue_name: '22 Wooster',
    neighborhood: 'SoHo',
    borough: 'manhattan',
    price: 'Free',
    short_desc: 'Sip complimentary coffee and tea and match a drink to your mood.',
    img: 'resources/images/images/default-popup-image.webp',
  },
  {
    id: 'chelsea-night-market',
    name: 'Chelsea Night Market',
    start_datetime: '2026-07-25T22:00:00.000Z',
    category: 'market',
    venue_name: 'Chelsea Piers',
    neighborhood: 'Chelsea',
    borough: 'manhattan',
    price: '$15',
    short_desc: 'Forty vendors, live music and a skyline view after dark.',
    img: 'resources/images/images/default-popup-image.webp',
  },
  {
    id: 'bushwick-vintage',
    name: 'Bushwick Vintage Fair',
    start_datetime: '2026-08-01T14:00:00.000Z',
    category: 'vintage_thrift',
    venue_name: 'The Sultan Room',
    neighborhood: 'Bushwick',
    borough: 'brooklyn',
    price: 'Free',
    short_desc: 'Racks of archive denim, band tees and 70s glassware.',
    img: 'resources/images/images/default-popup-image.webp',
  },
]

/** Renders the fixture cards into the list panel and returns their locator. */
async function renderCards(page, popups = POPUPS) {
  await page.evaluate((data) => {
    const grid = document.getElementById('popupsGrid')
    grid.innerHTML = ''
    for (const popup of data) {
      grid.appendChild(window.NycCards.buildEventCard(popup, { type: 'popup' }))
    }
  }, popups)
  return page.locator('.event-card')
}

test('the shell loads with no page errors', async ({ page }) => {
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))

  await page.goto('/pop-ups.html?redesign=on')

  expect(errors).toEqual([])
})

test('cards stack in a single column instead of two across', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/pop-ups.html?redesign=on')
  const cards = await renderCards(page)

  await expect(cards).toHaveCount(3)

  const boxes = await cards.evaluateAll((nodes) =>
    nodes.map((node) => {
      const rect = node.getBoundingClientRect()
      return { top: Math.round(rect.top), left: Math.round(rect.left), width: Math.round(rect.width) }
    })
  )

  // One column: every card shares a left edge and width, and each sits below
  // the last. Two-across would pair them on a row.
  expect(new Set(boxes.map((box) => box.left)).size).toBe(1)
  expect(new Set(boxes.map((box) => box.width)).size).toBe(1)
  expect(boxes[0].top).toBeLessThan(boxes[1].top)
  expect(boxes[1].top).toBeLessThan(boxes[2].top)
})

for (const width of [1440, 1024, 768]) {
  test(`cards line up with the search bar and filter bar at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/pop-ups.html?redesign=on')
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
  await page.goto('/pop-ups.html?redesign=on')
  await renderCards(page)

  const { cardWidth, containerMax } = await page.evaluate(() => ({
    cardWidth: document.querySelector('.event-card').getBoundingClientRect().width,
    containerMax: parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue('--container-max-width')
    ),
  }))

  expect(cardWidth).toBeLessThanOrEqual(containerMax)
})

/** Which panel each view shows. Exactly one is ever visible. */
const panels = (page) =>
  page.evaluate(() => ({
    view: document.documentElement.getAttribute('data-view'),
    list: getComputedStyle(document.querySelector('.results__panel--list')).display,
    map: getComputedStyle(document.querySelector('.results__panel--map')).display,
    calendar: getComputedStyle(document.querySelector('.results__panel--calendar')).display,
  }))

test('the map panel stays hidden until the toggle asks for it', async ({ page }) => {
  await page.goto('/pop-ups.html?redesign=on')

  // The map and calendar panels are containers the shell only shows or hides —
  // the calendar's contents arrive in #300 — so assert on display rather than
  // on rendered size.
  expect(await panels(page)).toEqual({ view: 'list', list: 'grid', map: 'none', calendar: 'none' })

  await page.getByRole('button', { name: 'Map' }).click()
  expect(await panels(page)).toEqual({ view: 'map', list: 'none', map: 'block', calendar: 'none' })

  await page.getByRole('button', { name: 'List' }).click()
  expect(await panels(page)).toEqual({ view: 'list', list: 'grid', map: 'none', calendar: 'none' })
})

test('the calendar panel stays hidden until the toggle asks for it', async ({ page }) => {
  await page.goto('/pop-ups.html?redesign=on')

  await page.getByRole('button', { name: 'Calendar' }).click()
  expect(await panels(page)).toEqual({ view: 'calendar', list: 'none', map: 'none', calendar: 'block' })

  // Straight from Calendar to Map, without passing through List.
  await page.getByRole('button', { name: 'Map' }).click()
  expect(await panels(page)).toEqual({ view: 'map', list: 'none', map: 'block', calendar: 'none' })

  await page.getByRole('button', { name: 'Calendar' }).click()
  expect(await panels(page)).toEqual({ view: 'calendar', list: 'none', map: 'none', calendar: 'block' })
})

test('the list panel shows before any view has been chosen', async ({ page }) => {
  // The prebuilt static tiles are the no-JS experience: the list panel cannot
  // wait for search.js to stamp data-view before it is visible.
  await page.goto('/pop-ups.html?redesign=on')
  await page.evaluate(() => document.documentElement.removeAttribute('data-view'))

  const display = await page.evaluate(
    () => getComputedStyle(document.querySelector('.results__panel--list')).display
  )
  expect(display).not.toBe('none')
})

test('the results divider is part of the redesign only', async ({ page }) => {
  await page.goto('/pop-ups.html?redesign=on')
  await expect(page.locator('.results-divider')).toBeVisible()

  await page.goto('/pop-ups.html?redesign=off')
  await expect(page.locator('.results-divider')).toBeHidden()
  await expect(page.locator('.results__panel--map')).toBeHidden()
  await expect(page.locator('.results__panel--calendar')).toBeHidden()
  await expect(page.locator('.search-bar-container')).toBeHidden()
  await expect(page.locator('.filter-bar')).toBeHidden()
})

test('the legacy grid keeps its own layout with the flag off', async ({ page }) => {
  await page.goto('/pop-ups.html?redesign=off')

  // #popupsGrid:empty zeroes the padding, so measure a populated grid.
  await page.evaluate(() => {
    const grid = document.getElementById('popupsGrid')
    grid.innerHTML = '<a class="popup-tile popup-tile--horizontal"><div class="popup-tile__details"><h3>Tile</h3></div></a>'
  })

  // Baseline captured from the page before this issue touched it. section#popupsGrid
  // sets padding at !important and outranks every media query, so the legacy grid
  // is 16px on all sides at every width.
  for (const [width, expected] of [
    [1440, { columns: 2, padding: ['16px', '16px'] }],
    [900, { columns: 1, padding: ['16px', '16px'] }],
    [600, { columns: 1, padding: ['16px', '16px'] }],
  ]) {
    await page.setViewportSize({ width, height: 900 })
    const layout = await page.locator('#popupsGrid').evaluate((grid) => {
      const computed = getComputedStyle(grid)
      return {
        tracks: computed.gridTemplateColumns.split(' ').length,
        paddingTop: computed.paddingTop,
        paddingLeft: computed.paddingLeft,
      }
    })

    expect(layout.tracks, `column count at ${width}px`).toBe(expected.columns)
    expect(layout.paddingTop, `padding-top at ${width}px`).toBe(expected.padding[0])
    expect(layout.paddingLeft, `padding-left at ${width}px`).toBe(expected.padding[1])
  }
})
