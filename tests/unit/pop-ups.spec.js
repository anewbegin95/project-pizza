const { mapSanityPopup, formatPopupDate } = require('../../resources/js/pop-ups.js')

describe('mapSanityPopup (client-side)', () => {
  it('passes through latitude and longitude from the Sanity item', () => {
    const item = {
      name: 'Test Pop-Up',
      slug: 'test-pop-up',
      latitude: 40.7484421,
      longitude: -73.9856589,
    }

    const result = mapSanityPopup(item)

    expect(result.latitude).toBe(40.7484421)
    expect(result.longitude).toBe(-73.9856589)
  })

  it('defaults latitude and longitude to null when absent', () => {
    const result = mapSanityPopup({ name: 'No Coords Yet' })

    expect(result.latitude).toBeNull()
    expect(result.longitude).toBeNull()
  })
})

// Sanity keeps both date pairs on every document: toggling `all_day` only
// hides the unused pair in Studio, it never unsets it. So a pop-up authored
// as timed and later flipped to all-day still carries a stale
// `start_datetime`. The mapper used to pick with `||`, which let that stale
// value outrank the correct `start_date` (#423).
describe('mapSanityPopup date-pair selection', () => {
  it('prefers start_date over a stale start_datetime when all_day is true', () => {
    const result = mapSanityPopup({
      name: 'Beyond Yoga Seek Beyond Open Air Concert',
      all_day: true,
      start_date: '2026-10-17',
      end_date: '2026-10-17',
      start_datetime: '2026-09-17T16:53:00.000Z',
    })

    expect(result.start_datetime).toBe('2026-10-17')
    expect(result.end_datetime).toBe('2026-10-17')
  })

  it('prefers the datetimes over a stale date pair when all_day is false', () => {
    const result = mapSanityPopup({
      name: 'Timed Pop-Up',
      all_day: false,
      start_datetime: '2026-06-12T15:00:00.000Z',
      end_datetime: '2026-06-12T19:00:00.000Z',
      start_date: '2026-06-05',
      end_date: '2026-06-05',
    })

    expect(result.start_datetime).toBe('2026-06-12T15:00:00.000Z')
    expect(result.end_datetime).toBe('2026-06-12T19:00:00.000Z')
  })

  // `toDisplayFlag` accepts booleans and strings, and the string 'FALSE' is
  // truthy in JS — a bare `if (item.all_day)` would read it as all-day.
  it('reads the string all_day flag the way toDisplayFlag does', () => {
    const result = mapSanityPopup({
      name: 'String Flag',
      all_day: 'FALSE',
      start_date: '2026-10-17',
      start_datetime: '2026-10-17T18:00:00.000Z',
    })

    expect(result.all_day).toBe('FALSE')
    expect(result.start_datetime).toBe('2026-10-17T18:00:00.000Z')
  })

  it('treats a missing all_day flag as timed', () => {
    const result = mapSanityPopup({
      name: 'No Flag',
      start_date: '2026-10-17',
      start_datetime: '2026-10-17T18:00:00.000Z',
    })

    expect(result.start_datetime).toBe('2026-10-17T18:00:00.000Z')
  })

  it('falls back to the other pair when the preferred pair is entirely empty', () => {
    const result = mapSanityPopup({
      name: 'All Day, No Date Fields',
      all_day: true,
      start_datetime: '2026-10-17T18:00:00.000Z',
    })

    expect(result.start_datetime).toBe('2026-10-17')
  })

  it('truncates an all-day fallback to its Eastern calendar day', () => {
    // 2am UTC is 10pm the previous evening in New York.
    const result = mapSanityPopup({
      name: 'Late UTC Fallback',
      all_day: true,
      start_datetime: '2026-10-18T02:00:00.000Z',
    })

    expect(result.start_datetime).toBe('2026-10-17')
  })

  // A per-field fallback would pull the stale end_datetime in here and render
  // the range backwards. The fallback is gated on the whole pair for this.
  it('does not pull a stale end_datetime in when only start_date is set', () => {
    const result = mapSanityPopup({
      name: 'Half-Populated',
      all_day: true,
      start_date: '2026-10-17',
      end_datetime: '2026-09-17T16:53:00.000Z',
    })

    expect(result.start_datetime).toBe('2026-10-17')
    expect(result.end_datetime).toBe('')
  })

  it('leaves both values empty when the document has no dates at all', () => {
    const result = mapSanityPopup({ name: 'Undated' })

    expect(result.start_datetime).toBe('')
    expect(result.end_datetime).toBe('')
  })
})

describe('formatPopupDate', () => {
  it('renders a single-day all-day event once', () => {
    expect(formatPopupDate('2026-10-17', '2026-10-17', 'TRUE', 'FALSE'))
      .toBe('Sat, Oct 17 (all day)')
  })

  // The pair used to arrive in mismatched shapes, and a raw `start === end`
  // string test then rendered the day twice as "X - X (all day)".
  it('collapses an all-day pair whose values arrive in different shapes', () => {
    // 11pm UTC is 7pm the same day in New York.
    expect(formatPopupDate('2026-07-24', '2026-07-24T23:00:00.000Z', 'TRUE', 'FALSE'))
      .toBe('Fri, Jul 24 (all day)')
  })

  it('renders a multi-day all-day event as a hyphenated range', () => {
    expect(formatPopupDate('2026-07-17', '2026-07-19', 'TRUE', 'FALSE'))
      .toBe('Fri, Jul 17 - Sun, Jul 19 (all day)')
  })

  it('renders an all-day event with no end as a single day', () => {
    expect(formatPopupDate('2026-10-17', '', 'TRUE', 'FALSE'))
      .toBe('Sat, Oct 17 (all day)')
  })

  it('renders an all-day event with only an end date', () => {
    expect(formatPopupDate('', '2026-10-17', 'TRUE', 'FALSE'))
      .toBe('Sat, Oct 17 (all day)')
  })

  it('returns the TBD copy when an all-day event has no dates at all', () => {
    expect(formatPopupDate('', '', 'TRUE', 'FALSE'))
      .toBe('Date and time to be announced')
  })

  it('still renders a timed same-day event as a time range', () => {
    expect(formatPopupDate(
      '2026-07-17T14:00:00.000Z', '2026-07-17T21:00:00.000Z', 'FALSE', 'FALSE'
    )).toBe('Fri, Jul 17, 10:00 AM – 5:00 PM')
  })

  it('still renders a timed multi-day event with both endpoints', () => {
    expect(formatPopupDate(
      '2026-07-17T14:00:00.000Z', '2026-07-19T21:00:00.000Z', 'FALSE', 'FALSE'
    )).toBe('Fri, Jul 17, 10:00 AM - Sun, Jul 19, 5:00 PM')
  })
})
