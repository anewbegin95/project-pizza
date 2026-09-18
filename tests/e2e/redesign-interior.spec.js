const { test, expect } = require('@playwright/test')

const PAGES = [
  { path: '/about.html', heading: /about us/i },
  { path: '/contact_us.html', heading: /contact us/i },
  { path: '/privacy_policy.html', heading: /privacy policy/i },
]

for (const { path, heading } of PAGES) {
  test(`${path} constrains its reading column when the flag is on`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(`${path}?redesign=on`)

    await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible()

    const { shellWidth, sectionMax, isCentred } = await page.evaluate(() => {
      const shell = document.querySelector('.interior-page')
      const rect = shell.getBoundingClientRect()
      const max = parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue('--section-max-width')
      )
      const rightGutter = window.innerWidth - (rect.left + rect.width)
      return {
        shellWidth: rect.width,
        sectionMax: max,
        isCentred: Math.abs(rect.left - rightGutter) <= 1,
      }
    })

    expect(shellWidth).toBeLessThanOrEqual(sectionMax)
    expect(isCentred).toBe(true)
  })

  test(`${path} reads on a white card over the cream page`, async ({ page }) => {
    await page.goto(`${path}?redesign=on`)

    const content = await page.locator('.interior-page__content').evaluate((el) => {
      const computed = getComputedStyle(el)
      return {
        background: computed.backgroundColor,
        lineHeight: parseFloat(computed.lineHeight) / parseFloat(computed.fontSize),
        pageBackground: getComputedStyle(document.body).backgroundColor,
      }
    })

    expect(content.background).toBe('rgb(255, 255, 255)')
    expect(content.pageBackground).not.toBe('rgb(255, 255, 255)')
    expect(content.lineHeight).toBeGreaterThan(1.5)
  })

  test(`${path} is unchanged when the flag is off`, async ({ page }) => {
    await page.goto(path)

    const background = await page
      .locator('.interior-page__content')
      .evaluate((el) => getComputedStyle(el).backgroundColor)
    // The gated card treatment must not apply.
    expect(background).not.toBe('rgb(255, 255, 255)')
  })

  test(`${path} fits a phone without sideways scrolling`, async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto(`${path}?redesign=on`)

    await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible()
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    )
    expect(overflow).toBe(0)
  })
}

test('interior headings pick up the display serif', async ({ page }) => {
  await page.goto('/privacy_policy.html?redesign=on')

  const font = await page
    .locator('.interior-page__content h3')
    .first()
    .evaluate((el) => getComputedStyle(el).fontFamily)
  expect(font).toMatch(/Playfair Display/)
})

test('interior links use the green accent', async ({ page }) => {
  await page.goto('/contact_us.html?redesign=on')

  const colour = await page
    .locator('.interior-page__content a')
    .first()
    .evaluate((el) => getComputedStyle(el).color)
  expect(colour).toBe('rgb(45, 106, 79)') // --nyc-green
})

test('the about portrait leads the page as a media region', async ({ page }) => {
  await page.goto('/about.html?redesign=on')

  const media = page.locator('.interior-page__media img')
  await expect(media).toBeVisible()
  const radius = await media.evaluate((el) => getComputedStyle(el).borderRadius)
  expect(radius).toBe('50%')
})

test('the interior hero follows the redesign headline treatment', async ({ page }) => {
  await page.goto('/about.html?redesign=on')

  const hero = await page.evaluate(() => {
    const section = document.querySelector('.hero--interior')
    const h1 = section.querySelector('h1')
    return {
      colour: getComputedStyle(h1).color,
      heightRatio: section.getBoundingClientRect().height / window.innerHeight,
    }
  })

  expect(hero.colour).toBe('rgb(255, 255, 255)')
  // Shorter than the 50vh legacy banner, leaving room for the content.
  expect(hero.heightRatio).toBeLessThan(0.45)
})

test('the interior hero is untouched when the flag is off', async ({ page }) => {
  await page.goto('/about.html')

  const colour = await page
    .locator('.hero--interior h1')
    .evaluate((el) => getComputedStyle(el).color)
  expect(colour).toBe('rgb(255, 182, 193)') // legacy --nyc-pink
})

test('the shell does not nest a card inside another card', async ({ page }) => {
  await page.goto('/privacy_policy.html?redesign=on')

  // The legacy section still wraps the content; only the inner card should
  // paint a surface.
  const shell = await page
    .locator('.interior-page')
    .evaluate((el) => getComputedStyle(el).backgroundColor)
  expect(['rgba(0, 0, 0, 0)', 'transparent']).toContain(shell)
})
