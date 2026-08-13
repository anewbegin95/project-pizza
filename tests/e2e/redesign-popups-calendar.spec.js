const { test, expect } = require('@playwright/test')

/** Raw Sanity documents — what the GROQ query returns before mapping. */
const DOCUMENTS = [
  {
    _id: 'flavia', slug: 'flavia', name: 'Flavia Flavor Lounge',
    start_datetime: '2026-08-03T15:00:00Z', end_datetime: '2026-08-06T23:00:00Z',
    category: 'food_drink', borough: 'manhattan', neighborhood: 'SoHo', venue_name: '22 Wooster',
    price: 'Free', short_description: 'Complimentary coffee and tea in a loft space.',
    display_overall: true, display_in_popups_page: true, display_in_calendar: true,
  },
  {
    _id: 'chelsea', slug: 'chelsea', name: 'Chelsea Night Market',
    start_datetime: '2026-08-12T22:00:00Z', end_datetime: '2026-08-13T03:00:00Z',
    category: 'market', borough: 'manhattan', neighborhood: 'Chelsea', venue_name: 'Chelsea Piers',
    price: '$15', short_description: 'Forty vendors and live music after dark.',
    display_overall: true, display_in_popups_page: true, display_in_calendar: true,
  },
  {
    _id: 'bushwick', slug: 'bushwick', name: 'Bushwick Vintage Fair',
    start_datetime: '2026-08-12T14:00:00Z', end_datetime: '2026-08-12T20:00:00Z',
    category: 'vintage_thrift', borough: 'brooklyn', neighborhood: 'Bushwick', venue_name: 'The Sultan Room',
    price: 'Free', short_description: 'Archive denim and 70s glassware.',
    display_overall: true, display_in_popups_page: true, display_in_calendar: true,
  },
  // Already over by "today" (11 Aug 2026): the Pop-Ups set drops it, the
  // calendar keeps it. This is the past-events behaviour from #298's docs.
  {
    _id: 'olaplex', slug: 'olaplex', name: 'OLAPLEX Lab',
    start_datetime: '2026-06-07T16:00:00Z', end_datetime: '2026-06-07T21:00:00Z',
    category: 'beauty', borough: 'manhattan', neighborhood: 'NoHo', venue_name: 'Bond St',
    price: 'Free', short_description: 'A one-day hair lab.',
    display_overall: true, display_in_popups_page: false, display_in_calendar: true,
  },
]

test.beforeEach(async ({ page }) => {
  await page.route('https://41kk82h2.apicdn.sanity.io/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ result: DOCUMENTS }) })
  )
  // Pin "now" so month navigation bounds and the opening month are stable.
  await page.clock.setFixedTime(new Date('2026-08-11T15:00:00Z'))
})

async function openCalendar(page) {
  await page.goto('/pop-ups.html?redesign=on')
  await page.locator('#popupsGrid .event-card').first().waitFor()
  await page.getByRole('button', { name: 'Calendar' }).click()
  await expect(page.locator('.calendar-grid')).toBeVisible()
}

/** The chips rendered on one day, by its ISO date. */
const chipsOn = (page, iso) => page.locator(`.calendar-cell[data-date="${iso}"] .calendar-chip`)

test('the calendar opens on the current month', async ({ page }) => {
  await openCalendar(page)

  await expect(page.locator('.calendar__title')).toHaveText('August 2026')
  await expect(page.locator('.calendar-weekday')).toHaveCount(7)
  await expect(page.locator('.calendar-cell[data-date="2026-08-11"]')).toHaveClass(/calendar-cell--today/)
})

test('events land on the right days', async ({ page }) => {
  await openCalendar(page)

  await expect(chipsOn(page, '2026-08-12')).toHaveCount(2)
  await expect(chipsOn(page, '2026-08-12')).toContainText(['Chelsea Night Market', 'Bushwick Vintage Fair'])
  await expect(chipsOn(page, '2026-08-13')).toHaveCount(0)
})

test('an evening event that crosses midnight UTC stays on one day', async ({ page }) => {
  await openCalendar(page)

  // Chelsea runs 22:00Z-03:00Z, i.e. 6pm-11pm on the 12th in New York.
  await expect(chipsOn(page, '2026-08-12')).toContainText(['Chelsea Night Market'])
  await expect(page.locator('.calendar-cell[data-date="2026-08-13"]')).not.toContainText('Chelsea')
})

test('a multi-day run renders as one bar across its days', async ({ page }) => {
  await openCalendar(page)

  const bar = page.locator('.calendar-bar', { hasText: 'Flavia Flavor Lounge' })
  await expect(bar).toHaveCount(1)
  // Mon 3 - Thu 6 of the week beginning Sun 2 August.
  await expect(bar).toHaveAttribute('data-span', '4')
})

test('the calendar keeps past pop-ups that the list has dropped', async ({ page }) => {
  await openCalendar(page)

  // OLAPLEX ended in June and is display_in_popups_page: false.
  await expect(page.locator('#popupsGrid')).not.toContainText('OLAPLEX')

  await page.locator('.calendar__prev').click()
  await page.locator('.calendar__prev').click()
  await expect(page.locator('.calendar__title')).toHaveText('June 2026')
  await expect(chipsOn(page, '2026-06-07')).toContainText(['OLAPLEX Lab'])
})

