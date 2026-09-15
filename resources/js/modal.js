// Shared detail modal for the redesigned discovery pages: overlay, return
// bar, split desktop / stacked mobile layout, share and add-to-calendar
// regions. See REDESIGN.md section 6.5. Page-by-page wiring lives with the
// pages (#297).
//
// Wrapped so its helpers never collide with the other classic scripts on the
// page, which all share one global lexical scope.
(function (global) {
    'use strict';

    const EASTERN_TIMEZONE = 'America/New_York';

    const DETAIL_PAGES = {
        popup: 'pop-up.html',
        'date-idea': 'date-idea.html',
    };

    /**
     * REDESIGN.md 6.5 says "Share Event", written for the Pop-Ups modal. A date
     * idea is not an event, and 6.5 already sanctions a page-appropriate label
     * for the return bar; this is the same move on the share button.
     */
    const SHARE_LABELS = {
        popup: 'Share Event',
        'date-idea': 'Share Date Idea',
    };

    function getShareLabel(type) {
        return SHARE_LABELS[type] || SHARE_LABELS.popup;
    }

    const FOCUSABLE = [
        'a[href]',
        'button:not([disabled])',
        'input:not([disabled])',
        'select:not([disabled])',
        'textarea:not([disabled])',
        '[tabindex]:not([tabindex="-1"])',
    ].join(', ');

    // === PURE HELPERS ===

    function isDateOnly(value) {
        return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));
    }

    /** Date-only values are anchored at noon UTC so the day never shifts. */
    function parseDate(value) {
        if (!value) return null;
        const raw = String(value);
        const parts = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        const date = parts
            ? new Date(Date.UTC(+parts[1], +parts[2] - 1, +parts[3], 12, 0, 0))
            : new Date(raw);
        return Number.isNaN(date.getTime()) ? null : date;
    }

    function pad(value) {
        return String(value).padStart(2, '0');
    }

    /** Google's basic UTC stamp, e.g. 20260723T150000Z. */
    function toCalendarStamp(date) {
        return (
            `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}` +
            `T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`
        );
    }

    function toCalendarDay(date) {
        return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}`;
    }

    function addDays(date, days) {
        return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
    }

    /**
     * Builds an "add to Google Calendar" template link. All-day events use
     * Google's date form with an exclusive end date; timed events without an
     * end get a one-hour block. Returns '' when there is no date at all.
     */
    function buildGoogleCalendarUrl(data) {
        const start = parseDate(data.start_datetime);
        if (!start) return '';

        const allDay = isDateOnly(data.start_datetime);
        const end = parseDate(data.end_datetime);
        let dates;

        if (allDay) {
            const lastDay = end || start;
            dates = `${toCalendarDay(start)}/${toCalendarDay(addDays(lastDay, 1))}`;
        } else {
            const finish = end || new Date(start.getTime() + 60 * 60 * 1000);
            dates = `${toCalendarStamp(start)}/${toCalendarStamp(finish)}`;
        }

        const location = [data.venue_name, data.address].filter(Boolean).join(', ');
        const url = new URL('https://calendar.google.com/calendar/render');
        url.searchParams.set('action', 'TEMPLATE');
        url.searchParams.set('text', data.name || '');
        url.searchParams.set('dates', dates);
        if (location) url.searchParams.set('location', location);
        if (data.short_desc) url.searchParams.set('details', data.short_desc);
        return url.toString();
    }

    /** Payload for the Web Share API, or for a copied link fallback. */
    function getShareData(data, options) {
        const settings = options || {};
        const page = DETAIL_PAGES[settings.type] || DETAIL_PAGES.popup;
        const origin = settings.origin || '';
        return {
            title: data.name || '',
            text: data.short_desc || '',
            url: `${origin}/${page}?id=${encodeURIComponent(data.id || '')}`,
        };
    }

    function formatEastern(date, options) {
        return new Intl.DateTimeFormat('en-US', {timeZone: EASTERN_TIMEZONE, ...options}).format(date);
    }

    function sameEasternDay(a, b) {
        const key = date => formatEastern(date, {year: 'numeric', month: '2-digit', day: '2-digit'});
        return key(a) === key(b);
    }

    /** Human date line for the modal's header block. */
    function formatDetailDateTime(start, end) {
        const startDate = parseDate(start);
        if (!startDate) return '';

        const endDate = parseDate(end);
        const longDate = formatEastern(startDate, {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            year: 'numeric',
        });

        if (!endDate) return longDate;

        if (!sameEasternDay(startDate, endDate)) {
            const from = formatEastern(startDate, {month: 'long', day: 'numeric'});
            const to = formatEastern(endDate, {month: 'long', day: 'numeric', year: 'numeric'});
            return `${from} – ${to}`;
        }

        if (isDateOnly(start)) return longDate;

        const time = date => formatEastern(date, {hour: 'numeric', minute: '2-digit'});
        return `${longDate} · ${time(startDate)} – ${time(endDate)}`;
    }

    // === DOM ===

    let modalCounter = 0;

    function el(doc, tag, className, text) {
        const node = doc.createElement(tag);
        if (className) node.className = className;
        // Always textContent: detail copy is author-supplied.
        if (text) node.textContent = text;
        return node;
    }

    function getTag(data, type) {
        const cards = global && global.NycCards;
        if (!cards) return '';
        return type === 'date-idea' ? cards.getVibeTag(data.vibe) : cards.getCategoryTag(data.category);
    }

    function getArea(data) {
        const cards = global && global.NycCards;
        return cards ? cards.getAreaLabel(data.neighborhood, data.borough) : '';
    }

    function buildBody(doc, data, type, calendarUrl) {
        const body = el(doc, 'div', 'modal-detail__body');

        const tags = el(doc, 'div', 'modal-detail__tags');
        const taxonomy = getTag(data, type);
        if (taxonomy) tags.appendChild(el(doc, 'span', 'ui-pill modal-detail__tag', taxonomy));
        if (data.price) {
            const free = /\bfree\b/i.test(data.price) ? ' event-card__price--free' : '';
            tags.appendChild(el(doc, 'span', `ui-pill event-card__price${free}`, data.price));
        }
        if (tags.childElementCount) body.appendChild(tags);

        const titleId = `modal-detail-title-${(modalCounter += 1)}`;
        const title = el(doc, 'h2', 'modal-detail__title', data.name || '');
        title.id = titleId;
        body.appendChild(title);

        const when = formatDetailDateTime(data.start_datetime, data.end_datetime);
        if (when) body.appendChild(el(doc, 'p', 'modal-detail__when', when));

        const area = getArea(data);
        if (data.venue_name || data.address || area) {
            body.appendChild(el(doc, 'hr', 'ui-divider'));
            const where = el(doc, 'p', 'modal-detail__where');
            if (data.venue_name) {
                where.appendChild(el(doc, 'span', 'modal-detail__venue', data.venue_name));
            }
            const line = [data.address, area].filter(Boolean)[0];
            if (line) where.appendChild(doc.createTextNode(line));
            body.appendChild(where);
        }

        if (data.long_desc || data.short_desc) {
            body.appendChild(el(doc, 'hr', 'ui-divider'));
            body.appendChild(
                el(doc, 'p', 'modal-detail__description', data.long_desc || data.short_desc)
            );
        }

        body.appendChild(el(doc, 'hr', 'ui-divider'));

        if (calendarUrl) {
            const calendar = el(doc, 'p', 'modal-detail__calendar');
            calendar.appendChild(el(doc, 'span', 'modal-detail__calendar-label', 'Add to Calendar: '));
            const link = el(doc, 'a', 'modal-detail__calendar-link', 'Add to Google Calendar');
            link.href = calendarUrl;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            calendar.appendChild(link);
            body.appendChild(calendar);
        }

        const share = el(doc, 'button', 'modal-detail__share', getShareLabel(type));
        share.type = 'button';
        body.appendChild(share);

        return {body, titleId, share};
    }

    /**
     * The modal shell: overlay, card, return bar, focus trap, Escape and
     * overlay dismissal, scroll lock and focus restoration. Callers fill the
     * card and get back a handle.
     *
     * Extracted from openDetailModal in #300 so the Pop-Ups calendar's day
     * modal reuses this rather than growing a second copy of the focus
     * handling — which is the part that is easy to get subtly wrong.
     *
     * @param {{document?: Document, className: string, cardClassName: string,
     *          returnLabel?: string, onClose?: Function,
     *          build: (card: Element, handle: {close: Function}) => ({labelledBy?: string}|void)}} options
     * @returns {{close: Function, element: Element, card: Element}}
     */
    function openModal(options) {
        const settings = options || {};
        const doc = settings.document || (global && global.document);
        if (!doc) throw new Error('openModal requires a document');

        const opener = doc.activeElement;
        const previousOverflow = doc.body.style.overflow;

        const overlay = el(doc, 'div', settings.className || 'modal--detail');
        const card = el(doc, 'div', settings.cardClassName || 'modal-detail__card');
        card.setAttribute('role', 'dialog');
        card.setAttribute('aria-modal', 'true');

        const returnBar = el(
            doc,
            'button',
            'modal-return-bar',
            `← ${settings.returnLabel || 'Return'}`
        );
        returnBar.type = 'button';
        card.appendChild(returnBar);

        overlay.appendChild(card);

        let closed = false;

        function close() {
            // Escape, the return bar and the overlay all land here, as does a
            // caller closing it directly, so this is the one place that can
            // tell a caller the modal is gone. Guarded because the callback
            // may well close it again (see the history handling in #297).
            if (closed) return;
            closed = true;
            doc.removeEventListener('keydown', onKeydown, true);
            overlay.remove();
            doc.body.style.overflow = previousOverflow;
            if (opener && typeof opener.focus === 'function') opener.focus();
            if (typeof settings.onClose === 'function') settings.onClose();
        }

        function onKeydown(event) {
            if (event.key === 'Escape') {
                event.preventDefault();
                close();
                return;
            }
            if (event.key !== 'Tab') return;

            const focusable = Array.from(card.querySelectorAll(FOCUSABLE)).filter(
                node => node.offsetParent !== null || node === doc.activeElement
            );
            if (focusable.length === 0) return;
            const first = focusable[0];
            const last = focusable[focusable.length - 1];

            if (event.shiftKey && doc.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && doc.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        }

        const handle = {close, element: overlay, card};
        const built = typeof settings.build === 'function' ? settings.build(card, handle) : null;
        if (built && built.labelledBy) card.setAttribute('aria-labelledby', built.labelledBy);

        returnBar.addEventListener('click', close);
        overlay.addEventListener('click', event => {
            if (event.target === overlay) close();
        });

        doc.addEventListener('keydown', onKeydown, true);
        doc.body.appendChild(overlay);
        doc.body.style.overflow = 'hidden';
        returnBar.focus();

        return handle;
    }

    /**
     * Opens the detail modal for an event. The caller owns what data goes in;
     * the shell above owns focus handling and dismissal.
     * @param {Object} data - mapped pop-up or date idea
     * @param {{type?: 'popup'|'date-idea', returnLabel?: string, document?: Document}} [options]
     */
    function openDetailModal(data, options) {
        const settings = options || {};
        const doc = settings.document || (global && global.document);
        if (!doc) throw new Error('openDetailModal requires a document');

        const type = settings.type === 'date-idea' ? 'date-idea' : 'popup';

        return openModal({
            document: doc,
            className: 'modal--detail',
            cardClassName: 'modal-detail__card',
            returnLabel: settings.returnLabel,
            onClose: settings.onClose,
            build: card => {
                const calendarUrl = buildGoogleCalendarUrl(data);
                const {body, titleId, share} = buildBody(doc, data, type, calendarUrl);
                card.appendChild(body);

                const media = el(doc, 'div', 'modal-detail__media');
                const image = el(doc, 'img', 'modal-detail__image');
                image.src = data.img || 'resources/images/images/default-popup-image.webp';
                // Decorative: the title carries the meaning.
                image.alt = '';
                media.appendChild(image);
                card.appendChild(media);

                share.addEventListener('click', () => {
                    const shareData = getShareData(data, {
                        type,
                        origin: global && global.location ? global.location.origin : '',
                    });
                    if (global && global.navigator && typeof global.navigator.share === 'function') {
                        global.navigator.share(shareData).catch(() => {});
                    } else if (global && global.navigator && global.navigator.clipboard) {
                        global.navigator.clipboard.writeText(shareData.url).catch(() => {});
                    }
                });

                return {labelledBy: titleId};
            },
        });
    }

    const api = {
        FOCUSABLE,
        getShareLabel,
        buildGoogleCalendarUrl,
        getShareData,
        formatDetailDateTime,
        openModal,
        openDetailModal,
    };

    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (global) global.NycModal = api;
})(typeof window !== 'undefined' ? window : null);
