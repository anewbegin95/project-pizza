# Security Policy

## Scope

The live site at [nycsliceoflife.com](https://nycsliceoflife.com/), built from
`main`, plus this repository's GitHub Actions workflows and Sanity Studio
configuration. There are no versioned releases: only what's on `main` is
supported.

## Reporting a vulnerability

**Please don't open a public issue.** Email
[NYCSliceofLife@gmail.com](mailto:NYCSliceofLife@gmail.com) with:

- what you found and where (a URL, a file and line, or a workflow name)
- how to reproduce it
- what an attacker could do with it

This is a one-person project, so responses are best-effort, but security
reports come first. You'll get a reply when the report has been read, and
another when it's fixed or declined, with the reason.

## Response headers

The site is branch-served GitHub Pages (`main`, custom domain
`nycsliceoflife.com`). GitHub Pages sends a fixed set of response headers and
ignores the repository's [`_headers`](../_headers) file, which only Netlify and
Cloudflare Pages read. Nothing in `_headers` reaches a visitor. The one policy
that does is the `<meta http-equiv="Content-Security-Policy">` tag, identical
across all nine pages (`tests/unit/csp.spec.js`).

**Decision: accept the gap, record it, revisit on the triggers below.**
Hosting stays on GitHub Pages and `_headers` stays as a reference copy of the
intended policy. This is option 3 of the three paths weighed in #433. The other
two, a proxy in front of Pages or moving the host, need DNS or hosting changes
that were not made as part of that issue. The upgrade path is written down
below so it is a short job when the triggers fire.

Verified 2026-11-09 against `https://nycsliceoflife.com` with `curl -I`
(`server: GitHub.com`; `cache-control: max-age=600`; none of the other headers
below present):

| Declared in `_headers` | Live | What that leaves open |
|---|---|---|
| `Strict-Transport-Security` | Not sent | No HSTS, so a first visit over plain HTTP is not upgraded by the browser. Partly covered: Pages has "Enforce HTTPS" on and answers `http://` with a server-side `301` to `https://`. The JS redirect in `partials-loader.js` is a backstop behind that, not the only defence. Residual risk is the one plaintext request before the redirect. |
| `Content-Security-Policy` | Via `<meta>` only | Enforced, minus the directives a `<meta>` tag cannot carry (below). |
| `frame-ancestors` (inside the CSP) and `X-Frame-Options` | Not sent | **The site can be framed.** A `<meta>` CSP ignores `frame-ancestors` by spec, so there is no in-repo substitute short of a JS frame-buster. Impact is low: the site has no sign-in, no forms and no state-changing actions. The only controls are the consent buttons, which a framing page could try to get clicked. |
| `X-Content-Type-Options` | Not sent | MIME sniffing is possible in principle. Pages sets correct `content-type` values for what the site serves, and it hosts no user-supplied files. |
| `Referrer-Policy` | Via `<meta name="referrer">` | Enforced on all nine pages with the same value as `_headers`. |
| `Permissions-Policy` | Not sent | Geolocation, camera and microphone are not gated by header. Nothing in `resources/js/` requests them. |
| `Cross-Origin-Resource-Policy` | Not sent | Pages already answers with `access-control-allow-origin: *`, so the site's static assets are public by design. |
| `Cache-Control` (assets 1 day, partials 1 hour) | Pages default, 10 minutes | Performance only. Assets are revalidated more often than intended. |

Why this is acceptable today: a static site with no authentication, no
forms, no user-generated content and no sessions. The only stored visitor state
is the consent choice in `localStorage`, and analytics load only after consent.

**Revisit when any of these become true:** the site gains a sign-in, a form
that accepts input, or user-supplied content; a framed copy of the site is
seen in the wild; or the cache lifetimes start to matter for performance.

**Upgrade path (option 1).** The domain's nameservers are already Cloudflare's
(`arnold.ns.cloudflare.com`, `monika.ns.cloudflare.com`), but the records are
DNS-only, so requests go straight to GitHub. To send the headers:

1. Turn on the Cloudflare proxy for the apex and `www` records.
2. Set SSL/TLS mode to **Full (strict)**. Anything looser loops against
   Pages' "Enforce HTTPS".
3. Add the headers as **Response Header Transform Rules** (Rules →
   Transform Rules → Modify Response Header), copying values from `_headers`,
   and enable HSTS under SSL/TLS → Edge Certificates.
4. Check `curl -I https://nycsliceoflife.com` shows HSTS and
   `X-Frame-Options`, then update this section.

Note that a Cloudflare proxy in front of Pages **does not read `_headers`**:
that file is a Cloudflare *Pages* feature. The rules live in the Cloudflare
dashboard and `_headers` remains a reference copy. Moving the host to
Cloudflare Pages or Netlify (option 2) is the only path where the file itself
becomes live. Do not enable the `preload` token of HSTS until every subdomain
is confirmed HTTPS-only, because browsers cannot easily undo a preload.
