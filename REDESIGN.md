# NYC Slice of Life — Redesign Guide

> **Purpose:** This document serves as the authoritative design specification for the site-wide redesign of NYC Slice of Life. It is intended to guide both human developers and AI coding agents (e.g. GitHub Copilot) in implementing the new design consistently across all pages. All implementation decisions should reference this guide first.

---

## Table of Contents

1. [Design Goals & Principles](#1-design-goals--principles)
2. [Reference Mockups](#2-reference-mockups)
3. [Color Palette](#3-color-palette)
4. [Typography](#4-typography)
5. [Page Background & Surface System](#5-page-background--surface-system)
6. [Component Specifications](#6-component-specifications)
   - [Hero Section](#61-hero-section)
   - [Search Bar](#62-search-bar)
   - [Filter Bar](#63-filter-bar)
   - [Event Cards (List View)](#64-event-cards-list-view)
   - [Event Detail Modal](#65-event-detail-modal)
   - [Map View](#66-map-view)
   - [Header & Navigation](#67-header--navigation)
   - [Footer](#68-footer)
   - [Buttons](#69-buttons)
7. [Page-by-Page Specifications](#7-page-by-page-specifications)
   - [Pop-Ups Page](#71-pop-ups-page-pop-upshtml)
   - [Date Ideas Page](#72-date-ideas-page-date-ideashtml)
   - [Home Page](#73-home-page-indexhtml)
8. [CSS Variable Updates](#8-css-variable-updates)
9. [New CSS Files Needed](#9-new-css-files-needed)
10. [Implementation Notes for Agents](#10-implementation-notes-for-agents)

---

## Rollout Controls (Feature Flag)

All redesign UI must remain gated behind `resources/js/redesign-flag.js` until launch.

- Default state is OFF for development, staging, and production hostnames.
- Environment/config enablement is controlled through `window.REDESIGN_CONFIG`.
- QA can temporarily force behavior with URL params: `?redesign=on` / `?redesign=off`.
- Never ship redesigned markup/behavior as default-on before explicit rollout approval.

## 1. Design Goals & Principles

### Goals
- **Elevate polish** — move from an amateur blog aesthetic to an editorial NYC lifestyle guide
- **Improve usability** — introduce search, filtering, and a map so users can find relevant content faster
- **Consistent design language** — every page should feel like it belongs to the same brand
- **Preserve brand identity** — keep the navy + pink + fuchsia palette; refine how it is used

### Principles
1. **Editorial over boxy** — use large serif display type, generous whitespace, and photography-forward layouts
2. **Functional beauty** — every new UI element (filters, map, cards) should be both beautiful and useful
3. **Warm, not clinical** — use an off-white cream background, not pure white; the site should feel inviting
4. **Green as the interactive accent** — a muted sage/forest green (`#2D6A4F`) replaces pink as the primary interactive/active-state color (buttons, active filters, badges), while fuchsia becomes a pure accent/link color
5. **Mobile-first** — all layouts must be responsive; the card and filter designs must work at 375px width

---

## 2. Reference Mockups

The following mockups were generated in v0.dev and represent the target design. All implementation should match these as closely as possible.

| # | Description | Key Elements Shown |
|---|---|---|
| ![image4](image4) | Pop-ups page — base state | Collage hero, search bar, filter row, results count, month heading |
| ![image3](image3) | Pop-ups page — neighborhood dropdown open | Dropdown design, option list, selected state |
| ![image2](image2) | Pop-ups page — type dropdown open | Emoji category icons, dropdown option list |
| ![image1](image1) | Pop-ups page — date picker open | Dual-month calendar, current date highlighted in pink, Done/Clear buttons |
| ![image7](image7) | Pop-ups page — event card list + featured card | Three-column card layout, day/date column, image, details column, featured full-image variant |
| ![image6](image6) | Pop-ups page — map view | Leaflet map, emoji pins by category, legend, same filter bar |
| ![image5](image5) | Event detail modal | Split layout, pink return bar, tags, serif title, location/time, add to calendar, share button, photo |

---

## 3. Color Palette

The existing CSS variables in `resources/css/base.css` should be updated as follows:

### Retained Colors (no change to hex values)
| Variable | Hex | Usage |
|---|---|---|
| `--nyc-navy` | `#001B2E` | Primary text, header background, footer background |
| `--nyc-fuschia` | `#D81E5B` | Links, inline accents, `< Return to` bar background, hover states |
| `--nyc-pink` | `#FFB6C1` | Light backgrounds, date picker selected highlight, tags |
| `--nyc-light-pink` | `#ffe2e7` | Subtle backgrounds, filter chip selected state |
| `--nyc-white` | `#FFFFFF` | Modal backgrounds, card surfaces, dropdown backgrounds |

### New / Updated Colors
| Variable | Hex | Usage |
|---|---|---|
| `--nyc-cream` | `#FAF8F5` | **New.** Page background (replaces pure white for body) |
| `--nyc-green` | `#2D6A4F` | **New.** Active buttons (List/Map toggle active, primary CTA), active filter borders, day-of-week labels, category badge text |
| `--nyc-green-light` | `#EAF2ED` | **New.** Active filter chip background, Free badge background |
| `--nyc-green-hover` | `#235A40` | **New.** Hover state for green buttons |
| `--nyc-light-gray` | `#F5F5F5` | Unchanged — inactive filter chip background |
| `--nyc-medium-gray` | `#B0B0B0` | Unchanged — borders, muted text |
| `--nyc-charcoal` | `#2E2E2E` | Unchanged — deep contrast text |

### Color Usage Rules
- **Page/section backgrounds:** use `--nyc-cream` not `--nyc-white`
- **Card surfaces:** use `--nyc-white` (so cards lift off the cream background)
- **Primary interactive elements** (active buttons, active filters): use `--nyc-green`
- **Links and inline accents:** use `--nyc-fuschia`
- **Hero supertitle text** ("NYC SLICE OF LIFE PRESENTS"): use `--nyc-pink`
- **Hero main title text:** use `--nyc-white`
- **Day-of-week labels** on cards (e.g. "WEDNESDAY"): use `--nyc-green`
- **Category tags:** emoji + label, `--nyc-navy` text, `--nyc-light-gray` or `--nyc-green-light` background depending on type
- **Free/price badges:** `--nyc-green-light` background, `--nyc-green` text, `--radius-pill` border radius

---

## 4. Typography

### Font Stack Changes
The mockups introduce a **serif display font** for large headings, which is the single biggest visual upgrade.

| Role | Current Font | New Font | Weight |
|---|---|---|---|
| Hero page title (h1 in hero) | Montserrat | **Playfair Display** (serif) | 700 |
| Section headings (month labels, page titles) | Work Sans | **Playfair Display** | 400–700 |
| Event card titles | Work Sans | **Playfair Display** | 700 |
| UI elements (nav, filters, labels, body) | Work Sans | Work Sans (unchanged) | 400–600 |
| Supertitle ("NYC SLICE OF LIFE PRESENTS") | N/A | Work Sans | 600, letter-spacing: 0.15em |
| Category tags / badges | Work Sans | Work Sans | 500 |

### Google Fonts Update
Replace the existing Google Fonts `<link>` in all HTML pages:

```html
<!-- OLD -->
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Montserrat:wght@600&family=Source+Sans+Pro:wght@400;600&family=Work+Sans:wght@400;600&display=swap">

<!-- NEW -->
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=Work+Sans:wght@400;500;600&display=swap">
```

### Typography Scale (updated `base.css`)
```css
h1 {
  font-family: 'Playfair Display', Georgia, serif;
  font-weight: 700;
}
h2 {
  font-family: 'Playfair Display', Georgia, serif;
  font-weight: 400;
}
h3 {
  font-family: 'Playfair Display', Georgia, serif;
  font-weight: 700;
}
/* All UI/body text stays Work Sans */
```

### Specific Typography Notes
- **Hero h1** (e.g. "NYC Pop-Ups"): Playfair Display, ~80–96px on desktop, white, no letter spacing
- **Hero supertitle** (e.g. "NYC SLICE OF LIFE PRESENTS"): Work Sans, ~13px, `--nyc-pink`, `letter-spacing: 0.15em`, uppercase
- **Month headings** (e.g. "April 2026"): Playfair Display, ~40px, `--nyc-navy`
- **Event card title** (e.g. "Spring Floral Market"): Playfair Display, ~22–28px
- **Day label** (e.g. "WEDNESDAY"): Work Sans, ~11px, `--nyc-green`, uppercase, `letter-spacing: 0.1em`
- **Large date number** (e.g. "22"): Playfair Display or Work Sans, ~48px, `--nyc-navy`, bold
- **Body / descriptions:** Work Sans, 16px, `--nyc-charcoal` or `--nyc-navy`

---

## 5. Page Background & Surface System

| Surface | Color | CSS Variable |
|---|---|---|
| Page body background | `#FAF8F5` | `--nyc-cream` |
| Card / modal surface | `#FFFFFF` | `--nyc-white` |
| Dropdown background | `#FFFFFF` | `--nyc-white` |
| Active filter chip | `#EAF2ED` | `--nyc-green-light` |
| Inactive filter chip | `#F5F5F5` | `--nyc-light-gray` |
| Section divider | 1px solid `#E5E5E5` | use inline or new variable |

Update `base.css`:
```css
html, body {
  background-color: var(--nyc-cream); /* was --nyc-white */
}
```

---

## 6. Component Specifications

### 6.1 Hero Section

**Reference:** ![image4](image4), ![image2](image2), ![image3](image3)

#### Layout
The hero is completely redesigned. Instead of a single full-width banner image with an overlay, it becomes a **multi-panel photo collage**:

- **Desktop:** A CSS grid of 3–4 NYC scene photos side by side, each taking roughly equal width, full viewport height (~60vh). A dark gradient overlay (`linear-gradient(to bottom, rgba(0,0,0,0.1), rgba(0,27,46,0.75))`) is applied over the entire collage.
- **Mobile:** Collapse to a single centered image with the same overlay.

#### Content (centered, over the overlay)
```
[small supertitle]  NYC SLICE OF LIFE PRESENTS
[large serif h1]    NYC Pop-Ups
[italic subtitle]   Discover the best markets, food pop-ups, art shows,
                    and experiences happening across the city
```

#### CSS Notes
- Remove `background-image: url(...)` single-image approach
- Use `display: grid; grid-template-columns: repeat(3, 1fr)` for the photo panels
- Each panel is a `<div>` with its own `background-image`; the grid container has the overlay `::after` pseudo-element
- Content sits in an absolutely positioned centered `div` with `z-index: 2`

#### Hero height
- Desktop: `60vh`, min `400px`
- Mobile: `50vh`

---

### 6.2 Search Bar

**Reference:** ![image4](image4)

A full-width search input sits **below the hero**, above the filter bar, with slight top padding on the page background.

```html
<div class="search-bar-container">
  <div class="search-bar">
    <svg class="search-icon"><!-- magnifier icon --></svg>
    <input type="text" placeholder="Search events, venues, neighborhoods..." />
  </div>
  <div class="view-toggle">
    <button class="view-toggle__btn view-toggle__btn--active">☰ List</button>
    <button class="view-toggle__btn">🗺 Map</button>
  </div>
</div>
```

#### CSS Notes
- Container: `display: flex; gap: 12px; align-items: center; padding: 24px 24px 0;`
- Input: `flex: 1; border: 1px solid --nyc-medium-gray; border-radius: --radius-pill; padding: 12px 16px 12px 44px; font-size: 16px; background: --nyc-white`
- Magnifier icon: absolutely positioned inside the input wrapper
- **List/Map toggle:**
  - Both buttons share a base style: `border: 1px solid --nyc-medium-gray; border-radius: --radius-md; padding: 10px 16px; background: --nyc-white`
  - Active button: `background: --nyc-green; color: --nyc-white; border-color: --nyc-green`
  - Inactive button: `background: --nyc-white; color: --nyc-navy`

---

### 6.3 Filter Bar

**Reference:** ![image4](image4), ![image3](image3), ![image2](image2), ![image1](image1)

A horizontal row of filter chips sitting below the search bar.

#### Filters (Pop-Ups page)
1. **Borough** — dropdown (e.g. Manhattan, Brooklyn, Queens…), with location pin icon
2. **Neighborhood** — dropdown (e.g. All Neighborhoods, Chelsea, Harlem, SoHo…)
3. **Type** — dropdown with emoji icons (All Types, 🍕 Food & Drink, 🛍️ Market, 🎨 Art & Culture, 👗 Fashion, 🧘 Wellness, 🎵 Music, ✨ Vintage & Thrift)
4. **Pick dates** — opens a dual-month date range calendar picker (see below)
5. **Clear all** — plain text button with × icon, only visible when any filter is active

#### Filter Chip Design
```css
.filter-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border: 1px solid var(--nyc-medium-gray);
  border-radius: var(--radius-pill);
  background: var(--nyc-white);
  font-size: 14px;
  font-weight: 500;
  color: var(--nyc-navy);
  cursor: pointer;
}
.filter-chip--active {
  border-color: var(--nyc-green);
  background: var(--nyc-green-light);
  color: var(--nyc-green);
}
.filter-chip .chevron { font-size: 10px; color: var(--nyc-medium-gray); }
```

#### Dropdown Design
- White card, `border-radius: --radius-md`, `box-shadow: --shadow-lg`
- Selected option: `background: --nyc-light-pink`, checkmark on right
- Emoji icons inline before option labels (for Type filter only)
- Close on outside click

#### Date Picker Calendar
- Opens as a floating card below the "Pick dates" chip
- Shows **two months side by side** (current and next)
- Navigation arrows (`<` and `>`) to move months
- Today's date: circle in `--nyc-pink`
- Selected range: `--nyc-light-pink` background
- Footer: "Clear" plain button + "Done" green button (`--nyc-green`)
- On mobile: stack months vertically

#### Results Count
Below the filter bar, a plain text line:
```html
<p class="results-count"><strong>16</strong> events found</p>
```
- Font: Work Sans, 14px, `--nyc-charcoal`
- Followed by a full-width `1px solid #E5E5E5` divider

---

### 6.4 Event Cards (List View)

**Reference:** ![image7](image7)

This is the most significant card redesign. The current horizontal tile (image-left, text-right, pink background) is replaced with a **three-column card layout**.

#### Card Structure
Each card is a `<article>` with three columns:

```
[col 1: date]  [col 2: image]  [col 3: details]
```

**Column 1 — Date Column** (~150px fixed width)
- Day name: Work Sans, 11px, `--nyc-green`, uppercase, `letter-spacing: 0.1em`
- Date number: Playfair Display or Work Sans, 48px, `--nyc-navy`, bold
- Month/year: Work Sans, 14px, `--nyc-navy`
- "through [date]" if multi-day: Work Sans, 12px, `--nyc-medium-gray`, italic
- Price badge: pill chip, `--nyc-green-light` background, `--nyc-green` text (for "Free") or `--nyc-light-gray` background, `--nyc-navy` text (for "$15–30")

**Column 2 — Image Column** (~35% of card width)
- Photo fills full column height, `object-fit: cover`
- Category tag floated over image at top-left: emoji + label, `background: rgba(255,255,255,0.92)`, `border-radius: --radius-pill`, `padding: 4px 10px`
- No border radius on image itself; the card's `border-radius` clips it

**Column 3 — Details Column** (remaining width, ~40%)
- Event title: Playfair Display, 22–28px, `--nyc-navy` (or `--nyc-green` for featured cards)
- Description: Work Sans, 14px, `--nyc-charcoal`, truncated to 3 lines (`-webkit-line-clamp: 3`)
- Location: pin icon + **venue name** (bold, `--nyc-navy`) + neighborhood/borough (`--nyc-medium-gray`, smaller)
- Time: clock icon + time range, Work Sans 14px, `--nyc-charcoal`

#### Card Background & Border
- Background: `--nyc-white`
- Border: `1px solid #EEEEEE`
- Border radius: `--radius-lg` (12px)
- Box shadow: `--shadow-sm`
- Hover: `box-shadow: --shadow-md`, very subtle `translateY(-1px)`
- **No pink backgrounds on cards** — this is a key change from the current design

#### Featured Card Variant
When a card is designated "featured" (based on a Sanity field), the image column expands to full card width, and the title is overlaid in `--nyc-green` (large serif) over a semi-transparent bottom gradient. See bottom card in ![image7](image7).

#### Cards Grouped by Month/Date
- Each group is preceded by a month heading: Playfair Display, 40px, `--nyc-navy`, followed by a `1px solid #E5E5E5` rule
- Within a month, cards are stacked vertically (single column, full width up to `--container-max-width`)

#### Responsive Behavior
- **≥1024px:** Three-column layout as described above
- **600px–1023px:** Date column shrinks to 100px; image and details stay
- **< 600px:** Date column collapses to a small top bar above the image; image full width; details below — effectively a vertical card

---

### 6.5 Event Detail Modal

**Reference:** ![image5](image5)

When a user clicks a card, a modal/panel slides in with the full event details.

#### Layout
- **Desktop:** Two-column split — left ~45% (text content), right ~55% (photo)
- **Mobile:** Single column, photo below header, content below photo

#### Header Bar
Full-width pink bar at the very top of the modal:
```css
.modal-return-bar {
  background: var(--nyc-light-pink);
  padding: 12px 20px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: var(--nyc-fuschia);
  font-weight: 600;
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
}
```
Content: `← Return to all pop-ups` (or appropriate page label)

#### Left Panel Content (top to bottom)
1. **Category tag** + **price/free tag** — pill badges side by side
2. **Event title** — Playfair Display, ~36px, `--nyc-navy`
3. **Date & time** — Work Sans, 16px, `--nyc-charcoal`
4. `---` divider
5. **Location** — pin icon + venue name (bold) + full address, `--nyc-charcoal`
6. `---` divider
7. **Description** — Work Sans, 16px, full text, `--nyc-charcoal`
8. `---` divider
9. **"Add to Calendar:"** label + "Add to Google Calendar" fuchsia link
10. **"Share Event"** button — outlined button, share icon, `--nyc-navy` border and text

#### Right Panel
- Full-height photo, `object-fit: cover`, fills the panel
- `border-radius: 0 var(--radius-lg) var(--radius-lg) 0` on desktop
- On mobile, full width, fixed aspect ratio (~16:9)

#### Modal Overlay
- `rgba(0,0,0,0.5)` — lighter than current `rgba(0,0,0,0.8)`
- Modal card: `border-radius: --radius-lg`, `max-width: 900px`, `width: 95vw`

---

### 6.6 Map View

**Reference:** ![image6](image6)

Toggled by the "Map" button in the search bar area. Replaces the card list entirely when active.

#### Implementation
- Use **Leaflet.js** (CDN, no build step required)
- Map fills the content area below the filter bar: `width: 100%; height: calc(100vh - 300px); min-height: 500px`
- Tile layer: OpenStreetMap (free, no API key)

#### Pins
- Each event gets a pin at its coordinates (lat/lng stored in Sanity)
- Pin style: emoji character in a circular div, colored by event type:
  - 🍕 Food & Drink — orange
  - 🛍️ Market — green
  - 🎨 Art & Culture — purple
  - 👗 Fashion — pink
  - 🧘 Wellness — teal
  - 🎵 Music — blue
  - ✨ Vintage & Thrift — yellow

#### Legend
- Floating card in top-left of the map (Leaflet custom control)
- Title: "Event Types"
- Two-column grid of color dot + label rows
- Background: white, `border-radius: --radius-md`, `box-shadow: --shadow-md`

#### Clicking a Pin
Opens the same event detail modal as clicking a list card.

#### Filter Integration
The same filter bar (borough, neighborhood, type, dates) should filter map pins in real time, same as the list view.

---

### 6.7 Header & Navigation

The header design is largely retained but with these refinements:

- **Background:** Keep `--nyc-white` (so it stands out from `--nyc-cream` page bg)
- **Border bottom:** Add `1px solid #EEEEEE` — replace the current `box-shadow` only
- **Site title font:** Change to Playfair Display, ~20px, `--nyc-navy`
- **Nav links:** Keep Work Sans, 16px; active page link gets `color: --nyc-green; font-weight: 600` instead of fuchsia
- **Mobile menu:** No design change needed; keep existing collapsible full-screen overlay

---

### 6.8 Footer

The footer is largely retained. Minor refinements:

- **Top border:** Change from `4px solid --nyc-fuschia` to `3px solid --nyc-green` — aligns with the new interactive accent color
- **Background:** Keep `--nyc-navy`
- **Link hover color:** Keep `--nyc-fuschia`
- No structural changes needed

---

### 6.9 Buttons

Update `resources/css/buttons.css`:

| Button Type | Current | New |
|---|---|---|
| Primary `.btn` | Pink bg, fuchsia text | `--nyc-green` bg, white text |
| Primary `.btn:hover` | Fuchsia bg, white text | `--nyc-green-hover` bg, white text |
| Secondary `.secondary-btn` | Fuchsia bg, white text | Outlined: white bg, `--nyc-green` border and text |
| Secondary `.secondary-btn:hover` | Pink bg, fuchsia text | `--nyc-green-light` bg, `--nyc-green` text |
| List/Map toggle active | N/A (new) | `--nyc-green` bg, white text |
| List/Map toggle inactive | N/A (new) | `--nyc-white` bg, `--nyc-navy` text, gray border |
| "Share Event" | N/A (new) | Outlined: white bg, `--nyc-navy` border, `--nyc-navy` text |

> **Note:** The pink button system is retired as a primary action style. Pink is now a background/highlight color only, not a button color. This is the second biggest visual change after the typography.

---

## 7. Page-by-Page Specifications

### 7.1 Pop-Ups Page (`pop-ups.html`)

**New layout (top to bottom):**
1. Header (unchanged structure)
2. Hero — collage grid with "NYC SLICE OF LIFE PRESENTS / NYC Pop-Ups" overlay
3. Search bar + List/Map toggle
4. Filter bar (Borough, Neighborhood, Type, Pick dates, Clear all)
5. Results count + divider
6. **List view:** Cards grouped by month, or **Map view:** Leaflet map
7. Footer

**New CSS file needed:** `resources/css/filters.css` (filter bar, chips, dropdowns, date picker)
**New CSS file needed:** `resources/css/map.css` (map container, legend, pin styles)
**New JS file needed:** `resources/js/filters.js` (filter logic, search, List/Map toggle)
**New JS file needed:** `resources/js/map.js` (Leaflet init, pin rendering, filter integration)
**Updated CSS:** `resources/css/popups.css` (card redesign), `resources/css/hero.css` (collage hero), `resources/css/modals.css` (modal redesign)

---

### 7.2 Date Ideas Page (`date-ideas.html`)

Apply the same design language. Date ideas are evergreen (not date-bound) so the layout adapts:

**New layout (top to bottom):**
1. Header
2. Hero — collage grid with "NYC SLICE OF LIFE PRESENTS / Date Ideas" overlay (different photos — romantic/activity NYC scenes)
3. Search bar (no List/Map toggle — map doesn't apply here)
4. Filter bar — adapted for date ideas:
   - **Vibe** dropdown (e.g. Romantic, Adventurous, Chill, Foodie, Cultural, Free)
   - **Budget** dropdown (e.g. Free, Under $30, $30–$75, $75+)
   - **Neighborhood** dropdown (same as pop-ups)
   - Clear all
5. Results count + divider
6. Date idea cards — same three-column layout as pop-up cards, but:
   - **No date column** — replace with a "Vibe" icon/label column (e.g. 🌹 Romantic)
   - Image column and details column unchanged
7. Footer

**Files to update:** `resources/css/date_ideas.css`, `resources/css/hero.css`
**Files to create:** Filters logic can be shared from `resources/js/filters.js` (parameterize for page type)

---

### 7.3 Home Page (`index.html`)

The home page gets the same visual language but remains a hub/landing page rather than a browsable list.

**New layout (top to bottom):**
1. Header
2. Hero — collage grid with "NYC SLICE OF LIFE PRESENTS / NYC Slice of Life" as the brand statement, subtitle: "Your guide to the city's best pop-ups, date ideas, and weekend plans"
3. **Quick navigation** — replace current pink button grid with three editorial card-style links:
   - "NYC Pop-Ups" — with a representative photo, short descriptor, green arrow CTA
   - "Date Ideas" — same treatment
   - "Substack Newsletter" — same treatment
   - These should be `display: grid; grid-template-columns: repeat(3, 1fr)` on desktop, stacked on mobile
4. **Featured Pop-Ups carousel** — keep existing carousel but restyle: white cards, Playfair Display titles, green "View all" link header. Remove pink tile backgrounds.
5. **Social / Stay Connected** — keep section, restyle: remove emoji decorations from h2, use cleaner icon layout
6. Footer

**Files to update:** `resources/css/hero.css`, `resources/css/buttons.css`, `resources/css/carousel.css`

---

## 8. CSS Variable Updates

Add/update the following in `:root` in `resources/css/base.css`:

```css
:root {
  /* --- UPDATED/NEW COLOR VARIABLES --- */
  --nyc-cream: #FAF8F5;          /* NEW: page body background */
  --nyc-green: #2D6A4F;          /* NEW: primary interactive accent */
  --nyc-green-light: #EAF2ED;    /* NEW: active chip background, free badge bg */
  --nyc-green-hover: #235A40;    /* NEW: green button hover */
  --nyc-section-divider: #E5E5E5;/* NEW: horizontal rule between sections/cards */

  /* --- UPDATED FONT FAMILY --- */
  /* Primary display font is now Playfair Display (loaded via Google Fonts) */
  /* --nyc-font-display: 'Playfair Display', Georgia, serif; */
  /* --nyc-font-body: 'Work Sans', Arial, sans-serif; */
}
```

---

## 9. New CSS Files Needed

| File | Purpose |
|---|---|
| `resources/css/filters.css` | Filter bar, filter chips, dropdowns, date range picker |
| `resources/css/map.css` | Leaflet map container, legend, pin styles, map/list toggle |
| `resources/css/search.css` | Search bar container, input field, view toggle buttons |

These should be `<link>`ed in the relevant HTML pages only (e.g. `filters.css` and `map.css` only on `pop-ups.html` and `date-ideas.html`).

---

## 10. Implementation Notes for Agents

The following notes are specifically for AI coding agents implementing changes from this guide:

1. **Read the existing file before editing it.** All CSS files use CSS custom properties from `base.css`. Never hardcode hex values — always use the variable names defined in Section 8.
2. **Do not break existing variable names.** Only add new variables; do not rename or remove existing ones without updating all references.
3. **The card redesign in `popups.css` and `date_ideas.css` is a full replacement**, not an incremental edit. The `.popup-tile` BEM structure will be replaced with a new three-column `.event-card` component.
4. **Hero redesign requires both HTML and CSS changes.** The single `<section class="hero">` with a `background-image` needs to become a multi-panel grid. The HTML structure in each page's hero section must be updated.
5. **Google Fonts `<link>` tags appear in every HTML file individually** (not loaded via a partial). The font swap from Montserrat to Playfair Display must be applied to all HTML files: `index.html`, `pop-ups.html`, `date-ideas.html`, `pop-up.html`, `date-idea.html`, `calendar.html`, `about.html`, `contact_us.html`, `privacy_policy.html`.
6. **Leaflet.js** should be loaded via CDN `<script>` and `<link>` tags added to `pop-ups.html` only. The Leaflet CSS must be loaded before `map.css`.
7. **Sanity data already flows through `sanity-client.js` and `sanity-queries.js`.** Filter logic in `filters.js` should call the existing query functions and pass filter parameters, rather than re-fetching from scratch.
8. **Test at 375px, 768px, and 1280px** after any change. The three-column card layout must degrade gracefully at all widths per Section 6.4.
9. **Do not modify `partials/` HTML files** unless the task explicitly requires header or footer changes.
10. **The `home-menu` section in `index.html`** (the three pink navigation buttons) should be replaced as part of the home page redesign only — do not remove it until the new editorial card grid is in place.
