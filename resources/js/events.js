// events.js

// === CONSTANTS ===

// CSV URL of your published Google Sheet (ensure the sheet is public!)
const GOOGLE_SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRt3kyrvcTvanJ0p3Umxrlk36QZIDKS91n2pmzXaYaCv73mhLnhLeBf_ZpU87fZe0pu8J1Vz6mjI6uE/pub?gid=0&single=true&output=csv';

// === FUNCTIONS ===

// === MODAL FUNCTIONALITY ===

// Updated formatEventDate to handle all desired behaviors
/*
 * formatEventDate Scenarios:
 * 1. Exact Start & End Datetime (One Day):
 *    - Example: "Sun, May 11, 2:00 – 5:00 PM"
 *    - Example: "Sun, May 11, 10:00 AM – 5:00 PM"
 * 
 * 2. Exact Start & End Datetime (Over Many Days):
 *    - Example: "Sun, May 11 – Tues, May 13, 2:00 - 5:00 PM"
 *    - Example: "Sun, May 11 2025 – Tues, May 13, 10:00 AM - 5:00 PM"
 * 
 * 3. Exact Day but Not Time (One Day):
 *    - Example: "Sun, May 11"
 * 
 * 4. Exact Start & End Day but No Time (Over Many Days):
 *    - Example: "Sun, May 11 – Tue, May 13"
 * 
 * 5. Single day, all day:
 *    - Example: "Sun, May 11 (all day)"
 * 
 * 6. Multi-day, all day:
 *    - Example: "Sun, May 11 – Tue, May 13 (all day)"
 * 
 * 7. Ongoing Events (With Start Date):
 *    - Example: "Starting Sun, May 11, ongoing"
 * 
 * 8. Recurring Events (Specific Days or Times):
 *    - Example: "Next on "Fri, May 16, 5:30 – 8:30 PM"
 * 
 * 8. Drop-In Events (Exact Start Time but No End Time):
 *    - Example: "Sun, May 11, starting at 2:00 PM"
 * 
 * 10. Closing Events (Exact End Time but No Start Time):
 *    - Example: "Sun, May 11, ending at 5:00 PM"
 * 
 * 11. Seasonal or Approximate Date Ranges:
 *    - Example: "Spring 2025", or "May 2025"
 * 
 * 12. Multi-Session Events (Specific Dates and Times for Each Session):
 *    - Example:
 *      "Session 1: Sun, May 11, 2:00 PM – 4:00 PM"
 *      "Session 2: Mon, May 12, 10:00 AM – 12:00 PM"
 * 
 * 13. Events with No Specific Date or Time (TBD):
 *    - Example: "Date and time to be announced"
 * 
 * 14. Ongoing Event
 *   - Example: "Ongoing"
 */
