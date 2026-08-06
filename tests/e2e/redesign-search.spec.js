const { test, expect } = require('@playwright/test')

test('search bar and view toggle appear when the redesign flag is on', async ({ page }) => {
  await page.goto('/pop-ups.html?redesign=on')

  await expect(page.getByRole('searchbox', { name: /search events, venues, and neighborhoods/i })).toBeVisible()
  await expect(page.getByRole('group', { name: /view mode/i })).toBeVisible()
  await expect(page.getByRole('button', { name: 'List' })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('button', { name: 'Map' })).toHaveAttribute('aria-pressed', 'false')
})

test('clicking Map moves the active state and emits a view change', async ({ page }) => {
  await page.goto('/pop-ups.html?redesign=on')

  const received = page.evaluate(
    () =>
      new Promise((resolve) => {
        document.addEventListener('viewtoggle:change', (event) => resolve(event.detail.view), { once: true })
      })
  )

  await page.getByRole('button', { name: 'Map' }).click()

  await expect(page.getByRole('button', { name: 'Map' })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('button', { name: 'List' })).toHaveAttribute('aria-pressed', 'false')
  expect(await received).toBe('map')
})

test('the toggle is keyboard operable', async ({ page }) => {
  await page.goto('/pop-ups.html?redesign=on')

  await page.getByRole('button', { name: 'Map' }).focus()
  await page.keyboard.press('Enter')

  await expect(page.getByRole('button', { name: 'Map' })).toHaveAttribute('aria-pressed', 'true')
})

test('date ideas gets the search bar but no view toggle', async ({ page }) => {
  await page.goto('/date-ideas.html?redesign=on')

  await expect(page.getByRole('searchbox', { name: /search events, venues, and neighborhoods/i })).toBeVisible()
  await expect(page.getByRole('group', { name: /view mode/i })).toHaveCount(0)
})

test('search controls stay hidden when the redesign flag is off', async ({ page }) => {
  await page.goto('/pop-ups.html')

  await expect(page.locator('.search-bar-container')).toBeHidden()
  await expect(page.getByRole('button', { name: 'Map' })).toBeHidden()
})

test('search bar wraps without horizontal overflow on a small phone', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/pop-ups.html?redesign=on')

  await expect(page.getByRole('searchbox', { name: /search events/i })).toBeVisible()
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  )
  expect(overflow).toBe(0)
})
