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
 * @returns {HTMLElement} - The carousel slide element.
 */
function createCarouselSlide(popup, dotBar) {
    const slide = document.createElement('div');
    slide.className = 'carousel-slide';
    slide.tabIndex = 0; // Make slide focusable for keyboard navigation

    const img = document.createElement('img');
    img.src = popup.img || 'resources/images/images/default-popup-image.jpeg';
    img.alt = `${popup.name} image`;
    img.className = 'carousel-image';

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
        const dots = createCarouselDots(featuredPopups.length, nextIndex !== null ? nextIndex : currentIndex, goToSlide);
        const slide = createCarouselSlide(featuredPopups[nextIndex !== null ? nextIndex : currentIndex], dots);
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
    fetch(GOOGLE_SHEET_CSV_URL)
        .then(response => response.text())
        .then(csvText => {
            const popups = parseCSV(csvText);
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