// === CONSTANTS ===

/**
 * URL of the published Google Sheet in CSV format.
 * Ensure the sheet is public for this to work.
 */
const DATE_IDEAS_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRt3kyrvcTvanJ0p3Umxrlk36QZIDKS91n2pmzXaYaCv73mhLnhLeBf_ZpU87fZe0pu8J1Vz6mjI6uE/pub?gid=121089378&single=true&output=csv';

// === UTILITY FUNCTIONS ===
/**
 * Parses a CSV string into an array of event objects.
 * Handles multi-line fields and ensures proper formatting for fields like `short_desc` and `long_desc`.
 * @param {string} csvText - The raw CSV string.
 * @returns {Array<Object>} - Array of parsed event objects.
 */

function parseCSV(csvText, type = "date-idea") {
    const rows = csvText.trim().split('\n');
    const headers = rows[0].split(',').map(h => h.trim());
    const items = [];
    let currentRow = [];

    rows.slice(1).forEach(row => {
        currentRow.push(row);
        const combinedRow = currentRow.join('\n');
        const quoteCount = (combinedRow.match(/"/g) || []).length;

        if (quoteCount % 2 === 0) {
            const values = combinedRow.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(v => v.trim());
            const item = {};
            headers.forEach((header, i) => {
                item[header] = values[i]?.replace(/^"+|"+$/g, '') || '';
            });
            item['type'] = type; // Add type field
            items.push(item);
            currentRow = [];
        }
    });

    items.forEach(item => {
        item.id = generateEventId(item);
    });

    return items;
}

/**
 * Generates a unique event ID (slug) from event name only.
 * Example output: "pizza-pop-up"
 * @param {Object} item - Item object containing name.
 * @returns {string} - Unique event ID.
 */
function generateEventId(item) {
    // Use item name only, lowercased and slugified
    return (item.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// Fetch date ideas
fetch(DATE_IDEAS_CSV_URL)
  .then(res => res.text())
  .then(csv => {
    const dateIdeas = parseCSV(csv, "date-idea");
    console.log(dateIdeas);
    // ... use dateIdeas ...
  })
  .catch(error => {
    console.error('Failed to fetch date ideas:', error);
  });