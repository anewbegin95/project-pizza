const { test, expect } = require('@playwright/test')

// Geometry and palette captured from staging before the bare `button` selector
// was retired. These legacy buttons carried no styles of their own and leaned
// on it, so they are the regression risk — and they appear on redesign pages
// too, which is why both flag states are checked.
// `flags` says which states each button can be checked in. calendar.html hands
// over to the Pop-Ups calendar view when the redesign is on (#302), so it has
// no flag-on rendering left to inspect — its arrows are legacy-only now.
const LEGACY_BUTTONS = [
  {
    page: '/',
    selector: '.menu-toggle',
    flags: ['off', 'on'],
    expected: { paddingTop: '8px', paddingLeft: '32px', borderRadius: '5px', width: 78, height: 44 },
  },
  {
    page: '/calendar.html',
    selector: '.calendar-header__prev-month',
    flags: ['off'],
    expected: {
      backgroundColor: 'rgb(255, 182, 193)',
      color: 'rgb(216, 30, 91)',
      paddingTop: '8px',
      paddingLeft: '32px',
      borderRadius: '5px',
      fontSize: '16px',
      cursor: 'pointer',
    },
  },
  {
    page: '/calendar.html',
    selector: '.calendar-header__next-month',
    flags: ['off'],
    expected: { backgroundColor: 'rgb(255, 182, 193)', color: 'rgb(216, 30, 91)', paddingLeft: '32px' },
  },
]

async function computed(page, selector, props) {
  return page.locator(selector).first().evaluate((el, props) => {
    const style = getComputedStyle(el)
    const rect = el.getBoundingClientRect()
    const out = {}
    for (const prop of props) {
      out[prop] = prop === 'width' || prop === 'height' ? Math.round(rect[prop]) : style[prop]
    }
    return out
  }, props)
}

for (const { page: path, selector, expected, flags } of LEGACY_BUTTONS) {
  for (const flag of flags) {
    test(`${selector} keeps its appearance with the flag ${flag}`, async ({ page }) => {
      await page.setViewportSize({ width: 700, height: 900 }) // menu-toggle only shows on narrow
      await page.goto(`${path}?redesign=${flag}`)

      const actual = await computed(page, selector, Object.keys(expected))
      expect(actual).toEqual(expected)
    })
  }
}

test('the date picker keeps its own type scale without the bare selector', async ({ page }) => {
  await page.goto('/pop-ups.html?redesign=on')
  await page.locator('.filter-chip[data-filter="dates"]').click()

  // The nav arrows had no font-size of their own and inherited 16px from
  // buttons.css; without it they would fall back to the 13.33px UA default.
  const nav = await computed(page, '.date-picker__nav', ['fontSize'])
  expect(nav.fontSize).toBe('16px')

  // Day cells must stay square-ish; the 8px 32px legacy padding blew them to ~80px.
  const day = await page.locator('.date-picker__day').first().evaluate((el) => {
    const rect = el.getBoundingClientRect()
    return { width: Math.round(rect.width), height: Math.round(rect.height) }
  })
  expect(day.width).toBeLessThan(60)
  expect(day.height).toBeLessThan(60)
})

test('a filter chip no longer needs a defensive override to resist the legacy hover', async ({ page }) => {
  await page.goto('/pop-ups.html?redesign=on')

  const chip = page.locator('.filter-chip[data-filter="type"]')
  await chip.hover()

  const styles = await chip.evaluate(async (el) => {
    await Promise.all(el.getAnimations().map((animation) => animation.finished))
    const style = getComputedStyle(el)
    return { hovered: el.matches(':hover'), background: style.backgroundColor, color: style.color }
  })

  expect(styles.hovered).toBe(true)
  expect(styles.background).not.toBe('rgb(216, 30, 91)') // --nyc-fuschia
  expect(styles.color).not.toBe('rgb(255, 255, 255)')
})

test('.btn takes the green palette under the redesign and stays pink without it', async ({ page }) => {
  await page.goto('/index.html?redesign=on')
  const redesigned = await computed(page, '.btn', ['backgroundColor', 'color'])
  expect(redesigned).toEqual({ backgroundColor: 'rgb(45, 106, 79)', color: 'rgb(255, 255, 255)' })

  await page.goto('/index.html?redesign=off')
  const legacy = await computed(page, '.btn', ['backgroundColor', 'color'])
  expect(legacy).toEqual({ backgroundColor: 'rgb(255, 182, 193)', color: 'rgb(216, 30, 91)' })
})

test('.secondary-btn is outlined under the redesign', async ({ page }) => {
  await page.goto('/index.html?redesign=on')

  const styles = await computed(page, '.secondary-btn', ['backgroundColor', 'color', 'borderTopColor'])
  expect(styles.backgroundColor).toBe('rgb(255, 255, 255)')
  expect(styles.color).toBe('rgb(45, 106, 79)')
  expect(styles.borderTopColor).toBe('rgb(45, 106, 79)')
})

test('the hero supertitle meets WCAG AA over the brightest possible photo', async ({ page }) => {
  await page.goto('/pop-ups.html?redesign=on')

  const result = await page.locator('.hero__supertitle').evaluate((el) => {
    const parse = (value) => value.match(/[\d.]+/g).map(Number)

    const relativeLuminance = ([r, g, b]) =>
      [r, g, b]
        .map((channel) => channel / 255)
        .map((channel) => (channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4))
        .reduce((sum, channel, i) => sum + channel * [0.2126, 0.7152, 0.0722][i], 0)

    const contrast = (a, b) => {
      const [light, dark] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x)
      return (light + 0.05) / (dark + 0.05)
    }

    // Worst case for text over the collage: a blown-out white sky behind the
    // overlay's lightest (topmost) stop, which is where the supertitle sits.
    const hero = document.querySelector('.hero--collage')
    const overlay = getComputedStyle(hero, '::after').backgroundImage
    const firstStop = overlay.match(/rgba?\([^)]+\)/)
    const [r, g, b, alpha = 1] = parse(firstStop[0])
    const overWhite = [r, g, b].map((channel) => channel * alpha + 255 * (1 - alpha))

    const [tr, tg, tb] = parse(getComputedStyle(el).color)
    return {
      textColor: [tr, tg, tb],
      ratio: contrast([tr, tg, tb], overWhite),
      fontSize: parseFloat(getComputedStyle(el).fontSize),
    }
  })

  // Under 18.66px, so the 4.5:1 threshold applies rather than 3:1.
  expect(result.fontSize).toBeLessThan(18.66)
  expect(result.ratio, `supertitle contrast was ${result.ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5)
})
