(function () {
'use strict';

/* ═══════════════════════════════════════════════════════════
   ACCESSIBILITY PANEL
═══════════════════════════════════════════════════════════ */
const accBtn    = document.getElementById('accBtn');
const accPanel  = document.getElementById('accPanel');
const darkToggle = document.getElementById('darkToggle');

function applyPrefs() {
  const dark = localStorage.getItem('dark') === '1';
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
accBtn.addEventListener('click', e => { e.stopPropagation(); accPanel.classList.toggle('open'); });
document.addEventListener('click', e => { if (!accPanel.contains(e.target) && e.target !== accBtn) accPanel.classList.remove('open'); });
darkToggle.addEventListener('change', () => {
  localStorage.setItem('dark', darkToggle.checked ? '1' : '0');
  applyPrefs();
  setTimeout(() => { if (state.datasets.length) updatePlots(); }, 80);
});
document.querySelectorAll('[data-size]').forEach(b => b.addEventListener('click', () => { localStorage.setItem('size', b.dataset.size); applyPrefs(); }));
document.querySelectorAll('[data-font]').forEach(b => b.addEventListener('click', () => { localStorage.setItem('font', b.dataset.font); applyPrefs(); }));

/* ═══════════════════════════════════════════════════════════
   MATH UTILITIES
═══════════════════════════════════════════════════════════ */
function mean(arr) { return arr.reduce((s, v) => s + v, 0) / arr.length; }
function sumArr(arr) { return arr.reduce((s, v) => s + v, 0); }
function linspace(a, b, n) {
  if (n < 2) return [a];
  return Array.from({ length: n }, (_, i) => a + (b - a) * i / (n - 1));
}

function solveLinear(A, b) {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let maxRow = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(M[row][col]) > Math.abs(M[maxRow][col])) maxRow = row;
    }
    [M[col], M[maxRow]] = [M[maxRow], M[col]];
    const pivot = M[col][col];
    if (Math.abs(pivot) < 1e-14) continue;
    for (let j = col; j <= n; j++) M[col][j] /= pivot;   // divide by saved pivot
    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const f = M[row][col];
      for (let j = col; j <= n; j++) M[row][j] -= f * M[col][j];
    }
  }
  return M.map(row => row[n]);
}

function invertMatrix(M) {
  const n = M.length;
  const aug = M.map((row, i) => [...row, ...Array.from({ length: n }, (_, j) => i === j ? 1 : 0)]);
  for (let col = 0; col < n; col++) {
    let maxRow = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(aug[row][col]) > Math.abs(aug[maxRow][col])) maxRow = row;
    }
    [aug[col], aug[maxRow]] = [aug[maxRow], aug[col]];
    if (Math.abs(aug[col][col]) < 1e-14) return null;
    const piv = aug[col][col];
    for (let j = 0; j < 2 * n; j++) aug[col][j] /= piv;
    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const f = aug[row][col];
      for (let j = 0; j < 2 * n; j++) aug[row][j] -= f * aug[col][j];
    }
  }
  return aug.map(row => row.slice(n));
}

function fmt(v, precision) {
  if (!isFinite(v)) return '—';
  const p = precision == null ? 5 : precision;
  if (v === 0) return '0';
  const abs = Math.abs(v);
  if (abs >= 1e4 || (abs < 1e-3 && abs > 0)) return v.toExponential(3);
  return v.toPrecision(p).replace(/\.?0+$/, '');
}

/* ═══════════════════════════════════════════════════════════
   FITTING ENGINE — LEVENBERG-MARQUARDT
═══════════════════════════════════════════════════════════ */
function levenbergMarquardt(fn, xArr, yArr, p0, opts) {
  opts = opts || {};
  const maxIter = opts.maxIter || 1000;
  const tol     = opts.tol != null ? parseFloat(opts.tol) || 1e-8 : 1e-8;
  const EPS     = 1e-7;

  const n = xArr.length;
  const m = p0.length;

  let p = p0.map(Number);
  let lambda = 1e-2;
  let converged = false;
  let iter = 0;

  function evalResiduals(params) {
    return xArr.map((x, i) => {
      const yp = fn(x, params);
      return isFinite(yp) ? yArr[i] - yp : 0;
    });
  }

  function sse(r) { return r.reduce((s, v) => s + v * v, 0); }

  function jacobian(params, r0) {
    const cols = [];
    for (let j = 0; j < m; j++) {
      const pp = params.slice();
      const h = Math.max(Math.abs(params[j]) * EPS, EPS);
      pp[j] += h;
      const r1 = evalResiduals(pp);
      cols.push(r1.map((v, i) => (v - r0[i]) / h));
    }
    return cols; // cols[j][i] = dr_i/dp_j
  }

  for (iter = 0; iter < maxIter; iter++) {
    const r = evalResiduals(p);
    const curSSE = sse(r);
    if (!isFinite(curSSE)) break;

    const J = jacobian(p, r);

    // JtJ[a][b] = Σ J[a][i]*J[b][i]
    const JtJ = Array.from({ length: m }, (_, a) =>
      Array.from({ length: m }, (_, b) =>
        J[a].reduce((s, _, i) => s + J[a][i] * J[b][i], 0)
      )
    );
    // β = −J_r^T r  (right-hand side of normal equations: drives p toward lower SSE)
    // Gauss-Newton step: solve (J_r^T J_r + λD) δ = −J_r^T r, then p_new = p + δ
    const beta = J.map(col => col.reduce((s, v, i) => s - v * r[i], 0));

    // Augment diagonal
    const A = JtJ.map((row, a) =>
      row.map((v, b) => a === b ? v * (1 + lambda) + 1e-10 : v)
    );

    let delta;
    try { delta = solveLinear(A, beta); } catch (_) { lambda *= 10; continue; }
    if (!delta.every(isFinite)) { lambda *= 10; continue; }

    const pNew = p.map((v, i) => v + delta[i]);
    const rNew = evalResiduals(pNew);
    const newSSE = sse(rNew);

    if (newSSE < curSSE) {
      p = pNew;
      lambda = Math.max(lambda / 3, 1e-12);
      const stepNorm = Math.sqrt(delta.reduce((s, d) => s + d * d, 0));
      if (stepNorm < tol && Math.abs(curSSE - newSSE) < tol) { converged = true; break; }
    } else {
      lambda = Math.min(lambda * 10, 1e12);
    }
  }

  const r = evalResiduals(p);
  const sseVal = sse(r);
  const yMean = mean(yArr);
  const sst = yArr.reduce((s, v) => s + (v - yMean) ** 2, 0);
  const rSq = sst < 1e-15 ? 1 : Math.max(0, 1 - sseVal / sst);
  const adjRSq = sst < 1e-15 ? 1 : 1 - (1 - rSq) * Math.max(n - 1, 1) / Math.max(n - m - 1, 1);
  const rmse = Math.sqrt(sseVal / Math.max(n - m, 1));
  const aic = n * Math.log(Math.max(sseVal / n, 1e-20)) + 2 * m;
  const bic = n * Math.log(Math.max(sseVal / n, 1e-20)) + m * Math.log(n);

  // Parameter standard errors
  let paramErrors = p.map(() => NaN);
  try {
    const J = jacobian(p, r);
    const JtJ = Array.from({ length: m }, (_, a) =>
      Array.from({ length: m }, (_, b) => J[a].reduce((s, _, i) => s + J[a][i] * J[b][i], 0))
    );
    const sig2 = sseVal / Math.max(n - m, 1);
    const inv = invertMatrix(JtJ);
    if (inv) paramErrors = inv.map((row, i) => Math.sqrt(Math.abs(sig2 * row[i])));
  } catch (_) {}

  return { params: p, paramErrors, rSq, adjRSq, rmse, sse: sseVal, aic, bic, converged, iter, n, residuals: r };
}

