const {
  assignBarRows,
  getEventDays,
  groupByDay,
  getMonthRange,
  canGoPrev,
  canGoNext,
  countInMonth,
  getCellEvents,
  getWeekSegments,
  MAX_VISIBLE,
} = require('../../resources/js/popups-calendar.js')

const { getMonthGrid } = require('../../resources/js/date-picker.js')

/** Minimal mapped pop-up — the shape mapSanityPopup produces. */
function popup(overrides) {
  return { id: 'x', name: 'Event', category: 'market', ...overrides }
}

describe('which days an event covers', () => {
  it('places a single-day event on its own day', () => {
    const entry = popup({ start_datetime: '2026-08-25T17:00:00Z', end_datetime: '2026-08-25T21:00:00Z' })

    expect(getEventDays(entry)).toEqual(['2026-08-25'])
  })

  it('covers every day of a multi-day run, inclusive of both ends', () => {
    const entry = popup({ start_datetime: '2026-08-03T15:00:00Z', end_datetime: '2026-08-06T23:00:00Z' })

    expect(getEventDays(entry)).toEqual(['2026-08-03', '2026-08-04', '2026-08-05', '2026-08-06'])
  })

  it('reads days in New York time, not UTC', () => {
    // 22:00Z is 6pm the same evening in New York. Reading this in UTC would be
    // right here but wrong for the end below, so both go through the zone.
    const entry = popup({ start_datetime: '2026-08-12T22:00:00Z', end_datetime: '2026-08-13T03:00:00Z' })

    // Ends 11pm ET on the 12th — one day, despite crossing midnight UTC.
    expect(getEventDays(entry)).toEqual(['2026-08-12'])
  })

  it('does not shift an all-day event to the previous day', () => {
    // The recurring trap: new Date('2026-08-25') is UTC midnight, i.e. the
    // evening of the 24th in New York.
    const entry = popup({ start_datetime: '2026-08-25', end_datetime: '2026-08-26' })

    expect(getEventDays(entry)).toEqual(['2026-08-25', '2026-08-26'])
  })

  it('treats a missing end as a single day', () => {
    expect(getEventDays(popup({ start_datetime: '2026-08-25T17:00:00Z' }))).toEqual(['2026-08-25'])
  })

  it('ignores an end that precedes its start rather than looping', () => {
    const entry = popup({ start_datetime: '2026-08-25T17:00:00Z', end_datetime: '2026-08-20T17:00:00Z' })

    expect(getEventDays(entry)).toEqual(['2026-08-25'])
  })

  it('covers no days when the entry has no date', () => {
    expect(getEventDays(popup({}))).toEqual([])
    expect(getEventDays(null)).toEqual([])
  })

  it('spans a month boundary', () => {
    const entry = popup({ start_datetime: '2026-08-30T15:00:00Z', end_datetime: '2026-09-01T20:00:00Z' })

    expect(getEventDays(entry)).toEqual(['2026-08-30', '2026-08-31', '2026-09-01'])
  })
})

describe('grouping entries by day', () => {
  const market = popup({ id: 'market', start_datetime: '2026-08-12T18:00:00Z' })
  const fair = popup({ id: 'fair', start_datetime: '2026-08-12T20:00:00Z' })
  const run = popup({ id: 'run', start_datetime: '2026-08-11T15:00:00Z', end_datetime: '2026-08-12T21:00:00Z' })

  it('keys entries by every day they cover', () => {
    const byDay = groupByDay([market, fair, run])

    expect(byDay.get('2026-08-12').map((e) => e.id)).toEqual(['market', 'fair', 'run'])
    expect(byDay.get('2026-08-11').map((e) => e.id)).toEqual(['run'])
  })

  it('leaves days with nothing on them absent rather than empty', () => {
    expect(groupByDay([market]).has('2026-08-13')).toBe(false)
  })

  it('drops undated entries instead of throwing', () => {
    expect(groupByDay([popup({}), market]).size).toBe(1)
  })
})

describe('how far the month navigation can go', () => {
  const entries = [
    popup({ id: 'first', start_datetime: '2026-02-10T15:00:00Z' }),
    popup({ id: 'mid', start_datetime: '2026-05-16T15:00:00Z' }),
    popup({ id: 'last', start_datetime: '2026-08-30T15:00:00Z', end_datetime: '2026-09-02T15:00:00Z' }),
  ]

  it('runs from the earliest to the latest day any event touches', () => {
    // The last event runs into September, so September is reachable.
    expect(getMonthRange(entries)).toEqual({ first: '2026-02', last: '2026-09' })
  })

  it('has no range when nothing is dated', () => {
    expect(getMonthRange([])).toBe(null)
    expect(getMonthRange([popup({})])).toBe(null)
  })

  it('stops at the ends rather than paging into empty months forever', () => {
    const range = getMonthRange(entries)

    expect(canGoPrev('2026-02', range)).toBe(false)
    expect(canGoPrev('2026-03', range)).toBe(true)
    expect(canGoNext('2026-09', range)).toBe(false)
    expect(canGoNext('2026-08', range)).toBe(true)
  })

  it('allows no movement at all when there is no range', () => {
    expect(canGoPrev('2026-08', null)).toBe(false)
    expect(canGoNext('2026-08', null)).toBe(false)
  })
})

