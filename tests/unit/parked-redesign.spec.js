/**
 * The 2026 redesign is parked (issue #403). Its source files stay on `main`
 * untouched for a future refactor, but they must not download on every page
 * load: ~313 KB of ~409 KB of JS + CSS on pop-ups.html never executed.
 *
 * These tests lock the unload in. If someone re-adds a parked module to a page
 * they will get a failure here pointing at the decision record, rather than a
 * silent 313 KB regression on the live site.
 */
const fs = require('node:fs')
const path = require('node:path')

const projectRoot = path.resolve(__dirname, '..', '..')

const PAGES = [
  'index.html',
  'pop-ups.html',
  'date-ideas.html',
  'calendar.html',
  'pop-up.html',
  'date-idea.html',
  'about.html',
  'contact_us.html',
  'privacy_policy.html',
]

/** Parked redesign modules — Epics 3-6. Source files remain in the repo. */
const PARKED_JS = [
  'search.js',
  'date-picker.js',
  'filters.js',
  'results-filter.js',
  'popups-filter.js',
  'dateideas-filter.js',
  'cards.js',
  'results-list.js',
  'popups-list.js',
  'dateideas-list.js',
  'modal.js',
  'results-modal.js',
  'popups-modal.js',
  'dateideas-modal.js',
  'popups-map.js',
  'popups-calendar.js',
]

const PARKED_CSS = [
  'search.css',
  'filters.css',
  'cards.css',
  'results.css',
  'popups-redesign.css',
  'dateideas-redesign.css',
  'map.css',
  'popups-calendar.css',
  'interior.css',
]

function read(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), 'utf8')
}

describe('parked redesign assets are not loaded', () => {
  PAGES.forEach(page => {
    describe(page, () => {
      PARKED_JS.forEach(module => {
        it(`does not load resources/js/${module}`, () => {
          expect(read(page)).not.toContain(`resources/js/${module}`)
        })
      })

      PARKED_CSS.forEach(sheet => {
        it(`does not load resources/css/${sheet}`, () => {
          expect(read(page)).not.toContain(`resources/css/${sheet}`)
        })
      })

      it('does not load the Leaflet vendor bundle', () => {
        expect(read(page)).not.toContain('resources/vendor/leaflet/')
      })
    })
  })
})

describe('redesign-flag.js is deliberately kept', () => {
  // It sets data-env on <html>, which analytics uses to exclude staging
  // traffic from reports. See #402 and #399.
  PAGES.forEach(page => {
    it(`${page} still loads redesign-flag.js`, () => {
      expect(read(page)).toContain('resources/js/redesign-flag.js')
    })
  })
})

describe('the legacy experience is intact', () => {
  it('pop-ups.html keeps the grid the legacy renderer targets', () => {
    const html = read('pop-ups.html')
    expect(html).toContain('id="popupsGrid"')
    expect(html).toContain('popups-grid')
    expect(html).toContain('resources/js/pop-ups.js')
  })

  it('date-ideas.html keeps the grid the legacy renderer targets', () => {
    const html = read('date-ideas.html')
    expect(html).toContain('id="dateIdeasGrid"')
    expect(html).toContain('date-ideas-grid')
    expect(html).toContain('resources/js/date-ideas.js')
  })

  it('keeps the prebuild injection markers', () => {
    expect(read('pop-ups.html')).toContain('<!-- STATIC_POPUPS_START -->')
    expect(read('pop-ups.html')).toContain('<!-- STATIC_POPUPS_END -->')
    expect(read('date-ideas.html')).toContain('<!-- STATIC_DATE_IDEAS_START -->')
    expect(read('date-ideas.html')).toContain('<!-- STATIC_DATE_IDEAS_END -->')
  })

  it('keeps the legacy calendar page intact', () => {
    const html = read('calendar.html')
    expect(html).toContain('resources/js/calendar.js')
    expect(html).toContain('resources/css/calendar.css')
  })

  it('keeps the homepage carousel', () => {
    expect(read('index.html')).toContain('resources/js/carousel.js')
  })
})

describe('parked redesign markup is removed from the list pages', () => {
  // The markup was hidden only by unscoped `display: none` defaults in
  // filters.css:9 and search.css:7. With those stylesheets unloaded the
  // markup would render visible and unstyled on the live site, so it has to
  // come out with them.
  it('pop-ups.html has no search bar, filter bar, or view toggle', () => {
    const html = read('pop-ups.html')
    expect(html).not.toContain('search-bar-container')
    expect(html).not.toContain('class="filter-bar"')
    expect(html).not.toContain('view-toggle')
    expect(html).not.toContain('results-count')
    expect(html).not.toContain('results__panel')
  })

  it('date-ideas.html has no search bar or filter bar', () => {
    const html = read('date-ideas.html')
    expect(html).not.toContain('search-bar-container')
    expect(html).not.toContain('class="filter-bar"')
    expect(html).not.toContain('results-count')
    expect(html).not.toContain('results__panel')
  })
})

describe('parked source files are preserved for the future refactor', () => {
  // #402 unloads them; it does not delete them. If these fail, someone has
  // deleted parked work that #403 says to keep.
  PARKED_JS.forEach(module => {
    it(`resources/js/${module} still exists`, () => {
      expect(fs.existsSync(path.join(projectRoot, 'resources/js', module))).toBe(true)
    })
  })

  PARKED_CSS.forEach(sheet => {
    it(`resources/css/${sheet} still exists`, () => {
      expect(fs.existsSync(path.join(projectRoot, 'resources/css', sheet))).toBe(true)
    })
  })
})
