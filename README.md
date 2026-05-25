# Advanced Curve Fitting Studio

**Author:** Asad Mirza (DThornz)  
**Live:** [dthornz.github.io/advanced-curve-fitting-studio](https://dthornz.github.io/advanced-curve-fitting-studio/)

A browser-native, fully offline curve fitting and nonlinear regression platform — inspired by MATLAB's Curve Fitting App, built for scientists, engineers, and researchers. All computation runs entirely in the browser with no server, no cloud storage, and no telemetry.

---

## Features

| Capability | Detail |
|---|---|
| **39 built-in models** | Linear, Power Law, Polynomial (2–6), Exponential, Exp Decay + Offset, Logistic/Sigmoid, Gaussian Peak, Double-Gaussian Peak, Lorentzian, Michaelis-Menten, Hill, Sinusoidal, Damped Sinusoid, Weibull CDF, Biexponential, Rational, Power-law + Offset, **Gompertz**, **KWW Stretched Exponential**, **4-Parameter Logistic (4PL)**, **Pseudo-Voigt**, **Fano Resonance**, **Oral 1-Compartment PK**, **Stern-Volmer**, **Langevin**, **Van't Hoff**, **Ramberg-Osgood** · **Electrophysiology:** Boltzmann G-V, Double Boltzmann, HH Activation I-V, HH Na Channel I-V, Kir Inward Rectifier, GHK Current, τ-V Gaussian · Custom |
| **Fitting algorithms** | Levenberg-Marquardt · Gauss-Newton · Nelder-Mead Simplex · BFGS (selectable per fit); analytic Vandermonde normal equations for polynomials |
| **Multi-start optimisation** | Log-scale-perturbed pilot runs (default 8) to escape local minima; polishes the best candidate |
| **Auto initial guesses** | Data-driven heuristics per model (amplitude, rate, frequency, decay, peak centre, etc.) |
| **Parameter bounds** | Optional min/max per parameter; all four solvers enforce box constraints via projection at every iteration; init is auto-clamped before dispatch; blank = unconstrained |
| **Custom equations** | Any Math.js expression in `x`; parameters auto-detected; supports `exp`, `log`, `sin`, `cos`, `sqrt`, `abs`, `atan`, `^` |
| **Fit diagnostics** | R², Adjusted R², RMSE, SSE, AIC, BIC, parameter std errors, parameter correlation matrix, convergence status, final λ (LM), gradient norm (BFGS) |
| **Expandable stats bar** | Click any row in the bottom stats table to expand it: shows per-parameter fitted value, std error, 95% CI (t-distribution at correct dof), and t-statistic (green = significant); right column shows full suite of summary stats at larger size; click again to collapse |
| **CI bands** | 95% confidence interval ribbon around each fit curve (toggle per session) |
| **Prediction interval bands** | 95% PI ribbon — wider than CI, adds per-observation scatter (RMSE²) to parameter uncertainty; toggle independently of CI bands |
| **Weighted fitting** | Five schemes: OLS (none), 1/y² (relative errors), 1/\|y\| (intermediate), 1/σ² (supplied uncertainties), Huber (IRLS robust fitting — downweights outliers via Iteratively Reweighted Least Squares, c = 1.345; per-iteration scale estimated as MAD/0.6745, making it robust to the very outliers being downweighted) |
| **Error bars** | Datasets with a σ column display Plotly error bars on the scatter plot; σ-weighted fits report reduced chi-square χ²ᵣ in the stats table, copy output, and TXT report |
| **Parameter sweep** | Range slider under each parameter updates the model preview curve live as you drag — no fitting, instant visual feedback for building intuition about parameter roles |
| **Prediction lookup** | Type an X value → get Ŷ with 95% CI (Jacobian propagation); or type a Y value → solve for X numerically (grid scan + bisection) with CI via delta method — returns IC50, EC50, Km, half-life, etc. directly |
| **F-test** | Nested model comparison: select two fits on the same dataset; computes F-statistic and exact p-value (regularized incomplete beta) and reports whether extra parameters are statistically justified at α = 0.05 |
| **Plot annotations** | Add horizontal/vertical reference lines, text callouts, and auto-peak markers; per-annotation control over font family, size, bold/italic, color, label placement, background, border, line style/width/opacity, and arrowhead type/size/color |
| **Try All Models** | One-click comparison table — fits all 38 non-Custom models and ranks by R²; apply any result to the active fit |
| **Copy Parameters** | One-click copy of fit name, dataset, all parameters (with ± std errors), and full statistics (R², Adj-R², RMSE, SSE, AIC, BIC, N, status) to clipboard |
| **Parameter table** | Init / Min / Max / Fit columns per parameter; Init preserves the starting guess; Fit column shows converged values; switching fits loads that fit's parameters into Init |
| **Parameter locking** | Lock icon on any parameter row — freezes that parameter at its Init value during fitting; useful for fixing known constants while optimising the rest |
| **Extrapolation range** | Set custom X min / X max for fit curves, independent of data extent; Reset button to revert to data range |
| **Outlier detection** | Highlights points where \|residual\| > 2.5σ for the active fit with red rings; updates live as points are moved |
| **Point masking** | Mask 2.5σ outliers to exclude them from fitting; Unmask All to restore; masked count shown in panel; mask state is saved in the undo/redo history so Ctrl+Z also restores or removes masks |
| **Data table** | Per-point table showing x, y, and residual for every data point; checkbox to exclude individual points from fitting while keeping them visible as hollow markers on the plot; bulk exclude-by-2.5σ and include-all buttons |
| **Data pre-processing** | **Pre-Process…** button opens a two-section panel. **Smoothing Filter** — four methods, each with an independent Apply: *Moving Average* (window size); *Gaussian* (window + σ, Gaussian-kernel weighted average); *Savitzky-Golay* (window + polynomial order 2–5, local normal-equation solve, preserves peak heights); *Median* (window size, spike-robust). Masked points are skipped in all methods. **Fourier Filter** — native Cooley-Tukey FFT (zero-padded to next power-of-2): *Low-pass*, *High-pass*, *Band-pass*, *Notch (band-reject)*; cutoff(s) as % of Nyquist; rolloff shapes: Brick-wall, Cosine taper, Hann window. **Restore Original** in the panel footer reverts to imported y-values; every operation is pushed to the undo stack |
| **Smart point editing** | Always-on context-aware interaction: click near a point to select/drag, click and drag away from points to pan, scroll to zoom; no mode toggle required |
| **Residual analysis tabs** | Four sub-panels below the main plot: Residuals vs X · Q-Q Plot (residuals standardised by fit RMSE, Blom quantile approx vs normal) · Histogram (Sturges bins + normal overlay) · Convergence (SSE vs iteration; Log/Linear X and Y toggles, default Log Y) |
| **Normalized residuals** | Toggle residual plot between raw units and σ (RMSE-normalized) units |
| **Web Worker fitting** | All nonlinear solvers run in a background Web Worker — UI stays responsive; live SSE progress shown in the status bar; Cancel button terminates the fit instantly |
| **Input validation** | Pre-flight checks before fitting: minimum point count, finite data, non-constant Y, model output sanity at initial parameters — with plain-language error messages |
| **Log-scale auto-suggest** | Floating banner appears when data spans >100× on X or Y; one-click to apply log axis |
| **Interactive plots** | Plotly.js scatter + fit curve overlay; residual subplot; zoom/pan/hover; draggable legend |
| **Legend toggle** | Show/hide plot legend via modebar button (same bar as zoom/pan/box-select) |
| **Log axes** | Toggle log X / log Y from the ⚙ Style modal — persisted with graph style |
| **Axis range & tick control** | Set X/Y min, max, and tick spacing (Δ) from the ⚙ Style modal; blank = Plotly autorange |
| **Graph style editor** | Full control over global font (family, size, color), plot/paper background, grid lines (color, width, dash per axis), zero lines, axis spines, tick labels, and legend appearance; ⚙ Style button in the Plot Labels section |
| **Data import** | CSV/TSV/TXT file upload, drag-and-drop onto plot, paste from clipboard; auto-detects delimiter and headers; multi-column picker with optional σ column for files with more than two columns |
| **26 example datasets** | Exponential decay, Gaussian/Lorentzian peaks, logistic growth, enzyme kinetics, Hill dose-response, damped oscillation, sinusoidal, power law, Weibull CDF, polynomial calibration, linear calibration, **Gompertz tumor growth**, **XRD Pseudo-Voigt peak**, **Fano resonance**, **superparamagnetic M-H (Langevin)**, **stress-strain Ramberg-Osgood**, **ELISA 4PL dose-response**, **oral drug PK**, **polymer KWW relaxation**, **fluorescence quenching (Stern-Volmer)**, **Van't Hoff equilibrium vs temperature** · **Electrophysiology:** G-V Boltzmann, Kir I-V, HH Na I-V, voltage-dependent τ — each with adjustable noise and optional outlier injection (count + scale). Dropdown is a 3-column grouped layout |
| **Dataset enable/disable** | Toggle datasets on/off; disabled datasets and all their fits are fully hidden from the plot, residual panels, stats table, and F-test — re-enabling instantly restores them |
| **Blank startup** | App opens with an empty workspace — no example data pre-loaded; start from a clean slate every time |
| **First-run tutorial** | 6-slide modal on first launch with SVG illustrations of the real app UI that automatically adapt to light/dark mode; forward/back navigation, keyboard support (arrow keys, Escape), and a "Don't show this again" option stored in localStorage |
| **Multi-tab workspace** | Fully independent tabs — each starts from a clean default state with no settings inherited from other tabs; auto-naming from first dataset; double-click to rename |
| **Resizable panels** | Left/right panels resize by width; residual and stats bar resize by height — all drag handles |
| **Export** | Plot as PNG or SVG; fit results as CSV; full fit report as TXT; reproducible code as Python (scipy.optimize), R (nls/minpack.lm), MATLAB (lsqcurvefit), or LaTeX (tabular + equation) |
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

Click **Start Advanced Curve Fitting Studio** on the page. The app opens as a full-screen overlay. Press **Close** in the toolbar or `Escape` to return to the page.

### Fitting a dataset

1. Click **Examples** and choose a dataset, or **Import CSV** / **Paste Data**.
2. Select the target dataset in the **Target Dataset** dropdown (right panel).
3. Choose a **Fit Model** from the dropdown.
4. For nonlinear models, click **Auto Init** to set data-driven initial guesses, or tune manually. Optionally set Min/Max bounds on any parameter (leave blank for unconstrained).
5. Press **Fit** (or `Ctrl+Enter`).
6. Converged parameter values appear in the Fit column of the parameter table. Statistics (R², Adj-R², RMSE, SSE, AIC, BIC, N) appear in the stats bar at the bottom.

### Trying all models at once

Click **Try All** in the toolbar to fit every built-in model to the active dataset and display a ranked comparison table (sorted by R²). Click **Apply** on any row to load that model and its parameters into the right panel for further tuning.

### Point editing

Point editing is always active — no mode toggle is needed. Click near a data point to select it (a circle shows the selection radius). Drag a selected point to move it. Click and drag away from any point to pan the plot. Scroll to zoom. Shift+scroll adjusts the multi-select radius. Selected points can be nudged with arrow keys using the step value shown in the Edit controls panel (open via **Edit**).

### Outlier tools

Enable **Outliers** in the toolbar to highlight points where |residual| > 2.5σ for the active fit. Click **Mask 2.5σ** in the right panel to exclude those points from subsequent fits. **Unmask All** restores all masked points. The masked count is shown next to the section header.

### Multi-start fitting

Set **Multi-start** (default: 8) in Algorithm Options. The solver launches N pilot runs from log-scale-perturbed starting points, picks the best result, and polishes it. Substantially reduces the chance of converging to a local minimum at ~4× the compute cost of a single run.

### Supplied measurement uncertainties (σ data)

If your CSV has a third column of per-point uncertainties (σ_y), select it in the **σ column** dropdown of the column picker. The dataset will display Plotly error bars on the scatter plot. Once loaded:

- The **Weights** dropdown gains a **1/σ² (data σ)** option (only active when the selected dataset has σ data).
- Selecting it fits by minimising χ² = Σ[(yᵢ − f(xᵢ))² / σᵢ²], the correct objective when measurement uncertainties are known.
- The **reduced chi-square** χ²ᵣ = χ² / (n − m) appears in the stats table, Copy Parameters output, and TXT report. χ²ᵣ ≈ 1 indicates a well-calibrated fit; > 1 means the model under-fits or uncertainties are underestimated.

Column headers are auto-detected: if the header matches `sigma`, `err`, `error`, `uncertainty`, `sd`, `std`, or `stdev`, the σ column is pre-selected.

```
x,y,sigma
0.0,2.00,0.05
1.0,1.21,0.04
2.0,0.74,0.06
...
```

### Parameter sweep

Each parameter row has a range slider below it. Dragging the slider:

1. Updates the **Init** value live.
2. Evaluates the model at the current slider positions for all parameters and draws a dashed amber preview curve on the main plot — no fitting, just model evaluation.

Releasing the slider commits the Init value. The preview curve disappears and the plot refreshes normally. This is useful for:
- Building intuition about what each parameter controls.
- Manually narrowing initial guesses before running the solver.
- Diagnosing a poor fit by checking whether any slider position visually matches the data.

The slider range is auto-sized to ±2×|Init| around the current Init value, or to the parameter bounds if set.

### Parameter bounds

The parameter table has four columns per row: **Init** (starting guess), **Min** (lower bound), **Max** (upper bound), and **Fit** (converged result). Min and Max are optional — leave them blank for unconstrained. Common uses:

- Rate constants and amplitudes that cannot be negative: set Min = 0
- Fractions or probabilities bounded between 0 and 1: set Min = 0, Max = 1
- Preventing a peak centre from wandering outside the data range

All four solvers (LM, Gauss-Newton, Nelder-Mead, BFGS) enforce bounds by projecting each candidate parameter vector back into the feasible box after every iteration. The initial guess is also auto-clamped to bounds before the fit is dispatched.

### Custom equations

1. Select **Custom Equation** from the model dropdown.
2. Type any expression in `x`, e.g. `a * exp(-b * x) + c * x^d`.
3. Parameters are detected automatically (any symbol other than `x` and math functions).
4. Set initial values, then press **Fit**.

### Electrophysiology models

Seven models are provided under the **Electrophysiology** group for fitting ion channel and membrane current data. Voltages in mV, currents in pA (or whatever units your data use).

| Model | Equation | Typical use |
|---|---|---|
| **Boltzmann G-V** | `G = A / (1 + exp(-(V − Vh) / k))` | Voltage-gated channel activation/inactivation conductance-voltage curve; Vh = half-activation, k = slope factor |
| **Double Boltzmann** | `G = A1/(1+exp(-(V−Vh1)/k1)) + A2/(1+exp(-(V−Vh2)/k2))` | Two-component G-V (e.g. two populations or two gates); six parameters |
| **HH Activation I-V** | `I = g · m_inf(V)^p · (V − Erev)` where `m_inf = 1/(1+exp(-(V−Vm)/km))` | Hodgkin-Huxley-type I-V for a single activation gate of order p (typically 2–4); fits L-type Ca²⁺ or delayed-rectifier K⁺ |
| **HH Na Channel I-V** | `I = g · m_inf³ · h_inf · (V − Erev)` | Classic HH sodium channel with cubic activation and linear inactivation; six parameters |
| **Kir Inward Rectifier** | `I = g · (V − EK) / (1 + exp((V − Vh) / k))` | Inward rectifier K⁺ (Kir2.x); strong rectification captured by the Boltzmann denominator |
| **GHK Current** | `I = A · V · (1 − r·exp(−V/Vt)) / (1 − exp(−V/Vt))` | Goldman-Hodgkin-Katz constant-field current; r = [ion]_out/[ion]_in; Vt ≈ 25.7 mV at room temperature; L'Hôpital limit applied at V = 0 |
| **τ-V Gaussian** | `τ = τ_max · exp(−½((V−Vpeak)/k)²) + τ_min` | Bell-shaped voltage dependence of a gating time constant; common for HH m and h gates |

Example datasets for G-V (Boltzmann), Kir I-V, HH Na I-V, and voltage-dependent τ are available from the **Examples** menu with adjustable noise.

### Residual analysis tabs

Four tabs sit below the main plot:

| Tab | What it shows |
|---|---|
| **Residuals** | Residuals $y_i - \hat{y}_i$ vs. $x_i$ for all visible fits on enabled datasets |
| **Q-Q Plot** | Standardised sample residuals vs. theoretical normal quantiles (Blom approximation); points on the reference line indicate Gaussian residuals |
| **Histogram** | Residual distribution with Sturges binning and a fitted normal density overlay |
| **Convergence** | SSE vs. iteration; default Log Y / Linear X; in-chart buttons toggle each axis independently (Log X · Linear X · Log Y · Linear Y); for multi-start fits the pilot-selection phase and polish share a monotonic x-axis |

The whole panel dims while a fit is running. Fits on disabled datasets are excluded from all residual sub-panels.

### Prediction and calibration lookup

The **Predict / Solve** panel at the bottom of the right panel serves two modes:

**X → Y (predict):** type any X value and press **Go** to evaluate the active fit at that point. If the fit has a covariance matrix, the output includes the 95% confidence interval half-width computed by Jacobian gradient propagation — the same method used for the CI ribbon.

**Y → X (calibrate):** type a target Y value to find all X solutions numerically. The solver does a 500-point grid scan across the current curve range followed by 52-step bisection for each sign change. The CI on each X solution is estimated via the delta method: δx ≈ CI_y / |df/dx|. Common uses:
- IC50 / EC50 from a sigmoidal dose-response
- Km from a Michaelis-Menten saturation curve
- Half-life from an exponential decay (solve for Y = Y₀/2)
- Calibration inversion from any polynomial or nonlinear standard curve

The curve range used for the Y→X search is the same as the extrapolation range (set in the Options panel, or defaulting to the data extent).

### F-test for nested model comparison

Select two fits that were run on the **same dataset** in the **F-test** panel. The simpler model (fewer parameters) is automatically identified as the null hypothesis.

The F-statistic is:

$$F = \frac{(SSE_1 - SSE_2) / \Delta p}{SSE_2 / (n - p_2)}$$

where SSE₁ and SSE₂ are the sums of squared errors for the simple and complex models, Δp is the difference in parameter counts, and (n − p₂) is the residual degrees of freedom of the complex model.

The p-value is computed from the exact F-distribution CDF using a Lanczos lnGamma + Lentz continued-fraction regularized incomplete beta implementation. A p-value < 0.05 indicates the extra parameters are statistically justified at α = 0.05.

### Plot annotations

The **Annotations** panel (just below Plot Labels in the right panel) lets you add publication-ready overlays to the main plot. Three types are available:

| Type | Use for |
|---|---|
| **Horizontal line** | Threshold at a fixed Y value (e.g., detection limit, half-max) |
| **Vertical line** | Marker at a fixed X value (e.g., time point, dose level, peak centre) |
| **Text callout** | Free text at any (X, Y) coordinate, with optional arrow to the point |

Click **+ Add** to open the annotation editor. Each annotation exposes full style controls:

- **Font:** family (9 presets + custom), size, bold, italic, color
- **Label placement:** horizontal anchor (left / center / right), vertical anchor (top / middle / bottom), background color + opacity, optional border
- **Reference line:** dash style (solid / dash / dot / dash-dot / long-dash / long-dash-dot), line width, color, opacity
- **Arrow (text/peak):** arrowhead type (8 styles), size, line width, color, and pixel offset of the text label from the arrow tail

Click **Peaks** to automatically annotate the peak centre of any Gaussian or Lorentzian fit that is currently visible. The annotation is colored to match the fit curve and labelled with the fit name. Each fit can only receive one automatic peak annotation; re-clicking Peaks won't duplicate them.

Annotations are saved to and restored from the session JSON file.

### Graph style, log scale, and axis range

Click **⚙ Style** (next to the Plot Labels header) to open the Graph Style modal. It has seven sections:

| Section | Controls |
|---|---|
| **Global Font** | Family (9 presets + custom), size, and color for all axis labels, tick labels, and legend text |
| **Background Colors** | Plot area background and paper (outer) background |
| **Grid Lines** | Show/hide, color, line width, and dash style independently for X and Y grid lines |
| **Zero Lines** | Show/hide, color, and line width for the X=0 and Y=0 reference lines |
| **Axes & Ticks** | Tick label font size, show/hide tick labels per axis, show/hide axis spines, and spine color |
| **Legend** | Legend font size, background color, and border color |
| **Scale & Axis Range** | Log X / Log Y checkboxes; X and Y axis minimum and maximum (blank = autorange); X and Y tick spacing Δ (blank = auto-tick) |

All fields use blank / unchecked as "use theme default" — no override is applied. Click **Apply** to commit, **Reset to Defaults** to clear all overrides and revert to the current dark/light theme.

Log scale and axis range settings are saved with the session and restored on tab switch or session load.

### Dataset enable / disable

Click the toggle button (visible on hover in the dataset list) to enable or disable a dataset. Disabling a dataset fully hides it and all its associated fits from the main plot, residual panels, stats table, F-test dropdowns, and peak-annotation detection. The fits are shown greyed out with "(dataset off)" in the fit list and remain deletable. Re-enabling the dataset instantly restores everything.

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

Three-column format with measurement uncertainties:

```
x,y,sigma
0.0,2.00,0.05
1.0,1.21,0.04
2.0,0.74,0.06
...
```

- Headers are optional (detected automatically).
- Supports comma, tab, semicolon, or space delimiters.
- Files with three or more columns open a column picker; choose X, Y, and optionally σ.
- Files with exactly two columns use them as X and Y directly.

### Keyboard shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl + Enter` | Run fit |
| `Ctrl + Z / Y` | Undo / redo point edits (when selection exists) |
| `↑ ↓ ← →` | Nudge selected points by the step value |
| `Shift + Scroll` | Adjust multi-select radius |
| `?` | Open keyboard shortcuts reference modal |
| `Escape` | Close open modal / deselect points / close full-screen app |

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

Non-commercial use only — personal, hobby, academic research, and teaching permitted; commercial use strictly prohibited. See [LICENSE.md](LICENSE.md) for full terms.  
Copyright 2026 Asad Mirza. All rights reserved.
