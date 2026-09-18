// Guards the query-duplication contract described in CLAUDE.md: the browser
// queries (resources/js/sanity-queries.js) and the prebuild script's own GROQ
// copy (scripts/prebuild-events.js) must both project the fields the front
// end consumes.

// sanity-queries.js assigns to window at load time; stub it only for the
// duration of the require so no global state leaks into other specs.
vi.stubGlobal('window', {})
require('../../resources/js/sanity-queries.js')
const SANITY_QUERIES = global.window.SANITY_QUERIES
vi.unstubAllGlobals()

const { DATE_IDEAS_QUERY, POPUPS_QUERY } = require('../../scripts/prebuild-events.js')

// generate-llms-txt.js exports nothing, so its queries are asserted against the
// source text — the same approach tests/unit/analytics.spec.js takes.
const fs = require('node:fs')
const path = require('node:path')
const LLMS_SOURCE = fs.readFileSync(
  path.join(__dirname, '../../scripts/generate-llms-txt.js'),
  'utf8'
)

const DATE_IDEA_TAXONOMY_FIELDS = [
  'vibe',
  'budget',
  'borough',
  'neighborhood',
  'venue_name',
  'address',
  'price',
  'is_featured',
]

describe('date idea GROQ projections', () => {
  it.each(DATE_IDEA_TAXONOMY_FIELDS)(
    'DATE_IDEAS projects %s',
    (field) => {
      expect(SANITY_QUERIES.DATE_IDEAS).toContain(field)
    }
  )

  it.each(DATE_IDEA_TAXONOMY_FIELDS)(
    'DATE_IDEA_BY_ID projects %s',
    (field) => {
      expect(SANITY_QUERIES.DATE_IDEA_BY_ID).toContain(field)
    }
  )

  it.each(DATE_IDEA_TAXONOMY_FIELDS)(
    'prebuild DATE_IDEAS_QUERY projects %s',
    (field) => {
      expect(DATE_IDEAS_QUERY).toContain(field)
    }
  )
})

// All three copies of the pop-ups query had the same all_day-blind precedence
// as mapSanityPopup did: `coalesce` returns the first *defined* argument, so a
// stale start_datetime outranked the correct start_date (#423).
describe('pop-up query precedence respects all_day', () => {
  const POPUP_QUERY_SOURCES = [
    ['sanity-queries POPUPS', () => SANITY_QUERIES.POPUPS],
    ['prebuild POPUPS_QUERY', () => POPUPS_QUERY],
    ['generate-llms-txt POPUPS_QUERY', () => LLMS_SOURCE],
  ]

  it.each(POPUP_QUERY_SOURCES)('%s does not sort by a bare coalesce', (_label, source) => {
    expect(source()).not.toContain('coalesce(start_datetime, start_date) asc')
  })

  it.each(POPUP_QUERY_SOURCES)('%s picks its sort key by all_day', (_label, source) => {
    expect(source()).toContain(
      'all_day == true => coalesce(start_date, start_datetime)'
    )
  })

  // Without this clause an all-day pop-up with a valid future end_date falls
  // through to the stale end_datetime check and vanishes from the site.
  it.each(POPUP_QUERY_SOURCES)(
    '%s keeps an all-day pop-up visible on its own end_date',
    (_label, source) => {
      expect(source()).toContain(
        'all_day == true && defined(end_date) => display_in_popups_page'
      )
    }
  )

  it('the carousel clause gets the same treatment', () => {
    expect(SANITY_QUERIES.POPUPS).toContain(
      'all_day == true && defined(end_date) => display_in_carousel'
    )
  })
})
