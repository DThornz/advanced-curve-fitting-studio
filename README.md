# Curve Fitting Studio

**Author:** Asad Mirza (DThornz)  
**Live:** [dthornz.github.io/curve-fitting-studio](https://dthornz.github.io/curve-fitting-studio/)

A browser-native, fully offline curve fitting and nonlinear regression platform — inspired by MATLAB's Curve Fitting App, built for scientists, engineers, and researchers. All computation runs entirely in the browser with no server, no cloud storage, and no telemetry.

---

## Features

| Capability | Detail |
|---|---|
| **58 built-in models** | Linear, Power Law, Polynomial (2–6), Exponential, Exp Decay + Offset, Logistic/Sigmoid, Gaussian Peak, Double-Gaussian Peak, Lorentzian, Michaelis-Menten, Hill, Sinusoidal, Damped Sinusoid, Weibull CDF, Biexponential, Rational, Power-law + Offset, **Gompertz**, **KWW Stretched Exponential**, **4-Parameter Logistic (4PL)**, **Pseudo-Voigt**, **Fano Resonance**, **Oral 1-Compartment PK**, **Stern-Volmer**, **Langevin**, **Van't Hoff**, **Ramberg-Osgood** · **Pharmacokinetics:** Two-Compartment PK, Oral PK + Lag Time · **Enzyme kinetics:** Substrate Inhibition · **Adsorption isotherms:** Langmuir, Freundlich, Temkin · **Rheology:** Power-Law Fluid, Herschel-Bulkley, Cross Model, Carreau, Quemada · **Peak shapes:** EMG (Exponentially Modified Gaussian), Asymmetric Gaussian, Voigt (Thompson-Cox-Hastings) · **Thermal kinetics:** Arrhenius, Extended Arrhenius · **Diffusion:** Erf Diffusion · **Activation functions:** Softplus, Erf Sigmoid · **Electrophysiology:** Boltzmann G-V, Double Boltzmann, HH Activation I-V, HH Na Channel I-V, Kir Inward Rectifier, GHK Current, τ-V Gaussian · Custom |
| **Fitting algorithms** | Levenberg-Marquardt · Gauss-Newton · Nelder-Mead Simplex · BFGS (selectable per fit); analytic Vandermonde normal equations for polynomials |
| **Multi-start optimisation** | Log-scale-perturbed pilot runs (default 8) to escape local minima; polishes the best candidate |
| **Auto initial guesses** | Data-driven heuristics per model (amplitude, rate, frequency, decay, peak centre, etc.) |
| **Constraint library** | *+ Add constraint* menu under the parameter table, offering only constraints that fit the current model's parameter count. Everything constraining the fit shows as removable chips: **box bounds** (grey — a live mirror of each parameter's Min/Max, set in the table or via the ≥ 0 / ≤ 0 / 0–1 / custom-range presets) and **coupled constraints** (teal — A ≤ B, A = B, Σ = value, Σ ≤ value), all enforced by every solver via projection. Saved with the session |
| **Parameter bounds** | Optional min/max per parameter; all four solvers enforce box constraints via projection at every iteration; init is auto-clamped before dispatch; blank = unconstrained |
| **Custom equations** | Any Math.js expression in `x`; parameters auto-detected; supports `exp`, `log`, `sin`, `cos`, `sqrt`, `abs`, `atan`, `^`, plus special functions `erf`, `erfc`, `gamma`, `lgamma`, `factorial`, `cbrt`, `nthRoot`, full trig (`cot`/`sec`/`csc`), inverse hyperbolic (`asinh`/`acosh`/`atanh`/`coth`), and conditional/ternary logic. **Visual Equation Editor** popup (⊞ button) provides a click-to-insert palette (operators, common + special functions, trig, hyperbolic, rounding, conditional, constants), 35+ categorised example equations, and live Math.js validation with parameter detection. Math.js is auto-extended with `erfc`/`lgamma` polyfills so every palette function evaluates in both the main thread and the fitting Web Worker. **Edit as Custom…** button appears below every built-in model — pre-fills the custom editor with a Math.js translation of the selected model's equation for use as a starting point. |
| **Fit diagnostics** | R², Adjusted R², RMSE, SSE, AIC, BIC, parameter std errors, convergence status, final λ (LM), gradient norm (BFGS). Parameter correlation heatmap + scrollable pair list in the stats bar side panel — plain-English suggestions flag strongly correlated pairs with targeted advice |
| **Expandable stats bar** | Click any row to expand: full-width parameter table (Value · SE · SEM = SE/√N · 95% CI at correct dof · t-statistic, green = significant). Below the table, chip cards in two labeled groups — **Model Quality**: R², Adj-R², RMSE, SSE, AIC, BIC, N, χ²ᵣ; **Diagnostics**: MAE, Max \|residual\|, CV%, df, Log-likelihood, F-statistic (with p-value), Durbin-Watson (color-coded green/amber), Runs test p (Wald-Wolfowitz, amber "pattern!" if p < 0.05), Jacobian condition number (green < 100, amber 100–1000, red > 1000). Every chip has an ⓘ tooltip; annotated chips (DW, Runs, Cond(J)) show a colored left border. Click again to collapse; multiple rows can be expanded simultaneously. A **parameter correlation side panel** (300 px) appears at the right edge of the stats bar whenever the active fit has ≥ 2 parameters — two-column layout: heatmap left, scrollable pair list sorted by \|r\| right. |
| **CI bands** | 95% confidence interval ribbon around each fit curve (toggle per session) |
| **Prediction interval bands** | 95% PI ribbon — wider than CI, adds per-observation scatter (RMSE²) to parameter uncertainty; toggle independently of CI bands |
| **Weighted fitting** | Five schemes: OLS (none), 1/y² (relative errors), 1/\|y\| (intermediate), 1/σ² (supplied uncertainties), Huber (IRLS robust fitting — downweights outliers via Iteratively Reweighted Least Squares, c = 1.345; per-iteration scale estimated as MAD/0.6745, making it robust to the very outliers being downweighted) |
| **Error bars** | Datasets with a σ column display Plotly error bars on the scatter plot; σ-weighted fits report reduced chi-square χ²ᵣ in the stats table, copy output, and TXT report |
| **Parameter sweep** | Range slider under each parameter updates the model preview curve live as you drag — no fitting, instant visual feedback for building intuition about parameter roles |
| **Prediction lookup** | Type an X value → get Ŷ with 95% CI (Jacobian propagation); or type a Y value → solve for X numerically (grid scan + bisection) with CI via delta method — returns IC50, EC50, Km, half-life, etc. directly |
| **F-test** | Nested model comparison: select two fits on the same dataset; computes F-statistic and exact p-value (regularized incomplete beta) and reports whether extra parameters are statistically justified at α = 0.05 |
| **Plot annotations** | Add horizontal/vertical reference lines, text callouts, and auto-peak markers; per-annotation control over font family, size, bold/italic, color, label placement, background, border, line style/width/opacity, and arrowhead type/size/color |
| **Try All Models** | One-click comparison table — fits all 55 non-Custom models and ranks by R²; apply any result to the active fit |
| **Copy Parameters** | One-click copy of fit name, dataset, all parameters (with ± std errors), and full statistics (R², Adj-R², RMSE, SSE, AIC, BIC, N, status) to clipboard |
| **Parameter table** | Init / Min / Max / Fit columns per parameter; Init preserves the starting guess; Fit column shows converged values; switching fits loads that fit's parameters into Init |
| **Parameter locking** | Lock icon on any parameter row — freezes that parameter at its Init value during fitting; useful for fixing known constants while optimising the rest |
| **Extrapolation range** | Set custom X min / X max for fit curves, independent of data extent; Reset button to revert to data range |
| **Outlier detection** | Highlights points where \|residual\| > 2.5σ for the active fit with red rings; updates live as points are moved |
| **Point masking** | Mask 2.5σ outliers to exclude them from fitting; Unmask All to restore; masked count shown in panel; mask state is saved in the undo/redo history so Ctrl+Z also restores or removes masks |
| **Data table** | Per-point table showing x, y, and residual for every data point; checkbox to exclude individual points from fitting while keeping them visible as hollow markers on the plot; bulk exclude-by-2.5σ and include-all buttons |
| **Data pre-processing** | **Pre-Process…** button opens a five-section panel (Smoothing Filter, Fourier Filter, Normalize / Transform, Baseline / De-trend, Repair / Impute — the last three are detailed in their own rows below). **Smoothing Filter** — four methods, each with an independent Apply: *Moving Average* (window size); *Gaussian* (window + σ, Gaussian-kernel weighted average); *Savitzky-Golay* (window + polynomial order 2–5, local normal-equation solve, preserves peak heights); *Median* (window size, spike-robust). Masked points are skipped in all methods. **Fourier Filter** — native Cooley-Tukey FFT (zero-padded to next power-of-2): *Low-pass*, *High-pass*, *Band-pass*, *Notch (band-reject)*; cutoff(s) as % of Nyquist; rolloff shapes: Brick-wall, Cosine taper, Hann window. **▤ Show Spectrum** opens an inline frequency analyser with two views — *Spectrum*: 1D power spectrum (dB/linear toggle) with automatic peak detection (red ▾ markers at frequencies ≥10 dB above the noise floor, labeled with their % Nyquist position) and live cutoff marker lines; *Spectrogram*: STFT heatmap (Hann-windowed frames, Viridis colorscale) showing how frequency content varies along the dataset — persistent interference appears as a horizontal band, making contaminating frequencies unambiguous. Both views support scroll-to-zoom and drag-to-pan. **↶ Undo Step** reverts the most recent pre-processing action one at a time; **Restore Original** reverts all the way to the imported y-values; every operation is pushed to the undo stack |
| **Smart point editing** | Always-on context-aware interaction: click near a point to select/drag, click and drag away from points to pan, scroll to zoom; no mode toggle required |
| **Residual analysis tabs** | Four sub-panels below the main plot: Residuals vs X · Q-Q Plot (residuals standardised by fit RMSE, Blom quantile approx vs normal) · Histogram (Sturges bins + normal overlay) · Convergence (SSE vs iteration; Log/Linear X and Y toggles, default Log Y) |
| **Normalized residuals** | **Norm. Res.** toggle in the Residuals panel tab bar — switches all residual plots between raw units and σ (RMSE-normalized) units |
| **Web Worker fitting** | All nonlinear solvers run in a background Web Worker — UI stays responsive; live SSE progress shown in the status bar; Cancel button terminates the fit instantly |
| **Input validation** | Pre-flight checks before fitting: minimum point count, finite data, non-constant Y, model output sanity at initial parameters — with plain-language error messages |
| **Log-scale auto-suggest** | Floating banner appears when data spans >100× on X or Y; one-click to apply log axis |
| **Interactive plots** | Plotly.js scatter + fit curve overlay; residual subplot; zoom/pan/hover; draggable legend |
| **Legend toggle** | Show/hide plot legend via modebar button (same bar as zoom/pan/box-select) |
| **Log axes** | Toggle log X / log Y from the ⚙ Style modal — persisted with graph style |
| **Axis range & tick control** | Set X/Y min, max, and tick spacing (Δ) from the ⚙ Style modal; blank = Plotly autorange |
| **Graph style editor** | Full control over global font (family, size, color), plot/paper background, grid lines (color, width, dash per axis), zero lines, axis spines, tick labels, and legend appearance; ⚙ Style button in the Plot Labels section |
| **Data import** | CSV/TSV/TXT file upload, drag-and-drop onto plot, paste from clipboard; auto-detects delimiter and headers; multi-column picker with optional σ column for files with more than two columns |
| **Normalize / transform** | Pre-Process panel: Min–Max, Z-score, log, log₁₀, √, and Box–Cox (with Auto maximum-likelihood λ) transforms of Y — fully reversible via Undo / Restore Original |
| **Baseline / de-trend** | Subtract a polynomial (degree 1–5) or LOWESS local-regression baseline (fit on non-masked points) to remove drift or background under peaks/oscillations |
| **Repair / impute** | Flag outliers by robust MAD z-score (or fill non-finite gaps) and replace them with a cubic-spline or linear estimate from the remaining points |
| **Multi-column import modes** | The column picker offers four modes: **Single Y (+σ)** · **Multiple Y → separate datasets** (each Y column becomes its own dataset) · **Replicates → mean ± σ** (wide-format replicate Y columns collapsed to a mean with auto-computed SD or SEM) · **Group column → one dataset per group** (long-format X, Y, category data, with repeated X aggregated to mean ± σ) — live preview for every mode |
| **Batch fit (Fit All Datasets)** | One click fits the selected model to every enabled dataset, with per-dataset Auto-Init and weighting; results are tabulated side-by-side in the stats panel for direct comparison |
| **Combine datasets** | Ctrl/⌘-click two or more datasets, then **⊕ Combine** to pool them into one dataset (mean ± σ when they share an x-grid, else pooled points) — fitting it gives a single curve through their average (vs. Fit All, which fits each separately) |
| **Replicate uncertainty (σ)** | Imported or replicate-derived σ drives 1/σ² weighting and reduced χ², and renders as error bars on the plot. The **Dose-Response + σ** example generates replicate-based error bars to demonstrate the workflow |
| **36 example datasets** | Exponential decay, Gaussian/Lorentzian peaks, logistic growth, enzyme kinetics, Hill dose-response, damped oscillation, sinusoidal, power law, Weibull CDF, polynomial calibration, linear calibration, **Gompertz tumor growth**, **XRD Pseudo-Voigt peak**, **Fano resonance**, **superparamagnetic M-H (Langevin)**, **stress-strain Ramberg-Osgood**, **ELISA 4PL dose-response**, **oral drug PK**, **polymer KWW relaxation**, **fluorescence quenching (Stern-Volmer)**, **Van't Hoff equilibrium vs temperature**, **two-compartment PK** (IV bolus), **oral PK with lag time**, **substrate inhibition** (bell-shaped enzyme kinetics), **Langmuir adsorption isotherm**, **Freundlich adsorption isotherm**, **Herschel-Bulkley fluid**, **Cross Model viscosity**, **EMG chromatography peak**, **Arrhenius rate constant**, **erf diffusion profile** · **Electrophysiology:** G-V Boltzmann, Kir I-V, HH Na I-V, voltage-dependent τ — each with adjustable noise and optional outlier injection (count + scale). The generator modal shows the generating equation rendered in KaTeX. Dropdown is a 3-column grouped layout |
| **Dataset enable/disable** | Toggle datasets on/off; disabled datasets and all their fits are fully hidden from the plot, residual panels, stats table, and F-test — re-enabling instantly restores them |
| **Blank startup** | App opens with an empty workspace — no example data pre-loaded; start from a clean slate every time |
| **First-run tutorial** | 6-slide modal on first launch with SVG illustrations of the real app UI that automatically adapt to light/dark mode; forward/back navigation, keyboard support (arrow keys, Escape), and a "Don't show this again" option stored in localStorage |
| **Multi-tab workspace** | Fully independent tabs — each starts from a clean default state with no settings inherited from other tabs; auto-naming from first dataset; double-click to rename |
| **Mobile / responsive layout** | On screens ≤640px the left and right panels collapse into side drawers toggled by a **☰ Datasets & Fits** / **⚙ Model & Params** bar below the toolbar. The toolbar itself scrolls horizontally with the Close button always pinned to the right edge. Portrait screens up to 1080 px wide (e.g., 1080×1920) show all toolbar buttons without scrolling at 100 % zoom. |
| **Resizable panels** | Left/right panels resize by width; residual and stats bar resize by height — all drag handles |
| **Export** | Plot as PNG or SVG; fit results as CSV; full fit report as TXT; reproducible code as Python (scipy.optimize), R (nls/minpack.lm), MATLAB (lsqcurvefit), or LaTeX (tabular + equation) |
| **Session persistence** | **Session ▾** dropdown in the toolbar groups Save Session, Load Session, Auto-restore (●/○ indicator), Shortcuts, and **Settings**. Save selected tabs (current / all / pick) to JSON; load on demand; Auto-restore replays the last save on reload. The **✕ Close** button is permanently pinned to the right edge of the toolbar, always visible regardless of horizontal scroll. |
| **Settings** | ⚙ Settings under the Session ▾ dropdown. **Appearance**: UI font size, font family (6 presets), monospace font (6 presets), Light / Dark theme toggle, animation speed. **Fitting Defaults**: default solver, multi-start pilot count, default weight scheme. **Display**: numeric precision (3–6 sig figs), fit line width, scatter marker size, default CI bands, default legend. All settings persist via `localStorage` and apply immediately. |
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

