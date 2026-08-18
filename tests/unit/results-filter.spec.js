const {
  isSet,
  matchesQuery,
  getDistinctValues,
  createMatcher,
  filterEntries,
} = require('../../resources/js/results-filter.js')

/** A mapped entry, deliberately not shaped like either page's content. */
function entry(overrides = {}) {
  return {
    name: 'Sunset Walk Across the Brooklyn Bridge',
    venue_name: 'Brooklyn Bridge',
    neighborhood: 'DUMBO',
    borough: 'brooklyn',
    vibe: 'romantic',
    category: 'market',
    short_desc: 'Time it for golden hour.',
    ...overrides,
  }
}

describe('isSet', () => {
  it('treats null, undefined and the empty string as unset', () => {
    // The "All …" option carries an empty value, which reads as clearing.
    expect(isSet(null)).toBe(false)
    expect(isSet(undefined)).toBe(false)
    expect(isSet('')).toBe(false)
  })

  it('treats any other value as set', () => {
    expect(isSet('romantic')).toBe(true)
    expect(isSet(0)).toBe(true)
    expect(isSet(false)).toBe(true)
  })
})

describe('matchesQuery', () => {
  const FIELDS = ['name', 'venue_name', 'neighborhood']

  it('matches any of the fields it is given', () => {
    expect(matchesQuery(entry(), 'sunset', FIELDS)).toBe(true)
    expect(matchesQuery(entry(), 'bridge', FIELDS)).toBe(true)
    expect(matchesQuery(entry(), 'dumbo', FIELDS)).toBe(true)
  })

  it('only looks at the fields it is given', () => {
    // The field list is the whole point of sharing this: each page promises
    // something different in its placeholder.
    expect(matchesQuery(entry(), 'golden', FIELDS)).toBe(false)
    expect(matchesQuery(entry(), 'golden', ['short_desc'])).toBe(true)
    expect(matchesQuery(entry(), 'dumbo', ['name'])).toBe(false)
  })

  it('ignores case and surrounding whitespace', () => {
    expect(matchesQuery(entry(), '  SUNSET  ', FIELDS)).toBe(true)
  })

  it('treats an empty query as matching everything', () => {
    expect(matchesQuery(entry(), '', FIELDS)).toBe(true)
    expect(matchesQuery(entry(), null, FIELDS)).toBe(true)
  })

  it('survives entries with missing fields', () => {
    expect(matchesQuery({ name: 'Only a name' }, 'name', FIELDS)).toBe(true)
    expect(matchesQuery({}, 'anything', FIELDS)).toBe(false)
  })
})

describe('getDistinctValues', () => {
  const entries = [
    entry({ neighborhood: 'DUMBO' }),
    entry({ neighborhood: 'Astoria' }),
    entry({ neighborhood: 'DUMBO' }),
    entry({ neighborhood: '  Chelsea  ' }),
    entry({ neighborhood: '' }),
    entry({ neighborhood: undefined }),
  ]

  it('collects the values present, deduped, trimmed and sorted', () => {
    expect(getDistinctValues(entries, 'neighborhood')).toEqual([
      { value: 'Astoria', label: 'Astoria' },
      { value: 'Chelsea', label: 'Chelsea' },
      { value: 'DUMBO', label: 'DUMBO' },
    ])
  })

  it('reads whichever field it is asked for', () => {
    expect(getDistinctValues([entry({ vibe: 'chill' }), entry()], 'vibe')).toEqual([
      { value: 'chill', label: 'chill' },
      { value: 'romantic', label: 'romantic' },
    ])
  })

  it('sorts case-insensitively', () => {
    const mixed = [entry({ neighborhood: 'east village' }), entry({ neighborhood: 'Chelsea' })]
    expect(getDistinctValues(mixed, 'neighborhood').map((o) => o.value)).toEqual([
      'Chelsea',
      'east village',
    ])
  })

  it('returns nothing for an empty or missing list', () => {
    expect(getDistinctValues([], 'neighborhood')).toEqual([])
    expect(getDistinctValues(undefined, 'neighborhood')).toEqual([])
  })
})

