const {
  normalizeAddressKey,
  buildGeocodeQueries,
  stripParentheticals,
  normalizeBorough,
  isWithinNycBounds,
  resolveCoordinates,
  parseMutateResponse,
} = require('../../scripts/geocode-popups.js')

describe('normalizeAddressKey', () => {
  it('joins venue name and address with New York, NY appended', () => {
    expect(normalizeAddressKey('Empire State Building', '350 5th Ave')).toBe(
      'Empire State Building, 350 5th Ave, New York, NY'
    )
  })

  it('returns an empty string when both inputs are blank', () => {
    expect(normalizeAddressKey('', '')).toBe('')
    expect(normalizeAddressKey(undefined, undefined)).toBe('')
  })
})

describe('buildGeocodeQueries', () => {
  it('tries the bare address first, then the venue as a landmark', () => {
    expect(buildGeocodeQueries('Remedy Diner', '245 E Houston St')).toEqual([
      '245 E Houston St, New York, NY',
      'Remedy Diner, New York, NY',
    ])
  })

  it('does not duplicate the city suffix when the address already includes NY', () => {
    expect(buildGeocodeQueries('22 Wooster', '22 Wooster St, New York, NY 10013')).toEqual([
      '22 Wooster St, New York, NY 10013',
      '22 Wooster, New York, NY',
    ])
  })

  it('adds an intersection variant with "and" when the address contains an ampersand', () => {
    expect(
      buildGeocodeQueries('Chelsea Triangle', 'W 14th St & 9th Ave, New York, NY 10014')
    ).toEqual([
      'W 14th St & 9th Ave, New York, NY 10014',
      'W 14th St and 9th Ave, New York, NY 10014',
      'Chelsea Triangle, New York, NY',
    ])
  })

  it('drops blank parts and returns no queries when everything is blank', () => {
    expect(buildGeocodeQueries('Domino Park', '')).toEqual(['Domino Park, New York, NY'])
    expect(buildGeocodeQueries('', '')).toEqual([])
  })

  it('retries without the parenthetical aside, which Nominatim will not match', () => {
    expect(buildGeocodeQueries('', '112 East 11th St (Moxy East Village)')).toEqual([
      '112 East 11th St (Moxy East Village), New York, NY',
      '112 East 11th St, New York, NY',
    ])
  })

  it('does not add a stripped variant when there is nothing to strip', () => {
    expect(buildGeocodeQueries('', '245 E Houston St')).toEqual([
      '245 E Houston St, New York, NY',
    ])
  })
})

describe('stripParentheticals', () => {
  it('removes an aside and the whitespace it leaves behind', () => {
    expect(stripParentheticals('199 Avenue B (Pavlo Mochi)')).toBe('199 Avenue B')
  })

  it('handles an aside the editor never closed', () => {
    expect(stripParentheticals('601 W 26th St (Starrett-Lehigh Building')).toBe(
      '601 W 26th St'
    )
  })

  it('leaves text without parentheses alone', () => {
    expect(stripParentheticals('74 Wythe Ave')).toBe('74 Wythe Ave')
    expect(stripParentheticals('')).toBe('')
    expect(stripParentheticals(undefined)).toBe('')
  })
})

describe('isWithinNycBounds', () => {
  it('accepts points across the five boroughs', () => {
    expect(isWithinNycBounds(40.7222, -73.9577)).toBe(true)  // Williamsburg
    expect(isWithinNycBounds(40.7509, -73.9893)).toBe(true)  // Herald Square
    expect(isWithinNycBounds(40.5795, -74.1502)).toBe(true)  // Staten Island
    expect(isWithinNycBounds(40.8448, -73.8648)).toBe(true)  // The Bronx
  })

  it('rejects the upstate false positive that prompted the check', () => {
    // "Washington & Water St (Brooklyn)" matched an intersection in Syracuse.
    expect(isWithinNycBounds(43.05, -76.1575)).toBe(false)
  })

  it('rejects non-numeric input rather than letting NaN through', () => {
    expect(isWithinNycBounds(NaN, -73.98)).toBe(false)
    expect(isWithinNycBounds(undefined, undefined)).toBe(false)
  })
})

describe('normalizeBorough', () => {
  it('reads the borough out of the suburb field', () => {
    expect(normalizeBorough({ suburb: 'Brooklyn' })).toBe('brooklyn')
    expect(normalizeBorough({ suburb: 'Manhattan' })).toBe('manhattan')
    expect(normalizeBorough({ suburb: 'Queens' })).toBe('queens')
    expect(normalizeBorough({ suburb: 'The Bronx' })).toBe('bronx')
    expect(normalizeBorough({ suburb: 'Staten Island' })).toBe('staten_island')
  })

  it('falls back to the county when the suburb is missing', () => {
    expect(normalizeBorough({ county: 'Richmond County' })).toBe('staten_island')
    expect(normalizeBorough({ county: 'New York County' })).toBe('manhattan')
  })

  it('prefers the suburb over the county when both are present', () => {
    expect(normalizeBorough({ suburb: 'Brooklyn', county: 'Kings County' })).toBe('brooklyn')
  })

  it('returns null for an address outside the five boroughs', () => {
    expect(normalizeBorough({ suburb: 'Hoboken', county: 'Hudson County' })).toBeNull()
    expect(normalizeBorough({})).toBeNull()
    expect(normalizeBorough(null)).toBeNull()
  })
})

