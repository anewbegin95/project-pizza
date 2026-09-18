/**
 * Deterministic Sanity fixtures for the analytics e2e specs (issue #399).
 *
 * WHY THIS EXISTS: Sanity's CORS allowlist rejects every local origin, so
 * `pop-ups.html`, `date-ideas.html`, `calendar.html` and the homepage carousel
 * render zero content against a local server. Two of #399's assertions would
 * then pass vacuously — "the carousel emits nothing while it auto-advances" is
 * trivially true of a carousel that never rendered, and "clicking a tile fires
 * content_open" cannot fail if there is no tile to click.
 *
 * Stubbing the origin fixes the CORS problem and makes `entry_id` and
 * `position` fixed values a test can assert on, which live data never could.
 */

const SANITY_URL_PATTERN = /\.(?:api|apicdn)\.sanity\.io\//

/** Far enough out that the GROQ end-date filters can never hide these. */
const FUTURE = '2099-06-01T18:00:00.000Z'
const FUTURE_END = '2099-06-02T22:00:00.000Z'

function popup(index, overrides = {}) {
  return {
    _id: `popup-doc-${index}`,
    name: `Fixture Pop-Up ${index}`,
    slug: `fixture-popup-${index}`,
    start_datetime: FUTURE,
    end_datetime: FUTURE_END,
    start_date: null,
    end_date: null,
    all_day: false,
    recurring: false,
    category: 'Food',
    borough: 'Manhattan',
    location: `${index} Fixture Street, New York, NY`,
    link: `https://example-popup-${index}.test/tickets`,
    link_text: 'Learn More',
    short_description: `Short description ${index}.`,
    long_description: `Long description ${index}.`,
    display_overall: true,
    display_in_calendar: true,
    display_in_popups_page: true,
    display_in_carousel: true,
    imageUrl: '',
    ...overrides,
  }
}

function dateIdea(index, overrides = {}) {
  return {
    _id: `date-idea-doc-${index}`,
    name: `Fixture Date Idea ${index}`,
    slug: `fixture-date-idea-${index}`,
    location: `${index} Fixture Avenue, New York, NY`,
    link: `https://example-date-idea-${index}.test/details`,
    link_text: 'Learn More',
    short_description: `A short date idea description ${index}.`,
    long_description: `A long date idea description ${index}.`,
    display_overall: true,
    imageUrl: '',
    ...overrides,
  }
}

/**
 * Pop-ups that land on today, so the calendar page — which only ever renders
 * the month it is showing — actually has bars to click.
 */
function todayPopups(count = 2, { utc = false } = {}) {
  const today = new Date()
  const [year, month, day] = utc
    ? [today.getUTCFullYear(), today.getUTCMonth() + 1, today.getUTCDate()]
    : [today.getFullYear(), today.getMonth() + 1, today.getDate()]
  const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  return Array.from({ length: count }, (unused, index) => popup(index + 1, {
    start_datetime: `${iso}T14:00:00.000Z`,
    end_datetime: `${iso}T22:00:00.000Z`,
  }))
}

const POPUPS = [popup(1), popup(2), popup(3)]
const DATE_IDEAS = [dateIdea(1), dateIdea(2), dateIdea(3)]

/**
 * Answers every Sanity GROQ request from the fixtures above, choosing the
 * shape from the document type named in the query, so one route covers the
 * list queries and the `*_BY_ID` queries the detail pages send.
 */
async function stubSanity(page, { popups = POPUPS, dateIdeas = DATE_IDEAS } = {}) {
  await page.route(SANITY_URL_PATTERN, (route) => {
    const query = new URL(route.request().url()).searchParams.get('query') || ''
    const isDateIdea = query.includes('date_ideas')
    const isSingle = query.includes('[0]')
    const collection = isDateIdea ? dateIdeas : popups

    let result = collection
    if (isSingle) {
      const raw = new URL(route.request().url()).searchParams.get('$id')
      const wanted = raw ? JSON.parse(raw) : null
      result = collection.find((doc) => doc.slug === wanted || doc._id === wanted) || collection[0] || null
    }

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ result }),
    })
  })
}

module.exports = { stubSanity, todayPopups, POPUPS, DATE_IDEAS, SANITY_URL_PATTERN }