Click **Start Curve Fitting Studio** on the page. The app opens as a full-screen overlay. Press **Close** in the toolbar or `Escape` to return to the page.

### Fitting a dataset

1. Click **Examples** and choose a dataset, or **Import CSV** / **Paste Data**.
2. Select the target dataset in the **Target Dataset** dropdown (right panel).
3. Choose a **Fit Model** from the dropdown.
4. For nonlinear models, click **Auto Init** to set data-driven initial guesses, or tune manually. Optionally set Min/Max bounds on any parameter (leave blank for unconstrained).
5. Press **Fit** (or `Ctrl+Enter`).
6. Converged parameter values appear in the Fit column of the parameter table. Statistics (R², Adj-R², RMSE, SSE, AIC, BIC, N) appear in the stats bar at the bottom.

### Trying all models at once

Click **Try All** in the toolbar to fit every built-in model to the active dataset and display a ranked comparison table (sorted by R²). Click **Apply** on any row to load that model and its parameters into the right panel for further tuning.

### Fitting many datasets at once

With several datasets loaded you have two distinct options:

- **Fit All Datasets** (toolbar) fits the currently selected model to *every enabled dataset separately* — each gets its own Auto-Init, weighting, and fit curve, and all results are tabulated side-by-side in the stats panel for comparison.
- **Combine** fits *one* curve across several datasets. **Ctrl/⌘-click** two or more datasets in the left panel to multi-select them (highlighted with a teal outline), then click **⊕ Combine** in the Datasets header. If the selected series share an x-grid they are aggregated to **mean ± σ** (error bars); otherwise their points are pooled and sorted by x. The result is an ordinary dataset, so fitting it gives a single curve through their average. This pairs naturally with the example generator's **Multiple series** output.

