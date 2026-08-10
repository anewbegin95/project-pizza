const { test, expect } = require('@playwright/test')

// Real files from the repo, chosen for their aspect ratios. The card's height
// must not depend on which one an editor happens to upload.
const IMAGES = {
  portrait: '/resources/images/images/default-popup-image.webp', // 563x750
  landscape: '/resources/images/banners/midtown_manhattan_skyline.webp', // 1920x1280
  square: '/resources/images/images/profile.webp', // 256x256
}

const POPUP = {
  id: 'flavia-lounge',
  name: 'Flavia Flavor Lounge',
  start_datetime: '2026-08-13T15:00:00.000Z',
  end_datetime: '2026-08-14T23:00:00.000Z',
  category: 'food_drink',
  venue_name: '22 Wooster',
  neighborhood: 'SoHo',
  borough: 'manhattan',
  price: 'Free',
  short_desc: 'Sip complimentary coffee and tea and match a drink to your mood in a loft space built for lingering.',
}

/** Renders one card, waits for the image to decode, and measures it. */
async function measureCard(page, { img, featured = false, data = POPUP }) {
  return page.evaluate(
    async ({ data, img, featured }) => {
      const grid = document.getElementById('popupsGrid')
      grid.innerHTML = ''
      grid.appendChild(window.NycCards.buildEventCard({ ...data, img, is_featured: featured }, { type: 'popup' }))

      const image = document.querySelector('.event-card__image')
      if (image && !image.complete) {
        await new Promise((resolve) => {
          image.onload = resolve
          image.onerror = resolve
        })
      }
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))

      const card = document.querySelector('.event-card').getBoundingClientRect()
      const media = document.querySelector('.event-card__media').getBoundingClientRect()
      const rendered = image.getBoundingClientRect()
      return {
        card: Math.round(card.height),
        media: Math.round(media.height),
        image: { width: Math.round(rendered.width), height: Math.round(rendered.height) },
        natural: [image.naturalWidth, image.naturalHeight],
        objectFit: getComputedStyle(image).objectFit,
      }
    },
    { data, img, featured }
  )
}

for (const [width, label] of [[1440, 'desktop'], [800, 'tablet'], [390, 'mobile']]) {
  test(`card height ignores the source image's aspect ratio on ${label}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 })
    await page.goto('/pop-ups.html?redesign=on')

    const heights = {}
    for (const [name, img] of Object.entries(IMAGES)) {
      heights[name] = (await measureCard(page, { img })).card
    }

    // A portrait upload must not produce a taller card than a landscape one.
    expect(new Set(Object.values(heights)).size, `heights were ${JSON.stringify(heights)}`).toBe(1)
  })

  test(`featured card height ignores the source image's aspect ratio on ${label}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 })
    await page.goto('/pop-ups.html?redesign=on')

    const heights = {}
    for (const [name, img] of Object.entries(IMAGES)) {
      heights[name] = (await measureCard(page, { img, featured: true })).card
    }

    expect(new Set(Object.values(heights)).size, `heights were ${JSON.stringify(heights)}`).toBe(1)
  })
}

test('a standard card stays close to the height of its own content', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/pop-ups.html?redesign=on')

  const measured = await measureCard(page, { img: IMAGES.portrait })

  // The three-column card is a compact row, not a panel. Its content — a date
  // column and a title, three clamped description lines and two meta lines —
  // needs roughly 200px.
  expect(measured.card).toBeGreaterThanOrEqual(180)
  expect(measured.card).toBeLessThanOrEqual(320)
})

test('a featured card is a bounded hero rather than a full page', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/pop-ups.html?redesign=on')

  const measured = await measureCard(page, { img: IMAGES.portrait, featured: true })

  expect(measured.card).toBeGreaterThanOrEqual(320)
  expect(measured.card).toBeLessThanOrEqual(600)
})

test('a sparse entry still gets a usable image area', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/pop-ups.html?redesign=on')

  // No description and no end date: the details column has very little in it.
  const measured = await measureCard(page, {
    img: IMAGES.landscape,
    data: { ...POPUP, short_desc: '', end_datetime: '' },
  })

  expect(measured.media).toBeGreaterThanOrEqual(150)
})

for (const [name, img] of Object.entries(IMAGES)) {
  test(`the ${name} image covers its box without letterboxing`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.goto('/pop-ups.html?redesign=on')

    const measured = await measureCard(page, { img })

    // The image fills the media column exactly; object-fit does the cropping.
    expect(measured.objectFit).toBe('cover')
    expect(Math.abs(measured.image.height - measured.media)).toBeLessThanOrEqual(1)
  })
}

test('the category tag still sits above the image', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/pop-ups.html?redesign=on')
  await measureCard(page, { img: IMAGES.portrait })

  // Absolutely positioning the image must not bury the tag behind it.
  const tag = page.locator('.event-card__tag')
  await expect(tag).toBeVisible()

  const onTop = await page.evaluate(() => {
    const rect = document.querySelector('.event-card__tag').getBoundingClientRect()
    const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2)
    return hit.closest('.event-card__tag') !== null
  })
  expect(onTop).toBe(true)
})
