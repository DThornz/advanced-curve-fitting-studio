// Application entry point: IIFE wrapper, accessibility panel, initialise function, panel tooltip system
(function () {
'use strict';

/* ═══════════════════════════════════════════════════════════
   ACCESSIBILITY PANEL
═══════════════════════════════════════════════════════════ */
const accBtn    = document.getElementById('accBtn');
const accPanel  = document.getElementById('accPanel');
const darkToggle = document.getElementById('darkToggle');

function applyPrefs() {
  // If user has never manually set dark mode, follow OS preference
  let storedDark = localStorage.getItem('dark');
  if (storedDark === null) storedDark = window.matchMedia('(prefers-color-scheme: dark)').matches ? '1' : '0';
  const dark = storedDark === '1';
  const size = localStorage.getItem('size') || 'md';
  const font = localStorage.getItem('font') || 'default';
  document.body.classList.toggle('dark-mode', dark);
  darkToggle.checked = dark;
  ['sm','md','lg'].forEach(s => document.body.classList.toggle('size-'+s, s===size));
  ['sans','serif','mono'].forEach(f => document.body.classList.toggle('font-'+f, f===font && f!=='default'));
  document.querySelectorAll('[data-size]').forEach(b => b.classList.toggle('active', b.dataset.size===size));
  document.querySelectorAll('[data-font]').forEach(b => b.classList.toggle('active', b.dataset.font===font));
}
applyPrefs();
// Auto-update if OS preference changes and user hasn't overridden
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (localStorage.getItem('dark') === null) applyPrefs();
});
accBtn.addEventListener('click', e => { e.stopPropagation(); accPanel.classList.toggle('open'); });
document.addEventListener('click', e => { if (!accPanel.contains(e.target) && e.target !== accBtn) accPanel.classList.remove('open'); });
darkToggle.addEventListener('change', () => {
  localStorage.setItem('dark', darkToggle.checked ? '1' : '0');
  applyPrefs();
  setTimeout(() => {
    if (state.datasets.length) updatePlots();
    const specWrap = document.getElementById('pp-fft-spectrum-wrap');
    if (specWrap && specWrap.style.display !== 'none') renderFFTSpectrum();
  }, 80);
});
document.querySelectorAll('[data-size]').forEach(b => b.addEventListener('click', () => { localStorage.setItem('size', b.dataset.size); applyPrefs(); }));
document.querySelectorAll('[data-font]').forEach(b => b.addEventListener('click', () => { localStorage.setItem('font', b.dataset.font); applyPrefs(); }));

/* ═══════════════════════════════════════════════════════════
   INITIALISE
═══════════════════════════════════════════════════════════ */
function loadDefaultExample() {
  const ex = generateExample('exponential-decay');
  importDataset(ex.name, ex.x, ex.y);
  applyParsedMeta({ xlabel: ex.xlabel, ylabel: ex.ylabel, title: null });
  document.getElementById('model-select').value = ex.suggestModel;
  syncModelCustomSection();
  syncFitDatasetSelect();
  renderDatasetList();
  updatePlots();
  autoInitParams();
  setConsole(`Example loaded: ${ex.name}. Press ▶ Fit to begin.`, '');
}

function init() {
  // Initialise tab system with one default tab
  tabList = [{ id: nextTabId(), name: 'Tab 1', payload: null, autoNamed: true }];
  activeTabId = tabList[0].id;

  initEvents();
  renderTabBar();
  updatePlots(); // Must run before initEditMode so Plotly element exists
  initEditMode();

  // Scroll-reveal for page sections + lazy KaTeX rendering.
  // All ~160 theory equations live inside .reveal sections below the fold; rendering
  // them only when scrolled into view keeps page load fast and avoids rendering math
  // the user never scrolls to.
  const _mathCfg = { delimiters: [{ left: '$$', right: '$$', display: true }, { left: '$', right: '$', display: false }], throwOnError: false };
  const revealObs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      e.target.classList.add('visible');
      if (!e.target._mathRendered && typeof renderMathInElement === 'function') {
        e.target._mathRendered = true;
        try { renderMathInElement(e.target, _mathCfg); } catch (_) { /* ignore */ }
      }
      revealObs.unobserve(e.target);
    });
  }, { threshold: 0.07, rootMargin: '300px 0px' });
  document.querySelectorAll('.reveal').forEach(el => revealObs.observe(el));

  // Hide nav when app section scrolls into view
  const siteNav = document.querySelector('.site-nav');
  const appAnchor = document.getElementById('app');
  if (siteNav && appAnchor) {
    window.addEventListener('scroll', () => {
      siteNav.classList.toggle('nav-hidden', appAnchor.getBoundingClientRect().top <= 160);
    }, { passive: true });
  }

  // Auto-restore saved session or start with a blank workspace
  const autoRestore = localStorage.getItem('cfs_autorestore') !== '0';
  document.getElementById('btn-auto-restore').classList.toggle('active', autoRestore);
  const saved = localStorage.getItem('cfs_session');
  if (autoRestore && saved) {
    try { restoreMultiTabPayload(JSON.parse(saved)); return; } catch (_) {}
  }
  clearWorkspace();
}

