// Map view for the redesigned Pop-Ups page. Renders one pin per filtered
// result, keeps them in step with the filter bar, and opens the same detail
// modal a card would. Leaflet is vendored (resources/vendor/leaflet) because
// the page's CSP is script-src 'self' — see that directory's README and #299.
// See REDESIGN.md section 6.6.
//
// Wrapped in an IIFE: classic scripts share one global lexical scope, and a
// duplicate top-level declaration silently kills a whole file.
(function (global) {
    'use strict';

    // === CONSTANTS ===

    /** Categories section 6.6 assigns a pin colour. `beauty` is not among them. */
    const PIN_CATEGORIES = [
        'food_drink',
        'market',
        'art_culture',
        'fashion',
        'wellness',
        'music',
        'vintage_thrift',
    ];

    /** Colour lives in map.css; JS only picks the modifier. */
    const OTHER_MODIFIER = 'other';

    /** Roughly City Hall — where the map opens when nothing can be placed. */
    const DEFAULT_CENTER = [40.7128, -74.006];

    const DEFAULT_ZOOM = 11;

    const MAX_FITTED_ZOOM = 15;

    const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

    const TILE_ATTRIBUTION =
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

    // === PURE HELPERS ===

    function getPinModifier(category) {
        const value = String(category || '');
        return PIN_CATEGORIES.includes(value) ? value.replace(/_/g, '-') : OTHER_MODIFIER;
    }

    /**
     * Coordinates are written back into Sanity by the scheduled geocoding job,
     * so an entry added since the last run legitimately has none. 0 is a valid
     * coordinate, which rules out a truthiness check.
     */
    function hasCoordinates(entry) {
        if (!entry) return false;
        const {latitude, longitude} = entry;
        if (typeof latitude !== 'number' || typeof longitude !== 'number') return false;
        if (Number.isNaN(latitude) || Number.isNaN(longitude)) return false;
        return Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180;
    }

    function getMappable(entries) {
        return (Array.isArray(entries) ? entries : []).filter(hasCoordinates);
    }

    function countUnmapped(entries) {
        const list = Array.isArray(entries) ? entries : [];
        return list.length - getMappable(list).length;
    }

    /** '' when everything is placed, so the caller can hide the line entirely. */
    function formatUnmappedNote(count) {
        if (!count) return '';
        return count === 1 ? "1 event isn't on the map yet" : `${count} events aren't on the map yet`;
    }

    /** [[southWestLat, southWestLng], [northEastLat, northEastLng]], or null. */
    function getBounds(entries) {
        const mappable = getMappable(entries);
        if (mappable.length === 0) return null;

        const lats = mappable.map((entry) => entry.latitude);
        const lngs = mappable.map((entry) => entry.longitude);
        return [
            [Math.min(...lats), Math.min(...lngs)],
            [Math.max(...lats), Math.max(...lngs)],
        ];
    }

    // === DOM ===

    function buildLegend(doc) {
        const legend = doc.createElement('div');
        legend.className = 'map-legend';
        const title = doc.createElement('p');
        title.className = 'map-legend__title';
        title.textContent = 'Event Types';
        legend.appendChild(title);

        const list = doc.createElement('ul');
        list.className = 'map-legend__list';
        for (const category of PIN_CATEGORIES) {
            const item = doc.createElement('li');
            item.className = 'map-legend__item';
            const dot = doc.createElement('span');
            dot.className = `map-legend__dot map-legend__dot--${getPinModifier(category)}`;
            item.appendChild(dot);
            const label = doc.createElement('span');
            const tag = global.NycCards ? global.NycCards.getCategoryTag(category) : category;
            label.textContent = tag;
            item.appendChild(label);
            list.appendChild(item);
        }
        legend.appendChild(list);
        return legend;
    }

    function buildPinIcon(entry) {
        const tag = global.NycCards ? global.NycCards.getCategoryTag(entry.category) : '';
        // getCategoryTag is "<emoji> <label>"; the pin shows the emoji only.
        const emoji = String(tag).trim().split(' ')[0] || '📍';
        return global.L.divIcon({
            className: '',
            html: `<span class="map-pin map-pin--${getPinModifier(entry.category)}">${emoji}</span>`,
            iconSize: [32, 32],
            iconAnchor: [16, 16],
        });
    }

    /**
     * Mounts the map into `container`. Leaflet needs a laid-out element to size
     * itself, and the panel is display:none until the toggle switches to it, so
     * creation is deferred until the first time the map view is shown.
     */
    function initMap(doc, container, {getEntries, onSelect} = {}) {
        if (!doc || !container || !global.L) return null;

        let map = null;
        let markerLayer = null;
        const note = doc.createElement('p');
        note.className = 'map-note';
        container.appendChild(note);

        function currentEntries() {
            return typeof getEntries === 'function' ? getEntries() : [];
        }

        function create() {
            const surface = doc.createElement('div');
            surface.className = 'map-surface';
            container.insertBefore(surface, note);

            map = global.L.map(surface, {scrollWheelZoom: false}).setView(DEFAULT_CENTER, DEFAULT_ZOOM);
            global.L.tileLayer(TILE_URL, {attribution: TILE_ATTRIBUTION, maxZoom: 19}).addTo(map);
            markerLayer = global.L.layerGroup().addTo(map);

            const legend = global.L.control({position: 'topleft'});
            legend.onAdd = () => buildLegend(doc);
            legend.addTo(map);
        }

        function render() {
            if (!map) return;
            const entries = currentEntries();
            markerLayer.clearLayers();

            for (const entry of getMappable(entries)) {
                const marker = global.L.marker([entry.latitude, entry.longitude], {
                    icon: buildPinIcon(entry),
                    title: entry.name || '',
                    alt: entry.name || '',
                });
                marker.on('click', () => {
                    if (typeof onSelect === 'function') onSelect(entry);
                });
                marker.addTo(markerLayer);
            }

            const bounds = getBounds(entries);
            if (bounds) map.fitBounds(bounds, {padding: [40, 40], maxZoom: MAX_FITTED_ZOOM});

            note.textContent = formatUnmappedNote(countUnmapped(entries));
            note.hidden = note.textContent === '';
        }

        /** Called when the panel becomes visible; sizes or resizes the map. */
        function show() {
            if (!map) {
                create();
                render();
                return;
            }
            // A map created or updated while hidden measures 0x0.
            map.invalidateSize();
            render();
        }

        return {show, render, isCreated: () => map !== null};
    }

    const api = {
        PIN_CATEGORIES,
        DEFAULT_CENTER,
        TILE_URL,
        getPinModifier,
        hasCoordinates,
        getMappable,
        countUnmapped,
        formatUnmappedNote,
        getBounds,
        initMap,
    };

    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (global) global.NycPopupsMap = api;
})(typeof window !== 'undefined' ? window : null);
