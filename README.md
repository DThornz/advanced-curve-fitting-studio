# Website Page Template

**Author:** Asad Mirza (DThornz)

A reusable starting point for new pages on the [dthornz.github.io](https://dthornz.github.io/website-cv-tools/) portfolio. Drop in this folder, fill in the `TODO` markers, and the page will match the shared visual style across all projects.

---

## What's included

| File | Purpose |
|---|---|
| `index.html` | Full page scaffold — nav, hero, sections, callouts, equation blocks, parameter table, references, and accessibility panel. Every placeholder is marked with a `<!-- TODO: ... -->` comment. |
| `style.css` | All shared styles: CSS variables, typography (DM fonts), sticky nav with dropdown, hero, section headings, callout boxes (teal & amber), equation display, parameter table, references list, accessibility panel, font/size variants, dark mode. |
| `script.js` | Accessibility panel logic (dark mode, font size, font style — all persisted to `localStorage`). Add any page-specific JavaScript below the comment at the bottom of the file. |
| `LICENSE.md` | Research-use-only license (Asad Mirza, 2026). |

---

## How to use

### 1. Copy and rename

Clone or download this repo, or copy the folder contents into a new project directory.

### 2. Work through the `TODO` comments

Open `index.html` and search for `TODO`. Each one tells you exactly what to replace:

| TODO location | What to change |
|---|---|
| `<title>` | Page title |
| `hero-kicker` | Category / domain label (e.g. "Interactive Computational Physics") |
| `hero-title` | Page title, use `<br>` for a two-line break |
| `hero-sub` | One or two sentence description |
| `hero-pills` | Keyword tags |
| `hero-meta` | 3–4 headline numbers with labels |
| Nav dropdown | Add this page's entry; mark it `curr`; add to every other page's dropdown too |
| `§1 Background` | Introductory text and teal callout |
| `§2 Formulation` | Equations, parameter table |
| `§3 Method` | Algorithm description, amber callout |
| `§4 Demo` | Replace the placeholder `<div>` with your simulator, canvas, or widget |
| References | Real citations |

### 3. Add page-specific JavaScript

Place your JS at the bottom of `script.js`, inside the IIFE, below the `// ── Page-specific JS goes below` comment.

### 4. Update all other pages' nav dropdowns

Every project page shares the same nav dropdown. When you add a new page, add its entry to the dropdown in every other project's `index.html` as well so the navigation stays consistent.

---

## Design system at a glance

| Token | Value |
|---|---|
| Primary colour | `#0b7a6e` (teal) |
| Warning colour | `#b45309` (amber) |
| Body font | DM Sans |
| Display font | DM Serif Display |
| Mono font | DM Mono |
| Max content width | 1040 px |
| Dark mode | `body.dark-mode` class, toggled via localStorage |

### Component classes

```
.hero / .hero-kicker / .hero-title / .hero-sub / .hero-pills / .pill / .hero-meta
.section / .section-num / .section-title / .section-body / .section-divider
.callout / .callout-amber / .callout-title
.eq-block / .eq-row / .eq-label / .eq-main / .eq-comment / .eq-sep / .eq-note
.param-table
.ref-list / .ref-item / .ref-num
.acc-btn / .acc-panel  (accessibility gear — always keep these)
```

---

## Math rendering (KaTeX)

The template ships with KaTeX pre-wired. Use `$...$` for inline math and `$$...$$` for display math anywhere in the page body. If the page has no math, remove the two KaTeX `<link>` and `<script>` lines from the `<head>`.

---

## License

Research use only. See [LICENSE.md](LICENSE.md) for full terms.  
Copyright © 2026 Asad Mirza. All rights reserved.
