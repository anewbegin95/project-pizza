const {
  normalizeAddressKey,
  resolveCoordinates,
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
      resolveCoordinates('addr-1', cache, { geocode, sleep })
    ).rejects.toThrow('boom')
    expect(sleepCalls).toHaveLength(1)

    const result = await resolveCoordinates('addr-2', cache, { geocode, sleep })
    expect(result).toEqual({ coords: { lat: 1, lon: 2 }, cacheDirty: true })
    expect(sleepCalls).toHaveLength(2)
  })

  it('does not call geocode or sleep on a cache hit', async () => {
    const cache = { 'addr-1': { lat: 1, lon: 2 } }
    const geocode = vi.fn()
    const sleep = vi.fn()

    const result = await resolveCoordinates('addr-1', cache, { geocode, sleep })

    expect(result).toEqual({ coords: { lat: 1, lon: 2 }, cacheDirty: false })
    expect(geocode).not.toHaveBeenCalled()
    expect(sleep).not.toHaveBeenCalled()
  })

  it('does not cache a failed lookup, so it is retried on the next run', async () => {
    const cache = {}
    const geocode = vi.fn().mockRejectedValueOnce(new Error('network error'))
    const sleep = vi.fn().mockResolvedValue(undefined)

    await expect(
      resolveCoordinates('addr-1', cache, { geocode, sleep })
    ).rejects.toThrow('network error')
    expect(cache).not.toHaveProperty('addr-1')
  })
})
