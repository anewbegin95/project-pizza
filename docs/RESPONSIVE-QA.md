# Responsive Design Standards & QA Checklist

> **Purpose:** This document defines the responsive breakpoints, expected behaviors, and a reusable QA checklist for all redesign components. All PRs that touch UI must reference this standard. See [REDESIGN.md](/REDESIGN.md) for full component specifications.

---

## Table of Contents

1. [Breakpoint Definitions](#breakpoint-definitions)
2. [Component Responsive Behavior](#component-responsive-behavior)
3. [PR QA Checklist](#pr-qa-checklist)

---

## Breakpoint Definitions

The site follows a **mobile-first** approach. Base styles target the smallest viewport and are progressively enhanced with `min-width` media queries.

| Breakpoint | Range | Target Device | Role |
|---|---|---|---|
| **Mobile** | 0–599px | Phones (reference: 375px) | Base styles; single-column layouts |
| **Tablet** | 600px–1023px | Tablets / small laptops (reference: 768px) | Transitional multi-column where appropriate |
| **Desktop** | 1024px–1279px | Standard laptops | Full multi-column layouts |
| **Wide Desktop** | 1280px+ | Large monitors (reference: 1280px) | Max-width containers; no further expansion |

### Key Width Values

| Token | Value | Usage |
|---|---|---|
| `--container-max-width` | 1200px | Max content width on wide screens |
| `--section-max-width` | 900px | Max width for narrower content sections |

### CSS Media Query Convention

```css
/* Mobile-first: base styles apply at 0px+ */

/* Tablet and up */
@media (min-width: 600px) { /* ... */ }

/* Desktop and up */
@media (min-width: 1024px) { /* ... */ }

/* Wide desktop */
@media (min-width: 1280px) { /* ... */ }
```

> **Legacy note:** Some existing CSS uses `max-width` queries (e.g., `max-width: 900px`, `max-width: 700px`). New redesign code should prefer the `min-width` mobile-first approach above. Existing breakpoints at `600px`, `800px`, `900px`, and `975px` remain valid for legacy components until they are fully redesigned.

---

## Component Responsive Behavior

### Hero Section

| Viewport | Behavior |
|---|---|
| Mobile (<600px) | Height: `50vh`; single background panel; overlay text centered |
| Tablet (600–1023px) | Height: `55vh`; collage grid may show 2 panels |
| Desktop (1024px+) | Height: `60vh`, min `400px`; three-panel collage grid (`grid-template-columns: repeat(3, 1fr)`) |

### Search Bar

| Viewport | Behavior |
|---|---|
| Mobile (<600px) | Full width; List/Map toggle buttons stack below search input |
| Tablet (600–1023px) | Full width; toggle buttons inline with input |
| Desktop (1024px+) | `display: flex; gap: 12px; align-items: center`; toggle buttons inline |

### Filter Bar

| Viewport | Behavior |
|---|---|
| Mobile (<600px) | Chips wrap to multiple rows; date picker months stack vertically |
| Tablet (600–1023px) | Chips in a single scrollable/wrapping row |
| Desktop (1024px+) | Horizontal row of chips; date picker shows two months side by side |

### Event Cards (List View)

| Viewport | Behavior |
|---|---|
| Mobile (<600px) | Vertical card — date bar on top, full-width image below, details below image |
| Tablet (600–1023px) | Three-column layout with date column shrunk to 100px |
| Desktop (≥1024px) | Full three-column layout (date | image | details) |

### Event Detail Modal

| Viewport | Behavior |
|---|---|
| Mobile (<600px) | Single column; photo below header; content below photo; full-width image at ~16:9 aspect ratio |
| Tablet (600–1023px) | Single column or narrow two-column split |
| Desktop (1024px+) | Two-column split — left ~45% text, right ~55% photo; `max-width: 900px` |

### Map View

| Viewport | Behavior |
|---|---|
| Mobile (<600px) | Map fills viewport width; legend collapses to a toggle button; min-height: 400px |
| Tablet (600–1023px) | Map fills content area; legend visible as floating card |
| Desktop (1024px+) | `width: 100%; height: calc(100vh - 300px); min-height: 500px`; legend in top-left |

### Calendar Page

| Viewport | Behavior |
|---|---|
| Mobile (<600px) | Single-column day view; calendar navigation simplified |
| Tablet (600–1023px) | Calendar grid visible; events listed below selected date |
| Desktop (1024px+) | Full month grid with inline event previews |

### Home Page Blocks (Quick Navigation)

| Viewport | Behavior |
|---|---|
| Mobile (<600px) | Stacked single column; cards full width |
| Tablet (600–1023px) | Two-column grid or stacked depending on card count |
| Desktop (1024px+) | `grid-template-columns: repeat(3, 1fr)`; editorial card links side by side |

### Header & Navigation

| Viewport | Behavior |
|---|---|
| Mobile (<600px) | Hamburger menu; full-screen overlay on open |
| Tablet (600–1023px) | Hamburger or condensed nav depending on link count |
| Desktop (1024px+) | Full horizontal nav links visible |

### Footer

| Viewport | Behavior |
|---|---|
| Mobile (<600px) | Stacked layout; links in single column |
| Tablet (600–1023px) | Two-column footer grid |
| Desktop (1024px+) | Multi-column footer; full-width top border |

### Supporting Pages (About, Contact, Privacy Policy)

| Viewport | Behavior |
|---|---|
| Mobile (<600px) | Single column; text centered; images stack above text |
| Tablet (600–1023px) | Single column with wider max-width |
| Desktop (1024px+) | `flex` row layout (image + text side by side) with `max-width: --section-max-width` |

---

## PR QA Checklist

Copy this checklist into any PR that modifies UI or CSS. All items must pass before merge.

```markdown
### Responsive QA Checklist

**Test Viewports:**
- [ ] Mobile: 375px width (Chrome DevTools iPhone SE / similar)
- [ ] Tablet: 768px width (Chrome DevTools iPad / similar)
- [ ] Desktop: 1280px width (standard browser window)

**General Checks (all viewports):**
- [ ] No horizontal scrollbar appears
- [ ] Text is readable without zooming
- [ ] Touch targets are at least 44×44px on mobile
- [ ] Images scale proportionally (no distortion or overflow)
- [ ] Interactive elements (buttons, links, inputs) are reachable and usable
- [ ] Modals/overlays are dismissible and don't overflow the viewport
- [ ] No content is cut off or hidden unintentionally

**Mobile-specific (375px):**
- [ ] Layouts are single-column where specified
- [ ] Navigation collapses to hamburger menu
- [ ] Cards display in vertical/stacked format
- [ ] Filter chips wrap; date picker months stack vertically
- [ ] Hero is at `50vh` height
- [ ] Modal is single-column with photo below header

**Tablet-specific (768px):**
- [ ] Multi-column layouts transition correctly
- [ ] Cards show transitional layout (reduced date column)
- [ ] Filter bar chips fit in one row or scroll horizontally
- [ ] Map legend is visible as a floating card

**Desktop-specific (1280px):**
- [ ] Content respects max-width constraints (`--container-max-width`)
- [ ] Three-column card layout renders correctly
- [ ] Hero shows three-panel collage at `60vh`
- [ ] Two-column modal layout renders (text left, photo right)
- [ ] Navigation shows all links horizontally
- [ ] Home page quick-nav shows three cards in a row

**Accessibility:**
- [ ] Focus states visible on all interactive elements
- [ ] Color contrast meets WCAG AA (4.5:1 for text)
- [ ] Screen reader can navigate the layout logically
- [ ] No keyboard traps in modals or dropdowns
```

---

## Usage in PRs

Reference this document when opening or reviewing PRs:

```
Per [docs/RESPONSIVE-QA.md](/docs/RESPONSIVE-QA.md), tested at 375px / 768px / 1280px.
```

---

## Relationship to REDESIGN.md

This document complements [REDESIGN.md](/REDESIGN.md):

- **REDESIGN.md** defines _what_ each component looks like and its responsive behavior in prose
- **This document** defines _how_ to verify responsive behavior consistently and provides concrete breakpoints, a testing protocol, and a copy-paste checklist

Both documents align on the mobile-first principle (REDESIGN.md §1: "Mobile-first — all layouts must be responsive; the card and filter designs must work at 375px width").
