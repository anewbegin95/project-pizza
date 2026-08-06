const fs = require('node:fs')
const path = require('node:path')

const {
  VIEWS,
  isValidView,
  getNextToggleState,
  applyToggleState,
  normalizeSearchInput,
} = require('../../resources/js/search.js')

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

/** Minimal stand-in for a toggle button element. */
function createButtonStub(view, active) {
  const classes = new Set(['view-toggle__btn'])
  if (active) classes.add('view-toggle__btn--active')
  const attributes = new Map([['aria-pressed', String(Boolean(active))]])
  return {
    dataset: { view },
    classList: {
      add: (name) => classes.add(name),
      remove: (name) => classes.delete(name),
      contains: (name) => classes.has(name),
    },
    setAttribute: (name, value) => attributes.set(name, String(value)),
    getAttribute: (name) => (attributes.has(name) ? attributes.get(name) : null),
  }
}

describe('view toggle state', () => {
  it('exposes the two views specified by the redesign', () => {
    expect(VIEWS).toEqual(['list', 'map'])
  })

  it('accepts only known view names', () => {
    expect(isValidView('list')).toBe(true)
    expect(isValidView('map')).toBe(true)
    expect(isValidView('calendar')).toBe(false)
    expect(isValidView(undefined)).toBe(false)
  })

  it('switches to the requested view and reports the change', () => {
    expect(getNextToggleState('list', 'map')).toEqual({ view: 'map', changed: true })
  })

  it('is a no-op when the active view is requested again', () => {
    expect(getNextToggleState('map', 'map')).toEqual({ view: 'map', changed: false })
  })

  it('ignores unknown view names and keeps the current view', () => {
    expect(getNextToggleState('list', 'calendar')).toEqual({ view: 'list', changed: false })
  })

  it('applies the active class and aria-pressed to the selected button only', () => {
    const listButton = createButtonStub('list', true)
    const mapButton = createButtonStub('map', false)

    applyToggleState([listButton, mapButton], 'map')

    expect(mapButton.classList.contains('view-toggle__btn--active')).toBe(true)
    expect(mapButton.getAttribute('aria-pressed')).toBe('true')
    expect(listButton.classList.contains('view-toggle__btn--active')).toBe(false)
    expect(listButton.getAttribute('aria-pressed')).toBe('false')
  })
})

describe('normalizeSearchInput', () => {
  it('trims and collapses whitespace and lowercases for matching', () => {
    expect(normalizeSearchInput('  Chelsea   Market ')).toBe('chelsea market')
  })

  it('returns an empty string for blank or missing values', () => {
    expect(normalizeSearchInput('   ')).toBe('')
    expect(normalizeSearchInput(undefined)).toBe('')
  })
})

describe('search and view-toggle styles', () => {
  const css = read('resources/css/search.css')

  it('hides the search container by default so the flag-off page is unchanged', () => {
    expectCssToMatch(css, '.search-bar-container { display: none; }')
  })

  it('gates the layout behind the redesign flag scope', () => {
    expectCssToMatch(css, ":root[data-redesign='on'] .search-bar-container")
    expectCssToMatch(css, 'body.redesign-enabled .search-bar-container')
  })

  it('lays the container out per the redesign spec', () => {
    expectCssToMatch(css, 'display: flex;')
    expectCssToMatch(css, 'gap: 12px;')
  })

  it('styles the active toggle button with the redesign green', () => {
    expectCssToMatch(css, 'background-color: var(--nyc-green);')
    expectCssToMatch(css, 'color: var(--nyc-white);')
  })
})

describe('search and view-toggle markup', () => {
  const popupsHtml = read('pop-ups.html')
  const dateIdeasHtml = read('date-ideas.html')

  it('adds the search bar to both discovery pages', () => {
    for (const html of [popupsHtml, dateIdeasHtml]) {
      expect(html).toContain('class="search-bar-container"')
      expect(html).toContain('placeholder="Search events, venues, neighborhoods..."')
      expect(html).toContain('type="search"')
    }
  })

  it('renders the List/Map toggle on pop-ups only', () => {
    expect(popupsHtml).toContain('class="view-toggle"')
    expect(popupsHtml).toContain('data-view="list"')
    expect(popupsHtml).toContain('data-view="map"')
    expect(popupsHtml).not.toContain('data-view="calendar"')
    expect(dateIdeasHtml).not.toContain('class="view-toggle"')
  })

  it('labels the toggle group and the search input for assistive tech', () => {
    expect(popupsHtml).toContain('role="group"')
    expect(popupsHtml).toMatch(/aria-label="View mode"/)
    expect(popupsHtml).toMatch(/aria-label="Search events, venues, and neighborhoods"/)
  })

  it('links the search stylesheet and script on both pages', () => {
    for (const html of [popupsHtml, dateIdeasHtml]) {
      expect(html).toContain('<link rel="stylesheet" href="resources/css/search.css">')
      expect(html).toContain('<script src="resources/js/search.js" defer></script>')
    }
  })
})
