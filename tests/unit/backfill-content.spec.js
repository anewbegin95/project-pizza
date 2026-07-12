const { buildPatches } = require('../../scripts/backfill-content.js')

describe('buildPatches', () => {
  const currentDocs = [
    { _id: 'doc1', name: 'Pop-Up A', category: null, borough: 'manhattan', price: '' },
    { _id: 'doc2', name: 'Pop-Up B', category: 'market' },
  ]

  it('sets only fields that are currently missing or empty', () => {
    const proposals = [
      { _id: 'doc1', fields: { category: 'wellness', borough: 'brooklyn', price: 'Free' } },
    ]
    const patches = buildPatches(currentDocs, proposals)
    expect(patches).toEqual([
      { patch: { id: 'doc1', set: { category: 'wellness', price: 'Free' } } },
    ])
  })

  it('never overwrites an already populated field', () => {
    const proposals = [{ _id: 'doc2', fields: { category: 'food_drink' } }]
    expect(buildPatches(currentDocs, proposals)).toEqual([])
  })

  it('throws when a proposal references a document that does not exist', () => {
    const proposals = [{ _id: 'ghost', fields: { category: 'market' } }]
    expect(() => buildPatches(currentDocs, proposals)).toThrow(/ghost/)
  })

  it('skips proposal fields explicitly set to null', () => {
    const proposals = [
      { _id: 'doc1', fields: { category: 'wellness', neighborhood: null } },
    ]
    const patches = buildPatches(currentDocs, proposals)
    expect(patches).toEqual([
      { patch: { id: 'doc1', set: { category: 'wellness' } } },
    ])
  })
})
