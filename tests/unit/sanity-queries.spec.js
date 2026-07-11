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

const { DATE_IDEAS_QUERY } = require('../../scripts/prebuild-events.js')

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
