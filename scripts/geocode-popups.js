#!/usr/bin/env node
/**
 * Geocodes pop-up and date-idea locations via Nominatim (OpenStreetMap,
 * free/no API key) and writes latitude/longitude plus the derived borough back
 * into Sanity, so the map view and the borough filter read them through the
 * same public GROQ queries as every other field. CMS editors never enter
 * coordinates or a borough by hand.
 *
 * Location text comes from the `location` field, falling back to `address` for
 * the handful of older documents that used the retired venue_name + address
 * pair. Nominatim chokes on the parenthetical asides editors habitually add
 * ("112 East 11th St (Moxy East Village)"), so a stripped variant is tried too.
 *
 * A local cache (data/geocode-cache.json) keyed by venue name + address means
 * unchanged addresses are never re-queried against Nominatim on later runs.
 *
 * Usage:
 *   SANITY_WRITE_TOKEN=xxx node scripts/geocode-popups.js
 *   node scripts/geocode-popups.js --dry-run   # geocode + log, skip the Sanity write
 */

'use strict';

const https = require('https');
const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Sanity config — keep in sync with resources/js/sanity-client.js
// ---------------------------------------------------------------------------
const SANITY_PROJECT_ID = '41kk82h2';
const SANITY_DATASET = 'production';
const SANITY_API_VERSION = '2024-01-01';

const CACHE_PATH = path.resolve(__dirname, '..', 'data', 'geocode-cache.json');

// Nominatim usage policy: identify the app via User-Agent and throttle to
// max 1 request/second. https://operations.osmfoundation.org/policies/nominatim/
const NOMINATIM_USER_AGENT = 'nyc-slice-of-life-geocoder/1.0 (https://github.com/anewbegin95/project-pizza)';
const NOMINATIM_THROTTLE_MS = 1100;

/**
 * Bounding box around the five boroughs. Sent to Nominatim as a bounded
 * viewbox and re-checked on the response, because loosening the query chain
 * makes far-away false positives easy: "Washington & Water St (Brooklyn)"
 * matched a Washington/Water intersection in Syracuse, 250 miles upstate,
 * which would have written a map pin there.
 */
const NYC_BOUNDS = { minLat: 40.47, maxLat: 40.93, minLon: -74.28, maxLon: -73.68 };

/**
 * GROQ query — pop-ups and date ideas that have location text but are still
 * missing coordinates or a derived borough. Borough is included in the
 * condition so documents geocoded before borough derivation existed get
 * picked up on the next run rather than staying blank forever.
 */
const DOCS_NEEDING_GEOCODE_QUERY = `*[_type in ["pop-ups", "date_ideas"]
  && ((defined(location) && location != "") || (defined(address) && address != ""))
  && (!defined(latitude) || !defined(longitude) || !defined(borough))] {
  _id,
  _type,
  venue_name,
  address,
  location
}`;

/**
 * Nominatim labels the borough in `suburb`, and names the county when it does
 * not. Both are mapped to the schema's borough values. "Citywide" is never
 * derived — it is an editorial choice, not a geocoding result.
 */
const BOROUGH_BY_SUBURB = {
  'manhattan': 'manhattan',
  'brooklyn': 'brooklyn',
  'queens': 'queens',
  'bronx': 'bronx',
  'the bronx': 'bronx',
  'staten island': 'staten_island',
};

const BOROUGH_BY_COUNTY = {
  'new york county': 'manhattan',
  'kings county': 'brooklyn',
  'queens county': 'queens',
  'bronx county': 'bronx',
  'richmond county': 'staten_island',
};

// ---------------------------------------------------------------------------
// Sanity API (read via public CDN, write via authenticated Mutate API)
// ---------------------------------------------------------------------------

