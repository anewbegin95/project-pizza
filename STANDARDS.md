# Project Pizza Code Conventions & Naming Standards

## Table of Contents
1. General Principles
2. CSS Naming Conventions
3. JavaScript Naming Conventions
4. HTML Structure
5. File & Folder Organization
6. Best Practices

---

## General Principles

- Be descriptive and consistent.
- Prefer clarity over brevity.
- Use lowercase and hyphens for CSS classes.
- Use camelCase for JavaScript variables and functions.
- Comment complex or non-obvious code.

---

## CSS Naming Conventions

- **BEM-like structure:**  
  `.block__element--modifier` (e.g., `.event-tile__title--highlighted`)
- **Component/section prefixes:**  
  `.calendar-event-bar`, `.event-detail-image--mobile`
- **Hyphenated lowercase:**  
  `.main-nav`, `.hero-content`
- **Utility/state classes:**  
  `.hidden`, `.active`, `.modal-open`
- **CSS variables:**  
  Use `--nyc-*` for colors, `--space-*` for spacing.

**Example:**
```css
.event-tile { ... }
.event-tile__title { ... }
.event-tile--featured { ... }
```

---

## JavaScript Naming Conventions

- **camelCase** for variables and functions:  
  `renderEventTile`, `eventList`, `getMaxVisible`
- **PascalCase** for classes and constructors:  
  `EventTile`, `CalendarGrid`
- **Constants in UPPER_SNAKE_CASE**:  
  `GOOGLE_SHEET_CSV_URL`
- **Descriptive function names:**  
  `parseEventDate`, `formatEventDate`

---

## HTML Structure

- Use semantic elements: `<main>`, `<section>`, `<header>`, `<footer>`, `<nav>`.
- Use class names that match your CSS conventions.
- Avoid using IDs for styling; reserve for JS hooks or unique elements.

---

## File & Folder Organization

- Group related files by feature or type (e.g., `js/`, `css/`, `images/`).
- Use descriptive file names:  
  `event-details.js`, `calendar.js`, `style.css`
- Place documentation in `docs/` or at the project root.

---

## Best Practices

- **Comment sections and complex logic.**
- **Keep CSS DRY:** Use variables and utility classes.
- **Accessibility:** Use proper labels, alt text, and keyboard navigation.
- **Responsiveness:** Use mobile-first breakpoints and test on multiple devices.
- **Refactor regularly:** Remove unused code and keep styles modular.

---

Feel free to expand or modify this guide as your project evolves!
