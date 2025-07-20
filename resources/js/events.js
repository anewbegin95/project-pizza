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
            event['master_display'] = event['master_display'] || 'TRUE';
            event['events_page'] = event['events_page'] || 'TRUE';
            event['calendar'] = event['calendar'] || 'TRUE';
            event['link'] = event['link'] || '';
            events.push(event);
            currentRow = [];
        }
    });

    // Assign event.id using the new generateEventId (event name only)
    events.forEach(event => {
        event.id = generateEventId(event);
    });

    return events;
}

/**
 * Generates a unique event ID (slug) from event name only.
 * Example output: "pizza-pop-up"
 * @param {Object} event - Event object containing name.
 * @returns {string} - Unique event ID.
 */
function generateEventId(event) {
    // Use event name only, lowercased and slugified
    return (event.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
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
    const startDate = parseEventDate(start);
    const endDate = parseEventDate(end);

    // Ensure start and end are defined
    if (!start) start = '';
    if (!end) end = '';

    console.log('formatEventDate called with:', { start, end, allDay, recurring }); // Debugging log
    // Parse dates explicitly to handle the format correctly
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
        return `${startDateFormatted}, ${startTimeFormatted} – ${endTimeFormatted}`
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

/**
 * Robustly parse a date string from the CMS, accepting:
 * - YYYY-MM-DD HH:MM:SS
 * - YYYY-M-D H:MM:SS
 * - M/D/YYYY H:MM:SS
 * - MM/DD/YYYY HH:MM:SS
 * - and similar variants (with or without leading zeros)
 * Returns a Date object or null if invalid.
 */
function parseEventDate(str) {
    if (!str) return null;
    // Try native Date first
    let d = new Date(str.replace(/-/g, '/'));
    if (!isNaN(d)) return d;
    // Try M/D/YYYY H:MM:SS or M/D/YYYY
    let match = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
    if (match) {
        let [, month, day, year, hour, min, sec] = match;
        if (year.length === 2) year = '20' + year;
        return new Date(
            Number(year),
            Number(month) - 1,
            Number(day),
            Number(hour || 0),
            Number(min || 0),
            Number(sec || 0)
        );
    }
    // Try YYYY-MM-DD H:MM:SS (no leading zero)
    match = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
    if (match) {
        let [, year, month, day, hour, min, sec] = match;
        return new Date(
            Number(year),
            Number(month) - 1,
            Number(day),
            Number(hour || 0),
            Number(min || 0),
            Number(sec || 0)
        );
    }
    return null;
}

/*
* Checks if an event is a multi-day event, in the style of Example 4 above
* @param {Object} event - Event object containing start_datetime and end_datetime.
* @returns {boolean} - True if the event is a multi-day event, false otherwise.
*/
function isMultiDayEvent(event) {
    const startDate = parseEventDate(event.start_datetime);
    const endDate = parseEventDate(event.end_datetime);
    if (!event.start_datetime || !event.end_datetime) return false;
    return (
        startDate.toDateString() !== endDate.toDateString() &&
        event.start_datetime.includes(':') &&
        event.end_datetime.includes(':') &&
        String(event.all_day).toUpperCase() === 'FALSE' &&
        String(event.recurring).toUpperCase() === 'FALSE'
    );
}

// === UI RENDERING FUNCTIONS ===

/**
 * Creates an event tile for the events grid.
 * @param {Object} event - Event object containing event details.
 * @returns {HTMLElement|null} - The event tile element or null if the event should not be displayed.
 */
function createEventTile(event, skipEventsPageCheck = false) {
    if (String(event.master_display).toUpperCase() === 'FALSE') return null;
    if (!skipEventsPageCheck && String(event.events_page).toUpperCase() === 'FALSE') return null;

    const tile = document.createElement('div');
    // BEM/component refactor for event tile
    tile.className = 'event-tile event-tile--horizontal';

    // Left: Image
    const imgContainer = document.createElement('div');
    imgContainer.className = 'event-tile__img-container';
    const img = document.createElement('img');
    img.src = event.img || 'resources/images/images/default-event-image.jpeg';
    img.alt = `${event.name} image`;
    img.className = 'event-tile__img';
    imgContainer.appendChild(img);

    // Right: Details
    const details = document.createElement('div');
    details.className = 'event-tile__details';
    const title = document.createElement('h3');
    title.textContent = event.name;
    const dateText = document.createElement('p');
    dateText.className = 'event-tile__date';
    dateText.textContent = formatEventDate(event.start_datetime, event.end_datetime, event.all_day, event.recurring);
    const location = document.createElement('p');
    location.className = 'event-tile__location';
    location.textContent = event.location || '';

    details.appendChild(title);
    details.appendChild(dateText);
    details.appendChild(location);

    tile.appendChild(imgContainer);
    tile.appendChild(details);

    tile.addEventListener('click', () => {
        window.location.href = `event.html?id=${event.id}`;
    });

    return tile;
}

/**
 * Opens a modal showing all events for a given day in a grid (like the events page).
 * @param {Date} date - The date for which to show events.
 * @param {Array<Object>} eventsForDay - Array of event objects for the day.
 */
function openDayEventsModal(date, eventsForDay) {
    const modal = document.getElementById('eventModal');
    const modalContent = modal.querySelector('.modal-content');
    // Hide the single-event modal content
    modal.querySelector('.modal-details').style.display = 'none';
    modal.querySelector('.modal-main').style.display = 'none';
    // Switch modal-content to single-column for day grid
    modalContent.classList.add('show-day-grid');

    // Remove any existing day-events grid
    let dayGrid = modal.querySelector('.day-events-grid');
    if (dayGrid) dayGrid.remove();

    // Update the return button text (no inline style)
    const returnButton = modal.querySelector('.return-button');
    if (returnButton) {
        returnButton.textContent = '← Return to calendar';
        // Restore modal content and remove day grid/modal class on click
        returnButton.onclick = () => {
            if (modal.querySelector('.day-events-grid'))
                modal.querySelector('.day-events-grid').remove();
            modalContent.classList.remove('show-day-grid');
            // Restore modal content (details/main)
            modal.querySelector('.modal-details').style.display = '';
            modal.querySelector('.modal-main').style.display = '';
            // Remove highlight from all bars
            document.querySelectorAll('.calendar-event-bar--active').forEach(el => el.classList.remove('calendar-event-bar--active'));
            modal.classList.add('hidden');
        };
    }

    // Create a new grid for the day's events
    dayGrid = document.createElement('div');
    dayGrid.className = 'day-events-grid events-grid';

    // Add a heading for the date (centered at top, no inline style)
    const heading = document.createElement('h2');
    heading.textContent = date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    heading.className = 'day-events-heading';
    dayGrid.appendChild(heading);

    // Add event tiles, each with a click handler to open the standard event modal
    eventsForDay.forEach(event => {
        const tile = createEventTile(event, true);
        if (tile) {
            tile.onclick = (e) => {
                e.stopPropagation();
                // Remove only the day grid and modal class, restore modal content
                if (modal.querySelector('.day-events-grid'))
                    modal.querySelector('.day-events-grid').remove();
                modalContent.classList.remove('show-day-grid');
                modal.querySelector('.modal-details').style.display = '';
                modal.querySelector('.modal-main').style.display = '';
                // Show event details in the modal (populate modal-details with event info)
                populateEventModal(event);
            };
            dayGrid.appendChild(tile);
        }
    });

    // Instead of clearing modalContent, just append dayGrid (and ensure only one exists)
    if (!modalContent.contains(dayGrid)) {
        modalContent.appendChild(dayGrid);
    }
    modal.classList.remove('hidden');

    // Clicking outside closes the modal and restores content
    modal.onclick = (e) => {
        if (e.target === modal) {
            if (modal.querySelector('.day-events-grid'))
                modal.querySelector('.day-events-grid').remove();
            modalContent.classList.remove('show-day-grid');
            modal.querySelector('.modal-details').style.display = '';
            modal.querySelector('.modal-main').style.display = '';
            document.querySelectorAll('.calendar-event-bar--active').forEach(el => el.classList.remove('calendar-event-bar--active'));
            modal.classList.add('hidden');
        }
    };
}

// === ICS FILE GENERATION ===
// Utility to escape newlines and special chars for ICS fields
function escapeICSText(text) {
    if (!text) return '';
    return String(text)
        .replace(/\\/g, '\\\\') // escape backslashes
        .replace(/\n|\r\n|\r/g, '\\n') // escape newlines
        .replace(/,/g, '\\,') // escape commas
        .replace(/;/g, '\\;'); // escape semicolons
}

// Utility to fold lines longer than 75 octets (bytes) per RFC 5545
function foldICSLines(ics) {
    return ics.split('\r\n').map(line => {
        let out = '';
        while (line.length > 75) {
            out += line.slice(0, 75) + '\r\n ';
            line = line.slice(75);
        }
        out += line;
        return out;
    }).join('\r\n');
}

// Utility to get date-time in America/New_York as YYYYMMDDTHHmmss
function toEasternICSDateTime(dateObj) {
    // Convert to America/New_York
    const options = {
        timeZone: 'America/New_York',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    };
    const parts = new Intl.DateTimeFormat('en-US', options).formatToParts(dateObj);
    const get = (type) => parts.find(p => p.type === type).value;
    return `${get('year')}${get('month')}${get('day')}T${get('hour')}${get('minute')}${get('second')}`;
}

function generateSingleDayICS(event, day, startTime, endTime) {
    // Set start and end times for the specific day
    const formatDate = (dateObj, timeStr) => {
        const [h, m, s] = timeStr.split(':');
        // Construct a date in America/New_York local time, not UTC!
        // This ensures 10:00 means 10:00 in NYC, not 10:00 UTC
        const dt = new Date(
            dateObj.getFullYear(),
            dateObj.getMonth(),
            dateObj.getDate(),
            Number(h),
            Number(m),
            Number(s || 0),
            0
        );
        // Format as local time (no Z, with TZID)
        return `${dt.getFullYear()}${String(dt.getMonth()+1).padStart(2,'0')}${String(dt.getDate()).padStart(2,'0')}T${String(dt.getHours()).padStart(2,'0')}${String(dt.getMinutes()).padStart(2,'0')}${String(dt.getSeconds()).padStart(2,'0')}`;
    };
    const dtStart = formatDate(day, startTime);
    const dtEnd = formatDate(day, endTime);
    const now = new Date();
    const dtStamp = toEasternICSDateTime(now);
    let ics = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//NYC Slice of Life//EN',
        'CALSCALE:GREGORIAN',
        'X-WR-TIMEZONE:America/New_York',
        'BEGIN:VEVENT',
        `UID:${event.name.replace(/\s+/g, '_')}_${dtStart}@nycsliceoflife.com`,
        `SUMMARY:${escapeICSText(event.name)}`,
        `DTSTART;TZID=America/New_York:${dtStart}`,
        `DTEND;TZID=America/New_York:${dtEnd}`,
        `DTSTAMP;TZID=America/New_York:${dtStamp}`,
        `LOCATION:${escapeICSText(event.location || '')}`,
        `DESCRIPTION:${escapeICSText(event.long_desc || '')}`,
        'END:VEVENT',
        'END:VCALENDAR'
    ].join('\r\n');
    return foldICSLines(ics);
}

function generateICS(event) {
    const formatDateSingle = (dateString, allDay) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        if (allDay === 'TRUE') {
            // All-day events: just date
            const options = { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' };
            const parts = new Intl.DateTimeFormat('en-US', options).formatToParts(date);
            const get = (type) => parts.find(p => p.type === type).value;
            return `${get('year')}${get('month')}${get('day')}`;
        }
        return toEasternICSDateTime(date);
    };
    const dtStart = formatDateSingle(event.start_datetime, event.all_day);
    const dtEnd = formatDateSingle(event.end_datetime, event.all_day);
    const now = new Date();
    const dtStamp = toEasternICSDateTime(now);
    let ics = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//NYC Slice of Life//EN',
        'CALSCALE:GREGORIAN',
        'X-WR-TIMEZONE:America/New_York',
        'BEGIN:VEVENT',
        `UID:${event.name.replace(/\s+/g, '_')}_${dtStart}@nycsliceoflife.com`,
        `SUMMARY:${escapeICSText(event.name)}`,
        event.all_day === 'TRUE'
            ? `DTSTART;VALUE=DATE:${dtStart}`
            : `DTSTART;TZID=America/New_York:${dtStart}`,
        event.all_day === 'TRUE'
            ? `DTEND;VALUE=DATE:${dtEnd}`
            : `DTEND;TZID=America/New_York:${dtEnd}`,
        `DTSTAMP;TZID=America/New_York:${dtStamp}`,
        `LOCATION:${escapeICSText(event.location || '')}`,
        `DESCRIPTION:${escapeICSText(event.long_desc || '')}`,
        'END:VEVENT',
        'END:VCALENDAR'
    ].join('\r\n');
    return foldICSLines(ics);
}

