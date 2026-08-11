const { test, expect } = require('@playwright/test')

const DOCUMENTS = [
  {
    _id: 'flavia',
    slug: 'flavia',
    name: 'Flavia Flavor Lounge',
    start_datetime: '2026-08-13T15:00:00Z',
    end_datetime: '2026-08-14T23:00:00Z',
    category: 'food_drink',
    borough: 'manhattan',
    neighborhood: 'SoHo',
    venue_name: '22 Wooster',
    address: '22 Wooster St, New York, NY 10013',
    price: 'Free',
    short_description: 'Sip complimentary coffee and tea.',
    long_description: 'A loft space built for lingering, with a rotating cast of roasters.',
    imageUrl: '/resources/images/images/default-popup-image.webp',
    display_overall: true,
    display_in_popups_page: true,
  },
  {
    _id: 'chelsea',
    slug: 'chelsea',
    name: 'Chelsea Night Market',
    start_datetime: '2026-08-15T22:00:00Z',
    category: 'market',
    borough: 'manhattan',
    neighborhood: 'Chelsea',
    venue_name: 'Chelsea Piers',
    price: '$15',
    short_description: 'Forty vendors after dark.',
    imageUrl: '/resources/images/images/default-popup-image.webp',
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

async function gotoList(page, flag = 'on') {
  await page.goto(`/pop-ups.html?redesign=${flag}`)
  const item = flag === 'on' ? page.locator('.event-card') : page.locator('#popupsGrid .popup-tile')
  await expect(item.first()).toBeVisible()
}

const modal = (page) => page.locator('.modal--detail')
const firstCard = (page) => page.locator('.event-card').first()

test('clicking a card opens the detail modal instead of navigating', async ({ page }) => {
  await gotoList(page)
  await firstCard(page).click()

  await expect(modal(page)).toBeVisible()
  expect(new URL(page.url()).pathname).toBe('/pop-up.html')
  // Still the list page underneath — no document navigation happened.
  await expect(page.locator('#popupsGrid')).toBeAttached()
})

test('the modal shows the event detail content', async ({ page }) => {
  await gotoList(page)
  await firstCard(page).click()

  const card = modal(page)
  await expect(card.getByRole('heading', { name: 'Flavia Flavor Lounge' })).toBeVisible()
  await expect(card).toContainText('22 Wooster')
  await expect(card).toContainText('A loft space built for lingering')
  await expect(card).toContainText('Free')
  await expect(card.getByRole('link', { name: /google calendar/i })).toBeVisible()
  await expect(card.getByRole('button', { name: /share event/i })).toBeVisible()
  await expect(card.locator('.modal-detail__image')).toBeVisible()
})

test('the return bar names where you are going back to', async ({ page }) => {
  await gotoList(page)
  await firstCard(page).click()

  await expect(modal(page).locator('.modal-return-bar')).toHaveText('← Return to all pop-ups')
})

for (const [label, dismiss] of [
  ['the return bar', async (page) => page.locator('.modal-return-bar').click()],
  ['Escape', async (page) => page.keyboard.press('Escape')],
  ['clicking the overlay', async (page) => page.locator('.modal--detail').click({ position: { x: 5, y: 5 } })],
]) {
  test(`${label} closes the modal and restores the list URL`, async ({ page }) => {
    await gotoList(page)
    await firstCard(page).click()
    await expect(modal(page)).toBeVisible()

    await dismiss(page)

    await expect(modal(page)).toHaveCount(0)
    // The history entry pushed on open must not be left behind.
    expect(new URL(page.url()).pathname).toBe('/pop-ups.html')
  })
}

test('the browser Back button closes the modal and keeps you on the list', async ({ page }) => {
  await gotoList(page)
  await firstCard(page).click()
  await expect(modal(page)).toBeVisible()

  await page.goBack()

  await expect(modal(page)).toHaveCount(0)
  expect(new URL(page.url()).pathname).toBe('/pop-ups.html')
  await expect(page.locator('.event-card')).toHaveCount(2)
})

test('opening a second card after closing the first still works', async ({ page }) => {
  await gotoList(page)

  await firstCard(page).click()
  await page.keyboard.press('Escape')
  await expect(modal(page)).toHaveCount(0)

  await page.locator('.event-card').nth(1).click()
  await expect(modal(page).getByRole('heading', { name: 'Chelsea Night Market' })).toBeVisible()
})

test('focus moves into the modal and returns to the card afterwards', async ({ page }) => {
  await gotoList(page)
  await firstCard(page).focus()
  await firstCard(page).click()

  const insideModal = await page.evaluate(
    () => document.activeElement.closest('.modal--detail') !== null
  )
  expect(insideModal).toBe(true)

  await page.keyboard.press('Escape')
  await expect(firstCard(page)).toBeFocused()
})

test('the card stays a real link so it can be opened in a new tab', async ({ page }) => {
  await gotoList(page)

  // Intercepting a plain click must not cost middle-click, cmd-click or no-JS.
  await expect(firstCard(page)).toHaveAttribute('href', 'pop-up.html?id=flavia')

  const modifier = process.platform === 'darwin' ? 'Meta' : 'Control'
  const [opened] = await Promise.all([
    page.context().waitForEvent('page'),
    firstCard(page).click({ modifiers: [modifier] }),
  ])
  await opened.waitForURL(/pop-up\.html/)

  expect(new URL(opened.url()).pathname).toBe('/pop-up.html')
  // The list page did not open a modal for the modified click.
  await expect(modal(page)).toHaveCount(0)
  await opened.close()
})

test('the modal works on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await gotoList(page)
  await firstCard(page).click()

  await expect(modal(page)).toBeVisible()
  const overflows = await page.evaluate(() => {
    const card = document.querySelector('.modal-detail__card')
    return card.getBoundingClientRect().width > window.innerWidth
  })
  expect(overflows).toBe(false)

  await page.locator('.modal-return-bar').click()
  await expect(modal(page)).toHaveCount(0)
})

test('the flag-off page still navigates to the detail page', async ({ page }) => {
  await gotoList(page, 'off')

  await page.locator('#popupsGrid .popup-tile').first().click()
  await page.waitForURL(/pop-up\.html/)

  expect(new URL(page.url()).pathname).toBe('/pop-up.html')
  await expect(page.locator('.modal--detail')).toHaveCount(0)
})

test('the detail flow loads with no page errors', async ({ page }) => {
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))

  await gotoList(page)
  await firstCard(page).click()
  await page.keyboard.press('Escape')

  expect(errors).toEqual([])
})
