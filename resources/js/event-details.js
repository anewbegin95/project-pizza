// === UTILITY FUNCTIONS ===

/**
 * Get query parameter by name
 * @param {string} name - The name of the query parameter to retrieve.
 * @returns {string|null} - The value of the query parameter, or null if not found.
 */
function getQueryParam(name) {
    const url = new URL(window.location.href);
    return url.searchParams.get(name);
}

/**
 * Fetches event details from a Google Sheet CSV and renders the event detail page.
 * This script expects the URL to contain a query parameter `id` that matches an event ID.
 * It retrieves the event data, formats it, and displays it in a structured layout.
 * If the event ID is not found or no ID is provided, it displays an error message.
 * @returns {void}
 * @throws {Error} If the event data cannot be loaded or parsed.
 */
document.addEventListener('DOMContentLoaded', () => {
    const eventId = getQueryParam('id');
    if (!eventId) {
        document.body.innerHTML = '<main><section><h2>Event not found</h2><p>No event ID provided in the URL.</p></section></main>';
        return;
    }

    // Use the same CSV URL and parseCSV as in events.js
    fetch(GOOGLE_SHEET_CSV_URL)
        .then(res => res.text())
        .then(csv => {
            const events = parseCSV(csv);
            const event = events.find(e => e.id === eventId);
            if (!event) {
                document.body.innerHTML = '<main><section><h2>Event not found</h2><p>No event matches this ID.</p></section></main>';
                return;
            }
            renderEventDetail(event);
        })
        .catch(err => {
            document.body.innerHTML = '<main><section><h2>Error</h2><p>Could not load event data.</p></section></main>';
            console.error(err);
        });
});

// === MAIN FUNCTIONALITY ===

/**
* Renders the event detail page with the provided event data.
* @param {Object} event - The event data object containing details like name, date, location, etc.
* @returns {void}
*/
function renderEventDetail(event) {
    document.getElementById('eventTitle').textContent = event.name;
    document.getElementById('eventDateRange').textContent = formatEventDate(event.start_datetime, event.end_datetime, event.all_day, event.recurring);
    document.getElementById('eventLocation').textContent = event.location || 'TBD';
    document.getElementById('eventDescription').innerHTML = (event.long_desc || '').replace(/\n/g, '<br>');
    const img = document.getElementById('eventImage');
    img.src = event.img || 'resources/images/images/default-event-image.jpeg';
    img.alt = `${event.name} image`;

    // External link
    const extLink = document.getElementById('eventExternalLink');
    if (event.link && event.link.trim() !== '') {
        extLink.href = event.link;
        extLink.textContent = event.link_text || 'Learn More';
        extLink.classList.remove('hidden');
    } else {
        extLink.href = '#';
        extLink.classList.add('hidden');
    }

    // ICS link
    const icsLink = document.getElementById('eventICSLink');
    if (icsLink) {
        icsLink.classList.remove('hidden');
        icsLink.onclick = (e) => {
            e.preventDefault();
            downloadICS(event);
        };
    }
}