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

  it('gates every rule behind the redesign flag, bar the flag-off defaults', () => {
    const blocks = css
      .replaceAll(/\/\*[\s\S]*?\*\//g, '')
      .split('}')
      .map((block) => block.split('{'))
      .filter(([selector, declarations]) => selector && selector.trim() && declarations && !selector.trim().startsWith('@'))

    for (const [selector, declarations] of blocks) {
      const gated = /data-redesign='on'|redesign-enabled/.test(selector)
      // The contract allows exactly one kind of ungated rule: the
      // `display: none` default that keeps a component off the legacy page.
      const isHidingDefault = /^\s*display:\s*none;?\s*$/.test(declarations)
      expect(
        gated || isHidingDefault,
        `ungated selector leaks into the legacy page: ${selector.trim()}`
      ).toBe(true)
    }
  })

  it('keeps the day modal off the page entirely with the flag off', () => {
    const stripped = css.replaceAll(/\/\*[\s\S]*?\*\//g, '')
    const hasDefault = stripped.split('}').some((block) => {
      const [selector, declarations = ''] = block.split('{')
      if (!selector || !declarations) return false
      return (
        selector
          .split(',')
          .map((one) => one.trim())
          .includes('.modal--day') && /display:\s*none/.test(declarations)
      )
    })

    expect(hasDefault, '.modal--day needs a flag-off default of display: none').toBe(true)
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

// Parked with the redesign (#403): #402 unloads this markup from the page,
// so these assertions have nothing to find. The module-logic and CSS-file
// tests above still run and keep the parked code verified for the future
// refactor. Re-enable by reverting #402 and dropping the `.skip`.
describe.skip('calendar view markup', () => {
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
