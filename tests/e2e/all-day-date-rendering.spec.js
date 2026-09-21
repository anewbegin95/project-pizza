/**
 * All-day date rendering e2e (issue #423).
 *
 * NAMING: this file must NOT be called `redesign-all-day-date-rendering.spec.js`.
 * `playwright.config.js` sets `testIgnore: '**\/redesign-*.spec.js'` while the
 * redesign is parked (#403), so that prefix would mean this never runs.
 *
 * WHY E2E AND NOT JUST UNIT: the reported bug was a rendered string, and it
 * travels POPUP_BY_ID's projection -> mapSanityPopup -> formatEventDate ->
 * #popupDateRange. A projection that stopped emitting `start_date` would
 * break the fix and still pass every unit test in tests/unit/pop-ups.spec.js.
 *
 * Sanity's CORS allowlist rejects every local origin, so the fixtures are
 * stubbed; that also lets the stale-field shape be pinned exactly.
 */
const { test, expect } = require('@playwright/test')
const { stubSanity, popup } = require('./helpers/sanity-stub')

// The shape that caused the bug: flipped to all-day in Studio, which hides
// start_datetime but never clears it, so the document carries both.
const STALE_SINGLE_DAY = {
  slug: 'beyond-yoga-stale',
  name: 'Beyond Yoga Seek Beyond Open Air Concert',
  all_day: true,
  start_date: '2026-10-17',
  end_date: '2026-10-17',
  start_datetime: '2026-09-17T16:53:00.000Z',
  end_datetime: null,
}

const STALE_MULTI_DAY = {
  slug: 'glossier-stale',
  name: 'Glossier Balmdega',
  all_day: true,
  start_date: '2026-07-17',
  end_date: '2026-07-19',
  start_datetime: '2026-07-18T14:00:00.000Z',
  end_datetime: '2026-07-20T00:32:00.000Z',
}

test.describe('all-day pop-ups ignore a stale datetime', () => {
  test('a single-day all-day pop-up renders its date once', async ({ page }) => {
    await stubSanity(page, { popups: [popup(1, STALE_SINGLE_DAY)] })
    await page.goto('/pop-up.html?id=beyond-yoga-stale')

    const dateLine = page.locator('#popupDateRange')
    await expect(dateLine).toHaveText('Sat, Oct 17 (all day)')
    // The stale value was a month earlier; it must not surface anywhere.
    await expect(dateLine).not.toContainText('Sep')
  })

  test('a multi-day all-day pop-up renders both real endpoints', async ({ page }) => {
    await stubSanity(page, { popups: [popup(2, STALE_MULTI_DAY)] })
    await page.goto('/pop-up.html?id=glossier-stale')

    await expect(page.locator('#popupDateRange'))
      .toHaveText('Fri, Jul 17 - Sun, Jul 19 (all day)')
  })

  // The wrong date reached the structured data too, not just the visible line.
  test('JSON-LD carries the all-day dates, not the stale datetime', async ({ page }) => {
    await stubSanity(page, { popups: [popup(1, STALE_SINGLE_DAY)] })
    await page.goto('/pop-up.html?id=beyond-yoga-stale')

    const eventLd = await page.locator('script[type="application/ld+json"]').evaluateAll(
      (nodes) => nodes
        .map((n) => { try { return JSON.parse(n.textContent) } catch { return null } })
        .find((d) => d && d['@type'] === 'Event')
    )

    expect(eventLd).toBeTruthy()
    expect(eventLd.startDate).toBe('2026-10-17')
  })

  // A timed pop-up must keep using its datetimes — the fix is a selection
  // rule, not a preference for date-only values.
  test('a timed pop-up still renders its times', async ({ page }) => {
    await stubSanity(page, { popups: [popup(3, {
      slug: 'timed-fixture',
      all_day: false,
      start_datetime: '2026-07-17T14:00:00.000Z',
      end_datetime: '2026-07-17T21:00:00.000Z',
      start_date: '2026-06-05',
      end_date: '2026-06-05',
    })] })
    await page.goto('/pop-up.html?id=timed-fixture')

    await expect(page.locator('#popupDateRange'))
      .toHaveText('Fri, Jul 17, 10:00 AM – 5:00 PM')
  })
})
