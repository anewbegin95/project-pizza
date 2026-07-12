const {
  normalizeAddressKey,
  buildGeocodeQueries,
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
    const cache = { 'addr-1': { lat: 1, lon: 2 } }
    const geocode = vi.fn()
    const sleep = vi.fn()

    const result = await resolveCoordinates('addr-1', ['query 1'], cache, { geocode, sleep })

    expect(result).toEqual({ coords: { lat: 1, lon: 2 }, cacheDirty: false })
    expect(geocode).not.toHaveBeenCalled()
    expect(sleep).not.toHaveBeenCalled()
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
