// === UTILITY FUNCTIONS ===
function getQueryParam(name) {
    const url = new URL(window.location.href);
    return url.searchParams.get(name);
}

const DATE_IDEAS_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRt3kyrvcTvanJ0p3Umxrlk36QZIDKS91n2pmzXaYaCv73mhLnhLeBf_ZpU87fZe0pu8J1Vz6mjI6uE/pub?gid=121089378&single=true&output=csv';

function parseCSV(csvText) {
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
            items.push(item);
            currentRow = [];
        }
    });
    items.forEach((item, idx) => {
        item.id = generateEventId(item, idx);
    });
    return items;
}

function generateEventId(item, index) {
    const base = (item.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return `${base}-${index}`;
}

function showError(message, ariaLabel = 'Error message') {
    let main = document.querySelector('main');
    if (!main) {
        main = document.createElement('main');
        document.body.appendChild(main);
    }
    main.innerHTML = `<section role="alert" aria-label="${ariaLabel}" tabindex="-1"><h2>${message.title}</h2><p>${message.body}</p></section>`;
    main.querySelector('section').focus();
}

function renderDateIdeaDetail(idea) {
    document.getElementById('dateIdeaTitle').textContent = idea.name;
    document.getElementById('dateIdeaLocation').textContent = idea.location || 'TBD';
    document.getElementById('dateIdeaDescription').innerHTML = (idea.long_desc || '').replace(/\n/g, '<br>');
    // Set both mobile and desktop images
    var imgMobile = document.getElementById('dateIdeaImageMobile');
    var imgDesktop = document.getElementById('dateIdeaImageDesktop');
    var imgSrc = idea.img || 'resources/images/images/default-event-image.jpeg';
    var imgAlt = `${idea.name} image`;
    if (imgMobile) {
        imgMobile.src = imgSrc;
        imgMobile.alt = imgAlt;
    }
    if (imgDesktop) {
        imgDesktop.src = imgSrc;
        imgDesktop.alt = imgAlt;
    }
    // External link (match event details behavior and styling)
    const extLink = document.getElementById('eventExternalLink');
    if (extLink) {
        const url = (idea.external_url || idea.link || '').trim();
        const label = idea.external_link_text || idea.link_text || 'Learn More';
        if (url) {
            extLink.href = url;
            extLink.target = '_blank';
            extLink.rel = 'noopener noreferrer';
            extLink.textContent = label;
            extLink.classList.remove('hidden');
        } else {
            extLink.href = '#';
            extLink.classList.add('hidden');
        }
    }
}

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
    const detailSection = document.querySelector('.event-detail');
    if (detailSection) {
        detailSection.classList.add('hidden');
        detailSection.style.display = 'none';
    }
    const ideaId = getQueryParam('id');
    if (!ideaId) {
        showError({ title: 'Date Idea not found', body: 'No date idea ID provided in the URL.' });
        return;
    }
    fetch(DATE_IDEAS_CSV_URL)
        .then(res => res.text())
        .then(csv => {
            const ideas = parseCSV(csv);
            const idea = ideas.find(i => i.id === ideaId);
            if (!idea) {
                showError({ title: 'Date Idea not found', body: 'No date idea matches this ID.' });
                return;
            }
            renderDateIdeaDetail(idea);
            if (detailSection) {
                detailSection.classList.remove('hidden');
                detailSection.style.display = '';
            }
        })
        .catch(err => {
            showError({ title: 'Error', body: 'Could not load date idea data.' });
            console.error(err);
        });
});
