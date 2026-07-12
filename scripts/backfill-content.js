#!/usr/bin/env node
/**
 * Content backfill for redesign surfaces (issue #286).
 *
 * Reads proposed field values from data/content-backfill.json and patches them
 * into Sanity via the Mutate API. Strictly additive: a proposal is only
 * applied to fields that are currently missing or empty on the live document,
 * so re-running is safe and editor changes are never overwritten.
 *
 * Usage:
 *   node scripts/backfill-content.js --dry-run    # show planned patches, no writes
 *   SANITY_WRITE_TOKEN=xxx node scripts/backfill-content.js
 *
 * Run scripts/validate-content.js afterwards to confirm no gaps remain.
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

const PROPOSALS_PATH = path.join(__dirname, '..', 'data', 'content-backfill.json');

function isMissing(value) {
    return value === null || value === undefined || value === '';
}

/**
 * Builds Sanity patch mutations from proposals, setting only fields that are
 * missing on the current document. Proposal fields valued null are treated as
 * "no proposal" and skipped. Throws if a proposal targets an unknown _id so a
 * stale proposals file fails loudly instead of silently doing nothing.
 */
function buildPatches(currentDocs, proposals) {
    const docsById = new Map(currentDocs.map(doc => [doc._id, doc]));
    const patches = [];
    for (const proposal of proposals) {
        const doc = docsById.get(proposal._id);
        if (!doc) {
            throw new Error(`Proposal targets unknown document _id "${proposal._id}"`);
        }
        const set = {};
        for (const [field, value] of Object.entries(proposal.fields)) {
            if (value !== null && isMissing(doc[field])) {
                set[field] = value;
            }
        }
        if (Object.keys(set).length > 0) {
            patches.push({ patch: { id: proposal._id, set } });
        }
    }
    return patches;
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

function mutate(mutations, token) {
    const body = JSON.stringify({ mutations });
    const url = new URL(
        `https://${SANITY_PROJECT_ID}.api.sanity.io/v${SANITY_API_VERSION}/data/mutate/${SANITY_DATASET}`
    );
    return new Promise((resolve, reject) => {
        const req = https.request(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body),
                Authorization: `Bearer ${token}`,
            },
        }, res => {
            let data = '';
            res.on('data', chunk => { data += chunk; });
            res.on('end', () => {
                if (res.statusCode !== 200) {
                    reject(new Error(`Sanity mutate failed with HTTP ${res.statusCode}. Body: ${data.slice(0, 500)}`));
                    return;
                }
                resolve(JSON.parse(data));
            });
        });
        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

async function main() {
    const dryRun = process.argv.includes('--dry-run');
    const token = process.env.SANITY_WRITE_TOKEN;
    if (!dryRun && !token) {
        console.error('SANITY_WRITE_TOKEN environment variable is required (or pass --dry-run to preview without writing).');
        process.exit(1);
    }

    const proposals = JSON.parse(fs.readFileSync(PROPOSALS_PATH, 'utf8'));
    const ids = proposals.map(p => p._id);
    const currentDocs = await fetchQuery(
        `*[_id in ${JSON.stringify(ids)}]{ _id, name, category, vibe, budget, borough, neighborhood, venue_name, address, price, short_description }`
    );

    const patches = buildPatches(currentDocs, proposals);
    if (patches.length === 0) {
        console.log('Nothing to backfill — all proposed fields are already populated.');
        return;
    }

    const docsById = new Map(currentDocs.map(doc => [doc._id, doc]));
    for (const { patch } of patches) {
        const name = docsById.get(patch.id).name;
        console.log(`${dryRun ? '[dry-run] ' : ''}${name}:`);
        for (const [field, value] of Object.entries(patch.set)) {
            console.log(`    ${field} = ${JSON.stringify(value)}`);
        }
    }

    if (dryRun) {
        console.log(`\n[dry-run] Would patch ${patches.length} document(s). Re-run with SANITY_WRITE_TOKEN to apply.`);
        return;
    }

    const result = await mutate(patches, token);
    console.log(`\nPatched ${result.results ? result.results.length : patches.length} document(s) (transaction ${result.transactionId}).`);
    console.log('Run `node scripts/validate-content.js` to confirm no gaps remain.');
}

if (require.main === module) {
    main().catch(err => {
        console.error('Backfill failed:', err.message);
        process.exit(2);
    });
}

module.exports = { buildPatches };
