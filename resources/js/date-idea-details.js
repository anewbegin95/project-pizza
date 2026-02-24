// === UTILITY FUNCTIONS ===
function getQueryParam(name) {
    const url = new URL(window.location.href);
    return url.searchParams.get(name);
}

const DATE_IDEA_BY_ID_QUERY = 'DATE_IDEA_BY_ID';

function mapSanityDateIdea(item) {
    if (!item) return null;
    return {
        id: item.slug || item._id || '',
        name: item.name || '',
        location: item.location || '',
        link: item.link || '',
        link_text: item.link_text || '',
        short_desc: item.short_description || '',
        long_desc: item.long_description || '',
        img: item.imageUrl || '',
    };
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
    document.getElementById('dateIdeaDescription').innerHTML = (idea.long_desc || idea.short_desc || '').replace(/\n/g, '<br>');
    // Set both mobile and desktop images
    var imgMobile = document.getElementById('dateIdeaImageMobile');
    var imgDesktop = document.getElementById('dateIdeaImageDesktop');
    var imgSrc = idea.img || 'resources/images/images/default-popup-image.jpeg';
    var imgAlt = `${idea.name} image`;
    if (imgMobile) {
        imgMobile.src = imgSrc;
        imgMobile.alt = imgAlt;
    }
    if (imgDesktop) {
        imgDesktop.src = imgSrc;
        imgDesktop.alt = imgAlt;
    }
    // External link (match pop-up details behavior and styling)
    const extLink = document.getElementById('popupExternalLink');
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
    const detailSection = document.querySelector('.popup-detail');
    if (detailSection) {
        detailSection.classList.add('hidden');
        detailSection.style.display = 'none';
    }
    const ideaId = getQueryParam('id');
    if (!ideaId) {
        showError({ title: 'Date Idea not found', body: 'No date idea ID provided in the URL.' });
        return;
    }
    sanityFetch(window.SANITY_QUERIES[DATE_IDEA_BY_ID_QUERY], { id: ideaId })
        .then(result => {
            const idea = mapSanityDateIdea(result);
            if (!idea || !idea.name) {
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
