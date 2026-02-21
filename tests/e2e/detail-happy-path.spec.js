const { test, expect } = require('@playwright/test')
const { once } = require('node:events')

const POPUP_ID = 'popup-test-id'
const DATE_IDEA_ID = 'date-idea-test-id'

test.beforeEach(async ({ page }) => {
  await page.route('https://41kk82h2.apicdn.sanity.io/**', async (route) => {
    const requestUrl = new URL(route.request().url())
    const rawId = requestUrl.searchParams.get('$id')

    let id = ''
    if (rawId) {
      try {
        id = JSON.parse(rawId)
      } catch {
        id = rawId
      }
    }

    if (id === POPUP_ID) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          result: {
            _id: POPUP_ID,
            slug: POPUP_ID,
            name: 'Mock Popup Name',
            location: 'Mock Popup Location',
            start_datetime: '2026-02-21T14:00:00Z',
            end_datetime: '2026-02-21T17:00:00Z',
            long_description: 'Mock popup long description',
            link: 'https://example.com/popup',
            link_text: 'Visit Popup',
            imageUrl: 'https://example.com/popup.jpg'
          }
        })
      })
    }

    if (id === DATE_IDEA_ID) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          result: {
            _id: DATE_IDEA_ID,
            slug: DATE_IDEA_ID,
            name: 'Mock Date Idea Name',
            location: 'Mock Date Idea Location',
            long_description: 'Mock date idea long description',
            link: 'https://example.com/date-idea',
            link_text: 'Visit Date Idea',
            imageUrl: 'https://example.com/date-idea.jpg'
          }
        })
      })
    }

    return route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({ result: null })
    })
  })
})

test('pop-up detail page renders populated content when id is provided', async ({ page }) => {
  await page.goto(`/pop-up.html?id=${POPUP_ID}`)

  await expect(page.locator('#popupTitle')).toHaveText('Mock Popup Name')
  await expect(page.locator('#popupLocation')).toHaveText('Mock Popup Location')
  await expect(page.locator('#popupDescription')).toContainText('Mock popup long description')
  await expect(page.locator('#popupExternalLink')).toHaveAttribute('href', 'https://example.com/popup')
})

test('pop-up ICS link is correctly formatted and downloadable', async ({ page }) => {
  await page.goto(`/pop-up.html?id=${POPUP_ID}`)

  const icsLink = page.locator('#popupICSLink')
  await expect(icsLink).toBeVisible()
  await expect(icsLink).toHaveAttribute('href', /^blob:/)
  await expect(icsLink).toHaveAttribute('download', `${POPUP_ID}.ics`)

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    icsLink.click()
  ])

  await expect(download.suggestedFilename()).toBe(`${POPUP_ID}.ics`)

  const stream = await download.createReadStream()
  const chunks = []
  stream.on('data', (chunk) => chunks.push(chunk))
  await once(stream, 'end')
  const icsContent = Buffer.concat(chunks).toString('utf8')

  expect(icsContent).toContain('BEGIN:VCALENDAR')
  expect(icsContent).toContain('BEGIN:VEVENT')
  expect(icsContent).toContain('SUMMARY:Mock Popup Name')
  expect(icsContent).toMatch(/DTSTART(;VALUE=DATE|;TZID=America\/New_York):/)
  expect(icsContent).toMatch(/DTEND(;VALUE=DATE|;TZID=America\/New_York):/)
  expect(icsContent).toContain('END:VEVENT')
  expect(icsContent).toContain('END:VCALENDAR')
})

test('date idea detail page renders populated content when id is provided', async ({ page }) => {
  await page.goto(`/date-idea.html?id=${DATE_IDEA_ID}`)

  await expect(page.locator('#dateIdeaTitle')).toHaveText('Mock Date Idea Name')
  await expect(page.locator('#dateIdeaLocation')).toHaveText('Mock Date Idea Location')
  await expect(page.locator('#dateIdeaDescription')).toContainText('Mock date idea long description')
  await expect(page.locator('#popupExternalLink')).toHaveAttribute('href', 'https://example.com/date-idea')
})
