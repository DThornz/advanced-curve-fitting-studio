# Advanced Curve Fitting Studio

**Author:** Asad Mirza (DThornz)  
**Live:** [dthornz.github.io/Advanced-Curve-Fitting-Studio](https://dthornz.github.io/Advanced-Curve-Fitting-Studio/) *(enable GitHub Pages — see below)*

A browser-native, fully offline curve fitting and nonlinear regression platform — inspired by MATLAB's Curve Fitting App, built for scientists, engineers, and researchers.

---

## Features

| Capability | Detail |
|---|---|
| **16+ built-in models** | Linear, Polynomial (2–6), Exponential, Exp Decay + Offset, Logistic/Sigmoid, Gaussian Peak, Lorentzian, Michaelis-Menten, Hill, Sinusoidal, Damped Sinusoid, Weibull CDF, Custom |
| **Fitting algorithms** | Levenberg-Marquardt (nonlinear); analytic normal equations (polynomial) |
| **Custom equations** | Any Math.js expression in `x`; parameters auto-detected |
| **Auto initial guesses** | Heuristics per model (amplitude, frequency, decay rate, etc.) |
| **Fit diagnostics** | R², Adjusted R², RMSE, SSE, AIC, BIC, parameter std errors |
| **Interactive plots** | Plotly.js scatter + fit curve overlay; residual subplot; zoom/pan/hover |
| **Residual analysis** | Live residual plot toggled with one click |
| **Log axes** | Toggle log X / log Y independently |
| **Data import** | CSV/TSV/TXT file upload, drag-and-drop onto plot, paste from clipboard |
| **Example datasets** | 6 built-in examples (radioactive decay, Gaussian peak, enzyme kinetics, etc.) |
| **Export** | Plot as PNG or SVG; fit results as CSV; full fit report as TXT |
| **Session persistence** | Save and reload workspace via browser `localStorage` |
| **100% local** | No server, no cloud, no telemetry — all computation in the browser |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Language | Vanilla HTML5 / CSS3 / ES2020 JavaScript |
| Plots | [Plotly.js 2.27](https://plotly.com/javascript/) (CDN) |
| Equation parser | [Math.js 12.4](https://mathjs.org) (CDN) |
| Math rendering | [KaTeX 0.16](https://katex.org) (CDN) |
| Fonts | DM Sans, DM Mono, DM Serif Display (Google Fonts) |
| Hosting | GitHub Pages (static — no build step) |

---

## Running Locally

Just open `index.html` in a browser:

```bash
# Option 1: Open directly
start index.html

# Option 2: Simple local server (avoids any CORS edge-cases)
python -m http.server 8080
# then open http://localhost:8080
```

No `npm install`, no build step, no dependencies to install.

---

## Enabling GitHub Pages

1. Go to **Settings → Pages** in this repository.
2. Under **Source**, select `Deploy from a branch`.
3. Set **Branch** to `master` (or `main`) and folder to `/ (root)`.
4. Click **Save**. GitHub Pages will deploy the site within ~1 minute.
5. The live URL will be `https://dthornz.github.io/<repo-name>/`.

Update the nav link in `index.html` once the URL is confirmed.

---

## Usage Guide

### Fitting a dataset

1. Click **Examples ▾** and choose a dataset, or **Import CSV** / **Paste Data**.
2. Select the target dataset in the **Target Dataset** dropdown (right panel).
3. Choose a **Fit Model** from the dropdown.
4. For nonlinear models, check the initial parameter values and click **Auto Init** if needed.
5. Press **▶ Fit** (or Ctrl+Enter).
6. Statistics (R², RMSE, AIC, BIC, etc.) appear in the bottom bar; parameters update in the right panel.

### Custom equations

1. Select **Custom Equation…** from the model dropdown.
2. Type any expression in `x`, e.g. `a * exp(-b * x^2) + c * x + d`.
3. Parameters are detected automatically (any symbol other than `x`).
4. Set initial values, then press **▶ Fit**.

### Data format (CSV / paste)

```
x,y
0,2.00
1,1.21
2,0.74
...
```

- Headers are optional (detected automatically).
- Supports comma, tab, semicolon, or space delimiters.
- First two numeric columns are used as X and Y.

### Keyboard shortcut

| Shortcut | Action |
|---|---|
| `Ctrl + Enter` | Run fit |

---

## Project Structure

```
Advanced_Curve_Fitting_Studio/
├── index.html     — Full page: nav, hero, theory §1–3, interactive app §4, model ref §5
├── style.css      — Design system + app-specific layout (DM fonts, teal theme, dark mode)
├── script.js      — Fitting engine (LM algorithm), plot engine, UI, events, export
└── README.md      — This file
```

---

## Mathematical Background

The nonlinear least-squares objective:

$$S(\boldsymbol{p}) = \sum_{i=1}^{n} [y_i - f(x_i;\boldsymbol{p})]^2$$

Minimised using **Levenberg-Marquardt**:

$$\bigl(\mathbf{J}^\top\mathbf{J} + \lambda\,\mathrm{diag}(\mathbf{J}^\top\mathbf{J})\bigr)\Delta\boldsymbol{p} = \mathbf{J}^\top\mathbf{r}$$

where **J** is the numerical Jacobian (forward finite differences, step $\varepsilon = 10^{-7}$), $\lambda$ is the damping factor (Marquardt scaling), and **r** = **y** − **f** is the residual vector.

---

## Design Principles

- **Offline-first** — works with no internet after initial load.
- **No framework** — vanilla JS with no build toolchain; drops into any static host.
- **Consistent design system** — inherits the DM font family, teal primary colour, and dark/light mode from the portfolio template.
- **Scientifically accurate** — all statistical quantities follow standard definitions (see §2 of the app page).

---

## License

Research use only. See [LICENSE.md](LICENSE.md) for full terms.  
Copyright © 2026 Asad Mirza. All rights reserved.
