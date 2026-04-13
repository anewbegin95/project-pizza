#!/usr/bin/env node
/**
 * Prebuild script: generates llms.txt at the project root so that AI crawlers
 * and LLMs can discover the site's key URLs.
 *
 * File format follows the llms.txt convention (https://llmstxt.org/):
 *   - H1 title
 *   - Blockquote description
 *   - One or more ## sections each containing markdown links with descriptions
 *
 * Static page entries are always written.  Pop-up events and date ideas are
 * fetched from Sanity and appended so that llms.txt stays current after each
 * build.  If the Sanity fetch fails the script exits with a non-zero code so
 * the CI pipeline surfaces the failure rather than silently shipping a stale
 * file.
 *
 * Usage:
 *   node scripts/generate-llms-txt.js
 */

'use strict';

const https = require('https');
const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Config — keep in sync with sanity-client.js and prebuild-events.js
// ---------------------------------------------------------------------------
const BASE_URL = 'https://nycsliceoflife.com';
const SANITY_PROJECT_ID = '41kk82h2';
const SANITY_DATASET = 'production';
const SANITY_API_VERSION = '2024-01-01';

/** Active pop-ups — only those that should appear on the pop-ups listing page */
const POPUPS_QUERY = `*[_type == "pop-ups" && display_overall == true] | order(coalesce(start_datetime, start_date) asc) {
  _id,
  name,
  "slug": slug.current,
  short_description,
  "display_in_popups_page": select(
    defined(end_datetime) && end_datetime < now() => false,
    defined(end_date) && end_date < now() => false,
    display_in_popups_page
  )
}`;

/** Active date ideas */
const DATE_IDEAS_QUERY = `*[_type == "date_ideas" && display_overall == true] | order(name asc) {
  _id,
  name,
  "slug": slug.current,
  short_description
}`;

// ---------------------------------------------------------------------------
// Static site pages
// ---------------------------------------------------------------------------
const STATIC_PAGES = [
    {
        url: `${BASE_URL}/`,
        label: 'Homepage',
        description: 'Discover upcoming NYC pop-ups, curated date ideas, and weekend plans for locals and visitors.',
    },
    {
        url: `${BASE_URL}/pop-ups.html`,
        label: 'Upcoming NYC Pop-ups',
        description: 'Browse all active and upcoming NYC pop-up events, from beauty and art to installations and more.',
    },
    {
        url: `${BASE_URL}/date-ideas.html`,
        label: 'Date Ideas',
        description: 'Curated NYC date ideas and unique things to do, for locals and visitors alike.',
    },
    {
        url: `${BASE_URL}/calendar.html`,
        label: 'Events Calendar',
        description: 'Full calendar view of upcoming NYC pop-up events.',
    },
    {
        url: `${BASE_URL}/about.html`,
        label: 'About Us',
        description: 'Learn about NYC Slice of Life — a curated guide born from a love of exploring NYC beyond the 9 to 5.',
    },
    {
        url: `${BASE_URL}/contact_us.html`,
        label: 'Contact Us',
        description: 'Get in touch with the NYC Slice of Life team.',
    },
];

const OPTIONAL_PAGES = [
    {
        url: `${BASE_URL}/privacy_policy.html`,
        label: 'Privacy Policy',
        description: 'Site privacy policy and data practices.',
    },
];

