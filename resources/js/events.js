// events.js

// === CONSTANTS ===

// CSV URL of your published Google Sheet (ensure the sheet is public!)
const GOOGLE_SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRt3kyrvcTvanJ0p3Umxrlk36QZIDKS91n2pmzXaYaCv73mhLnhLeBf_ZpU87fZe0pu8J1Vz6mjI6uE/pub?gid=0&single=true&output=csv';

// === FUNCTIONS ===

// === MODAL FUNCTIONALITY ===

/*
 * formatEventDate Scenarios:
 * 1. Ongoing Events:
 *    - If the start date is 'Ongoing', display 'Ongoing'.
 * 
 * 2. Invalid or Missing Dates:
 *    - If either start or end date is invalid, display 'Invalid date'.
 * 
 * 3. All-Day Events:
 *    - Single-day all-day event: Display the date (e.g., 'Fri, May 16').
 *    - Multi-day all-day event: Display the date range (e.g., 'May 16 – May 17').
 * 
 * 4. Events with Inspecific Times:
 *    - If both start and end times are '0:00' or missing, display only the date range (e.g., 'May 16 – May 17').
 * 
 * 5. Same-Day Events with Precise Times:
 *    - If the start and end times are on the same day and precise, display the date with a time range (e.g., 'Fri, May 16, 5:30 - 8:30 PM').
 * 
 * 6. Multi-Day Events with Times:
 *    - If the event spans multiple days with times, display the full date and time range (e.g., 'Fri, May 16, 5:30 PM – Sat, May 17, 8:30 PM').
 */

// Updated formatEventDate to handle all desired behaviors
function formatEventDate(start, end, allDay) {
    if (start === 'Ongoing') {
        return 'Ongoing';
    }

    // Parse dates explicitly to handle the format correctly
    const startDate = new Date(Date.parse(start));
    const endDate = new Date(Date.parse(end));

    if (isNaN(startDate) || isNaN(endDate)) {
        console.error('Invalid date format:', { start, end });
        return 'Invalid date';
    }

    // Adjust dates to Eastern Time (US) explicitly
    const startDateEastern = new Date(startDate.toLocaleString('en-US', { timeZone: 'America/New_York' }));
    const endDateEastern = new Date(endDate.toLocaleString('en-US', { timeZone: 'America/New_York' }));

    // Format dates directly with the correct timezone
    const startDateFormatted = startDateEastern.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    const endDateFormatted = endDateEastern.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

    const startTimeFormatted = startDateEastern.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    const endTimeFormatted = endDateEastern.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

    if (allDay === 'TRUE') {
        if (start === end) {
            return startDateFormatted; // Single-day all-day event
        } else {
            return `${startDateFormatted} – ${endDateFormatted}`; // Multi-day all-day event
        }
    } else {
        if (startTimeFormatted === '12:00 AM' && endTimeFormatted === '12:00 AM' && startDate.toDateString() !== endDate.toDateString()) {
            // If both times are midnight and the dates differ, render only the date range without times
            return `${startDateFormatted} – ${endDateFormatted}`;
        } else if (!start.includes(':') && !end.includes(':')) {
            // Inspecific times
            return `${startDateFormatted} – ${endDateFormatted}`;
        } else if (startDate.toDateString() === endDate.toDateString() && start.includes(':') && end.includes(':')) {
            // Same-day event with precise times
            return `${startDateFormatted}, ${startTimeFormatted} - ${endTimeFormatted}`;
        } else if (startDate.toDateString() === endDate.toDateString()) {
            // Same-day event with times
            return `${startDateFormatted}, ${startTimeFormatted} – ${endTimeFormatted}`;
        } else {
            // Multi-day event with times
            return `${startDateFormatted}, ${startTimeFormatted} – ${endDateFormatted}, ${endTimeFormatted}`;
        }
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
        event.all_day
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
    dateText.textContent = formatEventDate(event.start_datetime, event.end_datetime, event.all_day);

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