#!/usr/bin/env node
/**
 * Content validation for redesign surfaces (issue #286).
 *
 * Queries production Sanity content and reports which active documents are
 * missing fields the redesigned pages filter, search, or render on cards.
 * Scope is deliberately limited to content that appears on redesign surfaces:
 * pop-ups that are visible and not yet ended, and date ideas with
 * display_overall enabled. Expired/hidden documents are not validated.
 *
 * Usage:
 *   node scripts/validate-content.js          # human-readable checklist
 *   node scripts/validate-content.js --json   # machine-readable output
 *
 * Exits 1 when any validated document has gaps, so it can gate CI or be run
 * before content-dependent launches.
 */

'use strict';

const https = require('https');

// ---------------------------------------------------------------------------
// Sanity config — keep in sync with resources/js/sanity-client.js
// ---------------------------------------------------------------------------
const SANITY_PROJECT_ID = '41kk82h2';
const SANITY_DATASET = 'production';
const SANITY_API_VERSION = '2024-01-01';

/** Active = visible overall and not ended (or no end date at all). */
const ACTIVE_POPUPS_QUERY = `*[_type == "pop-ups" && display_overall == true && (
  (defined(end_datetime) && end_datetime >= now()) ||
  (defined(end_date) && end_date >= string(now())[0..9]) ||
  (!defined(end_datetime) && !defined(end_date))
)] | order(name asc) {
  name,
  category,
  borough,
  neighborhood,
  venue_name,
  address,
  latitude,
  longitude,
  price,
  short_description,
  "hasImage": defined(image)
}`;

const DISPLAYED_DATE_IDEAS_QUERY = `*[_type == "date_ideas" && display_overall == true] | order(name asc) {
  name,
  vibe,
  budget,
  borough,
  neighborhood,
  venue_name,
  address,
  price,
  short_description,
  "hasImage": defined(image)
}`;

/**
 * Fields the redesigned pop-ups experience filters or renders on cards.
 * latitude/longitude are intentionally excluded: they are auto-populated
 * from `address` by the scheduled geocode-popups workflow, so `address`
 * is the field editors must fill.
 */
const POPUP_REQUIRED_FIELDS = [
  'category',
  'borough',
  'neighborhood',
  'venue_name',
  'address',
  'price',
  'short_description',
  'hasImage',
];

/** Fields the redesigned date ideas experience filters or renders on cards. */
const DATE_IDEA_REQUIRED_FIELDS = [
  'vibe',
  'budget',
  'borough',
  'neighborhood',
  'venue_name',
  'address',
  'price',
  'short_description',
  'hasImage',
];

function isMissing(value) {
  return value === null || value === undefined || value === '' || value === false;
}

/**
 * Returns one entry per document that has gaps: {name, missing: [field, ...]}.
 * Documents with every required field populated are omitted.
 */
function validateDocs(docs, requiredFields) {
    return docs
        .map(doc => ({
            name: doc.name || '(unnamed)',
            missing: requiredFields.filter(field => isMissing(doc[field])),
        }))
        .filter(entry => entry.missing.length > 0);
}

function fetchQuery(query) {
    const url = `https://${SANITY_PROJECT_ID}.apicdn.sanity.io/v${SANITY_API_VERSION}/data/query/${SANITY_DATASET}?query=${encodeURIComponent(query)}`;
    return new Promise((resolve, reject) => {
        https.get(url, res => {
            let data = '';
            res.on('data', chunk => { data += chunk; });
            res.on('end', () => {
                if (res.statusCode !== 200) {
                    reject(new Error(`Sanity query failed with HTTP ${res.statusCode}: ${data}`));
                    return;
                }
                try {
                    resolve(JSON.parse(data).result);
                } catch (err) {
                    reject(err);
                }
            });
        }).on('error', reject);
    });
}

function printReport(label, docs, gaps) {
    console.log(`\n=== ${label}: ${docs.length} active document(s), ${gaps.length} with gaps ===`);
    if (gaps.length === 0) {
        console.log('  ✅ All required fields populated.');
        return;
    }
    for (const entry of gaps) {
        console.log(`  ❌ ${entry.name}: missing ${entry.missing.join(', ')}`);
    }
}

async function main() {
    const asJson = process.argv.includes('--json');
    const [popups, dateIdeas] = await Promise.all([
        fetchQuery(ACTIVE_POPUPS_QUERY),
        fetchQuery(DISPLAYED_DATE_IDEAS_QUERY),
    ]);

    const popupGaps = validateDocs(popups, POPUP_REQUIRED_FIELDS);
    const dateIdeaGaps = validateDocs(dateIdeas, DATE_IDEA_REQUIRED_FIELDS);

    if (asJson) {
        console.log(JSON.stringify({
            popups: { total: popups.length, gaps: popupGaps },
            dateIdeas: { total: dateIdeas.length, gaps: dateIdeaGaps },
        }, null, 2));
    } else {
        printReport('Pop-ups (visible, not ended)', popups, popupGaps);
        printReport('Date ideas (displayed)', dateIdeas, dateIdeaGaps);
        console.log();
    }

    if (popupGaps.length > 0 || dateIdeaGaps.length > 0) {
        process.exitCode = 1;
    }
}

if (require.main === module) {
    main().catch(err => {
        console.error('Content validation failed:', err.message);
        process.exit(2);
    });
}

module.exports = {
    validateDocs,
    POPUP_REQUIRED_FIELDS,
    DATE_IDEA_REQUIRED_FIELDS,
    ACTIVE_POPUPS_QUERY,
    DISPLAYED_DATE_IDEAS_QUERY,
};
