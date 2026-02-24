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
})