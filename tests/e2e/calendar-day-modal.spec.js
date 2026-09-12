/**
 * Regression test for the "+N more" day modal (found while building #399).
 *
 * NAMING: not `redesign-*`, or `playwright.config.js`'s testIgnore would skip
 * it. This is legacy calendar behaviour, nothing to do with the parked
 * redesign.
 *
 * THE BUG THIS GUARDS. `calendar.js` built the clicked cell's date with
 * `new Date(year, month, cellDay)` — local midnight — and then compared it
 * against the pop-up dates through `formatDateId`, which reads a date in
 * America/New_York. For any visitor whose timezone is at or east of UTC, local
 * midnight is still the *previous* day in New York, so the filter matched
 * nothing and the modal opened completely empty.
 *
 * It is the same class of defect CLAUDE.md already records for date-only
 * strings, and the fix is the same idiom: anchor at noon UTC, which lands on
 * the intended calendar day in Eastern from every timezone on earth.
 *
 * The timezone is pinned to UTC deliberately. Under America/New_York this bug
 * is invisible, which is why it survived until a CI runner — which runs UTC —
 * failed on it.
 */
const { test, expect } = require('@playwright/test')
const { stubSanity, todayPopups } = require('./helpers/sanity-stub')

test.use({ timezoneId: 'UTC' })

const POPUP_COUNT = 8

test.describe('the "+N more" day modal, from a timezone east of New York', () => {
  test('lists the pop-ups for that day instead of opening empty', async ({ page }) => {
    // The fixtures are dated in UTC to match the pinned browser timezone, so
    // the two agree even when the runner's own clock is somewhere else.
    await stubSanity(page, { popups: todayPopups(POPUP_COUNT, { utc: true }) })
    await page.goto('/calendar.html')
    await page.waitForFunction(() => Boolean(window.NycConsent))

    await expect(page.locator('.calendar-popup-bar').first()).toBeVisible()

    const moreLink = page.locator('.calendar-more-link').first()
    await expect(moreLink, 'the day should hold more pop-ups than fit in a cell').toBeVisible()
    await moreLink.click()

    const tiles = page.locator('.day-popups-grid .popup-tile')
    await expect(tiles.first(), 'the modal opened with no pop-ups in it').toBeVisible()
    await expect(tiles).toHaveCount(POPUP_COUNT)
  })
})
