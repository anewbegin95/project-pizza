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
    // Add return button handler
    const returnBtn = document.querySelector('.return-button');
    if (returnBtn) {
        returnBtn.addEventListener('click', (e) => {
            e.preventDefault();
            window.history.back();
        });
    }

    // Hide the hero section until data loads
    const heroSection = document.querySelector('.event-detail');
    if (heroSection) {
        heroSection.classList.add('hidden');
        heroSection.style.display = 'none';
    }

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
            // Assign event.id using the new generateEventId (event name only)
            events.forEach(event => {
                event.id = (event.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
            });
            const event = events.find(e => e.id === eventId);
            if (!event) {
                document.body.innerHTML = '<main><section><h2>Event not found</h2><p>No event matches this ID.</p></section></main>';
                return;
            }
            renderEventDetail(event);
            // Reveal the hero section after data loads
            if (heroSection) {
                heroSection.classList.remove('hidden');
                heroSection.style.display = '';
            }
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
    // Set both mobile and desktop images
    var imgMobile = document.getElementById('eventImage');
    var imgDesktop = document.getElementById('eventImageDesktop');
    var imgSrc = event.img || 'resources/images/images/default-event-image.jpeg';
    var imgAlt = `${event.name} image`;
    if (imgMobile) {
        imgMobile.src = imgSrc;
        imgMobile.alt = imgAlt;
    }
    if (imgDesktop) {
        imgDesktop.src = imgSrc;
        imgDesktop.alt = imgAlt;
    }

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
        // Remove any previous links if present
        const prevContainer = document.querySelector('.ics-links-container');
        if (prevContainer) prevContainer.remove();
        // --- Only show ICS link for desktop and iOS Safari ---
        const ua = navigator.userAgent;
        const isIOS = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
        const isSafari = isIOS && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|mercury|GSA|DuckDuckGo|YaBrowser|SamsungBrowser|UCBrowser|MiuiBrowser|Vivaldi|Brave|Puffin|Sleipnir|Dolfin|Coast|Aloha|Yandex|Maxthon|QQBrowser|Qiyu|Baidu|Sogou|Liebao|Quark|2345Explorer|WeChat|MicroMessenger|Instagram|FBAN|FBAV|Line\//i.test(ua);
        const isDesktop = !/Mobi|Android|iPhone|iPad|iPod|Mobile|Tablet|IEMobile|Opera Mini/i.test(ua);
        if (isMultiDayEvent(event)) {
            if (isDesktop || isSafari) {
                icsLink.style.display = 'none';
                // Create a container for multiple ICS links
                const startDate = new Date(event.start_datetime);
                const endDate = new Date(event.end_datetime);
                const numDays = Math.floor((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
                const icsLinksContainer = document.createElement('div');
                icsLinksContainer.className = 'ics-links-container';
                const startTime = event.start_datetime.split(' ')[1];
                const endTime = event.end_datetime.split(' ')[1];
                for (let i = 0; i < numDays; i++) {
                    const currentDay = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + i);
                    const dateLabel = currentDay.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
                    const link = document.createElement('a');
                    link.href = '#';
                    link.textContent = `Add ${dateLabel} to Calendar`;
                    link.className = 'modal-link';
                    link.style.display = 'block';
                    link.onclick = (e) => {
                        e.preventDefault();
                        downloadICS(event, currentDay, startTime, endTime);
                    };
                    icsLinksContainer.appendChild(link);
                }
                icsLink.parentNode.insertBefore(icsLinksContainer, icsLink.nextSibling);
            } else {
                icsLink.style.display = 'none';
            }
        } else {
            if (isDesktop || isSafari) {
                icsLink.style.display = '';
                icsLink.classList.remove('hidden');
                const icsContent = generateICS(event);
                if (isSafari) {
                    const dataUri = 'data:text/calendar;charset=utf-8,' + encodeURIComponent(icsContent);
                    icsLink.href = dataUri;
                    icsLink.removeAttribute('download');
                    icsLink.target = '_blank';
                    icsLink.onclick = null;
                } else {
                    const blob = new Blob([icsContent], { type: 'text/calendar' });
                    const blobUrl = URL.createObjectURL(blob);
                    icsLink.href = blobUrl;
                    icsLink.setAttribute('download', `${event.id || 'event'}.ics`);
                    icsLink.target = '_blank';
                    icsLink.onclick = null;
                }
            } else {
                icsLink.style.display = 'none';
            }
        }
    }
    // Add iOS/Chrome-on-iOS/in-app browser instruction if on iOS
    // (Removed: no instructions for non-Safari mobile browsers)
    // Helper to detect in-app browsers (Instagram, Facebook, etc.)
    function isInAppBrowser() {
        const ua = navigator.userAgent || navigator.vendor || window.opera;
        return (
            /Instagram|FBAN|FBAV|Line\//|Twitter|Snapchat|LinkedIn|Pinterest|Messenger|WhatsApp|TikTok/i.test(ua)
        );
    }
}