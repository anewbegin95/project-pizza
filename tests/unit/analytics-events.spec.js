/**
 * Click-instrumentation unit tests (issue #399, part of the #160 analytics PRD).
 *
 * These run in plain Node with no jsdom, so the module under test is written
 * against four primitives a fake node can supply — `parentNode`, `tagName`,
 * `classList.contains` and `getAttribute` — rather than against `Element.closest`.
 * That is a testability constraint that pays for itself: the resolution rules
 * are the part of this issue most likely to be got wrong, and they are the part
 * a browser test can only reach one click at a time.
 *
 * WHERE `env` AND `page_type` ARE ASSERTED: on the gtag `config` call, in
 * `tests/unit/analytics.spec.js`. GA4 stamps config parameters onto every
 * event from the page, so an event carrying its own copy would be redundant
 * payload on every click — see the `track()` describe in that file.
 */
const fs = require('node:fs')
const path = require('node:path')

const {
  resolveClick,
  platformFor,
  destinationDomainFor,
  entryIdFromHref,
  monthsFromCurrent,
  createEvents,
} = require('../../resources/js/analytics-events.js')

const projectRoot = path.resolve(__dirname, '..', '..')

function read(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), 'utf8')
}

/** Comments have to name the flag to explain its absence; rules must not. */
function stripComments(source) {
  return source
    .replaceAll(/\/\*[\s\S]*?\*\//g, '')
    .replaceAll(/^[ \t]*\/\/.*$/gm, '')
}

/**
 * Minimal element stand-in. Only what the module actually touches, so a change
 * that reaches for a richer DOM API fails here rather than silently working in
 * one browser.
 */
function el(tag, options = {}, children = []) {
  const { classes = [], attrs = {}, text = '' } = options
  const node = {
    tagName: String(tag).toUpperCase(),
    parentNode: null,
    children,
    textContent: text,
    classList: { contains: (name) => classes.includes(name) },
    getAttribute: (name) => (name in attrs ? attrs[name] : null),
  }
  children.forEach((child) => { child.parentNode = node })
  if (!text && children.length > 0) {
    node.textContent = children.map((child) => child.textContent).join('')
  }
  return node
}

const CONTEXT = { origin: 'https://nycsliceoflife.com', now: new Date('2026-09-07T12:00:00Z') }

function resolve(target, context = {}) {
  return resolveClick(target, { ...CONTEXT, ...context })
}

// --- Page scaffolding, shaped like partials/header.html and footer.html ------

function headerLink(href, text, { mobile = false } = {}) {
  const link = el('a', { attrs: { href }, text })
  const list = el('li', {}, [link])
  const nav = el('nav', { classes: [mobile ? 'collapsible-menu' : 'main-nav'] }, [el('ul', {}, [list])])
  el('header', { classes: ['site-header'] }, [el('div', { classes: ['header-container'] }, [nav])])
  return link
}

function footerLink(href, text, { classes = ['site-footer__link'] } = {}) {
  const link = el('a', { classes, attrs: { href }, text })
  const nav = el('nav', { classes: ['site-footer__links'] }, [link])
  el('footer', { classes: ['site-footer'] }, [el('div', { classes: ['site-footer__content'] }, [nav])])
  return link
}

function tile(id, { index = 0, count = 3, type = 'popup', inDayGrid = false, anchor = true } = {}) {
  const href = type === 'popup' ? `pop-up.html?id=${id}` : `date-idea.html?id=${id}`
  const siblings = []
  for (let position = 0; position < count; position += 1) {
    siblings.push(el(anchor ? 'a' : 'div', {
      classes: ['popup-tile', 'popup-tile--horizontal'],
      attrs: anchor ? { href } : { 'data-analytics-id': id, 'data-analytics-type': type },
    }))
  }
  const target = siblings[index]
  if (anchor) {
    target.getAttribute = (name) => (name === 'href' ? href : null)
  }
  const gridClasses = inDayGrid ? ['day-popups-grid', 'popups-grid'] : ['popups-grid']
  el('section', { classes: gridClasses }, siblings)
  return target
}

function carouselSlide(id, position) {
  const name = el('div', { classes: ['carousel-popup-name'], text: 'Fixture' })
  const slide = el('div', {
    classes: ['carousel-slide'],
    attrs: { 'data-analytics-id': id, 'data-analytics-position': String(position) },
  }, [el('div', { classes: ['carousel-popup-overlay'] }, [name])])
  el('div', { attrs: { id: 'popupsCarousel' } }, [slide])
  return { slide, name }
}

function calendarBar(id) {
  const title = el('span', { classes: ['calendar-popup-bar__title'], text: 'Fixture Pop-Up' })
  const bar = el('div', { classes: ['calendar-popup-bar'], attrs: { 'data-event-id': id } }, [title])
  return { bar, title }
}

function monthButton(direction, displayedMonth) {
  const button = el('button', { classes: [`calendar-header__${direction}-month`] })
  el('div', {
    classes: ['calendar-header'],
    attrs: { 'data-analytics-month': displayedMonth },
  }, [button])
  return button
}

describe('the carousel dots and the consent bar are deliberately silent', () => {
  // Changing slide opens nothing, and no event in #160 §5 covers it. Inventing
  // a ninth name here would be permanent: GA4 never renames historical data.
  it('a carousel dot resolves to no event', () => {
    const dot = el('button', { classes: ['carousel-dot'] })
    const { slide } = carouselSlide('fixture-popup-1', 0)
    dot.parentNode = slide
    expect(resolve(dot)).toBeNull()
  })

  // The footer's Cookie settings control is an <a>-shaped button inside the
  // footer nav. Counting a privacy control as navigation would be its own
  // small dishonesty, and would pollute nav_click with it on every page.
  it('the footer cookie settings button resolves to no event', () => {
    const button = el('button', {
      classes: ['site-footer__link', 'nyc-consent__settings'],
      attrs: { 'data-consent-settings': '' },
      text: 'Cookie settings',
    })
    const nav = el('nav', { classes: ['site-footer__links'] }, [button])
    el('footer', { classes: ['site-footer'] }, [nav])
    expect(resolve(button)).toBeNull()
  })

  it('a click on nothing in particular resolves to no event', () => {
    expect(resolve(el('p', { text: 'Just some copy.' }))).toBeNull()
    expect(resolve(null)).toBeNull()
  })
})

describe('content_open resolves the surface it was opened from', () => {
  it('a pop-ups list tile is the list surface', () => {
    expect(resolve(tile('fixture-popup-2', { index: 1 }))).toEqual({
      name: 'content_open',
      params: { content_type: 'popup', surface: 'list', entry_id: 'fixture-popup-2', position: 1 },
    })
  })

  it('a date ideas tile is the list surface and a different content_type', () => {
    expect(resolve(tile('fixture-date-idea-1', { index: 0, type: 'date_idea' }))).toEqual({
      name: 'content_open',
      params: { content_type: 'date_idea', surface: 'list', entry_id: 'fixture-date-idea-1', position: 0 },
    })
  })

  // pop-ups.js builds its tiles as <div>s with no href (#404 makes them real
  // anchors), so the id has to come off a data attribute there.
  it('reads the id from a data attribute when the tile is not an anchor', () => {
    expect(resolve(tile('fixture-popup-3', { index: 2, anchor: false })).params).toMatchObject({
      entry_id: 'fixture-popup-3',
      position: 2,
      surface: 'list',
    })
  })

  it('a carousel slide is the carousel surface, at its own index', () => {
    const { slide } = carouselSlide('fixture-popup-1', 2)
    expect(resolve(slide)).toEqual({
      name: 'content_open',
      params: { content_type: 'popup', surface: 'carousel', entry_id: 'fixture-popup-1', position: 2 },
    })
  })

  it('a click on the name inside a slide resolves to the slide', () => {
    const { slide, name } = carouselSlide('fixture-popup-1', 0)
    expect(resolve(name)).toEqual(resolve(slide))
  })

  it('the carousel title opens whichever slide is showing', () => {
    const title = el('h2', {
      classes: ['carousel-title'],
      attrs: { 'data-analytics-id': 'fixture-popup-2', 'data-analytics-position': '1' },
      text: '✨ Featured Pop-Ups ✨',
    })
    expect(resolve(title)).toEqual({
      name: 'content_open',
      params: { content_type: 'popup', surface: 'carousel', entry_id: 'fixture-popup-2', position: 1 },
    })
  })

  // A bar sits on a date grid, not in an ordered list, so `position` has no
  // meaning here. Sending an invented ordinal would be worse than omitting it.
  it('a calendar bar is the calendar surface, with no position', () => {
    const { bar } = calendarBar('fixture-popup-1')
    expect(resolve(bar)).toEqual({
      name: 'content_open',
      params: { content_type: 'popup', surface: 'calendar', entry_id: 'fixture-popup-1' },
    })
  })

  // `data-event-id` is the per-occurrence key the segment highlighting uses,
  // so a multi-day pop-up carries several. Preferring it would split one
  // pop-up into several entry_ids in GA4 and undercount every long run.
  it('prefers the document id over the per-occurrence segment key', () => {
    const bar = el('div', {
      classes: ['calendar-popup-bar'],
      attrs: {
        'data-event-id': 'fixture-pop-up-1-2026-09-07T14-00-00.000Z',
        'data-analytics-id': 'fixture-popup-1',
      },
    })
    expect(resolve(bar).params.entry_id).toBe('fixture-popup-1')
  })

  it('a click on the bar title resolves to the bar', () => {
    const { bar, title } = calendarBar('fixture-popup-1')
    expect(resolve(title)).toEqual(resolve(bar))
  })

  // The "+N more" modal reuses the pop-ups grid markup, so without the
  // day-grid check these would be indistinguishable from list clicks.
  it('a tile inside the +N more day grid is the calendar_more surface', () => {
    expect(resolve(tile('fixture-popup-1', { index: 0, inDayGrid: true })).params).toMatchObject({
      surface: 'calendar_more',
      entry_id: 'fixture-popup-1',
    })
  })

  it('never reports a surface outside the four the property registered', () => {
    const surfaces = [
      resolve(tile('a', { index: 0 })),
      resolve(tile('b', { index: 0, inDayGrid: true })),
      resolve(carouselSlide('c', 0).slide),
      resolve(calendarBar('d').bar),
    ].map((event) => event.params.surface)
    expect(surfaces).toEqual(['list', 'calendar_more', 'carousel', 'calendar'])
  })
})

describe('nav_click distinguishes desktop from mobile navigation', () => {
  // §2.3: the same destinations appear in .main-nav and .collapsible-menu. Only
  // one is ever visible, so without this the two are indistinguishable and the
  // mobile-versus-desktop question the redesign brief needs cannot be answered.
  it('a header link reports header', () => {
    expect(resolve(headerLink('/pop-ups.html', 'Pop-Ups'))).toEqual({
      name: 'nav_click',
      params: { nav_location: 'header', link_text: 'Pop-Ups', destination: '/pop-ups.html' },
    })
  })

  it('the same link in the collapsible menu reports header_mobile', () => {
    expect(resolve(headerLink('/pop-ups.html', 'Pop-Ups', { mobile: true }))).toEqual({
      name: 'nav_click',
      params: { nav_location: 'header_mobile', link_text: 'Pop-Ups', destination: '/pop-ups.html' },
    })
  })

  it('a footer link reports footer', () => {
    expect(resolve(footerLink('/about.html', 'About')).params).toMatchObject({
      nav_location: 'footer',
      link_text: 'About',
    })
  })

  it('a homepage quick-nav button reports home_quicknav', () => {
    const button = el('a', { classes: ['btn', 'home-menu-btn'], attrs: { href: 'pop-ups.html' }, text: 'Upcoming NYC Pop-Ups' })
    el('section', { classes: ['home-menu'] }, [el('div', { classes: ['container'] }, [button])])
    expect(resolve(button)).toEqual({
      name: 'nav_click',
      params: { nav_location: 'home_quicknav', link_text: 'Upcoming NYC Pop-Ups', destination: 'pop-ups.html' },
    })
  })

  it('the site title is header navigation', () => {
    const link = el('a', { attrs: { href: '/' }, text: 'NYC Slice of Life 🍕' })
    const title = el('div', { classes: ['site-title'] }, [el('h1', {}, [link])])
    el('header', { classes: ['site-header'] }, [title])
    expect(resolve(link).params).toMatchObject({ nav_location: 'header', destination: '/' })
  })

  it('collapses the whitespace the markup wraps labels in', () => {
    const link = el('a', { attrs: { href: '/about.html' }, text: '\n        About Us\n      ' })
    el('nav', { classes: ['main-nav'] }, [link])
    el('header', { classes: ['site-header'] }, [link.parentNode])
    expect(resolve(link).params.link_text).toBe('About Us')
  })

  it('emits nothing for a link outside any known navigation region', () => {
    const link = el('a', { attrs: { href: '/about.html' }, text: 'About' })
    el('p', {}, [link])
    expect(resolve(link)).toBeNull()
  })
})

describe('social_click resolves the platform, including the one GA4 misses', () => {
  it.each([
    ['https://www.instagram.com/nycsliceoflife/', 'instagram'],
    ['https://www.tiktok.com/@nycsliceoflife', 'tiktok'],
    ['https://substack.com/@nycsliceoflife', 'substack'],
    ['mailto:NYCSliceofLife@gmail.com', 'email'],
  ])('%s is %s', (href, platform) => {
    expect(platformFor(href)).toBe(platform)
  })

  it('is not fooled by an unrelated destination', () => {
    expect(platformFor('/pop-ups.html')).toBeNull()
    expect(platformFor('https://example.com/instagram-lookalike')).toBeNull()
    expect(platformFor('')).toBeNull()
    expect(platformFor(null)).toBeNull()
  })

  // §2.5: GA4 enhanced measurement does not track mailto: at all, so without
  // this event the email link is invisible in every report.
  it('a footer mailto is a social_click, which is the only way it is counted', () => {
    const link = footerLink('mailto:NYCSliceofLife@gmail.com', 'NYCSliceofLife@gmail.com')
    expect(resolve(link)).toEqual({
      name: 'social_click',
      params: { platform: 'email', location: 'footer' },
    })
  })

  it('a header social icon reports the header placement', () => {
    const image = el('img', { classes: ['icon'] })
    const link = el('a', { attrs: { href: 'https://www.instagram.com/nycsliceoflife/' } }, [image])
    const icons = el('div', { classes: ['social-icons'] }, [link])
    el('header', { classes: ['site-header'] }, [el('div', { classes: ['header-actions'] }, [icons])])
    expect(resolve(image)).toEqual({
      name: 'social_click',
      params: { platform: 'instagram', location: 'header' },
    })
  })

  it('the homepage social row reports the home placement', () => {
    const link = el('a', { classes: ['social-icon-link', 'tiktok'], attrs: { href: 'https://www.tiktok.com/@nycsliceoflife' } })
    el('section', { classes: ['social-media-cta'] }, [el('div', { classes: ['social-icons'] }, [link])])
    expect(resolve(link)).toEqual({
      name: 'social_click',
      params: { platform: 'tiktok', location: 'home' },
    })
  })

  // The header's Substack entry is both a nav link and a social link. It is
  // counted as social so that "which placement earns social clicks" has one
  // answer per placement rather than an answer split across two events.
  it('a social destination inside the header nav is social, not navigation', () => {
    const link = headerLink('https://substack.com/@nycsliceoflife', 'Substack')
    expect(resolve(link)).toEqual({
      name: 'social_click',
      params: { platform: 'substack', location: 'header' },
    })
  })
})

describe('calendar_month_change', () => {
  it('reports the direction and where that lands relative to this month', () => {
    expect(resolve(monthButton('next', '2026-09'))).toEqual({
      name: 'calendar_month_change',
      params: { direction: 'next', months_from_current: 1 },
    })
    expect(resolve(monthButton('prev', '2026-09'))).toEqual({
      name: 'calendar_month_change',
      params: { direction: 'prev', months_from_current: -1 },
    })
  })

  it('counts from the month on screen, not from today', () => {
    expect(resolve(monthButton('next', '2026-11')).params.months_from_current).toBe(3)
    expect(resolve(monthButton('prev', '2026-07')).params.months_from_current).toBe(-3)
  })

  it('crosses a year boundary without wrapping', () => {
    expect(monthsFromCurrent('2027-01', CONTEXT.now)).toBe(4)
    expect(monthsFromCurrent('2025-09', CONTEXT.now)).toBe(-12)
  })

  it('reports the direction alone when the month on screen is unreadable', () => {
    expect(resolve(monthButton('next', 'not-a-month'))).toEqual({
      name: 'calendar_month_change',
      params: { direction: 'next' },
    })
  })
})

describe('the mobile menu', () => {
  // "toggle" conflates opening and closing (§5), so this fires only on the
  // open. The handler runs in the capture phase, before the class is flipped,
  // so a menu that is closed now is a menu this click is about to open.
  it('fires menu_open when the menu is currently closed', () => {
    const toggle = el('button', { classes: ['menu-toggle'], text: '=' })
    const menu = el('nav', { classes: ['collapsible-menu'] })
    el('div', { classes: ['header-container'] }, [toggle, menu])
    expect(resolve(toggle)).toEqual({ name: 'menu_open', params: {} })
  })

  it('fires nothing when the same button is about to close the menu', () => {
    const toggle = el('button', { classes: ['menu-toggle'], text: 'x' })
    const menu = el('nav', { classes: ['collapsible-menu', 'open'] })
    menu.classList = { contains: (name) => ['collapsible-menu', 'open'].includes(name) }
    el('div', { classes: ['header-container'] }, [toggle, menu])
    expect(resolve(toggle)).toBeNull()
  })
})

describe('the detail pages', () => {
  function detailPage(children) {
    return el('section', { classes: ['popup-detail'] }, [el('div', { classes: ['popup-detail__content'] }, children)])
  }

  it('Learn More is an outbound_click carrying the domain it left for', () => {
    const link = el('a', { attrs: { id: 'popupExternalLink', href: 'https://example-popup-1.test/tickets' }, text: 'Learn More' })
    detailPage([link])
    expect(resolve(link, { search: '?id=fixture-popup-1' })).toEqual({
      name: 'outbound_click',
      params: {
        content_type: 'popup',
        entry_id: 'fixture-popup-1',
        destination_domain: 'example-popup-1.test',
      },
    })
  })

  it('reports date_idea on the date idea detail page', () => {
    const link = el('a', { attrs: { id: 'popupExternalLink', href: 'https://example-date-idea-1.test/details' } })
    detailPage([link])
    expect(resolve(link, { search: '?id=fixture-date-idea-1', pathname: '/date-idea.html' }).params.content_type)
      .toBe('date_idea')
  })

  it('Add to Calendar is a content_save', () => {
    const link = el('a', { classes: ['modal-link'], attrs: { id: 'popupICSLink', href: '#' }, text: 'Add to Calendar' })
    detailPage([link])
    expect(resolve(link, { search: '?id=fixture-popup-1' })).toEqual({
      name: 'content_save',
      params: { entry_id: 'fixture-popup-1' },
    })
  })

  // Multi-day pop-ups render one link per day, built at runtime.
  it('a per-day Add to Calendar link is a content_save too', () => {
    const link = el('a', { classes: ['modal-link'], attrs: { href: '#' }, text: 'Add Sat, Jun 1 to Calendar' })
    const container = el('div', { classes: ['ics-links-container'] }, [link])
    detailPage([container])
    expect(resolve(link, { search: '?id=fixture-popup-2' }).name).toBe('content_save')
  })

  it('reads a destination domain without carrying the path or query', () => {
    expect(destinationDomainFor('https://www.example.com/tickets?utm=x')).toBe('www.example.com')
    expect(destinationDomainFor('/pop-ups.html')).toBeNull()
    expect(destinationDomainFor('not a url')).toBeNull()
  })

  it('reads an entry id out of a detail url', () => {
    expect(entryIdFromHref('pop-up.html?id=fixture-popup-1')).toBe('fixture-popup-1')
    expect(entryIdFromHref('/date-idea.html?id=a-b-c&other=1')).toBe('a-b-c')
    expect(entryIdFromHref('/pop-ups.html')).toBeNull()
    expect(entryIdFromHref(null)).toBeNull()
  })
})

describe('nothing is sent without consent', () => {
  function createHarness(sent) {
    const listeners = {}
    const doc = {
      addEventListener: (type, handler, options) => { listeners[type] = { handler, options } },
      documentElement: { getAttribute: () => 'production' },
    }
    const analytics = { track: (name, params) => { sent.push({ name, params }); return true } }
    return { doc, listeners, analytics }
  }

  it('routes every resolved event through NycAnalytics.track and nowhere else', () => {
    const sent = []
    const { doc, listeners, analytics } = createHarness(sent)
    createEvents({ document: doc, analytics, location: { origin: CONTEXT.origin, search: '', pathname: '/' } }).start()

    listeners.click.handler({ target: tile('fixture-popup-1', { index: 0 }) })
    expect(sent).toEqual([{
      name: 'content_open',
      params: { content_type: 'popup', surface: 'list', entry_id: 'fixture-popup-1', position: 0 },
    }])
  })

  // track() refuses on anything but `granted`, so the consent gate stays in one
  // file. This asserts the events module has not grown a second way out.
  it('never reaches for window.gtag or the dataLayer itself', () => {
    const code = stripComments(read('resources/js/analytics-events.js'))
    expect(code).not.toContain('dataLayer')
    expect(code).not.toMatch(/\bgtag\b/)
  })

  it('binds in the capture phase so a stopPropagation cannot hide a click', () => {
    const sent = []
    const { doc, listeners, analytics } = createHarness(sent)
    createEvents({ document: doc, analytics, location: { origin: CONTEXT.origin, search: '', pathname: '/' } }).start()

    expect(listeners.click.options).toMatchObject({ capture: true })
    expect(listeners.keydown.options).toMatchObject({ capture: true })
  })

  it('does nothing at all when there is no analytics module to send through', () => {
    const { doc, listeners } = createHarness([])
    expect(() => {
      createEvents({ document: doc, analytics: null, location: { origin: CONTEXT.origin } }).start()
      listeners.click.handler({ target: tile('fixture-popup-1', { index: 0 }) })
    }).not.toThrow()
  })
})

describe('keyboard activation counts, and only for the keys that navigate', () => {
  function press(key, target) {
    const sent = []
    const listeners = {}
    const doc = {
      addEventListener: (type, handler, options) => { listeners[type] = { handler, options } },
      documentElement: { getAttribute: () => 'production' },
    }
    createEvents({
      document: doc,
      analytics: { track: (name, params) => { sent.push({ name, params }); return true } },
      location: { origin: CONTEXT.origin, search: '', pathname: '/' },
    }).start()
    listeners.keydown.handler({ key, target })
    return sent
  }

  it('Enter on a carousel slide opens content, because that is what it does', () => {
    expect(press('Enter', carouselSlide('fixture-popup-1', 0).slide)).toEqual([{
      name: 'content_open',
      params: { content_type: 'popup', surface: 'carousel', entry_id: 'fixture-popup-1', position: 0 },
    }])
  })

  it('Enter on a calendar bar opens content', () => {
    expect(press('Enter', calendarBar('fixture-popup-1').bar)[0].name).toBe('content_open')
  })

  it('Tab and Escape do not', () => {
    expect(press('Tab', carouselSlide('fixture-popup-1', 0).slide)).toEqual([])
    expect(press('Escape', carouselSlide('fixture-popup-1', 0).slide)).toEqual([])
  })

  // A real <a> or <button> fires a click of its own on Enter; counting the
  // keydown too would double every keyboard navigation.
  it('Enter on a real link is left to the click it already fires', () => {
    expect(press('Enter', headerLink('/pop-ups.html', 'Pop-Ups'))).toEqual([])
  })
})

describe('no parameter can carry anything a visitor typed', () => {
  it('sends only the parameter names the property registered', () => {
    const REGISTERED = ['content_type', 'surface', 'entry_id', 'position', 'nav_location',
      'platform', 'link_text', 'destination', 'direction', 'months_from_current',
      'location', 'destination_domain']
    const resolved = [
      resolve(tile('a', { index: 0 })),
      resolve(carouselSlide('b', 0).slide),
      resolve(calendarBar('c').bar),
      resolve(headerLink('/pop-ups.html', 'Pop-Ups')),
      resolve(footerLink('mailto:NYCSliceofLife@gmail.com', 'Email')),
      resolve(monthButton('next', '2026-09')),
    ]
    resolved.forEach((event) => {
      Object.keys(event.params).forEach((key) => expect(REGISTERED).toContain(key))
    })
  })

  // #399's checklist reads "env present on every event". It is — GA4 stamps
  // every config parameter onto every event from the page, and page_type and
  // env are set on the config in analytics.js (asserted there). Repeating them
  // per event would be redundant payload on every click, so their absence from
  // the list above is the correct implementation rather than a gap.
  it('leaves env and page_type to the config instead of repeating them', () => {
    const params = resolve(tile('a', { index: 0 })).params
    expect(params).not.toHaveProperty('env')
    expect(params).not.toHaveProperty('page_type')

    const analyticsCode = stripComments(read('resources/js/analytics.js'))
    expect(analyticsCode).toMatch(/page_type:/)
    expect(analyticsCode).toMatch(/env:/)
  })

  it('uses lowercase snake_case names under 40 characters, as GA4 requires', () => {
    const names = ['content_open', 'nav_click', 'calendar_month_change', 'social_click',
      'outbound_click', 'content_save', 'menu_open']
    names.forEach((name) => {
      expect(name).toMatch(/^[a-z][a-z0-9_]*$/)
      expect(name.length).toBeLessThan(40)
    })
  })
})

describe('analytics-events.js is deliberately ungated', () => {
  const js = read('resources/js/analytics-events.js')
  const code = stripComments(js)

  // Same inversion as consent.js and analytics.js: the flag is off in every
  // environment and the redesign is parked (#403), so a gate here would mean
  // the site collects a consent decision and then measures nothing.
  it('never consults the redesign flag as a gate', () => {
    expect(code).not.toContain('isEnabled')
    expect(code).not.toContain('REDESIGN_FLAG')
  })

  it('records why the house gating rule is inverted here', () => {
    expect(js).toMatch(/NOT a redesign component/i)
  })
})

describe('the module is shipped by every page, after the loader', () => {
  const PAGES = [
    'index.html', 'pop-ups.html', 'date-ideas.html', 'calendar.html', 'pop-up.html',
    'date-idea.html', 'about.html', 'contact_us.html', 'privacy_policy.html',
  ]

  PAGES.forEach((page) => {
    it(`${page} defers it and orders it after analytics.js`, () => {
      const html = read(page)
      expect(html).toMatch(/<script src="resources\/js\/analytics-events\.js" defer><\/script>/)
      expect(html.indexOf('resources/js/analytics-events.js'))
        .toBeGreaterThan(html.indexOf('resources/js/analytics.js" defer'))
    })
  })
})
