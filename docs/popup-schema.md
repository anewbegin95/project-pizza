# Pop-ups Schema Reference

> **Document type:** `pop-ups`  
> **File:** `sanity/schemaTypes/popup.ts`  
> **Last updated:** 2026-06-14

---

## Field Reference

### Identity & Display

| Field | Type | Required | Description |
|---|---|---|---|
| `name` | string | ✅ | Pop-up event title shown on listings. |
| `slug` | slug | ✅ | URL-friendly identifier (auto-generated from `name`). |

### Scheduling

| Field | Type | Required | Description |
|---|---|---|---|
| `start_datetime` | datetime | Conditional | Start date/time for timed events. Required when `all_day` is false. |
| `end_datetime` | datetime | — | End date/time. Must be after `start_datetime`. |
| `start_date` | date | Conditional | Start date for all-day events. Required when `all_day` is true. |
| `end_date` | date | — | End date for multi-day all-day events. |
| `all_day` | boolean | — | Enable for events with no specific time. Default: `false`. |

### Recurrence

| Field | Type | Required | Description |
|---|---|---|---|
| `recurring` | boolean | — | Enable for repeating events. Default: `false`. |
| `recurrence_frequency` | string (enum) | Conditional | `daily`, `weekly`, or `monthly`. Required when `recurring`. |
| `recurrence_interval` | number | — | Repeat every N units. Default: `1`. |
| `recurrence_by_weekday` | array of strings | Conditional | Days of week (`SU`–`SA`). Required for weekly recurrence. |
| `recurrence_monthly_mode` | string (enum) | Conditional | `monthday` or `weekday`. Required for monthly recurrence. |
| `recurrence_by_monthday` | array of numbers | Conditional | Month days (1–31). |
| `recurrence_by_weekday_ordinal` | string (enum) | Conditional | Which occurrence (`1`–`4`, `-1` for last). |
| `recurrence_by_monthly_weekday` | string (enum) | Conditional | Weekday for monthly recurrence. |
| `recurrence_end_date` | date | — | Optional end date for recurrence. |

### Category & Taxonomy

| Field | Type | Required | Description |
|---|---|---|---|
| `category` | string (enum) | — | **Hidden in Studio.** Existing values still drive the Type filter and map pin icons; new pop-ups have none. Event type. Values: `food_drink`, `market`, `art_culture`, `beauty`, `fashion`, `wellness`, `music`, `vintage_thrift`. |
| `is_featured` | boolean | — | Featured card variant with expanded image. Default: `false`. |

### Location & Geography

| Field | Type | Required | Description |
|---|---|---|---|
| `borough` | string (enum) | — | **Read-only, hidden in Studio.** Derived from `location` by `scripts/geocode-popups.js`. Values: `manhattan`, `brooklyn`, `queens`, `bronx`, `staten_island`, `citywide` (for multi-location content; exempts `neighborhood`/`address` from content validation). |
| `neighborhood` | string | — | **Read-only, hidden in Studio.** Not currently derived; NYC ZIPs and Nominatim are both too coarse to label it reliably (10001 covers both Herald Square and Chelsea). Existing values are retained. |
| `venue_name` | string | — | **Hidden in Studio (retired).** Superseded by `location`. |
| `address` | text | — | **Hidden in Studio (retired).** Superseded by `location`, which geocoding now reads first. Kept as a fallback for the handful of older documents that used it. |
| `latitude` | number | — | Read-only, hidden in Studio. Auto-populated from `location` by `scripts/geocode-popups.js`. |
| `longitude` | number | — | Read-only, hidden in Studio. Auto-populated from `location` by `scripts/geocode-popups.js`. |
| `location` | string | — | **The location field.** Free text: street address, cross streets, or a venue name. Drives geocoding, which derives `latitude`, `longitude` and `borough`. |

### Pricing

| Field | Type | Required | Description |
|---|---|---|---|
| `price` | string | — | **Hidden in Studio.** Existing values still render as a badge on cards and in the modal; new pop-ups have none. |

### Content

| Field | Type | Required | Description |
|---|---|---|---|
| `link` | url | — | External link for the event. |
| `link_text` | string | — | Display text for the link. |
| `short_description` | text | — | Brief description (2 rows). |
| `long_description` | text | — | Full description (6 rows). |
| `image` | image | — | Event image with hotspot support. |

### Visibility Flags

| Field | Type | Default | Description |
|---|---|---|---|
| `display_overall` | boolean | `true` | Master visibility toggle. |
| `display_in_calendar` | boolean | `true` | Show on calendar page. |
| `display_in_popups_page` | boolean | `true` | Show on pop-ups listing page. |
| `display_in_carousel` | boolean | `true` | Show in homepage carousel. |

---

## Use Cases

### List View (Pop-ups Page)

Query: `SANITY_QUERIES.POPUPS`  
Key fields: `name`, `slug`, `start_datetime`/`start_date`, `category`, `borough`, `neighborhood`, `price`, `is_featured`, `imageUrl`, `short_description`, `display_in_popups_page`

### Map View

Query: `SANITY_QUERIES.POPUPS`  
Key fields: `latitude`, `longitude` (geocoded from `address`), `category` (pin icon), `venue_name`, `name`, `price`

### Calendar View

Query: `SANITY_QUERIES.POPUPS` (filtered by `display_in_calendar`)  
Key fields: `name`, `start_datetime`/`start_date`, `end_datetime`/`end_date`, `all_day`, `recurring`, recurrence fields, `category`

### Detail View

Query: `SANITY_QUERIES.POPUP_BY_ID`  
Key fields: All projected fields (note: `imageUrl` is projected rather than the raw `image` object). Supports share (via `name`, `slug`, `short_description`, `imageUrl`) and add-to-calendar (via date/time and location fields).

---

## GROQ Query Projections

Both `POPUPS` and `POPUP_BY_ID` queries project the fields needed by the front end, including:
- `category`, `borough`, `neighborhood`, `venue_name`, `address`, `latitude`, `longitude`
- `price`, `is_featured`
- Computed `display_in_popups_page` and `display_in_carousel` (auto-hide expired events)
- `imageUrl` (resolved from `image.asset->url`)

> **Note:** `latitude`, `longitude` and `borough` are derived from the `location` field by `scripts/geocode-popups.js`, which geocodes via Nominatim (OpenStreetMap, no API key) and writes the values back into Sanity through the write-enabled Mutate API. It runs on a schedule via `.github/workflows/geocode-popups.yml` (and can be triggered manually) and caches lookups in `data/geocode-cache.json`. CMS editors never enter any of the three by hand; all are `readOnly` and hidden in Studio.
>
> Borough comes from Nominatim's `suburb`, falling back to `county`. Queries are constrained to an NYC bounding box and re-checked on the response, because the fallback query chain otherwise produces distant false positives (`Washington & Water St (Brooklyn)` matched an intersection in Syracuse). Location text with a parenthetical aside is retried with the aside stripped, since Nominatim returns no match rather than ignoring it.
>
> Expect roughly 9 in 10 to resolve. Text that names no place at all (`Moving truck, see details`, `All PopUp Bagel locations`) and bare intersections (`Mercer St & Prince St`) do not geocode, and those documents keep an empty `borough`.