describe('the count line for a month', () => {
  const entries = [
    popup({ id: 'a', start_datetime: '2026-08-12T18:00:00Z' }),
    popup({ id: 'b', start_datetime: '2026-08-30T15:00:00Z', end_datetime: '2026-09-02T15:00:00Z' }),
    popup({ id: 'c', start_datetime: '2026-09-05T15:00:00Z' }),
  ]

  it('counts each event once however many days it covers', () => {
    // 'b' runs 30 Aug - 2 Sep: four days, one event, and it counts in both months.
    expect(countInMonth(entries, '2026-08')).toBe(2)
    expect(countInMonth(entries, '2026-09')).toBe(2)
  })

  it('is zero for a month nothing touches', () => {
    expect(countInMonth(entries, '2026-07')).toBe(0)
  })
})

describe('what fits in a day cell', () => {
  const five = ['a', 'b', 'c', 'd', 'e'].map((id) => popup({ id, start_datetime: '2026-08-12T18:00:00Z' }))

  it('shows up to the cap and reports the rest as overflow', () => {
    const { visible, overflow } = getCellEvents(five, 3)

    expect(visible.map((e) => e.id)).toEqual(['a', 'b', 'c'])
    expect(overflow).toBe(2)
  })

  it('has no overflow when everything fits', () => {
    const { visible, overflow } = getCellEvents(five.slice(0, 2), 3)

    expect(visible).toHaveLength(2)
    expect(overflow).toBe(0)
  })

  it('caps at four on desktop and two on mobile, matching the legacy calendar', () => {
    expect(MAX_VISIBLE).toEqual({ desktop: 4, mobile: 2 })
  })

  it('copes with a day that has nothing on it', () => {
    expect(getCellEvents(undefined, 3)).toEqual({ visible: [], overflow: 0 })
  })
})

describe('multi-day bars within a week row', () => {
  // August 2026 starts on a Saturday, so the second row is Sun 2 - Sat 8.
  const week = getMonthGrid(2026, 7).slice(7, 14)

  it('places a run at its starting column with the right span', () => {
    // Mon 3 - Thu 6 is columns 1..4 of that row.
    const entry = popup({ id: 'run', start_datetime: '2026-08-03T15:00:00Z', end_datetime: '2026-08-06T23:00:00Z' })

    expect(getWeekSegments([entry], week)).toEqual([
      { entry, startColumn: 1, span: 4, continuesBefore: false, continuesAfter: false },
    ])
  })

  it('clips a run that started in an earlier week and says so', () => {
    // 30 Jul - 4 Aug: this row sees only Sun 2 - Tue 4.
    const entry = popup({ id: 'run', start_datetime: '2026-07-30T15:00:00Z', end_datetime: '2026-08-04T23:00:00Z' })

    expect(getWeekSegments([entry], week)).toEqual([
      { entry, startColumn: 0, span: 3, continuesBefore: true, continuesAfter: false },
    ])
  })

  it('clips a run that carries into the next week and says so', () => {
    const entry = popup({ id: 'run', start_datetime: '2026-08-06T15:00:00Z', end_datetime: '2026-08-11T23:00:00Z' })

    expect(getWeekSegments([entry], week)).toEqual([
      { entry, startColumn: 4, span: 3, continuesBefore: false, continuesAfter: true },
    ])
  })

  it('leaves single-day events to the cells, which render them as chips', () => {
    const entry = popup({ start_datetime: '2026-08-05T15:00:00Z' })

    expect(getWeekSegments([entry], week)).toEqual([])
  })

  it('returns nothing for a week no run touches', () => {
    const entry = popup({ start_datetime: '2026-08-17T15:00:00Z', end_datetime: '2026-08-21T23:00:00Z' })

    expect(getWeekSegments([entry], week)).toEqual([])
  })
})

describe('stacking bars within a week row', () => {
  const segment = (startColumn, span, id) => ({
    entry: popup({ id }),
    startColumn,
    span,
    continuesBefore: false,
    continuesAfter: false,
  })

  it('puts runs that share no columns on the same row', () => {
    const { segments, rows } = assignBarRows([segment(0, 2, 'a'), segment(3, 2, 'b')])

    expect(segments.map((s) => s.row)).toEqual([0, 0])
    expect(rows).toBe(1)
  })

  it('stacks runs that overlap so neither is drawn over the other', () => {
    const { segments, rows } = assignBarRows([segment(0, 4, 'a'), segment(2, 3, 'b')])

    expect(segments.map((s) => s.row)).toEqual([0, 1])
    expect(rows).toBe(2)
  })

  it('reuses the lowest free row rather than always adding one', () => {
    // c overlaps a but not b, so it drops back to row 1 beside b.
    const { segments, rows } = assignBarRows([segment(0, 7, 'a'), segment(0, 2, 'b'), segment(3, 2, 'c')])

    expect(segments.map((s) => s.row)).toEqual([0, 1, 1])
    expect(rows).toBe(2)
  })

  it('treats runs that merely touch as non-overlapping', () => {
    // a covers columns 0-1, b starts at 2.
    const { segments } = assignBarRows([segment(0, 2, 'a'), segment(2, 2, 'b')])

    expect(segments.map((s) => s.row)).toEqual([0, 0])
  })

  it('has no rows for a week with no runs', () => {
    expect(assignBarRows([])).toEqual({ segments: [], rows: 0 })
  })
})
