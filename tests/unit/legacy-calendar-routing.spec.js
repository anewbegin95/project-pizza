const fs = require('node:fs')
const path = require('node:path')

const { REDESIGN_CALENDAR_URL, buildRedirectTarget } = require('../../resources/js/legacy-calendar-redirect.js')

const projectRoot = path.resolve(__dirname, '..', '..')

function read(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), 'utf8')
}

describe('where the legacy calendar sends people', () => {
  it('targets the Pop-Ups page in calendar view', () => {
    expect(REDESIGN_CALENDAR_URL).toBe('pop-ups.html?view=calendar')
  })

  it('sends a plain visit straight there', () => {
    expect(buildRedirectTarget({ search: '' })).toBe('pop-ups.html?view=calendar')
  })

  it('carries the flag over when it came from the URL', () => {
    // Without this the destination resolves the flag from its environment
    // default — which is OFF everywhere — and the reader lands on the legacy
    // Pop-Ups page having asked for the redesigned calendar.
    expect(buildRedirectTarget({ search: '?redesign=on' })).toBe('pop-ups.html?view=calendar&redesign=on')
  })

  it('does not carry a flag that was switched off', () => {
    // ?redesign=off means the reader is not in the redesign, so the redirect
    // should not fire at all; if it somehow does, do not re-enable anything.
    expect(buildRedirectTarget({ search: '?redesign=off' })).toBe('pop-ups.html?view=calendar')
  })

  it('ignores unrelated parameters rather than dragging them along', () => {
    expect(buildRedirectTarget({ search: '?utm_source=newsletter' })).toBe('pop-ups.html?view=calendar')
  })

  it('survives a missing location', () => {
    expect(buildRedirectTarget(undefined)).toBe('pop-ups.html?view=calendar')
  })
})

describe('the Calendar link in the shared partials', () => {
  const header = read('partials/header.html')
  const footer = read('partials/footer.html')

  it('still points at the legacy page in the markup itself', () => {
    // The partials are shared by both experiences and injected at runtime, so
    // the flag-off experience has to be what the file literally says.
    expect(header).toContain('href="/calendar.html"')
    expect(footer).toContain('href="/calendar.html"')
  })

  it('carries the redesign target alongside it', () => {
    const matches = header.match(/data-redesign-href="\/pop-ups\.html\?view=calendar"/g) || []
    // Desktop and mobile nav lists both have one.
    expect(matches).toHaveLength(2)
    expect(footer).toContain('data-redesign-href="/pop-ups.html?view=calendar"')
  })
})
