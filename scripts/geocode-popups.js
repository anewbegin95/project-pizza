#!/usr/bin/env node
/**
 * Geocodes pop-up addresses via Nominatim (OpenStreetMap, free/no API key) and
 * writes the resulting latitude/longitude back into Sanity, so the map view
 * can read coordinates through the same public GROQ queries as every other
 * field. CMS editors never enter coordinates by hand.
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

/** GROQ query — pop-ups with an address but no geocoded coordinates yet. */
const POPUPS_MISSING_COORDS_QUERY = `*[_type == "pop-ups" && defined(address) && address != "" && (!defined(latitude) || !defined(longitude))] {
  _id,
  venue_name,
  address
}`;

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
                            resolve({ lat: parseFloat(parsed[0].lat), lon: parseFloat(parsed[0].lon) });
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

/** Appends ", New York, NY" unless the text already names New York / NY. */
function withCitySuffix(text) {
    return /new york|,\s*ny\b/i.test(text) ? text : `${text}, New York, NY`;
}

/**
 * Ordered Nominatim query candidates for a pop-up, most to least precise:
 * the street address, an intersection-friendly "&" → "and" variant, then the
 * venue name alone as a landmark lookup (catches parks, plazas, and stores
 * whose address text Nominatim can't parse).
 */
function buildGeocodeQueries(venueName, address) {
    const venue = (venueName || '').trim();
    const addr = (address || '').trim();
    const queries = [];
    if (addr) {
        queries.push(withCitySuffix(addr));
        if (addr.includes('&')) {
            queries.push(withCitySuffix(addr.replace(/\s*&\s*/g, ' and ')));
        }
    }
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

    if (cache[key]) {
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

    console.log('Fetching pop-ups with an address but no coordinates yet...');
    let popups;
    try {
        popups = await sanityFetch(POPUPS_MISSING_COORDS_QUERY);
    } catch (err) {
        console.error('Failed to fetch pop-ups from Sanity:', err.message);
        process.exit(1);
    }
    console.log(`Found ${popups.length} pop-up(s) to geocode.`);

    const cache = loadCache();
    let cacheDirty = false;
    const mutations = [];
    let geocoded = 0;
    let skipped = 0;
    let failed = 0;

    for (const popup of popups) {
        const key = normalizeAddressKey(popup.venue_name, popup.address);
        const queries = buildGeocodeQueries(popup.venue_name, popup.address);
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

        mutations.push({
            patch: {
                id: popup._id,
                set: { latitude: coords.lat, longitude: coords.lon },
            },
        });
        geocoded++;
    }

    if (cacheDirty) {
        saveCache(cache);
        console.log(`Updated geocode cache at ${path.relative(process.cwd(), CACHE_PATH)}.`);
    }

    if (mutations.length === 0) {
        console.log('No coordinate updates to write back to Sanity.');
    } else if (dryRun) {
        console.log(`Dry run: would write coordinates for ${mutations.length} pop-up(s) to Sanity.`);
    } else {
        try {
            await sanityMutate(mutations, token);
            console.log(`Wrote coordinates for ${mutations.length} pop-up(s) back to Sanity.`);
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

module.exports = { normalizeAddressKey, buildGeocodeQueries, geocodeAddress, sanityFetch, sanityMutate, parseMutateResponse, loadCache, saveCache, resolveCoordinates };
