// === CONSTANTS ===

/**
 * Sanity GROQ query key for date ideas.
 */
const DATE_IDEAS_QUERY = 'DATE_IDEAS';

// === UTILITY FUNCTIONS ===

/**
 * Generates a unique date idea ID (slug) from date idea name and row index.
 * Example output: "pizza-pop-up-3"
 * @param {Object} item - Item object containing name.
 * @param {number} index - Row index to ensure uniqueness.
 * @returns {string} - Unique date idea ID.
 */
function generateEventId(item, index) {
    // Use item name, lowercased and slugified, plus index for uniqueness
    const base = (item.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return `${base}-${index}`;
}

function mapSanityDateIdea(item, index) {
    return {
        id: item.slug || item._id || generateEventId(item, index),
        name: item.name || '',
        location: item.location || '',
        link: item.link || '',
        link_text: item.link_text || '',
        short_desc: item.short_description || '',
        long_desc: item.long_description || '',
        img: item.imageUrl || '',
        master_display: item.display_overall ? 'TRUE' : 'FALSE',
        type: 'date-idea',
    };
}

// Fetch date ideas
// === UI RENDERING FUNCTIONS ===
function createDateIdeaTile(idea) {
    if (String(idea.master_display).toUpperCase() !== 'TRUE') return null;

    const tile = document.createElement('div');
    tile.className = 'popup-tile popup-tile--horizontal';
    tile.tabIndex = 0;
    tile.setAttribute('role', 'button');
    tile.setAttribute('aria-label', idea.name);

    // Image
    const imgContainer = document.createElement('div');
    imgContainer.className = 'popup-tile__img-container';
    const img = document.createElement('img');
    img.src = idea.img || 'resources/images/images/default-popup-image.jpeg';
    img.alt = `${idea.name} image`;
    img.className = 'popup-tile__img';
    imgContainer.appendChild(img);

    // Details
    const details = document.createElement('div');
    details.className = 'popup-tile__details';
    const title = document.createElement('h3');
    title.textContent = idea.name;
    const location = document.createElement('p');
    location.className = 'popup-tile__location';
    location.textContent = idea.location || '';
    const desc = document.createElement('p');
    desc.className = 'popup-tile__text';
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
        modal.className = 'modal popup-detail-modal';
        modal.innerHTML = `
            <div class="popup-detail-backdrop"></div>
            <section class="popup-detail" style="display:block;">
                <div class="popup-detail__content">
                    <button class="return-button">← Return to all date ideas</button>
                    <h1 id="modalTitle" class="mt-sm"></h1>
                    <div class="popup-detail__image popup-detail__image--mobile">
                        <img id="modalImageMobile" src="" alt="Date Idea Image" class="popup-tile__img">
                    </div>
                    <p id="modalLocation" class="popup-detail__location"></p>
                    <div class="popup-detail__description">
                        <p id="modalDescription"></p>
                    </div>
                    <a id="modalExternalLink" href="#" target="_blank" class="modal-button hidden">Learn More</a>
                </div>
                <div class="popup-detail__image popup-detail__image--desktop">
                    <img id="modalImageDesktop" src="" alt="Date Idea Image" class="popup-tile__img">
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
    document.getElementById('modalImageMobile').src = idea.img || 'resources/images/images/default-popup-image.jpeg';
    document.getElementById('modalImageMobile').alt = `${idea.name} image`;
    document.getElementById('modalImageDesktop').src = idea.img || 'resources/images/images/default-popup-image.jpeg';
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
    sanityFetch(window.SANITY_QUERIES[DATE_IDEAS_QUERY])
        .then(results => {
            const dateIdeas = results.map((item, index) => mapSanityDateIdea(item, index));
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