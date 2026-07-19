const { test, expect } = require('@playwright/test')

test('collage hero renders panels and copy when the redesign flag is on', async ({ page }) => {
  await page.goto('/pop-ups.html?redesign=on')

  await expect(page.getByRole('heading', { level: 1, name: /upcoming nyc pop-ups/i })).toBeVisible()
  await expect(page.locator('.hero__panels')).toBeVisible()
  await expect(page.locator('.hero__supertitle')).toHaveText(/nyc slice of life presents/i)
})

test('collage hero collapses to a single panel on mobile with the flag on', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/pop-ups.html?redesign=on')

  await expect(page.getByRole('heading', { level: 1, name: /upcoming nyc pop-ups/i })).toBeVisible()
  await expect(page.locator('.hero__panel--2')).toBeVisible()
  await expect(page.locator('.hero__panel--1')).toBeHidden()
  await expect(page.locator('.hero__panel--3')).toBeHidden()
})

test('collage elements stay hidden when the redesign flag is off', async ({ page }) => {
  await page.goto('/pop-ups.html')

  await expect(page.getByRole('heading', { level: 1, name: /upcoming nyc pop-ups/i })).toBeVisible()
  await expect(page.locator('.hero__panels')).toBeHidden()
  await expect(page.locator('.hero__supertitle')).toBeHidden()
})
