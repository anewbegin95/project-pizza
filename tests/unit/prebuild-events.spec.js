const {
  generateCollectionJsonLd,
  generatePopupTileHtml,
  generateSitemap,
  escapeHtml,
  mapSanityPopup,
  mapSanityDateIdea,
  injectStaticTiles,
  formatPopupDate,
} = require('../../scripts/prebuild-events.js')
const os = require('node:os')
const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')

/** Extract and parse the JSON-LD payload from a generated script tag string. */
function parseJsonLd(scriptTagStr) {
  const firstBrace = scriptTagStr.indexOf('{')
  const lastBrace = scriptTagStr.lastIndexOf('}')
  return JSON.parse(scriptTagStr.slice(firstBrace, lastBrace + 1))
}

describe('escapeHtml', () => {
  it('escapes HTML special characters', () => {
    expect(escapeHtml('<script>alert("xss")</script>')).toBe(
      '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
    )
    expect(escapeHtml("it's")).toBe('it&#39;s')
    expect(escapeHtml('a & b')).toBe('a &amp; b')
  })

  it('returns empty string unchanged', () => {
    expect(escapeHtml('')).toBe('')
  })
})

describe('mapSanityPopup', () => {
  it('maps a Sanity document to a popup object', () => {
    const item = {
      _id: 'abc123',
      name: 'Test Pop-Up',
      slug: 'test-pop-up',
      start_datetime: '2025-06-01T10:00:00',
      end_datetime: '2025-06-01T14:00:00',
      all_day: false,
      recurring: false,
      category: 'food_drink',
      borough: 'brooklyn',
      neighborhood: 'Williamsburg',
      venue_name: 'Pizza Palace',
      address: '123 Main St, Brooklyn, NY',
      price: '$15–30',
      is_featured: true,
      location: 'Brooklyn, NY',
      display_overall: true,
      display_in_popups_page: true,
      imageUrl: 'https://cdn.example.com/img.jpg',
    }
    const result = mapSanityPopup(item)
    expect(result.id).toBe('test-pop-up')
    expect(result.name).toBe('Test Pop-Up')
    expect(result.location).toBe('Brooklyn, NY')
    expect(result.master_display).toBe('TRUE')
    expect(result.popups_page).toBe('TRUE')
    expect(result.img).toBe('https://cdn.example.com/img.jpg')
    expect(result.category).toBe('food_drink')
    expect(result.borough).toBe('brooklyn')
    expect(result.neighborhood).toBe('Williamsburg')
    expect(result.venue_name).toBe('Pizza Palace')
    expect(result.address).toBe('123 Main St, Brooklyn, NY')
    expect(result.price).toBe('$15–30')
    expect(result.is_featured).toBe(true)
  })

  it('provides default values when new fields are undefined', () => {
    const item = {
      _id: 'minimal123',
      name: 'Minimal Pop-Up',
      display_overall: true,
      display_in_popups_page: true,
    }
    const result = mapSanityPopup(item)
    expect(result.category).toBe('')
    expect(result.borough).toBe('')
    expect(result.neighborhood).toBe('')
    expect(result.venue_name).toBe('')
    expect(result.address).toBe('')
    expect(result.price).toBe('')
    expect(result.is_featured).toBe(false)
  })
})

