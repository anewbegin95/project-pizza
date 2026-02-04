// === CONSTANTS ===

/**
 * URL of the published Google Sheet in CSV format.
 * Ensure the sheet is public for this to work.
 */
const GOOGLE_SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRt3kyrvcTvanJ0p3Umxrlk36QZIDKS91n2pmzXaYaCv73mhLnhLeBf_ZpU87fZe0pu8J1Vz6mjI6uE/pub?gid=0&single=true&output=csv';

// === UTILITY FUNCTIONS ===

/**
 * Parses a CSV string into an array of pop-up objects.
 * Handles multi-line fields and ensures proper formatting for fields like `short_desc` and `long_desc`.
 * @param {string} csvText - The raw CSV string.
 * @returns {Array<Object>} - Array of parsed pop-up objects.
 */
function parseCSV(csvText) {
    const rows = csvText.trim().split('\n');
    const headers = rows[0].split(',').map(h => h.trim());
    const popups = [];
    let currentRow = [];

    rows.slice(1).forEach(row => {
        currentRow.push(row);
        const combinedRow = currentRow.join('\n');
        const quoteCount = (combinedRow.match(/"/g) || []).length;

        if (quoteCount % 2 === 0) {
            const values = combinedRow.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(v => v.trim());
            const popup = {};
            headers.forEach((header, i) => {
                popup[header] = values[i]?.replace(/^"+|"+$/g, '') || '';
            });
            // Normalize legacy event-based flags to popup flags
            if (!popup['popups_page'] && popup['events_page']) {
                popup['popups_page'] = popup['events_page'];
            }
            popup['recurring'] = popup['recurring'] || 'FALSE';
            popup['master_display'] = popup['master_display'] || 'TRUE';
            popup['popups_page'] = popup['popups_page'] || 'TRUE';
            popup['calendar'] = popup['calendar'] || 'TRUE';
            popup['link'] = popup['link'] || '';
            popups.push(popup);
            currentRow = [];
        }
    });

    // Assign popup.id using the new generatePopupId (name only)
    popups.forEach(popup => {
        popup.id = generatePopupId(popup);
    });

    return popups;
}

/**
 * Generates a unique pop-up ID (slug) from name only.
 * Example output: "pizza-pop-up"
 * @param {Object} popup - Pop-up object containing `name`.
 * @returns {string} - Unique pop-up ID.
 */
function generatePopupId(popup) {
    // Use popup name only, lowercased and slugified
    return (popup.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/**
 * Formats pop-up dates into human-readable strings based on various scenarios.
 *
 * Examples:
 * 1) Ongoing Pop-Ups
 *    - Input: start = "Ongoing", end = "", allDay = "TRUE", recurring = "FALSE"
 *    - Output: "Ongoing"
 *
 * 2) Ongoing (With Start Date)
 *    - Input: start = "2025-05-11", end = "Ongoing"
 *    - Output: "Starting Sun, May 11, ongoing"
 *
 * 3) Exact Start & End Datetime (One Day)
 *    - Input: start = "2025-05-11 10:00:00", end = "2025-05-11 17:00:00", allDay = "FALSE", recurring = "FALSE"
 *    - Output: "Sun, May 11, 10:00 AM – 5:00 PM"
 *
 * 4) Exact Start & End Datetime (Over Many Days)
 *    - Input: start = "2025-05-11 10:00:00", end = "2025-05-13 17:00:00", allDay = "FALSE", recurring = "FALSE"
 *    - Output: "Sun, May 11, 10:00 AM – Tue, May 13, 5:00 PM"
 *
 * 5) Exact Day but Not Time (One Day)
 *    - Input: start = "2025-05-11", end = "", allDay = "FALSE", recurring = "FALSE"
 *    - Output: "Sun, May 11"
 *
 * 6) Exact Start & End Day but No Time (Over Many Days)
 *    - Input: start = "2025-05-11", end = "2025-05-13", allDay = "FALSE", recurring = "FALSE"
 *    - Output: "Sun, May 11 – Tue, May 13"
 *
 * 7) Single Day, All Day
 *    - Input: start = "2025-05-11" & end = "2025-05-11" or "2025-05-11" & end = "", allDay = "TRUE", recurring = "FALSE"
 *    - Output: "Sun, May 11 (all day)"
 *
 * 8) Multi-day, All Day
 *    - Input: start = "2025-05-11", end = "2025-05-13", allDay = "TRUE", recurring = "FALSE"
 *    - Output: "Sun, May 11 – Tue, May 13 (all day)"
 *
 * 9) Recurring Pop-Ups (Specific Days or Times)
 *    - Input: start = "2025-05-16 17:30:00", end = "2025-05-16 20:30:00", recurring = "TRUE"
 *    - Output: "Fri, May 16, 5:30 – 8:30 PM"
 *
 * 10) Drop-In Pop-Ups (Start Time only)
 *    - Input: start = "2025-05-11 14:00:00", end = "", allDay = "FALSE", recurring = "FALSE"
 *    - Output: "Sun, May 11, starting at 2:00 PM"
 *
 * 11) Closing Pop-Ups (End Time only)
 *    - Input: start = "", end = "2025-05-11 17:00:00"
 *    - Output: "Sun, May 11, ending at 5:00 PM"
 *
 * 12) TBD (No Specific Date or Time)
 *    - Input: start = "", end = ""
 *    - Output: "Date and time to be announced"
 */
function formatPopupDate(start, end, allDay, recurring) {
    const startDate = parsePopupDate(start);
    const endDate = parsePopupDate(end);

    if (!start) start = '';
    if (!end) end = '';

    const startDateFormatted = startDate
        ? startDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
        : '';
    const endDateFormatted = endDate
        ? endDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
        : '';
    const startTimeFormatted = startDate
        ? startDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
        : '';
    const endTimeFormatted = endDate
        ? endDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
        : '';

    if (start === 'Ongoing' && !end) {
        return 'Ongoing';
    }
    if (start && end === 'Ongoing') {
        return `Starting ${startDateFormatted}, ongoing`;
    }
    if (startDate && endDate && startDate.toDateString() === endDate.toDateString()
        && start.includes(':') && end.includes(':')
        && allDay === 'FALSE' && recurring === 'FALSE') {
        return `${startDateFormatted}, ${startTimeFormatted} – ${endTimeFormatted}`;
    }
    if (startDate && endDate && startDate.toDateString() != endDate.toDateString()
        && start.includes(':') && end.includes(':')
        && allDay === 'FALSE' && recurring === 'FALSE') {
        return `${startDateFormatted}, ${startTimeFormatted} - ${endDateFormatted}, ${endTimeFormatted}`;
    }
    if (start && !end && !start.includes(':') && allDay === 'FALSE' && recurring === 'FALSE') {
        return startDateFormatted;
    }
    if (start != end && !start.includes(':') && !end.includes(':') && allDay === 'FALSE' && recurring === 'FALSE') {
        return `${startDateFormatted} – ${endDateFormatted}`;
    }
    if ((start === end || (start && !end)) && allDay === 'TRUE' && recurring === 'FALSE') {
        return `${startDateFormatted} (all day)`;
    }
    if (start != end && allDay === 'TRUE' && recurring === 'FALSE') {
        return `${startDateFormatted} - ${endDateFormatted} (all day)`;
    }
    if (recurring === 'TRUE') {
        return `${startDateFormatted}, ${startTimeFormatted} – ${endTimeFormatted}`;
    }
    if (start && !end) {
        return `${startDateFormatted}, starting at ${startTimeFormatted}`;
    }
    if (!start && end) {
        return `${endDateFormatted}, ending at ${endTimeFormatted}`;
    }
    if (!start && !end) {
        return 'Date and time to be announced';
    }
}

/**
 * Formats pop-up dates into human-readable strings based on various scenarios.
 * @param {string} start - Start date/time of the pop-up.
 * @param {string} end - End date/time of the pop-up.
 * @param {string} allDay - Whether the pop-up lasts all day.
 * @param {string} recurring - Whether the pop-up is recurring.
 * @returns {string} - Formatted date string.
 */
function formatEventDate(start, end, allDay, recurring) {
    // Legacy wrapper for compatibility
    return formatPopupDate(start, end, allDay, recurring);
}

/**
 * Robustly parse a date string from the CMS, accepting:
 * - YYYY-MM-DD HH:MM:SS
 * - YYYY-M-D H:MM:SS
 * - M/D/YYYY H:MM:SS
 * - MM/DD/YYYY HH:MM:SS
 * - and similar variants (with or without leading zeros)
 * Returns a Date object or null if invalid.
 *
 * Notes:
 * - Uses local parsing with minor normalization (slashes for dashes) to support Safari.
 * - Avoids timezone conversion; treats provided times as local display values.
 */
function parsePopupDate(str) {
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

function parseEventDate(str) {
    // Legacy wrapper
    return parsePopupDate(str);
}

/**
 * Checks if a pop-up spans multiple calendar days (non-all-day, non-recurring).
 * Mirrors Example 4 in the date formatting docs.
 */
function isMultiDayPopup(popup) {
    const startDate = parseEventDate(popup.start_datetime);
    const endDate = parseEventDate(popup.end_datetime);
    if (!popup.start_datetime || !popup.end_datetime) return false;
    return (
        startDate.toDateString() !== endDate.toDateString() &&
        popup.start_datetime.includes(':') &&
        popup.end_datetime.includes(':') &&
        String(popup.all_day).toUpperCase() === 'FALSE' &&
        String(popup.recurring).toUpperCase() === 'FALSE'
    );
}

function isMultiDayEvent(popup) {
    // Legacy wrapper
    return isMultiDayPopup(popup);
}

// === UI RENDERING FUNCTIONS ===

/**
 * Creates a pop-up tile for the pop-ups grid.
 * @param {Object} popup - Pop-up object containing details.
 * @returns {HTMLElement|null} - The pop-up tile element or null if it should not be displayed.
 */
function createPopupTile(popup, skipPopupsPageCheck = false) {
    if (String(popup.master_display).toUpperCase() === 'FALSE') return null;
    if (!skipPopupsPageCheck && String(popup.popups_page).toUpperCase() === 'FALSE') return null;

    const tile = document.createElement('div');
    // BEM/component refactor for popup tile
    tile.className = 'popup-tile popup-tile--horizontal';

    // Left: Image
    const imgContainer = document.createElement('div');
    imgContainer.className = 'popup-tile__img-container';
    const img = document.createElement('img');
    img.src = popup.img || 'resources/images/images/default-popup-image.jpeg';
    img.alt = `${popup.name} image`;
    img.className = 'popup-tile__img';
    imgContainer.appendChild(img);

    // Right: Details
    const details = document.createElement('div');
    details.className = 'popup-tile__details';
    const title = document.createElement('h3');
    title.textContent = popup.name;
    const dateText = document.createElement('p');
    dateText.className = 'popup-tile__date';
    dateText.textContent = formatPopupDate(popup.start_datetime, popup.end_datetime, popup.all_day, popup.recurring);
    const location = document.createElement('p');
    location.className = 'popup-tile__location';
    location.textContent = popup.location || '';

    details.appendChild(title);
    details.appendChild(dateText);
    details.appendChild(location);

    tile.appendChild(imgContainer);
    tile.appendChild(details);

    tile.addEventListener('click', () => {
        window.location.href = `pop-up.html?id=${popup.id}`;
    });

    return tile;
}

/**
 * Opens a modal showing all pop-ups for a given day in a grid (like the pop-ups page).
 * @param {Date} date - The date for which to show pop-ups.
 * @param {Array<Object>} popupsForDay - Array of pop-up objects for the day.
 */
function openDayPopupsModal(date, popupsForDay) {
    const modal = document.getElementById('popupModal');
    const modalContent = modal.querySelector('.modal-content');
    // Hide the single pop-up modal content
    modal.querySelector('.modal-details').style.display = 'none';
    modal.querySelector('.modal-main').style.display = 'none';
    // Switch modal-content to single-column for day grid
    modalContent.classList.add('show-day-grid');

    // Remove any existing day-popups grid
    let dayGrid = modal.querySelector('.day-popups-grid');
    if (dayGrid) dayGrid.remove();

    // Update the return button text (no inline style)
    const returnButton = modal.querySelector('.return-button');
    if (returnButton) {
        returnButton.textContent = '← Return to calendar';
        // Restore modal content and remove day grid/modal class on click
        returnButton.onclick = () => {
            if (modal.querySelector('.day-popups-grid'))
                modal.querySelector('.day-popups-grid').remove();
            modalContent.classList.remove('show-day-grid');
            // Restore modal content (details/main)
            modal.querySelector('.modal-details').style.display = '';
            modal.querySelector('.modal-main').style.display = '';
            // Remove highlight from all bars
            document.querySelectorAll('.calendar-popup-bar--active').forEach(el => el.classList.remove('calendar-popup-bar--active'));
            modal.classList.add('hidden');
        };
    }

    // Create a new grid for the day's pop-ups
    dayGrid = document.createElement('div');
    dayGrid.className = 'day-popups-grid popups-grid';

    // Add a heading for the date (centered at top, no inline style)
    const heading = document.createElement('h2');
    heading.textContent = date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    heading.className = 'day-popups-heading';
    dayGrid.appendChild(heading);

    // Add pop-up tiles, each with a click handler to open the standard pop-up modal
    popupsForDay.forEach(popup => {
        const tile = createPopupTile(popup, true);
        if (tile) {
            tile.onclick = (e) => {
                e.stopPropagation();
                // Remove only the day grid and modal class, restore modal content
                if (modal.querySelector('.day-popups-grid'))
                    modal.querySelector('.day-popups-grid').remove();
                modalContent.classList.remove('show-day-grid');
                modal.querySelector('.modal-details').style.display = '';
                modal.querySelector('.modal-main').style.display = '';
                // Show pop-up details in the modal (populate modal-details with popup info)
                populatePopupModal(popup);
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
            if (modal.querySelector('.day-popups-grid'))
                modal.querySelector('.day-popups-grid').remove();
            modalContent.classList.remove('show-day-grid');
            modal.querySelector('.modal-details').style.display = '';
            modal.querySelector('.modal-main').style.display = '';
            document.querySelectorAll('.calendar-popup-bar--active').forEach(el => el.classList.remove('calendar-popup-bar--active'));
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

/**
 * Generate an ICS for a single day instance of a multi-day pop-up.
 * Times are emitted in America/New_York (TZID) for correct local interpretation.
 */
function generateSingleDayICS(popup, day, startTime, endTime) {
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
        `UID:${popup.name.replace(/\s+/g, '_')}_${dtStart}@nycsliceoflife.com`,
        `SUMMARY:${escapeICSText(popup.name)}`,
        `DTSTART;TZID=America/New_York:${dtStart}`,
        `DTEND;TZID=America/New_York:${dtEnd}`,
        `DTSTAMP;TZID=America/New_York:${dtStamp}`,
        `LOCATION:${escapeICSText(popup.location || '')}`,
        `DESCRIPTION:${escapeICSText(popup.long_desc || '')}`,
        'END:VEVENT',
        'END:VCALENDAR'
    ].join('\r\n');
    return foldICSLines(ics);
}

/**
 * Generate an ICS for a single- or multi-day pop-up.
 * Emits DTSTART/DTEND as date-only for all-day pop-ups, otherwise with America/New_York TZ.
 */
function generateICS(popup) {
    const formatDateSingle = (dateString, allDay) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        if (allDay === 'TRUE') {
            // All-day pop-ups: just date
            const options = { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' };
            const parts = new Intl.DateTimeFormat('en-US', options).formatToParts(date);
            const get = (type) => parts.find(p => p.type === type).value;
            return `${get('year')}${get('month')}${get('day')}`;
        }
        return toEasternICSDateTime(date);
    };
    const dtStart = formatDateSingle(popup.start_datetime, popup.all_day);
    const dtEnd = formatDateSingle(popup.end_datetime, popup.all_day);
    const now = new Date();
    const dtStamp = toEasternICSDateTime(now);
    let ics = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//NYC Slice of Life//EN',
        'CALSCALE:GREGORIAN',
        'X-WR-TIMEZONE:America/New_York',
        'BEGIN:VEVENT',
        `UID:${popup.name.replace(/\s+/g, '_')}_${dtStart}@nycsliceoflife.com`,
        `SUMMARY:${escapeICSText(popup.name)}`,
        popup.all_day === 'TRUE'
            ? `DTSTART;VALUE=DATE:${dtStart}`
            : `DTSTART;TZID=America/New_York:${dtStart}`,
        popup.all_day === 'TRUE'
            ? `DTEND;VALUE=DATE:${dtEnd}`
            : `DTEND;TZID=America/New_York:${dtEnd}`,
        `DTSTAMP;TZID=America/New_York:${dtStamp}`,
        `LOCATION:${escapeICSText(popup.location || '')}`,
        `DESCRIPTION:${escapeICSText(popup.long_desc || '')}`,
        'END:VEVENT',
        'END:VCALENDAR'
    ].join('\r\n');
    return foldICSLines(ics);
}

// Duplicate UTC-based generateSingleDayICS removed; Eastern TZ version retained above.

function downloadICS(popup, specificDay, startTime, endTime) {
    let icsContent, filename;
    if (isMultiDayPopup(popup) && specificDay) {
        icsContent = generateSingleDayICS(popup, specificDay, startTime, endTime);
        filename = `${popup.name.replace(/\s+/g, '_')}_${specificDay.toISOString().split('T')[0]}.ics`;
    } else {
        icsContent = generateICS(popup);
        filename = `${popup.name.replace(/\s+/g, '_')}.ics`;
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
 * Fetches pop-ups from the CSV URL, parses them, and displays them in the pop-ups grid.
 */
function loadAndDisplayPopups() {
    // Detect if we're on the pop-ups page (example: check URL or a DOM flag)
    const isPopupsPage = window.location.pathname.includes('pop-ups'); // adjust as needed

    fetch(GOOGLE_SHEET_CSV_URL)
        .then(response => response.text())
        .then(csvText => {
            const popups = parseCSV(csvText).filter(e => {
                const masterDisplay = String(e.master_display).toUpperCase() === 'TRUE';
                const popupsPageFlag = String(e.popups_page).toUpperCase() === 'TRUE';

                if (isPopupsPage) {
                    // Show if both master_display and popups_page true on pop-ups page
                    return masterDisplay && popupsPageFlag;
                } else {
                    // Show if master_display true on other pages regardless of popups_page
                    return masterDisplay;
                }
            });

            const grid = document.createElement('div');
            grid.className = 'popups-grid';

            popups.forEach(popup => {
                const tile = createPopupTile(popup);
                if (tile) grid.appendChild(tile);
            });

            document.querySelector('main').appendChild(grid);

            // Inject JSON-LD for CollectionPage + ItemList of pop-ups
            // Only do this on the pop-ups.html listing page
            const isPopupsCollectionPage = typeof window !== 'undefined' &&
                /\/pop-ups\.html?$/.test(window.location.pathname);
            if (isPopupsCollectionPage) {
                try {
                    const origin = 'https://nycsliceoflife.com';
                    const collectionJsonLd = {
                        '@context': 'https://schema.org',
                        '@type': 'CollectionPage',
                        name: 'Upcoming NYC Pop-Ups',
                        description: document.documentElement.getAttribute('data-description') || 'Browse upcoming pop-ups in New York City.',
                        url: origin + '/pop-ups.html',
                        mainEntity: {
                            '@type': 'ItemList',
                            itemListElement: []
                        }
                    };
                    popups.forEach((popup, i) => {
                        const listItem = {
                            '@type': 'ListItem',
                            position: i + 1,
                            item: {
                                '@type': 'Event',
                                name: popup.name,
                                startDate: popup.start_datetime || undefined,
                                endDate: popup.end_datetime || undefined,
                                eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
                                eventStatus: 'https://schema.org/EventScheduled',
                                location: popup.location ? { '@type': 'Place', name: popup.location } : undefined,
                                image: popup.img || undefined,
                                url: origin + '/pop-up.html?id=' + popup.id
                            }
                        };
                        collectionJsonLd.mainEntity.itemListElement.push(listItem);
                    });
                    const script = document.createElement('script');
                    script.type = 'application/ld+json';
                    script.textContent = JSON.stringify(collectionJsonLd);
                    document.head.appendChild(script);
                } catch (e) {
                    console.warn('JSON-LD injection failed:', e);
                }
            }

            // Wait for all pop-up tile images to load before injecting the footer
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
            console.error('Error loading pop-ups:', error);
        });
}

// === EVENT LISTENERS ===

document.addEventListener('DOMContentLoaded', () => {
    // Only run on pop-ups.html
    if (document.getElementById('popupsGrid')) {
        loadAndDisplayPopups();
    }

    const returnButton = document.querySelector('.return-button');
    if (returnButton) {
        returnButton.addEventListener('click', () => {
            const modal = document.getElementById('popupModal');
            modal.classList.add('hidden');
            // Remove highlight from all bars when modal closes
            document.querySelectorAll('.calendar-popup-bar--active').forEach(el => el.classList.remove('calendar-popup-bar--active'));
        });
    }

    const modal = document.getElementById('popupModal');
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.add('hidden');
                // Remove highlight from all bars when modal closes
                document.querySelectorAll('.calendar-popup-bar--active').forEach(el => el.classList.remove('calendar-popup-bar--active'));
            }
        });
    }
});

// Compatibility/fallback: support legacy populate function name if present
function populatePopupModal(popup) {
    if (typeof populateEventModal === 'function') {
        return populateEventModal(popup);
    }
    // Fallback behavior: navigate to the pop-up detail page
    if (popup && popup.id) {
        window.location.href = `pop-up.html?id=${popup.id}`;
    }
}

// filepath: /Users/YouCanCallMeAll/code/project-pizza/resources/js/pop-ups.js
// Removed broken window.openEventModal assignment