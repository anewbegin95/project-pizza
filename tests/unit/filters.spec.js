const fs = require('node:fs')
const path = require('node:path')

const {
  FILTER_SETS,
  createFilterState,
  selectOption,
  clearFilter,
  clearAll,
  isAnyActive,
  getActiveCount,
  getResultsCountText,
  getChipLabel,
} = require('../../resources/js/filters.js')

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

describe('filter sets', () => {
  it('gives pop-ups its four filters, including the dates slot', () => {
    expect(FILTER_SETS.popups).toEqual(['borough', 'neighborhood', 'type', 'dates'])
  })

  it('gives date ideas vibe and budget instead, with no dates filter', () => {
    expect(FILTER_SETS['date-ideas']).toEqual(['vibe', 'budget', 'neighborhood'])
  })
})

describe('filter state', () => {
  it('starts with every filter unset', () => {
    const state = createFilterState(FILTER_SETS.popups)
    expect(state).toEqual({ borough: null, neighborhood: null, type: null, dates: null })
    expect(isAnyActive(state)).toBe(false)
    expect(getActiveCount(state)).toBe(0)
  })

  it('records a selection without touching the other filters', () => {
    const state = selectOption(createFilterState(FILTER_SETS.popups), 'borough', 'brooklyn')
    expect(state.borough).toBe('brooklyn')
    expect(state.type).toBeNull()
    expect(isAnyActive(state)).toBe(true)
  })

  it('clears the filter when the selected option is chosen again', () => {
    let state = selectOption(createFilterState(FILTER_SETS.popups), 'borough', 'brooklyn')
    state = selectOption(state, 'borough', 'brooklyn')
    expect(state.borough).toBeNull()
    expect(isAnyActive(state)).toBe(false)
  })

  it('replaces the value when a different option is chosen', () => {
    let state = selectOption(createFilterState(FILTER_SETS.popups), 'borough', 'brooklyn')
    state = selectOption(state, 'borough', 'queens')
    expect(state.borough).toBe('queens')
    expect(getActiveCount(state)).toBe(1)
  })

  it('ignores filters that are not part of the page set', () => {
    const state = selectOption(createFilterState(FILTER_SETS['date-ideas']), 'type', 'market')
    expect(state).toEqual({ vibe: null, budget: null, neighborhood: null })
  })

  it('does not mutate the state it is given', () => {
    const original = createFilterState(FILTER_SETS.popups)
    selectOption(original, 'borough', 'bronx')
    expect(original.borough).toBeNull()
  })

  it('clears one filter and leaves the rest alone', () => {
    let state = selectOption(createFilterState(FILTER_SETS.popups), 'borough', 'bronx')
    state = selectOption(state, 'type', 'beauty')
    state = clearFilter(state, 'borough')
    expect(state.borough).toBeNull()
    expect(state.type).toBe('beauty')
  })

  it('clears everything at once', () => {
    let state = selectOption(createFilterState(FILTER_SETS.popups), 'borough', 'bronx')
    state = selectOption(state, 'type', 'music')
    state = clearAll(state)
    expect(isAnyActive(state)).toBe(false)
    expect(Object.keys(state)).toEqual(FILTER_SETS.popups)
  })
})

describe('chip labels', () => {
  it('shows the filter name when nothing is selected', () => {
    expect(getChipLabel('Borough', null)).toBe('Borough')
  })

  it('shows the selected option label when one is chosen', () => {
    expect(getChipLabel('Borough', 'Brooklyn')).toBe('Brooklyn')
  })
})

describe('getResultsCountText', () => {
  it('pluralizes the count', () => {
    expect(getResultsCountText(16)).toBe('16 events found')
    expect(getResultsCountText(0)).toBe('0 events found')
  })

  it('uses the singular for exactly one result', () => {
    expect(getResultsCountText(1)).toBe('1 event found')
  })

  it('accepts a custom noun for date ideas', () => {
    expect(getResultsCountText(3, 'date idea')).toBe('3 date ideas found')
    expect(getResultsCountText(1, 'date idea')).toBe('1 date idea found')
  })
})

describe('filter styles', () => {
  const css = read('resources/css/filters.css')

  it('hides the filter bar and results count by default', () => {
    expectCssToMatch(css, '.filter-bar, .results-count { display: none; }')
  })

  it('gates the layout behind the redesign flag scope', () => {
    expectCssToMatch(css, ":root[data-redesign='on'] .filter-bar")
    expectCssToMatch(css, 'body.redesign-enabled .filter-bar')
  })

  it('wraps chips rather than overflowing', () => {
    expectCssToMatch(css, 'flex-wrap: wrap;')
  })

  it('styles the dropdown as an elevated card with the selected row highlighted', () => {
    expectCssToMatch(css, 'box-shadow: var(--shadow-lg);')
    expectCssToMatch(css, 'background-color: var(--nyc-light-pink);')
  })
})

describe('filter markup', () => {
  const popupsHtml = read('pop-ups.html')
  const dateIdeasHtml = read('date-ideas.html')

  it('marks each page with its filter set', () => {
    expect(popupsHtml).toContain('data-filter-page="popups"')
    expect(dateIdeasHtml).toContain('data-filter-page="date-ideas"')
  })

  it('gives pop-ups borough, neighborhood, type and an inert dates chip', () => {
    for (const filter of ['borough', 'neighborhood', 'type', 'dates']) {
      expect(popupsHtml).toContain(`data-filter="${filter}"`)
    }
  })

  it('gives date ideas vibe and budget but no dates chip', () => {
    expect(dateIdeasHtml).toContain('data-filter="vibe"')
    expect(dateIdeasHtml).toContain('data-filter="budget"')
    expect(dateIdeasHtml).not.toContain('data-filter="dates"')
    expect(dateIdeasHtml).not.toContain('data-filter="type"')
  })

  it('offers the schema category values, including beauty, on the type filter', () => {
    for (const value of ['food_drink', 'market', 'art_culture', 'beauty', 'vintage_thrift']) {
      expect(popupsHtml).toContain(`data-value="${value}"`)
    }
  })

  it('offers the schema vibe and budget values on date ideas', () => {
    for (const value of ['romantic', 'chill', 'under_30', '75_plus']) {
      expect(dateIdeasHtml).toContain(`data-value="${value}"`)
    }
  })

  it('exposes chips as listbox triggers and starts them collapsed', () => {
    expect(popupsHtml).toContain('aria-haspopup="listbox"')
    expect(popupsHtml).toContain('aria-expanded="false"')
    expect(popupsHtml).toContain('role="listbox"')
    expect(popupsHtml).toContain('role="option"')
  })

  it('ships clear-all hidden until a filter is active', () => {
    expect(popupsHtml).toMatch(/class="[^"]*filter-bar__clear[^"]*"[^>]*hidden/)
  })

  it('announces result counts politely', () => {
    expect(popupsHtml).toContain('class="results-count"')
    expect(popupsHtml).toContain('aria-live="polite"')
  })

  it('links the filter stylesheet and script on both pages', () => {
    for (const html of [popupsHtml, dateIdeasHtml]) {
      expect(html).toContain('<link rel="stylesheet" href="resources/css/filters.css">')
      expect(html).toContain('<script src="resources/js/filters.js" defer></script>')
    }
  })
})