describe('createMatcher', () => {
  const matches = createMatcher({
    searchFields: ['name', 'venue_name'],
    fields: { vibe: 'vibe', area: 'neighborhood' },
  })

  it('passes an entry when nothing is set', () => {
    expect(matches(entry(), { query: '', vibe: null, area: null })).toBe(true)
  })

  it('maps a state key onto the entry field it names', () => {
    // The two are not always the same word: Pop-Ups' "type" chip reads the
    // entry's `category`, which is what this indirection is for.
    const byCategory = createMatcher({ searchFields: [], fields: { type: 'category' } })
    expect(byCategory(entry(), { type: 'market' })).toBe(true)
    expect(byCategory(entry(), { type: 'food_drink' })).toBe(false)
  })

  it('requires every active filter to agree', () => {
    expect(matches(entry(), { vibe: 'romantic', area: 'DUMBO' })).toBe(true)
    expect(matches(entry(), { vibe: 'romantic', area: 'Astoria' })).toBe(false)
  })

  it('combines the search with the filters', () => {
    expect(matches(entry(), { query: 'sunset', vibe: 'romantic' })).toBe(true)
    expect(matches(entry(), { query: 'sunset', vibe: 'chill' })).toBe(false)
    expect(matches(entry(), { query: 'nothing', vibe: 'romantic' })).toBe(false)
  })

  it('treats an empty-string filter value as unset', () => {
    expect(matches(entry(), { vibe: '' })).toBe(true)
  })

  it('ignores state keys it was not given a field for', () => {
    // A stray key from another page's state must not silently reject
    // everything by comparing against a field the entry does not have.
    expect(matches(entry(), { vibe: 'romantic', dates: '2026-07-15' })).toBe(true)
  })

  it('applies extra predicates alongside the field map', () => {
    // Pop-Ups' date range is not an equality check, so it arrives this way.
    const freeOnly = createMatcher({
      searchFields: [],
      fields: {},
      extra: [(candidate, state) => !state.freeOnly || candidate.price === 'Free'],
    })
    expect(freeOnly(entry({ price: 'Free' }), { freeOnly: true })).toBe(true)
    expect(freeOnly(entry({ price: '$20' }), { freeOnly: true })).toBe(false)
    expect(freeOnly(entry({ price: '$20' }), { freeOnly: false })).toBe(true)
  })

  it('rejects a missing entry and accepts a missing state', () => {
    expect(matches(null, { vibe: 'romantic' })).toBe(false)
    expect(matches(entry(), null)).toBe(true)
  })
})

describe('filterEntries', () => {
  const matches = createMatcher({ searchFields: ['name'], fields: { vibe: 'vibe' } })
  const entries = [
    entry({ name: 'Walk', vibe: 'romantic' }),
    entry({ name: 'Museum', vibe: 'cultural' }),
    entry({ name: 'Beer garden', vibe: 'chill' }),
  ]

  it('narrows to the matching entries and preserves order', () => {
    const kept = filterEntries(entries, { vibe: 'cultural' }, matches)
    expect(kept.map((one) => one.name)).toEqual(['Museum'])
  })

  it('returns everything when no filter is active', () => {
    expect(filterEntries(entries, { query: '', vibe: null }, matches)).toHaveLength(3)
  })

  it('can return nothing', () => {
    expect(filterEntries(entries, { vibe: 'foodie' }, matches)).toEqual([])
  })

  it('tolerates a missing state or list', () => {
    expect(filterEntries(entries, null, matches)).toHaveLength(3)
    expect(filterEntries(undefined, { vibe: 'chill' }, matches)).toEqual([])
  })
})

describe('createFilterController', () => {
  const { createFilterController } = require('../../resources/js/results-filter.js')

  /**
   * The smallest thing that behaves like a document for this module: it only
   * ever subscribes. Full DOM behaviour is covered in Playwright, per the
   * testing conventions — this pins the state merge, which is the shared part.
   */
  function fakeDoc() {
    const listeners = new Map()
    return {
      addEventListener: (type, handler) => {
        if (!listeners.has(type)) listeners.set(type, [])
        listeners.get(type).push(handler)
      },
      emit: (type, detail) => {
        for (const handler of listeners.get(type) || []) handler({ detail })
      },
    }
  }

  const options = (onChange) => ({
    initialState: { query: '', vibe: null, budget: null },
    matches: createMatcher({ searchFields: ['name'], fields: { vibe: 'vibe', budget: 'budget' } }),
    onChange,
  })

  it('starts from the initial state', () => {
    const controller = createFilterController(fakeDoc(), options(() => {}))
    expect(controller.getState()).toEqual({ query: '', vibe: null, budget: null })
  })

  it('folds search:change into the query without touching the chips', () => {
    const doc = fakeDoc()
    const seen = []
    const controller = createFilterController(doc, options((state) => seen.push(state)))

    doc.emit('filters:change', { state: { vibe: 'romantic' } })
    doc.emit('search:change', { query: 'sunset' })

    expect(controller.getState()).toEqual({ query: 'sunset', vibe: 'romantic', budget: null })
    expect(seen).toHaveLength(2)
  })

  it('folds filters:change in without clearing the query', () => {
    const doc = fakeDoc()
    const controller = createFilterController(doc, options(() => {}))

    doc.emit('search:change', { query: 'sunset' })
    doc.emit('filters:change', { state: { budget: 'free' } })

    expect(controller.getState()).toEqual({ query: 'sunset', vibe: null, budget: 'free' })
  })

  it('reports a copy, so a caller cannot mutate the state it holds', () => {
    const doc = fakeDoc()
    const controller = createFilterController(doc, options(() => {}))
    const first = controller.getState()
    first.vibe = 'tampered'
    expect(controller.getState().vibe).toBeNull()
  })

  it('applies the current state to a list', () => {
    const doc = fakeDoc()
    const controller = createFilterController(doc, options(() => {}))
    const entries = [entry({ name: 'Walk', vibe: 'romantic' }), entry({ name: 'Museum', vibe: 'cultural' })]

    expect(controller.apply(entries)).toHaveLength(2)
    doc.emit('filters:change', { state: { vibe: 'cultural' } })
    expect(controller.apply(entries).map((one) => one.name)).toEqual(['Museum'])
  })

  it('survives an event with no detail', () => {
    const doc = fakeDoc()
    const controller = createFilterController(doc, options(() => {}))
    doc.emit('search:change', undefined)
    doc.emit('filters:change', undefined)
    expect(controller.getState()).toEqual({ query: '', vibe: null, budget: null })
  })
})
