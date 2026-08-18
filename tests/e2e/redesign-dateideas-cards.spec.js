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
    address: 'Brooklyn Bridge Promenade, Brooklyn, NY',
    price: 'Free',
    location: 'DUMBO, Brooklyn',
    short_description: 'Time it for golden hour and finish with pizza underneath.',
    long_description: 'Start on the Brooklyn side an hour before sunset so the light is behind you the whole way across.',
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
    address: '99 Margaret Corbin Dr, New York, NY',
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

const cards = (page) => page.locator('#dateIdeasGrid .event-card')

async function gotoDateIdeas(page, { flag = 'on' } = {}) {
  await page.goto(`/date-ideas.html?redesign=${flag}`)
  if (flag === 'on') await expect(cards(page)).toHaveCount(DOCUMENTS.length)
}

/** Opens a chip's dropdown and picks an option, scoped to that chip's group. */
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

test('results render as shared event cards, not legacy tiles', async ({ page }) => {
  await gotoDateIdeas(page)

  await expect(page.locator('#dateIdeasGrid .popup-tile')).toHaveCount(0)
  await expect(cards(page).first().locator('.event-card__title')).toHaveText(
    'Sunset Walk Across the Brooklyn Bridge'
  )
})

test('the vibe column replaces the date column', async ({ page }) => {
  await gotoDateIdeas(page)
  const first = cards(page).first()

  // REDESIGN.md 7.2: no date column — a vibe icon/label column in its place.
  await expect(first.locator('.event-card__vibe')).toHaveText('🌹 Romantic')
  await expect(first.locator('.event-card__day-name')).toHaveCount(0)
  await expect(first.locator('.event-card__day-number')).toHaveCount(0)
  await expect(first.locator('.event-card__month')).toHaveCount(0)
})

test('the image tag carries the budget, not a second copy of the vibe', async ({ page }) => {
  await gotoDateIdeas(page)

  // The two slots carry different fields, as they do on a pop-up card (date
  // column, category tag). Repeating the vibe read as a bug.
  const cloisters = cards(page).nth(1)
  await expect(cloisters.locator('.event-card__vibe')).toHaveText('🎭 Cultural')
  await expect(cloisters.locator('.event-card__tag')).toHaveText(/Under \$30/)

  const tagText = await cloisters.locator('.event-card__tag').textContent()
  const vibeText = await cloisters.locator('.event-card__vibe').textContent()
  expect(tagText).not.toBe(vibeText)
})

test('a free entry does not say Free twice', async ({ page }) => {
  await gotoDateIdeas(page)

  // "Free" is both a price and a budget tier, so the two slots would otherwise
  // print the same word. The bracket is dropped when the exact price says it.
  const walk = cards(page).first()
  await expect(walk.locator('.event-card__price')).toHaveText('Free')
  await expect(walk.locator('.event-card__tag')).toHaveCount(0)

  // A priced entry keeps both: "$22" and "Under $30" are not the same claim.
  const cloisters = cards(page).nth(1)
  await expect(cloisters.locator('.event-card__price')).toHaveText('$22')
  await expect(cloisters.locator('.event-card__tag')).toHaveText(/Under \$30/)
})

test('cards carry the venue and area, and link to the detail page', async ({ page }) => {
  await gotoDateIdeas(page)
  const first = cards(page).first()

  await expect(first.locator('.event-card__venue')).toHaveText('Brooklyn Bridge')
  await expect(first.locator('.event-card__area')).toHaveText('DUMBO, Brooklyn')
  // Still a real link, so it survives a middle click and a crawler.
  await expect(first).toHaveAttribute('href', 'date-idea.html?id=walk')
})

test('the empty state offers the way out and clearing works', async ({ page }) => {
  await gotoDateIdeas(page)

  await chooseFilter(page, 'vibe', 'Foodie')
  await expect(cards(page)).toHaveCount(0)

  const empty = page.locator('.results-empty')
  await expect(empty).toBeVisible()
  await expect(empty).toContainText(/date idea/i)
  await expect(empty).not.toContainText(/pop-up/i)

  await empty.getByRole('button').click()
  await expect(cards(page)).toHaveCount(DOCUMENTS.length)
  await expect(empty).toHaveCount(0)
})

test('clicking a card opens the detail modal instead of navigating', async ({ page }) => {
  await gotoDateIdeas(page)

  await cards(page).first().click()

  const modal = page.locator('.modal--detail')
  await expect(modal).toBeVisible()
  await expect(modal.locator('.modal-detail__title')).toHaveText(
    'Sunset Walk Across the Brooklyn Bridge'
  )
  // The long description wins over the short one in the modal.
  await expect(modal.locator('.modal-detail__description')).toContainText('an hour before sunset')
  await expect(modal.locator('.modal-detail__venue')).toHaveText('Brooklyn Bridge')

  // The URL becomes the entry's own page, so a copied link still resolves.
  expect(page.url()).toContain('date-idea.html?id=walk')
})

