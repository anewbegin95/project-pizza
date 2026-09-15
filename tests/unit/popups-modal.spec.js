const { getEntryId, findEntry, isPlainLeftClick, RETURN_LABEL } = require('../../resources/js/popups-modal.js')

describe('getEntryId', () => {
  it('reads the id a card links to', () => {
    expect(getEntryId('pop-up.html?id=flavia')).toBe('flavia')
  })

  it('decodes an escaped id', () => {
    expect(getEntryId('pop-up.html?id=flavia%20lounge')).toBe('flavia lounge')
  })

  it('finds the id among other parameters', () => {
    expect(getEntryId('pop-up.html?redesign=on&id=flavia')).toBe('flavia')
    expect(getEntryId('pop-up.html?id=flavia&redesign=on')).toBe('flavia')
  })

  it('does not match a parameter that merely ends in id', () => {
    expect(getEntryId('pop-up.html?venueid=flavia')).toBeNull()
  })

  it('returns null when there is nothing to read', () => {
    expect(getEntryId('pop-up.html')).toBeNull()
    expect(getEntryId('')).toBeNull()
    expect(getEntryId(null)).toBeNull()
  })
})

describe('findEntry', () => {
  const entries = [{ id: 'flavia' }, { id: 'chelsea' }]

  it('finds the matching entry', () => {
    expect(findEntry(entries, 'chelsea')).toBe(entries[1])
  })

  it('returns null for an unknown or missing id', () => {
    expect(findEntry(entries, 'nope')).toBeNull()
    expect(findEntry(entries, null)).toBeNull()
    expect(findEntry(undefined, 'flavia')).toBeNull()
  })
})

describe('isPlainLeftClick', () => {
  const click = (overrides = {}) => ({
    button: 0,
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    defaultPrevented: false,
    ...overrides,
  })

  it('accepts an ordinary left click', () => {
    expect(isPlainLeftClick(click())).toBe(true)
  })

  it.each([
    ['middle click', { button: 1 }],
    ['cmd-click', { metaKey: true }],
    ['ctrl-click', { ctrlKey: true }],
    ['shift-click', { shiftKey: true }],
    ['alt-click', { altKey: true }],
  ])('leaves %s to the browser', (_label, overrides) => {
    // These all mean "open this link some other way", which is why the card
    // stays a real anchor rather than becoming a button.
    expect(isPlainLeftClick(click(overrides))).toBe(false)
  })

  it('ignores a click something else already handled', () => {
    expect(isPlainLeftClick(click({ defaultPrevented: true }))).toBe(false)
  })
})

describe('return label', () => {
  it('names the page being returned to, per section 6.5', () => {
    expect(RETURN_LABEL).toBe('Return to all pop-ups')
  })
})
