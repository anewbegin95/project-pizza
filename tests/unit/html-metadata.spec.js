const fs = require('node:fs')
const path = require('node:path')

const projectRoot = path.resolve(__dirname, '..', '..')

function read(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), 'utf8')
}

describe('llms.txt', () => {
  it('exists at the project root', () => {
    const filePath = path.join(projectRoot, 'llms.txt')
    expect(fs.existsSync(filePath)).toBe(true)
  })

  it('starts with an H1 title', () => {
    const txt = read('llms.txt')
    expect(txt).toMatch(/^# NYC Slice of Life/)
  })

  it('contains a blockquote description', () => {
    const txt = read('llms.txt')
    expect(txt).toContain('> NYC Slice of Life')
  })

  it('lists all key static page URLs', () => {
    const txt = read('llms.txt')
    expect(txt).toContain('https://nycsliceoflife.com/')
    expect(txt).toContain('https://nycsliceoflife.com/pop-ups.html')
    expect(txt).toContain('https://nycsliceoflife.com/date-ideas.html')
    expect(txt).toContain('https://nycsliceoflife.com/calendar.html')
    expect(txt).toContain('https://nycsliceoflife.com/about.html')
    expect(txt).toContain('https://nycsliceoflife.com/contact_us.html')
  })

  it('contains a ## Pages section', () => {
    const txt = read('llms.txt')
    expect(txt).toContain('## Pages')
  })

  it('contains an ## Optional section with the privacy policy', () => {
    const txt = read('llms.txt')
    expect(txt).toContain('## Optional')
    expect(txt).toContain('https://nycsliceoflife.com/privacy_policy.html')
  })
})

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
})