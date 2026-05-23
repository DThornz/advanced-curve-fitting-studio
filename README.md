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
| **Fit diagnostics** | R², Adjusted R², RMSE, SSE, AIC, BIC, parameter std errors, parameter correlation matrix, convergence status, final λ (LM), gradient norm (BFGS) |
| **CI bands** | 95% confidence interval ribbon around each fit curve (toggle per session) |
| **Weighted fitting** | Three schemes: OLS (none), 1/y² (relative errors), 1/\|y\| (intermediate) |
| **Try All Models** | One-click comparison table — fits all 16 non-Custom models and ranks by R²; apply any result to the active fit |
| **Copy Parameters** | Copy active fit parameters (with ± std errors) to clipboard in one click |
| **Extrapolation range** | Set custom X min / X max for fit curves, independent of data extent; Reset button to revert to data range |
| **Outlier detection** | Highlights points where \|residual\| > 2.5σ for the active fit with red rings; updates live as points are moved |
| **Point masking** | Mask 2.5σ outliers to exclude them from fitting; Unmask All to restore; masked count shown in panel |
| **Smart point editing** | Always-on context-aware interaction: click near a point to select/drag, click and drag away from points to pan, scroll to zoom; no mode toggle required |
| **Residual analysis tabs** | Four sub-panels below the main plot: Residuals vs X · Q-Q Plot (Blom quantile approx vs normal) · Histogram (Sturges bins + normal overlay) · Convergence (SSE vs iteration; Log/Linear X and Y toggles, default Log Y) |
| **Normalized residuals** | Toggle residual plot between raw units and σ (RMSE-normalized) units |
| **Web Worker fitting** | All nonlinear solvers run in a background Web Worker — UI stays responsive; live SSE progress shown in the status bar; ✕ Cancel button terminates the fit instantly |
| **Input validation** | Pre-flight checks before fitting: minimum point count, finite data, non-constant Y, model output sanity at initial parameters — with plain-language error messages |
| **Log-scale auto-suggest** | Floating banner appears when data spans >100× on X or Y; one-click to apply log axis |
| **Interactive plots** | Plotly.js scatter + fit curve overlay; residual subplot; zoom/pan/hover; draggable legend |
| **Legend toggle** | Show/hide plot legend via modebar button (same bar as zoom/pan/box-select) |
| **Log axes** | Toggle log X / log Y independently |
| **Data import** | CSV/TSV/TXT file upload, drag-and-drop onto plot, paste from clipboard; auto-detects delimiter and headers; multi-column picker for files with more than two columns |
| **12 example datasets** | Exponential decay, Gaussian/Lorentzian peaks, logistic growth, enzyme kinetics, Hill dose-response, damped oscillation, sinusoidal, power law, Weibull CDF, polynomial calibration, linear calibration — each with adjustable noise and optional outlier injection (count + scale) |
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

### Trying all models at once

Click **Try All** in the toolbar to fit every built-in model to the active dataset and display a ranked comparison table (sorted by R²). Click **Apply** on any row to load that model and its parameters into the right panel for further tuning.

### Point editing

Point editing is always active — no mode toggle is needed. Click near a data point to select it (a circle shows the selection radius). Drag a selected point to move it. Click and drag away from any point to pan the plot. Scroll to zoom. Shift+scroll adjusts the multi-select radius. Selected points can be nudged with arrow keys using the step value shown in the Edit controls panel (open via **✏ Edit**).

### Outlier tools

Enable **Outliers** in the toolbar to highlight points where |residual| > 2.5σ for the active fit. Click **Mask 2.5σ** in the right panel to exclude those points from subsequent fits. **Unmask All** restores all masked points. The masked count is shown next to the section header.

### Multi-start fitting

Set **Multi-start** (default: 8) in Algorithm Options. The solver launches N pilot runs from log-scale-perturbed starting points, picks the best result, and polishes it. Substantially reduces the chance of converging to a local minimum at ~4× the compute cost of a single run.

### Custom equations

1. Select **Custom Equation** from the model dropdown.
2. Type any expression in `x`, e.g. `a * exp(-b * x) + c * x^d`.
3. Parameters are detected automatically (any symbol other than `x` and math functions).
4. Set initial values, then press **Fit**.

### Residual analysis tabs

Four tabs sit below the main plot:

| Tab | What it shows |
|---|---|
| **Residuals** | Residuals $y_i - \hat{y}_i$ vs. $x_i$ for all visible fits; dots dim when the source dataset is disabled |
| **Q-Q Plot** | Standardised sample residuals vs. theoretical normal quantiles (Blom approximation); points on the reference line indicate Gaussian residuals |
| **Histogram** | Residual distribution with Sturges binning and a fitted normal density overlay |
| **Convergence** | SSE vs. iteration; default Log Y / Linear X; in-chart buttons toggle each axis independently (Log X · Linear X · Log Y · Linear Y); for multi-start fits the pilot-selection phase and polish share a monotonic x-axis |

The whole panel dims while a fit is running and when the active fit's source dataset is disabled.

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
| `Ctrl + Z / Y` | Undo / redo point edits (when selection exists) |
| `↑ ↓ ← →` | Nudge selected points by the step value |
| `Shift + Scroll` | Adjust multi-select radius |
| `Escape` | Deselect points / close full-screen app |

---

## Project Structure

```
advanced-curve-fitting-studio/
├── index.html        — Hero, launch card, full-screen app overlay, theory §2–4, app guide §5, model reference §6
├── style.css         — Design system + app layout (DM fonts, teal theme, dark mode, scroll-reveal)
├── script.js         — Plot engine, UI, events, export, session; calls fitting-worker.js for nonlinear fits
├── fitting-worker.js — Web Worker: LM, GN, Nelder-Mead, BFGS solvers; multi-start; posts live SSE progress
└── README.md         — This file
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