// ---------------------------------------------------------------------------
// Sanity API fetch (no third-party dependencies)
// ---------------------------------------------------------------------------
function sanityFetch(query, timeoutMs = 15000) {
    return new Promise((resolve, reject) => {
        const encodedQuery = encodeURIComponent(query);
        const apiUrl = `https://${SANITY_PROJECT_ID}.api.sanity.io/v${SANITY_API_VERSION}/data/query/${SANITY_DATASET}?query=${encodedQuery}`;

        const req = https.get(apiUrl, res => {
            let data = '';
            res.on('data', chunk => { data += chunk; });
            res.on('end', () => {
                clearTimeout(timer);
                const { statusCode } = res;
                const contentType = res.headers['content-type'] || '';
                if (statusCode !== 200) {
                    reject(new Error(
                        `Sanity request failed with HTTP ${statusCode}. ` +
                        `Body: ${data.slice(0, 300)}`
                    ));
                    return;
                }
                if (!contentType.includes('application/json')) {
                    reject(new Error(
                        `Unexpected content-type "${contentType}". ` +
                        `Body: ${data.slice(0, 300)}`
                    ));
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
                    reject(new Error(`Failed to parse Sanity response as JSON: ${e.message}. Body: ${data.slice(0, 300)}`));
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

// ---------------------------------------------------------------------------
// Slug → URL helpers
// ---------------------------------------------------------------------------
function popupUrl(item) {
    const id = item.slug || item._id;
    return `${BASE_URL}/pop-up.html?id=${id}`;
}

function dateIdeaUrl(item) {
    const id = item.slug || item._id;
    return `${BASE_URL}/date-idea.html?id=${id}`;
}

// ---------------------------------------------------------------------------
// llms.txt builder
// ---------------------------------------------------------------------------
function buildLlmsTxt(popups, dateIdeas) {
    const lines = [];

    lines.push('# NYC Slice of Life');
    lines.push('');
    lines.push('> NYC Slice of Life is a curated guide for NYC pop-ups, date ideas, and weekend plans.');
    lines.push('> Born from a love of exploring the city beyond the 9 to 5, it spotlights everything');
    lines.push('> from beauty pop-ups to art installations, helping locals and visitors make the most');
    lines.push('> of their nights and weekends in New York City.');
    lines.push('');
    lines.push('> See also: sitemap.xml for a complete machine-readable page index.');
    lines.push('');

    // --- Static pages ---
    lines.push('## Pages');
    lines.push('');
    for (const page of STATIC_PAGES) {
        lines.push(`- [${page.label}](${page.url}): ${page.description}`);
    }
    lines.push('');

    // --- Pop-up events ---
    const visiblePopups = popups.filter(
        p => String(p.display_in_popups_page).toLowerCase() !== 'false'
    );
    if (visiblePopups.length > 0) {
        lines.push('## Pop-up Events');
        lines.push('');
        for (const popup of visiblePopups) {
            const desc = popup.short_description
                ? popup.short_description.replace(/\n/g, ' ').trim()
                : 'NYC pizza or food pop-up event.';
            lines.push(`- [${popup.name}](${popupUrl(popup)}): ${desc}`);
        }
        lines.push('');
    }

    // --- Date ideas ---
    if (dateIdeas.length > 0) {
        lines.push('## Date Ideas');
        lines.push('');
        for (const idea of dateIdeas) {
            const desc = idea.short_description
                ? idea.short_description.replace(/\n/g, ' ').trim()
                : 'Curated NYC date idea.';
            lines.push(`- [${idea.name}](${dateIdeaUrl(idea)}): ${desc}`);
        }
        lines.push('');
    }

    // --- Optional / lower-priority pages ---
    lines.push('## Optional');
    lines.push('');
    for (const page of OPTIONAL_PAGES) {
        lines.push(`- [${page.label}](${page.url}): ${page.description}`);
    }
    lines.push('');

    return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
    console.log('Fetching pop-up events from Sanity for llms.txt...');
    let popups;
    try {
        popups = await sanityFetch(POPUPS_QUERY);
    } catch (err) {
        console.error('Failed to fetch pop-up events from Sanity:', err.message);
        process.exit(1);
    }

    console.log('Fetching date ideas from Sanity for llms.txt...');
    let dateIdeas;
    try {
        dateIdeas = await sanityFetch(DATE_IDEAS_QUERY);
    } catch (err) {
        console.error('Failed to fetch date ideas from Sanity:', err.message);
        process.exit(1);
    }

    console.log(`Building llms.txt with ${popups.length} pop-up(s) and ${dateIdeas.length} date idea(s)...`);

    const content = buildLlmsTxt(popups, dateIdeas);

    const outputPath = path.resolve(__dirname, '..', 'llms.txt');
    fs.writeFileSync(outputPath, content, 'utf8');

    console.log(`llms.txt written to ${outputPath}`);
}

main().catch(err => {
    console.error('generate-llms-txt.js failed:', err);
    process.exit(1);
});