function formatEventDate(start, end, allDay, recurring) {
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
     * Example 14: Ongoing Events
     * Input: start = "Ongoing", end = "", allDay = "TRUE", recurring = "FALSE"
     * Output (Tile): "Ongoing"
     * Output (Modal): "Ongoing"
     */
    if (start === 'Ongoing' && !end) {
        return 'Ongoing';
    }

    /*
     * Example 1: Exact Start & End Datetime (One Day)
     * Input: start = "2025-05-11 10:00:00", end = "2025-05-11 17:00:00", allDay = "FALSE", recurring = "FALSE"
     * Output (Tile): "Sun, May 11, 10:00 AM – 5:00 PM"
     * Output (Modal): "Sun, May 11, 10:00 AM – 5:00 PM"
     */
    if (startDate.toDateString() === endDate.toDateString() && start.includes(':') && end.includes(':') && allDay === 'FALSE' && recurring === 'FALSE') {
        return `${startDateFormatted}, ${startTimeFormatted} – ${endTimeFormatted}`;
    }

    /*
     * Example 2: Exact Start & End Datetime (Over Many Days)
     * Input: start = "2025-05-11 10:00:00", end = "2025-05-13 17:00:00", allDay = "FALSE", recurring = "FALSE"
     * Output (Tile): "Sun, May 11, 10:00 AM – Tue, May 13, 5:00 PM"
     * Output (Modal): "Sun, May 11, 10:00 AM – Tue, May 13, 5:00 PM"
     */
    if (start.includes(':') && end.includes(':') && (startTimeFormatted != '12:00 AM' || endTimeFormatted != '12:00 AM') && allDay === 'FALSE' && recurring === 'FALSE') {
        return `${startDateFormatted} - ${endDateFormatted}, ${startTimeFormatted} – ${endTimeFormatted}`;
    }

    /*
     * Example 3: Exact Day but Not Time (One Day)
     * Input: start = "2025-05-11", end = "2025-05-11", allDay = "FALSE", recurring = "FALSE"
     * Output (Tile): "Sun, May 11"
     * Output (Modal): "Sun, May 11"
     */
    if (startDate.toDateString() === endDate.toDateString() && ((!start.includes(':') && !end.includes(':')) || (startTimeFormatted === '12:00 AM' && endTimeFormatted === '12:00 AM')) && allDay === 'FALSE' && recurring === 'FALSE') {
        return startDateFormatted;
    }

    /*
     * Example 4: Exact Start & End Day but No Time (Over Many Days)
     * Input: start = "2025-05-11", end = "2025-05-13", allDay = "FALSE", recurring = "FALSE"
     * Output (Tile): "Sun, May 11 – Tue, May 13"
     * Output (Modal): "Sun, May 11 – Tue, May 13"
     */
    if (start != end && ((!start.includes(':') && !end.includes(':')) || (startTimeFormatted === '12:00 AM' && endTimeFormatted === '12:00 AM')) && allDay === 'FALSE' && recurring === 'FALSE') {
        return `${startDateFormatted} – ${endDateFormatted}`;
    }

    /*
     * Example 5: Single day, all day
     * Input: start = "2025-05-11", end = "2025-05-11", allDay = "TRUE", recurring = "FALSE"
     * Output (Tile): "Sun, May 11 (all day)"
     * Output (Modal): "Sun, May 11 (all day)"
     */
    if (allDay === 'TRUE' && recurring === 'FALSE' && start === end) {
        return `${startDateFormatted} (all day)`;
    }

    /*
     * Example 6: Multi-day, all day
     * Input: start = "2025-05-11", end = "2025-05-13", allDay = "TRUE", recurring = "FALSE"
     * Output (Tile): "Sun, May 11 – Tue, May 13 (all day)"
     * Output (Modal): "Sun, May 11 – Tue, May 13 (all day)"
     */
    if (allDay === 'TRUE' && recurring === 'FALSE' && start !== end && end) {
        return `${startDateFormatted} – ${endDateFormatted} (all day)`;
    }

    /*
     * Example 7: Ongoing Events (With Start Date)
     * Input: start = "2025-05-11", end = "Ongoing"
     * Output (Tile): "Starting Sun, May 11, ongoing"
     * Output (Modal): "Starting Sun, May 11, ongoing"
     */
    if (start && (end === 'Ongoing')) {
        return `Starting ${startDateFormatted}, ongoing`;
    }

    /*
     * Example 8: Recurring Events (Specific Days or Times)
     * Input: start = "2025-05-16 17:30:00", end = "2025-05-16 20:30:00", recurring = "TRUE", recurrence_pattern = "Every Friday from 5:30 PM to 8:30 PM"
     * Output (Tile): "Next on Fri, May 16, 5:30 – 8:30 PM"
     * Output (Modal): "Next on Fri, May 16, 5:30 – 8:30 PM"
     */
    if (recurring === 'TRUE') {
        return `Next on ${startDateFormatted}, ${startTimeFormatted} – ${endTimeFormatted}`
    }

    /*
     * Example 9: Drop-In Events (Exact Start Time but No End Time)
     * Input: start = "2025-05-11 14:00:00", end = "", allDay = "FALSE", recurring = "FALSE"
     * Output (Tile): "Sun, May 11, starting at 2:00 PM"
     * Output (Modal): "Sun, May 11, starting at 2:00 PM"
     */
    if (start && !end) {
        return `${startDateFormatted}, starting at ${startTimeFormatted}`;
    }

    /*
     * Example 10 Closing Events (Exact End Time but No Start Time)
     * Input: start = "", end = "2025-05-11 17:00:00"
     * Output (Tile): "Sun, May 11, ending at 5:00 PM"
     * Output (Modal): "Sun, May 11, ending at 5:00 PM"
     */
    if (!start && end) {
        return `${endDateFormatted}, ending at ${endTimeFormatted}`;
    }

    /*
     * Example 11: Seasonal or Approximate Date Ranges
     * Input: start = "2025-05", end = "2025-05"
     * Output (Tile): "May 2025"
     * Output (Modal): "May 2025"
     */
    if (start.includes('-') && !start.includes(':') && start === end) {
        return `${startDateEastern.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`;
    } else if (start.includes('-') && !start.includes(':') && start !== end) {
        // Handle seasonal ranges spanning multiple months or years
        const startMonthYear = startDateEastern.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        const endMonthYear = endDateEastern.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        return `${startMonthYear} – ${endMonthYear}`;
    }

    /*
     * Example 12: Multi-Session Events (Specific Dates and Times for Each Session)
     * Input: Sessions provided as an array of objects with start and end times
     * Output (Tile): "Session 1: Sun, May 11, 2:00 PM – 4:00 PM"
     * Output (Modal): "Session 1: Sun, May 11, 2:00 PM – 4:00 PM\nSession 2: Mon, May 12, 10:00 AM – 12:00 PM"
     */
    if (event.sessions && Array.isArray(event.sessions)) {
        return event.sessions.map(session => {
            const sessionStart = new Date(session.start);
            const sessionEnd = new Date(session.end);
            const sessionStartFormatted = sessionStart.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
            const sessionStartTimeFormatted = sessionStart.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
            const sessionEndTimeFormatted = sessionEnd.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
            return `${sessionStartFormatted}, ${sessionStartTimeFormatted} – ${sessionEndTimeFormatted}`;
        }).join('\n');
    }

    /*
     * Example 13: Events with No Specific Date or Time (TBD)
     * Input: start = "", end = ""
     * Output (Tile): "Date and time to be announced"
     * Output (Modal): "Date and time to be announced"
     */
    if (!start || !end) {
        return 'Date and time to be announced';
    }

    /* Scenaio 14. Ongoing Events
     * Input: start = "Ongoing", end = "", allDay = "FALSE", recurring = "FALSE"
     * Output (Tile): "Ongoing"
     * Output (Modal): "Ongoing"
     */
    if (start === 'Ongoing') {
        return 'Ongoing';
    }
}

