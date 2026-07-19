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

const HERO_PAGES = ['index.html', 'pop-ups.html', 'date-ideas.html']

describe('hero collage styles', () => {
  const css = read('resources/css/hero.css')

  it('hides collage-only elements by default so the flag-off hero is unchanged', () => {
    expectCssToMatch(css, '.hero__panels, .hero__supertitle { display: none; }')
  })

  it('gates the collage layout behind the redesign flag scope', () => {
    expectCssToMatch(css, ":root[data-redesign='on'] .hero--collage")
    expectCssToMatch(css, 'body.redesign-enabled .hero--collage')
  })

  it('lays out a three-panel grid with the redesign gradient overlay', () => {
    expectCssToMatch(css, 'grid-template-columns: repeat(3, 1fr);')
    expectCssToMatch(
      css,
      'linear-gradient(to bottom, rgba(0, 0, 0, 0.1), rgba(0, 27, 46, 0.75))'
    )
  })

  it('uses the redesign hero heights on desktop and mobile', () => {
    expectCssToMatch(css, 'min-height: max(60vh, 400px);')
    expectCssToMatch(css, 'min-height: 50vh;')
  })

  it('styles the supertitle per the redesign spec', () => {
    expectCssToMatch(css, 'letter-spacing: 0.15em;')
    expectCssToMatch(css, 'text-transform: uppercase;')
  })
})

describe('hero collage markup', () => {
  it.each(HERO_PAGES)('%s hero carries the collage variant and panels', (page) => {
    const html = read(page)
    expect(html).toContain('class="hero hero--collage"')
    expect(html).toContain('<div class="hero__panels" aria-hidden="true">')
    const panelCount = (html.match(/class="hero__panel hero__panel--\d"/g) || []).length
    expect(panelCount).toBe(3)
    expect(html).toContain('class="hero__supertitle"')
  })

  it('keeps the existing hero copy unchanged', () => {
    expect(read('pop-ups.html')).toContain('<h1>Upcoming NYC Pop-Ups</h1>')
    expect(read('date-ideas.html')).toContain('<h1>Date Ideas</h1>')
    expect(read('index.html')).toContain('<h1>Welcome to NYC Slice of Life!</h1>')
  })
})
