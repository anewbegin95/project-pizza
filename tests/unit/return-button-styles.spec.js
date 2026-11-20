/**
 * The base `.return-button` rules live in resources/css/modals.css. Any page
 * that renders a `.return-button` must link that file, or the button falls
 * back to the browser's default grey button (pop-up.html did, after #372
 * retired the bare `button` styles that used to cover it).
 */
const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..', '..')
const pages = fs.readdirSync(root).filter((f) => f.endsWith('.html'))

describe('.return-button base styles', () => {
  const usingPages = pages.filter((p) =>
    fs.readFileSync(path.join(root, p), 'utf8').includes('return-button')
  )

  it('is used by at least the pop-up detail page', () => {
    expect(usingPages).toContain('pop-up.html')
  })

  it.each(usingPages)('%s links modals.css', (page) => {
    const html = fs.readFileSync(path.join(root, page), 'utf8')
    expect(html).toMatch(/<link[^>]+href="resources\/css\/modals\.css"/)
  })
})
