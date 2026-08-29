const {
  SEARCH_FIELDS,
  FILTER_FIELDS,
  matchesQuery,
  matchesFilters,
  filterDateIdeas,
  getDistinctNeighborhoods,
  createInitialState,
} = require('../../resources/js/dateideas-filter.js')

/** A mapped date idea, i.e. what mapSanityDateIdea produces. */
function idea(overrides = {}) {
  return {
    id: 'brooklyn-bridge-walk',
    name: 'Sunset Walk Across the Brooklyn Bridge',
    vibe: 'romantic',
    budget: 'free',
    borough: 'brooklyn',
    neighborhood: 'DUMBO',
    venue_name: 'Brooklyn Bridge',
    price: 'Free',
    short_desc: 'Time it for golden hour and finish with pizza underneath.',
    ...overrides,
  }
}

const NO_FILTERS = { query: '', vibe: null, budget: null, neighborhood: null }

describe('the date ideas filter shape', () => {
  it('filters on vibe, budget and neighborhood', () => {
    // REDESIGN.md section 7.2. Date ideas are evergreen, so there is
    // deliberately no date filter and no borough chip.
    expect(FILTER_FIELDS).toEqual({
      vibe: 'vibe',
      budget: 'budget',
      neighborhood: 'neighborhood',
    })
  })

  it('starts with nothing selected and no stray pop-ups keys', () => {
    // Guards against the state object being copied from popups-filter.js:
    // a `dates` or `type` key here would be filtered on and never set.
    expect(createInitialState()).toEqual(NO_FILTERS)
  })

  it('searches the fields the placeholder promises', () => {
    expect(SEARCH_FIELDS).toEqual(['name', 'venue_name', 'neighborhood'])
  })
})

describe('matchesQuery', () => {
  it('matches the name, venue and neighborhood', () => {
    expect(matchesQuery(idea(), 'sunset')).toBe(true)
    expect(matchesQuery(idea(), 'brooklyn bridge')).toBe(true)
    expect(matchesQuery(idea(), 'dumbo')).toBe(true)
  })

  it('does not match on the description', () => {
    expect(matchesQuery(idea(), 'golden hour')).toBe(false)
  })

  it('ignores case and surrounding whitespace', () => {
    expect(matchesQuery(idea(), '  SUNSET  ')).toBe(true)
  })

  it('treats an empty query as matching everything', () => {
    expect(matchesQuery(idea(), '')).toBe(true)
    expect(matchesQuery(idea(), null)).toBe(true)
  })
})

describe('matchesFilters', () => {
  it('passes an entry when nothing is set', () => {
    expect(matchesFilters(idea(), NO_FILTERS)).toBe(true)
  })

  it('filters on vibe', () => {
    expect(matchesFilters(idea(), { ...NO_FILTERS, vibe: 'romantic' })).toBe(true)
    expect(matchesFilters(idea(), { ...NO_FILTERS, vibe: 'chill' })).toBe(false)
  })

  it('filters on budget', () => {
    expect(matchesFilters(idea(), { ...NO_FILTERS, budget: 'free' })).toBe(true)
    expect(matchesFilters(idea(), { ...NO_FILTERS, budget: '75_plus' })).toBe(false)
  })

  it('filters on neighborhood', () => {
    expect(matchesFilters(idea(), { ...NO_FILTERS, neighborhood: 'DUMBO' })).toBe(true)
    expect(matchesFilters(idea(), { ...NO_FILTERS, neighborhood: 'Astoria' })).toBe(false)
  })

  it('does not confuse the vibe and budget enums, which share values', () => {
    // Both lists contain "free" — a matcher wired to the wrong field would
    // still look right on an entry where they agree.
    const cheapButCultural = idea({ vibe: 'cultural', budget: 'free' })
    expect(matchesFilters(cheapButCultural, { ...NO_FILTERS, vibe: 'free' })).toBe(false)
    expect(matchesFilters(cheapButCultural, { ...NO_FILTERS, budget: 'free' })).toBe(true)

    const freeVibeButPricey = idea({ vibe: 'free', budget: '75_plus' })
    expect(matchesFilters(freeVibeButPricey, { ...NO_FILTERS, vibe: 'free' })).toBe(true)
    expect(matchesFilters(freeVibeButPricey, { ...NO_FILTERS, budget: 'free' })).toBe(false)
  })

  it('requires every active filter to agree', () => {
    const state = { ...NO_FILTERS, vibe: 'romantic', budget: 'free', neighborhood: 'DUMBO' }
    expect(matchesFilters(idea(), state)).toBe(true)
    expect(matchesFilters(idea({ budget: 'under_30' }), state)).toBe(false)
  })

  it('combines search with the chips', () => {
    expect(matchesFilters(idea(), { ...NO_FILTERS, query: 'sunset', vibe: 'romantic' })).toBe(true)
    expect(matchesFilters(idea(), { ...NO_FILTERS, query: 'sunset', vibe: 'chill' })).toBe(false)
  })

  it('treats an empty-string filter value as unset', () => {
    // The "All …" option carries an empty value.
    expect(matchesFilters(idea(), { ...NO_FILTERS, vibe: '' })).toBe(true)
  })

  it('ignores a date range, which this page does not offer', () => {
    // Nothing sets it, but a shared Clear all or a stale URL must not empty
    // the page by filtering on a field date ideas do not carry.
    expect(matchesFilters(idea(), { ...NO_FILTERS, dates: '2026-07-15' })).toBe(true)
  })
})