// Function to open the modal and populate it with event details
function openEventModal(event) {
    const modal = document.getElementById('eventModal');

    // Populate modal content
    document.getElementById('modalTitle').textContent = event.name;
    document.getElementById('modalImage').src = event.img || 'resources/images/images/default-event-image.jpeg';
    document.getElementById('modalImage').alt = `${event.name} image`;
    document.getElementById('modalDateRange').textContent = formatEventDate(
        event.start_datetime,
        event.end_datetime,
        event.all_day,
        event.recurring
    );
    document.getElementById('modalLocation').textContent = `${event.location || 'TBD'}`;
    document.getElementById('modalDescription').textContent = event.long_desc || 'No description available.';

    // Populate the button
    const modalLink = document.getElementById('modalLink');
    if (event.link && event.link_text) {
        modalLink.href = event.link;
        modalLink.textContent = event.link_text;
        modalLink.classList.remove('hidden'); // Show the button
    } else {
        modalLink.classList.add('hidden'); // Hide the button if no link is provided
    }

    // Show the modal
    modal.classList.remove('hidden');
}

// Add event listener to the "Return to all events" button
const returnButton = document.querySelector('.return-button');
if (returnButton) {
    returnButton.addEventListener('click', () => {
        const modal = document.getElementById('eventModal');
        modal.classList.add('hidden'); // Close the modal
    });
}

// Add event listener to close modal when clicking outside the content
const modal = document.getElementById('eventModal');
if (modal) {
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeEventModal();
        }
    });
}

// Function to create event tiles in event grit
function createEventTile(event) {
    console.log('Creating tile for event:', event); // Debugging log

    const tile = document.createElement('div');
    tile.className = 'event-tile';

    // Image
    const img = document.createElement('img');
    img.src = event.img || 'resources/images/images/default-event-image.jpeg'; // Fallback image
    img.alt = `${event.name} image`;
    img.className = 'event-img';

    // Title
    const title = document.createElement('h3');
    title.textContent = event.name;

    // Date range
    const dateText = document.createElement('p');
    dateText.textContent = formatEventDate(event.start_datetime, event.end_datetime, event.all_day, event.recurring);

    // Add click event listener to open modal
    tile.addEventListener('click', () => openEventModal(event));

    // Assemble tile
    tile.appendChild(img);
    tile.appendChild(title);
    tile.appendChild(dateText);

    return tile;
}

function parseCSV(csvText) {
    const rows = csvText.trim().split('\n');

    // Split the first line for headers
    const headers = rows[0].split(',').map(h => h.trim());

    // Convert each row into an object
    const events = rows.slice(1).map(row => {
        const values = row.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(v => v.trim()); // Handles commas inside quotes

        // Zip headers and values together into an object
        const event = {};
        headers.forEach((header, i) => {
            event[header] = values[i]?.replace(/^"|"$/g, ''); // Remove surrounding quotes
        });

        // Ensure recurring field is always defined
        event['recurring'] = event['recurring'] || 'FALSE';

        console.log('Raw event data:', event); // Debugging log to inspect raw event data

        return event;
    });

    return events;
}

// Fetch and display events from CSV
function loadAndDisplayEvents() {
    fetch(GOOGLE_SHEET_CSV_URL)
        .then(response => response.text())
        .then(csvText => {
            const events = parseCSV(csvText);
            console.log('Parsed Events:', events); // Debugging log

            const grid = document.createElement('div');
            grid.className = 'events-grid';

            events.forEach(event => {
                console.log('Event:', event); // Debugging log
                const tile = createEventTile(event);
                grid.appendChild(tile);
            });

            document.querySelector('main').appendChild(grid);
        })
        .catch(error => {
            console.error('Error loading events:', error);
        });
}

// === MAIN ===

document.addEventListener('DOMContentLoaded', () => {
    // Load and display events
    loadAndDisplayEvents();

    // Add event listener to the "Return to all events" button
    const returnButton = document.querySelector('.return-button');
    if (returnButton) {
        returnButton.addEventListener('click', () => {
            const modal = document.getElementById('eventModal');
            modal.classList.add('hidden'); // Close the modal
        });
    }

    // Add event listener to close modal when clicking outside the content
    const modal = document.getElementById('eventModal');
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.add('hidden'); // Close the modal
            }
        });
    }
});