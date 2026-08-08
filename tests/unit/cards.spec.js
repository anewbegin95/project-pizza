const fs = require('node:fs')
const path = require('node:path')

const {
  CATEGORY_LABELS,
  VIBE_LABELS,
  formatCardDate,
  isFreePrice,
  getCategoryTag,
  getAreaLabel,
} = require('../../resources/js/cards.js')

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

describe('formatCardDate', () => {
  it('breaks a single-day event into the date column parts', () => {
    expect(formatCardDate('2026-07-15T16:30:00.000Z')).toEqual({
      dayName: 'WED',
      dayNumber: '15',
      monthYear: 'July 2026',
      through: '',
    })
  })

  it('adds a through line for a multi-day event', () => {
    const parts = formatCardDate('2026-07-22T14:00:00.000Z', '2026-07-24T23:00:00.000Z')
    expect(parts.dayNumber).toBe('22')
    expect(parts.through).toBe('through Jul 24')
  })

  it('omits the through line when the event starts and ends the same day', () => {
    const parts = formatCardDate('2026-07-15T16:30:00.000Z', '2026-07-15T23:00:00.000Z')
    expect(parts.through).toBe('')
  })

  it('returns empty parts when there is no date, as date ideas have none', () => {
    expect(formatCardDate('')).toEqual({ dayName: '', dayNumber: '', monthYear: '', through: '' })
  })

  // All-day events store a date-only string. Parsed as UTC midnight that
  // lands on the previous evening in Eastern time, shifting the card a day.
  it('keeps an all-day date on its own day rather than shifting it back', () => {
    expect(formatCardDate('2026-07-25')).toEqual({
      dayName: 'SAT',
      dayNumber: '25',
      monthYear: 'July 2026',
      through: '',
    })
  })

  it('keeps both ends of a multi-day all-day event on their own days', () => {
    const parts = formatCardDate('2026-07-25', '2026-07-26')
    expect(parts.dayNumber).toBe('25')
    expect(parts.through).toBe('through Jul 26')
  })

  it('still handles a date-only value that ends the same day it starts', () => {
    expect(formatCardDate('2026-07-25', '2026-07-25').through).toBe('')
  })
})

describe('isFreePrice', () => {
  it('treats free-text prices mentioning free as free', () => {
    expect(isFreePrice('Free')).toBe(true)
    expect(isFreePrice('free with admission')).toBe(true)
  })

  it('treats a money amount as paid', () => {
    expect(isFreePrice('$15-30')).toBe(false)
    expect(isFreePrice('From $5')).toBe(false)
  })

  it('treats a missing price as not free rather than guessing', () => {
    expect(isFreePrice('')).toBe(false)
    expect(isFreePrice(undefined)).toBe(false)
  })
})

describe('category and vibe tags', () => {
  it('maps every schema category to an emoji and label', () => {
    for (const value of [
      'food_drink',
      'market',
      'art_culture',
      'beauty',
      'fashion',
      'wellness',
      'music',
      'vintage_thrift',
    ]) {
      expect(CATEGORY_LABELS[value]).toEqual(
        expect.objectContaining({ emoji: expect.any(String), label: expect.any(String) })
      )
    }
  })

  it('maps every schema vibe for the date idea column', () => {
    for (const value of ['romantic', 'adventurous', 'chill', 'foodie', 'cultural', 'free']) {
      expect(VIBE_LABELS[value]).toEqual(
        expect.objectContaining({ emoji: expect.any(String), label: expect.any(String) })
      )
    }
  })

  it('renders a tag as emoji plus label', () => {
    expect(getCategoryTag('beauty')).toBe('💄 Beauty')
  })

  it('returns an empty tag for an unknown or missing category', () => {
    expect(getCategoryTag('nonsense')).toBe('')
    expect(getCategoryTag(undefined)).toBe('')
  })
})

describe('getAreaLabel', () => {
  it('presents the borough enum as its display name', () => {
    expect(getAreaLabel('SoHo', 'manhattan')).toBe('SoHo, Manhattan')
    expect(getAreaLabel('', 'staten_island')).toBe('Staten Island')
    expect(getAreaLabel('', 'citywide')).toBe('Citywide')
  })

  it('uses the neighborhood alone when there is no borough', () => {
    expect(getAreaLabel('Chelsea', '')).toBe('Chelsea')
  })

  it('title-cases an unrecognised borough rather than dropping it', () => {
    expect(getAreaLabel('', 'jersey_city')).toBe('Jersey City')
  })

  it('returns an empty string when there is nothing to show', () => {
    expect(getAreaLabel('', '')).toBe('')
    expect(getAreaLabel(undefined, undefined)).toBe('')
  })
})

describe('card styles', () => {
  const css = read('resources/css/cards.css')

  it('hides redesigned cards by default so flag-off pages are unchanged', () => {
    expectCssToMatch(css, '.event-card { display: none; }')
  })

  it('gates the card behind the redesign flag scope', () => {
    expectCssToMatch(css, ":root[data-redesign='on'] .event-card")
    expectCssToMatch(css, 'body.redesign-enabled .event-card')
  })

  it('lays the card out in three columns on desktop', () => {
    expectCssToMatch(css, 'grid-template-columns: 150px 35% 1fr;')
  })

  it('uses the card surface treatment rather than the legacy pink tile', () => {
    expectCssToMatch(css, 'background-color: var(--nyc-white);')
    expectCssToMatch(css, 'border-radius: var(--radius-lg);')
    expectCssToMatch(css, 'box-shadow: var(--shadow-sm);')
  })

  it('truncates the description to three lines', () => {
    expectCssToMatch(css, '-webkit-line-clamp: 3;')
  })

  it('shrinks the date column on tablet and stacks it on mobile', () => {
    expectCssToMatch(css, 'grid-template-columns: 100px 35% 1fr;')
    expectCssToMatch(css, '@media (max-width: 599px)')
  })

  it('gives the featured variant a full-width image treatment', () => {
    expectCssToMatch(css, '.event-card--featured')
  })
})