describe('resolveCoordinates', () => {
  it('throttles after a failed geocode attempt just like after a successful one', async () => {
    const cache = {}
    const sleepCalls = []
    const sleep = (ms) => {
      sleepCalls.push(ms)
      return Promise.resolve()
    }
    const geocode = vi
      .fn()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce({ lat: 1, lon: 2 })

    await expect(
      resolveCoordinates('addr-1', ['query 1'], cache, { geocode, sleep })
    ).rejects.toThrow('boom')
    expect(sleepCalls).toHaveLength(1)

    const result = await resolveCoordinates('addr-2', ['query 2'], cache, { geocode, sleep })
    expect(result).toEqual({ coords: { lat: 1, lon: 2 }, cacheDirty: true })
    expect(sleepCalls).toHaveLength(2)
  })

  it('does not call geocode or sleep on a cache hit', async () => {
    const cache = { 'addr-1': { lat: 1, lon: 2, borough: 'brooklyn' } }
    const geocode = vi.fn()
    const sleep = vi.fn()

    const result = await resolveCoordinates('addr-1', ['query 1'], cache, { geocode, sleep })

    expect(result).toEqual({
      coords: { lat: 1, lon: 2, borough: 'brooklyn' },
      cacheDirty: false,
    })
    expect(geocode).not.toHaveBeenCalled()
    expect(sleep).not.toHaveBeenCalled()
  })

  it('re-geocodes a cache entry written before boroughs were derived', async () => {
    const cache = { 'addr-1': { lat: 1, lon: 2 } }
    const geocode = vi.fn().mockResolvedValue({ lat: 3, lon: 4, borough: 'queens' })
    const sleep = vi.fn().mockResolvedValue(undefined)

    const result = await resolveCoordinates('addr-1', ['query 1'], cache, { geocode, sleep })

    expect(geocode).toHaveBeenCalledWith('query 1')
    expect(result.coords).toEqual({ lat: 3, lon: 4, borough: 'queens' })
    expect(cache['addr-1']).toEqual({ lat: 3, lon: 4, borough: 'queens' })
  })

  it('does not cache a failed lookup, so it is retried on the next run', async () => {
    const cache = {}
    const geocode = vi.fn().mockRejectedValueOnce(new Error('network error'))
    const sleep = vi.fn().mockResolvedValue(undefined)

    await expect(
      resolveCoordinates('addr-1', ['query 1'], cache, { geocode, sleep })
    ).rejects.toThrow('network error')
    expect(cache).not.toHaveProperty('addr-1')
  })

  it('falls through the query chain until one matches, throttling each attempt', async () => {
    const cache = {}
    const sleep = vi.fn().mockResolvedValue(undefined)
    const geocode = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ lat: 40.7, lon: -74.0 })

    const result = await resolveCoordinates(
      'addr-1',
      ['query 1', 'query 2', 'query 3'],
      cache,
      { geocode, sleep }
    )

    expect(geocode.mock.calls.map(c => c[0])).toEqual(['query 1', 'query 2', 'query 3'])
    expect(result).toEqual({ coords: { lat: 40.7, lon: -74.0 }, cacheDirty: true })
    expect(cache['addr-1']).toEqual({ lat: 40.7, lon: -74.0 })
    expect(sleep).toHaveBeenCalledTimes(3)
  })

  it('stops at the first query that matches without trying the rest', async () => {
    const cache = {}
    const sleep = vi.fn().mockResolvedValue(undefined)
    const geocode = vi.fn().mockResolvedValue({ lat: 1, lon: 2 })

    await resolveCoordinates('addr-1', ['query 1', 'query 2'], cache, { geocode, sleep })

    expect(geocode).toHaveBeenCalledTimes(1)
  })

  it('retries a cached null miss instead of treating it as permanent', async () => {
    const cache = { 'addr-1': null }
    const sleep = vi.fn().mockResolvedValue(undefined)
    const geocode = vi.fn().mockResolvedValue({ lat: 3, lon: 4 })

    const result = await resolveCoordinates('addr-1', ['query 1'], cache, { geocode, sleep })

    expect(geocode).toHaveBeenCalled()
    expect(result).toEqual({ coords: { lat: 3, lon: 4 }, cacheDirty: true })
    expect(cache['addr-1']).toEqual({ lat: 3, lon: 4 })
  })

  it('reports a clean cache when a retried miss is still a miss', async () => {
    const cache = { 'addr-1': null }
    const sleep = vi.fn().mockResolvedValue(undefined)
    const geocode = vi.fn().mockResolvedValue(null)

    const result = await resolveCoordinates('addr-1', ['query 1'], cache, { geocode, sleep })

    expect(result).toEqual({ coords: null, cacheDirty: false })
  })
})

describe('parseMutateResponse', () => {
  it('returns the parsed body on a 200 with no error field', () => {
    const body = JSON.stringify({ transactionId: 'abc', results: [] })
    expect(parseMutateResponse(200, body)).toEqual({ transactionId: 'abc', results: [] })
  })

  it('throws when the response body contains an error field, even with a 2xx status', () => {
    const body = JSON.stringify({ error: { description: 'Insufficient permissions' } })
    expect(() => parseMutateResponse(200, body)).toThrow(/Insufficient permissions/)
  })

  it('throws on a non-2xx status code', () => {
    expect(() => parseMutateResponse(400, '{"error":"bad request"}')).toThrow(/HTTP 400/)
  })

  it('throws when the body is not valid JSON', () => {
    expect(() => parseMutateResponse(200, 'not json')).toThrow(/parse/i)
  })
})
