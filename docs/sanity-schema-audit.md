# Sanity Schema & Content Audit

> **Purpose:** Identify gaps between current Sanity schema/content and the redesign requirements documented in `REDESIGN.md`.  
> **Scope:** Schema definitions, GROQ queries, and front-end data contracts only — no schema changes are made in this audit.  
> **Date:** 2026-06-13

---

## 1. Current Schema Summary

| Document type | File | Fields (count) |
|---|---|---|
| `pop-ups` | `sanity/schemaTypes/popup.ts` | 26 |
| `date_ideas` | `sanity/schemaTypes/dateIdea.ts` | 24 |
| `featured_post` | `sanity/schemaTypes/featuredPost.ts` | 4 |

Supporting files:
- `resources/js/sanity-client.js` — browser-side fetch helper (public CDN, no auth token)
- `resources/js/sanity-queries.js` — all GROQ queries used by the front end
- `scripts/prebuild-events.js` — server-side event pre-build (duplicates fetch logic)
- `scripts/generate-llms-txt.js` — LLM-friendly site export (duplicates fetch logic)

---

## 2. Missing Fields (Required by Redesign)

### 2.1 Pop-ups (`pop-ups`)

| Missing field | Redesign requirement | Reference |
|---|---|---|
| `borough` (string/enum) | Filter bar: Borough dropdown (Manhattan, Brooklyn, Queens, etc.) | REDESIGN.md §6.3, §7.1 |
| `neighborhood` (string/enum) | Filter bar: Neighborhood dropdown (Chelsea, Harlem, SoHo, etc.) | REDESIGN.md §6.3, §7.1 |
| `type` / `category` (string/enum) | Filter bar: Type dropdown with emoji (Food & Drink, Market, Art & Culture, Fashion, Wellness, Music, Vintage & Thrift) | REDESIGN.md §6.3, §6.6 |
| `latitude` (number) | Map view: pin placement | REDESIGN.md §6.6 |
| `longitude` (number) | Map view: pin placement | REDESIGN.md §6.6 |
| `price` / `price_label` (string) | Event card: price badge pill (e.g. "Free", "$15–30") | REDESIGN.md §6.4 |
| `venue_name` (string) | Event card & modal: venue name displayed separately from address | REDESIGN.md §6.4, §6.5 |
| `address` (string/text) | Modal: full address below venue name | REDESIGN.md §6.5 |
| `is_featured` (boolean) | Featured card variant (expanded image, overlaid title) | REDESIGN.md §6.4 |

### 2.2 Date Ideas (`date_ideas`)

| Missing field | Redesign requirement | Reference |
|---|---|---|
| `vibe` (string/enum) | Filter bar: Vibe dropdown (Romantic, Adventurous, Chill, Foodie, Cultural, Free) | REDESIGN.md §7.2 |
| `budget` (string/enum) | Filter bar: Budget dropdown (Free, Under $30, $30–$75, $75+) | REDESIGN.md §7.2 |
| `neighborhood` (string/enum) | Filter bar: Neighborhood dropdown | REDESIGN.md §7.2 |
| `borough` (string/enum) | Implied by neighborhood filter (grouping) | REDESIGN.md §7.2 |
| `price` / `price_label` (string) | Card badge pill | REDESIGN.md §6.4 |
| `venue_name` (string) | Card & modal: venue vs. generic location string | REDESIGN.md §6.4 |
| `address` (string/text) | Modal: full address | REDESIGN.md §6.5 |

### 2.3 Featured Posts (`featured_post`)

| Missing field | Redesign requirement | Reference |
|---|---|---|
| `image` (image) | Homepage carousel restyle shows card images | REDESIGN.md §7.3 |
| `link` (url) | Separate click-through URL vs. embed URL | REDESIGN.md §7.3 |
| `publish_date` (date) | Ordering by relevance/date in carousel | REDESIGN.md §7.3 |

### 2.4 Homepage Content (no dedicated schema)

The redesign specifies quick-navigation cards (NYC Pop-Ups, Date Ideas, Substack Newsletter) with representative photos and short descriptors. Currently this content is hard-coded in `index.html`. A `homepage_section` or `site_settings` singleton document type does not exist.

---

## 3. Weak / Inconsistent Taxonomy

