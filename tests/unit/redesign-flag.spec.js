const {
  resolveEnvironment,
  resolveRedesignState,
  applyRedesignState,
} = require('../../resources/js/redesign-flag.js')

describe('redesign flag configuration', () => {
  it('detects known environments from hostname', () => {
    expect(resolveEnvironment('localhost', {})).toBe('development')
    expect(resolveEnvironment('staging.nycsliceoflife.com', {})).toBe('staging')
    expect(resolveEnvironment('nycsliceoflife.com', {})).toBe('production')
  })

  it('allows explicit env override from config', () => {
    const state = resolveRedesignState(
      { hostname: 'nycsliceoflife.com', href: 'https://nycsliceoflife.com/' },
      { env: 'staging', redesignByEnv: { staging: true } }
    )

    expect(state.environment).toBe('staging')
    expect(state.enabled).toBe(true)
    expect(state.source).toBe('environment-default')
  })

  it('supports URL-based QA overrides via ?redesign=on/off', () => {
    const enabled = resolveRedesignState(
      { hostname: 'nycsliceoflife.com', href: 'https://nycsliceoflife.com/?redesign=on' },
      {}
    )
    const disabled = resolveRedesignState(
      { hostname: 'localhost', href: 'http://localhost:4173/?redesign=off' },
      { redesignByEnv: { development: true } }
    )

    expect(enabled.enabled).toBe(true)
    expect(enabled.source).toBe('url-override')
    expect(disabled.enabled).toBe(false)
    expect(disabled.source).toBe('url-override')
  })

  it('uses explicit config.enabled when no URL override is present', () => {
    const state = resolveRedesignState(
      { hostname: 'nycsliceoflife.com', href: 'https://nycsliceoflife.com/' },
      { enabled: true, redesignByEnv: { production: false } }
    )

    expect(state.enabled).toBe(true)
    expect(state.source).toBe('config')
  })
})

describe('redesign flag DOM application', () => {
  function createDocumentMock() {
    const attrs = new Map()
    const bodyClasses = new Set()
    const documentElement = {
      setAttribute(name, value) {
        attrs.set(name, value)
      },
      removeAttribute(name) {
        attrs.delete(name)
      },
      getAttribute(name) {
        return attrs.get(name)
      },
    }

    return {
      attrs,
      bodyClasses,
      document: {
        documentElement,
        body: {
          classList: {
            toggle(name, enabled) {
              if (enabled) {
                bodyClasses.add(name)
              } else {
                bodyClasses.delete(name)
              }
            },
          },
        },
      },
    }
  }

  it('sets and clears redesign markers on root/body', () => {
    const mock = createDocumentMock()
    applyRedesignState(mock.document, { enabled: true, environment: 'staging' })
    expect(mock.attrs.get('data-env')).toBe('staging')
    expect(mock.attrs.get('data-redesign')).toBe('on')
    expect(mock.bodyClasses.has('redesign-enabled')).toBe(true)

    applyRedesignState(mock.document, { enabled: false, environment: 'production' })
    expect(mock.attrs.get('data-env')).toBe('production')
    expect(mock.attrs.has('data-redesign')).toBe(false)
    expect(mock.bodyClasses.has('redesign-enabled')).toBe(false)
  })
})
