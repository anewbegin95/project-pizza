// Shared card system for the redesigned discovery pages. Provides the
// taxonomy tags, date-column formatting and price handling that both pop-up
// and date idea cards need. Page rendering and month grouping live with the
// pages themselves (#296). See REDESIGN.md section 6.4.

// Wrapped so its helpers never collide with the other classic scripts on the
// page, which all share one global lexical scope.
(function (global) {
    'use strict';

    // === CONSTANTS ===

    /** Pop-up categories, mirroring the Sanity enum. */
    const CATEGORY_LABELS = {
        food_drink: {emoji: '🍕', label: 'Food & Drink'},
        market: {emoji: '🛍️', label: 'Market'},
        art_culture: {emoji: '🎨', label: 'Art & Culture'},
        beauty: {emoji: '💄', label: 'Beauty'},
        fashion: {emoji: '👗', label: 'Fashion'},
        wellness: {emoji: '🧘', label: 'Wellness'},
        music: {emoji: '🎵', label: 'Music'},
        vintage_thrift: {emoji: '✨', label: 'Vintage & Thrift'},
    };

    /** Date idea vibes, which take the place of the date column. */
    const VIBE_LABELS = {
        romantic: {emoji: '🌹', label: 'Romantic'},
        adventurous: {emoji: '🧗', label: 'Adventurous'},
        chill: {emoji: '🌿', label: 'Chill'},
        foodie: {emoji: '🍴', label: 'Foodie'},
        cultural: {emoji: '🎭', label: 'Cultural'},
        free: {emoji: '✨', label: 'Free'},
    };

    /** Borough enum values as they should read on a card. */
    const BOROUGH_LABELS = {
        manhattan: 'Manhattan',
        brooklyn: 'Brooklyn',
        queens: 'Queens',
        bronx: 'Bronx',
        staten_island: 'Staten Island',
        citywide: 'Citywide',
    };

    const EASTERN_TIMEZONE = 'America/New_York';

    const EMPTY_DATE_PARTS = {dayName: '', dayNumber: '', monthYear: '', through: ''};

    // === PURE HELPERS ===

    /**
     * All-day events store a date-only string. `new Date('2026-07-25')` is
     * UTC midnight, which is the previous evening in Eastern time and would
     * render the card a day early, so those are anchored at noon UTC — the
     * same approach scripts/prebuild-events.js takes.
     */
    function parseDate(value) {
        if (!value) return null;
        const raw = String(value);
        const dateOnly = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        const date = dateOnly
            ? new Date(Date.UTC(+dateOnly[1], +dateOnly[2] - 1, +dateOnly[3], 12, 0, 0))
            : new Date(raw);
        return Number.isNaN(date.getTime()) ? null : date;
    }

    function formatEastern(date, options) {
        return new Intl.DateTimeFormat('en-US', {timeZone: EASTERN_TIMEZONE, ...options}).format(date);
    }

    function getEasternDayKey(date) {
        return formatEastern(date, {year: 'numeric', month: '2-digit', day: '2-digit'});
    }

    /**
     * Splits an event's dates into the parts the card's date column renders.
     * Date ideas have no dates, so a missing start yields empty parts rather than
     * a placeholder.
     */
    function formatCardDate(start, end) {
        const startDate = parseDate(start);
        if (!startDate) return {...EMPTY_DATE_PARTS};

        const endDate = parseDate(end);
        const spansDays = endDate && getEasternDayKey(endDate) !== getEasternDayKey(startDate);

        return {
            dayName: formatEastern(startDate, {weekday: 'short'}).toUpperCase(),
            dayNumber: formatEastern(startDate, {day: 'numeric'}),
            monthYear: formatEastern(startDate, {month: 'long', year: 'numeric'}),
            through: spansDays ? `through ${formatEastern(endDate, {month: 'short', day: 'numeric'})}` : '',
        };
    }

    /**
     * Whether a price label reads as free, so the badge can take the green
     * treatment. An empty price is not assumed to be free.
     */
    function isFreePrice(price) {
        return /\bfree\b/i.test(String(price == null ? '' : price));
    }

    function getTag(labels, value) {
        const entry = labels[value];
        return entry ? `${entry.emoji} ${entry.label}` : '';
    }

    /** e.g. "💄 Beauty" for the tag floated over the card image. */
    function getCategoryTag(category) {
        return getTag(CATEGORY_LABELS, category);
    }

    /** e.g. "🌹 Romantic" for the date idea card's leading column. */
    function getVibeTag(vibe) {
        return getTag(VIBE_LABELS, vibe);
    }

    /**
     * Joins neighborhood and borough for the card's location line, turning the
     * borough enum into its display name. An unmapped value is title-cased
     * rather than dropped, so content drift stays visible.
     */
    function getAreaLabel(neighborhood, borough) {
        const slug = String(borough || '');
        const boroughLabel =
            BOROUGH_LABELS[slug] ||
            slug
                .split('_')
                .filter(Boolean)
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ');
        return [neighborhood, boroughLabel].filter(Boolean).join(', ');
    }

    // === CARD CONSTRUCTION ===

    const DEFAULT_CARD_IMAGE = 'resources/images/images/default-popup-image.webp';

    function createElement(doc, tag, className, text) {
        const element = doc.createElement(tag);
        if (className) element.className = className;
        // Always textContent: card copy is author-supplied and must never be
        // interpreted as markup.
        if (text) element.textContent = text;
        return element;
    }

    /** Date column for pop-ups, or the vibe label that replaces it on date ideas. */
    function buildLeadColumn(doc, data, isDateIdea) {
        const column = createElement(doc, 'div', 'event-card__date');

        if (isDateIdea) {
            const vibe = getVibeTag(data.vibe);
            if (vibe) column.appendChild(createElement(doc, 'span', 'event-card__vibe', vibe));
        } else {
            const parts = formatCardDate(data.start_datetime, data.end_datetime);
            if (parts.dayName) {
                column.appendChild(createElement(doc, 'span', 'event-card__day-name', parts.dayName));
                column.appendChild(createElement(doc, 'span', 'event-card__day-number', parts.dayNumber));
                column.appendChild(createElement(doc, 'span', 'event-card__month', parts.monthYear));
                if (parts.through) {
                    column.appendChild(createElement(doc, 'span', 'event-card__through', parts.through));
                }
            }
        }

        if (data.price) {
            const freeModifier = isFreePrice(data.price) ? ' event-card__price--free' : '';
            column.appendChild(
                createElement(doc, 'span', `ui-pill event-card__price${freeModifier}`, data.price)
            );
        }

        return column;
    }

    function buildMediaColumn(doc, data, isDateIdea) {
        const media = createElement(doc, 'div', 'event-card__media');

        const image = createElement(doc, 'img', 'event-card__image');
        image.src = data.img || DEFAULT_CARD_IMAGE;
        // Decorative: the card's title sits in the same link, so alt text
        // here would just repeat it.
        image.alt = '';
        image.loading = 'lazy';
        media.appendChild(image);

        const tag = isDateIdea ? getVibeTag(data.vibe) : getCategoryTag(data.category);
        if (tag) media.appendChild(createElement(doc, 'span', 'event-card__tag', tag));

        return media;
    }

    function buildDetailsColumn(doc, data) {
        const details = createElement(doc, 'div', 'event-card__details');
        details.appendChild(createElement(doc, 'h3', 'event-card__title', data.name || ''));

        if (data.short_desc) {
            details.appendChild(createElement(doc, 'p', 'event-card__description', data.short_desc));
        }

        const area = getAreaLabel(data.neighborhood, data.borough);
        if (data.venue_name || area) {
            const meta = createElement(doc, 'p', 'event-card__meta');
            if (data.venue_name) {
                meta.appendChild(createElement(doc, 'span', 'event-card__venue', data.venue_name));
            }
            if (area) meta.appendChild(createElement(doc, 'span', 'event-card__area', area));
            details.appendChild(meta);
        }

        return details;
    }

    /**
     * Builds a card element for a pop-up or date idea. Page code owns fetching,
     * ordering and month grouping; this only renders one card.
     * @param {Object} data - mapped pop-up or date idea
     * @param {{type?: 'popup'|'date-idea', document?: Document}} [options]
     */
    function buildEventCard(data, options) {
        const settings = options || {};
        const doc = settings.document || (typeof document !== 'undefined' ? document : null);
        if (!doc) throw new Error('buildEventCard requires a document');

        const isDateIdea = settings.type === 'date-idea';
        const card = doc.createElement('a');
        card.className = `event-card${data.is_featured ? ' event-card--featured' : ''}`;
        card.href = `${isDateIdea ? 'date-idea' : 'pop-up'}.html?id=${encodeURIComponent(data.id || '')}`;

        card.appendChild(buildLeadColumn(doc, data, isDateIdea));
        card.appendChild(buildMediaColumn(doc, data, isDateIdea));
        card.appendChild(buildDetailsColumn(doc, data));

        return card;
    }

    const api = {
        CATEGORY_LABELS,
        VIBE_LABELS,
        formatCardDate,
        isFreePrice,
        getCategoryTag,
        getVibeTag,
        getAreaLabel,
        buildEventCard,
    };

    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (global) global.NycCards = api;
})(typeof window !== 'undefined' ? window : null);
