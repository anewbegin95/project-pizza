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

describe('pop-ups results region styles', () => {
  const css = read('resources/css/popups-redesign.css')

  it('leaves the legacy grid alone until the flag is on', () => {
    expectCssToMatch(css, ":root[data-redesign='on'] .results__panel--list")
    expectCssToMatch(css, 'body.redesign-enabled .results__panel--list')
  })

  it('stacks cards in a single column up to the shared container width', () => {
    expectCssToMatch(css, 'grid-template-columns: 1fr;')
    expectCssToMatch(css, 'max-width: var(--container-max-width);')
    expectCssToMatch(css, 'margin-inline: auto;')
  })

  it('shares the gutter the search and filter bars use, so the edges line up', () => {
    // .search-bar-container and .filter-bar both pad their inline edges by
    // --space-sm-md; the results list has to match or the cards sit inboard.
    expectCssToMatch(css, 'var(--space-sm-md)')
  })

  it('swaps panels from the data-view attribute the toggle stamps on <html>', () => {
    expectCssToMatch(css, "[data-view='map']")
    expectCssToMatch(css, "[data-view='calendar']")
  })

  it('keeps the list panel visible before the toggle has stamped a view', () => {
    // The prebuilt static tiles are the no-JS experience, so the list panel
    // cannot depend on data-view being present to show itself. Only a view
    // other than list may hide it.
    const hidesListUnconditionally = css
      .replaceAll(/\/\*[\s\S]*?\*\//g, '')
      .split('}')
      .some((block) => {
        const [selectorPart, declarations = ''] = block.split('{')
        if (!selectorPart || !declarations) return false
        if (!/display:\s*none/.test(declarations)) return false
        return selectorPart
          .split(',')
          .some((one) => one.includes('.results__panel--list') && !one.includes('data-view='))
      })

    expect(hidesListUnconditionally, 'the list panel must not be hidden without a data-view').toBe(false)
  })
})

describe('redesign-only shell elements are hidden with the flag off', () => {
  const css = read('resources/css/popups-redesign.css').replaceAll(/\/\*[\s\S]*?\*\//g, '')

  it.each(['.results__panel--map', '.results__panel--calendar', '.results-divider'])('%s carries an unscoped display: none default', (selector) => {
    const hidesUnscoped = css.split('}').some((block) => {
      const [selectorPart, declarations = ''] = block.split('{')
      if (!selectorPart || !declarations) return false
      const targetsSelector = selectorPart
        .split(',')
        .map((one) => one.trim())
        .includes(selector)
      return targetsSelector && /display:\s*none/.test(declarations)
    })

    expect(hidesUnscoped, `${selector} needs a flag-off default of display: none`).toBe(true)
  })
})

describe('pop-ups.html shell markup', () => {
  const html = read('pop-ups.html')

  it('links the shell stylesheet', () => {
    expect(html).toContain('resources/css/popups-redesign.css')
  })

  it('wraps the grid in a results region holding list, map and calendar panels', () => {
    expect(html).toMatch(/<div class="results"[^>]*>/)
    expect(html).toMatch(/class="[^"]*results__panel--list[^"]*"[^>]*id="popupsGrid"/)
    expect(html).toMatch(/class="[^"]*results__panel--map[^"]*"/)
    expect(html).toMatch(/class="[^"]*results__panel--calendar[^"]*"/)
  })

  it('keeps the grid element the page scripts and prebuild target', () => {
    // prebuild-events.js injects between the markers; pop-ups.js and the
    // Epic 3 e2e helpers look the grid up by id.
    expect(html).toMatch(/id="popupsGrid"/)
    const listPanel = html.slice(html.indexOf('results__panel--list'), html.indexOf('results__panel--map'))
    expect(listPanel).toContain('<!-- STATIC_POPUPS_START -->')
    expect(listPanel).toContain('<!-- STATIC_POPUPS_END -->')
  })
})

describe('legacy pop-ups grid', () => {
  it('is left intact, and the shell overrides its !important padding head-on', () => {
    // section#popupsGrid sets padding at !important and outranks even the
    // media queries, so the legacy grid is 16px on all sides at every width.
    // Deleting it would change the flag-off page below 975px, so the gated
    // rule matches it with !important instead — the same move popups.css
    // already makes for section.popups-grid's margin and background.
    expect(read('resources/css/popups.css')).toMatch(/section#popupsGrid/)

    const shell = read('resources/css/popups-redesign.css')
    const gatedPadding = shell
      .split('}')
      .filter((block) => /padding[^;]*!important/.test(block))
    expect(gatedPadding.length).toBeGreaterThan(0)
    for (const block of gatedPadding) {
      expect(block).toMatch(/data-redesign='on'|redesign-enabled/)
    }
  })
})