/**
 * Generates an ICS file content for a single day of a multi-day event.
 * @param {Object} event - Event object containing event details.
 * @param {Date} day - The date for this instance.
 * @param {string} startTime - "HH:MM:SS" from event.start_datetime
 * @param {string} endTime - "HH:MM:SS" from event.end_datetime
 * @returns {string} - The ICS file content as a string.
 */
function generateSingleDayICS(event, day, startTime, endTime) {
    const formatDate = (dateObj, timeStr) => {
        const [h, m, s] = timeStr.split(':');
        const dt = new Date(
            day.getFullYear(),
            day.getMonth(),
            day.getDate(),
            Number(h),
            Number(m),
            Number(s || 0),
            0
        );
        return dt.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    };
    const dtStart = formatDate(day, startTime);
    const dtEnd = formatDate(day, endTime);
    const now = new Date();
    const dtStamp = now.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    let ics = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//NYC Slice of Life//EN',
        'CALSCALE:GREGORIAN',
        'BEGIN:VEVENT',
        `UID:${event.name.replace(/\s+/g, '_')}_${dtStart}@nycsliceoflife.com`,
        `SUMMARY:${escapeICSText(event.name)}`,
        `DTSTART:${dtStart}`,
        `DTEND:${dtEnd}`,
        `DTSTAMP:${dtStamp}`,
        `LOCATION:${escapeICSText(event.location || '')}`,
        `DESCRIPTION:${escapeICSText(event.long_desc || '')}`,
        'END:VEVENT',
        'END:VCALENDAR'
    ].join('\r\n');
    return foldICSLines(ics);
}

