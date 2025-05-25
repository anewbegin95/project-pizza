// === CONSTANTS ===

/**
 * Selector for the carousel container on the homepage.
 */
const CAROUSEL_CONTAINER_SELECTOR = '#eventsCarousel';

/**
 * Time (in milliseconds) between automatic carousel rotations.
 */
const CAROUSEL_ROTATION_INTERVAL = 5000; // 5 seconds

// === UTILITY FUNCTIONS ===

/**
 * Filters events to include only those that should appear in the carousel.
 * Both `master_display` and `carousel` fields must be TRUE.
 * @param {Array<Object>} events - Array of event objects.
 * @returns {Array<Object>} - Filtered array of events for the carousel.
 */
function filterCarouselEvents(events) {
    return events.filter(event =>
        String(event.master_display).toUpperCase() === 'TRUE' &&
        String(event.carousel).toUpperCase() === 'TRUE'
    );
}

/**
 * Creates a single carousel slide element for a featured event.
 * @param {Object} event - Event object containing event details.
 * @returns {HTMLElement} - The carousel slide element.
 */
function createCarouselSlide(event, dotBar) {
    const slide = document.createElement('div');
    slide.className = 'carousel-slide';

    const img = document.createElement('img');
    img.src = event.img || 'resources/images/images/default-event-image.jpeg';
    img.alt = `${event.name} image`;
    img.className = 'carousel-image';

    // Create overlay for event name and dots
    const overlay = document.createElement('div');
    overlay.className = 'carousel-event-overlay';

    const nameOverlay = document.createElement('div');
    nameOverlay.className = 'carousel-event-name';
    nameOverlay.textContent = event.name;

    overlay.appendChild(nameOverlay);
    overlay.appendChild(dotBar);

    slide.appendChild(img);
    slide.appendChild(overlay);

    slide.addEventListener('click', () => openEventModal(event));
    slide.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            openEventModal(event); // Handle Enter key for keyboard users
        }
    });

    return slide;
}

/**
 * Creates the dot navigation bar for the carousel.
 * @param {number} count - Number of dots (events).
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
        dot.setAttribute('aria-label', `Go to event ${i + 1}`);
        dot.type = 'button';
        if (i === activeIndex) dot.setAttribute('aria-current', 'true');
        dot.addEventListener('click', () => onDotClick(i));
        dotBar.appendChild(dot);
    }

    return dotBar;
}

// === CAROUSEL LOGIC ===

/**
 * Initializes the featured events carousel.
 * @param {Array<Object>} events - Array of all event objects.
 */
function initCarousel(events) {
    const featuredEvents = filterCarouselEvents(events);
    if (!featuredEvents.length) return;

    const container = document.querySelector(CAROUSEL_CONTAINER_SELECTOR);
    if (!container) return;

    let currentIndex = 0;
    let intervalId = null;

    /**
     * Renders the carousel with the current slide and dots.
     * @param {number} nextIndex - Index of the next slide.
     * @param {string} direction - Direction of the slide animation ('left' or 'right').
     */
    function renderCarousel(nextIndex = null, direction = 'right') {
        // Remove old slides after animation
        const oldSlide = container.querySelector('.carousel-slide');
        const dots = createCarouselDots(featuredEvents.length, nextIndex !== null ? nextIndex : currentIndex, goToSlide);
        const slide = createCarouselSlide(featuredEvents[nextIndex !== null ? nextIndex : currentIndex], dots);

        // Set up initial class for animation
        if (direction === 'right') {
            slide.classList.add('slide-in-right');
        } else {
            slide.classList.add('slide-in-left');
        }
        container.appendChild(slide);

        // Force reflow to trigger transition
        void slide.offsetWidth;

        // Animate slide in
        slide.classList.add('active');

        // Animate old slide out
        if (oldSlide) {
            if (direction === 'right') {
                oldSlide.classList.add('slide-out-left', 'exit');
            } else {
                oldSlide.classList.add('slide-out-right', 'exit');
            }
            oldSlide.addEventListener('transitionend', () => {
                if (oldSlide.parentNode) oldSlide.parentNode.removeChild(oldSlide);
            }, { once: true });
        }

        // Clean up classes after animation
        slide.addEventListener('transitionend', () => {
            slide.classList.remove('slide-in-right', 'slide-in-left', 'active');
        }, { once: true });
    }

    /**
     * Advances to the next slide.
     */
    function nextSlide() {
        const nextIndex = (currentIndex + 1) % featuredEvents.length;
        renderCarousel(nextIndex, 'right');
        currentIndex = nextIndex;
    }

    /**
     * Goes to a specific slide.
     * @param {number} index - Index of the slide to show.
     */
    function goToSlide(index) {
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
            // Open the modal for the currently displayed event
            openEventModal(featuredEvents[currentIndex]);
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
 * Loads events (reusing fetch/parse logic from events.js), then initializes the carousel.
 */
function loadAndInitCarousel() {
    fetch(GOOGLE_SHEET_CSV_URL)
        .then(response => response.text())
        .then(csvText => {
            const events = parseCSV(csvText);
            initCarousel(events);
        })
        .catch(error => {
            console.error('Error loading carousel events:', error);
        });
}

// === EVENT LISTENERS ===

document.addEventListener('DOMContentLoaded', () => {
    // Only run on the homepage
    if (document.querySelector(CAROUSEL_CONTAINER_SELECTOR)) {
        loadAndInitCarousel();
    }
});