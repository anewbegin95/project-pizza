// === CONSTANTS ===

/**
 * Selector for the carousel container on the homepage.
 */
const CAROUSEL_CONTAINER_SELECTOR = '#popupsCarousel';

/**
 * Time (in milliseconds) between automatic carousel rotations.
 */
const CAROUSEL_ROTATION_INTERVAL = 5000; // 5 seconds

// === UTILITY FUNCTIONS ===

/**
 * Filters pop-ups to include only those that should appear in the carousel.
 * Both `master_display` and `carousel` fields must be TRUE.
 * @param {Array<Object>} popups - Array of pop-up objects.
 * @returns {Array<Object>} - Filtered array of pop-ups for the carousel.
 */
function filterCarouselPopups(popups) {
    return popups.filter(popup =>
        String(popup.master_display).toUpperCase() === 'TRUE' &&
        String(popup.carousel).toUpperCase() === 'TRUE'
    );
}

/**
 * Creates a single carousel slide element for a featured pop-up.
 * @param {Object} popup - Pop-up object containing details.
 * @param {HTMLElement} dotBar - Dot navigation element.
 * @param {boolean} [isFirstSlide=false] - Whether this is the first (LCP candidate) slide. When true, lazy loading is skipped so the browser fetches the image eagerly.
 * @param {number} [index=0] - Index of this pop-up within the featured list.
 * @returns {HTMLElement} - The carousel slide element.
 */
function createCarouselSlide(popup, dotBar, isFirstSlide = false, index = 0) {
    const slide = document.createElement('div');
    slide.className = 'carousel-slide';
    slide.tabIndex = 0; // Make slide focusable for keyboard navigation
    // Read by resources/js/analytics-events.js (#399). The slide carries no
    // href, and only one slide is in the DOM at a time, so neither the id nor
    // the position can be recovered from the document without these.
    slide.setAttribute('data-analytics-id', popup.id);
    slide.setAttribute('data-analytics-position', String(index));

    const img = document.createElement('img');
    img.src = popup.img || 'resources/images/images/default-popup-image.webp';
    img.alt = `${popup.name} image`;
    img.className = 'carousel-image';
    if (!isFirstSlide) {
        img.loading = 'lazy';
    }

    // Create overlay for pop-up name and dots
    const overlay = document.createElement('div');
    overlay.className = 'carousel-popup-overlay';

    const nameOverlay = document.createElement('div');
    nameOverlay.className = 'carousel-popup-name';
    nameOverlay.textContent = popup.name;

    overlay.appendChild(nameOverlay);
    overlay.appendChild(dotBar);

    slide.appendChild(img);
    slide.appendChild(overlay);

    slide.addEventListener('click', () => {
        window.location.href = `pop-up.html?id=${popup.id}`;
    });
    slide.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            if (e.key === ' ') {
                e.preventDefault();
            }
            window.location.href = `pop-up.html?id=${popup.id}`;
        }
    });
    // Show visible focus for accessibility
    slide.addEventListener('focus', () => {
        slide.classList.add('carousel-slide-focus');
    });
    slide.addEventListener('blur', () => {
        slide.classList.remove('carousel-slide-focus');
    });

    return slide;
}

/**
 * Creates the dot navigation bar for the carousel.
 * @param {number} count - Number of dots (pop-ups).
 * @param {number} activeIndex - Index of the currently active slide.
 * @param {Function} onDotClick - Callback when a dot is clicked.
 * @returns {HTMLElement} - The dot navigation element.
 */
function createCarouselDots(count, activeIndex, onDotClick) {
    const dotBar = document.createElement('div');
    dotBar.className = 'carousel-dot-bar';

    for (let i = 0; i < count; i++) {
        const dot = document.createElement('button');
        dot.className = 'carousel-dot' + (i === activeIndex ? ' active' : '');
        // dot.tabIndex = 0; // Removed: buttons are focusable by default
        dot.setAttribute('aria-label', `Go to pop-up ${i + 1}`);
        dot.type = 'button';
        if (i === activeIndex) dot.setAttribute('aria-current', 'true');
        dot.addEventListener('click', (e) => {
            e.stopPropagation();
            onDotClick(i);
        });
        dotBar.appendChild(dot);
    }

    return dotBar;
}

/**
 * Points the carousel heading at the slide currently on screen, for
 * resources/js/analytics-events.js (#399). Attributes only — no event.
 * @param {Object} popup - The pop-up the title would open.
 * @param {number} index - Its index within the featured list.
 */
function markCarouselTitle(popup, index) {
    const title = document.querySelector('.carousel-title');
    if (!title || !popup) return;
    title.setAttribute('data-analytics-id', popup.id);
    title.setAttribute('data-analytics-position', String(index));
}

// === CAROUSEL LOGIC ===

/**
 * Initializes the featured pop-ups carousel.
 * @param {Array<Object>} popups - Array of all pop-up objects.
 */
