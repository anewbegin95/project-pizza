// events.js

// === CONSTANTS ===

// CSV URL of your published Google Sheet (ensure the sheet is public!)
const GOOGLE_SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRt3kyrvcTvanJ0p3Umxrlk36QZIDKS91n2pmzXaYaCv73mhLnhLeBf_ZpU87fZe0pu8J1Vz6mjI6uE/pub?gid=0&single=true&output=csv';

// === FUNCTIONS ===

// === MODAL FUNCTIONALITY ===

// Updated formatEventDate to handle all desired behaviors
/*
 * formatEventDate Scenarios:
 * 1. Ongoing Events
 *    - Example: "Ongoing"
 * 
 * 2. Ongoing Events (With Start Date)
 *    - Example: "Starting Sun, May 11, ongoing"
 * 
 * 3. Exact Start & End Datetime (One Day)
 *    - Example: "Sun, May 11, 10:00 AM – 5:00 PM"
 * 
 * 4. Exact Start & End Datetime (Over Many Days)
 *    - Example: "Sun, May 11, 2:00 PM – Tues, May 13, 5:00 PM"
 * 
 * 5. Exact Day but Not Time (One Day)
 *    - Example: "Sun, May 11"
 * 
 * 6. Exact Start & End Day but No Time (Over Many Days)
 *    - Example: "Sun, May 11 – Tue, May 13"
 * 
 * 7. Single day, all day
 *    - Example: "Sun, May 11 (all day)"
 * 
 * 8. Multi-day, all day
 *    - Example: "Sun, May 11 – Tue, May 13 (all day)"
 * 
 * 9. Recurring Events (Specific Days or Times)
 *    - Example: "Next on "Fri, May 16, 5:30 – 8:30 PM"
 * 
 * 10. Drop-In Events (Exact Start Time but No End Time)
 *    - Example: "Sun, May 11, starting at 2:00 PM"
 * 
 * 11. Closing Events (Exact End Time but No Start Time)
 *    - Example: "Sun, May 11, ending at 5:00 PM"
 * 
 * 12. Events with No Specific Date or Time (TBD):
 *    - Example: "Date and time to be announced"
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

// Function to open the modal and populate it with event details
function openEventModal(event) {
    // Prevent modal access if display is FALSE
    if (event.display === 'FALSE') {
        return;
    }

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
    document.getElementById('modalDescription').innerHTML = event.long_desc.replace(/\n/g, '<br>') || 'No description available.'; // Replace line breaks with <br>

    // Handle the modal button
    const modalLink = document.getElementById('modalLink');
    if (event.link && event.link.trim() !== '') {
        modalLink.href = event.link;
        modalLink.textContent = event.link_text || 'Learn More'; // Default text if link_text is missing
        modalLink.classList.remove('hidden'); // Show the button
    } else {
        modalLink.href = '#'; // Reset the href to avoid invalid links
        modalLink.classList.add('hidden'); // Hide the button
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
    // Skip creating the tile if display is FALSE
    if (event.display === 'FALSE') {
        return null;
    }

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
    const rows = csvText.trim().split('\n'); // Split the CSV into rows

    // Split the first line for headers
    const headers = rows[0].split(',').map(h => h.trim());

    const events = [];
    let currentRow = []; // Temporary storage for multi-line rows

    rows.slice(1).forEach(row => {
        currentRow.push(row); // Add the current row to the temporary storage

        // Check if the quotes are balanced in the combined row
        const combinedRow = currentRow.join('\n'); // Combine all rows in the current group
        const quoteCount = (combinedRow.match(/"/g) || []).length;

        if (quoteCount % 2 === 0) {
            // If quotes are balanced, process the combined row
            const values = combinedRow.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(v => v.trim()); // Handle commas inside quotes

            // Zip headers and values together into an object
            const event = {};
            headers.forEach((header, i) => {
                // Remove any number of surrounding quotes and preserve line breaks
                event[header] = values[i]?.replace(/^"+|"+$/g, '') || ''; // Remove one or more surrounding quotes
            });

            // Ensure recurring field is always defined
            event['recurring'] = event['recurring'] || 'FALSE';
            event['display'] = event['display'] || 'TRUE'; // Default to TRUE if not provided
            event['link'] = event['link'] || ''; // Default to an empty string if not provided

            console.log('Parsed Events:', events); // Debugging log to inspect parsed events

            events.push(event);
            currentRow = []; // Reset for the next row
        }
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
                if (tile) {
                    grid.appendChild(tile); // Only append if tile is not null
                }
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