/* ── Analytic polynomial ─────────────────────────────────── */
function fitPolynomialAnalytic(degree, xArr, yArr) {
  const n = xArr.length;
  const m = degree + 1;
  // Vandermonde: V[i][j] = x_i^(degree-j)
  const V = xArr.map(x => Array.from({ length: m }, (_, j) => Math.pow(x, degree - j)));
  // Normal eqs: (V^T V) c = V^T y
  const VtV = Array.from({ length: m }, (_, a) =>
    Array.from({ length: m }, (_, b) => V.reduce((s, row) => s + row[a] * row[b], 0))
  );
  const Vty = Array.from({ length: m }, (_, a) => V.reduce((s, row, i) => s + row[a] * yArr[i], 0));
  const coeffs = solveLinear(VtV, Vty);
  const yFit = xArr.map(x => coeffs.reduce((s, c, j) => s + c * Math.pow(x, degree - j), 0));
  const residuals = yArr.map((y, i) => y - yFit[i]);
  const sseVal = residuals.reduce((s, r) => s + r * r, 0);
  const yMean = mean(yArr);
  const sst = yArr.reduce((s, v) => s + (v - yMean) ** 2, 0);
  const rSq = sst < 1e-15 ? 1 : Math.max(0, 1 - sseVal / sst);
  const adjRSq = sst < 1e-15 ? 1 : 1 - (1 - rSq) * Math.max(n - 1, 1) / Math.max(n - m - 1, 1);
  const rmse = Math.sqrt(sseVal / Math.max(n - m, 1));
  const aic = n * Math.log(Math.max(sseVal / n, 1e-20)) + 2 * m;
  const bic = n * Math.log(Math.max(sseVal / n, 1e-20)) + m * Math.log(n);
  return {
    params: coeffs, paramErrors: coeffs.map(() => NaN),
    rSq, adjRSq, rmse, sse: sseVal, aic, bic,
    converged: true, iter: 0, n, residuals
  };
}

/* ═══════════════════════════════════════════════════════════
   MODELS LIBRARY
═══════════════════════════════════════════════════════════ */
const MODELS = {
  'Linear': {
    params: ['a', 'b'],
    fn: (x, [a, b]) => a * x + b,
    analytic: false,
    autoInit(x, y) {
      const xm = mean(x), ym = mean(y);
      const a = x.reduce((s, xi, i) => s + (xi - xm) * (y[i] - ym), 0) /
                (x.reduce((s, xi) => s + (xi - xm) ** 2, 0) || 1);
      return [a, ym - a * xm];
    }
  },
  'Power': {
    params: ['a', 'b'],
    fn: (x, [a, b]) => a * Math.pow(Math.abs(x) + 1e-12, b),
    analytic: false,
    autoInit(x, y) { return [mean(y) / (mean(x) || 1), 1]; }
  },
  'Polynomial-2': { params: ['c₂','c₁','c₀'], analytic: true, degree: 2 },
  'Polynomial-3': { params: ['c₃','c₂','c₁','c₀'], analytic: true, degree: 3 },
  'Polynomial-4': { params: ['c₄','c₃','c₂','c₁','c₀'], analytic: true, degree: 4 },
  'Polynomial-5': { params: ['c₅','c₄','c₃','c₂','c₁','c₀'], analytic: true, degree: 5 },
  'Polynomial-6': { params: ['c₆','c₅','c₄','c₃','c₂','c₁','c₀'], analytic: true, degree: 6 },
  'Exponential': {
    params: ['a', 'b'],
    fn: (x, [a, b]) => a * Math.exp(b * x),
    analytic: false,
    autoInit(x, y) {
      const pos = y.filter(v => v > 0);
      if (pos.length < 2) return [Math.max(...y.map(Math.abs)) || 1, -0.1];
      const lny = pos.map(Math.log);
      const posX = x.filter((_, i) => y[i] > 0);
      const xm = mean(posX), lym = mean(lny);
      const b = posX.reduce((s, xi, i) => s + (xi - xm) * (lny[i] - lym), 0) /
                (posX.reduce((s, xi) => s + (xi - xm) ** 2, 0) || 1);
      return [Math.exp(lym - b * xm), b];
    }
  },
  'Exp-Decay-Offset': {
    params: ['a', 'b', 'c'],
    fn: (x, [a, b, c]) => a * Math.exp(-b * x) + c,
    analytic: false,
    autoInit(x, y) {
      const c = Math.min(...y);
      const shifted = y.map(v => Math.max(v - c, 1e-10));
      const lny = shifted.map(Math.log);
      const xm = mean(x), lym = mean(lny);
      const b = Math.abs(x.reduce((s, xi, i) => s + (xi - xm) * (lny[i] - lym), 0) /
                (x.reduce((s, xi) => s + (xi - xm) ** 2, 0) || 1)) || 0.1;
      return [Math.exp(mean(lny) + b * xm), b, c];
    }
  },
  'Logistic': {
    params: ['L', 'k', 'x₀'],
    fn: (x, [L, k, x0]) => L / (1 + Math.exp(-k * (x - x0))),
    analytic: false,
    autoInit(x, y) { return [Math.max(...y), 1, mean(x)]; }
  },
  'Gaussian': {
    params: ['A', 'μ', 'σ', 'C'],
    fn: (x, [A, mu, sig, C]) => A * Math.exp(-0.5 * ((x - mu) / (sig || 1e-10)) ** 2) + C,
    analytic: false,
    autoInit(x, y) {
      const C = mean(y);
      const shifted = y.map(v => v - C);
      const maxI = shifted.indexOf(Math.max(...shifted));
      const mu = x[maxI];
      const A = shifted[maxI] || 1;
      const halfAmp = A / 2;
      const half = shifted.findIndex(v => v >= halfAmp);
      const sig = Math.max(Math.abs((x[half] - mu) * 1.5), (Math.max(...x) - Math.min(...x)) / 8);
      return [A, mu, sig, C];
    }
  },
  'Lorentzian': {
    params: ['A', 'x₀', 'γ', 'C'],
    fn: (x, [A, x0, g, C]) => A * g * g / ((x - x0) ** 2 + g * g) + C,
    analytic: false,
    autoInit(x, y) {
      const C = mean(y);
      const shifted = y.map(v => v - C);
      const maxI = shifted.indexOf(Math.max(...shifted));
      const rng = (Math.max(...x) - Math.min(...x)) / 8;
      return [shifted[maxI] || 1, x[maxI], rng, C];
    }
  },
  'Michaelis-Menten': {
    params: ['Vmax', 'Km'],
    fn: (x, [Vm, Km]) => Vm * x / ((Km || 1e-10) + x),
    analytic: false,
    autoInit(x, y) { return [Math.max(...y), mean(x)]; }
  },
  'Hill': {
    params: ['Vmax', 'Kd', 'n'],
    fn: (x, [Vm, Kd, n]) => Vm * Math.pow(x, n) / (Math.pow(Math.abs(Kd), n) + Math.pow(x, n)),
    analytic: false,
    autoInit(x, y) { return [Math.max(...y), mean(x), 1]; }
  },
  'Sine': {
    params: ['A', 'ω', 'φ', 'C'],
    fn: (x, [A, w, phi, C]) => A * Math.sin(w * x + phi) + C,
    analytic: false,
    autoInit(x, y) {
      const amp = (Math.max(...y) - Math.min(...y)) / 2;
      const rng = Math.max(...x) - Math.min(...x);
      return [amp, (2 * Math.PI) / Math.max(rng, 1e-10), 0, mean(y)];
    }
  },
  'Damped-Sine': {
    params: ['A', 'γ', 'ω', 'φ', 'C'],
    fn: (x, [A, g, w, phi, C]) => A * Math.exp(-g * x) * Math.sin(w * x + phi) + C,
    analytic: false,
    autoInit(x, y) {
      const amp = (Math.max(...y) - Math.min(...y)) / 2;
      const rng = Math.max(...x) - Math.min(...x);
      return [amp, 0.1, (2 * Math.PI * 2) / Math.max(rng, 1e-10), 0, mean(y)];
    }
  },
  'Weibull': {
    params: ['λ', 'k'],
    fn: (x, [lam, k]) => 1 - Math.exp(-Math.pow(Math.max(x, 1e-12) / (lam || 1e-10), k)),
    analytic: false,
    autoInit(x) { return [mean(x), 2]; }
  },
  'Custom': {
    params: [],
    fn: null,
    analytic: false,
    autoInit() { return []; }
  }
};

