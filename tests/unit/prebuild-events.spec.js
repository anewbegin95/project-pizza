const {
  generateCollectionJsonLd,
  generatePopupTileHtml,
  escapeHtml,
  mapSanityPopup,
  injectStaticTiles,
} = require('../../scripts/prebuild-events.js')
const os = require('node:os')
const fs = require('node:fs')
const path = require('node:path')

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
  it('returns a script tag with application/ld+json type', () => {
    const result = generateCollectionJsonLd([])
    expect(result).toContain('<script type="application/ld+json">')
    expect(result).toContain('</script>')
  })

  it('includes CollectionPage schema with correct name and url', () => {
    const result = generateCollectionJsonLd([])
    const match = result.match(/<script[^>]*>([\s\S]*?)<\/script>/)
    expect(match).not.toBeNull()
    const parsed = JSON.parse(match[1])
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
    const match = result.match(/<script[^>]*>([\s\S]*?)<\/script>/)
    const parsed = JSON.parse(match[1])
    const items = parsed.mainEntity.itemListElement
    expect(items).toHaveLength(1)
    expect(items[0]['@type']).toBe('ListItem')
    expect(items[0].position).toBe(1)
    expect(items[0].item['@type']).toBe('Event')
    expect(items[0].item.name).toBe('Pizza Pop-Up')
    expect(items[0].item.location.name).toBe('Brooklyn, NY')
  })

  it('skips popups that have neither a start date nor a location', () => {
    const popups = [
      { id: 'no-info', name: 'No Info', start_datetime: '', end_datetime: '', location: '', img: '' },
      { id: 'with-date', name: 'With Date', start_datetime: '2025-06-01T10:00:00', end_datetime: '', location: '', img: '' },
    ]
    const result = generateCollectionJsonLd(popups)
    const match = result.match(/<script[^>]*>([\s\S]*?)<\/script>/)
    const parsed = JSON.parse(match[1])
    expect(parsed.mainEntity.itemListElement).toHaveLength(1)
    expect(parsed.mainEntity.itemListElement[0].item.name).toBe('With Date')
  })
})

describe('injectStaticTiles', () => {
  let tmpFile

  beforeEach(() => {
    tmpFile = path.join(os.tmpdir(), `test-inject-${Date.now()}.html`)
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
