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
- [Coding standards](docs/standards.md)
- [Rollback and recovery](docs/rollback-and-recovery.md)
- [Security policy](.github/SECURITY.md)
- [CI/CD checklist](.github/CICD-CHECKLIST.md)