| Issue | Details |
|---|---|
| **No controlled vocabulary for location** | `location` is a free-text `string` on both `pop-ups` and `date_ideas`. No borough, neighborhood, or structured geo data exists. Content likely contains inconsistent location names (e.g. "Williamsburg" vs. "Williamsburg, Brooklyn"). |
| **No event category/type taxonomy** | Neither schema defines a category/type field. The redesign requires 7 predefined types with emoji icons for filtering and map pins. |
| **`display_in_*` flags only on `pop-ups`** | `pop-ups` has `display_in_calendar`, `display_in_popups_page`, `display_in_carousel`. `date_ideas` lacks `display_in_calendar` and `display_in_carousel`; adding date ideas to the calendar/carousel would require new fields plus calendar rendering support. |
| **Inconsistent date gating** | `date_ideas` uses `has_date_and_time` boolean to gate date fields; `pop-ups` does not (dates are always applicable). This divergence complicates shared rendering logic. |
| **`featured_post` is minimal** | Only 4 fields (name, embed_url, caption, display_overall). No image, no date, no category — insufficient for the restyled carousel cards. |
| **No price/cost information** | Neither `pop-ups` nor `date_ideas` captures cost data. The redesign calls for price pills on cards and a Budget filter for date ideas. |

---

## 4. GROQ Query Gaps

| Query | Gap |
|---|---|
| `SANITY_QUERIES.DATE_IDEAS` | Does not project `display_in_calendar` or `display_in_carousel` (these fields do not exist on the `date_ideas` schema today; add them first, then project them for client gating). |
| `SANITY_QUERIES.POPUPS` | Projects all display flags, but lacks future fields (borough, neighborhood, type, lat/lng, price) once they are added. |
| `SANITY_QUERIES.FEATURED_POSTS` | Does not project `image` (field doesn't exist yet). |
| All queries | No filter parameters — all filtering is client-side. As content grows, server-side filtering or pagination may be needed. |

---

## 5. Data Quality Concerns

| Concern | Impact |
|---|---|
| **Free-text `location`** | Cannot reliably extract borough/neighborhood for filter dropdowns without manual backfill. |
| **Missing images** | `image` is optional on both `pop-ups` and `date_ideas`. Cards with missing images will break the redesigned card layout (image column is structural). |
| **No lat/lng data** | Map view is blocked until coordinates are backfilled for every pop-up. |
| **No content audit of existing documents** | Without querying live Sanity data, we cannot confirm how many documents lack `short_description`, `image`, or other fields the redesign relies on. A content completeness report should be generated. |

---

## 6. Follow-Up Issues

The following schema and backfill work should be tracked as separate issues referencing this audit:

1. **Schema: Add geo & taxonomy fields to `pop-ups`** — Add `borough`, `neighborhood`, `type`, `latitude`, `longitude`, `price`, `venue_name`, `address`, `is_featured`.
2. **Schema: Add taxonomy fields to `date_ideas`** — Add `vibe`, `budget`, `neighborhood`, `borough`, `price`, `venue_name`, `address`.
3. **Schema: Enhance `featured_post`** — Add `image`, `link`, `publish_date`.
4. **Schema: Create homepage singleton** — Or hardcode quick-nav content; decide approach.
5. **Content backfill: Geo-code existing pop-ups** — Populate `latitude`, `longitude`, `borough`, `neighborhood` for all existing documents.
6. **Content backfill: Categorize existing pop-ups** — Assign `type` to all existing documents.
7. **Content backfill: Add vibe/budget to date ideas** — Populate taxonomy fields.
8. **Content backfill: Ensure image coverage** — Identify and fill documents with missing images.
9. **Query update: Align GROQ projections** — Once schema changes land, update `sanity-queries.js` to project new fields and add filter parameters.
10. **Content completeness report** — Run a GROQ query against production to quantify documents missing `short_description`, `image`, `location`, and other key fields.

---

## 7. Files Reviewed

| File | Role |
|---|---|
| `sanity/schemaTypes/popup.ts` | Pop-up document schema |
| `sanity/schemaTypes/dateIdea.ts` | Date idea document schema |
| `sanity/schemaTypes/featuredPost.ts` | Featured post document schema |
| `sanity/schemaTypes/index.ts` | Schema type registry |
| `sanity/sanity.config.ts` | Studio configuration |
| `resources/js/sanity-client.js` | Front-end Sanity fetch helper |
| `resources/js/sanity-queries.js` | GROQ query definitions |
| `scripts/prebuild-events.js` | Server-side event pre-build |
| `scripts/generate-llms-txt.js` | LLM export script |
| `REDESIGN.md` | Full redesign specification |
| `index.html` | Homepage (current) |
| `pop-ups.html` | Pop-ups listing page |
| `date-ideas.html` | Date ideas listing page |
| `calendar.html` | Calendar page |
