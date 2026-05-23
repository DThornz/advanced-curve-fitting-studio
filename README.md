# Advanced Curve Fitting Studio

**Author:** Asad Mirza (DThornz)  
**Live:** [dthornz.github.io/advanced-curve-fitting-studio](https://dthornz.github.io/advanced-curve-fitting-studio/)

A browser-native, fully offline curve fitting and nonlinear regression platform — inspired by MATLAB's Curve Fitting App, built for scientists, engineers, and researchers. All computation runs entirely in the browser with no server, no cloud storage, and no telemetry.

---

## Features

| Capability | Detail |
|---|---|
| **16+ built-in models** | Linear, Polynomial (2–6), Exponential, Exp Decay + Offset, Logistic/Sigmoid, Gaussian Peak, Lorentzian, Michaelis-Menten, Hill, Sinusoidal, Damped Sinusoid, Weibull CDF, Custom |
| **Fitting algorithms** | Levenberg-Marquardt · Gauss-Newton · Nelder-Mead Simplex · BFGS (selectable per fit); analytic Vandermonde normal equations for polynomials |
| **Multi-start optimisation** | Log-scale-perturbed pilot runs (default 8) to escape local minima; polishes the best candidate |
| **Auto initial guesses** | Data-driven heuristics per model (amplitude, rate, frequency, decay, peak centre, etc.) |
| **Custom equations** | Any Math.js expression in `x`; parameters auto-detected; supports `exp`, `log`, `sin`, `cos`, `sqrt`, `abs`, `atan`, `^` |
| **Fit diagnostics** | R², Adjusted R², RMSE, SSE, AIC, BIC, parameter std errors, convergence status |
| **Interactive plots** | Plotly.js scatter + fit curve overlay; residual subplot; zoom/pan/hover; draggable legend |
| **Auto legend placement** | Legend placed at bottom-right or top-right based on data density; user-draggable |
| **Log axes** | Toggle log X / log Y independently |
| **Data import** | CSV/TSV/TXT file upload, drag-and-drop onto plot, paste from clipboard; auto-detects delimiter and headers |
| **12 example datasets** | Exponential decay, Gaussian/Lorentzian peaks, logistic growth, enzyme kinetics, Hill dose-response, damped oscillation, sinusoidal, power law, Weibull CDF, polynomial calibration, linear calibration |
| **Dataset enable/disable** | Toggle datasets on/off for fitting; disabled datasets dim on the plot and are excluded from the fit dropdown |
| **Multi-tab workspace** | Independent tabs with auto-naming from first dataset; double-click to rename |
| **Resizable panels** | Left/right panels resize by width; residual and stats bar resize by height — all drag handles |
| **Export** | Plot as PNG or SVG; fit results as CSV; full fit report as TXT |
| **Session persistence** | Save selected tabs (current / all / pick) to JSON file; load on demand; optional auto-restore on reload |
| **Full-screen app** | Launched via button on the page — opens as a full-screen overlay for maximum workspace |
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

## Usage Guide

### Launching the app

Click **▶ Start Advanced Curve Fitting Studio** on the page. The app opens as a full-screen overlay. Press **✕ Close** in the toolbar or `Escape` to return to the page.

### Fitting a dataset

1. Click **Examples** and choose a dataset, or **Import CSV** / **Paste Data**.
2. Select the target dataset in the **Target Dataset** dropdown (right panel).
3. Choose a **Fit Model** from the dropdown.
4. For nonlinear models, click **Auto Init** to set data-driven initial guesses, or tune manually.
5. Press **▶ Fit** (or `Ctrl+Enter`).
6. Statistics (R², RMSE, AIC, BIC, etc.) appear in the resizable stats bar; parameters update in the right panel.

### Multi-start fitting

Set **Multi-start** (default: 8) in Algorithm Options. The solver launches N pilot runs from log-scale-perturbed starting points, picks the best result, and polishes it. Substantially reduces the chance of converging to a local minimum at ~4× the compute cost of a single run.

### Custom equations

1. Select **Custom Equation** from the model dropdown.
2. Type any expression in `x`, e.g. `a * exp(-b * x) + c * x^d`.
3. Parameters are detected automatically (any symbol other than `x` and math functions).
4. Set initial values, then press **Fit**.

### Dataset enable / disable

Click the **●** toggle button (visible on hover in the dataset list) to enable or disable a dataset. Disabled datasets are dimmed on the plot and excluded from the fit dropdown.

### Multi-tab workflow

Click **+** in the tab bar to open a new workspace. Tabs are auto-named from the first dataset loaded; double-click to rename. Use **Save Session** to export one, some, or all tabs to JSON. Toggle **Auto-restore** to control whether the last saved session is restored on page reload.

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

### Keyboard shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl + Enter` | Run fit |
| `Ctrl + Z / Y` | Undo / redo (Edit mode) |
| `↑ ↓ ← →` | Nudge selected points (Edit mode) |
| `Scroll` | Adjust edit radius (Edit mode) |
| `Escape` | Close full-screen app |

---

## Project Structure

```
advanced-curve-fitting-studio/
├── index.html   — Hero, launch card, full-screen app overlay, theory §2–4, app guide §5, model reference §6
├── style.css    — Design system + app layout (DM fonts, teal theme, dark mode, scroll-reveal)
├── script.js    — Fitting engines (LM, GN, Nelder-Mead, BFGS), multi-start, plot engine, UI, events, export, session
└── README.md    — This file
```

---

## Mathematical Background

The nonlinear least-squares objective:

$$S(\boldsymbol{p}) = \sum_{i=1}^{n} [y_i - f(x_i;\boldsymbol{p})]^2$$

Four iterative solvers are available (selectable per fit in the Algorithm Options panel):

| Solver | Step equation | Notes |
|---|---|---|
| **Levenberg-Marquardt** | $(\mathbf{J}^\top\mathbf{J} + \lambda\,\mathrm{diag}(\mathbf{J}^\top\mathbf{J}))\Delta\boldsymbol{p} = -\mathbf{J}^\top\mathbf{r}$ | Adaptive damping; robust default |
| **Gauss-Newton** | $\mathbf{J}^\top\mathbf{J}\,\Delta\boldsymbol{p} = -\mathbf{J}^\top\mathbf{r}$ | LM with λ=0 + Armijo line search; faster near solution |
| **Nelder-Mead Simplex** | reflect / expand / contract / shrink simplex | Derivative-free; robust on noisy/flat surfaces |
| **BFGS** | $\boldsymbol{d}_k = -\mathbf{H}_k\nabla S$; rank-2 inverse-Hessian update | Quasi-Newton; superlinear convergence on smooth problems |

**J** is the numerical Jacobian of residuals $r_i = y_i - f_i$ (forward finite differences, ε = 1e-7). BFGS gradients use finite differences of SSE directly. Polynomial models bypass iteration entirely via the Vandermonde normal equations.

---

## Design Principles

- **Offline-first** — works with no internet after initial load.
- **No framework** — vanilla JS with no build toolchain; drops into any static host.
- **Full-screen first** — app launches as a fixed overlay, freeing the entire viewport for the workspace.
- **Consistent design system** — DM font family, teal primary colour, dark/light mode.
- **Scientifically accurate** — all statistical quantities follow standard definitions (see §3 of the app page).

---

## License

Research use only. See [LICENSE.md](LICENSE.md) for full terms.  
Copyright 2026 Asad Mirza. All rights reserved.
