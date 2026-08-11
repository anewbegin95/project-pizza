const fs = require('node:fs')
const path = require('node:path')

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

/** Selectors in a stylesheet, with comments and declarations stripped. */
function selectorsOf(css) {
  return css
    .replaceAll(/\/\*[\s\S]*?\*\//g, '')
    .split('}')
    .flatMap((block) => (block.split('{')[1] === undefined ? [] : block.split('{')[0].split(',')))
    .map((selector) => selector.trim())
    .filter(Boolean)
}

describe('the bare button selector is retired', () => {
  const css = read('resources/css/buttons.css')
  const selectors = selectorsOf(css)

  it.each(['button', 'button:hover'])('buttons.css no longer styles %s on its own', (selector) => {
    // It matched every button on the page, so each redesign component
    // inherited the legacy pink palette and 8px 32px padding. See #372.
    expect(selectors).not.toContain(selector)
  })

  it('keeps the class-based legacy buttons untouched', () => {
    expect(selectors).toContain('.btn')
    expect(selectors).toContain('.contact-btn')
    expectCssToMatch(css, 'background-color: var(--nyc-pink);')
  })

  it('makes the standalone text button carry its own type and cursor', () => {
    // .filter-bar__clear uses .ui-btn--text without .ui-btn, so it used to get
    // its font and cursor from the bare rule.
    const textButton = css.slice(css.indexOf('.ui-btn--text {'), css.indexOf('.ui-btn--text:hover'))
    expect(textButton).toContain('font-family: var(--nyc-font-body)')
    expect(textButton).toContain('font-size: var(--font-sm)')
    expect(textButton).toContain('cursor: pointer')
  })
})

describe('section 6.9 button palette', () => {
  const css = read('resources/css/buttons.css')

  it('turns the primary button green only under the redesign flag', () => {
    expectCssToMatch(css, ":root[data-redesign='on'] .btn")
    expectCssToMatch(css, 'body.redesign-enabled .btn')
    expectCssToMatch(css, 'background-color: var(--nyc-green);')
    expectCssToMatch(css, 'background-color: var(--nyc-green-hover);')
  })

  it('outlines the secondary button instead of filling it', () => {
    const scoped = css.slice(css.indexOf("[data-redesign='on'] .secondary-btn"))
    expect(scoped).toContain('border: 1px solid var(--nyc-green)')
    expect(scoped).toContain('background-color: var(--nyc-white)')
    expect(scoped).toContain('color: var(--nyc-green)')
    expect(scoped).toContain('background-color: var(--nyc-green-light)')
  })
})

describe('buttons that relied on the bare rule now style themselves', () => {
  it('the menu toggle keeps its padding and touch target', () => {
    const css = read('resources/css/header.css')
    const rule = css.slice(css.indexOf('.menu-toggle {'), css.indexOf('.menu-toggle:hover'))
    expect(rule).toContain('padding: var(--space-xs) var(--space-md)')
    expect(rule).toContain('border-radius: var(--radius-sm)')
  })

  it('the calendar month arrows keep the legacy palette', () => {
    const css = read('resources/css/calendar.css')
    expectCssToMatch(css, '.calendar-header__prev-month, .calendar-header__next-month')
    const rule = css.slice(css.indexOf('.calendar-header__prev-month,'))
    expect(rule).toContain('background-color: var(--nyc-pink)')
    expect(rule).toContain('color: var(--nyc-fuschia)')
    expect(rule).toContain('padding: var(--space-xs) var(--space-md)')
  })

  it('the date picker nav states its own type', () => {
    const css = read('resources/css/filters.css')
    const rule = css.slice(css.indexOf('.date-picker__nav,'), css.indexOf('.date-picker__grid,'))
    expect(rule).toContain('font-size: var(--font-sm)')
    expect(rule).toContain('font-family: var(--nyc-font-body)')
  })
})

describe('the Epic 3 defensive overrides are gone', () => {
  const css = read('resources/css/filters.css')

  it('no longer restates chip colours to fight buttons.css', () => {
    const chipRule = css.slice(css.indexOf("[data-redesign='on'] .filter-chip,"), css.indexOf('.filter-chip:hover'))
    expect(chipRule).not.toContain('background-color')
    expect(chipRule).not.toContain('border:')
    // The touch target is a real requirement, not a defence.
    expect(chipRule).toContain('min-height: 44px')
  })

  it('drops the comments explaining the workaround', () => {
    expect(css).not.toMatch(/buttons\.css (styles|pads) bare/)
  })
})

describe('hero supertitle contrast', () => {
  const css = read('resources/css/hero.css')

  it('renders the supertitle in white rather than pink', () => {
    const rule = css.slice(css.indexOf('.hero--collage .hero__supertitle'))
    expect(rule).toContain('color: var(--nyc-white)')
    expect(rule).not.toContain('color: var(--nyc-pink)')
  })

  it('darkens the overlay top stop enough for AA', () => {
    expectCssToMatch(css, 'rgba(0, 27, 46, 0.6)')
  })
})