describe('mapSanityDateIdea', () => {
  it('maps a Sanity document to a date idea object', () => {
    const item = {
      _id: 'idea123',
      name: 'Rooftop Dinner',
      slug: 'rooftop-dinner',
      vibe: 'romantic',
      budget: '30_to_75',
      borough: 'manhattan',
      neighborhood: 'Chelsea',
      venue_name: 'Sky Terrace',
      address: '456 W 23rd St, New York, NY',
      price: '$40 per person',
      is_featured: true,
      location: 'Chelsea, Manhattan',
      link: 'https://example.com',
      link_text: 'Book now',
      short_description: 'Dinner with a skyline view.',
      display_overall: true,
      imageUrl: 'https://cdn.example.com/idea.jpg',
    }
    const result = mapSanityDateIdea(item, 0)
    expect(result.id).toBe('rooftop-dinner')
    expect(result.name).toBe('Rooftop Dinner')
    expect(result.vibe).toBe('romantic')
    expect(result.budget).toBe('30_to_75')
    expect(result.borough).toBe('manhattan')
    expect(result.neighborhood).toBe('Chelsea')
    expect(result.venue_name).toBe('Sky Terrace')
    expect(result.address).toBe('456 W 23rd St, New York, NY')
    expect(result.price).toBe('$40 per person')
    expect(result.is_featured).toBe(true)
    expect(result.location).toBe('Chelsea, Manhattan')
    expect(result.link).toBe('https://example.com')
    expect(result.link_text).toBe('Book now')
    expect(result.short_desc).toBe('Dinner with a skyline view.')
    expect(result.img).toBe('https://cdn.example.com/idea.jpg')
    expect(result.master_display).toBe('TRUE')
  })

  it('provides default values when new fields are undefined', () => {
    const item = {
      _id: 'minimal-idea',
      name: 'Minimal Idea',
      display_overall: true,
    }
    const result = mapSanityDateIdea(item, 2)
    expect(result.id).toBe('minimal-idea')
    expect(result.vibe).toBe('')
    expect(result.budget).toBe('')
    expect(result.borough).toBe('')
    expect(result.neighborhood).toBe('')
    expect(result.venue_name).toBe('')
    expect(result.address).toBe('')
    expect(result.price).toBe('')
    expect(result.is_featured).toBe(false)
  })

  it('falls back to a slugified name plus index when slug and _id are missing', () => {
    const result = mapSanityDateIdea({ name: 'Art Gallery Tour!' }, 3)
    expect(result.id).toBe('art-gallery-tour-3')
    expect(result.master_display).toBe('FALSE')
  })
})

describe('generatePopupTileHtml', () => {
  it('generates a valid anchor element with title and location', () => {
    const popup = {
      id: 'pizza-pop-up',
      name: 'Pizza Pop-Up',
      start_datetime: '2025-06-01T10:00:00',
      end_datetime: '2025-06-01T14:00:00',
      all_day: 'FALSE',
      recurring: 'FALSE',
      location: 'Manhattan, NY',
      img: '',
    }
    const html = generatePopupTileHtml(popup)
    expect(html).toContain('Pizza Pop-Up')
    expect(html).toContain('Manhattan, NY')
    expect(html).toContain('href="pop-up.html?id=pizza-pop-up"')
    expect(html).toContain('class="popup-tile popup-tile--horizontal"')
  })

  it('escapes HTML special characters in popup fields', () => {
    const popup = {
      id: 'xss-test',
      name: '<b>Bold & Co.</b>',
      start_datetime: '',
      end_datetime: '',
      all_day: 'FALSE',
      recurring: 'FALSE',
      location: '"Location"',
      img: '',
    }
    const html = generatePopupTileHtml(popup)
    expect(html).not.toContain('<b>')
    expect(html).toContain('&lt;b&gt;')
    expect(html).toContain('&amp;')
    expect(html).toContain('&quot;Location&quot;')
  })
})

