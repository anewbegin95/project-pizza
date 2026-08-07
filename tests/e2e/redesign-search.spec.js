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

test('hovering the inactive toggle keeps the redesign palette', async ({ page }) => {
  await page.goto('/pop-ups.html?redesign=on')

  await page.getByRole('button', { name: 'Map' }).hover()
  const hovered = await page.getByRole('button', { name: 'Map' }).evaluate(async (el) => {
    // Colour transitions must settle or the sample catches a mid-fade blend.
    await Promise.all(el.getAnimations().map((animation) => animation.finished))
    return { isHovered: el.matches(':hover'), background: getComputedStyle(el).backgroundColor }
  })
  // Guard against a vacuous pass if :hover never applies.
  expect(hovered.isHovered).toBe(true)
  // buttons.css styles bare `button:hover` fuchsia; the toggle must not inherit it.
  expect(hovered.background).not.toBe('rgb(216, 30, 91)')
})

test('search controls stay hidden when the redesign flag is off', async ({ page }) => {
  await page.goto('/pop-ups.html')

  await expect(page.locator('.search-bar-container')).toBeHidden()
  await expect(page.getByRole('button', { name: 'Map' })).toBeHidden()
})

test('search bar stays within the shared container width and stays centered', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 })
  await page.goto('/pop-ups.html?redesign=on')

  const { containerBox, maxWidth, viewportWidth } = await page.evaluate(() => {
    const container = document.querySelector('.search-bar-container')
    const rect = container.getBoundingClientRect()
    return {
      containerBox: { left: rect.left, width: rect.width },
      maxWidth: parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue('--container-max-width')
      ),
      viewportWidth: window.innerWidth,
    }
  })

  expect(containerBox.width).toBeLessThanOrEqual(maxWidth)
  // Equal gutters either side.
  const rightGutter = viewportWidth - (containerBox.left + containerBox.width)
  expect(Math.abs(containerBox.left - rightGutter)).toBeLessThanOrEqual(1)
})

test('search input and toggle buttons meet the 44px touch target on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/pop-ups.html?redesign=on')

  const heights = await page.evaluate(() => ({
    input: document.querySelector('.search-bar__input').getBoundingClientRect().height,
    button: document.querySelector('.view-toggle__btn').getBoundingClientRect().height,
  }))

  expect(heights.input).toBeGreaterThanOrEqual(44)
  expect(heights.button).toBeGreaterThanOrEqual(44)
})

test('toggle buttons share the full row width on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/pop-ups.html?redesign=on')

  // The toggle wraps onto its own row below the input, so it should span that
  // row rather than shrink-wrapping its labels.
  const { rowWidth, toggleWidth, buttonWidths } = await page.evaluate(() => {
    const container = document.querySelector('.search-bar-container')
    const styles = getComputedStyle(container)
    const rowWidth =
      container.getBoundingClientRect().width -
      parseFloat(styles.paddingLeft) -
      parseFloat(styles.paddingRight)
    return {
      rowWidth,
      toggleWidth: document.querySelector('.view-toggle').getBoundingClientRect().width,
      buttonWidths: [...document.querySelectorAll('.view-toggle__btn')].map(
        (b) => b.getBoundingClientRect().width
      ),
    }
  })

  expect(toggleWidth).toBeGreaterThan(rowWidth * 0.95)
  for (const width of buttonWidths) {
    expect(width).toBeGreaterThan(rowWidth * 0.4)
  }
})

test('selecting a view reflects it as page state for view code to consume', async ({ page }) => {
  await page.goto('/pop-ups.html?redesign=on')

  await expect(page.locator('html')).toHaveAttribute('data-view', 'list')

  await page.getByRole('button', { name: 'Map' }).click()

  await expect(page.locator('html')).toHaveAttribute('data-view', 'map')
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
