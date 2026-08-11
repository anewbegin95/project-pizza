const {
  PIN_CATEGORIES,
  getPinModifier,
  hasCoordinates,
  getMappable,
  countUnmapped,
  formatUnmappedNote,
  getBounds,
} = require('../../resources/js/popups-map.js')

const at = (id, latitude, longitude, extra = {}) => ({ id, latitude, longitude, ...extra })

describe('getPinModifier', () => {
  it.each([
    ['food_drink', 'food-drink'],
    ['market', 'market'],
    ['art_culture', 'art-culture'],
    ['fashion', 'fashion'],
    ['wellness', 'wellness'],
    ['music', 'music'],
    ['vintage_thrift', 'vintage-thrift'],
  ])('maps the %s category from section 6.6', (category, modifier) => {
    expect(getPinModifier(category)).toBe(modifier)
  })

  it('falls back for a category the spec does not colour', () => {
    // The schema has `beauty`; section 6.6's list does not.
    expect(getPinModifier('beauty')).toBe('other')
    expect(getPinModifier('something_new')).toBe('other')
    expect(getPinModifier('')).toBe('other')
    expect(getPinModifier(undefined)).toBe('other')
  })

  it('offers a modifier for every category it knows', () => {
    for (const category of PIN_CATEGORIES) {
      expect(getPinModifier(category)).not.toBe('other')
    }
  })
})

describe('hasCoordinates', () => {
  it('accepts a real pair', () => {
    expect(hasCoordinates(at('a', 40.72, -74))).toBe(true)
  })

  it('accepts the equator and prime meridian', () => {
    // 0 is a valid coordinate; a truthiness check would drop it.
    expect(hasCoordinates(at('a', 0, 0))).toBe(true)
  })

  it('rejects missing, null or non-numeric values', () => {
    expect(hasCoordinates(at('a', null, -74))).toBe(false)
    expect(hasCoordinates(at('a', 40.72, null))).toBe(false)
    expect(hasCoordinates({ id: 'a' })).toBe(false)
    expect(hasCoordinates(at('a', '40.72', '-74'))).toBe(false)
    expect(hasCoordinates(at('a', Number.NaN, -74))).toBe(false)
  })

  it('rejects out-of-range values', () => {
    expect(hasCoordinates(at('a', 91, 0))).toBe(false)
    expect(hasCoordinates(at('a', 0, 181))).toBe(false)
  })

  it('survives a missing entry', () => {
    expect(hasCoordinates(null)).toBe(false)
  })
})

describe('getMappable and countUnmapped', () => {
  const entries = [at('a', 40.72, -74), at('b', null, null), at('c', 40.7, -73.9), at('d', null, -73.9)]

  it('keeps only the entries that can be placed', () => {
    expect(getMappable(entries).map((entry) => entry.id)).toEqual(['a', 'c'])
  })

  it('counts the ones left off', () => {
    expect(countUnmapped(entries)).toBe(2)
    expect(countUnmapped([])).toBe(0)
    expect(countUnmapped(undefined)).toBe(0)
  })
})

describe('formatUnmappedNote', () => {
  it('says nothing when everything is placed', () => {
    expect(formatUnmappedNote(0)).toBe('')
  })

  it('uses the singular for one', () => {
    // Otherwise "12 events found" over 10 pins just reads as a bug.
    expect(formatUnmappedNote(1)).toBe("1 event isn't on the map yet")
  })

  it('pluralizes beyond one', () => {
    expect(formatUnmappedNote(3)).toBe("3 events aren't on the map yet")
  })
})

describe('getBounds', () => {
  it('spans the placed entries', () => {
    expect(getBounds([at('a', 40.7, -74.1), at('b', 40.8, -73.9)])).toEqual([
      [40.7, -74.1],
      [40.8, -73.9],
    ])
  })

  it('ignores entries with no coordinates', () => {
    expect(getBounds([at('a', 40.7, -74.1), at('b', null, null)])).toEqual([
      [40.7, -74.1],
      [40.7, -74.1],
    ])
  })

  it('returns null when nothing can be placed', () => {
    expect(getBounds([at('a', null, null)])).toBeNull()
    expect(getBounds([])).toBeNull()
  })
})
