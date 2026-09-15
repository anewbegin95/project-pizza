const {
  matchesQuery,
  matchesFilters,
  filterPopups,
  parseDateRange,
  overlapsRange,
  getDistinctNeighborhoods,
} = require('../../resources/js/popups-filter.js')

/** A mapped pop-up, i.e. what mapSanityPopup produces. */
function popup(overrides = {}) {
  return {
    id: 'flavia-lounge',
    name: 'Flavia Flavor Lounge',
    start_datetime: '2026-07-23T15:00:00.000Z',
    end_datetime: '2026-07-24T23:00:00.000Z',
    category: 'food_drink',
    borough: 'manhattan',
    neighborhood: 'SoHo',
    venue_name: '22 Wooster',
    short_desc: 'Complimentary coffee and tea in a loft space.',
    ...overrides,
  }
}

const NO_FILTERS = { query: '', borough: null, neighborhood: null, type: null, dates: null }

describe('matchesQuery', () => {
  it('matches the event name, venue and neighborhood', () => {
    expect(matchesQuery(popup(), 'flavia')).toBe(true)
    expect(matchesQuery(popup(), 'wooster')).toBe(true)
    expect(matchesQuery(popup(), 'soho')).toBe(true)
  })

  it('ignores case and surrounding whitespace', () => {
    expect(matchesQuery(popup(), '  FLAVIA  ')).toBe(true)
  })

  it('does not match on the description', () => {
    // The placeholder promises events, venues and neighborhoods. Matching body
    // copy makes the result set feel arbitrary.
    expect(matchesQuery(popup(), 'complimentary')).toBe(false)
  })

  it('treats an empty query as matching everything', () => {
    expect(matchesQuery(popup(), '')).toBe(true)
    expect(matchesQuery(popup(), null)).toBe(true)
  })

  it('rejects a query that matches nothing', () => {
    expect(matchesQuery(popup(), 'brooklyn')).toBe(false)
  })

  it('survives entries with missing fields', () => {
    expect(matchesQuery({ name: 'Only a name' }, 'name')).toBe(true)
    expect(matchesQuery({}, 'anything')).toBe(false)
  })
})

describe('parseDateRange', () => {
  it('reads a single date as a one-day range', () => {
    const range = parseDateRange('2026-07-15')
    expect(range.from.toISOString()).toBe('2026-07-15T12:00:00.000Z')
    expect(range.to.toISOString()).toBe('2026-07-15T12:00:00.000Z')
  })

  it('reads a two-ended range', () => {
    const range = parseDateRange('2026-07-15..2026-07-22')
    expect(range.from.toISOString()).toBe('2026-07-15T12:00:00.000Z')
    expect(range.to.toISOString()).toBe('2026-07-22T12:00:00.000Z')
  })

  it('anchors at noon UTC so an Eastern day is never off by one', () => {
    // new Date('2026-07-15') is UTC midnight, i.e. the evening of the 14th in
    // New York. Noon UTC keeps the calendar day intact on both sides.
    const { from } = parseDateRange('2026-07-15')
    const easternDay = from.toLocaleDateString('en-US', { timeZone: 'America/New_York', day: 'numeric' })
    expect(easternDay).toBe('15')
  })

  it('returns null for absent or malformed values', () => {
    expect(parseDateRange(null)).toBeNull()
    expect(parseDateRange('')).toBeNull()
    expect(parseDateRange('not-a-date')).toBeNull()
  })
})

describe('overlapsRange', () => {
  const range = parseDateRange('2026-07-20..2026-07-24')

  it('includes an event running through the range', () => {
    expect(overlapsRange(popup({ start_datetime: '2026-07-10T12:00:00.000Z', end_datetime: '2026-08-10T12:00:00.000Z' }), range)).toBe(true)
  })

  it('includes an event starting inside the range', () => {
    expect(overlapsRange(popup({ start_datetime: '2026-07-23T15:00:00.000Z', end_datetime: '2026-07-30T23:00:00.000Z' }), range)).toBe(true)
  })

  it('includes an event ending inside the range', () => {
    expect(overlapsRange(popup({ start_datetime: '2026-07-01T15:00:00.000Z', end_datetime: '2026-07-21T23:00:00.000Z' }), range)).toBe(true)
  })

  it('includes a single-day event on the range boundary', () => {
    expect(overlapsRange(popup({ start_datetime: '2026-07-24T18:00:00.000Z', end_datetime: '' }), range)).toBe(true)
    expect(overlapsRange(popup({ start_datetime: '2026-07-20T09:00:00.000Z', end_datetime: '' }), range)).toBe(true)
  })

  it('excludes events wholly before or after the range', () => {
    expect(overlapsRange(popup({ start_datetime: '2026-07-01T15:00:00.000Z', end_datetime: '2026-07-05T23:00:00.000Z' }), range)).toBe(false)
    expect(overlapsRange(popup({ start_datetime: '2026-08-01T15:00:00.000Z', end_datetime: '' }), range)).toBe(false)
  })

  it('treats a date-only all-day event as covering its whole day', () => {
    // '2026-07-20' must not resolve to the evening of the 19th.
    expect(overlapsRange(popup({ start_datetime: '2026-07-20', end_datetime: '2026-07-20' }), range)).toBe(true)
    expect(overlapsRange(popup({ start_datetime: '2026-07-19', end_datetime: '2026-07-19' }), range)).toBe(false)
  })

  it('keeps undated entries out of a date-filtered set', () => {
    expect(overlapsRange(popup({ start_datetime: '', end_datetime: '' }), range)).toBe(false)
  })

  it('matches everything when there is no range', () => {
    expect(overlapsRange(popup(), null)).toBe(true)
  })
})