describe('generateCollectionJsonLd', () => {
  it('returns a script tag with application/ld+json type and data-static-jsonld attribute', () => {
    const result = generateCollectionJsonLd([])
    expect(result).toContain('<script type="application/ld+json"')
    expect(result).toContain('data-static-jsonld="collection-page"')
    expect(result).toContain('</script>')
  })

  it('includes CollectionPage schema with correct name and url', () => {
    const result = generateCollectionJsonLd([])
    const parsed = parseJsonLd(result)
    expect(parsed['@type']).toBe('CollectionPage')
    expect(parsed.name).toBe('Upcoming NYC Pop-Ups')
    expect(parsed.url).toContain('pop-ups.html')
    expect(parsed.mainEntity['@type']).toBe('ItemList')
  })

  it('includes popup events as ItemList entries', () => {
    const popups = [
      {
        id: 'pizza-pop-up',
        name: 'Pizza Pop-Up',
        start_datetime: '2025-06-01T10:00:00',
        end_datetime: '2025-06-01T14:00:00',
        location: 'Brooklyn, NY',
        img: 'https://cdn.example.com/img.jpg',
      },
    ]
    const result = generateCollectionJsonLd(popups)
    const parsed = parseJsonLd(result)
    const items = parsed.mainEntity.itemListElement
    expect(items).toHaveLength(1)
    expect(items[0]['@type']).toBe('ListItem')
    expect(items[0].position).toBe(1)
    expect(items[0].item['@type']).toBe('Event')
    expect(items[0].item.name).toBe('Pizza Pop-Up')
    expect(items[0].item.startDate).toBe('2025-06-01T10:00:00')
    expect(items[0].item.endDate).toBe('2025-06-01T14:00:00')
    expect(items[0].item.location.name).toBe('Brooklyn, NY')
  })

  it('skips popups that have neither a parseable start date nor a location', () => {
    const popups = [
      { id: 'no-info', name: 'No Info', start_datetime: '', end_datetime: '', location: '', img: '' },
      { id: 'ongoing', name: 'Ongoing Event', start_datetime: 'Ongoing', end_datetime: '', location: '', img: '' },
      { id: 'with-date', name: 'With Date', start_datetime: '2025-06-01T10:00:00', end_datetime: '', location: '', img: '' },
    ]
    const result = generateCollectionJsonLd(popups)
    const parsed = parseJsonLd(result)
    expect(parsed.mainEntity.itemListElement).toHaveLength(1)
    expect(parsed.mainEntity.itemListElement[0].item.name).toBe('With Date')
  })

  it('omits startDate/endDate when value is not a valid parseable date', () => {
    const popups = [
      {
        id: 'ongoing-with-loc',
        name: 'Ongoing Event',
        start_datetime: 'Ongoing',
        end_datetime: 'Ongoing',
        location: 'NYC',
        img: '',
      },
    ]
    const result = generateCollectionJsonLd(popups)
    const parsed = parseJsonLd(result)
    const item = parsed.mainEntity.itemListElement[0].item
    expect(item.startDate).toBeUndefined()
    expect(item.endDate).toBeUndefined()
    expect(item.location.name).toBe('NYC')
  })

  it('escapes < to \\u003c in serialized JSON to prevent script tag injection', () => {
    const popups = [
      {
        id: 'xss-event',
        name: 'Event </script><script>alert(1)</script>',
        start_datetime: '2025-06-01T10:00:00',
        end_datetime: '',
        location: 'NYC',
        img: '',
      },
    ]
    const result = generateCollectionJsonLd(popups)
    expect(result).not.toContain('</script><script>')
    expect(result).toContain('\\u003c/script')
  })
})

describe('injectStaticTiles', () => {
  let tmpFile

  beforeEach(() => {
    tmpFile = path.join(os.tmpdir(), `test-inject-${crypto.randomUUID()}.html`)
  })

  afterEach(() => {
    if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile)
  })

  it('replaces content between markers', () => {
    const initial = '<head><!-- START -->\n        <!-- END --></head>'
    fs.writeFileSync(tmpFile, initial, 'utf8')
    injectStaticTiles(tmpFile, '<p>Hello</p>', '<!-- START -->', '<!-- END -->')
    const result = fs.readFileSync(tmpFile, 'utf8')
    expect(result).toContain('<p>Hello</p>')
    expect(result).toContain('<!-- START -->')
    expect(result).toContain('<!-- END -->')
  })

  it('throws when markers are not found', () => {
    fs.writeFileSync(tmpFile, '<html></html>', 'utf8')
    expect(() =>
      injectStaticTiles(tmpFile, '<p>Hi</p>', '<!-- START -->', '<!-- END -->')
    ).toThrow(/Markers not found/)
  })
})