/* ═══════════════════════════════════════════════════════════
   EXAMPLE DATASETS
═══════════════════════════════════════════════════════════ */
function addNoise(arr, sigma) {
  return arr.map(v => v + (Math.random() - 0.5) * 2 * sigma);
}
function gauss() {
  let u, v;
  do { u = Math.random() * 2 - 1; v = Math.random() * 2 - 1; } while (u * u + v * v > 1);
  return u * Math.sqrt(-2 * Math.log(u * u + v * v) / (u * u + v * v));
}
function noisyGauss(arr, sigma) { return arr.map(v => v + gauss() * sigma); }

const EXAMPLES = {
  'exponential-decay': () => {
    const t = linspace(0, 20, 24);
    const y = noisyGauss(t.map(x => 95 * Math.exp(-0.18 * x) + 2), 1.5);
    return { name: 'Exp Decay (Radioactive)', x: t, y, xlabel: 'Time (s)', ylabel: 'Activity (Bq)', suggestModel: 'Exp-Decay-Offset' };
  },
  'gaussian-peak': () => {
    const x = linspace(-6, 6, 40);
    const y = noisyGauss(x.map(xi => 120 * Math.exp(-0.5 * ((xi - 0.5) / 1.2) ** 2) + 5), 3);
    return { name: 'Gaussian Peak (Spectroscopy)', x, y, xlabel: 'Wavenumber (cm⁻¹)', ylabel: 'Absorbance', suggestModel: 'Gaussian' };
  },
  'logistic-growth': () => {
    const t = linspace(0, 48, 32);
    const y = noisyGauss(t.map(x => 1e6 / (1 + Math.exp(-0.18 * (x - 20)))), 1.5e4);
    return { name: 'Logistic Growth (Cell Culture)', x: t, y, xlabel: 'Time (h)', ylabel: 'Cell Count', suggestModel: 'Logistic' };
  },
  'michaelis-menten': () => {
    const S = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 40, 80, 150, 250];
    const y = noisyGauss(S.map(s => 450 * s / (12 + s)), 8);
    return { name: 'Michaelis-Menten (Enzyme Kinetics)', x: S, y, xlabel: '[S] (mM)', ylabel: 'v (μmol·min⁻¹)', suggestModel: 'Michaelis-Menten' };
  },
  'damped-oscillation': () => {
    const t = linspace(0, 10, 60);
    const y = noisyGauss(t.map(x => 8 * Math.exp(-0.3 * x) * Math.sin(3.2 * x + 0.5)), 0.3);
    return { name: 'Damped Oscillation (Vibration)', x: t, y, xlabel: 'Time (s)', ylabel: 'Displacement (mm)', suggestModel: 'Damped-Sine' };
  },
  'linear-calibration': () => {
    const c = linspace(0, 10, 18);
    const y = noisyGauss(c.map(x => 2.45 * x + 0.12), 0.15);
    return { name: 'Linear Calibration', x: c, y, xlabel: 'Concentration (mM)', ylabel: 'Absorbance', suggestModel: 'Linear' };
  }
};

/* ═══════════════════════════════════════════════════════════
   APPLICATION STATE
═══════════════════════════════════════════════════════════ */
const DS_COLORS = ['#0b7a6e','#2563eb','#dc2626','#7c3aed','#f59e0b','#15803d','#c2410c','#db2777','#0891b2'];
let colorIdx = 0;
let idCounter = 0;
function nextId() { return ++idCounter; }
function nextColor() { return DS_COLORS[colorIdx++ % DS_COLORS.length]; }

const state = {
  datasets: [],    // {id, name, x, y, color, visible}
  fits: [],        // {id, dsId, model, params, result, color, visible, label}
  activeDatasetId: null,
  activeFitId: null,
  fitConfig: { model: 'Exponential', customExpr: 'a * exp(-b * x) + c', customParams: [] },
  plotConfig: { showResiduals: true, logX: false, logY: false },
  paramRows: [],   // [{name, init, min, max}]  — live init guess state
};

