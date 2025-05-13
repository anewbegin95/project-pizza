// === CONSTANTS ===

/**
 * URL of the published Google Sheet in CSV format.
 * Ensure the sheet is public for this to work.
 */
const GOOGLE_SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRt3kyrvcTvanJ0p3Umxrlk36QZIDKS91n2pmzXaYaCv73mhLnhLeBf_ZpU87fZe0pu8J1Vz6mjI6uE/pub?gid=0&single=true&output=csv';

// === UTILITY FUNCTIONS ===

/**
 * Parses a CSV string into an array of event objects.
 * Handles multi-line fields and ensures proper formatting for fields like `short_desc` and `long_desc`.
 * @param {string} csvText - The raw CSV string.
 * @returns {Array<Object>} - Array of parsed event objects.
 */
function parseCSV(csvText) {
    const rows = csvText.trim().split('\n');
    const headers = rows[0].split(',').map(h => h.trim());
    const events = [];
    let currentRow = [];

    rows.slice(1).forEach(row => {
        currentRow.push(row);
        const combinedRow = currentRow.join('\n');
        const quoteCount = (combinedRow.match(/"/g) || []).length;

        if (quoteCount % 2 === 0) {
            const values = combinedRow.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(v => v.trim());
            const event = {};
            headers.forEach((header, i) => {
                event[header] = values[i]?.replace(/^"+|"+$/g, '') || '';
            });
            event['recurring'] = event['recurring'] || 'FALSE';
            event['display'] = event['display'] || 'TRUE';
            event['link'] = event['link'] || '';
            events.push(event);
            currentRow = [];
        }
    });

    return events;
}

/**
 * Formats event dates into human-readable strings based on various scenarios.
 * @param {string} start - Start date/time of the event.
 * @param {string} end - End date/time of the event.
 * @param {string} allDay - Whether the event lasts all day.
 * @param {string} recurring - Whether the event is recurring.
 * @returns {string} - Formatted date string.
 */
function formatEventDate(start, end, allDay, recurring) {
    // Ensure start and end are defined
    if (!start) start = '';
    if (!end) end = '';

    console.log('formatEventDate called with:', { start, end, allDay, recurring }); // Debugging log
    // Parse dates explicitly to handle the format correctly
    const startDate = new Date(Date.parse(start));
    const endDate = new Date(Date.parse(end));

    // Adjust dates to Eastern Time (US) explicitly
    const startDateEastern = new Date(startDate.toLocaleString('en-US', { timeZone: 'America/New_York' }));
    const endDateEastern = new Date(endDate.toLocaleString('en-US', { timeZone: 'America/New_York' }));

    // Format dates directly with the correct timezone
    const startDateFormatted = startDateEastern.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    const endDateFormatted = endDateEastern.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

    const startTimeFormatted = startDateEastern.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    const endTimeFormatted = endDateEastern.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

    /*
     * Example 1: Ongoing Events
     * Input: start = "Ongoing", end = "", allDay = "TRUE", recurring = "FALSE"
     * Output (Tile): "Ongoing"
     * Output (Modal): "Ongoing"
     */
    if (start === 'Ongoing' && !end) {
        return 'Ongoing';
    }

    /*
     * Example 2: Ongoing Events (With Start Date)
     * Input: start = "2025-05-11", end = "Ongoing"
     * Output (Tile): "Starting Sun, May 11, ongoing"
     * Output (Modal): "Starting Sun, May 11, ongoing"
     */
    if (start && end === 'Ongoing') {
        return `Starting ${startDateFormatted}, ongoing`;
    }

    /*
     * Example 3: Exact Start & End Datetime (One Day)
     * Input: start = "2025-05-11 10:00:00", end = "2025-05-11 17:00:00", allDay = "FALSE", recurring = "FALSE"
     * Output (Tile): "Sun, May 11, 10:00 AM – 5:00 PM"
     * Output (Modal): "Sun, May 11, 10:00 AM – 5:00 PM"
     */
    if (startDate.toDateString() === endDate.toDateString() 
        && start.includes(':') 
        && end.includes(':') 
        && allDay === 'FALSE' 
        && recurring === 'FALSE'
    ) {
        return `${startDateFormatted}, ${startTimeFormatted} – ${endTimeFormatted}`;
    }

    /*
     * Example 4: Exact Start & End Datetime (Over Many Days)
     * Input: start = "2025-05-11 10:00:00", end = "2025-05-13 17:00:00", allDay = "FALSE", recurring = "FALSE"
     * Output (Tile): "Sun, May 11, 10:00 AM – Tue, May 13, 5:00 PM"
     * Output (Modal): "Sun, May 11, 10:00 AM – Tue, May 13, 5:00 PM"
     */
    if (startDate.toDateString() != endDate.toDateString() 
        && start.includes(':') && end.includes(':') 
        && allDay === 'FALSE' 
        && recurring === 'FALSE') {
        return `${startDateFormatted}, ${startTimeFormatted} - ${endDateFormatted}, ${endTimeFormatted}`;
    }

    /*
     * Example 5: Exact Day but Not Time (One Day)
     * Input: start = "2025-05-11", end = "", allDay = "FALSE", recurring = "FALSE"
     * Output (Tile): "Sun, May 11"
     * Output (Modal): "Sun, May 11"
     */
    if (start
        && !end
        && !start.includes(':') 
        && allDay === 'FALSE' 
        && recurring === 'FALSE'
    ) {
        return startDateFormatted;
    }

    /*
     * Example 6: Exact Start & End Day but No Time (Over Many Days)
     * Input: start = "2025-05-11", end = "2025-05-13", allDay = "FALSE", recurring = "FALSE"
     * Output (Tile): "Sun, May 11 – Tue, May 13"
     * Output (Modal): "Sun, May 11 – Tue, May 13"
     */
    if (start != end 
        && !start.includes(':') 
        && !end.includes(':')
        && allDay === 'FALSE' 
        && recurring === 'FALSE') {
        return `${startDateFormatted} – ${endDateFormatted}`;
    }

    /*
     * Example 7: Single day, all day
     * Input: start = "2025-05-11" & end = "2025-05-11" or "2025-05-11" & end = "", allDay = "TRUE", recurring = "FALSE"
     * Output (Tile): "Sun, May 11 (all day)"
     * Output (Modal): "Sun, May 11 (all day)"
     */
    if ((start === end || (start && !end))
        && allDay === 'TRUE' 
        && recurring === 'FALSE') {
        return `${startDateFormatted} (all day)`;
    }

    /*
     * Example 8: Multi-day, all day
     * Input: start = "2025-05-11", end = "2025-05-13", allDay = "TRUE", recurring = "FALSE"
     * Output (Tile): "Sun, May 11 – Tue, May 13 (all day)"
     * Output (Modal): "Sun, May 11 – Tue, May 13 (all day)"
     */
    if (start != end
        && allDay === 'TRUE' 
        && recurring === 'FALSE') {
        return `${startDateFormatted} - ${endDateFormatted} (all day)`;
    }

    /*
     * Example 9: Recurring Events (Specific Days or Times)
     * Input: start = "2025-05-16 17:30:00", end = "2025-05-16 20:30:00", recurring = "TRUE", recurrence_pattern = "Every Friday from 5:30 PM to 8:30 PM"
     * Output (Tile): "Next on Fri, May 16, 5:30 – 8:30 PM"
     * Output (Modal): "Next on Fri, May 16, 5:30 – 8:30 PM"
     */
    if (recurring === 'TRUE') {
        return `Next on ${startDateFormatted}, ${startTimeFormatted} – ${endTimeFormatted}`
    }

    /*
     * Example 10: Drop-In Events (Exact Start Time but No End Time)
     * Input: start = "2025-05-11 14:00:00", end = "", allDay = "FALSE", recurring = "FALSE"
     * Output (Tile): "Sun, May 11, starting at 2:00 PM"
     * Output (Modal): "Sun, May 11, starting at 2:00 PM"
     */
    if (start && !end) {
        return `${startDateFormatted}, starting at ${startTimeFormatted}`;
    }

    /*
     * Example 11 Closing Events (Exact End Time but No Start Time)
     * Input: start = "", end = "2025-05-11 17:00:00"
     * Output (Tile): "Sun, May 11, ending at 5:00 PM"
     * Output (Modal): "Sun, May 11, ending at 5:00 PM"
     */
    if (!start && end) {
        return `${endDateFormatted}, ending at ${endTimeFormatted}`;
    }

    /*
     * Example 12: Events with No Specific Date or Time (TBD)
     * Input: start = "", end = ""
     * Output (Tile): "Date and time to be announced"
     * Output (Modal): "Date and time to be announced"
     */
    if (!start && !end) {
        return 'Date and time to be announced';
    }
}

// === UI RENDERING FUNCTIONS ===

/**
 * Creates an event tile for the events grid.
 * @param {Object} event - Event object containing event details.
 * @returns {HTMLElement|null} - The event tile element or null if the event should not be displayed.
 */
function createEventTile(event) {
    if (event.display === 'FALSE') return null;

    const tile = document.createElement('div');
    tile.className = 'event-tile';

    const img = document.createElement('img');
    img.src = event.img || 'resources/images/images/default-event-image.jpeg';
    img.alt = `${event.name} image`;
    img.className = 'event-img';

    const title = document.createElement('h3');
    title.textContent = event.name;

    const dateText = document.createElement('p');
    dateText.textContent = formatEventDate(event.start_datetime, event.end_datetime, event.all_day, event.recurring);

    tile.addEventListener('click', () => openEventModal(event));

    tile.appendChild(img);
    tile.appendChild(title);
    tile.appendChild(dateText);

    return tile;
}

/**
 * Opens the event modal and populates it with event details.
 * @param {Object} event - Event object containing event details.
 */
function openEventModal(event) {
    if (event.display === 'FALSE') return;

    const modal = document.getElementById('eventModal');
    document.getElementById('modalTitle').textContent = event.name;
    document.getElementById('modalImage').src = event.img || 'resources/images/images/default-event-image.jpeg';
    document.getElementById('modalImage').alt = `${event.name} image`;
    document.getElementById('modalDateRange').textContent = formatEventDate(event.start_datetime, event.end_datetime, event.all_day, event.recurring);
    document.getElementById('modalLocation').textContent = event.location || 'TBD';
    document.getElementById('modalDescription').innerHTML = event.long_desc.replace(/\n/g, '<br>') || 'No description available.';

    const modalLink = document.getElementById('modalLink');
    if (event.link && event.link.trim() !== '') {
        modalLink.href = event.link;
        modalLink.textContent = event.link_text || 'Learn More';
        modalLink.classList.remove('hidden');
    } else {
        modalLink.href = '#';
        modalLink.classList.add('hidden');
    }

    modal.classList.remove('hidden');
}

// === MAIN FUNCTIONALITY ===

/**
 * Fetches events from the CSV URL, parses them, and displays them in the events grid.
 */
function loadAndDisplayEvents() {
    fetch(GOOGLE_SHEET_CSV_URL)
        .then(response => response.text())
        .then(csvText => {
            const events = parseCSV(csvText);
            const grid = document.createElement('div');
            grid.className = 'events-grid';

            events.forEach(event => {
                const tile = createEventTile(event);
                if (tile) grid.appendChild(tile);
            });

            document.querySelector('main').appendChild(grid);
        })
        .catch(error => {
            console.error('Error loading events:', error);
        });
}

// === EVENT LISTENERS ===

document.addEventListener('DOMContentLoaded', () => {
    loadAndDisplayEvents();

    const returnButton = document.querySelector('.return-button');
    if (returnButton) {
        returnButton.addEventListener('click', () => {
            const modal = document.getElementById('eventModal');
            modal.classList.add('hidden');
        });
    }

    const modal = document.getElementById('eventModal');
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.add('hidden');
            }
        });
    }
});