function sanityFetch(query, timeoutMs = 15000) {
    return new Promise((resolve, reject) => {
        const url = new URL(
            `https://${SANITY_PROJECT_ID}.apicdn.sanity.io/v${SANITY_API_VERSION}/data/query/${SANITY_DATASET}`
        );
        url.searchParams.set('query', query);
        url.searchParams.set('perspective', 'published');

        const req = https.get(url.toString(), { headers: { Accept: 'application/json' } }, res => {
            let data = '';
            res.on('data', chunk => { data += chunk; });
            res.on('end', () => {
                clearTimeout(timer);
                if (res.statusCode !== 200) {
                    reject(new Error(`Sanity request failed with HTTP ${res.statusCode}. Body: ${data.slice(0, 300)}`));
                    return;
                }
                try {
                    const parsed = JSON.parse(data);
                    if (parsed.error) {
                        reject(new Error(`Sanity API error: ${JSON.stringify(parsed.error)}`));
                    } else if (Array.isArray(parsed.result)) {
                        resolve(parsed.result);
                    } else {
                        reject(new Error(`Unexpected Sanity response shape: ${data.slice(0, 300)}`));
                    }
                } catch (e) {
                    reject(new Error(`Failed to parse Sanity response as JSON: ${e.message}`));
                }
            });
        });

        const timer = setTimeout(() => {
            req.destroy(new Error(`Sanity request timed out after ${timeoutMs}ms`));
        }, timeoutMs);

        req.on('error', err => {
            clearTimeout(timer);
            reject(err);
        });
    });
}

/**
 * Parses a Sanity Mutate API response, throwing on a non-2xx status or on
 * an `error` field in the body (Sanity's documented error shape is a non-2xx
 * status, but this check is defensive, matching sanityFetch's same check on
 * the read side).
 */
function parseMutateResponse(statusCode, rawBody) {
    if (statusCode < 200 || statusCode >= 300) {
        throw new Error(`Sanity mutate failed with HTTP ${statusCode}. Body: ${rawBody.slice(0, 500)}`);
    }

    let parsed;
    try {
        parsed = JSON.parse(rawBody);
    } catch (e) {
        throw new Error(`Failed to parse Sanity mutate response as JSON: ${e.message}`);
    }

    if (parsed.error) {
        throw new Error(`Sanity mutate error: ${JSON.stringify(parsed.error)}`);
    }

    return parsed;
}

function sanityMutate(mutations, token, timeoutMs = 15000) {
    return new Promise((resolve, reject) => {
        const body = JSON.stringify({ mutations });
        const url = new URL(
            `https://${SANITY_PROJECT_ID}.api.sanity.io/v${SANITY_API_VERSION}/data/mutate/${SANITY_DATASET}`
        );

        const req = https.request(
            url,
            {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(body),
                },
            },
            res => {
                let data = '';
                res.on('data', chunk => { data += chunk; });
                res.on('end', () => {
                    clearTimeout(timer);
                    try {
                        parseMutateResponse(res.statusCode, data);
                        resolve();
                    } catch (err) {
                        reject(err);
                    }
                });
            }
        );

        const timer = setTimeout(() => {
            req.destroy(new Error(`Sanity mutate request timed out after ${timeoutMs}ms`));
        }, timeoutMs);

        req.on('error', err => {
            clearTimeout(timer);
            reject(err);
        });

        req.write(body);
        req.end();
    });
}

// ---------------------------------------------------------------------------
// Nominatim geocoding
// ---------------------------------------------------------------------------

function geocodeAddress(queryText, timeoutMs = 15000) {
    return new Promise((resolve, reject) => {
        const url = new URL('https://nominatim.openstreetmap.org/search');
        url.searchParams.set('format', 'json');
        url.searchParams.set('limit', '1');
        url.searchParams.set('q', queryText);
        url.searchParams.set('addressdetails', '1');
        url.searchParams.set(
            'viewbox',
            `${NYC_BOUNDS.minLon},${NYC_BOUNDS.maxLat},${NYC_BOUNDS.maxLon},${NYC_BOUNDS.minLat}`
        );
        url.searchParams.set('bounded', '1');

        const req = https.get(
            url,
            { headers: { 'User-Agent': NOMINATIM_USER_AGENT, Accept: 'application/json' } },
            res => {
                let data = '';
                res.on('data', chunk => { data += chunk; });
                res.on('end', () => {
                    clearTimeout(timer);
                    if (res.statusCode !== 200) {
                        reject(new Error(`Nominatim request failed with HTTP ${res.statusCode}`));
                        return;
                    }
                    try {
                        const parsed = JSON.parse(data);
                        if (Array.isArray(parsed) && parsed.length > 0) {
                            const lat = parseFloat(parsed[0].lat);
                            const lon = parseFloat(parsed[0].lon);
                            // Treat an out-of-area hit as a miss so the next
                            // candidate query gets its turn.
                            resolve(
                                isWithinNycBounds(lat, lon)
                                    ? { lat, lon, borough: normalizeBorough(parsed[0].address) }
                                    : null
                            );
                        } else {
                            resolve(null);
                        }
                    } catch (e) {
                        reject(new Error(`Failed to parse Nominatim response: ${e.message}`));
                    }
                });
            }
        );

        const timer = setTimeout(() => {
            req.destroy(new Error(`Nominatim request timed out after ${timeoutMs}ms`));
        }, timeoutMs);

        req.on('error', err => {
            clearTimeout(timer);
            reject(err);
        });
    });
}

