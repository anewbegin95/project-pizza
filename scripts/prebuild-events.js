#!/usr/bin/env node
/**
 * Prebuild script: fetches active events from Sanity and pre-renders them as
 * static HTML tiles inside pop-ups.html and date-ideas.html, between the
 * respective marker comments:
 *
 *   pop-ups.html:    <!-- STATIC_POPUPS_START --> ... <!-- STATIC_POPUPS_END -->
 *   date-ideas.html: <!-- STATIC_DATE_IDEAS_START --> ... <!-- STATIC_DATE_IDEAS_END -->
 *
 * This makes the event listings visible in the raw HTML source at page load
 * without requiring JavaScript.  The existing client-side JS still runs and
 * refreshes the grid with live data when JavaScript is available.
 *
 * Usage:
 *   node scripts/prebuild-events.js
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

/** GROQ query — mirrors window.SANITY_QUERIES.POPUPS in sanity-queries.js */
const POPUPS_QUERY = `*[_type == "pop-ups"] | order(coalesce(start_datetime, start_date) asc) {
  _id,
  name,
  "slug": slug.current,
  start_datetime,
  end_datetime,
  start_date,
  end_date,
  all_day,
  recurring,
  location,
  display_overall,
  "display_in_popups_page": select(
    defined(end_datetime) && end_datetime < now() => false,
    defined(end_date) && end_date < now() => false,
    display_in_popups_page
  ),
  "imageUrl": image.asset->url
}`;

/** GROQ query — mirrors window.SANITY_QUERIES.DATE_IDEAS in sanity-queries.js */
const DATE_IDEAS_QUERY = `*[_type == "date_ideas"] | order(name asc) {
  _id,
  name,
  "slug": slug.current,
  location,
  link,
  link_text,
  short_description,
  display_overall,
  "imageUrl": image.asset->url
}`;

/** Markers that delimit the static block inside pop-ups.html */
const STATIC_POPUPS_START = '<!-- STATIC_POPUPS_START -->';
const STATIC_POPUPS_END = '<!-- STATIC_POPUPS_END -->';

/** Markers that delimit the static block inside date-ideas.html */
const STATIC_DATE_IDEAS_START = '<!-- STATIC_DATE_IDEAS_START -->';
const STATIC_DATE_IDEAS_END = '<!-- STATIC_DATE_IDEAS_END -->';

// ---------------------------------------------------------------------------
// Date utilities — ported from resources/js/pop-ups.js (keep in sync)
// ---------------------------------------------------------------------------

const EASTERN_TIMEZONE = 'America/New_York';

function formatEasternDate(date) {
    return new Intl.DateTimeFormat('en-US', {
        timeZone: EASTERN_TIMEZONE,
        weekday: 'short',
        month: 'short',
        day: 'numeric',
    }).format(date);
}

function formatEasternTime(date) {
    return new Intl.DateTimeFormat('en-US', {
        timeZone: EASTERN_TIMEZONE,
        hour: 'numeric',
        minute: '2-digit',
    }).format(date);
}

function getEasternYMD(date) {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: EASTERN_TIMEZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(date);
    const lookup = Object.fromEntries(parts.map(p => [p.type, p.value]));
    return `${lookup.year}-${lookup.month}-${lookup.day}`;
}

function parsePopupDate(str) {
    if (!str) return null;
    const raw = String(str);
    if (raw.includes('T') || /Z$|[+-]\d{2}:?\d{2}$/.test(raw)) {
        const d = new Date(raw);
        return isNaN(d) ? null : d;
    }
    const normalized = raw.replace(/-/g, '/');
    let match = normalized.match(
        /^(\d{1,2})[/\-](\d{1,2})[/\-](\d{2,4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2})(?:\.(\d{3}))?)?)?$/
    );
    if (match) {
        let [, month, day, year, hour, min, sec, ms] = match;
        if (year.length === 2) year = '20' + year;
        const hasTime = hour != null;
        if (!hasTime) {
            return new Date(Date.UTC(+year, +month - 1, +day, 12, 0, 0));
        }
        return new Date(+year, +month - 1, +day, +(hour || 0), +(min || 0), +(sec || 0), +(ms || 0));
    }
    match = normalized.match(
        /^(\d{4})[/\-](\d{1,2})[/\-](\d{1,2})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2})(?:\.(\d{3}))?)?)?$/
    );
    if (match) {
        let [, year, month, day, hour, min, sec, ms] = match;
        const hasTime = hour != null;
        if (!hasTime) {
            return new Date(Date.UTC(+year, +month - 1, +day, 12, 0, 0));
        }
        return new Date(+year, +month - 1, +day, +(hour || 0), +(min || 0), +(sec || 0), +(ms || 0));
    }
    return null;
}

