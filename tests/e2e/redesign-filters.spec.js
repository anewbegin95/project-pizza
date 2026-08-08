const { test, expect } = require('@playwright/test')

const typeChip = (page) => page.getByRole('button', { name: /^Type/ })
const boroughChip = (page) => page.getByRole('button', { name: /^Borough/ })
const clearAll = (page) => page.getByRole('button', { name: /clear all/i })

test('filter chips open a listbox of options when the flag is on', async ({ page }) => {
  await page.goto('/pop-ups.html?redesign=on')

  await expect(typeChip(page)).toHaveAttribute('aria-expanded', 'false')
  await typeChip(page).click()

  await expect(typeChip(page)).toHaveAttribute('aria-expanded', 'true')
  await expect(page.getByRole('listbox', { name: 'Type' })).toBeVisible()
  await expect(page.getByRole('option', { name: /Beauty/ })).toBeVisible()
})

test('selecting an option activates the chip and reveals clear all', async ({ page }) => {
  await page.goto('/pop-ups.html?redesign=on')

  await expect(clearAll(page)).toBeHidden()

  await typeChip(page).click()
  await page.getByRole('option', { name: /Food & Drink/ }).click()

  await expect(page.getByRole('button', { name: /^Food & Drink/ })).toHaveClass(/filter-chip--active/)
  await expect(clearAll(page)).toBeVisible()
  await expect(page.getByRole('listbox', { name: 'Type' })).toBeHidden()
})

test('an active chip takes the redesign green palette', async ({ page }) => {
  await page.goto('/pop-ups.html?redesign=on')

  await typeChip(page).click()
  await page.getByRole('option', { name: /Wellness/ }).click()

  const styles = await page.getByRole('button', { name: /^Wellness/ }).evaluate(async (el) => {
    await Promise.all(el.getAnimations().map((animation) => animation.finished))
    const computed = getComputedStyle(el)
    return {
      background: computed.backgroundColor,
      color: computed.color,
      borderColor: computed.borderColor,
    }
  })

  expect(styles.background).toBe('rgb(234, 242, 237)') // --nyc-green-light
  expect(styles.color).toBe('rgb(45, 106, 79)') // --nyc-green
  expect(styles.borderColor).toBe('rgb(45, 106, 79)')
})

test('choosing the selected option again clears that filter', async ({ page }) => {
  await page.goto('/pop-ups.html?redesign=on')

  await typeChip(page).click()
  await page.getByRole('option', { name: /Market/ }).click()
  await expect(clearAll(page)).toBeVisible()

  await page.getByRole('button', { name: /^Market/ }).click()
  await page.getByRole('option', { name: /Market/ }).click()

  await expect(typeChip(page)).toBeVisible()
  await expect(clearAll(page)).toBeHidden()
})

test('opening a second chip closes the first', async ({ page }) => {
  await page.goto('/pop-ups.html?redesign=on')

  await typeChip(page).click()
  await expect(page.getByRole('listbox', { name: 'Type' })).toBeVisible()

  await boroughChip(page).click()

  await expect(page.getByRole('listbox', { name: 'Borough' })).toBeVisible()
  await expect(page.getByRole('listbox', { name: 'Type' })).toBeHidden()
})

test('clicking outside closes the open dropdown', async ({ page }) => {
  await page.goto('/pop-ups.html?redesign=on')

  await typeChip(page).click()
  await expect(page.getByRole('listbox', { name: 'Type' })).toBeVisible()

  await page.locator('.hero__supertitle').click()

  await expect(page.getByRole('listbox', { name: 'Type' })).toBeHidden()
  await expect(typeChip(page)).toHaveAttribute('aria-expanded', 'false')
})

test('Escape closes the dropdown and returns focus to the chip', async ({ page }) => {
  await page.goto('/pop-ups.html?redesign=on')

  await typeChip(page).click()
  await page.keyboard.press('Escape')

  await expect(page.getByRole('listbox', { name: 'Type' })).toBeHidden()
  await expect(typeChip(page)).toBeFocused()
})