function initCarousel(popups) {
    const featuredPopups = filterCarouselPopups(popups);
    if (!featuredPopups.length) return;

    const container = document.querySelector(CAROUSEL_CONTAINER_SELECTOR);
    if (!container) return;

    let currentIndex = 0;
    let intervalId = null;
    let hasRenderedOnce = false;

    /**
     * Handles slide-in animation for a new slide.
     */
    function animateSlideIn(slide, direction) {
        if (direction === 'right') {
            slide.classList.add('slide-in-right');
        } else {
            slide.classList.add('slide-in-left');
        }
        // Force reflow to trigger transition
        void slide.offsetWidth;
        slide.classList.add('active');
        slide.addEventListener('transitionend', () => {
            slide.classList.remove('slide-in-right', 'slide-in-left', 'active');
        }, { once: true });
    }

    /**
     * Handles slide-out animation for the old slide.
     */
    function animateSlideOut(oldSlide, direction) {
        if (!oldSlide) return;
        if (direction === 'right') {
            oldSlide.classList.add('slide-out-left', 'exit');
        } else {
            oldSlide.classList.add('slide-out-right', 'exit');
        }
        oldSlide.addEventListener('transitionend', () => {
            if (oldSlide.parentNode) oldSlide.parentNode.removeChild(oldSlide);
        }, { once: true });
    }

    /**
     * Renders the carousel with the current slide and dots.
     * @param {number} nextIndex - Index of the next slide.
     * @param {string} direction - Direction of the slide animation ('left' or 'right').
     */
    function renderCarousel(nextIndex = null, direction = 'right') {
        const oldSlide = container.querySelector('.carousel-slide');
        const index = nextIndex !== null ? nextIndex : currentIndex;
        const dots = createCarouselDots(featuredPopups.length, index, goToSlide);
        const slide = createCarouselSlide(featuredPopups[index], dots, !hasRenderedOnce, index);
        hasRenderedOnce = true;
        // The title navigates to whichever slide is showing, so it has to carry
        // the same pointers the slide does (#399). Setting them here rather
        // than in a listener keeps the render path free of analytics: nothing
        // is sent from here, and the 5s auto-advance stays silent.
        markCarouselTitle(featuredPopups[index], index);
        container.appendChild(slide);
        animateSlideIn(slide, direction);
        animateSlideOut(oldSlide, direction);
    }

    /**
     * Advances to the next slide.
     */
    function nextSlide() {
        const nextIndex = (currentIndex + 1) % featuredPopups.length;
        renderCarousel(nextIndex, 'right');
        currentIndex = nextIndex;
    }

    /**
     * Goes to a specific slide.
     * @param {number} index - Index of the slide to show.
     */
    function goToSlide(index) {
        if (index === currentIndex) return; // Don't animate if already on this slide
        const direction = index > currentIndex ? 'right' : 'left';
        renderCarousel(index, direction);
        currentIndex = index;
        resetInterval();
    }

    /**
     * Starts or resets the auto-rotation interval.
     */
    function resetInterval() {
        if (intervalId) clearInterval(intervalId);
        intervalId = setInterval(nextSlide, CAROUSEL_ROTATION_INTERVAL);
    }

    const title = document.querySelector('.carousel-title');
    if (title) {
        title.style.cursor = 'pointer';
        title.addEventListener('click', () => {
            // Navigate to the currently displayed pop-up details
            window.location.href = `pop-up.html?id=${featuredPopups[currentIndex].id}`;
        });
    }

    // Initial render and start rotation
    renderCarousel();
    resetInterval();

    // Optional: Pause on hover
    container.addEventListener('mouseenter', () => clearInterval(intervalId));
    container.addEventListener('mouseleave', resetInterval);
}

// === MAIN FUNCTIONALITY ===

/**
 * Loads pop-ups (reusing fetch/parse logic from pop-ups.js), then initializes the carousel.
 */
function loadAndInitCarousel() {
    sanityFetch(window.SANITY_QUERIES.POPUPS)
        .then(results => {
            const popups = typeof mapSanityPopup === 'function'
                ? results.map(mapSanityPopup)
                : results;
            initCarousel(popups);
        })
        .catch(error => {
            console.error('Error loading carousel pop-ups:', error);
            // Show user-facing error message
            const container = document.querySelector(CAROUSEL_CONTAINER_SELECTOR);
            if (container) {
                const errorDiv = document.createElement('div');
                errorDiv.className = 'carousel-error';
                errorDiv.textContent = 'Sorry, we couldn\'t load featured pop-ups. Please try again later.';
                container.innerHTML = '';
                container.appendChild(errorDiv);
            }
        });
}

// === EVENT LISTENERS ===

document.addEventListener('DOMContentLoaded', () => {
    // Only run on the homepage
    if (document.querySelector(CAROUSEL_CONTAINER_SELECTOR)) {
        loadAndInitCarousel();
    }
});