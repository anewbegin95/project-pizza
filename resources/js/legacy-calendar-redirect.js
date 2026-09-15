// Hands calendar.html over to the Pop-Ups calendar view when the redesign is
// on. The redesign treats Calendar as a view of Pop-Ups rather than a page of
// its own (#302), so a bookmark, a sitemap entry or an old link should land
// there instead of on the legacy page.
//
// Loaded blocking in calendar.html's <head>, immediately after
// redesign-flag.js, so the swap happens before anything renders. It has to be
// a file rather than an inline script: every page sets script-src 'self'.
//
// Flag-off this does nothing at all, which is the point — calendar.html is the
// only calendar those readers have.
(function (global) {
    'use strict';

    const REDESIGN_CALENDAR_URL = 'pop-ups.html?view=calendar';

    /**
     * Where to send the reader. An explicit `?redesign=on` is carried over:
     * the flag is OFF by default in every environment, so dropping it would
     * land someone who asked for the redesigned calendar on the legacy
     * Pop-Ups page. Nothing else is dragged along.
     */
    function buildRedirectTarget(locationLike) {
        const search = locationLike && locationLike.search ? String(locationLike.search) : '';
        let override = null;
        try {
            override = new URLSearchParams(search).get('redesign');
        } catch (error) {
            override = null;
        }
        return override === 'on' ? `${REDESIGN_CALENDAR_URL}&redesign=on` : REDESIGN_CALENDAR_URL;
    }

    function redirect(scope) {
        if (!scope || !scope.location) return false;
        if (!scope.REDESIGN_FLAG || !scope.REDESIGN_FLAG.isEnabled()) return false;
        // replace, not assign: Back should return to wherever the reader came
        // from, not bounce them through the page they just left.
        scope.location.replace(buildRedirectTarget(scope.location));
        return true;
    }

    if (global && global.location) redirect(global);

    const api = {REDESIGN_CALENDAR_URL, buildRedirectTarget, redirect};

    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (global) global.NycLegacyCalendarRedirect = api;
})(typeof window !== 'undefined' ? window : null);