/* ═══════════════════════════════════════════════════════════
   DATA PARSING
═══════════════════════════════════════════════════════════ */
function detectDelimiter(text) {
  const sample = text.slice(0, 500);
  const counts = { ',': 0, '\t': 0, ';': 0, ' ': 0 };
  for (const ch of sample) if (ch in counts) counts[ch]++;
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

function parseDelimited(text, delim) {
  if (delim === 'auto' || !delim) delim = detectDelimiter(text);
  const lines = text.trim().split(/\r?\n/).filter(l => l.trim());
  const rows = lines.map(l => l.split(delim).map(s => s.trim()));
  return rows;
}

function rowsToXY(rows) {
  let startRow = 0;
  const firstRow = rows[0];
  const isHeader = firstRow.some(v => isNaN(parseFloat(v.replace(',', '.'))));
  if (isHeader) startRow = 1;
  const xs = [], ys = [];
  for (let i = startRow; i < rows.length; i++) {
    const row = rows[i];
    if (row.length < 2) continue;
    const x = parseFloat(row[0].replace(',', '.'));
    const y = parseFloat(row[1].replace(',', '.'));
    if (isFinite(x) && isFinite(y)) { xs.push(x); ys.push(y); }
  }
  return { x: xs, y: ys };
}

function importDataset(name, x, y, color) {
  if (!x.length || !y.length) return null;
  const ds = { id: nextId(), name: name || `Dataset ${state.datasets.length + 1}`, x, y, color: color || nextColor(), visible: true };
  state.datasets.push(ds);
  if (!state.activeDatasetId) state.activeDatasetId = ds.id;
  return ds;
}

/* ═══════════════════════════════════════════════════════════
   PLOT ENGINE
═══════════════════════════════════════════════════════════ */
let plotsInitialised = false;

function isDark() { return document.body.classList.contains('dark-mode'); }

function themeColors() {
  const dark = isDark();
  return {
    plotBg:   dark ? '#0a1628' : '#ffffff',
    paperBg:  dark ? '#060e1c' : '#f8f9fc',
    gridCol:  dark ? '#1c3050' : '#e8ebf2',
    zeroLine: dark ? '#2d4a6e' : '#c5cad8',
    textCol:  dark ? '#7a90ae' : '#4a5568',
    teal:     dark ? '#2dd4bf' : '#0b7a6e',
    tickCol:  dark ? '#5a7090' : '#718096',
  };
}

function baseLayout(extra) {
  const tc = themeColors();
  const base = {
    plot_bgcolor:  tc.plotBg,
    paper_bgcolor: tc.paperBg,
    margin: { l: 52, r: 16, t: 28, b: 44 },
    font: { family: "'DM Mono', monospace", size: 11, color: tc.textCol },
    xaxis: {
      gridcolor: tc.gridCol, zerolinecolor: tc.zeroLine,
      tickfont: { size: 10, color: tc.tickCol }, linecolor: tc.gridCol,
      type: state.plotConfig.logX ? 'log' : 'linear',
    },
    yaxis: {
      gridcolor: tc.gridCol, zerolinecolor: tc.zeroLine,
      tickfont: { size: 10, color: tc.tickCol }, linecolor: tc.gridCol,
      type: state.plotConfig.logY ? 'log' : 'linear',
    },
    legend: {
      font: { size: 10, color: tc.textCol },
      bgcolor: isDark() ? 'rgba(10,22,40,0.82)' : 'rgba(255,255,255,0.82)',
      bordercolor: tc.gridCol, borderwidth: 1,
      x: 0.99, y: 0.99, xanchor: 'right', yanchor: 'top',
    },
    hovermode: 'closest',
    showlegend: true,
  };
  return Object.assign(base, extra || {});
}

function buildMainTraces() {
  const traces = [];
  for (const ds of state.datasets) {
    if (!ds.visible) continue;
    traces.push({
      x: ds.x, y: ds.y,
      mode: 'markers',
      type: 'scatter',
      name: ds.name,
      marker: { color: ds.color, size: 6, opacity: 0.85 },
      showlegend: true,
    });
  }
  for (const fit of state.fits) {
    if (!fit.visible || !fit.result) continue;
    const ds = state.datasets.find(d => d.id === fit.dsId);
    if (!ds) continue;
    const xs = linspace(Math.min(...ds.x), Math.max(...ds.x), fit.curvePoints || 300);
    const ys = xs.map(x => {
      const v = fitEval(fit, x);
      return isFinite(v) ? v : null;
    });
    traces.push({
      x: xs, y: ys,
      mode: 'lines', type: 'scatter',
      name: fit.label || fit.model,
      line: { color: fit.color || ds.color, width: 2, dash: 'solid' },
      showlegend: true,
    });
  }
  return traces;
}

function buildResidualTraces() {
  const traces = [];
  for (const fit of state.fits) {
    if (!fit.visible || !fit.result) continue;
    const ds = state.datasets.find(d => d.id === fit.dsId);
    if (!ds) continue;
    const residuals = fit.result.residuals;
    traces.push({
      x: ds.x, y: residuals,
      mode: 'markers', type: 'scatter',
      name: fit.label || fit.model,
      marker: { color: fit.color || ds.color, size: 5, opacity: 0.8 },
      showlegend: false,
    });
    traces.push({
      x: [Math.min(...ds.x), Math.max(...ds.x)], y: [0, 0],
      mode: 'lines', type: 'scatter',
      line: { color: themeColors().gridCol, width: 1, dash: 'dot' },
      showlegend: false, hoverinfo: 'skip',
    });
  }
  return traces;
}

function updatePlots() {
  const tc = themeColors();
  const xlabel = document.getElementById('plot-xlabel').value || 'x';
  const ylabel = document.getElementById('plot-ylabel').value || 'y';
  const title  = document.getElementById('plot-title').value || '';
  const mainTraces = buildMainTraces();
  const mainLayout = baseLayout({
    title: title ? { text: title, font: { size: 13, color: tc.textCol }, x: 0.5 } : undefined,
    xaxis: Object.assign(baseLayout().xaxis, { title: { text: xlabel, font: { size: 11, color: tc.tickCol } } }),
    yaxis: Object.assign(baseLayout().yaxis, { title: { text: ylabel, font: { size: 11, color: tc.tickCol } } }),
    margin: { l: 56, r: 20, t: title ? 36 : 18, b: 44 },
  });

  const mainEl  = document.getElementById('main-plot');
  const residEl = document.getElementById('residual-plot');

  if (!plotsInitialised) {
    Plotly.newPlot(mainEl, mainTraces, mainLayout, { responsive: true, displaylogo: false, modeBarButtonsToRemove: ['sendDataToCloud','editInChartStudio'] });
    const resTraces = buildResidualTraces();
    const resLayout = baseLayout({
      margin: { l: 56, r: 20, t: 10, b: 36 },
      yaxis: Object.assign(baseLayout().yaxis, { title: { text: 'Residuals', font: { size: 10, color: tc.tickCol } }, zeroline: true }),
      xaxis: Object.assign(baseLayout().xaxis, { title: { text: xlabel, font: { size: 10, color: tc.tickCol } } }),
      showlegend: false,
    });
    Plotly.newPlot(residEl, resTraces, resLayout, { responsive: true, displaylogo: false, staticPlot: false, modeBarButtonsToRemove: ['sendDataToCloud','editInChartStudio'] });
    plotsInitialised = true;
  } else {
    Plotly.react(mainEl, mainTraces, mainLayout);
    const resTraces = buildResidualTraces();
    const resLayout = baseLayout({
      margin: { l: 56, r: 20, t: 10, b: 36 },
      yaxis: Object.assign(baseLayout().yaxis, { title: { text: 'Residuals', font: { size: 10, color: tc.tickCol } }, zeroline: true }),
      xaxis: Object.assign(baseLayout().xaxis, { title: { text: xlabel, font: { size: 10, color: tc.tickCol } } }),
      showlegend: false,
    });
    Plotly.react(residEl, resTraces, resLayout);
  }
}

function fitEval(fit, x) {
  if (!fit.fn) return NaN;
  try { return fit.fn(x, fit.result.params); } catch (_) { return NaN; }
}

/* ═══════════════════════════════════════════════════════════
   UI RENDERING
═══════════════════════════════════════════════════════════ */
function renderDatasetList() {
  const el = document.getElementById('dataset-list');
  if (!state.datasets.length) {
    el.innerHTML = '<div class="panel-empty-hint">Load an example<br>or import a CSV to begin.</div>';
    return;
  }
  el.innerHTML = state.datasets.map(ds => `
    <div class="ds-item${ds.id === state.activeDatasetId ? ' active' : ''}" data-dsid="${ds.id}">
      <span class="ds-swatch" style="background:${ds.color}"></span>
      <span class="ds-label" title="${ds.name}">${ds.name}</span>
      <span class="ds-count">${ds.x.length}pt</span>
    </div>`).join('');
  el.querySelectorAll('.ds-item').forEach(el => {
    el.addEventListener('click', () => {
      state.activeDatasetId = parseInt(el.dataset.dsid);
      syncFitDatasetSelect();
      renderDatasetList();
      renderFitList();
    });
  });
}

function renderFitList() {
  const el = document.getElementById('fit-list');
  const cnt = document.getElementById('fit-count');
  cnt.textContent = state.fits.length;
  if (!state.fits.length) {
    el.innerHTML = '<div class="panel-empty-hint">Press <strong>▶ Fit</strong><br>after loading data.</div>';
    return;
  }
  el.innerHTML = state.fits.map(fit => `
    <div class="fit-item${fit.id === state.activeFitId ? ' active' : ''}" data-fitid="${fit.id}">
      <span class="ds-swatch" style="background:${fit.color}"></span>
      <span class="ds-label">
        <span style="display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${fit.label}</span>
        <span class="fit-item-eq">${fit.model}</span>
      </span>
    </div>`).join('');
  el.querySelectorAll('.fit-item').forEach(el => {
    el.addEventListener('click', () => {
      state.activeFitId = parseInt(el.dataset.fitid);
      renderFitList();
      const fit = state.fits.find(f => f.id === state.activeFitId);
      if (fit && fit.result) renderStats(fit);
    });
  });
}

function renderParamTable() {
  const model = state.fitConfig.model;
  const m = MODELS[model];
  const container = document.getElementById('param-table-container');

  // For Custom, params come from state.fitConfig.customParams
  const paramNames = model === 'Custom' ? state.fitConfig.customParams : (m ? m.params : []);
  if (m && m.analytic) {
    container.innerHTML = `<div class="panel-empty-hint" style="text-align:left;padding:6px 0;font-size:.72em">Analytic fit — no initial values needed.</div>`;
    state.paramRows = paramNames.map(name => ({ name, init: 1, min: -Infinity, max: Infinity }));
    return;
  }
  if (!paramNames.length) {
    container.innerHTML = '<div class="panel-empty-hint">No parameters.</div>';
    state.paramRows = [];
    return;
  }
  // Preserve existing values for same names
  const prev = {};
  state.paramRows.forEach(r => { prev[r.name] = r; });
  state.paramRows = paramNames.map(name => ({
    name,
    init: prev[name] ? prev[name].init : 1,
    min: prev[name] ? prev[name].min : -1e10,
    max: prev[name] ? prev[name].max : 1e10,
  }));

  container.innerHTML = state.paramRows.map((row, i) => `
    <div class="param-row" data-pi="${i}">
      <span class="param-name">${row.name}</span>
      <input class="param-input" data-field="init" type="number" value="${fmt(row.init)}" step="any" title="Initial value">
      <input class="param-input" data-field="min"  type="number" value="${row.min <= -1e9 ? '' : fmt(row.min)}" step="any" title="Lower bound (leave blank for -∞)">
      <input class="param-input" data-field="max"  type="number" value="${row.max >= 1e9 ? '' : fmt(row.max)}" step="any" title="Upper bound (leave blank for +∞)">
    </div>`).join('');

  container.querySelectorAll('.param-row').forEach(row => {
    const i = parseInt(row.dataset.pi);
    row.querySelectorAll('.param-input').forEach(inp => {
      inp.addEventListener('change', () => {
        const v = parseFloat(inp.value);
        if (isFinite(v)) state.paramRows[i][inp.dataset.field] = v;
        else if (inp.dataset.field === 'min') state.paramRows[i].min = -1e10;
        else if (inp.dataset.field === 'max') state.paramRows[i].max = 1e10;
      });
    });
  });
}

function renderParamResults(fit) {
  if (!fit || !fit.result) return;
  const container = document.getElementById('param-table-container');
  const rows = container.querySelectorAll('.param-row');
  const { params, paramErrors } = fit.result;
  rows.forEach((row, i) => {
    const initInp = row.querySelector('[data-field="init"]');
    if (initInp && params[i] != null) {
      initInp.value = fmt(params[i]);
      initInp.style.color = 'var(--teal)';
      state.paramRows[i].init = params[i];
    }
  });
}

function renderStats(fit) {
  const el = document.getElementById('app-console');
  if (!fit || !fit.result) {
    el.innerHTML = '<span class="console-hint">No fit selected.</span>';
    return;
  }
  const r = fit.result;
  const statusClass = r.converged ? 'console-status-ok' : 'console-status-warn';
  const statusText  = r.converged ? `✓ Converged (${r.iter} iter)` : `⚠ Not converged (${r.iter} iter)`;
  el.innerHTML = `
    <div class="console-stat-grid">
      <div class="console-stat"><span class="console-stat-label">R²</span><span class="console-stat-value">${fmt(r.rSq, 6)}</span></div>
      <div class="console-stat"><span class="console-stat-label">Adj-R²</span><span class="console-stat-value">${fmt(r.adjRSq, 6)}</span></div>
      <div class="console-stat"><span class="console-stat-label">RMSE</span><span class="console-stat-value">${fmt(r.rmse)}</span></div>
      <div class="console-stat"><span class="console-stat-label">SSE</span><span class="console-stat-value">${fmt(r.sse)}</span></div>
      <div class="console-stat"><span class="console-stat-label">AIC</span><span class="console-stat-value">${fmt(r.aic)}</span></div>
      <div class="console-stat"><span class="console-stat-label">BIC</span><span class="console-stat-value">${fmt(r.bic)}</span></div>
      <div class="console-stat"><span class="console-stat-label">N pts</span><span class="console-stat-value">${r.n}</span></div>
      <div class="console-stat"><span class="console-stat-label">Status</span><span class="${statusClass}">${statusText}</span></div>
    </div>`;
}

function setConsole(msg, type) {
  const el = document.getElementById('app-console');
  const cls = type === 'error' ? 'console-status-err' : type === 'warn' ? 'console-status-warn' : 'console-hint';
  el.innerHTML = `<span class="${cls}">${msg}</span>`;
}

function syncFitDatasetSelect() {
  const sel = document.getElementById('fit-dataset-select');
  const cur = sel.value;
  sel.innerHTML = state.datasets.length
    ? state.datasets.map(ds => `<option value="${ds.id}">${ds.name}</option>`).join('')
    : '<option value="">— no dataset loaded —</option>';
  if (state.activeDatasetId) sel.value = state.activeDatasetId;
  else if (cur) sel.value = cur;
}

function syncModelCustomSection() {
  const model = document.getElementById('model-select').value;
  state.fitConfig.model = model;
  document.getElementById('custom-eq-section').style.display = model === 'Custom' ? '' : 'none';
  if (model === 'Custom') {
    // Auto-parse the current equation value immediately on model change
    const eqInput = document.getElementById('custom-eq-input');
    parseCustomEquation(eqInput.value);
  } else {
    renderParamTable();
  }
}

/* ═══════════════════════════════════════════════════════════
   CUSTOM EQUATION PARSING
═══════════════════════════════════════════════════════════ */
let customCompiled = null;

function parseCustomEquation(expr) {
  const statusEl = document.getElementById('custom-eq-status');
  if (!expr.trim()) {
    statusEl.textContent = '';
    return false;
  }
  try {
    const node = math.parse(expr);
    const syms = new Set();
    node.traverse(n => { if (n.type === 'SymbolNode') syms.add(n.name); });
    // Remove known math functions and x
    const mathFns = new Set(['sin','cos','tan','exp','log','log2','log10','sqrt','abs','pi','e','asin','acos','atan','atan2','sinh','cosh','tanh','ceil','floor','round','sign','pow','max','min','mod']);
    syms.delete('x');
    mathFns.forEach(f => syms.delete(f));
    const params = [...syms].sort();
    if (!params.length) {
      statusEl.style.color = 'var(--amber)';
      statusEl.textContent = '⚠ No free parameters detected (only x found)';
    } else {
      statusEl.style.color = 'var(--teal)';
      statusEl.textContent = `✓ Parameters: ${params.join(', ')}`;
    }
    customCompiled = math.compile(expr);
    state.fitConfig.customExpr = expr;
    state.fitConfig.customParams = params;
    renderParamTable();
    return true;
  } catch (err) {
    statusEl.style.color = 'var(--red)';
    statusEl.textContent = `✗ Parse error: ${err.message}`;
    customCompiled = null;
    return false;
  }
}

/* ═══════════════════════════════════════════════════════════
   AUTO INITIAL GUESS
═══════════════════════════════════════════════════════════ */
function autoInitParams() {
  const model = state.fitConfig.model;
  const dsId  = parseInt(document.getElementById('fit-dataset-select').value);
  const ds    = state.datasets.find(d => d.id === dsId);
  if (!ds) { setConsole('No dataset selected for auto-init.', 'warn'); return; }

  const m = MODELS[model];
  if (!m || m.analytic) { setConsole('Analytic model — no init needed.', ''); return; }
  if (!m.autoInit) return;

  const initVals = m.autoInit(ds.x, ds.y);
  state.paramRows.forEach((row, i) => {
    if (initVals[i] != null && isFinite(initVals[i])) row.init = initVals[i];
  });
  renderParamTable();
  setConsole('Auto initial values applied.', '');
}

/* ═══════════════════════════════════════════════════════════
   FIT ENGINE — DISPATCH
═══════════════════════════════════════════════════════════ */
function runFit() {
  const model = state.fitConfig.model;
  const dsId  = parseInt(document.getElementById('fit-dataset-select').value);
  const ds    = state.datasets.find(d => d.id === dsId);
  if (!ds) { setConsole('No dataset selected. Load data first.', 'error'); return; }
  if (ds.x.length < 2) { setConsole('Need at least 2 data points.', 'error'); return; }

  const maxIter = parseInt(document.getElementById('opt-max-iter').value) || 1000;
  const tol     = parseFloat(document.getElementById('opt-tol').value)    || 1e-8;
  const curvePts = parseInt(document.getElementById('opt-curve-pts').value) || 300;

  setConsole('Fitting…', '');

  let result, modelFn, paramNames;
  const m = MODELS[model];

  if (m && m.analytic) {
    const degree = m.degree;
    result = fitPolynomialAnalytic(degree, ds.x, ds.y);
    paramNames = m.params;
    modelFn = (x, p) => p.reduce((s, c, j) => s + c * Math.pow(x, degree - j), 0);
  } else if (model === 'Custom') {
    if (!customCompiled) { setConsole('Parse the custom equation first.', 'error'); return; }
    paramNames = state.fitConfig.customParams;
    if (!paramNames.length) { setConsole('No free parameters in custom equation.', 'error'); return; }
    const compiled = customCompiled;
    modelFn = (x, params) => {
      const scope = { x };
      paramNames.forEach((name, i) => { scope[name] = params[i]; });
      const v = compiled.evaluate(scope);
      return isFinite(v) ? v : NaN;
    };
    const p0 = state.paramRows.length === paramNames.length
      ? state.paramRows.map(r => r.init)
      : paramNames.map(() => 1);
    result = levenbergMarquardt(modelFn, ds.x, ds.y, p0, { maxIter, tol });
  } else if (m && m.fn) {
    paramNames = m.params;
    modelFn = m.fn;
    const p0 = state.paramRows.length === paramNames.length
      ? state.paramRows.map(r => r.init)
      : m.autoInit(ds.x, ds.y);
    result = levenbergMarquardt(modelFn, ds.x, ds.y, p0, { maxIter, tol });
  } else {
    setConsole('Unknown model.', 'error');
    return;
  }

  const fitColor = nextColor();
  const rSqStr   = isFinite(result.rSq) ? ` (R²=${result.rSq.toFixed(4)})` : '';
  const fitLabel = `${model}${rSqStr}`;

  const fitRecord = {
    id: nextId(), dsId, model,
    label: fitLabel, color: fitColor,
    result, fn: modelFn, visible: true,
    paramNames, curvePoints: curvePts,
  };
  state.fits.push(fitRecord);
  state.activeFitId = fitRecord.id;

  renderFitList();
  renderParamResults(fitRecord);
  renderStats(fitRecord);
  updatePlots();
}

/* ═══════════════════════════════════════════════════════════
   EXPORT
═══════════════════════════════════════════════════════════ */
function exportPNG() {
  Plotly.downloadImage('main-plot', { format: 'png', width: 1200, height: 800, filename: 'curve-fit' });
}
function exportSVG() {
  Plotly.downloadImage('main-plot', { format: 'svg', width: 1200, height: 800, filename: 'curve-fit' });
}

function exportCSV() {
  const fit = state.fits.find(f => f.id === state.activeFitId);
  if (!fit || !fit.result) { setConsole('No active fit to export.', 'warn'); return; }
  const ds = state.datasets.find(d => d.id === fit.dsId);
  let csv = `Curve Fitting Studio — Fit Results\nModel: ${fit.model}\nDataset: ${ds ? ds.name : 'unknown'}\n\n`;
  csv += 'Parameter,Value,StdError\n';
  fit.paramNames.forEach((n, i) => {
    csv += `${n},${fit.result.params[i]},${isFinite(fit.result.paramErrors[i]) ? fit.result.paramErrors[i] : 'NaN'}\n`;
  });
  csv += `\nR2,${fit.result.rSq}\nAdjR2,${fit.result.adjRSq}\nRMSE,${fit.result.rmse}\nSSE,${fit.result.sse}\nAIC,${fit.result.aic}\nBIC,${fit.result.bic}\n`;
  if (ds) {
    csv += `\nX,Y,YFit,Residual\n`;
    ds.x.forEach((x, i) => {
      const yFit = fit.fn ? fit.fn(x, fit.result.params) : NaN;
      csv += `${x},${ds.y[i]},${isFinite(yFit) ? yFit : ''},${fit.result.residuals[i]}\n`;
    });
  }
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'fit-results.csv'; a.click();
}

function exportReport() {
  const fit = state.fits.find(f => f.id === state.activeFitId);
  if (!fit || !fit.result) { setConsole('No active fit to export.', 'warn'); return; }
  const ds = state.datasets.find(d => d.id === fit.dsId);
  const r = fit.result;
  let txt = `=======================================================\n`;
  txt += `  Advanced Curve Fitting Studio — Fit Report\n`;
  txt += `  Generated: ${new Date().toISOString()}\n`;
  txt += `=======================================================\n\n`;
  txt += `Dataset  : ${ds ? ds.name : '—'}  (${r.n} points)\n`;
  txt += `Model    : ${fit.model}\n\n`;
  txt += `─── Parameters ───────────────────────────────────────\n`;
  txt += `${'Name'.padEnd(12)}  ${'Value'.padEnd(16)}  ${'Std. Error'.padEnd(16)}\n`;
  txt += `${'-'.repeat(46)}\n`;
  fit.paramNames.forEach((n, i) => {
    const v  = fmt(r.params[i]);
    const se = isFinite(r.paramErrors[i]) ? fmt(r.paramErrors[i]) : '—';
    txt += `${n.padEnd(12)}  ${v.padEnd(16)}  ${se}\n`;
  });
  txt += `\n─── Goodness of Fit ──────────────────────────────────\n`;
  txt += `R²        : ${r.rSq.toFixed(8)}\n`;
  txt += `Adj. R²   : ${r.adjRSq.toFixed(8)}\n`;
  txt += `RMSE      : ${r.rmse.toExponential(4)}\n`;
  txt += `SSE       : ${r.sse.toExponential(4)}\n`;
  txt += `AIC       : ${r.aic.toFixed(4)}\n`;
  txt += `BIC       : ${r.bic.toFixed(4)}\n\n`;
  txt += `─── Algorithm ────────────────────────────────────────\n`;
  txt += `Status    : ${r.converged ? 'Converged' : 'Max iterations reached'}\n`;
  txt += `Iterations: ${r.iter}\n`;
  txt += `=======================================================\n`;
  const blob = new Blob([txt], { type: 'text/plain' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'fit-report.txt'; a.click();
}

/* ═══════════════════════════════════════════════════════════
   SESSION PERSISTENCE
═══════════════════════════════════════════════════════════ */
function saveSession() {
  try {
    const payload = {
      datasets: state.datasets,
      fits: state.fits.map(f => ({
        id: f.id, dsId: f.dsId, model: f.model, label: f.label,
        color: f.color, visible: f.visible, paramNames: f.paramNames,
        curvePoints: f.curvePoints, result: f.result,
        customExpr: f.customExpr || null,
      })),
      fitConfig: state.fitConfig,
      plotConfig: state.plotConfig,
      activeDatasetId: state.activeDatasetId,
      activeFitId: state.activeFitId,
    };
    localStorage.setItem('cfs_session', JSON.stringify(payload));
    setConsole('Session saved to browser storage.', '');
  } catch (e) {
    setConsole('Save failed: ' + e.message, 'error');
  }
}

function loadSession() {
  try {
    const raw = localStorage.getItem('cfs_session');
    if (!raw) { setConsole('No saved session found.', 'warn'); return; }
    const payload = JSON.parse(raw);
    state.datasets = payload.datasets || [];
    state.fits = []; // Rebuild fits with functions
    for (const f of (payload.fits || [])) {
      const m = MODELS[f.model];
      let fn = m ? m.fn : null;
      if (f.model === 'Custom' && f.customExpr) {
        try {
          const compiled = math.compile(f.customExpr);
          const names = f.paramNames;
          fn = (x, params) => {
            const scope = { x };
            names.forEach((n, i) => { scope[n] = params[i]; });
            return compiled.evaluate(scope);
          };
        } catch (_) { fn = null; }
      } else if (m && m.analytic && f.result && m.degree != null) {
        const deg = m.degree;
        fn = (x, p) => p.reduce((s, c, j) => s + c * Math.pow(x, deg - j), 0);
      }
      state.fits.push(Object.assign(f, { fn }));
    }
    state.fitConfig = payload.fitConfig || state.fitConfig;
    state.plotConfig = payload.plotConfig || state.plotConfig;
    state.activeDatasetId = payload.activeDatasetId;
    state.activeFitId = payload.activeFitId;

    // Restore UI state
    const modelSel = document.getElementById('model-select');
    if (modelSel) { modelSel.value = state.fitConfig.model; syncModelCustomSection(); }
    const eqInput = document.getElementById('custom-eq-input');
    if (eqInput && state.fitConfig.customExpr) { eqInput.value = state.fitConfig.customExpr; parseCustomEquation(state.fitConfig.customExpr); }

    ['logX','logY'].forEach(k => {
      const btn = document.getElementById('btn-' + k.replace(/[A-Z]/g, m => '-' + m.toLowerCase()));
      if (btn && state.plotConfig[k]) btn.classList.toggle('active', true);
    });

    syncFitDatasetSelect();
    renderDatasetList();
    renderFitList();
    updatePlots();

    const active = state.fits.find(f => f.id === state.activeFitId);
    if (active) { renderStats(active); renderParamResults(active); }
    setConsole('Session loaded.', '');
  } catch (e) {
    setConsole('Load failed: ' + e.message, 'error');
  }
}

/* ═══════════════════════════════════════════════════════════
   EVENTS
═══════════════════════════════════════════════════════════ */
function initEvents() {
  /* ── Dropdown toggles ─────────────────────────────────── */
  function setupDropdown(btnId, menuId) {
    const btn = document.getElementById(btnId);
    const menu = document.getElementById(menuId);
    if (!btn || !menu) return;
    btn.addEventListener('click', e => { e.stopPropagation(); menu.classList.toggle('open'); });
    document.addEventListener('click', e => { if (!menu.contains(e.target) && e.target !== btn) menu.classList.remove('open'); });
  }
  setupDropdown('btn-examples', 'examples-menu');
  setupDropdown('btn-export', 'export-menu');

  /* ── Example datasets ─────────────────────────────────── */
  document.getElementById('examples-menu').querySelectorAll('.app-dropdown-item').forEach(item => {
    item.addEventListener('click', () => {
      const key = item.dataset.example;
      const gen = EXAMPLES[key];
      if (!gen) return;
      const ex = gen();
      const ds = importDataset(ex.name, ex.x, ex.y);
      if (!ds) return;
      document.getElementById('examples-menu').classList.remove('open');
      if (ex.xlabel) document.getElementById('plot-xlabel').value = ex.xlabel;
      if (ex.ylabel) document.getElementById('plot-ylabel').value = ex.ylabel;
      if (ex.suggestModel) {
        document.getElementById('model-select').value = ex.suggestModel;
        syncModelCustomSection();
      }
      syncFitDatasetSelect();
      renderDatasetList();
      updatePlots();
      setConsole(`Loaded: ${ex.name} (${ds.x.length} points).  Press ▶ Fit to fit.`, '');
    });
  });

  /* ── CSV Import ───────────────────────────────────────── */
  document.getElementById('btn-import').addEventListener('click', () => document.getElementById('file-input').click());
  document.getElementById('file-input').addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const rows = parseDelimited(ev.target.result, 'auto');
        const { x, y } = rowsToXY(rows);
        if (!x.length) { setConsole('Could not parse any X,Y pairs from file.', 'error'); return; }
        const ds = importDataset(file.name.replace(/\.[^.]+$/, ''), x, y);
        syncFitDatasetSelect();
        renderDatasetList();
        updatePlots();
        setConsole(`Imported: ${ds.name} (${x.length} points).`, '');
      } catch (err) { setConsole('Import error: ' + err.message, 'error'); }
    };
    reader.readAsText(file);
    e.target.value = '';
  });

  /* ── Drag & drop onto plot area ───────────────────────── */
  const plotArea = document.getElementById('main-plot');
  plotArea.addEventListener('dragover', e => e.preventDefault());
  plotArea.addEventListener('drop', e => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const rows = parseDelimited(ev.target.result, 'auto');
        const { x, y } = rowsToXY(rows);
        if (!x.length) { setConsole('Could not parse file.', 'error'); return; }
        const ds = importDataset(file.name.replace(/\.[^.]+$/, ''), x, y);
        syncFitDatasetSelect(); renderDatasetList(); updatePlots();
        setConsole(`Imported: ${ds.name} (${x.length} points).`, '');
      } catch (err) { setConsole('Drop import error: ' + err.message, 'error'); }
    };
    reader.readAsText(file);
  });

  /* ── Paste modal ──────────────────────────────────────── */
  document.getElementById('btn-paste').addEventListener('click', () => {
    document.getElementById('paste-modal').style.display = 'flex';
    document.getElementById('paste-textarea').focus();
  });
  function closePasteModal() { document.getElementById('paste-modal').style.display = 'none'; }
  document.getElementById('paste-modal-close').addEventListener('click', closePasteModal);
  document.getElementById('paste-cancel').addEventListener('click', closePasteModal);
  document.getElementById('paste-modal').addEventListener('click', e => { if (e.target === document.getElementById('paste-modal')) closePasteModal(); });
  document.getElementById('paste-textarea').addEventListener('input', () => {
    const text = document.getElementById('paste-textarea').value;
    if (!text.trim()) { document.getElementById('paste-preview').textContent = ''; return; }
    try {
      const delim = document.getElementById('paste-delim').value;
      const rows = parseDelimited(text, delim);
      const { x, y } = rowsToXY(rows);
      document.getElementById('paste-preview').textContent = x.length ? `Preview: ${x.length} rows parsed. X ∈ [${fmt(Math.min(...x))}, ${fmt(Math.max(...x))}], Y ∈ [${fmt(Math.min(...y))}, ${fmt(Math.max(...y))}]` : 'No numeric pairs found.';
    } catch (_) { document.getElementById('paste-preview').textContent = 'Parse error.'; }
  });
  document.getElementById('paste-import').addEventListener('click', () => {
    const text = document.getElementById('paste-textarea').value;
    const delim = document.getElementById('paste-delim').value;
    const name  = document.getElementById('paste-ds-name').value.trim() || `Dataset ${state.datasets.length + 1}`;
    try {
      const rows = parseDelimited(text, delim);
      const { x, y } = rowsToXY(rows);
      if (!x.length) { setConsole('No valid data found in pasted text.', 'error'); return; }
      importDataset(name, x, y);
      syncFitDatasetSelect(); renderDatasetList(); updatePlots();
      closePasteModal();
      document.getElementById('paste-textarea').value = '';
      setConsole(`Imported: ${name} (${x.length} points).`, '');
    } catch (err) { setConsole('Paste import error: ' + err.message, 'error'); }
  });

  /* ── Fit button ───────────────────────────────────────── */
  document.getElementById('btn-fit').addEventListener('click', runFit);
  document.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) runFit(); });

  /* ── Remove fit ───────────────────────────────────────── */
  document.getElementById('btn-clear-fit').addEventListener('click', () => {
    if (!state.activeFitId) return;
    state.fits = state.fits.filter(f => f.id !== state.activeFitId);
    state.activeFitId = state.fits.length ? state.fits[state.fits.length - 1].id : null;
    renderFitList();
    const active = state.fits.find(f => f.id === state.activeFitId);
    if (active) renderStats(active); else setConsole('Fit removed.', '');
    updatePlots();
  });

  /* ── Clear all ────────────────────────────────────────── */
  document.getElementById('btn-clear-all').addEventListener('click', () => {
    state.datasets = []; state.fits = [];
    state.activeDatasetId = null; state.activeFitId = null;
    syncFitDatasetSelect(); renderDatasetList(); renderFitList();
    updatePlots();
    setConsole('All datasets and fits cleared.', '');
  });

  /* ── Model select ─────────────────────────────────────── */
  document.getElementById('model-select').addEventListener('change', syncModelCustomSection);

  /* ── Custom equation input ────────────────────────────── */
  let eqDebounce;
  document.getElementById('custom-eq-input').addEventListener('input', e => {
    clearTimeout(eqDebounce);
    eqDebounce = setTimeout(() => parseCustomEquation(e.target.value), 400);
  });

  /* ── Auto init ────────────────────────────────────────── */
  document.getElementById('btn-auto-init').addEventListener('click', autoInitParams);

  /* ── Toggle buttons ───────────────────────────────────── */
  document.getElementById('btn-toggle-residuals').addEventListener('click', function () {
    state.plotConfig.showResiduals = !state.plotConfig.showResiduals;
    this.classList.toggle('active', state.plotConfig.showResiduals);
    document.getElementById('residual-plot').classList.toggle('hidden', !state.plotConfig.showResiduals);
    if (state.plotConfig.showResiduals) Plotly.Plots.resize('residual-plot');
  });
  document.getElementById('btn-log-x').addEventListener('click', function () {
    state.plotConfig.logX = !state.plotConfig.logX;
    this.classList.toggle('active', state.plotConfig.logX);
    updatePlots();
  });
  document.getElementById('btn-log-y').addEventListener('click', function () {
    state.plotConfig.logY = !state.plotConfig.logY;
    this.classList.toggle('active', state.plotConfig.logY);
    updatePlots();
  });

  /* ── Plot label live update ───────────────────────────── */
  ['plot-xlabel','plot-ylabel','plot-title'].forEach(id => {
    document.getElementById(id).addEventListener('change', () => { if (state.datasets.length) updatePlots(); });
  });

  /* ── Export ───────────────────────────────────────────── */
  document.getElementById('exp-png').addEventListener('click', () => { exportPNG(); document.getElementById('export-menu').classList.remove('open'); });
  document.getElementById('exp-svg').addEventListener('click', () => { exportSVG(); document.getElementById('export-menu').classList.remove('open'); });
  document.getElementById('exp-csv').addEventListener('click', () => { exportCSV(); document.getElementById('export-menu').classList.remove('open'); });
  document.getElementById('exp-report').addEventListener('click', () => { exportReport(); document.getElementById('export-menu').classList.remove('open'); });

  /* ── Session ──────────────────────────────────────────── */
  document.getElementById('btn-save').addEventListener('click', saveSession);
  document.getElementById('btn-load').addEventListener('click', loadSession);

  /* ── Resize plots when window resizes ─────────────────── */
  window.addEventListener('resize', () => {
    if (plotsInitialised) { Plotly.Plots.resize('main-plot'); Plotly.Plots.resize('residual-plot'); }
  });

  /* ── Initial state ────────────────────────────────────── */
  document.getElementById('btn-toggle-residuals').classList.add('active');
  syncModelCustomSection();
}

/* ═══════════════════════════════════════════════════════════
   INITIALISE
═══════════════════════════════════════════════════════════ */
function init() {
  initEvents();
  updatePlots(); // Render empty plots
  // Auto-load example on first visit
  if (!localStorage.getItem('cfs_session')) {
    const ex = EXAMPLES['exponential-decay']();
    importDataset(ex.name, ex.x, ex.y);
    document.getElementById('plot-xlabel').value = ex.xlabel;
    document.getElementById('plot-ylabel').value = ex.ylabel;
    document.getElementById('model-select').value = ex.suggestModel;
    syncModelCustomSection();
    syncFitDatasetSelect();
    renderDatasetList();
    updatePlots();
    setConsole(`Example loaded: ${ex.name}. Press ▶ Fit to begin.`, '');
  }
}

init();

})();
