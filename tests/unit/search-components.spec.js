const fs = require('node:fs')
const path = require('node:path')

const {
  getRequestedView,
  getToggleViews,
  getInitialView,
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

describe('the views a page offers', () => {
  // The markup is the source of truth: search.js is shared by every redesigned
  // page and must not carry a registry of view names, or adding a view to one
  // page silently claims it on all of them. See #298.
  it('reads the view list off the toggle buttons, in markup order', () => {
    const buttons = [createButtonStub('list', true), createButtonStub('map'), createButtonStub('calendar')]

    expect(getToggleViews(buttons)).toEqual(['list', 'map', 'calendar'])
  })

  it('is empty for a page with no toggle', () => {
    expect(getToggleViews([])).toEqual([])
  })

  it('skips buttons carrying no view name', () => {
    expect(getToggleViews([createButtonStub('list', true), createButtonStub(undefined)])).toEqual(['list'])
  })

  it('starts on the view the markup marks active', () => {
    const buttons = [createButtonStub('list'), createButtonStub('map', true), createButtonStub('calendar')]

    expect(getInitialView(buttons)).toBe('map')
  })

  it('falls back to the first button when the markup marks none active', () => {
    expect(getInitialView([createButtonStub('list'), createButtonStub('map')])).toBe('list')
  })

  it('has no initial view when there is no toggle', () => {
    expect(getInitialView([])).toBe(null)
  })
})

describe('the view asked for in the URL', () => {
  const views = ['list', 'map', 'calendar']

  it('reads a valid view from the query string', () => {
    expect(getRequestedView('?view=calendar', views)).toBe('calendar')
    expect(getRequestedView('?view=map', views)).toBe('map')
  })

  it('ignores a view the page does not offer', () => {
    // ?view=calendar on a page with only List and Map must not strand it on a
    // view it has no button for.
    expect(getRequestedView('?view=calendar', ['list', 'map'])).toBe(null)
    expect(getRequestedView('?view=gallery', views)).toBe(null)
  })

  it('ignores an absent or empty parameter', () => {
    expect(getRequestedView('', views)).toBe(null)
    expect(getRequestedView('?redesign=on', views)).toBe(null)
    expect(getRequestedView('?view=', views)).toBe(null)
  })

  it('is case-insensitive, since the parameter comes from links people share', () => {
    expect(getRequestedView('?view=Calendar', views)).toBe('calendar')
  })

  it('survives a query string it cannot parse', () => {
    expect(getRequestedView(undefined, views)).toBe(null)
    expect(getRequestedView('?view=calendar', undefined)).toBe(null)
  })
})

describe('view toggle state', () => {
  const twoViews = ['list', 'map']
  const threeViews = ['list', 'map', 'calendar']

  it('accepts only the views the page declares', () => {
    expect(isValidView('map', twoViews)).toBe(true)
    expect(isValidView('calendar', threeViews)).toBe(true)
    // A page that offers no Calendar button must not be switchable to it.
    expect(isValidView('calendar', twoViews)).toBe(false)
    expect(isValidView(undefined, threeViews)).toBe(false)
  })

  it('switches to the requested view and reports the change', () => {
    expect(getNextToggleState('list', 'map', twoViews)).toEqual({ view: 'map', changed: true })
    expect(getNextToggleState('map', 'calendar', threeViews)).toEqual({ view: 'calendar', changed: true })
  })

  it('is a no-op when the active view is requested again', () => {
    expect(getNextToggleState('map', 'map', twoViews)).toEqual({ view: 'map', changed: false })
  })

  it('ignores views the page does not offer and keeps the current view', () => {
    expect(getNextToggleState('list', 'calendar', twoViews)).toEqual({ view: 'list', changed: false })
    expect(getNextToggleState('list', 'gallery', threeViews)).toEqual({ view: 'list', changed: false })
  })

  it('applies the active class and aria-pressed to the selected button only', () => {
    const listButton = createButtonStub('list', true)
    const mapButton = createButtonStub('map', false)
    const calendarButton = createButtonStub('calendar', false)

    applyToggleState([listButton, mapButton, calendarButton], 'calendar')

    expect(calendarButton.classList.contains('view-toggle__btn--active')).toBe(true)
    expect(calendarButton.getAttribute('aria-pressed')).toBe('true')
    for (const button of [listButton, mapButton]) {
      expect(button.classList.contains('view-toggle__btn--active')).toBe(false)
      expect(button.getAttribute('aria-pressed')).toBe('false')
    }
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

  it('renders the List/Map/Calendar toggle on pop-ups only', () => {
    expect(popupsHtml).toContain('class="view-toggle"')
    expect(popupsHtml).toContain('data-view="list"')
    expect(popupsHtml).toContain('data-view="map"')
    // Calendar joined the toggle in Epic 5 (#298); Epic 3 shipped two buttons.
    expect(popupsHtml).toContain('data-view="calendar"')
    expect(dateIdeasHtml).not.toContain('class="view-toggle"')
  })

  it('opens on List, with one button marked active', () => {
    const activeButtons = popupsHtml.match(/view-toggle__btn--active/g) || []
    expect(activeButtons).toHaveLength(1)
    expect(popupsHtml).toMatch(/view-toggle__btn view-toggle__btn--active" data-view="list"/)
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
