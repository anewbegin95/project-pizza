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

/** True when `selector` appears on its own in a rule declaring display: none. */
function hasUnscopedHide(css, selector) {
  return css
    .replaceAll(/\/\*[\s\S]*?\*\//g, '')
    .split('}')
    .some((block) => {
      const [selectorPart, declarations = ''] = block.split('{')
      if (!selectorPart || !declarations) return false
      if (!/display:\s*none/.test(declarations)) return false
      return selectorPart
        .split(',')
        .map((one) => one.trim())
        .includes(selector)
    })
}

describe('shared results region', () => {
  const css = read('resources/css/results.css')

  // The region, the divider and the empty state are page-agnostic: Pop-Ups and
  // Date Ideas render the same shell around different result sets. They lived
  // in popups-redesign.css until #304 needed them on a second page; keeping one
  // copy is what stops the two pages drifting apart.
  it('carries both halves of the gating contract', () => {
    expectCssToMatch(css, ":root[data-redesign='on'] .results")
    expectCssToMatch(css, 'body.redesign-enabled .results')
  })

  it('gives the region the shared container width and gutter', () => {
    // .search-bar-container and .filter-bar both pad their inline edges by
    // --space-sm-md; the results region has to match or the cards sit inboard.
    expectCssToMatch(css, 'max-width: var(--container-max-width);')
    expectCssToMatch(css, 'margin-inline: auto;')
    expectCssToMatch(css, 'var(--space-sm-md)')
  })

  it('stacks result cards in a single column', () => {
    expectCssToMatch(css, ":root[data-redesign='on'] .results__panel--list")
    expectCssToMatch(css, 'grid-template-columns: 1fr;')
  })

  it.each(['.results-divider', '.results-empty'])('%s carries an unscoped display: none default', (selector) => {
    expect(hasUnscopedHide(css, selector), `${selector} needs a flag-off default of display: none`).toBe(true)
  })

  it('never hides the list panel without a data-view', () => {
    // The prebuilt static tiles are the no-JS experience on both pages, and
    // Date Ideas has no view toggle at all, so nothing ever stamps data-view
    // there. A bare hide rule would blank the page for readers without JS.
    expect(hasUnscopedHide(css, '.results__panel--list')).toBe(false)
  })
})

describe('date ideas shell styles', () => {
  const css = read('resources/css/dateideas-redesign.css')

  it('carries both halves of the gating contract', () => {
    expectCssToMatch(css, ":root[data-redesign='on']")
    expectCssToMatch(css, 'body.redesign-enabled')
  })

  it('neutralises the legacy grid padding head-on, and only when the flag is on', () => {
    // section#dateIdeasGrid sets padding at !important in date_ideas.css. An id
    // beats any stack of classes, so the shell cannot out-specify it — it has
    // to match the id and carry !important too. Same trap as #popupsGrid (#294).
    // Comments are stripped first: this file's own prose says "padding at
    // !important", which matched the declaration regex and made the assertion
    // pass with no override in the file at all.
    const gatedPadding = css
      .replaceAll(/\/\*[\s\S]*?\*\//g, '')
      .split('}')
      .filter((block) => /padding[^;]*!important/.test(block))
    expect(gatedPadding.length).toBeGreaterThan(0)
    for (const block of gatedPadding) {
      expect(block).toMatch(/data-redesign='on'|redesign-enabled/)
      expect(block).toMatch(/#dateIdeasGrid/)
    }
  })

  it('leaves the legacy stylesheet intact', () => {
    // Deleting the legacy rule would change the flag-off page: its !important
    // is what makes the grid 16px above 975px and 0 16px below.
    expect(read('resources/css/date_ideas.css')).toMatch(/section#dateIdeasGrid/)
  })
})

describe('date-ideas.html shell markup', () => {
  const html = read('date-ideas.html')

  it('links the shared and page shell stylesheets', () => {
    expect(html).toContain('resources/css/results.css')
    expect(html).toContain('resources/css/dateideas-redesign.css')
  })

  it('wraps the grid in the results region', () => {
    expect(html).toMatch(/<div class="results"[^>]*>/)
    expect(html).toMatch(/class="[^"]*results__panel--list[^"]*"[^>]*id="dateIdeasGrid"/)
  })

  it('keeps the grid element the page scripts and prebuild target', () => {
    // prebuild-events.js injects between the markers; date-ideas.js and
    // filters.js (RESULTS_CONTAINERS) look the grid up by id.
    expect(html).toMatch(/id="dateIdeasGrid"/)
    const grid = html.slice(html.indexOf('results__panel--list'))
    expect(grid).toContain('<!-- STATIC_DATE_IDEAS_START -->')
    expect(grid).toContain('<!-- STATIC_DATE_IDEAS_END -->')
  })

  it('offers no view toggle', () => {
    // REDESIGN.md section 7.2: a map does not apply to evergreen date ideas.
    // Recorded as a deliberate deviation in docs/redesign-components.md
    // section 5 — this asserts nobody "fixes" it by pasting the Pop-Ups markup.
    expect(html).not.toContain('view-toggle')
  })

  it('does not load the date range picker', () => {
    // Date ideas are evergreen and have no dates chip; filters.js only mounts
    // the picker where one exists, so the script would be dead weight.
    expect(html).not.toContain('date-picker.js')
    expect(html).not.toContain('data-filter="dates"')
  })
})

describe('pop-ups keeps working off the shared region', () => {
  it('links results.css alongside its own shell stylesheet', () => {
    const html = read('pop-ups.html')
    expect(html).toContain('resources/css/results.css')
    expect(html).toContain('resources/css/popups-redesign.css')
  })

  it('leaves the page-agnostic rules in exactly one file', () => {
    // The extraction is only worth doing if the copies are gone.
    const popups = read('resources/css/popups-redesign.css').replaceAll(/\/\*[\s\S]*?\*\//g, '')
    expect(popups).not.toMatch(/\.results-divider\s*[,{]/)
    expect(popups).not.toMatch(/\.results-empty\s*[,{]/)
  })

  it('keeps the pop-ups-only rules where they were', () => {
    const popups = read('resources/css/popups-redesign.css')
    expectCssToMatch(popups, 'section#popupsGrid')
    expectCssToMatch(popups, "[data-view='map']")
    expectCssToMatch(popups, "[data-view='calendar']")
    expectCssToMatch(popups, '.event-group__heading')
  })
})
