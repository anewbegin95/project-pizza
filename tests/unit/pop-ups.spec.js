const { mapSanityPopup } = require('../../resources/js/pop-ups.js')

describe('mapSanityPopup (client-side)', () => {
  it('passes through latitude and longitude from the Sanity item', () => {
    const item = {
      name: 'Test Pop-Up',
      slug: 'test-pop-up',
      latitude: 40.7484421,
      longitude: -73.9856589,
    }

    const result = mapSanityPopup(item)

    expect(result.latitude).toBe(40.7484421)
    expect(result.longitude).toBe(-73.9856589)
  })

  it('defaults latitude and longitude to null when absent', () => {
    const result = mapSanityPopup({ name: 'No Coords Yet' })

    expect(result.latitude).toBeNull()
    expect(result.longitude).toBeNull()
  })
})