function formatPopupDate(start, end, allDay, recurring) {
    const startDate = parsePopupDate(start);
    const endDate = parsePopupDate(end);
    if (!start) start = '';
    if (!end) end = '';
    const startDateFormatted = startDate ? formatEasternDate(startDate) : '';
    const endDateFormatted = endDate ? formatEasternDate(endDate) : '';
    const startTimeFormatted = startDate ? formatEasternTime(startDate) : '';
    const endTimeFormatted = endDate ? formatEasternTime(endDate) : '';

    if (start === 'Ongoing' && !end) return 'Ongoing';
    if (start && end === 'Ongoing') return `Starting ${startDateFormatted}, ongoing`;
    if (
        startDate && endDate &&
        getEasternYMD(startDate) === getEasternYMD(endDate) &&
        start.includes(':') && end.includes(':') &&
        allDay === 'FALSE' && recurring === 'FALSE'
    ) {
        return `${startDateFormatted}, ${startTimeFormatted} \u2013 ${endTimeFormatted}`;
    }
    if (
        startDate && endDate &&
        getEasternYMD(startDate) !== getEasternYMD(endDate) &&
        start.includes(':') && end.includes(':') &&
        allDay === 'FALSE' && recurring === 'FALSE'
    ) {
        return `${startDateFormatted}, ${startTimeFormatted} - ${endDateFormatted}, ${endTimeFormatted}`;
    }
    if (start && !end && !start.includes(':') && allDay === 'FALSE' && recurring === 'FALSE') {
        return startDateFormatted;
    }
    if (start !== end && !start.includes(':') && !end.includes(':') && allDay === 'FALSE' && recurring === 'FALSE') {
        return `${startDateFormatted} \u2013 ${endDateFormatted}`;
    }
    if ((start === end || (start && !end)) && allDay === 'TRUE' && recurring === 'FALSE') {
        return `${startDateFormatted} (all day)`;
    }
    if (start !== end && allDay === 'TRUE' && recurring === 'FALSE') {
        return `${startDateFormatted} - ${endDateFormatted} (all day)`;
    }
    if (recurring === 'TRUE') {
        return `${startDateFormatted}, ${startTimeFormatted} \u2013 ${endTimeFormatted}`;
    }
    if (start && !end) return `${startDateFormatted}, starting at ${startTimeFormatted}`;
    if (!start && end) return `${endDateFormatted}, ending at ${endTimeFormatted}`;
    // start === end with date-only values (non-all-day, non-recurring): return the formatted date.
    return startDateFormatted;
}

// ---------------------------------------------------------------------------
// Data mapping — mirrors mapSanityPopup / toDisplayFlag in pop-ups.js
// ---------------------------------------------------------------------------

