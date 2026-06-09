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

describe('redesign foundation styles', () => {
  it('defines redesign color and surface tokens in base.css :root', () => {
    const css = read('resources/css/base.css')

    expect(css).toMatch(/--nyc-cream:\s*#FAF8F5\s*;/)
    expect(css).toMatch(/--nyc-green:\s*#2D6A4F\s*;/)
    expect(css).toMatch(/--nyc-green-light:\s*#EAF2ED\s*;/)
    expect(css).toMatch(/--nyc-green-hover:\s*#235A40\s*;/)
    expect(css).toMatch(/--nyc-section-divider:\s*#E5E5E5\s*;/)
    expect(css).toMatch(/--nyc-surface-page:\s*var\(--nyc-cream\)\s*;/)
    expect(css).toMatch(/--nyc-surface-card:\s*var\(--nyc-white\)\s*;/)
  })

  it('defines global typography roles for display and body fonts', () => {
    const css = read('resources/css/base.css')

    expectCssToMatch(css, "--nyc-font-display: 'Playfair Display', Georgia, serif;")
    expectCssToMatch(css, "--nyc-font-body: 'Work Sans', 'Arial', sans-serif;")
    expectCssToMatch(css, ":root[data-redesign='on'], body.redesign-enabled {")
    expectCssToMatch(css, '--nyc-font-heading-h1: var(--nyc-font-display);')
    expectCssToMatch(css, '--nyc-page-background: var(--nyc-surface-page);')
  })

  it('includes reusable shared primitive classes', () => {
    const baseCss = read('resources/css/base.css')
    const buttonsCss = read('resources/css/buttons.css')

    expect(baseCss).toContain('.ui-card')
    expect(baseCss).toContain('.ui-pill')
    expect(baseCss).toContain('.ui-filter-chip {')
    expect(baseCss).toContain('.ui-input {')
    expect(baseCss).toContain('.ui-divider')
    expect(buttonsCss).toContain('.ui-btn {')
    expect(buttonsCss).toContain('.ui-btn--primary {')
    expect(buttonsCss).toContain('.ui-btn--pill {')
  })
})