### Point editing

Point editing is always active — no mode toggle is needed. Click near a data point to select it (a circle shows the selection radius). Drag a selected point to move it. Click and drag away from any point to pan the plot. Scroll to zoom. Shift+scroll adjusts the multi-select radius. Selected points can be nudged with arrow keys using the step value shown in the Edit controls panel (open via **Edit**).

### Outlier tools

Enable **Outliers** in the toolbar to highlight points where |residual| > 2.5σ for the active fit. Click **Mask 2.5σ** in the right panel to exclude those points from subsequent fits. **Unmask All** restores all masked points. The masked count is shown next to the section header.

### Multi-start fitting

Set **Multi-start** (default: 8) in Algorithm Options. The solver launches N pilot runs from log-scale-perturbed starting points, picks the best result, and polishes it. Substantially reduces the chance of converging to a local minimum at ~4× the compute cost of a single run.

### Supplied measurement uncertainties (σ data)

If your CSV has a third column of per-point uncertainties (σ_y), select it in the **σ column** dropdown of the column picker (Single Y mode). Per-point σ is also produced automatically by the picker's **Replicates → mean ± σ** and **Group column** modes, and by the example generator's **Replicates** output. The dataset displays Plotly error bars on the scatter plot. Once loaded:

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

### Equation display

