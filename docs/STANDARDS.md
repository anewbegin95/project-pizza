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
  `.block__element--modifier` (e.g., `.popup-tile__title--highlighted`)
- **Component/section prefixes:**  
  `.calendar-popup-bar`, `.popup-detail-image--mobile`
- **Hyphenated lowercase:**  
  `.main-nav`, `.hero-content`
- **Utility/state classes:**  
  `.hidden`, `.active`, `.modal-open`
- **CSS variables:**  
  Use `--nyc-*` for colors, `--space-*` for spacing.

**Example:**
```css
.popup-tile { ... }
.popup-tile__title { ... }
.popup-tile--featured { ... }
```

---

## JavaScript Naming Conventions

- **camelCase** for variables and functions:  
  `renderPopupTile`, `popupList`, `getMaxVisible`
- **PascalCase** for classes and constructors:  
  `PopupTile`, `CalendarGrid`
- **Constants in UPPER_SNAKE_CASE**:  
  `POPUPS_QUERY`
- **Descriptive function names:**  
  `parsePopupDate`, `formatPopupDate`

---

## HTML Structure

- Use semantic elements: `<main>`, `<section>`, `<header>`, `<footer>`, `<nav>`.
- Use class names that match your CSS conventions.
- Avoid using IDs for styling; reserve for JS hooks or unique elements.

---

## File & Folder Organization

- Group related files by feature or type (e.g., `js/`, `css/`, `images/`).
- Use descriptive file names:  
  `pop-up-details.js`, `calendar.js`, `style.css`
- Place documentation in `docs/` or at the project root.

---

## Best Practices

- **Comment sections and complex logic.**
- **Keep CSS DRY:** Use variables and utility classes.
- **Accessibility:** Use proper labels, alt text, and keyboard navigation.
- **Responsiveness:** Use mobile-first breakpoints and test on multiple devices.
- **Refactor regularly:** Remove unused code and keep styles modular.

---

## Lint Enforcement (CI)

The CI pipeline enforces a subset of these standards automatically via Stylelint:

- Class naming pattern (lowercase-hyphen with optional BEM `__element` and `--modifier`)
- CSS custom property prefixes (`--nyc-*`, `--space-*`, `--font-*`, `--shadow-*`, `--radius-*`, `--container-*`, `--section-*`, `--carousel-*`)
- Core CSS safety checks (invalid hex, duplicate selectors, duplicate properties, empty blocks)

Some standards are still guidance-only (not strict lint failures yet), such as file organization and comments.

---

Feel free to expand or modify this guide as your project evolves!