test('a keyboard user can open a filter and select an option', async ({ page }) => {
  await page.goto('/pop-ups.html?redesign=on')

  await boroughChip(page).focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('listbox', { name: 'Borough' })).toBeVisible()

  await page.keyboard.press('ArrowDown')
  await expect(page.getByRole('option', { name: 'Manhattan' })).toBeFocused()

  await page.keyboard.press('Enter')

  await expect(page.getByRole('button', { name: /^Manhattan/ })).toHaveClass(/filter-chip--active/)
  await expect(page.getByRole('listbox', { name: 'Borough' })).toBeHidden()
  await expect(page.getByRole('button', { name: /^Manhattan/ })).toBeFocused()
})

test('arrow keys move through the options and wrap around', async ({ page }) => {
  await page.goto('/pop-ups.html?redesign=on')

  await boroughChip(page).focus()
  await page.keyboard.press('Enter')

  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('ArrowDown')
  await expect(page.getByRole('option', { name: 'Brooklyn' })).toBeFocused()

  await page.keyboard.press('ArrowUp')
  await expect(page.getByRole('option', { name: 'Manhattan' })).toBeFocused()

  // Wrapping backwards from the first option lands on the last.
  await page.keyboard.press('ArrowUp')
  await expect(page.getByRole('option', { name: 'Citywide' })).toBeFocused()

  // And forwards from the last wraps to the first.
  await page.keyboard.press('ArrowDown')
  await expect(page.getByRole('option', { name: 'Manhattan' })).toBeFocused()
})

test('Space selects the focused option', async ({ page }) => {
  await page.goto('/pop-ups.html?redesign=on')

  await typeChip(page).focus()
  await page.keyboard.press('Enter')
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press(' ')

  await expect(page.getByRole('button', { name: /^Food & Drink/ })).toHaveClass(/filter-chip--active/)
})

test('the keyboard-focused option is visibly indicated', async ({ page }) => {
  await page.goto('/pop-ups.html?redesign=on')

  await boroughChip(page).focus()
  await page.keyboard.press('Enter')
  await page.keyboard.press('ArrowDown')

  const indicator = await page.getByRole('option', { name: 'Manhattan' }).evaluate((el) => {
    const computed = getComputedStyle(el)
    return {
      outlineStyle: computed.outlineStyle,
      outlineWidth: parseFloat(computed.outlineWidth),
    }
  })

  expect(indicator.outlineStyle).not.toBe('none')
  expect(indicator.outlineWidth).toBeGreaterThan(0)
})

test('Escape from inside the options closes the menu and restores focus', async ({ page }) => {
  await page.goto('/pop-ups.html?redesign=on')

  await boroughChip(page).focus()
  await page.keyboard.press('Enter')
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Escape')

  await expect(page.getByRole('listbox', { name: 'Borough' })).toBeHidden()
  await expect(boroughChip(page)).toBeFocused()
})

test('clear all resets every chip and hides itself', async ({ page }) => {
  await page.goto('/pop-ups.html?redesign=on')

  await typeChip(page).click()
  await page.getByRole('option', { name: /Music/ }).click()
  await boroughChip(page).click()
  await page.getByRole('option', { name: 'Queens' }).click()

  await clearAll(page).click()

  await expect(typeChip(page)).toBeVisible()
  await expect(boroughChip(page)).toBeVisible()
  await expect(clearAll(page)).toBeHidden()
})

test('filter changes are published for page code to consume', async ({ page }) => {
  await page.goto('/pop-ups.html?redesign=on')

  const received = page.evaluate(
    () =>
      new Promise((resolve) => {
        document.addEventListener(
          'filters:change',
          (event) => {
            if (event.detail.state.borough) resolve(event.detail)
          },
          { once: false }
        )
      })
  )

  await boroughChip(page).click()
  await page.getByRole('option', { name: 'Brooklyn' }).click()

  const detail = await received
  expect(detail.pageType).toBe('popups')
  expect(detail.state.borough).toBe('brooklyn')
})

