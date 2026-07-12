# Date Ideas Schema Reference

> **Document type:** `date_ideas`  
> **File:** `sanity/schemaTypes/dateIdea.ts`  
> **Last updated:** 2026-07-11

---

## Field Reference

### Identity & Display

| Field | Type | Required | Description |
|---|---|---|---|
| `name` | string | ✅ | Date idea title shown on listings. |
| `slug` | slug | ✅ | URL-friendly identifier (auto-generated from `name`). |

### Scheduling

Unlike `pop-ups`, all scheduling and recurrence fields are gated behind the
`has_date_and_time` boolean — most date ideas are evergreen and have no
specific date.

| Field | Type | Required | Description |
|---|---|---|---|
| `has_date_and_time` | boolean | — | Gate for all scheduling/recurrence fields. Default: `false`. |
| `start_datetime` | datetime | Conditional | Start date/time for timed events. Required when `has_date_and_time` is true and `all_day` is false. |
| `end_datetime` | datetime | — | End date/time. Must be after `start_datetime`. |
| `start_date` | date | Conditional | Start date for all-day events. Required when `all_day` is true. |
| `end_date` | date | — | End date for multi-day all-day events. |
| `all_day` | boolean | — | Enable for events with no specific time. Default: `false`. |

### Recurrence

All recurrence fields are hidden unless `has_date_and_time` and `recurring` are enabled.

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
| `vibe` | string (enum) | — | Vibe for filtering and the card vibe label. Values: `romantic`, `adventurous`, `chill`, `foodie`, `cultural`, `free`. |
| `budget` | string (enum) | — | Budget tier for the budget filter dropdown. Values: `free`, `under_30` (Under $30), `30_to_75` ($30–$75), `75_plus` ($75+). |
| `is_featured` | boolean | — | Featured card variant with expanded image. Default: `false`. |

### Location & Geography

| Field | Type | Required | Description |
|---|---|---|---|
| `borough` | string (enum) | — | NYC borough. Values: `manhattan`, `brooklyn`, `queens`, `bronx`, `staten_island`, `citywide` (for multi-location content; exempts `neighborhood`/`address` from content validation). |
| `neighborhood` | string | — | Neighborhood within the borough (e.g., Chelsea, SoHo). |
| `venue_name` | string | — | Name of the venue for the date idea. |
| `address` | text | — | Full street address of the venue. (Not geocoded — date ideas have no map view.) |
| `location` | string | — | Legacy free-text location. Prefer `venue_name` + `address` for new content. |

### Pricing

| Field | Type | Required | Description |
|---|---|---|---|
| `price` | string | — | Price badge label (e.g., "Free", "$40 per person"). |

### Content

| Field | Type | Required | Description |
|---|---|---|---|
| `link` | url | — | Optional CTA / external link for the date idea. |
| `link_text` | string | — | Display text for the link. |
| `short_description` | text | — | Teaser shown on cards (2 rows). |
| `long_description` | text | — | Full description shown on the detail page (6 rows). |
| `image` | image | — | Image with hotspot support, used for both card and detail views. |

### Visibility Flags

| Field | Type | Default | Description |
|---|---|---|---|
| `display_overall` | boolean | `true` | Master visibility toggle. |

> **Note:** Unlike `pop-ups`, `date_ideas` has no `display_in_calendar` /
> `display_in_carousel` flags — date ideas do not appear on the calendar or
> homepage carousel today.

---

## Use Cases

### Card List View (Date Ideas Page)

Query: `SANITY_QUERIES.DATE_IDEAS`  
Key fields: `name`, `slug`, `vibe`, `budget`, `borough`, `neighborhood`, `price`, `is_featured`, `imageUrl`, `short_description`, `display_overall`

### Filters

Query: `SANITY_QUERIES.DATE_IDEAS`  
Key fields: `vibe` (Vibe dropdown), `budget` (Budget dropdown), `borough`/`neighborhood` (Neighborhood dropdown)

### Detail View

Query: `SANITY_QUERIES.DATE_IDEA_BY_ID`  
Key fields: All projected fields (note: `imageUrl` is projected rather than the raw `image` object). Supports share (via `name`, `slug`, `short_description`, `imageUrl`); `venue_name` + `address` display in the detail modal.

---

## GROQ Query Projections

Both `DATE_IDEAS` and `DATE_IDEA_BY_ID` in `resources/js/sanity-queries.js` project the fields needed by the front end, including:
- `vibe`, `budget`, `borough`, `neighborhood`, `venue_name`, `address`
- `price`, `is_featured`
- `imageUrl` (resolved from `image.asset->url`)

> **Note:** `scripts/prebuild-events.js` maintains its own copy of the
> `DATE_IDEAS` query (`DATE_IDEAS_QUERY`) for static tile pre-rendering — keep
> it in sync when adding or renaming fields (see CLAUDE.md).
