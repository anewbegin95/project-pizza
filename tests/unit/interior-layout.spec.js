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

const SUPPORTING_PAGES = ['about.html', 'contact_us.html', 'privacy_policy.html']

describe('interior page styles', () => {
  const css = read('resources/css/interior.css')

  it('leaves the legacy pages alone until the flag is on', () => {
    expectCssToMatch(css, ":root[data-redesign='on'] .interior-page")
    expectCssToMatch(css, 'body.redesign-enabled .interior-page')
  })

  it('constrains the reading column to the shared section width', () => {
    expectCssToMatch(css, 'max-width: var(--section-max-width);')
    expectCssToMatch(css, 'margin-inline: auto;')
  })

  it('sits the content on a white card over the cream page', () => {
    expectCssToMatch(css, 'background-color: var(--nyc-white);')
    expectCssToMatch(css, 'border-radius: var(--radius-lg);')
  })

  it('sets a serif heading and readable body rhythm', () => {
    expectCssToMatch(css, 'font-family: var(--nyc-font-display);')
    expectCssToMatch(css, 'line-height: 1.7;')
  })

  it('uses green as the interior link accent', () => {
    expectCssToMatch(css, '.interior-page__content a')
    expectCssToMatch(css, 'color: var(--nyc-green);')
  })

  it('provides media and CTA regions for pages that need them', () => {
    expectCssToMatch(css, '.interior-page__media')
    expectCssToMatch(css, '.interior-page__cta')
  })

  it('stacks the media above the text on small screens', () => {
    expectCssToMatch(css, '@media (max-width: 767px)')
  })
})

describe('supporting page markup', () => {
  it.each(SUPPORTING_PAGES)('%s adopts the shared shell', (page) => {
    const html = read(page)
    // The shell classes sit alongside each page's existing ones.
    expect(html).toMatch(/class="[^"]*\binterior-page\b/)
    expect(html).toMatch(/class="[^"]*\binterior-page__content\b/)
    expect(html).toContain('<link rel="stylesheet" href="resources/css/interior.css">')
  })

  it('keeps each page heading and its existing copy', () => {
    expect(read('about.html')).toContain('<h1>About Us</h1>')
    expect(read('contact_us.html')).toContain('<h1>Contact Us</h1>')
    expect(read('contact_us.html')).toContain('NYCSliceofLife@gmail.com')
    expect(read('privacy_policy.html')).toContain('<h1>Privacy Policy</h1>')
    expect(read('privacy_policy.html')).toContain('What We Collect')
  })

  it('marks the about page portrait as the media region', () => {
    expect(read('about.html')).toContain('interior-page__media')
  })
})
