const { test, expect } = require('@playwright/test')

const datesChip = (page) => page.locator('.filter-chip[data-filter="dates"]')
const picker = (page) => page.locator('.date-picker')
const firstMonth = (page) => page.locator('.date-picker__month').first()
/** Day cells are addressed by number within a month, so tests do not depend on today. */
const dayInFirstMonth = (page, day) =>
  firstMonth(page).locator(`.date-picker__day[data-day="${day}"]:not(.date-picker__day--outside)`)

test('the Pick dates chip opens a two-month calendar', async ({ page }) => {
  await page.goto('/pop-ups.html?redesign=on')

  await expect(datesChip(page)).toBeEnabled()
  await expect(datesChip(page)).toHaveAttribute('aria-expanded', 'false')

  await datesChip(page).click()

  await expect(picker(page)).toBeVisible()
  await expect(datesChip(page)).toHaveAttribute('aria-expanded', 'true')
  await expect(page.locator('.date-picker__month')).toHaveCount(2)
  // The two headings are consecutive months.
  const labels = await page.locator('.date-picker__month-label').allTextContents()
  expect(labels[0]).not.toBe(labels[1])
})

test('day cells fit their calendar instead of inheriting legacy button padding', async ({ page }) => {
  await page.goto('/pop-ups.html?redesign=on')
  await datesChip(page).click()

  const metrics = await page.evaluate(() => {
    const grid = document.querySelector('.date-picker__grid')
    const month = document.querySelector('.date-picker__month')
    const day = grid.querySelector('.date-picker__day')
    return {
      gridWidth: grid.getBoundingClientRect().width,
      monthWidth: month.getBoundingClientRect().width,
      dayWidth: day.getBoundingClientRect().width,
    }
  })

  // buttons.css gives bare `button` 8px 32px padding, which would blow each
  // cell out to ~80px and overflow the calendar.
  expect(metrics.gridWidth).toBeLessThanOrEqual(metrics.monthWidth + 1)
  expect(metrics.dayWidth).toBeLessThan(60)
})

test('picking two days selects an inclusive range', async ({ page }) => {
  await page.goto('/pop-ups.html?redesign=on')
  await datesChip(page).click()

  await dayInFirstMonth(page, 15).click()
  await dayInFirstMonth(page, 18).click()

  await expect(dayInFirstMonth(page, 15)).toHaveClass(/date-picker__day--edge/)
  await expect(dayInFirstMonth(page, 18)).toHaveClass(/date-picker__day--edge/)
  await expect(dayInFirstMonth(page, 16)).toHaveClass(/date-picker__day--in-range/)
  await expect(dayInFirstMonth(page, 14)).not.toHaveClass(/date-picker__day--in-range/)
})

test('a selected day keeps its colour while the pointer rests on it', async ({ page }) => {
  await page.goto('/pop-ups.html?redesign=on')
  await datesChip(page).click()
  await dayInFirstMonth(page, 15).click()
  await dayInFirstMonth(page, 22).click()

  // The pointer is still on 22 after clicking it; hover must not mask the
  // selection.
  const background = await dayInFirstMonth(page, 22).evaluate(async (el) => {
    await Promise.all(el.getAnimations().map((animation) => animation.finished))
    return getComputedStyle(el).backgroundColor
  })

  expect(background).toBe('rgb(216, 30, 91)') // --nyc-fuschia
})

test('Done applies the range to the chip and reveals clear all', async ({ page }) => {
  await page.goto('/pop-ups.html?redesign=on')
  await datesChip(page).click()
  await dayInFirstMonth(page, 15).click()
  await dayInFirstMonth(page, 22).click()

  await page.locator('.date-picker__done').click()

  await expect(picker(page)).toBeHidden()
  await expect(datesChip(page)).toHaveClass(/filter-chip--active/)
  await expect(datesChip(page).locator('.filter-chip__label')).toHaveText(/^\w{3} 15 – \w{3} 22$/)
  await expect(page.getByRole('button', { name: /clear all/i })).toBeVisible()
})

test('the range is published for page code to consume', async ({ page }) => {
  await page.goto('/pop-ups.html?redesign=on')

  const received = page.evaluate(
    () =>
      new Promise((resolve) => {
        document.addEventListener('filters:change', (event) => {
          if (event.detail.state.dates) resolve(event.detail.state.dates)
        })
      })
  )

  await datesChip(page).click()
  await dayInFirstMonth(page, 15).click()
  await dayInFirstMonth(page, 22).click()
  await page.locator('.date-picker__done').click()

  expect(await received).toMatch(/^\d{4}-\d{2}-15\.\.\d{4}-\d{2}-22$/)
})

test('Clear inside the picker drops the range', async ({ page }) => {
  await page.goto('/pop-ups.html?redesign=on')
  await datesChip(page).click()
  await dayInFirstMonth(page, 15).click()
  await page.locator('.date-picker__done').click()
  await expect(datesChip(page)).toHaveClass(/filter-chip--active/)

  await datesChip(page).click()
  await page.locator('.date-picker__clear').click()

  await expect(datesChip(page)).not.toHaveClass(/filter-chip--active/)
  await expect(datesChip(page).locator('.filter-chip__label')).toHaveText('Pick dates')
})

test('clear all resets the date chip too', async ({ page }) => {
  await page.goto('/pop-ups.html?redesign=on')
  await datesChip(page).click()
  await dayInFirstMonth(page, 15).click()
  await page.locator('.date-picker__done').click()

  await page.getByRole('button', { name: /clear all/i }).click()

  await expect(datesChip(page)).not.toHaveClass(/filter-chip--active/)
  await expect(datesChip(page).locator('.filter-chip__label')).toHaveText('Pick dates')
})

test('the month arrows move both calendars', async ({ page }) => {
  await page.goto('/pop-ups.html?redesign=on')
  await datesChip(page).click()

  const before = await page.locator('.date-picker__month-label').allTextContents()
  await page.locator('.date-picker__nav--next').click()
  const after = await page.locator('.date-picker__month-label').allTextContents()

  expect(after[0]).toBe(before[1])

  await page.locator('.date-picker__nav--prev').click()
  expect(await page.locator('.date-picker__month-label').allTextContents()).toEqual(before)
})

test('Escape closes the picker and returns focus to the chip', async ({ page }) => {
  await page.goto('/pop-ups.html?redesign=on')
  await datesChip(page).click()
  await expect(picker(page)).toBeVisible()

  await page.keyboard.press('Escape')

  await expect(picker(page)).toBeHidden()
  await expect(datesChip(page)).toBeFocused()
})

test('clicking outside closes the picker', async ({ page }) => {
  await page.goto('/pop-ups.html?redesign=on')
  await datesChip(page).click()

  await page.locator('.hero__supertitle').click()

  await expect(picker(page)).toBeHidden()
})

test('the calendar stacks its months on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/pop-ups.html?redesign=on')
  await datesChip(page).click()

  const columns = await page
    .locator('.date-picker__months')
    .evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length)
  expect(columns).toBe(1)

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  )
  expect(overflow).toBe(0)
})

test('the picker stays hidden when the redesign flag is off', async ({ page }) => {
  await page.goto('/pop-ups.html')

  await expect(page.locator('.filter-bar')).toBeHidden()
  await expect(picker(page)).toBeHidden()
})
