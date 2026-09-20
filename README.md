# ShortcutKeyWala

> **A free, open-source keyboard shortcuts reference. Discover shortcuts and work faster.**

[🌐 **Live Website**](https://oxanuragofficial.github.io/shortcutkeywala1/)
[📦 **Source Code**](https://github.com/oxanuragofficial/shortcutkeywala1)
[📄 **License: MIT**](./LICENSE)

## What's in it

These numbers are computed at runtime from the actual database (`data.js`) — you can verify them yourself by running `node scripts/validate-data.js`, or by checking the live site's header/footer, which read the same source.

| | |
|---|---|
| **Shortcuts** | 362 |
| **Applications** | 10 |
| **Platforms** | 3 (Windows, macOS, Linux) |

Covered applications: Windows OS, macOS, Ubuntu/Linux, Microsoft Outlook, Excel, Word, PowerPoint, Figma, VS Code, and Web Browsers.

**Terminal / shell commands are not yet implemented.** This is a planned feature — see [Roadmap](#-roadmap) below. Any reference to terminal commands elsewhere is aspirational, not current functionality.

## ✨ Features

* 🔎 Command-palette style global search (press `/` or click the search bar anywhere) with keyboard navigation
* 🖥️ Filter by platform (Windows / macOS / Linux), application, and category, with active-filter chips and a one-click "Clear all"
* ↕️ Sort shortcuts (most useful / alphabetical / by category)
* ⌨️ Individual keycap rendering for every shortcut (e.g. `Ctrl` `Shift` `P` as separate keys, not one text blob), with correct macOS symbols (⌘ ⌥ ⇧)
* 🌗 Light / dark theme toggle
* ⭐ Favorites — save shortcuts locally (no account) and browse them in a dedicated Favorites view
* 📋 One-click copy for shortcut key combinations
* 📚 Companion blog guides for Excel, Outlook, VS Code, Photoshop, Windows 11, and macOS — with a table of contents, related articles, and prev/next navigation on longer guides
* 📱 Responsive layout for desktop, tablet, and mobile
* ⚡ No build step, no backend, no login — static HTML/CSS/JS

## 🛠️ Built With

Plain HTML5, CSS3, and vanilla JavaScript. No framework, no bundler, no server. The whole site is a static page (`index.html`) plus a data file (`data.js`) and app logic (`app.js`), deployed as-is via GitHub Pages.

## 📂 Project Structure

```
shortcutkeywala/
├── index.html           # App shell (SPA, client-side rendered)
├── app.js               # Rendering, search, filters, favorites, theme logic
├── data.js              # SHORTCUTS_DB — the shortcut database
├── style.css            # All styling
├── manifest.json        # PWA manifest
├── icon.svg / images/   # Icons (favicon + PWA icons)
├── blog*.html            # Standalone blog/guide pages
├── 404.html              # Custom 404 page
├── sitemap.xml / robots.txt
├── scripts/
│   └── validate-data.js  # Validates data.js: required fields, duplicate detection, real counts
└── LICENSE               # MIT
```

## 🤝 Contributing

1. Fork the repo and clone it locally — no install step is required to preview it; just open `index.html` in a browser, or serve the folder with any static file server.
2. To add or edit shortcuts, edit the relevant app entry in `data.js`. Each shortcut needs `keys`, `action`, `category`, and `description` at minimum.
3. Before opening a pull request, run the data validator:
   ```
   node scripts/validate-data.js
   ```
   It checks for missing required fields and duplicate shortcuts within an app, and prints the real computed counts. It must pass (exit code 0) for your change to be merged.
4. Open a pull request describing what you added or fixed.

Please don't inflate shortcut counts or add speculative/unverified entries — accuracy matters more than volume here.

## 🔮 Roadmap

Not yet built, listed honestly as future work rather than existing features:

* Terminal command reference (Windows CMD, PowerShell, Bash, macOS Terminal)
* Per-shortcut and per-command dedicated pages/URLs
* Automated tests and CI
* Distinct page-type layouts for platform pages, blog listing, and blog articles (currently share the general design system but not yet a purpose-built layout each)
* Mobile filter drawer (bottom sheet) — the markup/CSS exists but isn't wired up to any view yet; mobile currently uses the same inline filters as desktop
* Broader platform coverage for apps that currently only have Windows-flavored shortcuts (Excel, Word, VS Code, Figma, Browsers, Outlook, PowerPoint) — e.g. a macOS-specific VS Code shortcut set
* Full accessibility audit and visual QA across all breakpoints (not yet performed with real browser/visual tooling)

## 👨‍💻 Developer

**Anurag Kumar** — Web Developer & Builder
[GitHub](https://github.com/oxanuragofficial)

## 📄 License

MIT — see [LICENSE](./LICENSE). Shortcut key combinations themselves belong to their respective applications; this project just documents them.

---

### ⌨️ Learn shortcuts. Work faster.

**ShortcutKeyWala**