Every built-in model shows its full equation (rendered by KaTeX) directly below the Fit Model dropdown — updated instantly on every selection. The example dataset generators also show the generating equation (in display-mode KaTeX) at the top of the generator modal.

### Custom equations

1. Select **Custom Equation** from the model dropdown.
2. Type any expression in `x` directly into the input field, e.g. `a * exp(-b * x) + c * x^d`.
3. Alternatively, click **⊞ Equation Editor…** to open the visual equation builder:
   - **Operator / function palette** — click any button to insert at the cursor; function buttons (e.g. `exp()`, `sin()`, `sqrt()`) place the cursor between the parentheses automatically.
   - **Example equations** — 30+ categorised examples (exponential, sigmoidal, peak shapes, oscillatory, biochemistry, rational) that load into the editor on click.
   - **Live validation** — equation is parsed by Math.js in real time; detected parameters shown in teal; errors shown in red.
   - Press `Ctrl+Enter` to apply or click **Apply Equation**; `Escape` cancels.
4. To start from a built-in model and modify it, select any model then click **Edit as Custom…** below the equation display. The custom editor is pre-filled with a Math.js translation of that model's equation — edit it freely and refit.
5. Parameters are detected automatically (any symbol other than `x` and standard math functions).
6. Set initial values, then press **Fit**.

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

### Diagnostics panel

Click **Diagnostics** in the toolbar to show/hide the panel below the main plot. It contains four tabs:

| Tab | What it shows |
|---|---|
| **Residuals** | Residuals $y_i - \hat{y}_i$ vs. $x_i$ for all visible fits on enabled datasets |
| **Q-Q Plot** | Standardised sample residuals vs. theoretical normal quantiles (Blom approximation); points on the reference line indicate Gaussian residuals |
| **Histogram** | Residual distribution with Sturges binning and a fitted normal density overlay |
| **Convergence** | SSE vs. iteration; default Log Y / Linear X; in-chart buttons toggle each axis independently (Log X · Linear X · Log Y · Linear Y); for multi-start fits the pilot-selection phase and polish share a monotonic x-axis |

The whole panel dims while a fit is running. Fits on disabled datasets are excluded from all sub-panels.

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

### Session management

The **Session ▾** dropdown (right side of the toolbar) consolidates all session controls:

| Item | Action |
|---|---|
| **Save Session** | Export selected tabs (current / all / custom pick) to a `.json` file |
| **Load Session** | Reload a previously saved `.json` file |
| **Auto-restore** (●/○) | When ON, the last saved session is automatically restored on next page reload |
| **Shortcuts** | Open the keyboard shortcuts reference modal |

