# Leaflet (vendored)

**Version:** 1.9.4
**Source:** https://unpkg.com/leaflet@1.9.4/dist/
**Files:** `leaflet.js`, `leaflet.css`

## Why this is committed rather than loaded from a CDN

REDESIGN.md §6.6 specifies "Leaflet.js (CDN, no build step required)", but every
page sets `script-src 'self'` in its Content-Security-Policy, which blocks a CDN
script outright — and `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`
blocks Leaflet's stylesheet too. Serving it same-origin keeps the policy intact
and still needs no build step. Decided in #299.

Only the JS and CSS are vendored. Leaflet's default marker PNGs are not needed:
§6.6 specifies emoji pins in circular divs, which use `L.divIcon`.

Map tiles come from OpenStreetMap over HTTPS and are permitted by the existing
`img-src 'self' data: https:`. No CSP change was required for any of this.

## Updating

Replace both files from the same path at the new version, update the version
above, and re-run `npm run test:e2e` — `tests/e2e/redesign-popups-map.spec.js`
covers pins, the legend and filter syncing.

SHA-384 of the files as committed, so a future update can be diffed
deliberately (computed locally at download time, not verified against an
independent publication of the hashes):

```
leaflet.js   cxOPjt7s7Iz04uaHJceBmS+qpjv2JkIHNVcuOrM+YHwZOmJGBXI00mdUXEq65HTH
leaflet.css  sHL9NAb7lN7rfvG5lfHpm643Xkcjzp4jFvuavGOndn6pjVqS6ny56CAt3nsEVT4H
```

## Licence

Leaflet is BSD-2-Clause. The licence text is retained in the header comment of
`leaflet.js`.