// ---------------------------------------------------------------------------
// Cache + helpers
// ---------------------------------------------------------------------------

/** Builds the cache key for a pop-up's location. Kept stable (venue + address
 * + suffix) so existing cache entries stay valid even as the query strategy
 * evolves. */
function normalizeAddressKey(venueName, address) {
    const parts = [venueName, address].map(s => (s || '').trim()).filter(Boolean);
    if (parts.length === 0) return '';
    return `${parts.join(', ')}, New York, NY`;
}

/** Whether a geocoded point falls inside the NYC bounding box. */
function isWithinNycBounds(lat, lon) {
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;
    return (
        lat >= NYC_BOUNDS.minLat &&
        lat <= NYC_BOUNDS.maxLat &&
        lon >= NYC_BOUNDS.minLon &&
        lon <= NYC_BOUNDS.maxLon
    );
}

/**
 * Maps a Nominatim address breakdown onto one of the schema's borough values.
 * `suburb` carries the borough name for every NYC result seen so far; `county`
 * is the fallback for the results that omit it. Returns null when neither
 * resolves, which is the right answer for an address outside the five
 * boroughs as well as for a lookup that landed somewhere unexpected.
 */
function normalizeBorough(address) {
    if (!address || typeof address !== 'object') return null;
    const suburb = String(address.suburb || '').trim().toLowerCase();
    if (BOROUGH_BY_SUBURB[suburb]) return BOROUGH_BY_SUBURB[suburb];
    const county = String(address.county || '').trim().toLowerCase();
    if (BOROUGH_BY_COUNTY[county]) return BOROUGH_BY_COUNTY[county];
    return null;
}

/**
 * Drops parenthetical asides and collapses the whitespace they leave behind.
 * Editors use them for venue names and cross streets ("199 Avenue B (Pavlo
 * Mochi)"), and Nominatim returns no match at all rather than ignoring them.
 */
function stripParentheticals(text) {
    return String(text == null ? '' : text)
        .replace(/\([^)]*\)?/g, ' ')
        .replace(/\s{2,}/g, ' ')
        .replace(/\s*,\s*$/, '')
        .trim();
}

/** Appends ", New York, NY" unless the text already names New York / NY. */
function withCitySuffix(text) {
    return /new york|,\s*ny\b/i.test(text) ? text : `${text}, New York, NY`;
}

/**
 * Ordered Nominatim query candidates for a document, most to least precise:
 * the location text as written, an intersection-friendly "&" → "and" variant,
 * the same two with parenthetical asides stripped, then the venue name alone
 * as a landmark lookup (catches parks, plazas, and stores whose location text
 * Nominatim can't parse). Duplicates collapse, so text without an ampersand or
 * a parenthesis produces the same short list it always did.
 */
function buildGeocodeQueries(venueName, address) {
    const venue = (venueName || '').trim();
    const addr = (address || '').trim();
    const queries = [];

    const withVariants = (text) => {
        if (!text) return;
        queries.push(withCitySuffix(text));
        if (text.includes('&')) {
            queries.push(withCitySuffix(text.replace(/\s*&\s*/g, ' and ')));
        }
    };

    withVariants(addr);
    withVariants(stripParentheticals(addr));
    if (venue) {
        queries.push(withCitySuffix(venue));
    }
    return [...new Set(queries)];
}

function loadCache() {
    try {
        return JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'));
    } catch (err) {
        if (err.code === 'ENOENT') return {};
        throw err;
    }
}

