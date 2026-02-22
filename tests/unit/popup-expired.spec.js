const fs = require('node:fs')
const path = require('node:path')
const { runInNewContext } = require('node:vm')

const projectRoot = path.resolve(__dirname, '..', '..')

function loadPopupsJs() {
  const src = fs.readFileSync(
    path.join(projectRoot, 'resources/js/pop-ups.js'),
    'utf8'
  )
  // Provide minimal browser-like globals so the file evaluates without error
  const ctx = {
    window: {},
    document: { addEventListener: () => {}, querySelector: () => null },
    console,
  }
  runInNewContext(src, ctx)
  return ctx
}

const ctx = loadPopupsJs()
const isPopupExpired = ctx.isPopupExpired
const getEasternYMD = ctx.getEasternYMD

// Helper: build a minimal mapped popup object
function makePopup(end_datetime) {
  return { end_datetime }
}

// Get Eastern-time YYYY-MM-DD strings for today and yesterday
function easternDateOffset(offsetDays) {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return getEasternYMD(d)
}

describe('isPopupExpired', () => {
  it('returns false when end_datetime is empty', () => {
    expect(isPopupExpired(makePopup(''))).toBe(false)
  })

  it('returns false when end_datetime is undefined', () => {
    expect(isPopupExpired(makePopup(undefined))).toBe(false)
  })

  it('returns false when end_datetime is "Ongoing"', () => {
    expect(isPopupExpired(makePopup('Ongoing'))).toBe(false)
  })

  it('returns false when end_datetime is "ongoing" (case-insensitive)', () => {
    expect(isPopupExpired(makePopup('ongoing'))).toBe(false)
  })

  it('returns true for a past datetime', () => {
    expect(isPopupExpired(makePopup('2020-01-01 10:00:00'))).toBe(true)
  })

  it('returns false for a future datetime', () => {
    expect(isPopupExpired(makePopup('2099-12-31 23:59:00'))).toBe(false)
  })

  it('returns true for a past date-only value (day before today in Eastern time)', () => {
    const yesterday = easternDateOffset(-1)
    expect(isPopupExpired(makePopup(yesterday))).toBe(true)
  })

  it('returns false for today\'s date (whole day should remain visible)', () => {
    const today = easternDateOffset(0)
    expect(isPopupExpired(makePopup(today))).toBe(false)
  })

  it('returns false for a future date-only value', () => {
    expect(isPopupExpired(makePopup('2099-12-31'))).toBe(false)
  })

  it('returns false when end_datetime is an invalid string', () => {
    expect(isPopupExpired(makePopup('not-a-date'))).toBe(false)
  })
})
