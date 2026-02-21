const { test, expect } = require('@playwright/test')

test('homepage loads and key navigation works', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('heading', { level: 1, name: /welcome to nyc slice of life/i })).toBeVisible()

  await page.getByRole('link', { name: /upcoming nyc pop-ups/i }).click()
  await expect(page).toHaveURL(/pop-ups\.html$/)
  await expect(page.getByRole('heading', { level: 1, name: /upcoming nyc pop-ups/i })).toBeVisible()
})

test('contact page exposes primary contact action', async ({ page }) => {
  await page.goto('/contact_us.html')

  const contactLink = page.locator('main .contact-section').getByRole('link', { name: /nycsliceoflife@gmail.com/i })
  await expect(contactLink).toBeVisible()
  await expect(contactLink).toHaveAttribute('href', 'mailto:NYCSliceofLife@gmail.com')
})