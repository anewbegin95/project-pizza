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

describe('calendar view styles', () => {
  const css = read('resources/css/popups-calendar.css')

  it('gates every rule behind the redesign flag', () => {
    const selectors = css
      .replaceAll(/\/\*[\s\S]*?\*\//g, '')
      .split('}')
      .map((block) => block.split('{')[0])
      .filter((selector) => selector && selector.trim() && !selector.trim().startsWith('@'))

    for (const selector of selectors) {
      expect(
        /data-redesign='on'|redesign-enabled/.test(selector),
        `ungated selector leaks into the legacy page: ${selector.trim()}`
      ).toBe(true)
    }
  })

  it('borrows the date picker language: pink on today, muted days outside the month', () => {
    expectCssToMatch(css, 'var(--nyc-pink)')
    expectCssToMatch(css, '.calendar-cell--outside')
  })

  it('titles the month in the same display face the list view groups use', () => {
    expectCssToMatch(css, 'var(--nyc-font-display)')
  })

  it('reuses the map pin colours so a category reads the same in both views', () => {
    for (const category of ['food-drink', 'market', 'art-culture', 'fashion', 'wellness', 'music', 'vintage-thrift']) {
      expectCssToMatch(css, `var(--nyc-pin-${category})`)
    }
    // Anything uncoloured by section 6.6 falls through to the neutral pin.
    expectCssToMatch(css, 'var(--nyc-pin-other)')
  })

  it('lays the week out in seven equal columns', () => {
    expectCssToMatch(css, 'grid-template-columns: repeat(7, minmax(0, 1fr));')
  })

  it('keeps the month navigation buttons at the 44px touch target', () => {
    expectCssToMatch(css, '44px')
  })

  it('collapses to the compact cell layout on small screens', () => {
    expect(css).toMatch(/@media\s*\(max-width:\s*600px\)/)
  })

  it('truncates a chip title with a real inline element, not the flex item', () => {
    // text-overflow: ellipsis does not apply to an anonymous flex item, so a
    // bare text node inside the button hard-clips mid-word. The label needs to
    // be its own element. Cost a cycle building the mockup for #300.
    expectCssToMatch(css, '.calendar-chip__label')
    expectCssToMatch(css, 'text-overflow: ellipsis;')
  })
})

describe('calendar view markup', () => {
  const html = read('pop-ups.html')

  it('links the calendar stylesheet and script', () => {
    expect(html).toContain('<link rel="stylesheet" href="resources/css/popups-calendar.css">')
    expect(html).toContain('<script src="resources/js/popups-calendar.js" defer></script>')
  })

  it('loads the calendar after the date picker it borrows the month grid from', () => {
    expect(html.indexOf('date-picker.js')).toBeLessThan(html.indexOf('popups-calendar.js'))
  })

  it('keeps the calendar panel the script renders into', () => {
    expect(html).toMatch(/class="[^"]*results__panel--calendar[^"]*"/)
  })
})
