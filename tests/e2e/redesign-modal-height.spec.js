const { test, expect } = require('@playwright/test')

// Real files from the repo, chosen for their aspect ratios.
const IMAGES = {
  portrait: '/resources/images/images/default-popup-image.webp', // 563x750
  landscape: '/resources/images/banners/midtown_manhattan_skyline.webp', // 1920x1280
  square: '/resources/images/images/profile.webp', // 256x256
}

const EVENT = {
  id: 'flavia',
  name: 'Flavia Flavor Lounge',
  start_datetime: '2026-08-13T15:00:00.000Z',
  end_datetime: '2026-08-14T23:00:00.000Z',
  category: 'food_drink',
  venue_name: '22 Wooster',
  address: '22 Wooster St, New York, NY 10013',
  price: 'Free',
  long_desc: 'A loft space built for lingering, with a rotating cast of roasters pouring all afternoon.',
}

/** Opens the modal directly, waits for the image, and measures. */
async function measureModal(page, { img, data = EVENT }) {
  return page.evaluate(
    async ({ data, img }) => {
      document.querySelector('.modal--detail')?.remove()
      const handle = window.NycModal.openDetailModal(
        { ...data, img },
        { type: 'popup', returnLabel: 'Return to all pop-ups' }
      )
      const image = document.querySelector('.modal-detail__image')
      if (!image.complete) await new Promise((r) => { image.onload = r; image.onerror = r })
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))

      const card = document.querySelector('.modal-detail__card').getBoundingClientRect()
      const media = document.querySelector('.modal-detail__media').getBoundingClientRect()
      const rendered = image.getBoundingClientRect()
      const body = document.querySelector('.modal-detail__body')
      const result = {
        card: Math.round(card.height),
        media: Math.round(media.height),
        image: Math.round(rendered.height),
        bodyScrolls: body.scrollHeight > body.clientHeight + 1,
        objectFit: getComputedStyle(image).objectFit,
        viewport: window.innerHeight,
      }
      handle.close()
      return result
    },
    { data, img }
  )
}

test.beforeEach(async ({ page }) => {
  await page.goto('/pop-ups.html?redesign=on')
})

for (const [label, width] of [['desktop', 1440], ['laptop', 1024]]) {
  test(`modal height ignores the source image's aspect ratio on ${label}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 })

    const heights = {}
    for (const [name, img] of Object.entries(IMAGES)) {
      heights[name] = (await measureModal(page, { img })).card
    }

    expect(new Set(Object.values(heights)).size, `heights were ${JSON.stringify(heights)}`).toBe(1)
  })
}

test('the phone layout keeps its 16:9 media and stays image-independent', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })

  const heights = {}
  for (const [name, img] of Object.entries(IMAGES)) {
    heights[name] = (await measureModal(page, { img })).card
  }

  expect(new Set(Object.values(heights)).size, `heights were ${JSON.stringify(heights)}`).toBe(1)
})

for (const [name, img] of Object.entries(IMAGES)) {
  test(`the ${name} photo fills the panel without letterboxing`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 })
    const measured = await measureModal(page, { img })

    expect(measured.objectFit).toBe('cover')
    expect(Math.abs(measured.image - measured.media)).toBeLessThanOrEqual(1)
  })
}

test('a sparse entry still gets a usable photo panel', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })

  const measured = await measureModal(page, {
    img: IMAGES.landscape,
    data: { id: 'x', name: 'Short One', start_datetime: '2026-08-13T15:00:00.000Z', price: 'Free' },
  })

  expect(measured.media).toBeGreaterThanOrEqual(240)
})

test('a long description scrolls the body rather than growing the modal', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 800 })

  const measured = await measureModal(page, {
    img: IMAGES.portrait,
    data: { ...EVENT, long_desc: 'A loft space built for lingering. '.repeat(120) },
  })

  // max-height is 90vh; the body is the scrolling region.
  expect(measured.card).toBeLessThanOrEqual(Math.round(measured.viewport * 0.9) + 1)
  expect(measured.bodyScrolls).toBe(true)
})
