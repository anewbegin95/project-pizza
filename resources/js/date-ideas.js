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
    const headers = rows[0].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(h => h.trim());
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

    items.forEach((item, idx) => {
        item.id = generateEventId(item, idx);
    });

    return items;
}

/**
 * Generates a unique event ID (slug) from event name and row index.
 * Example output: "pizza-pop-up-3"
 * @param {Object} item - Item object containing name.
 * @param {number} index - Row index to ensure uniqueness.
 * @returns {string} - Unique event ID.
 */
function generateEventId(item, index) {
    // Use item name, lowercased and slugified, plus index for uniqueness
    const base = (item.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return `${base}-${index}`;
}

// Fetch date ideas
// === UI RENDERING FUNCTIONS ===
function createDateIdeaTile(idea) {
    if (String(idea.master_display).toUpperCase() !== 'TRUE') return null;

    const tile = document.createElement('div');
    tile.className = 'event-tile event-tile--horizontal';
    tile.tabIndex = 0;
    tile.setAttribute('role', 'button');
    tile.setAttribute('aria-label', idea.name);

    // Image
    const imgContainer = document.createElement('div');
    imgContainer.className = 'event-tile__img-container';
    const img = document.createElement('img');
    img.src = idea.img || 'resources/images/images/default-event-image.jpeg';
    img.alt = `${idea.name} image`;
    img.className = 'event-tile__img';
    imgContainer.appendChild(img);

    // Details
    const details = document.createElement('div');
    details.className = 'event-tile__details';
    const title = document.createElement('h3');
    title.textContent = idea.name;
    const location = document.createElement('p');
    location.className = 'event-tile__location';
    location.textContent = idea.location || '';
    const desc = document.createElement('p');
    desc.className = 'event-tile__text';
    desc.textContent = idea.short_desc || '';

    details.appendChild(title);
    details.appendChild(location);
    details.appendChild(desc);

    tile.appendChild(imgContainer);
    tile.appendChild(details);

    // Link to detail page
    tile.addEventListener('click', () => {
        window.location.href = `date-idea.html?id=${idea.id}`;
    });
    tile.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            window.location.href = `date-idea.html?id=${idea.id}`;
        }
    });

    return tile;
}

function openDateIdeaModal(idea) {
    let modal = document.getElementById('dateIdeaModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'dateIdeaModal';
        modal.className = 'modal event-detail-modal';
        modal.innerHTML = `
            <div class="event-detail-backdrop"></div>
            <section class="event-detail" style="display:block;">
                <div class="event-detail__content">
                    <button class="return-button">← Return to all date ideas</button>
                    <h1 id="modalTitle" class="mt-sm"></h1>
                    <div class="event-detail__image event-detail__image--mobile">
                        <img id="modalImageMobile" src="" alt="Date Idea Image" class="event-tile__img">
                    </div>
                    <p id="modalLocation" class="event-detail__location"></p>
                    <div class="event-detail__description">
                        <p id="modalDescription"></p>
                    </div>
                    <a id="modalExternalLink" href="#" target="_blank" class="modal-button hidden">Learn More</a>
                </div>
                <div class="event-detail__image event-detail__image--desktop">
                    <img id="modalImageDesktop" src="" alt="Date Idea Image" class="event-tile__img">
                </div>
            </section>
        `;
        document.body.appendChild(modal);
    }
    // Populate modal
    document.getElementById('modalTitle').textContent = idea.name;
    document.getElementById('modalLocation').textContent = idea.location || '';
    document.getElementById('modalDescription').innerHTML = (idea.long_desc || idea.short_desc || '').replace(/\n/g, '<br>');
    // Images
    document.getElementById('modalImageMobile').src = idea.img || 'resources/images/images/default-event-image.jpeg';
    document.getElementById('modalImageMobile').alt = `${idea.name} image`;
    document.getElementById('modalImageDesktop').src = idea.img || 'resources/images/images/default-event-image.jpeg';
    document.getElementById('modalImageDesktop').alt = `${idea.name} image`;
    // External link
    const extLink = document.getElementById('modalExternalLink');
    if (idea.link && idea.link.trim() !== '') {
        extLink.href = idea.link;
        extLink.textContent = idea.link_text || 'Learn More';
        extLink.classList.remove('hidden');
    } else {
        extLink.href = '#';
        extLink.classList.add('hidden');
    }
    // Show modal
    modal.style.display = 'block';
    // Return button closes modal
    modal.querySelector('.return-button').onclick = () => {
        modal.style.display = 'none';
    };
    // ESC key closes modal
    modal.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') modal.style.display = 'none';
    });
    modal.focus();
}

// === MAIN FUNCTIONALITY ===
document.addEventListener('DOMContentLoaded', () => {
    fetch(DATE_IDEAS_CSV_URL)
        .then(res => res.text())
        .then(csv => {
            const dateIdeas = parseCSV(csv, "date-idea");
            const grid = document.getElementById('dateIdeasGrid');
            if (!grid) return;
            grid.innerHTML = '';
            dateIdeas.forEach(idea => {
                const tile = createDateIdeaTile(idea);
                if (tile) grid.appendChild(tile);
            });
        })
        .catch(error => {
            console.error('Failed to fetch date ideas:', error);
        });
});