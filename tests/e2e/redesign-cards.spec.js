const { test, expect } = require('@playwright/test')

const POPUP = {
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
}

const DATE_IDEA = {
  id: 'whitney-free-fridays',
  name: 'Whitney Museum Free Fridays',
  vibe: 'cultural',
  venue_name: 'Whitney Museum',
  neighborhood: 'Meatpacking District',
  price: 'Free',
  short_desc: 'Free Friday evenings with art, drinks and skyline views.',
  img: 'resources/images/images/default-popup-image.webp',
}

// Classic scripts share one global lexical scope, so a duplicate top-level
// declaration in any of them silently kills a whole file.
for (const path of ['/pop-ups.html?redesign=on', '/date-ideas.html?redesign=on']) {
  test(`${path} loads every script without a global collision`, async ({ page }) => {
    const errors = []
    page.on('pageerror', (error) => errors.push(error.message))

    await page.goto(path)

    expect(errors).toEqual([])
  })
}

/** Builds a card in the page and returns a locator for it. */
async function renderCard(page, data, options = {}) {
  await page.evaluate(
    ({ data, options }) => {
      const grid = document.getElementById('popupsGrid') || document.getElementById('dateIdeasGrid')
      grid.innerHTML = ''
      grid.appendChild(window.NycCards.buildEventCard(data, options))
    },
    { data, options }
  )
  return page.locator('.event-card')
}

test('a pop-up card renders date, image and details columns', async ({ page }) => {
  await page.goto('/pop-ups.html?redesign=on')
  const card = await renderCard(page, POPUP)

  await expect(card).toBeVisible()
  await expect(card.locator('.event-card__day-name')).toHaveText('THU')
  await expect(card.locator('.event-card__day-number')).toHaveText('23')
  await expect(card.locator('.event-card__month')).toHaveText('July 2026')
  await expect(card.locator('.event-card__through')).toHaveText('through Jul 24')
  await expect(card.locator('.event-card__tag')).toHaveText('🍕 Food & Drink')
  await expect(card.locator('.event-card__title')).toHaveText('Flavia Flavor Lounge')
  await expect(card.locator('.event-card__venue')).toHaveText('22 Wooster')
  // The title sits beside it in the same link, so the photo is decorative and
  // should not be announced a second time.
  await expect(card.locator('.event-card__image')).toHaveAttribute('alt', '')
  await expect(card).toHaveAttribute('href', 'pop-up.html?id=flavia-lounge')

  const columns = await card.evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length)
  expect(columns).toBe(3)
})

test('an all-day event shows its own date, not the evening before', async ({ page }) => {
  await page.goto('/pop-ups.html?redesign=on')
  // mapSanityPopup folds an all-day start_date into start_datetime as a
  // date-only string.
  const card = await renderCard(page, {
    ...POPUP,
    start_datetime: '2026-07-25',
    end_datetime: '2026-07-26',
  })

  await expect(card.locator('.event-card__day-name')).toHaveText('SAT')
  await expect(card.locator('.event-card__day-number')).toHaveText('25')
  await expect(card.locator('.event-card__through')).toHaveText('through Jul 26')
})

test('a free price takes the green badge treatment', async ({ page }) => {
  await page.goto('/pop-ups.html?redesign=on')
  const card = await renderCard(page, POPUP)

  const badge = card.locator('.event-card__price')
  await expect(badge).toHaveText('Free')
  await expect(badge).toHaveClass(/event-card__price--free/)

  const paid = await renderCard(page, { ...POPUP, price: '$15–30' })
  await expect(paid.locator('.event-card__price')).not.toHaveClass(/event-card__price--free/)
})

test('a date idea card shows a vibe label in place of the date', async ({ page }) => {
  await page.goto('/date-ideas.html?redesign=on')
  const card = await renderCard(page, DATE_IDEA, { type: 'date-idea' })

  await expect(card.locator('.event-card__vibe')).toHaveText('🎭 Cultural')
  await expect(card.locator('.event-card__day-number')).toHaveCount(0)
  await expect(card).toHaveAttribute('href', 'date-idea.html?id=whitney-free-fridays')
})

test('a featured card becomes a single full-width image column', async ({ page }) => {
  await page.goto('/pop-ups.html?redesign=on')
  const card = await renderCard(page, { ...POPUP, is_featured: true })

  await expect(card).toHaveClass(/event-card--featured/)
  const columns = await card.evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length)
  expect(columns).toBe(1)
})

test('card content is inserted as text, never as markup', async ({ page }) => {
  await page.goto('/pop-ups.html?redesign=on')
  const card = await renderCard(page, {
    ...POPUP,
    name: '<img src=x onerror="window.__pwned=1">Sneaky',
  })

  await expect(card.locator('.event-card__title')).toHaveText('<img src=x onerror="window.__pwned=1">Sneaky')
  expect(await page.evaluate(() => window.__pwned)).toBeUndefined()
})

test('the card collapses to a single column on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/pop-ups.html?redesign=on')
  const card = await renderCard(page, POPUP)

  const columns = await card.evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length)
  expect(columns).toBe(1)

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  )
  expect(overflow).toBe(0)
})

test('the date column shrinks on a tablet', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 })
  await page.goto('/pop-ups.html?redesign=on')
  const card = await renderCard(page, POPUP)

  const firstColumn = await card.evaluate((el) =>
    parseFloat(getComputedStyle(el).gridTemplateColumns.split(' ')[0])
  )
  expect(firstColumn).toBe(100)
})

test('a sparse record still renders a usable card', async ({ page }) => {
  await page.goto('/pop-ups.html?redesign=on')
  const card = await renderCard(page, { id: 'bare', name: 'Untagged Pop-Up' })

  await expect(card).toBeVisible()
  await expect(card.locator('.event-card__title')).toHaveText('Untagged Pop-Up')
  // Nothing empty is rendered for the fields that are missing.
  await expect(card.locator('.event-card__tag')).toHaveCount(0)
  await expect(card.locator('.event-card__price')).toHaveCount(0)
  await expect(card.locator('.event-card__meta')).toHaveCount(0)
  await expect(card.locator('.event-card__description')).toHaveCount(0)
  // And it still falls back to the placeholder photo.
  await expect(card.locator('.event-card__image')).toHaveAttribute(
    'src',
    /default-popup-image\.webp$/
  )
})

test('a featured date idea keeps its vibe column readable over the image', async ({ page }) => {
  await page.goto('/date-ideas.html?redesign=on')
  const card = await renderCard(page, { ...DATE_IDEA, is_featured: true }, { type: 'date-idea' })

  await expect(card).toHaveClass(/event-card--featured/)
  await expect(card.locator('.event-card__vibe')).toHaveText('🎭 Cultural')

  const overlaps = await card.evaluate((el) => {
    const lead = el.querySelector('.event-card__date').getBoundingClientRect()
    const details = el.querySelector('.event-card__details').getBoundingClientRect()
    return !(lead.bottom <= details.top || details.bottom <= lead.top)
  })
  expect(overlaps).toBe(false)
})

test('cards stay hidden when the redesign flag is off', async ({ page }) => {
  await page.goto('/pop-ups.html')
  const card = await renderCard(page, POPUP)

  await expect(card).toBeHidden()
})
