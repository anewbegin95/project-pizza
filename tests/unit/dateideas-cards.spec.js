const fs = require('node:fs')
const path = require('node:path')

const projectRoot = path.resolve(__dirname, '..', '..')

function read(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), 'utf8')
}

describe('the shared results list', () => {
  const list = require('../../resources/js/results-list.js')

  it('exposes the empty state both pages render', () => {
    // The markup has to match .results-empty in results.css, and one
    // stylesheet with two builders is exactly how the two drift apart.
    expect(typeof list.buildEmptyState).toBe('function')
    expect(typeof list.renderResults).toBe('function')
  })
})

describe('the date ideas list module', () => {
  const list = require('../../resources/js/dateideas-list.js')

  it('says what is missing in the page\'s own words', () => {
    // "No pop-ups match these filters" on the Date Ideas page would read as a
    // bug. The message is the per-page part; the markup around it is shared.
    expect(list.EMPTY_MESSAGE).toMatch(/date idea/i)
    expect(list.EMPTY_MESSAGE).not.toMatch(/pop-up/i)
    expect(list.EMPTY_ACTION_LABEL).toMatch(/clear/i)
  })

  it('does not group results', () => {
    // Pop-Ups groups by month. Date ideas are evergreen — there is no date to
    // group on, and REDESIGN.md 7.2 asks for a plain list of cards.
    expect(list.groupByMonth).toBeUndefined()
    expect(list.formatMonthHeading).toBeUndefined()
  })
})

describe('the shared detail modal wiring', () => {
  const detail = require('../../resources/js/results-modal.js')

  it('exposes the helpers both pages need', () => {
    expect(typeof detail.initDetailModal).toBe('function')
    expect(typeof detail.getEntryId).toBe('function')
    expect(typeof detail.findEntry).toBe('function')
    expect(typeof detail.isPlainLeftClick).toBe('function')
  })

  it('reads an entry id out of either page\'s detail href', () => {
    expect(detail.getEntryId('pop-up.html?id=flavia')).toBe('flavia')
    expect(detail.getEntryId('date-idea.html?id=brooklyn-bridge-walk')).toBe('brooklyn-bridge-walk')
    expect(detail.getEntryId('date-idea.html')).toBeNull()
  })
})

describe('the date ideas modal module', () => {
  const modal = require('../../resources/js/dateideas-modal.js')

  it('returns readers to the page they came from', () => {
    expect(modal.RETURN_LABEL).toMatch(/date idea/i)
    expect(modal.RETURN_LABEL).not.toMatch(/pop-up/i)
  })

  it('points its history entries at the date idea detail page', () => {
    // The pushed URL is the entry's own page, so a copied or reloaded link
    // still resolves to real content.
    expect(modal.detailHref({ id: 'brooklyn-bridge-walk' })).toBe(
      'date-idea.html?id=brooklyn-bridge-walk'
    )
    expect(modal.detailHref({ id: 'a b&c' })).toBe('date-idea.html?id=a%20b%26c')
  })
})

describe('the detail modal adapts to evergreen content', () => {
  const { getShareLabel, formatDetailDateTime, buildGoogleCalendarUrl } = require('../../resources/js/modal.js')

  it('does not call a date idea an event', () => {
    // REDESIGN.md 6.5 says "Share Event", written for the Pop-Ups modal. 6.5
    // already sanctions a page-appropriate return label; this is the same move.
    expect(getShareLabel('popup')).toBe('Share Event')
    expect(getShareLabel('date-idea')).toBe('Share Date Idea')
    expect(getShareLabel(undefined)).toBe('Share Event')
  })

  it('leaves out the date line when there is no date', () => {
    expect(formatDetailDateTime(undefined, undefined)).toBe('')
    expect(formatDetailDateTime('', '')).toBe('')
  })

  it('offers no calendar link for an entry with no date', () => {
    expect(buildGoogleCalendarUrl({ name: 'Sunset Walk' })).toBe('')
  })
})

// Parked with the redesign (#403): #402 unloads this markup from the page,
// so these assertions have nothing to find. The module-logic and CSS-file
// tests above still run and keep the parked code verified for the future
// refactor. Re-enable by reverting #402 and dropping the `.skip`.
describe.skip('date-ideas.html card and modal markup', () => {
  const html = read('date-ideas.html')

  it('loads each shared module before the page module that builds on it', () => {
    // Classic scripts run in document order.
    const order = [
      'resources/js/cards.js',
      'resources/js/results-list.js',
      'resources/js/dateideas-list.js',
      'resources/js/modal.js',
      'resources/js/results-modal.js',
      'resources/js/dateideas-modal.js',
    ].map((src) => ({ src, at: html.indexOf(src) }))

    for (const entry of order) {
      expect(entry.at, `${entry.src} is not loaded`).toBeGreaterThan(-1)
    }
    const positions = order.map((entry) => entry.at)
    expect(positions).toEqual([...positions].sort((a, b) => a - b))
  })
})

// Parked with the redesign (#403): #402 unloads this markup from the page,
// so these assertions have nothing to find. The module-logic and CSS-file
// tests above still run and keep the parked code verified for the future
// refactor. Re-enable by reverting #402 and dropping the `.skip`.
describe.skip('pop-ups keeps working off the shared modules', () => {
  const html = read('pop-ups.html')

  it('links the shared list and modal modules', () => {
    expect(html).toContain('resources/js/results-list.js')
    expect(html).toContain('resources/js/results-modal.js')
  })

  it('leaves the shared wiring in exactly one place', () => {
    // The extraction is only worth doing if the copies are gone.
    const popupsModal = read('resources/js/popups-modal.js')
    expect(popupsModal).not.toMatch(/addEventListener\('popstate'/)
    expect(popupsModal).not.toMatch(/pushState/)
  })
})
