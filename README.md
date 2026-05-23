# Advanced Curve Fitting Studio

**Author:** Asad Mirza (DThornz)  
**Live:** [dthornz.github.io/advanced-curve-fitting-studio](https://dthornz.github.io/advanced-curve-fitting-studio/)

A browser-native, fully offline curve fitting and nonlinear regression platform — inspired by MATLAB's Curve Fitting App, built for scientists, engineers, and researchers. All computation runs entirely in the browser with no server, no cloud storage, and no telemetry.

---

## Features

| Capability | Detail |
|---|---|
| **16+ built-in models** | Linear, Polynomial (2-6), Exponential, Exp Decay + Offset, Logistic/Sigmoid, Gaussian Peak, Lorentzian, Michaelis-Menten, Hill, Sinusoidal, Damped Sinusoid, Weibull CDF, Custom |
| **Fitting algorithms** | Levenberg-Marquardt · Gauss-Newton · Nelder-Mead Simplex · BFGS (selectable per fit); analytic normal equations (polynomial) |
| **Custom equations** | Any Math.js expression in `x`; parameters auto-detected |
| **Auto initial guesses** | Heuristics per model (amplitude, frequency, decay rate, etc.) |
| **Fit diagnostics** | R², Adjusted R², RMSE, SSE, AIC, BIC, parameter std errors |
| **Interactive plots** | Plotly.js scatter + fit curve overlay; residual subplot; zoom/pan/hover |
| **Log axes** | Toggle log X / log Y independently |
| **Data import** | CSV/TSV/TXT file upload, drag-and-drop onto plot, paste from clipboard |
| **Example datasets** | 13 built-in examples (radioactive decay, Gaussian/Lorentzian peaks, enzyme kinetics, Hill dose-response, power law, Weibull CDF, sinusoidal, polynomial calibration, etc.) |
| **Export** | Plot as PNG or SVG; fit results as CSV; full fit report as TXT |
| **Session persistence** | Save selected tabs (current / all / pick) to JSON; auto-restore on reload |
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

### Fitting a dataset

1. Click **Examples** and choose a dataset, or **Import CSV** / **Paste Data**.
2. Select the target dataset in the **Target Dataset** dropdown (right panel).
3. Choose a **Fit Model** from the dropdown.
4. For nonlinear models, check the initial parameter values and click **Auto Init** if needed.
5. Press **Fit** (or Ctrl+Enter).
6. Statistics (R², RMSE, AIC, BIC, etc.) appear in the bottom bar; parameters update in the right panel.

### Custom equations

1. Select **Custom Equation** from the model dropdown.
2. Type any expression in `x`, e.g. `a * exp(-b * x^2) + c * x + d`.
3. Parameters are detected automatically (any symbol other than `x`).
4. Set initial values, then press **Fit**.

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
advanced-curve-fitting-studio/
├── index.html     — Nav, hero, theory sections 1-3, interactive app section 4, model reference section 5
├── style.css      — Design system + app-specific layout (DM fonts, teal theme, dark mode)
├── script.js      — Fitting engines (LM, GN, Nelder-Mead, BFGS), plot engine, UI, events, export
└── README.md      — This file
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

**J** is the numerical Jacobian of residuals $r_i = y_i - f_i$ (forward finite differences, ε = 1e-7); the negative RHS follows from $\partial r_i/\partial p_j = -\partial f_i/\partial p_j$. BFGS gradients use finite differences of SSE directly. Polynomial models bypass iteration entirely via the Vandermonde normal equations.

---

## Design Principles

- **Offline-first** — works with no internet after initial load.
- **No framework** — vanilla JS with no build toolchain; drops into any static host.
- **Consistent design system** — inherits the DM font family, teal primary colour, and dark/light mode from the portfolio template.
- **Scientifically accurate** — all statistical quantities follow standard definitions (see section 2 of the app page).

---

## License

Research use only. See [LICENSE.md](LICENSE.md) for full terms.  
Copyright 2026 Asad Mirza. All rights reserved.
