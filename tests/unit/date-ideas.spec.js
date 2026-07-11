const { mapSanityDateIdea } = require('../../resources/js/date-ideas.js')

describe('mapSanityDateIdea (client-side)', () => {
  it('passes through the redesign taxonomy fields from the Sanity item', () => {
    const item = {
      name: 'Rooftop Dinner',
      slug: 'rooftop-dinner',
      vibe: 'romantic',
      budget: '30_to_75',
      borough: 'manhattan',
      neighborhood: 'Chelsea',
      venue_name: 'Sky Terrace',
      address: '456 W 23rd St, New York, NY',
      price: '$40 per person',
      is_featured: true,
      display_overall: true,
    }

    const result = mapSanityDateIdea(item, 0)

    expect(result.vibe).toBe('romantic')
    expect(result.budget).toBe('30_to_75')
    expect(result.borough).toBe('manhattan')
    expect(result.neighborhood).toBe('Chelsea')
    expect(result.venue_name).toBe('Sky Terrace')
    expect(result.address).toBe('456 W 23rd St, New York, NY')
    expect(result.price).toBe('$40 per person')
    expect(result.is_featured).toBe(true)
    expect(result.master_display).toBe('TRUE')
  })

  it('defaults the taxonomy fields when absent', () => {
    const result = mapSanityDateIdea({ name: 'No Taxonomy Yet' }, 1)

    expect(result.vibe).toBe('')
    expect(result.budget).toBe('')
    expect(result.borough).toBe('')
    expect(result.neighborhood).toBe('')
    expect(result.venue_name).toBe('')
    expect(result.address).toBe('')
    expect(result.price).toBe('')
    expect(result.is_featured).toBe(false)
  })
})