init();

/* ═══════════════════════════════════════════════════════════
   PANEL TOOLTIP SYSTEM
═══════════════════════════════════════════════════════════ */
const PANEL_TIPS = {
  'datasets':
    `<b>Datasets</b><br>Lists all loaded datasets in this tab. Each entry shows the dataset name, point count, and colour swatch.<br><br>` +
    `Click the <b>toggle</b> (on hover) to enable/disable a dataset — disabled datasets are hidden from the plot and excluded from fitting, residual panels, and the F-test.<br><br>` +
    `Double-click a name to rename it.<br><br>` +
    `<b>Ctrl/⌘-click</b> two or more datasets to multi-select them, then press <b>⊕ Combine</b> to merge them into one (mean ± σ if they share an x-grid, otherwise pooled) for a single combined fit.`,

  'active-fits':
    `<b>Active Fits</b><br>Lists every fit run in this tab. Click a fit to make it active — its parameters and result load into the right panel.<br><br>` +
    `The coloured dot matches the fit curve on the plot. Hover a fit for a quick stats summary. Use <b>✕</b> to delete individual fits.`,

  'target-dataset':
    `<b>Target Dataset</b><br>Selects which dataset the solver runs against when you press <b>▶ Fit</b>. Only non-masked points from this dataset are used.`,

  'point-masking':
    `<b>Data Preparation</b><br>Clean, transform, and mask the active dataset before fitting. Masked points stay visible as hollow markers but are excluded from the optimisation.<br><br>` +
    `<b>Mask 2.5σ</b> — exclude all points where |residual| &gt; 2.5 × RMSE for the active fit.<br>` +
    `<b>Unmask All</b> — restore all masked points for the active dataset.<br>` +
    `<b>Pre-Process…</b> — open the Pre-Process panel: Smoothing, Fourier filter, Normalize / Transform, Baseline / De-trend, and Repair / Impute — each reversible via ↶ Undo Step or Restore Original.<br>` +
    `<b>Data Table</b> — per-point view with checkboxes, live residuals, and bulk exclude / include controls.`,

  'fit-model':
    `<b>Fit Model</b><br>The mathematical equation to fit to the data. 58 built-in models are grouped by type.<br><br>` +
    `Select <b>Custom Equation</b> to type any expression in <code>x</code> — parameters are detected automatically from symbol names (any symbol other than <code>x</code> and math functions).<br><br>` +
    `Use <b>Try All</b> in the toolbar to fit every model at once and rank by R².`,

  'custom-eq':
    `<b>Custom Equation</b><br>Type any expression in the variable <code>x</code> using Math.js syntax. All symbols other than <code>x</code> and standard math functions become free parameters.<br><br>` +
    `<b>Examples:</b> <code>a*exp(-b*x)+c</code> &nbsp; <code>a*x^b+c</code> &nbsp; <code>a/(1+exp(-b*(x-c)))</code><br><br>` +
    `Supported: <code>exp log sin cos sqrt abs atan ^</code>, special functions <code>erf erfc lgamma factorial</code>, and all Math.js built-ins. Click <b>⊞ Equation Editor</b> for a click-to-insert palette.`,

  'constraints':
    `<b>Constraints</b><br>Everything constraining the fit shows here as removable chips. The menu only offers types that fit the current model's parameter count.<br><br>` +
    `<b>Box bounds</b> (grey chips) mirror each parameter's Min/Max — set them in the table or via the presets (≥ 0, ≤ 0, 0–1, custom range); clearing the chip clears the bound.<br>` +
    `<b>Coupled constraints</b> (teal chips): • <b>A ≤ B</b> • <b>A = B</b> • <b>Σ = value</b> (e.g. fractions sum to 1) • <b>Σ ≤ value</b>.<br><br>` +
    `All are enforced by projection at every solver step. Note: when a coupled constraint (or an active box bound) sits at the optimum, the reported standard errors / CIs become approximate.`,

  'parameters':
    `<b>Parameters</b><br>One row per model parameter.<br><br>` +
    `<b>Init</b> — starting guess; preserved across refits.<br>` +
    `<b>Min / Max</b> — optional box constraints; leave blank for unconstrained.<br>` +
    `<b>Fit</b> — converged value; hover to see ± std error.<br>` +
    `<b>🔒</b> — lock a parameter at its Init value; useful for fixing known constants while optimising the rest.<br>` +
    `<b>Sweep slider</b> — drag to preview the model curve in real time without fitting.<br><br>` +
    `Click <b>Auto Init</b> to estimate starting values from the data shape.`,

  'algorithm-options':
    `<b>Algorithm Options</b><br>Controls how the nonlinear solver runs.<br><br>` +
    `<b>Solver</b> — LM (robust default) · Gauss-Newton (faster near solution) · Nelder-Mead (derivative-free, good on noisy surfaces) · BFGS (quasi-Newton, fast on smooth problems).<br>` +
    `<b>Max Iter</b> — iteration limit before the solver stops.<br>` +
    `<b>Tolerance</b> — convergence threshold; smaller = more precise but slower.<br>` +
    `<b>Multi-start</b> — number of random pilot runs to escape local minima (1 = off, 8 = default, ~4× compute cost).<br>` +
    `<b>Weights</b> — None/OLS (equal) · 1/y² (relative errors) · 1/|y| (intermediate) · Huber IRLS (robust, down-weights outliers, 5 reweighting iterations) · 1/σ² (requires a σ uncertainty column).`,

  'plot-labels':
    `<b>Plot Labels</b><br>Sets the X axis title, Y axis title, and plot title shown on the figure.<br><br>` +
    `Click <b>⚙ Style</b> for full graph style control: global font, background colors, grid lines, zero lines, axis spines, tick labels, legend, log axes, and axis min/max/tick spacing.`,

  'annotations':
    `<b>Annotations</b><br>Adds overlay graphics to the Plotly figure. Three types:<br><br>` +
    `<b>Horizontal line</b> — reference at a fixed Y value (e.g. detection limit, half-max threshold).<br>` +
    `<b>Vertical line</b> — reference at a fixed X value (e.g. time point, dose level).<br>` +
    `<b>Text callout</b> — free text at any (X, Y) coordinate, with optional arrow.<br><br>` +
    `<b>Peaks</b> — auto-annotates peak centres of visible Gaussian or Lorentzian fits, coloured to match the fit curve.<br><br>` +
    `Annotations are saved with the session file.`,

  'fit-curve-points':
    `<b>Fit Curve Points</b><br>Number of evenly-spaced X values used to draw the smooth fit curve. Higher = smoother curve but slightly slower to render.<br><br>` +
    `300 is sufficient for most models. Increase to 1000+ for highly oscillatory or rapidly-varying functions where the default looks jagged.`,

  'extrapolation-range':
    `<b>Extrapolation Range</b><br>Sets the X range over which the fit curve is drawn — independent of the data extent. Leave blank to use the data range automatically.<br><br>` +
    `Also sets the search domain used by <b>Y → X calibration</b> in Predict / Solve. Click <b>Reset</b> to revert to the data range.`,

  'predict-solve':
    `<b>Predict / Solve</b><br>Evaluates the active fit at a specific input value.<br><br>` +
    `<b>X → Y (predict)</b> — type an X; returns Ŷ with 95% CI half-width from Jacobian gradient propagation through the covariance matrix.<br>` +
    `<b>Y → X (calibrate)</b> — type a target Y; finds all X solutions numerically via 500-point grid scan + bisection. Returns IC50, EC50, K<sub>m</sub>, half-life, and calibration inverses directly with CI via the delta method.`,

  'ftest':
    `<b>F-test (Model Comparison)</b><br>Tests whether a more complex model fits significantly better than a simpler one on the <i>same dataset</i>.<br><br>` +
    `F = [(SSE₁ − SSE₂) / Δp] / [SSE₂ / (n − p₂)]<br><br>` +
    `Select fit A and fit B — the simpler model (fewer parameters) is automatically the null hypothesis.<br><br>` +
    `<b>p &lt; 0.05</b> — extra parameters are statistically justified at α = 0.05.<br>` +
    `<b>p ≥ 0.05</b> — simpler model is adequate; prefer it by parsimony.`,

  'ex-model-params':
    `<b>Model Parameters</b><br>Controls the shape and scale of the generated signal — these match the physical parameters of the chosen example model (e.g. amplitude, time constant, EC50).<br><br>` +
    `<b>Noise (σ)</b> — standard deviation of the per-point Gaussian noise added to the clean signal.<br>` +
    `<b>Outlier count</b> — number of random outlier points injected.<br>` +
    `<b>Outlier scale</b> — how many σ the outliers deviate from the curve.`,

  'ex-extra-noise':
    `<b>Additional Background Noise</b><br>Layers an extra independent noise distribution on top of the per-example Gaussian noise. All types share the same σ convention (same variance for the given Amplitude).<br><br>` +
    `<b>None</b> — no extra noise added.<br>` +
    `<b>Gaussian</b> — bell-curve noise; Amplitude = σ.<br>` +
    `<b>Uniform (white)</b> — equal probability across [−A√3, +A√3] — same variance as Gaussian with the same amplitude.<br>` +
    `<b>Laplacian (heavy-tail)</b> — symmetric exponential distribution; heavier tails than Gaussian, common in natural images, audio, and impulsive interference.<br><br>` +
    `Set <b>Amplitude = 0</b> to disable.`,

  'ex-freq-noise':
    `<b>Sinusoidal Interference</b><br>Adds up to 3 independent periodic components — useful for simulating powerline hum, mechanical vibration, carrier bleed-through, or any periodic artefact.<br><br>` +
    `<b>Amplitude</b> — peak height of the sine wave in y-axis units. Set to 0 to skip that component.<br>` +
    `<b>Freq (cyc/range)</b> — frequency expressed as cycles per full x-span: 1 = one complete sine wave across the dataset, 5 = five cycles, 0.5 = half a cycle.<br>` +
    `<b>Phase (0–1)</b> — starting phase as a fraction of 2π: 0 = sine (starts at 0), 0.25 = cosine (starts at peak), 0.5 = inverted sine.`,

  'corr-matrix':
    `<b>Pearson correlation between each pair of parameters</b>, derived from the covariance matrix.<br><br>` +
    `<b>1.00</b> (diagonal) — a parameter always correlates perfectly with itself.<br>` +
    `<b>Near 0</b> — parameters are independent; each is well-determined on its own.<br>` +
    `<b>Near +1</b> — parameters increase together; the solver struggles to tell them apart.<br>` +
    `<b>Near −1</b> — parameters trade off; one can compensate for the other.<br><br>` +
    `<b>|r| &gt; 0.95</b> is a warning: the model may be over-parameterised. Try locking one parameter (🔒) or choosing a simpler model.<br><br>` +
    `<span style="color:#2563eb">■</span> Blue = positive &nbsp; <span style="color:#dc2626">■</span> Red = negative`,
};