function downloadICS(event, specificDay, startTime, endTime) {
    let icsContent, filename;
    if (isMultiDayEvent(event) && specificDay) {
        icsContent = generateSingleDayICS(event, specificDay, startTime, endTime);
        filename = `${event.name.replace(/\s+/g, '_')}_${specificDay.toISOString().split('T')[0]}.ics`;
    } else {
        icsContent = generateICS(event);
        filename = `${event.name.replace(/\s+/g, '_')}.ics`;
    }
    const blob = new Blob([icsContent], { type: 'text/calendar' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

// === MAIN FUNCTIONALITY ===

/**
 * Fetches events from the CSV URL, parses them, and displays them in the events grid.
 */
function loadAndDisplayEvents() {
    // Detect if we're on the events page (example: check URL or a DOM flag)
    const isEventsPage = window.location.pathname.includes('events'); // adjust as needed

    fetch(GOOGLE_SHEET_CSV_URL)
        .then(response => response.text())
        .then(csvText => {
            const events = parseCSV(csvText).filter(e => {
                const masterDisplay = String(e.master_display).toUpperCase() === 'TRUE';
                const eventsPageFlag = String(e.events_page).toUpperCase() === 'TRUE';

                if (isEventsPage) {
                    // Show if both master_display and events_page true on events page
                    return masterDisplay && eventsPageFlag;
                } else {
                    // Show if master_display true on other pages regardless of events_page
                    return masterDisplay;
                }
            });

            const grid = document.createElement('div');
            grid.className = 'events-grid';

            events.forEach(event => {
                const tile = createEventTile(event);
                if (tile) grid.appendChild(tile);
            });

            document.querySelector('main').appendChild(grid);

            // Wait for all event tile images to load before injecting the footer
            const images = Array.from(grid.querySelectorAll('img'));
            let loadedCount = 0;
            if (images.length === 0) {
              injectFooter();
            } else {
              images.forEach(img => {
                if (img.complete) {
                  loadedCount++;
                  if (loadedCount === images.length) injectFooter();
                } else {
                  img.addEventListener('load', () => {
                    loadedCount++;
                    if (loadedCount === images.length) injectFooter();
                  });
                  img.addEventListener('error', () => {
                    loadedCount++;
                    if (loadedCount === images.length) injectFooter();
                  });
                }
              });
            }

            function injectFooter() {
              fetch('partials/footer.html')
                .then((response) => {
                  if (!response.ok) {
                    throw new Error(`Failed to load footer.html: ${response.statusText}`);
                  }
                  return response.text();
                })
                .then((footerContent) => {
                  const placeholder = document.getElementById('footer-placeholder');
                  if (placeholder) {
                    placeholder.innerHTML = footerContent;
                  }
                })
                .catch((error) => {
                  console.error(error);
                });
            }
        })
        .catch(error => {
            console.error('Error loading events:', error);
        });
}

// === EVENT LISTENERS ===

document.addEventListener('DOMContentLoaded', () => {
    // Only run on events.html
    if (document.getElementById('eventsGrid')) {
        loadAndDisplayEvents();
    }

    const returnButton = document.querySelector('.return-button');
    if (returnButton) {
        returnButton.addEventListener('click', () => {
            const modal = document.getElementById('eventModal');
            modal.classList.add('hidden');
            // Remove highlight from all bars when modal closes
            document.querySelectorAll('.calendar-event-bar--active').forEach(el => el.classList.remove('calendar-event-bar--active'));
        });
    }

    const modal = document.getElementById('eventModal');
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.add('hidden');
                // Remove highlight from all bars when modal closes
                document.querySelectorAll('.calendar-event-bar--active').forEach(el => el.classList.remove('calendar-event-bar--active'));
            }
        });
    }
});

// filepath: /Users/YouCanCallMeAll/code/project-pizza/resources/js/events.js
// Removed broken window.openEventModal assignment