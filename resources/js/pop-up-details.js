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

function getPopupSlug(popup) {
    if (popup && popup.id) {
        return popup.id;
    }
    return (popup && popup.name ? popup.name : '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
}

const POPUP_BY_ID_QUERY = 'POPUP_BY_ID';

/**
 * Fetches pop-up details from Sanity and renders the pop-up detail page.
 * This script expects the URL to contain a query parameter `id` that matches a pop-up ID.
 * It retrieves the pop-up data, formats it, and displays it in a structured layout.
 * If the pop-up ID is not found or no ID is provided, it displays an error message.
 * @returns {void}
 * @throws {Error} If the pop-up data cannot be loaded or parsed.
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
    const heroSection = document.querySelector('.popup-detail');
    if (heroSection) {
        heroSection.classList.add('hidden');
        heroSection.style.display = 'none';
    }

    const popupId = getQueryParam('id');
    function showError(message, ariaLabel = 'Error message') {
        let main = document.querySelector('main');
        if (!main) {
            main = document.createElement('main');
            document.body.appendChild(main);
        }
        main.innerHTML = `<section role="alert" aria-label="${ariaLabel}" tabindex="-1"><h2>${message.title}</h2><p>${message.body}</p></section>`;
        main.querySelector('section').focus();
    }

    if (!popupId) {
        showError({ title: 'Pop-up not found', body: 'No pop-up ID provided in the URL.' });
        return;
    }

    sanityFetch(window.SANITY_QUERIES[POPUP_BY_ID_QUERY], { id: popupId })
        .then(result => {
            const popup = typeof mapSanityPopup === 'function' ? mapSanityPopup(result) : result;
            if (!popup || !popup.name) {
                showError({ title: 'Pop-up not found', body: 'No pop-up matches this ID.' });
                return;
            }
            renderPopupDetail(popup);
            // Reveal the hero section after data loads
            if (heroSection) {
                heroSection.classList.remove('hidden');
                heroSection.style.display = '';
            }
        })
        .catch(err => {
            showError({ title: 'Error', body: 'Could not load pop-up data.' });
            console.error(err);
        });
});

// === MAIN FUNCTIONALITY ===

/**
* Renders the pop-up detail page with the provided pop-up data.
* @param {Object} popup - The pop-up data object containing details like name, date, location, etc.
* @returns {void}
*/
function renderPopupDetail(popup) {
    document.getElementById('popupTitle').textContent = popup.name;
    document.getElementById('popupDateRange').textContent = formatEventDate(popup.start_datetime, popup.end_datetime, popup.all_day, popup.recurring);
    document.getElementById('popupLocation').textContent = popup.location || 'TBD';
    document.getElementById('popupDescription').innerHTML = (popup.long_desc || '').replace(/\n/g, '<br>');
    // Set both mobile and desktop images
    const imgMobile = document.getElementById('popupImage');
    const imgDesktop = document.getElementById('popupImageDesktop');
    const imgSrc = popup.img || 'resources/images/images/default-popup-image.jpeg';
    const imgAlt = `${popup.name} image`;
    if (imgMobile) {
        imgMobile.src = imgSrc;
        imgMobile.alt = imgAlt;
    }
    if (imgDesktop) {
        imgDesktop.src = imgSrc;
        imgDesktop.alt = imgAlt;
    }

    // External link
    const extLink = document.getElementById('popupExternalLink');
    if (popup.link && popup.link.trim() !== '') {
        extLink.href = popup.link;
        extLink.textContent = popup.link_text || 'Learn More';
        extLink.classList.remove('hidden');
    } else {
        extLink.href = '#';
        extLink.classList.add('hidden');
    }

    // ICS link
    const icsLink = document.getElementById('popupICSLink');
    if (icsLink) {
        // Remove any previous links if present
        const prevContainer = document.querySelector('.ics-links-container');
        if (prevContainer) prevContainer.remove();
        handleICSLinks(popup, icsLink);
    }
    // ...existing code...

/**
 * Handles ICS link rendering and accessibility for pop-up details.
 * @param {Object} popup - The pop-up data object.
 * @param {HTMLElement} icsLink - The ICS link element.
 */
function handleICSLinks(popup, icsLink) {
    // --- Only show ICS link for desktop and iOS Safari ---
    const ua = navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
    const isSafari = isIOS && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|mercury|GSA|DuckDuckGo|YaBrowser|SamsungBrowser|UCBrowser|MiuiBrowser|Vivaldi|Brave|Puffin|Sleipnir|Dolfin|Coast|Aloha|Yandex|Maxthon|QQBrowser|Qiyu|Baidu|Sogou|Liebao|Quark|2345Explorer|WeChat|MicroMessenger|Instagram|FBAN|FBAV|Line\//i.test(ua);
    const isDesktop = !/Mobi|Android|iPhone|iPad|iPod|Mobile|Tablet|IEMobile|Opera Mini/i.test(ua);
    if (isMultiDayEvent(popup)) {
        if (isDesktop || isSafari) {
            icsLink.style.display = 'none';
            // Create a container for multiple ICS links
            const startDate = new Date(popup.start_datetime);
            const endDate = new Date(popup.end_datetime);
            const numDays = Math.floor((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
            const icsLinksContainer = document.createElement('div');
            icsLinksContainer.className = 'ics-links-container';
            icsLinksContainer.setAttribute('role', 'group');
            icsLinksContainer.setAttribute('aria-label', 'Add pop-up days to calendar');
            const startTime = popup.start_datetime.split(' ')[1];
            const endTime = popup.end_datetime.split(' ')[1];
            for (let i = 0; i < numDays; i++) {
                const currentDay = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + i);
                const dateLabel = currentDay.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
                const link = document.createElement('a');
                link.href = '#';
                link.textContent = `Add ${dateLabel} to Calendar`;
                link.className = 'modal-link';
                link.style.display = 'block';
                link.setAttribute('role', 'button');
                link.setAttribute('aria-label', `Add ${dateLabel} to calendar`);
                link.onclick = (e) => {
                    e.preventDefault();
                    downloadICS(popup, currentDay, startTime, endTime);
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
            icsLink.setAttribute('role', 'link');
            icsLink.setAttribute('aria-label', 'Add pop-up to calendar');
            const icsContent = generateICS(popup);
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
                icsLink.setAttribute('download', `${popup.id || 'popup'}.ics`);
                icsLink.target = '_blank';
                icsLink.onclick = null;
            }
        } else {
            icsLink.style.display = 'none';
        }
    }

    // Inject Event JSON-LD for this pop-up detail
    try {
        const origin = window.location.origin;
        const popupSlug = popup.id || getPopupSlug(popup) || 'popup';
        const eventJsonLd = {
            '@context': 'https://schema.org',
            '@type': 'Event',
            name: popup.name,
            eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
            eventStatus: 'https://schema.org/EventScheduled',
            url: origin + '/pop-up.html?id=' + popupSlug
        };

        if (popup.long_desc) {
            eventJsonLd.description = popup.long_desc;
        }
        if (popup.start_datetime) {
            eventJsonLd.startDate = popup.start_datetime;
        }
        if (popup.end_datetime) {
            eventJsonLd.endDate = popup.end_datetime;
        }
        if (popup.img) {
            eventJsonLd.image = popup.img;
        }
        if (popup.location) {
            eventJsonLd.location = { '@type': 'Place', name: popup.location };
        }
        const script = document.createElement('script');
        script.type = 'application/ld+json';
        script.textContent = JSON.stringify(eventJsonLd);
        document.head.appendChild(script);
    } catch (e) {
        console.warn('Event JSON-LD injection failed:', e);
    }

    // Override OG image with the pop-up image for better previews
    try {
        const origin = window.location.origin;
        let imgUrl = popup.img || '';
        if (imgUrl && !/^https?:\/\//.test(imgUrl)) {
            // Convert relative path to absolute URL
            imgUrl = origin + '/' + imgUrl.replace(/^\//,'');
        }
        if (imgUrl) {
            let ogImg = document.querySelector('meta[property="og:image"]');
            if (!ogImg) {
                ogImg = document.createElement('meta');
                ogImg.setAttribute('property', 'og:image');
                document.head.appendChild(ogImg);
            }
            ogImg.setAttribute('content', imgUrl);
        }
    } catch (e) {
        console.warn('OG image override failed:', e);
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