function generatePopupId(popup) {
    return (popup.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function toDisplayFlag(value, defaultValue) {
    if (defaultValue === undefined) defaultValue = 'FALSE';
    if (value === null || value === undefined) return defaultValue;
    if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
    return String(value).toUpperCase() === 'TRUE' ? 'TRUE' : 'FALSE';
}

function mapSanityPopup(item) {
    const startValue = item.start_datetime || item.start_date || '';
    const endValue = item.end_datetime || item.end_date || '';
    return {
        id: item.slug || item._id || generatePopupId(item),
        name: item.name || '',
        start_datetime: startValue,
        end_datetime: endValue,
        all_day: toDisplayFlag(item.all_day, 'FALSE'),
        recurring: toDisplayFlag(item.recurring, 'FALSE'),
        location: item.location || '',
        img: item.imageUrl || '',
        master_display: toDisplayFlag(item.display_overall, 'TRUE'),
        popups_page: toDisplayFlag(item.display_in_popups_page, 'TRUE'),
    };
}

function mapSanityDateIdea(item, index) {
    const base = (item.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const fallbackId = `${base}-${index}`;
    return {
        id: item.slug || item._id || fallbackId,
        name: item.name || '',
        location: item.location || '',
        link: item.link || '',
        link_text: item.link_text || '',
        short_desc: item.short_description || '',
        img: item.imageUrl || '',
        master_display: toDisplayFlag(item.display_overall, 'TRUE'),
    };
}

// ---------------------------------------------------------------------------
// HTML generation
// ---------------------------------------------------------------------------

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function generatePopupTileHtml(popup) {
    const imgSrc = escapeHtml(popup.img || 'resources/images/images/default-popup-image.webp');
    const imgAlt = escapeHtml(`${popup.name} image`);
    const title = escapeHtml(popup.name);
    const dateText = escapeHtml(
        formatPopupDate(popup.start_datetime, popup.end_datetime, popup.all_day, popup.recurring)
    );
    const location = escapeHtml(popup.location || '');
    const detailUrl = escapeHtml(`pop-up.html?id=${popup.id}`);

    return `<a class="popup-tile popup-tile--horizontal" href="${detailUrl}">
                <div class="popup-tile__img-container">
                    <img src="${imgSrc}" alt="${imgAlt}" class="popup-tile__img" loading="lazy">
                </div>
                <div class="popup-tile__details">
                    <h3>${title}</h3>
                    <p class="popup-tile__date">${dateText}</p>
                    <p class="popup-tile__location">${location}</p>
                </div>
            </a>`;
}

function generateDateIdeaTileHtml(idea) {
    const imgSrc = escapeHtml(idea.img || 'resources/images/images/default-popup-image.webp');
    const imgAlt = escapeHtml(`${idea.name} image`);
    const title = escapeHtml(idea.name);
    const location = escapeHtml(idea.location || '');
    const shortDesc = escapeHtml(idea.short_desc || '');
    const detailUrl = escapeHtml(`date-idea.html?id=${idea.id}`);

    return `<a class="popup-tile popup-tile--horizontal" href="${detailUrl}">
                <div class="popup-tile__img-container">
                    <img src="${imgSrc}" alt="${imgAlt}" class="popup-tile__img" loading="lazy">
                </div>
                <div class="popup-tile__details">
                    <h3>${title}</h3>
                    <p class="popup-tile__location">${location}</p>
                    <p class="popup-tile__text">${shortDesc}</p>
                </div>
            </a>`;
}

// ---------------------------------------------------------------------------
// Sanity API fetch (no third-party dependencies — uses built-in https)
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
// Shared helper: inject tiles between marker comments in an HTML file
// ---------------------------------------------------------------------------

function injectStaticTiles(htmlPath, tilesHtml, startMarker, endMarker) {
    let html = fs.readFileSync(htmlPath, 'utf8');

    const startIdx = html.indexOf(startMarker);
    const endIdx = html.indexOf(endMarker);

    if (startIdx === -1 || endIdx === -1) {
        throw new Error(
            `Markers not found in ${path.basename(htmlPath)}.\n` +
            `Expected: ${startMarker} ... ${endMarker}`
        );
    }

    const before = html.slice(0, startIdx + startMarker.length);
    const after = html.slice(endIdx);

    const staticBlock = tilesHtml
        ? `\n        ${tilesHtml}\n        `
        : '\n        ';

    fs.writeFileSync(htmlPath, `${before}${staticBlock}${after}`, 'utf8');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
    // --- Pop-ups ---
    const popupsHtmlPath = path.resolve(__dirname, '..', 'pop-ups.html');

    console.log('Fetching pop-up events from Sanity...');
    let popupResults;
    try {
        popupResults = await sanityFetch(POPUPS_QUERY);
    } catch (err) {
        console.error('Failed to fetch pop-up events from Sanity:', err.message);
        process.exit(1);
    }

    const popups = popupResults
        .map(mapSanityPopup)
        .filter(e =>
            String(e.master_display).toUpperCase() === 'TRUE' &&
            String(e.popups_page).toUpperCase() === 'TRUE'
        );

    console.log(`Found ${popups.length} active pop-up(s) for the pop-ups listing page.`);

    const popupTilesHtml = popups.map(generatePopupTileHtml).join('\n        ');

    try {
        injectStaticTiles(popupsHtmlPath, popupTilesHtml, STATIC_POPUPS_START, STATIC_POPUPS_END);
        console.log(`Updated pop-ups.html with ${popups.length} pre-rendered event tile(s).`);
    } catch (err) {
        console.error(err.message);
        process.exit(1);
    }

    // --- Date Ideas ---
    const dateIdeasHtmlPath = path.resolve(__dirname, '..', 'date-ideas.html');

    console.log('Fetching date ideas from Sanity...');
    let dateIdeasResults;
    try {
        dateIdeasResults = await sanityFetch(DATE_IDEAS_QUERY);
    } catch (err) {
        console.error('Failed to fetch date ideas from Sanity:', err.message);
        process.exit(1);
    }

    const dateIdeas = dateIdeasResults
        .map(mapSanityDateIdea)
        .filter(e => String(e.master_display).toUpperCase() === 'TRUE');

    console.log(`Found ${dateIdeas.length} active date idea(s) for the date ideas listing page.`);

    const dateIdeaTilesHtml = dateIdeas.map(generateDateIdeaTileHtml).join('\n        ');

    try {
        injectStaticTiles(dateIdeasHtmlPath, dateIdeaTilesHtml, STATIC_DATE_IDEAS_START, STATIC_DATE_IDEAS_END);
        console.log(`Updated date-ideas.html with ${dateIdeas.length} pre-rendered date idea tile(s).`);
    } catch (err) {
        console.error(err.message);
        process.exit(1);
    }
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