describe('matchesFilters', () => {
  it('passes an entry when nothing is set', () => {
    expect(matchesFilters(popup(), NO_FILTERS)).toBe(true)
  })

  it.each([
    ['borough', 'manhattan', 'brooklyn'],
    ['neighborhood', 'SoHo', 'Chelsea'],
    ['type', 'food_drink', 'market'],
  ])('applies the %s filter', (filter, hit, miss) => {
    expect(matchesFilters(popup(), { ...NO_FILTERS, [filter]: hit })).toBe(true)
    expect(matchesFilters(popup(), { ...NO_FILTERS, [filter]: miss })).toBe(false)
  })

  it('requires every active filter to agree', () => {
    const state = { ...NO_FILTERS, borough: 'manhattan', type: 'market' }
    expect(matchesFilters(popup(), state)).toBe(false)
    expect(matchesFilters(popup({ category: 'market' }), state)).toBe(true)
  })

  it('combines search with the chips', () => {
    const state = { ...NO_FILTERS, query: 'flavia', borough: 'brooklyn' }
    expect(matchesFilters(popup(), state)).toBe(false)
  })

  it('applies the date range alongside the chips', () => {
    const state = { ...NO_FILTERS, dates: '2026-07-23..2026-07-24', type: 'food_drink' }
    expect(matchesFilters(popup(), state)).toBe(true)
    expect(matchesFilters(popup(), { ...state, dates: '2026-09-01' })).toBe(false)
  })

  it('treats an empty-string filter value as unset', () => {
    // The "All …" option carries an empty value.
    expect(matchesFilters(popup(), { ...NO_FILTERS, borough: '' })).toBe(true)
  })
})

describe('filterPopups', () => {
  const all = [
    popup(),
    popup({ id: 'chelsea-market', name: 'Chelsea Night Market', neighborhood: 'Chelsea', category: 'market' }),
    popup({ id: 'bushwick-vintage', name: 'Bushwick Vintage Fair', borough: 'brooklyn', neighborhood: 'Bushwick', category: 'vintage_thrift' }),
  ]

  it('returns everything when no filter is active', () => {
    expect(filterPopups(all, NO_FILTERS)).toHaveLength(3)
  })

  it('narrows to the matching entries and preserves order', () => {
    const result = filterPopups(all, { ...NO_FILTERS, borough: 'manhattan' })
    expect(result.map((entry) => entry.id)).toEqual(['flavia-lounge', 'chelsea-market'])
  })

  it('can return nothing', () => {
    expect(filterPopups(all, { ...NO_FILTERS, query: 'nonexistent' })).toEqual([])
  })

  it('tolerates a missing state object', () => {
    expect(filterPopups(all, undefined)).toHaveLength(3)
  })
})

describe('getDistinctNeighborhoods', () => {
  it('collects the neighborhoods present, sorted and deduped', () => {
    const all = [
      popup({ neighborhood: 'SoHo' }),
      popup({ neighborhood: 'Chelsea' }),
      popup({ neighborhood: 'SoHo' }),
      popup({ neighborhood: 'Bushwick' }),
    ]
    expect(getDistinctNeighborhoods(all)).toEqual([
      { value: 'Bushwick', label: 'Bushwick' },
      { value: 'Chelsea', label: 'Chelsea' },
      { value: 'SoHo', label: 'SoHo' },
    ])
  })

  it('skips entries with no neighborhood', () => {
    expect(getDistinctNeighborhoods([popup({ neighborhood: '' }), popup({ neighborhood: 'SoHo' })])).toEqual([
      { value: 'SoHo', label: 'SoHo' },
    ])
  })

  it('sorts case-insensitively', () => {
    const all = [popup({ neighborhood: 'east village' }), popup({ neighborhood: 'Chelsea' })]
    expect(getDistinctNeighborhoods(all).map((option) => option.value)).toEqual(['Chelsea', 'east village'])
  })
})
