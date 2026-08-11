const { groupByMonth, getMonthKey, formatMonthHeading } = require('../../resources/js/popups-list.js')

const popup = (id, start, extra = {}) => ({ id, name: id, start_datetime: start, ...extra })

describe('getMonthKey', () => {
  it('keys an entry by the month its start date falls in', () => {
    expect(getMonthKey(popup('a', '2026-08-13T15:00:00.000Z'))).toBe('2026-08')
  })

  it('anchors date-only values at noon UTC so the month never slips', () => {
    // new Date('2026-09-01') is UTC midnight, i.e. 31 August in New York, which
    // would file an all-day event under the wrong month heading.
    expect(getMonthKey(popup('a', '2026-09-01'))).toBe('2026-09')
    expect(getMonthKey(popup('b', '2026-08-31'))).toBe('2026-08')
  })

  it('keeps a late-evening event in its own Eastern month', () => {
    // 1 Sep 01:00 UTC is 31 Aug 21:00 in New York.
    expect(getMonthKey(popup('a', '2026-09-01T01:00:00.000Z'))).toBe('2026-08')
  })

  it('returns null for an entry with no usable date', () => {
    expect(getMonthKey(popup('a', ''))).toBeNull()
    expect(getMonthKey(popup('a', 'not-a-date'))).toBeNull()
  })
})

describe('formatMonthHeading', () => {
  it('reads as month and year', () => {
    expect(formatMonthHeading('2026-08')).toBe('August 2026')
    expect(formatMonthHeading('2027-01')).toBe('January 2027')
  })
})

describe('groupByMonth', () => {
  it('returns one group per month, in chronological order', () => {
    const groups = groupByMonth([
      popup('sept', '2026-09-05T14:00:00.000Z'),
      popup('aug-early', '2026-08-13T15:00:00.000Z'),
      popup('aug-late', '2026-08-22T14:00:00.000Z'),
    ])

    expect(groups.map((group) => group.key)).toEqual(['2026-08', '2026-09'])
    expect(groups[0].label).toBe('August 2026')
    expect(groups[0].items.map((item) => item.id)).toEqual(['aug-early', 'aug-late'])
    expect(groups[1].items.map((item) => item.id)).toEqual(['sept'])
  })

  it('orders entries within a month by start date', () => {
    const groups = groupByMonth([
      popup('later', '2026-08-22T14:00:00.000Z'),
      popup('earlier', '2026-08-03T14:00:00.000Z'),
    ])
    expect(groups[0].items.map((item) => item.id)).toEqual(['earlier', 'later'])
  })

  it('files a multi-month run under the month it starts in', () => {
    const groups = groupByMonth([
      popup('run', '2026-08-28T14:00:00.000Z', { end_datetime: '2026-10-02T14:00:00.000Z' }),
    ])
    expect(groups).toHaveLength(1)
    expect(groups[0].key).toBe('2026-08')
  })

  it('keeps featured entries in date order rather than hoisting them', () => {
    const groups = groupByMonth([
      popup('plain', '2026-08-03T14:00:00.000Z'),
      popup('featured', '2026-08-20T14:00:00.000Z', { is_featured: true }),
    ])
    expect(groups[0].items.map((item) => item.id)).toEqual(['plain', 'featured'])
  })

  it('collects undated entries into a trailing group with no heading', () => {
    const groups = groupByMonth([popup('undated', ''), popup('dated', '2026-08-03T14:00:00.000Z')])

    expect(groups.map((group) => group.key)).toEqual(['2026-08', null])
    expect(groups[1].label).toBe('')
    expect(groups[1].items.map((item) => item.id)).toEqual(['undated'])
  })

  it('returns nothing for an empty list', () => {
    expect(groupByMonth([])).toEqual([])
    expect(groupByMonth(undefined)).toEqual([])
  })

  it('does not mutate the list it is given', () => {
    const list = [popup('b', '2026-09-05T14:00:00.000Z'), popup('a', '2026-08-13T15:00:00.000Z')]
    groupByMonth(list)
    expect(list.map((item) => item.id)).toEqual(['b', 'a'])
  })
})