// The dates chip opens a calendar rather than a listbox; its behaviour is
// covered in redesign-date-picker.spec.js.
test('the dates chip advertises a dialog rather than a listbox', async ({ page }) => {
  await page.goto('/pop-ups.html?redesign=on')

  const dates = page.getByRole('button', { name: /pick dates/i })
  await expect(dates).toBeEnabled()
  await expect(dates).toHaveAttribute('aria-haspopup', 'dialog')
})

test('date ideas gets vibe and budget filters instead of type and dates', async ({ page }) => {
  await page.goto('/date-ideas.html?redesign=on')

  await expect(page.getByRole('button', { name: /^Vibe/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Budget/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /pick dates/i })).toHaveCount(0)

  await page.getByRole('button', { name: /^Budget/ }).click()
  await page.getByRole('option', { name: 'Under $30' }).click()

  await expect(page.getByRole('button', { name: /^Under \$30/ })).toHaveClass(/filter-chip--active/)
})

test('hovering a chip keeps the redesign palette, not the legacy button fuchsia', async ({ page }) => {
  await page.goto('/pop-ups.html?redesign=on')

  await boroughChip(page).hover()
  const hovered = await boroughChip(page).evaluate(async (el) => {
    // Colour transitions must settle or the sample catches a mid-fade blend.
    await Promise.all(el.getAnimations().map((animation) => animation.finished))
    return { isHovered: el.matches(':hover'), background: getComputedStyle(el).backgroundColor }
  })
  // Guard against a vacuous pass if :hover never applies.
  expect(hovered.isHovered).toBe(true)
  // buttons.css styles bare `button:hover` fuchsia; the chip must not inherit it.
  expect(hovered.background).not.toBe('rgb(216, 30, 91)')

  await typeChip(page).click()
  await page.getByRole('option', { name: /Music/ }).click()
  await page.getByRole('button', { name: /^Music/ }).hover()
  const activeHovered = await page.getByRole('button', { name: /^Music/ }).evaluate(async (el) => {
    await Promise.all(el.getAnimations().map((animation) => animation.finished))
    return { isHovered: el.matches(':hover'), background: getComputedStyle(el).backgroundColor }
  })
  expect(activeHovered.isHovered).toBe(true)
  expect(activeHovered.background).not.toBe('rgb(216, 30, 91)')
})

test('the results count reports how many results are on the page', async ({ page }) => {
  await page.goto('/pop-ups.html?redesign=on')

  await page.evaluate(() => {
    const grid = document.getElementById('popupsGrid')
    for (let i = 0; i < 3; i += 1) {
      const tile = document.createElement('a')
      tile.className = 'popup-tile'
      tile.textContent = `Tile ${i}`
      grid.appendChild(tile)
    }
  })

  await expect(page.locator('.results-count')).toHaveText('3 events found')

  await page.evaluate(() => {
    document.querySelector('#popupsGrid .popup-tile').remove()
  })

  await expect(page.locator('.results-count')).toHaveText('2 events found')
})

test('the results count uses the date idea noun on date ideas', async ({ page }) => {
  await page.goto('/date-ideas.html?redesign=on')

  await page.evaluate(() => {
    const grid = document.getElementById('dateIdeasGrid')
    const tile = document.createElement('a')
    tile.className = 'popup-tile'
    grid.appendChild(tile)
  })

  await expect(page.locator('.results-count')).toHaveText('1 date idea found')
})

test('filter bar stays hidden when the redesign flag is off', async ({ page }) => {
  await page.goto('/pop-ups.html')

  await expect(page.locator('.filter-bar')).toBeHidden()
  await expect(page.locator('.results-count')).toBeHidden()
})

test('chips wrap without horizontal overflow on a small phone', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/pop-ups.html?redesign=on')

  await expect(typeChip(page)).toBeVisible()
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  )
  expect(overflow).toBe(0)
})