describe('generateSitemap', () => {
  it('returns a valid XML document with the urlset root element', () => {
    const xml = generateSitemap([], [])
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>')
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')
    expect(xml).toContain('</urlset>')
  })

  it('includes all static pages', () => {
    const xml = generateSitemap([], [])
    expect(xml).toContain('<loc>https://nycsliceoflife.com/</loc>')
    expect(xml).toContain('<loc>https://nycsliceoflife.com/pop-ups.html</loc>')
    expect(xml).toContain('<loc>https://nycsliceoflife.com/date-ideas.html</loc>')
    expect(xml).toContain('<loc>https://nycsliceoflife.com/calendar.html</loc>')
    expect(xml).toContain('<loc>https://nycsliceoflife.com/contact_us.html</loc>')
    expect(xml).toContain('<loc>https://nycsliceoflife.com/privacy_policy.html</loc>')
    expect(xml).toContain('<loc>https://nycsliceoflife.com/about.html</loc>')
  })

  it('includes a pop-up detail URL for each active popup', () => {
    const popups = [{ id: 'pizza-pop-up' }, { id: 'art-market' }]
    const xml = generateSitemap(popups, [])
    expect(xml).toContain('<loc>https://nycsliceoflife.com/pop-up.html?id=pizza-pop-up</loc>')
    expect(xml).toContain('<loc>https://nycsliceoflife.com/pop-up.html?id=art-market</loc>')
  })

  it('includes a date-idea detail URL for each active date idea', () => {
    const ideas = [{ id: 'rooftop-dinner' }, { id: 'art-gallery-tour' }]
    const xml = generateSitemap([], ideas)
    expect(xml).toContain('<loc>https://nycsliceoflife.com/date-idea.html?id=rooftop-dinner</loc>')
    expect(xml).toContain('<loc>https://nycsliceoflife.com/date-idea.html?id=art-gallery-tour</loc>')
  })

  it('includes changefreq and priority for every url entry', () => {
    const xml = generateSitemap([{ id: 'test-popup' }], [{ id: 'test-idea' }])
    const urlCount = (xml.match(/<url>/g) || []).length
    const changefreqCount = (xml.match(/<changefreq>/g) || []).length
    const priorityCount = (xml.match(/<priority>/g) || []).length
    expect(changefreqCount).toBe(urlCount)
    expect(priorityCount).toBe(urlCount)
  })

  it('includes a today lastmod date in YYYY-MM-DD format on every url', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2025-06-15T12:00:00Z'))
    try {
      const xml = generateSitemap([], [])
      const lastmodMatches = xml.match(/<lastmod>(\d{4}-\d{2}-\d{2})<\/lastmod>/g) || []
      expect(lastmodMatches.length).toBeGreaterThan(0)
      lastmodMatches.forEach(tag => expect(tag).toContain('2025-06-15'))
    } finally {
      vi.useRealTimers()
    }
  })

  it('URL-encodes special characters in dynamic IDs', () => {
    const popups = [{ id: 'event&<special>' }]
    const ideas = [{ id: 'idea&test' }]
    const xml = generateSitemap(popups, ideas)
    expect(xml).not.toContain('id=event&<special>')
    expect(xml).toContain('id=event%26%3Cspecial%3E')
    expect(xml).toContain('id=idea%26test')
  })
})

// The prebuild script keeps its own copy of the mapper and the date formatter
// (it is a Node script and cannot require the browser globals), so these
// mirror tests/unit/pop-ups.spec.js to stop the two copies drifting. See the
// query-duplication note in CLAUDE.md.
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
})

describe('formatPopupDate (prebuild copy)', () => {
  it('renders a single-day all-day event once', () => {
    expect(formatPopupDate('2026-10-17', '2026-10-17', 'TRUE', 'FALSE'))
      .toBe('Sat, Oct 17 (all day)')
  })

  it('collapses an all-day pair whose values arrive in different shapes', () => {
    expect(formatPopupDate('2026-07-24', '2026-07-24T23:00:00.000Z', 'TRUE', 'FALSE'))
      .toBe('Fri, Jul 24 (all day)')
  })

  it('renders a multi-day all-day event as a hyphenated range', () => {
    expect(formatPopupDate('2026-07-17', '2026-07-19', 'TRUE', 'FALSE'))
      .toBe('Fri, Jul 17 - Sun, Jul 19 (all day)')
  })

  it('returns the TBD copy when an all-day event has no dates at all', () => {
    expect(formatPopupDate('', '', 'TRUE', 'FALSE'))
      .toBe('Date and time to be announced')
  })
})

// generatePopupTileHtml is where the static HTML actually gets its date text,
// so this is the end-to-end guard for the no-JS listing.
describe('generatePopupTileHtml date rendering', () => {
  it('renders an all-day tile from start_date, not a stale datetime', () => {
    const popup = mapSanityPopup({
      slug: 'beyond-yoga-seek-beyond-open-air-concert',
      name: 'Beyond Yoga Seek Beyond Open Air Concert',
      all_day: true,
      start_date: '2026-10-17',
      end_date: '2026-10-17',
      start_datetime: '2026-09-17T16:53:00.000Z',
    })

    const html = generatePopupTileHtml(popup)

    expect(html).toContain('Sat, Oct 17 (all day)')
    expect(html).not.toContain('Sep 17')
  })
})
