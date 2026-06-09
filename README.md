# NYC Slice of Life 🍕

Welcome to the official website of **NYC Slice of Life**, a project that chronicles New York City’s best pop-ups, hidden gems, and stories — all through the lens of an NYC pop-up lover.

Follow the journey on [Instagram](https://www.instagram.com/nycsliceoflife/) 🍕📸

---

## 🚀 About This Website

This site expands on the *NYC Slice of Life* Instagram experience with a more interactive and informative hub. Built from scratch by [Alex](https://github.com/anewbegin95), the site currently features:

### 🧭 Pages
- **Home Page**: The main hub — links to blog posts, featured pop-ups, and recent highlights.  
- **About Me Page**: A look into the founder's story, her love for NYC pop-ups, and why this account exists.  
- **Calendar Page**: A living calendar of NYC pop-up-related events — from grand openings to pop-ups.

Future plans include:
- TBD!

---

## 🛠️ Tech Stack

- HTML, CSS, and JavaScript (vanilla to start)
- Git & GitHub for version control
- GitHub Pages for hosting and deployment

---

## 📦 Local Development

To get started locally:

```bash
# Clone the repo
git clone https://github.com/yourusername/project-pizza.git

# Move into the project folder
cd project-pizza

# Open index.html directly in your browser, or serve it locally:
npx serve .
```

---

## 🚩 Redesign Feature Flag Rollout

The redesign is gated by `resources/js/redesign-flag.js` and is **OFF by default**.

### Default behavior by environment

| Environment | Hostname | Default |
| --- | --- | --- |
| development | `localhost`, `127.0.0.1` | OFF |
| staging | `staging.nycsliceoflife.com` | OFF |
| production | `nycsliceoflife.com`, `www.nycsliceoflife.com` | OFF |

### Config-based enablement

Load a separate config script before `resources/js/redesign-flag.js`:

```javascript
// resources/js/redesign-config.js
window.REDESIGN_CONFIG = { enabled: true };
```

```html
<script src="resources/js/redesign-config.js"></script>
<script src="resources/js/redesign-flag.js"></script>
```

You can also set per-environment defaults:

```javascript
// resources/js/redesign-config.js
window.REDESIGN_CONFIG = {
  redesignByEnv: { development: true, staging: false, production: false }
};
```

```html
<script src="resources/js/redesign-config.js"></script>
<script src="resources/js/redesign-flag.js"></script>
```

### QA URL override

Use query params for temporary QA validation without changing config:

- `?redesign=on` → force ON
- `?redesign=off` → force OFF

URL override always wins over environment/config defaults.

---

## 🔒 Security + CI/CD Automation

GitHub Actions now enforces branch-specific quality gates:

### `staging` integration gate
- Sanity Studio build verification (`sanity/npm run build`)
- CSS lint (Stylelint)
- HTML lint (HTMLHint)
- Unit tests (Vitest)
- Broken link/internal asset checks (Lychee)
- Lighthouse CI assertions (performance, accessibility, best practices, SEO)
- E2E smoke tests (Playwright)
- Dependency Review, ESLint, `npm audit`, Gitleaks, and optional Snyk

### `main` deployment gate
- Pre-merge checks on PRs to `main` (build + smoke tests)
- Post-merge deployment health checks against production URLs
- Manual rollback automation via GitHub Actions workflow

Dependabot (`.github/dependabot.yml`) remains enabled for weekly npm updates in `sanity/`.

---

## 📚 Project Documentation

- [Documentation index](docs/README.md)
- [Coding standards](docs/STANDARDS.md)
- [Rollback and recovery](docs/rollback-and-recovery.md)
- [Security policy](.github/SECURITY.md)
- [CI/CD checklist](.github/CICD-CHECKLIST.md)
