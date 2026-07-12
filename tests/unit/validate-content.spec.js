const {
  validateDocs,
  POPUP_REQUIRED_FIELDS,
  DATE_IDEA_REQUIRED_FIELDS,
} = require('../../scripts/validate-content.js')

describe('validateDocs', () => {
  it('reports no gaps for a fully populated document', () => {
    const docs = [
      {
        name: 'Complete Pop-Up',
        category: 'food_drink',
        borough: 'brooklyn',
        neighborhood: 'Williamsburg',
        venue_name: 'Pizza Palace',
        address: '123 Main St, Brooklyn, NY',
        price: 'Free',
        short_description: 'A pop-up.',
        hasImage: true,
      },
    ]
    expect(validateDocs(docs, POPUP_REQUIRED_FIELDS)).toEqual([])
  })

  it('lists each missing, null, or empty required field per document', () => {
    const docs = [
      {
        name: 'Gappy Pop-Up',
        category: null,
        borough: '',
        neighborhood: 'SoHo',
        venue_name: 'Somewhere',
        address: '1 Broadway',
        price: 'Free',
        short_description: 'Teaser.',
        hasImage: true,
      },
    ]
    expect(validateDocs(docs, POPUP_REQUIRED_FIELDS)).toEqual([
      { name: 'Gappy Pop-Up', missing: ['category', 'borough'] },
    ])
  })

  it('treats a false hasImage as a missing image', () => {
    const docs = [{ name: 'No Image Idea', vibe: 'chill', budget: 'free', borough: 'queens', neighborhood: 'Astoria', venue_name: 'Park', address: 'Astoria Park', price: 'Free', short_description: 'Teaser.', hasImage: false }]
    expect(validateDocs(docs, DATE_IDEA_REQUIRED_FIELDS)).toEqual([
      { name: 'No Image Idea', missing: ['hasImage'] },
    ])
  })

  it('validates date ideas against vibe and budget', () => {
    const docs = [
      {
        name: 'Untagged Idea',
        borough: 'manhattan',
        neighborhood: 'Chelsea',
        venue_name: 'Gallery',
        address: '456 W 23rd St',
        price: '$20',
        short_description: 'Teaser.',
        hasImage: true,
      },
    ]
    expect(validateDocs(docs, DATE_IDEA_REQUIRED_FIELDS)).toEqual([
      { name: 'Untagged Idea', missing: ['vibe', 'budget'] },
    ])
  })
})
