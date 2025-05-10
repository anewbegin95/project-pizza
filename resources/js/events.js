// events.js

// === CONSTANTS ===

// CSV URL of your published Google Sheet (ensure the sheet is public!)
const GOOGLE_SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRt3kyrvcTvanJ0p3Umxrlk36QZIDKS91n2pmzXaYaCv73mhLnhLeBf_ZpU87fZe0pu8J1Vz6mjI6uE/pub?gid=0&single=true&output=csv';

// === FUNCTIONS ===

// === MODAL FUNCTIONALITY ===

// Function to open the modal and populate it with event details
function openEventModal(event) {
    const modal = document.getElementById('eventModal');

    // Populate modal content
    document.getElementById('modalTitle').textContent = event.name;
    document.getElementById('modalImage').src = event.img || 'resources/images/images/default-event-image.jpeg';
    document.getElementById('modalImage').alt = `${event.name} image`;
    document.getElementById('modalDateRange').textContent = `${event.start_datetime} – ${event.end_datetime}`;
    document.getElementById('modalLocation').textContent = `${event.location || 'TBD'}`;
    document.getElementById('modalDescription').textContent = event.long_desc || 'No description available.';

    // Show the modal
    modal.classList.remove('hidden');
}

// Function to close the modal
function closeEventModal() {
    const modal = document.getElementById('eventModal');
    modal.classList.add('hidden');
}

// Add event listener to close button
const closeButton = document.querySelector('.close-button');
if (closeButton) {
    closeButton.addEventListener('click', closeEventModal);
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
    dateText.textContent = `${event.start_datetime} – ${event.end_datetime}`;

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
    loadAndDisplayEvents();
});