The **✕ Close** button is permanently pinned to the far-right edge of the toolbar — it stays visible regardless of how far the toolbar has been scrolled horizontally on narrow screens.

**Unsaved-data guard:** if any tab contains datasets or fits, closing or refreshing the browser triggers the native "leave page?" confirmation dialog. The session is also silently auto-saved to `localStorage` at that moment, so it can be recovered via Auto-restore on the next visit.

### Multi-tab workflow

Click **+** in the tab bar to open a new workspace. Tabs are auto-named from the first dataset loaded; double-click to rename. Use **Save Session** to export one, some, or all tabs to JSON. Toggle **Auto-restore** to control whether the last saved session is restored on page reload.

### Mobile and small-screen layout

On screens ≤640 px wide the app switches to a single-panel drawer layout:

- The left panel (**Datasets & Fits**) and right panel (**Model & Params**) are hidden by default and slide in from the sides when toggled.
- A **☰ Datasets & Fits** / **⚙ Model & Params** bar appears below the toolbar; tap either button to open the corresponding panel as an overlay drawer.
- Tapping the semi-transparent backdrop outside the open panel closes it.
- The toolbar scrolls horizontally; **✕ Close** is always pinned to the right edge.
- On portrait screens up to 1080 px wide (e.g. 1080×1920 at 100 % zoom) all toolbar buttons fit in a single row without horizontal scrolling.

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
- Files with three or more columns open a column picker with four import modes: Single Y (+ optional σ), Multiple Y → separate datasets, Replicates → mean ± σ, and Group column → one dataset per group.
- Files with exactly two columns use them as X and Y directly.
- Sample files demonstrating every mode are in the `Example Datasets/` folder (see `Example Datasets/README.md`).

### Keyboard shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl + Enter` | Run fit |
| `Ctrl + Z / Y` | Undo / redo point edits (when selection exists) |
| `↑ ↓ ← →` | Nudge selected points by the step value |
| `Shift + Scroll` | Adjust multi-select radius |
| `Ctrl/⌘ + Click` | Multi-select datasets for ⊕ Combine |
| `?` | Open keyboard shortcuts reference modal |
| `Escape` | Close open modal / deselect points / close full-screen app |

---

## Project Structure