function saveCache(cache) {
    fs.mkdirSync(path.dirname(CACHE_PATH), { recursive: true });
    fs.writeFileSync(CACHE_PATH, `${JSON.stringify(cache, null, 2)}\n`, 'utf8');
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Resolves coordinates for a cache key, trying each candidate query against
 * Nominatim until one matches. Cached coordinates are trusted, but a cached
 * null miss is retried — addresses get fixed and the query strategy improves,
 * so misses must not be permanent. Throttles after every real network attempt
 * — success or failure — so a failing address can't skip the 1 req/sec delay
 * before the next call.
 */
async function resolveCoordinates(key, queries, cache, deps = {}) {
    const geocode = deps.geocode || geocodeAddress;
    const wait = deps.sleep || sleep;

    // A hit from before borough derivation existed has no `borough` key, so it
    // is treated as a miss rather than pinning the document to a blank borough.
    if (cache[key] && Object.prototype.hasOwnProperty.call(cache[key], 'borough')) {
        return { coords: cache[key], cacheDirty: false };
    }

    const hadCachedMiss = Object.prototype.hasOwnProperty.call(cache, key);
    let coords = null;
    for (const query of queries) {
        try {
            coords = await geocode(query);
        } finally {
            await wait(NOMINATIM_THROTTLE_MS);
        }
        if (coords) break;
    }

    cache[key] = coords;
    return { coords, cacheDirty: !(hadCachedMiss && coords === null) };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
    const dryRun = process.argv.includes('--dry-run');
    const token = process.env.SANITY_WRITE_TOKEN;

    if (!dryRun && !token) {
        console.error('SANITY_WRITE_TOKEN environment variable is required (or pass --dry-run to skip writing back to Sanity).');
        process.exit(1);
    }

    console.log('Fetching pop-ups and date ideas missing coordinates or a borough...');
    let docs;
    try {
        docs = await sanityFetch(DOCS_NEEDING_GEOCODE_QUERY);
    } catch (err) {
        console.error('Failed to fetch documents from Sanity:', err.message);
        process.exit(1);
    }
    console.log(`Found ${docs.length} document(s) to geocode.`);

    const cache = loadCache();
    let cacheDirty = false;
    const mutations = [];
    let geocoded = 0;
    let skipped = 0;
    let failed = 0;
    let boroughsResolved = 0;

    for (const doc of docs) {
        // `location` is the field editors actually fill in; `address` is the
        // retired one, kept as a fallback for older documents.
        const locationText = (doc.location || doc.address || '').trim();
        const key = normalizeAddressKey(doc.venue_name, locationText);
        const queries = buildGeocodeQueries(doc.venue_name, locationText);
        if (!key || queries.length === 0) {
            skipped++;
            continue;
        }

        let coords;
        try {
            const result = await resolveCoordinates(key, queries, cache);
            coords = result.coords;
            if (result.cacheDirty) cacheDirty = true;
        } catch (err) {
            console.warn(`Geocoding failed for "${key}": ${err.message}`);
            failed++;
            continue;
        }

        if (!coords) {
            console.warn(`No geocoding match for "${key}" — skipping.`);
            skipped++;
            continue;
        }

        const set = { latitude: coords.lat, longitude: coords.lon };
        // Only write a borough we actually resolved. Blanking one that an
        // editor set by hand before the field went read-only would be a
        // silent regression.
        if (coords.borough) {
            set.borough = coords.borough;
            boroughsResolved++;
        } else {
            console.warn(`No borough resolved for "${key}" — leaving it unset.`);
        }

        mutations.push({ patch: { id: doc._id, set } });
        geocoded++;
    }

    if (cacheDirty) {
        saveCache(cache);
        console.log(`Updated geocode cache at ${path.relative(process.cwd(), CACHE_PATH)}.`);
    }

    if (mutations.length === 0) {
        console.log('No coordinate updates to write back to Sanity.');
    } else if (dryRun) {
        console.log(`Dry run: would write coordinates for ${mutations.length} document(s) to Sanity (${boroughsResolved} with a borough).`);
    } else {
        try {
            await sanityMutate(mutations, token);
            console.log(`Wrote coordinates for ${mutations.length} document(s) back to Sanity (${boroughsResolved} with a borough).`);
        } catch (err) {
            console.error('Failed to write coordinates back to Sanity:', err.message);
            process.exit(1);
        }
    }

    console.log(`Done. Geocoded: ${geocoded}, skipped: ${skipped}, failed: ${failed}.`);
}

if (require.main === module) {
    main().catch(err => {
        console.error(err);
        process.exit(1);
    });
}

module.exports = { normalizeAddressKey, buildGeocodeQueries, stripParentheticals, normalizeBorough, isWithinNycBounds, geocodeAddress, sanityFetch, sanityMutate, parseMutateResponse, loadCache, saveCache, resolveCoordinates };
