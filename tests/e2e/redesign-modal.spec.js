const { test, expect } = require('@playwright/test')

const EVENT = {
  id: 'flavia-lounge',
  name: 'Flavia Flavor Lounge',
  start_datetime: '2026-07-23T15:00:00.000Z',
  end_datetime: '2026-07-23T19:00:00.000Z',
  category: 'food_drink',
  price: 'Free',
  venue_name: '22 Wooster',
  address: '22 Wooster St, New York, NY 10013',
  neighborhood: 'SoHo',
  borough: 'manhattan',
  short_desc: 'Sip complimentary coffee and tea, and match a drink to your mood.',
  img: 'resources/images/images/default-popup-image.webp',
}

const dialog = (page) => page.getByRole('dialog')

/** Opens the modal from a trigger button, so focus restoration can be checked. */
async function openModal(page, data = EVENT, options = {}) {
  await page.evaluate(
    ({ data, options }) => {
      let trigger = document.getElementById('test-trigger')
      if (!trigger) {
        trigger = document.createElement('button')
        trigger.id = 'test-trigger'
        trigger.textContent = 'Open detail'
        document.querySelector('main').prepend(trigger)
      }
      trigger.onclick = () => window.NycModal.openDetailModal(data, options)
    },
    { data, options }
  )
  await page.locator('#test-trigger').click()
}

test('the modal presents the event with a return bar', async ({ page }) => {
  await page.goto('/pop-ups.html?redesign=on')
  await openModal(page, EVENT, { returnLabel: 'Return to all pop-ups' })

  await expect(dialog(page)).toBeVisible()
  await expect(page.locator('.modal-return-bar')).toHaveText(/Return to all pop-ups/)
  await expect(page.locator('.modal-detail__title')).toHaveText('Flavia Flavor Lounge')
  await expect(page.locator('.modal-detail__when')).toHaveText(/July 23, 2026/)
  await expect(page.locator('.modal-detail__venue')).toHaveText('22 Wooster')
  await expect(page.locator('.modal-detail__description')).toHaveText(/complimentary coffee/)
  await expect(page.locator('.modal-detail__tags')).toContainText('Food & Drink')
  await expect(page.locator('.modal-detail__tags')).toContainText('Free')
  await expect(page.locator('.modal-detail__image')).toHaveAttribute('alt', '')
})

test('the dialog is labelled by its title for assistive tech', async ({ page }) => {
  await page.goto('/pop-ups.html?redesign=on')
  await openModal(page)

  await expect(dialog(page)).toHaveAttribute('aria-modal', 'true')
  const labelledBy = await dialog(page).getAttribute('aria-labelledby')
  expect(labelledBy).toBeTruthy()
  await expect(page.locator(`#${labelledBy}`)).toHaveText('Flavia Flavor Lounge')
})

test('the split layout becomes a single column on a phone', async ({ page }) => {
  await page.goto('/pop-ups.html?redesign=on')
  await openModal(page)
  const desktopColumns = await page
    .locator('.modal-detail__card')
    .evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length)
  expect(desktopColumns).toBe(2)

  await page.setViewportSize({ width: 375, height: 812 })
  const mobileColumns = await page
    .locator('.modal-detail__card')
    .evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length)
  expect(mobileColumns).toBe(1)

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  )
  expect(overflow).toBe(0)
})

test('focus moves into the dialog and is trapped inside it', async ({ page }) => {
  await page.goto('/pop-ups.html?redesign=on')
  await openModal(page)

  expect(await page.evaluate(() => document.activeElement.closest('[role="dialog"]') !== null)).toBe(
    true
  )

  for (let press = 0; press < 8; press += 1) {
    await page.keyboard.press('Tab')
    const inside = await page.evaluate(
      () => document.activeElement.closest('[role="dialog"]') !== null
    )
    expect(inside).toBe(true)
  }
})

test('Escape closes the modal and returns focus to what opened it', async ({ page }) => {
  await page.goto('/pop-ups.html?redesign=on')
  await openModal(page)

  await page.keyboard.press('Escape')

  await expect(dialog(page)).toHaveCount(0)
  await expect(page.locator('#test-trigger')).toBeFocused()
})

test('the return bar closes the modal', async ({ page }) => {
  await page.goto('/pop-ups.html?redesign=on')
  await openModal(page)

  await page.locator('.modal-return-bar').click()

  await expect(dialog(page)).toHaveCount(0)
})

test('clicking the overlay closes, clicking the card does not', async ({ page }) => {
  await page.goto('/pop-ups.html?redesign=on')
  await openModal(page)

  await page.locator('.modal-detail__title').click()
  await expect(dialog(page)).toBeVisible()

  await page.locator('.modal--detail').click({ position: { x: 5, y: 5 } })
  await expect(dialog(page)).toHaveCount(0)
})

test('the page behind the modal does not scroll', async ({ page }) => {
  await page.goto('/pop-ups.html?redesign=on')
  await openModal(page)

  const overflow = await page.evaluate(() => getComputedStyle(document.body).overflow)
  expect(overflow).toBe('hidden')

  await page.keyboard.press('Escape')
  expect(await page.evaluate(() => getComputedStyle(document.body).overflow)).not.toBe('hidden')
})

test('add to calendar links to Google with the event details', async ({ page }) => {
  await page.goto('/pop-ups.html?redesign=on')
  await openModal(page)

  const href = await page.locator('.modal-detail__calendar-link').getAttribute('href')
  const url = new URL(href)
  expect(url.host).toBe('calendar.google.com')
  expect(url.searchParams.get('text')).toBe('Flavia Flavor Lounge')
  await expect(page.locator('.modal-detail__calendar-link')).toHaveAttribute('target', '_blank')
  await expect(page.locator('.modal-detail__calendar-link')).toHaveAttribute(
    'rel',
    /noopener/
  )
})

test('an evergreen entry omits the calendar link entirely', async ({ page }) => {
  await page.goto('/date-ideas.html?redesign=on')
  await openModal(
    page,
    { id: 'whitney', name: 'Whitney Free Fridays', vibe: 'cultural', img: EVENT.img },
    { type: 'date-idea', returnLabel: 'Return to all date ideas' }
  )

  await expect(page.locator('.modal-detail__calendar-link')).toHaveCount(0)
  await expect(page.locator('.modal-detail__when')).toHaveCount(0)
  await expect(page.locator('.modal-return-bar')).toHaveText(/Return to all date ideas/)
})

test('Share Event offers the share sheet when the browser has one', async ({ page }) => {
  await page.goto('/pop-ups.html?redesign=on')
  await page.evaluate(() => {
    window.__shared = null
    navigator.share = (data) => {
      window.__shared = data
      return Promise.resolve()
    }
  })
  await openModal(page)

  await page.locator('.modal-detail__share').click()

  const shared = await page.evaluate(() => window.__shared)
  expect(shared.title).toBe('Flavia Flavor Lounge')
  expect(shared.url).toContain('pop-up.html?id=flavia-lounge')
})
