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

test('about page loads with expected heading', async ({ page }) => {
  await page.goto('/about.html')

  await expect(page.getByRole('heading', { level: 1, name: /about us/i })).toBeVisible()
})

test('calendar page loads with expected heading', async ({ page }) => {
  await page.goto('/calendar.html')

  await expect(page.getByRole('heading', { level: 1, name: /nyc pop-up events calendar/i })).toBeVisible()
})

test('date ideas page loads with expected heading', async ({ page }) => {
  await page.goto('/date-ideas.html')

  await expect(page.getByRole('heading', { level: 1, name: /date ideas/i })).toBeVisible()
})

test('privacy policy page loads with expected heading', async ({ page }) => {
  await page.goto('/privacy_policy.html')

  await expect(page.getByRole('heading', { level: 1, name: /privacy policy/i })).toBeVisible()
})

test('pop-up details route shows missing-id error state', async ({ page }) => {
  await page.goto('/pop-up.html')

  await expect(page.getByRole('heading', { level: 2, name: /pop-up not found/i })).toBeVisible()
  await expect(page.getByText(/no pop-up id provided in the url/i)).toBeVisible()
})

test('date idea details route shows missing-id error state', async ({ page }) => {
  await page.goto('/date-idea.html')

  await expect(page.getByRole('heading', { level: 2, name: /date idea not found/i })).toBeVisible()
  await expect(page.getByText(/no date idea id provided in the url/i)).toBeVisible()
})