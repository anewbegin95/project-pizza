const { defineConfig } = require('@playwright/test')

module.exports = defineConfig({
  testDir: './tests/e2e',

  // The 2026 redesign is parked (issue #403) and its assets are unloaded from
  // every page (issue #402), so these specs have no live components to drive.
  // The source files and their ~32 unit specs are untouched on `main` — those
  // still run on every PR and keep the parked logic verified for the future
  // refactor into a new design system.
  //
  // To reactivate: revert the #402 unload, then delete this line.
  testIgnore: '**/redesign-*.spec.js',

  timeout: 30_000,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    headless: true
  },
  webServer: {
    command: 'npx http-server . -p 4173',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: true,
    timeout: 120_000
  }
})
