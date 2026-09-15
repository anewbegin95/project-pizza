const fs = require('node:fs')
const path = require('node:path')

const {
  addMonths,
  getMonthGrid,
  getMonthLabel,
  selectRangeDate,
  isInRange,
  isRangeEdge,
  formatRangeLabel,
  toRangeValue,
} = require('../../resources/js/date-picker.js')

const projectRoot = path.resolve(__dirname, '..', '..')

function read(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), 'utf8')
}

function expectCssToMatch(css, pattern) {
  const regexSpecialCharacters = new Set(['\\', '^', '$', '.', '*', '+', '?', '(', ')', '[', ']', '{', '}', '|'])
  const escapedPattern = [...pattern]
    .map((character) => (regexSpecialCharacters.has(character) ? `\\${character}` : character))
    .join('')
  expect(css).toMatch(new RegExp(escapedPattern.replaceAll(/\s+/g, '\\s*')))
}

describe('addMonths', () => {
  it('moves forward and backward within a year', () => {
    expect(addMonths({ year: 2026, month: 6 }, 1)).toEqual({ year: 2026, month: 7 })
    expect(addMonths({ year: 2026, month: 6 }, -1)).toEqual({ year: 2026, month: 5 })
  })

  it('rolls over the year boundary in both directions', () => {
    expect(addMonths({ year: 2026, month: 11 }, 1)).toEqual({ year: 2027, month: 0 })
    expect(addMonths({ year: 2026, month: 0 }, -1)).toEqual({ year: 2025, month: 11 })
  })
})

describe('getMonthGrid', () => {
  it('lays July 2026 out in whole weeks starting on Sunday', () => {
    const grid = getMonthGrid(2026, 6)

    expect(grid.length % 7).toBe(0)
    expect(grid[0].weekday).toBe(0)
    // 1 July 2026 is a Wednesday, so the row starts with three trailing June days.
    expect(grid.slice(0, 3).every((cell) => !cell.inMonth)).toBe(true)
    expect(grid[3]).toEqual(expect.objectContaining({ iso: '2026-07-01', day: 1, inMonth: true }))
  })

  it('covers every day of the month exactly once', () => {
    const inMonth = getMonthGrid(2026, 6).filter((cell) => cell.inMonth)
    expect(inMonth).toHaveLength(31)
    expect(inMonth[30].iso).toBe('2026-07-31')
  })

  it('handles a leap February', () => {
    const inMonth = getMonthGrid(2028, 1).filter((cell) => cell.inMonth)
    expect(inMonth).toHaveLength(29)
    expect(inMonth[28].iso).toBe('2028-02-29')
  })

  it('labels the month for the calendar heading', () => {
    expect(getMonthLabel(2026, 6)).toBe('July 2026')
    expect(getMonthLabel(2027, 0)).toBe('January 2027')
  })
})

describe('selectRangeDate', () => {
  const empty = { start: null, end: null }

  it('sets the start on the first pick', () => {
    expect(selectRangeDate(empty, '2026-07-15')).toEqual({ start: '2026-07-15', end: null })
  })

  it('completes the range on the second pick', () => {
    const range = selectRangeDate({ start: '2026-07-15', end: null }, '2026-07-22')
    expect(range).toEqual({ start: '2026-07-15', end: '2026-07-22' })
  })

  it('swaps the ends when the second pick is earlier', () => {
    const range = selectRangeDate({ start: '2026-07-22', end: null }, '2026-07-15')
    expect(range).toEqual({ start: '2026-07-15', end: '2026-07-22' })
  })

  it('treats picking the start again as a single-day range', () => {
    const range = selectRangeDate({ start: '2026-07-15', end: null }, '2026-07-15')
    expect(range).toEqual({ start: '2026-07-15', end: '2026-07-15' })
  })

  it('starts over once a full range exists', () => {
    const range = selectRangeDate({ start: '2026-07-15', end: '2026-07-22' }, '2026-08-03')
    expect(range).toEqual({ start: '2026-08-03', end: null })
  })

  it('does not mutate the range it is given', () => {
    const original = { start: '2026-07-15', end: null }
    selectRangeDate(original, '2026-07-22')
    expect(original).toEqual({ start: '2026-07-15', end: null })
  })
})

describe('isInRange and isRangeEdge', () => {
  const range = { start: '2026-07-15', end: '2026-07-22' }

  it('includes both ends and the days between', () => {
    expect(isInRange('2026-07-15', range)).toBe(true)
    expect(isInRange('2026-07-18', range)).toBe(true)
    expect(isInRange('2026-07-22', range)).toBe(true)
  })

  it('excludes days outside the range', () => {
    expect(isInRange('2026-07-14', range)).toBe(false)
    expect(isInRange('2026-07-23', range)).toBe(false)
  })

  it('treats an incomplete range as covering only its start', () => {
    const partial = { start: '2026-07-15', end: null }
    expect(isInRange('2026-07-15', partial)).toBe(true)
    expect(isInRange('2026-07-16', partial)).toBe(false)
  })

  it('identifies the edges so they can be rounded', () => {
    expect(isRangeEdge('2026-07-15', range)).toBe(true)
    expect(isRangeEdge('2026-07-22', range)).toBe(true)
    expect(isRangeEdge('2026-07-18', range)).toBe(false)
  })
})

describe('formatRangeLabel', () => {
  it('is empty when nothing is picked, so the chip keeps its own label', () => {
    expect(formatRangeLabel({ start: null, end: null })).toBe('')
  })

  it('shows a single date for one day', () => {
    expect(formatRangeLabel({ start: '2026-07-15', end: null })).toBe('Jul 15')
    expect(formatRangeLabel({ start: '2026-07-15', end: '2026-07-15' })).toBe('Jul 15')
  })

  it('shows both ends for a span', () => {
    expect(formatRangeLabel({ start: '2026-07-15', end: '2026-07-22' })).toBe('Jul 15 – Jul 22')
  })

  it('includes the year when a span crosses into the next one', () => {
    expect(formatRangeLabel({ start: '2026-12-28', end: '2027-01-04' })).toBe(
      'Dec 28, 2026 – Jan 4, 2027'
    )
  })
})

describe('toRangeValue', () => {
  it('serialises a range for the filter state', () => {
    expect(toRangeValue({ start: '2026-07-15', end: '2026-07-22' })).toBe('2026-07-15..2026-07-22')
    expect(toRangeValue({ start: '2026-07-15', end: null })).toBe('2026-07-15')
    expect(toRangeValue({ start: null, end: null })).toBeNull()
  })
})

describe('date picker styles', () => {
  const css = read('resources/css/filters.css')

  it('shows two months side by side on desktop', () => {
    expectCssToMatch(css, '.date-picker__months')
    expectCssToMatch(css, 'grid-template-columns: repeat(2, 1fr);')
  })

  it('stacks the months on mobile', () => {
    expectCssToMatch(css, '.date-picker')
    expectCssToMatch(css, 'grid-template-columns: 1fr;')
  })

  it('circles today and highlights the selected range', () => {
    expectCssToMatch(css, '.date-picker__day--today')
    expectCssToMatch(css, 'background-color: var(--nyc-pink);')
    expectCssToMatch(css, '.date-picker__day--in-range')
    expectCssToMatch(css, 'background-color: var(--nyc-light-pink);')
  })

  it('gives the footer a plain Clear and a green Done', () => {
    expectCssToMatch(css, '.date-picker__footer')
    expectCssToMatch(css, '.date-picker__done')
    expectCssToMatch(css, 'background-color: var(--nyc-green);')
  })
})