test('month navigation stops at the first and last event rather than paging into nothing', async ({ page }) => {
  await openCalendar(page)

  // Earliest event is June 2026, latest is August 2026.
  await page.locator('.calendar__prev').click()
  await page.locator('.calendar__prev').click()
  await expect(page.locator('.calendar__title')).toHaveText('June 2026')
  await expect(page.locator('.calendar__prev')).toBeDisabled()

  await page.locator('.calendar__next').click()
  await page.locator('.calendar__next').click()
  await expect(page.locator('.calendar__title')).toHaveText('August 2026')
  await expect(page.locator('.calendar__next')).toBeDisabled()
})

test('Today returns to the current month', async ({ page }) => {
  await openCalendar(page)

  await page.locator('.calendar__prev').click()
  await expect(page.locator('.calendar__title')).toHaveText('July 2026')

  await page.locator('.calendar__today').click()
  await expect(page.locator('.calendar__title')).toHaveText('August 2026')
})

test('the count describes the month on screen, not the list behind it', async ({ page }) => {
  await page.goto('/pop-ups.html?redesign=on')
  await page.locator('#popupsGrid .event-card').first().waitFor()
  // List and Map report the filtered upcoming set: three of the four documents.
  await expect(page.locator('.results-count')).toHaveText('3 events found')

  await page.getByRole('button', { name: 'Calendar' }).click()
  await expect(page.locator('.results-count')).toHaveText('3 events in August 2026')

  await page.locator('.calendar__prev').click()
  await page.locator('.calendar__prev').click()
  await expect(page.locator('.results-count')).toHaveText('1 event in June 2026')

  // Back to List and the count returns to the filter's answer.
  await page.getByRole('button', { name: 'List' }).click()
  await expect(page.locator('.results-count')).toHaveText('3 events found')
})

test('filtering while the calendar is open updates it, and the count survives the list re-render', async ({ page }) => {
  await openCalendar(page)
  await expect(page.locator('.results-count')).toHaveText('3 events in August 2026')

  // filters.js observes #popupsGrid and rewrites .results-count on every
  // mutation. The list re-renders underneath the calendar here, so without the
  // calendar owning the line this silently reverts to "N events found".
  await page.locator('.search-bar__input').fill('chelsea')

  await expect(chipsOn(page, '2026-08-12')).toHaveCount(1)
  await expect(page.locator('.results-count')).toHaveText('1 event in August 2026')

  // Clearing the box re-renders the list again, so the ownership has to hold
  // in both directions. (Clear all is not used here: it only appears once a
  // chip is active, and a search query alone does not set one.)
  await page.locator('.search-bar__input').fill('')
  await expect(chipsOn(page, '2026-08-12')).toHaveCount(2)
  await expect(page.locator('.results-count')).toHaveText('3 events in August 2026')
})

test('a chip filter narrows the calendar and Clear all restores it', async ({ page }) => {
  await openCalendar(page)

  await page.locator('.filter-chip[data-filter="borough"]').click()
  await page.locator('.filter-bar__group [role="option"][data-label="Brooklyn"]').click()

  await expect(chipsOn(page, '2026-08-12')).toHaveCount(1)
  await expect(page.locator('.results-count')).toHaveText('1 event in August 2026')

  await page.locator('.filter-bar__clear').click()
  await expect(page.locator('.results-count')).toHaveText('3 events in August 2026')
  await expect(page.locator('html')).toHaveAttribute('data-view', 'calendar')
})

test('a chip opens the same detail modal a card would', async ({ page }) => {
  await openCalendar(page)

  await chipsOn(page, '2026-08-12').first().click()

  const modal = page.locator('.modal--detail')
  await expect(modal).toBeVisible()
  await expect(modal).toContainText('Chelsea Night Market')
})

test('a day with more events than fit offers the rest', async ({ page }) => {
  await openCalendar(page)

  // Two on the 12th at the desktop cap of four, so nothing overflows.
  await expect(page.locator('.calendar-cell[data-date="2026-08-12"] .calendar-more')).toHaveCount(0)

  await page.evaluate(() => {
    const cell = document.querySelector('.calendar-cell[data-date="2026-08-12"]')
    cell.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
  await expect(page.locator('.modal--day')).toBeVisible()
  await expect(page.locator('.modal--day')).toContainText('Chelsea Night Market')
})

test('the calendar view loads with no page errors', async ({ page }) => {
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))

  await openCalendar(page)

  expect(errors).toEqual([])
})

test('nothing of the calendar exists with the flag off', async ({ page }) => {
  await page.goto('/pop-ups.html?redesign=off')

  await expect(page.locator('.results__panel--calendar')).toBeHidden()
  await expect(page.locator('.calendar-grid')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Calendar' })).toBeHidden()
})

test('the calendar works on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await openCalendar(page)

  await expect(page.locator('.calendar-weekday')).toHaveCount(7)
  await expect(chipsOn(page, '2026-08-12')).toHaveCount(2)

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  )
  expect(overflow).toBe(0)
})