test('the modal leaves out what evergreen content does not have', async ({ page }) => {
  await gotoDateIdeas(page)
  await cards(page).first().click()

  const modal = page.locator('.modal--detail')
  await expect(modal).toBeVisible()

  // No date, so no date line and nothing to add to a calendar.
  await expect(modal.locator('.modal-detail__when')).toHaveCount(0)
  await expect(modal.locator('.modal-detail__calendar')).toHaveCount(0)

  // And it does not call a date idea an event.
  await expect(modal.locator('.modal-detail__share')).toHaveText('Share Date Idea')
  await expect(modal.locator('.modal-return-bar')).toContainText(/date idea/i)
})

test('the modal shows the vibe and price tags', async ({ page }) => {
  await gotoDateIdeas(page)
  await cards(page).nth(1).click()

  const tags = page.locator('.modal--detail .modal-detail__tags')
  await expect(tags).toContainText('Cultural')
  await expect(tags).toContainText('$22')
})

test('the modal is dismissible and returns focus to the card', async ({ page }) => {
  await gotoDateIdeas(page)

  const card = cards(page).first()
  await card.click()
  await expect(page.locator('.modal--detail')).toBeVisible()

  await page.keyboard.press('Escape')
  await expect(page.locator('.modal--detail')).toHaveCount(0)

  // Focus goes back where it came from, not to the top of the document.
  const focusedTitle = await page.evaluate(
    () => document.activeElement && document.activeElement.querySelector('.event-card__title')?.textContent
  )
  expect(focusedTitle).toBe('Sunset Walk Across the Brooklyn Bridge')
})

test('Back dismisses the modal rather than leaving the page', async ({ page }) => {
  await gotoDateIdeas(page)

  await cards(page).first().click()
  await expect(page.locator('.modal--detail')).toBeVisible()

  await page.goBack()
  await expect(page.locator('.modal--detail')).toHaveCount(0)
  await expect(cards(page)).toHaveCount(DOCUMENTS.length)
  expect(page.url()).toContain('date-ideas.html')
})

test('a modified click still opens the detail page in a new tab', async ({ page, context }) => {
  await gotoDateIdeas(page)

  // Asking the browser for a new tab must not be swallowed by the modal.
  // waitForURL, not waitForLoadState: a new tab starts at about:blank and
  // that load state resolves before the navigation has happened.
  const modifier = process.platform === 'darwin' ? 'Meta' : 'Control'
  const [opened] = await Promise.all([
    context.waitForEvent('page'),
    cards(page).first().click({ modifiers: [modifier] }),
  ])
  await opened.waitForURL(/date-idea\.html/)

  expect(new URL(opened.url()).pathname).toBe('/date-idea.html')
  expect(opened.url()).toContain('id=walk')
  await expect(page.locator('.modal--detail')).toHaveCount(0)
  await opened.close()
})

test('the modal is usable on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await gotoDateIdeas(page)

  await cards(page).first().click()
  const modal = page.locator('.modal--detail')
  await expect(modal).toBeVisible()

  // Stacked, inside the viewport, and not overflowing sideways.
  const overflows = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth
  )
  expect(overflows).toBe(false)

  const box = await modal.locator('.modal-detail__card').boundingBox()
  expect(box.width).toBeLessThanOrEqual(390)
})

test('cards stay a single column and line up with the bars above', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await gotoDateIdeas(page)

  const edges = await page.evaluate(() => {
    const inner = (selector) => {
      const element = document.querySelector(selector)
      const rect = element.getBoundingClientRect()
      const computed = getComputedStyle(element)
      return {
        left: rect.left + parseFloat(computed.paddingLeft),
        right: rect.right - parseFloat(computed.paddingRight),
      }
    }
    const boxes = [...document.querySelectorAll('.event-card')].map((node) => {
      const rect = node.getBoundingClientRect()
      return { left: Math.round(rect.left), right: Math.round(rect.right), top: Math.round(rect.top) }
    })
    return { search: inner('.search-bar-container'), boxes }
  })

  expect(new Set(edges.boxes.map((box) => box.left)).size).toBe(1)
  expect(edges.boxes[0].top).toBeLessThan(edges.boxes[1].top)
  expect(Math.abs(edges.boxes[0].left - edges.search.left)).toBeLessThanOrEqual(1)
  expect(Math.abs(edges.boxes[0].right - edges.search.right)).toBeLessThanOrEqual(1)
})

test('filtering re-renders cards and the modal still opens afterwards', async ({ page }) => {
  // Clicks are delegated, so a re-render must not need re-binding.
  await gotoDateIdeas(page)

  await chooseFilter(page, 'vibe', 'Chill')
  await expect(cards(page)).toHaveCount(1)

  await cards(page).first().click()
  await expect(page.locator('.modal--detail .modal-detail__title')).toHaveText(
    'Beer Garden Evening in Astoria'
  )
})

test('the legacy experience is untouched with the flag off', async ({ page }) => {
  await gotoDateIdeas(page, { flag: 'off' })

  await expect(page.locator('#dateIdeasGrid .popup-tile')).toHaveCount(DOCUMENTS.length)
  await expect(page.locator('#dateIdeasGrid .event-card')).toHaveCount(0)
  await expect(page.locator('.results-empty')).toBeHidden()

  // Tiles navigate; nothing intercepts the click into a modal.
  await expect(page.locator('#dateIdeasGrid .popup-tile').first()).toHaveAttribute(
    'href',
    'date-idea.html?id=walk'
  )
})