(function wirePanelTips() {
  const tt = document.getElementById('ui-tooltip');
  if (!tt) return;
  function showTip(el) {
    tt.innerHTML = PANEL_TIPS[el.dataset.tip] || el.dataset.tip;
    tt.style.display = 'block';
    const r   = el.getBoundingClientRect();
    const ttW = tt.offsetWidth, ttH = tt.offsetHeight;
    tt.style.left = Math.min(Math.max(4, r.left), window.innerWidth - ttW - 8) + 'px';
    tt.style.top  = (window.innerHeight - r.bottom - 6 >= ttH) ? (r.bottom + 6) + 'px' : Math.max(4, r.top - ttH - 6) + 'px';
  }
  const hideTip = () => { tt.style.display = 'none'; };
  // Hover AND keyboard focus (the tips are the app's primary docs)
  document.addEventListener('mouseover', e => { const el = e.target.closest('.panel-tip'); if (el) showTip(el); });
  document.addEventListener('mouseout',  e => { if (e.target.closest('.panel-tip')) hideTip(); });
  document.addEventListener('focusin',   e => { const el = e.target.closest('.panel-tip'); if (el) showTip(el); });
  document.addEventListener('focusout',  e => { if (e.target.closest('.panel-tip')) hideTip(); });
  document.addEventListener('keydown',   e => { if (e.key === 'Escape') hideTip(); });
})();

})();