describe('filterDateIdeas', () => {
  const entries = [
    idea({ id: 'a', name: 'Sunset Walk', vibe: 'romantic', budget: 'free', neighborhood: 'DUMBO' }),
    idea({ id: 'b', name: 'The Cloisters', vibe: 'cultural', budget: 'under_30', neighborhood: 'Washington Heights' }),
    idea({ id: 'c', name: 'Beer Garden', vibe: 'chill', budget: '30_to_75', neighborhood: 'Astoria' }),
  ]

  it('narrows to the matching entries and preserves order', () => {
    const kept = filterDateIdeas(entries, { ...NO_FILTERS, budget: 'under_30' })
    expect(kept.map((one) => one.id)).toEqual(['b'])
  })

  it('returns everything when no filter is active', () => {
    expect(filterDateIdeas(entries, NO_FILTERS)).toHaveLength(3)
  })

  it('can return nothing', () => {
    expect(filterDateIdeas(entries, { ...NO_FILTERS, vibe: 'foodie' })).toEqual([])
  })

  it('tolerates a missing state', () => {
    expect(filterDateIdeas(entries, null)).toHaveLength(3)
  })
})

describe('getDistinctNeighborhoods', () => {
  it('collects the neighborhoods present, sorted and deduped', () => {
    const entries = [
      idea({ neighborhood: 'DUMBO' }),
      idea({ neighborhood: 'Astoria' }),
      idea({ neighborhood: 'DUMBO' }),
      idea({ neighborhood: '' }),
    ]
    expect(getDistinctNeighborhoods(entries)).toEqual([
      { value: 'Astoria', label: 'Astoria' },
      { value: 'DUMBO', label: 'DUMBO' },
    ])
  })
})

// Parked with the redesign (#403): #402 unloads this markup from the page,
// so these assertions have nothing to find. The module-logic and CSS-file
// tests above still run and keep the parked code verified for the future
// refactor. Re-enable by reverting #402 and dropping the `.skip`.
describe.skip('date-ideas.html filter markup', () => {
  const fs = require('node:fs')
  const path = require('node:path')
  const html = fs.readFileSync(path.resolve(__dirname, '..', '..', 'date-ideas.html'), 'utf8')

  it('loads the shared filter core before the page module that builds on it', () => {
    // Classic scripts run in document order, so results-filter.js has to be
    // there before dateideas-filter.js reads window.NycResultsFilter.
    const core = html.indexOf('resources/js/results-filter.js')
    const page = html.indexOf('resources/js/dateideas-filter.js')
    expect(core).toBeGreaterThan(-1)
    expect(page).toBeGreaterThan(core)
  })

  it.each(['vibe', 'budget', 'neighborhood'])('the %s dropdown leads with an "All …" option', (filter) => {
    // REDESIGN.md section 6.3. Without one, clearing a single filter means
    // re-selecting the active option — a gesture nobody discovers (#295).
    const group = html.slice(html.indexOf(`data-filter="${filter}"`))
    const dropdown = group.slice(0, group.indexOf('</ul>'))
    const firstOption = dropdown.slice(dropdown.indexOf('<li'))
    expect(firstOption).toMatch(/data-value=""/)
    expect(firstOption.slice(0, firstOption.indexOf('</li>'))).toMatch(/All /)
  })

  it('offers every vibe and budget the schema defines', () => {
    // A value missing here hides its date ideas behind a filter nobody can pick.
    for (const vibe of ['romantic', 'adventurous', 'chill', 'foodie', 'cultural', 'free']) {
      expect(html).toContain(`data-value="${vibe}"`)
    }
    for (const budget of ['free', 'under_30', '30_to_75', '75_plus']) {
      expect(html).toContain(`data-value="${budget}"`)
    }
  })
})
