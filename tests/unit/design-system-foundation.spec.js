const fs = require('node:fs')
const path = require('node:path')

const projectRoot = path.resolve(__dirname, '..', '..')

function read(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), 'utf8')
}

function expectCssToMatch(css, pattern) {
  const escapedPattern = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  expect(css).toMatch(new RegExp(escapedPattern.replaceAll(/\s+/g, '\\s*')))
}

describe('redesign foundation styles', () => {
  it('defines redesign color and surface tokens in base.css :root', () => {
    const css = read('resources/css/base.css')

    expect(css).toContain('--nyc-cream: #FAF8F5;')
    expect(css).toContain('--nyc-green: #2D6A4F;')
    expect(css).toContain('--nyc-green-light: #EAF2ED;')
    expect(css).toContain('--nyc-green-hover: #235A40;')
    expect(css).toContain('--nyc-section-divider: #E5E5E5;')
    expect(css).toContain('--nyc-surface-page: var(--nyc-cream);')
    expect(css).toContain('--nyc-surface-card: var(--nyc-white);')
  })

  it('defines global typography roles for display and body fonts', () => {
    const css = read('resources/css/base.css')

    expectCssToMatch(css, "--nyc-font-display: 'Playfair Display', Georgia, serif;")
    expectCssToMatch(css, "--nyc-font-body: 'Work Sans', 'Arial', sans-serif;")
    expectCssToMatch(css, ":root[data-redesign='on'],")
    expectCssToMatch(css, 'body.redesign-enabled {')
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
