const fs = require('node:fs')
const path = require('node:path')

const {
  buildGoogleCalendarUrl,
  getShareData,
  formatDetailDateTime,
} = require('../../resources/js/modal.js')

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

describe('buildGoogleCalendarUrl', () => {
  const event = {
    name: 'Flavia Flavor Lounge',
    start_datetime: '2026-07-23T15:00:00.000Z',
    end_datetime: '2026-07-24T23:00:00.000Z',
    venue_name: '22 Wooster',
    address: '22 Wooster St, New York, NY 10013',
    short_desc: 'Sip complimentary coffee and tea.',
  }

  it('builds a template link carrying the event details', () => {
    const url = new URL(buildGoogleCalendarUrl(event))

    expect(url.origin + url.pathname).toBe('https://calendar.google.com/calendar/render')
    expect(url.searchParams.get('action')).toBe('TEMPLATE')
    expect(url.searchParams.get('text')).toBe('Flavia Flavor Lounge')
    expect(url.searchParams.get('location')).toBe('22 Wooster, 22 Wooster St, New York, NY 10013')
    expect(url.searchParams.get('details')).toContain('Sip complimentary coffee')
  })

  it('encodes the times in Google basic UTC format', () => {
    const dates = new URL(buildGoogleCalendarUrl(event)).searchParams.get('dates')
    expect(dates).toBe('20260723T150000Z/20260724T230000Z')
  })

  it('treats an all-day event as a whole day rather than midnight UTC', () => {
    const dates = new URL(
      buildGoogleCalendarUrl({ name: 'All Day', start_datetime: '2026-07-25' })
    ).searchParams.get('dates')
    // Google's all-day form is an exclusive end date.
    expect(dates).toBe('20260725/20260726')
  })

  it('falls back to a one-hour block when there is no end time', () => {
    const dates = new URL(
      buildGoogleCalendarUrl({ name: 'Open End', start_datetime: '2026-07-23T15:00:00.000Z' })
    ).searchParams.get('dates')
    expect(dates).toBe('20260723T150000Z/20260723T160000Z')
  })

  it('returns an empty string when there is no date to add', () => {
    expect(buildGoogleCalendarUrl({ name: 'Evergreen Idea' })).toBe('')
  })
})

describe('getShareData', () => {
  it('describes the event for the share sheet', () => {
    const share = getShareData(
      { id: 'flavia-lounge', name: 'Flavia Flavor Lounge', short_desc: 'Coffee and tea.' },
      { origin: 'https://nycsliceoflife.com', type: 'popup' }
    )

    expect(share).toEqual({
      title: 'Flavia Flavor Lounge',
      text: 'Coffee and tea.',
      url: 'https://nycsliceoflife.com/pop-up.html?id=flavia-lounge',
    })
  })

  it('points at the date idea page for date ideas', () => {
    const share = getShareData(
      { id: 'whitney-fridays', name: 'Whitney Free Fridays' },
      { origin: 'https://nycsliceoflife.com', type: 'date-idea' }
    )

    expect(share.url).toBe('https://nycsliceoflife.com/date-idea.html?id=whitney-fridays')
    expect(share.text).toBe('')
  })

  it('escapes an id with characters that need encoding', () => {
    const share = getShareData(
      { id: 'a b&c', name: 'Odd' },
      { origin: 'https://example.com', type: 'popup' }
    )
    expect(share.url).toBe('https://example.com/pop-up.html?id=a%20b%26c')
  })
})

describe('formatDetailDateTime', () => {
  it('shows a single day with its time range', () => {
    expect(
      formatDetailDateTime('2026-07-23T15:00:00.000Z', '2026-07-23T19:00:00.000Z')
    ).toBe('Thursday, July 23, 2026 · 11:00 AM – 3:00 PM')
  })

  it('shows both dates for a multi-day event', () => {
    expect(formatDetailDateTime('2026-07-23', '2026-07-25')).toBe('July 23 – July 25, 2026')
  })

  it('shows just the date when there is no end', () => {
    expect(formatDetailDateTime('2026-07-25')).toBe('Saturday, July 25, 2026')
  })

  it('is empty for an evergreen entry', () => {
    expect(formatDetailDateTime('')).toBe('')
  })
})

describe('modal styles', () => {
  const css = read('resources/css/modals.css')

  it('gates the redesigned modal behind the flag scope', () => {
    expectCssToMatch(css, ":root[data-redesign='on'] .modal--detail")
    expectCssToMatch(css, 'body.redesign-enabled .modal--detail')
  })

  it('splits the card into text and photo columns on desktop', () => {
    expectCssToMatch(css, 'grid-template-columns: 45% 55%;')
    expectCssToMatch(css, 'max-width: 900px;')
    expectCssToMatch(css, 'width: 95vw;')
  })

  it('lightens the overlay from the legacy treatment', () => {
    expectCssToMatch(css, 'background-color: rgba(0, 0, 0, 0.5);')
  })

  it('styles the pink return bar across the top', () => {
    expectCssToMatch(css, '.modal-return-bar')
    expectCssToMatch(css, 'background-color: var(--nyc-light-pink);')
    expectCssToMatch(css, 'color: var(--nyc-fuschia);')
  })

  it('stacks to a single column on mobile', () => {
    expectCssToMatch(css, 'grid-template-columns: 1fr;')
  })

  it('gives Share Event the outlined navy treatment', () => {
    expectCssToMatch(css, '.modal-detail__share')
    expectCssToMatch(css, 'border: 1px solid var(--nyc-navy);')
  })
})
