const fs = require('node:fs')
const path = require('node:path')

const projectRoot = path.resolve(__dirname, '..', '..')

function read(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), 'utf8')
}

describe('static html metadata', () => {
  it('homepage has title metadata attributes and hero heading', () => {
    const html = read('index.html')
    expect(html).toContain('data-title="NYC Slice of Life"')
    expect(html).toContain('<h1>Welcome to NYC Slice of Life!</h1>')
  })

  it('contact page includes mailto action', () => {
    const html = read('contact_us.html')
    expect(html).toContain('mailto:NYCSliceofLife@gmail.com')
  })

  it('pop-ups listing page has static Open Graph meta tags', () => {
    const html = read('pop-ups.html')
    expect(html).toContain('property="og:title"')
    expect(html).toContain('property="og:description"')
    expect(html).toContain('property="og:image"')
    expect(html).toContain('property="og:type"')
    expect(html).toContain('property="og:url"')
  })

  it('pop-up detail page has static Open Graph meta tags', () => {
    const html = read('pop-up.html')
    expect(html).toContain('property="og:title"')
    expect(html).toContain('property="og:description"')
    expect(html).toContain('property="og:image"')
    expect(html).toContain('property="og:type"')
  })

  it('pop-ups listing page has JSON-LD injection markers in <head>', () => {
    const html = read('pop-ups.html')
    expect(html).toContain('<!-- STATIC_JSONLD_START -->')
    expect(html).toContain('<!-- STATIC_JSONLD_END -->')
    // Markers must appear inside <head> and in the correct order
    const headEnd = html.indexOf('</head>')
    const markerStart = html.indexOf('<!-- STATIC_JSONLD_START -->')
    const markerEnd = html.indexOf('<!-- STATIC_JSONLD_END -->')
    expect(markerStart).toBeGreaterThan(-1)
    expect(markerEnd).toBeGreaterThan(-1)
    expect(markerStart).toBeLessThan(markerEnd)
    expect(markerStart).toBeLessThan(headEnd)
    expect(markerEnd).toBeLessThan(headEnd)
  })
})