```
curve-fitting-studio/
├── index.html          — Hero, launch card, full-screen app overlay, theory §2–4, app guide §5, model reference §6
├── style.css           — Design system + app layout (DM fonts, teal theme, dark mode, scroll-reveal)
├── js/
│   ├── main.js         — App init, preferences, auto-restore
│   ├── state.js        — Central mutable state object
│   ├── models.js       — 58 built-in model definitions + MODEL_EQ / MODEL_EQ_JS
│   ├── fitting.js      — Fit orchestration, Web Worker dispatch, result storage
│   ├── solvers.js      — LM, Gauss-Newton, Nelder-Mead, BFGS implementations
│   ├── math-utils.js   — Matrix ops, statistics, covariance, CI/PI, Jacobian
│   ├── plots.js        — Plotly trace builders, updatePlots, residual tabs
│   ├── ui.js           — Fit list, stats table, corr matrix, param table render
│   ├── events.js       — All DOM event listeners, keyboard shortcuts
│   ├── tabs.js         — Multi-tab workspace (tabList, activateTab, renderTabBar)
│   ├── settings.js     — Settings panel, CFS_SETTINGS, applySettings
│   ├── import.js       — CSV/TSV/paste parser, column picker modal
│   ├── export.js       — CSV, TXT report, Python/R/MATLAB code export
│   ├── session.js      — Save/load session JSON, multi-tab payload, beforeunload guard
│   ├── resize.js       — Drag-resize handles for left/right/residual/stats/corr panels
│   ├── preprocess.js   — Smoothing, FFT/STFT filter, transform/de-trend/repair, dataset list + Combine
│   ├── examples.js     — 36 built-in example dataset generators
│   ├── examples-ui.js  — Examples dropdown UI and modal
│   ├── tutorial.js     — Interactive tutorial overlay (SVG step diagrams)
│   └── edit-mode.js    — Click-to-drag point editing, lasso select, masking
├── fitting-worker.js   — Web Worker: solver dispatch, multi-start, live SSE progress
└── README.md           — This file
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

## Changelog

### v1.9.2 — 2026-06-03  (security: HTML-escaping)
- **fix** Hardened against HTML injection: dataset names, fit labels, annotation labels, fit notes, and the model-search query are now HTML-escaped at every render site (fit/dataset lists, dataset & comparison dropdowns, annotation list, F-test/prediction panels, and the status console). A crafted name in an imported CSV or shared session file could previously inject markup into the page.
- **improve** The λ (Levenberg–Marquardt) and |∇| (BFGS) convergence diagnostics now also appear on the main-thread fallback path (e.g. file://), matching the Web Worker path.

### v1.9.1 — 2026-06-03  (bound sentinel fix)
- **fix** Parameter bounds with magnitude in [1e9, 1e10] were silently treated as unbounded. The unbounded sentinel is now ±1e300 (JSON-session-safe, unlike ±Infinity) with a 1e290 active-bound threshold, so any realistic bound is honoured. Pre-v1.9.0 sessions are migrated automatically on load.

### v1.9.0 — 2026-06-03  (covariance + constraint accuracy)
- **improve** Covariance/standard errors now use a central-difference Jacobian (≈4 orders of magnitude more accurate than forward-difference; verified vs analytic) — tightens SEs, CI/PI bands, and the Jacobian condition number
- **improve** Coupled-constraint projection iterates to feasibility (largest violation < relative tol) instead of a fixed 4 passes — satisfied to ~1e-12 for compatible constraints; infeasible combinations terminate at a capped iteration count

### v1.8.9 — 2026-06-03
- **fix** Regression from v1.8.5: page-level modals (Release Notes, Column Picker, Settings, Save, Annotations, Compare…) were frozen/uninteractive because the app's background-`inert` layer also covered them. The inert layer now skips modal/tooltip layers

### v1.8.8 — 2026-06-03
- **improve** Fourier filter warns when x spacing is non-uniform (FFT cutoffs assume a uniform grid)

### v1.8.7 — 2026-06-03  (EMG accuracy + validation)
- **fix** EMG peak model now uses the scaled complementary error function (`erfcx`) — accurate and overflow-free in the tails (was `exp·erfc`, which cancelled); matches the exact profile to ~6e−8, verified vs scipy
- **new** `VALIDATION.md` — solver cross-checked against NIST StRD (Misra1a, Rat42; SSE matches certified) + machine-precision round-trip recovery for built-in models

### v1.8.6 — 2026-06-03  (robustness)
- **fix** Replaced the remaining `Math.min/max(...array)` spreads in all 77 model Auto-Init heuristics (large-dataset `RangeError` hardening)
- **fix** File imports report read errors (`reader.onerror`); minimum-points check is model-aware (2-point linear allowed; high-degree models need enough points); unsaved-changes guard no longer rebuilds the full payload on each close check
- **fix** Custom-equation parser rejects non-pure expressions (assignments / function defs / `;`) — a crafted session can't execute arbitrary Math.js on restore

### v1.8.5 — 2026-06-03  (accessibility)
- **a11y** Full-screen app is a `role="dialog"` with background `inert`/`aria-hidden`, focus moved inside on open and restored on close; status bar is an `aria-live` region; `?` help tooltips are keyboard-focusable and open on focus; icon-only buttons gained `aria-label`s
- **new** Confirmation prompts before "✕ All" (datasets & fits) and "Clear fits" (irreversible)

### v1.8.4 — 2026-06-03  (reproducibility)
- **new** Multi-start fitting uses a seeded PRNG (mulberry32) instead of `Math.random()` → fits are reproducible run-to-run
- **new** Exported Python/R/MATLAB scripts carry a provenance header (app version, model, solver, weighting); JSON schema and saved sessions embed the app version; worker cache-bust now uses a single `APP_VERSION` constant (was scraped from the DOM)

### v1.8.3 — 2026-06-03  (numerical trust)
- **fix** Unified the Levenberg-Marquardt step and convergence test between the Web Worker and the fallback solver (Marquardt diagonal scaling + scipy-style relative xtol/ftol tolerances); Gauss-Newton and BFGS use relative tolerances too. **Validated against NIST StRD certified datasets** (Misra1a, Rat42) to 5–6 sig figs
- **fix** Standard errors for supplied-σ (1/σ²) fits now use covariance (JᵀWJ)⁻¹ directly (scipy `absolute_sigma=True`) instead of rescaling by reduced χ²

### v1.8.2 — 2026-06-03  (multi-agent audit fixes)
- **fix** Unified fit statistics between the Web Worker (default path) and the fallback/polynomial solver: AIC/BIC now include the Gaussian-likelihood constant, adjusted R² uses dof = n−m, and weighted RMSE is computed in the worker (was missing → weighted prediction bands used unweighted RMSE)
- **fix** Removed `Math.min/max(...array)` spreads from the plot-render and paste paths — fixes a `RangeError` crash on very large datasets
- **fix** Expanded stats row shows algorithm + weighting (was a stale field, always "—"); CSV/Report exports guard missing `paramErrors`; 4PL Edit-as-Custom used undeclared `EC50` → now `C`
- **fix** Non-finite-everywhere custom equation no longer reports R²=1; Ctrl+Z in a text field no longer reverts a point edit; Mask 2.5σ guards zero RMSE
- **improve** Defined missing CSS vars (`--error`, `--input-bg`, `--teal-soft`); raised faint-text contrast in both themes

### v1.8.1 — 2026-06-03
- **fix** Parameter Min/Max inputs no longer clip multi-digit values (e.g. `500`) — switched to `box-sizing:border-box`
- **new** Min/Max accept `Inf` / `-Inf` / `Infinity` / `∞` (any sign) to mean unbounded, treated as ±∞ by the solver
- **new** Constraint chips are editable: click a coupled chip to reopen it pre-filled and ✓ Update in place; click a box-bound chip to focus its Min/Max cell

### v1.8.0 — 2026-06-02
- **improve** Unified constraint chips — parameter Min/Max bounds now show as removable grey chips next to the (teal) coupled-constraint chips, mirroring the Min/Max cells two-way (set in the table or via a preset → chip appears; clear the chip → bound clears). Resolves the box-preset/Min-Max overlap

### v1.7.9 — 2026-06-02
- **improve** Constraint builder UX: picking a type opens a dashed "draft" panel whose **✓ Add** button pulses green (it isn't applied until clicked); added a "Not added yet" hint and a Fit-time warning if a constraint is drafted but not committed

### v1.7.8 — 2026-06-02
- **new** Fit labels show a `C:N` tag when N coupled constraints were applied — a quick way to confirm constraints took effect (if `C:N` shows but params don't change, an old worker is still cached: hard-refresh; the CDN can lag a few minutes after a release)

### v1.7.7 — 2026-06-02
- **fix** Fitting Web Worker is now cache-busted by app version, so an updated `fitting-worker.js` (constraint support, new models, etc.) is never served stale after a deploy — the cause of constraints appearing to be ignored. A one-time hard refresh clears any already-cached copy
- **verify** Audited the constraint projection (A ≤ B, A = B, Σ = value, Σ ≤ value, box bounds) across solvers/fit shapes — all enforced correctly (e.g. Langevin A ≤ B collapses to A = B since its unconstrained optimum has A ≫ B)

### v1.7.6 — 2026-06-02
- **new** Constraint library — *+ Add constraint* menu (context-aware: only offers types the current parameter count supports). Box presets (≥0, ≤0, 0–1, custom range) edit Min/Max; coupled constraints (A ≤ B, A = B, Σ = value, Σ ≤ value) appear as removable chips
- **new** Coupled constraints enforced by projection across all four solvers + Huber/multi-start/batch paths; saved with the session (SE/CI approximate when a coupled constraint is active)

### v1.7.5 — 2026-06-02
- **perf** Plotly and Math.js now load `defer` (were render-blocking) so the page paints immediately; added `preconnect` hints for the script/font CDNs
- **perf** Theory-section KaTeX equations (~160) render lazily as each section scrolls into view instead of all at once on load
- **fix** Tooltip audit — correlation legend corrected to “Blue = positive”, Datasets tip notes Ctrl/⌘-click → Combine, Custom Equation tip lists erf/erfc/lgamma; stale model counts fixed

### v1.7.4 — 2026-06-02
- **improve** Pre-Process panel now uses a wider, responsive multi-column (2-column) layout for its five sections instead of one tall scrolling column — collapses to a single column on narrow screens
- **docs** In-app usage guide and README refreshed for the current feature set (36 examples, 58 models, four import modes, five Pre-Process sections, Fit All & Combine)

### v1.7.3 — 2026-06-02
- **new** Combine datasets — Ctrl/⌘-click to multi-select datasets, then **⊕ Combine** pools them into one (mean ± σ when they share an x-grid, else pooled points); fitting it produces a single curve through their average

### v1.7.2 — 2026-06-02
- **new** Pre-Process **↶ Undo Step** button — revert any single pre-processing action (smooth, filter, transform, de-trend, repair) one step at a time, in addition to Restore Original
- **new** Example generator **Inject Trend / Baseline** — add a deterministic linear drift, quadratic curvature, and/or offset to generated data (pairs with the new De-trend tool)
- **new** Example generator **Output format** — produce any example as a single dataset, **Replicates → mean ± σ** (error bars), or **Multiple series** (N datasets for Fit All)

### v1.7.1 — 2026-06-02
- **new** Normalize / Transform (Pre-Process): Min–Max, Z-score, log, log₁₀, √, Box–Cox (auto-λ via profile likelihood) — reversible via Undo / Restore Original
- **new** Baseline / De-trend (Pre-Process): subtract a polynomial (deg 1–5) or LOWESS baseline fit on non-masked points
- **new** Repair / Impute (Pre-Process): MAD-based outlier flagging (or non-finite gap fill) with cubic-spline / linear replacement

### v1.7.0 — 2026-06-02
- **new** Multi-column import modes in the column picker: *Single Y (+σ)*, *Multiple Y → separate datasets*, *Replicates → mean ± σ* (auto SD/SEM), and *Group column → one dataset per group* (long-format, repeated X aggregated to mean ± σ), each with a live preview
- **new** **Fit All Datasets** button — batch-fits the selected model to every enabled dataset (per-dataset Auto-Init + weighting); results tabulated together in the stats panel
- **new** Replicate-derived σ drives 1/σ² weighting, reduced χ², and plot error bars; new **Dose-Response + σ** example demonstrates the workflow (4PL with replicate error bars)
- **fix** Code exports valid for all models: Python/R/Jupyter sanitise Greek/subscript/∞ parameter names into legal identifiers (guards Python keyword `lambda`); polynomials emit real bodies; Jupyter multi-line indentation bug fixed; R & MATLAB gained all v1.6.0 models
- **fix** JSON export `x`/`y`/`y_fit`/`residuals` are now equal-length and index-aligned with the full dataset (null at excluded points)

### v1.6.5 — 2026-06-02
- **fix** Edit-as-Custom parse errors — corrected invalid `MODEL_EQ_JS` translations (rheology `|γ̇|`→`abs(x)`, `ln(`→`log(`, PK-Lag trailing prose→ternary, Voigt prose→fully-expanded Thompson-Cox-Hastings expression)
- **fix** Reverted `gamma` being treated as a built-in function — it collided with `gamma` used as a free parameter (Damped-Sine damping, user equations); removed the Γ palette button, kept `lgamma`
- **fix** Parameter correlation heatmap unreadable in dark mode — theme-aware neutral colour + luminance-based cell text contrast
- **improve** Correlation suggestion/list boxes given subtle tints so they don't look like dim grey blanks in light mode

### v1.6.4 — 2026-06-01
- **new** Equation Editor palette expanded: Special Functions (erf, erfc, lgamma lnΓ, factorial), extra trig (cot, sec, csc), inverse hyperbolic (asinh, acosh, atanh, coth), cbrt/nthRoot, and a Conditional group (ternary `?:` + comparison operators)
- **new** Math.js auto-extended with erfc/lgamma (and gamma/factorial) polyfills in both the main thread and the Web Worker, so every palette function evaluates during fitting
- **new** 8 additional example equations in the editor: error-function sigmoid, erfc diffusion front, EMG peak, skew-normal, Langevin, saturating tanh, softplus, two-segment & delayed-onset piecewise
- **improve** Examples dropdown auto-columns: measures real rendered height and adds columns until no items are cut off at the bottom of the viewport; scrollable-column fallback on very short screens
- **new** Autocomplete search for model and example boxes — floating opaque top-8 results panel (arrow-key + mouse), no longer rewrites the dropdown mid-type

### v1.6.3 — 2026-06-01
- **new** Carreau model (η∞ + (η₀−η∞)·[1+(λγ̇)²]^((n−1)/2)) — biofluids, polymer melts; 4 params
- **new** Quemada model (3-parameter geometric-mean form) — blood, dense suspensions
- **new** Preset-based grouped examples: 6 standalone replaced by 5 multi-model groups with in-modal preset dropdown (Adsorption Isotherms, Viscosity/Rheology with named fluid presets, Spectral/Chrom. peaks, Thermal Kinetics, Sigmoid/Activation)
- **new** Example search: filter box in Examples dropdown matches by name, suggested model, and keyword tags (e.g. "blood" → viscosity/rheology group)
- **new** Third column in Examples dropdown (Pharmacokinetics, Multi-Model Groups, Diffusion)
- **improve** Version bumped to v1.6.3; hero badge 56 → 58

### v1.6.2 — 2026-06-01
- **new** 7 new export formats: Jupyter Notebook (.ipynb), Excel Workbook (.xlsx), Standalone Plotly HTML, Copy Plot to Clipboard (PNG), BibTeX citation, API JSON schema, LaTeX doc fragment
- **improve** Python / LaTeX exports cover all 17 v1.6.0 models (extracted `_pyModelBody` helper)

### v1.6.1 — 2026-06-01
- **new** 10 UI/UX features: dark mode auto-detect, model search, fit quality badge, fit comparison modal, drag-drop reorder, resize memory, fit notes, axis range mode, Ctrl+F fit, sweep clamping cue
- **fix** All 17 v1.6.0 models added to fitting-worker.js (Softplus, Erf-Sigmoid, EMG, Voigt etc. were showing "Unknown model")

### v1.6.0 — 2026-06-01
- **new** 17 new built-in models (39 → 56 total): Pharmacokinetics — Two-Compartment PK, Oral PK + Lag Time; Enzyme kinetics — Substrate Inhibition; Adsorption isotherms — Langmuir, Freundlich, Temkin; Rheology — Power-Law Fluid, Herschel-Bulkley, Cross Model; Peak shapes — EMG (Exponentially Modified Gaussian), Asymmetric Gaussian (skew-normal), Voigt (Thompson-Cox-Hastings constrained); Thermal kinetics — Arrhenius, Extended Arrhenius; Diffusion — Erf Diffusion; Activation functions — Softplus, Erf Sigmoid
- **new** `_erf` / `_erfc` helpers in models.js — Abramowitz & Stegun 7.1.26 polynomial (max |err| < 1.5×10⁻⁷), no external dependency
- **new** 10 new example datasets (26 → 36 total): Two-Compartment PK, Oral PK + Lag, Substrate Inhibition, Langmuir isotherm, Freundlich isotherm, Herschel-Bulkley fluid, Cross Model viscosity, EMG chromatography peak, Arrhenius rate constant, Erf diffusion profile
- **new** 6 new model-selector optgroups: Pharmacokinetics, Adsorption / Isotherms, Rheology, Thermal / Kinetics, Diffusion / Transport, Activation Functions
- **improve** Model reference table — 8 new section headers, 17 new rows with equations and physical interpretation
- **improve** Version bumped to v1.6.0 in topbar chip, hero badge, and release notes

### v1.5.0 — 2026-05-27
- **fix** LM damping — proper Marquardt scaling `JtJ + λ·diag(|JtJ|)` replaces flat `JtJ*(1+λ)+1e-10`
- **fix** LM and GN convergence — OR logic so either step-norm or ΔSSE below tolerance triggers convergence
- **fix** AIC / BIC — full MLE constant `n·(ln 2π + 1)` added; absolute values now match R / Python / MATLAB
- **fix** Weighted RMSE for prediction intervals — PI bands use weighted residual variance when weighting is active
- **fix** t-critical table — smooth interpolation for df 121–200, eliminating a 0.020 step at df = 120→121
- **improve** Huber IRLS iterations 5 → 20 for robustness under heavy outlier contamination
- **new** 1/y² zero-weight warning — console warning when any y = 0 point is present
- **improve** Model auto-init heuristics — Boltzmann/Double-Boltzmann seed from A/2 data crossing; Pseudo-Voigt uses distinct γ / σ; Double-Gaussian masks first peak before searching for second
- **fix** Hill model parameter name — `Vm` → `Vmax` in internal destructuring
- **fix** FFT Nyquist bin — DC and Nyquist scaled once; conjugate-symmetric bins mirrored correctly
- **fix** Session restore null-fn guard — unknown-model fits get `() => NaN` stub instead of `null`
- **fix** FileReader error handler — session file read failures surface a visible error message
- **fix** Session payload validation — `restoreMultiTabPayload` throws descriptive error on invalid input
- **new** Bounds in session and exports — parameter bounds stored on fit records and emitted in Python / R / MATLAB exports
- **fix** Object URL leak — all blob download links schedule `revokeObjectURL` 60 s after click
- **fix** Log-scale banner z-index raised from 15 to 110
- **improve** Correlation panel responsive — narrows to 280 px on viewports ≤ 700 px wide
- **improve** Accessibility — `aria-label="Close"` on all modal close buttons

### v1.4.0 — 2026-05-26
- **new** Unsaved-data guard — beforeunload confirmation + localStorage auto-save
- **fix** Stats bar whitespace below the fit results table
- **improve** Correlation panel widened to 420 px, stacked layout
- **fix** Mojibake in `tutorial.js` and `export.js`

### v1.3.0 — 2026-05-26
- **new** Settings panel (appearance, fitting defaults, display)
- **new** Parameter correlation panel moved to stats bar

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


