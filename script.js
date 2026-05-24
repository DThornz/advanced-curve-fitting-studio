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

function probitApprox(p) {
  if (p <= 0) return -6; if (p >= 1) return 6;
  const q = p < 0.5 ? p : 1 - p;
  const t = Math.sqrt(-2 * Math.log(q));
  const x = t - (2.515517 + t*(0.802853 + t*0.010328)) / (1 + t*(1.432788 + t*(0.189269 + t*0.001308)));
  return p < 0.5 ? -x : x;
}

function getLiveResiduals() {
  const fit = state.fits.find(f => f.id === state.activeFitId);
  if (!fit || !fit.fn) return null;
  const ds = state.datasets.find(d => d.id === fit.dsId);
  if (!ds || ds.enabled === false) return null;
  const excl = ds.excludedIndices || new Set();
  const residuals = [];
  ds.x.forEach((x, i) => {
    if (excl.has(i)) return;
    const yhat = fitEval(fit, x);
    if (isFinite(yhat)) residuals.push(ds.y[i] - yhat);
  });
  return residuals.length >= 3 ? { residuals, fit, ds } : null;
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

function tCritical95(df) {
  if (df <= 0) return Infinity;
  const tbl = [12.706,4.303,3.182,2.776,2.571,2.447,2.365,2.306,2.262,2.228,
               2.201,2.179,2.160,2.145,2.131,2.120,2.110,2.101,2.093,2.086];
  if (df <= 20) return tbl[df - 1];
  if (df <= 30) return 2.086 - (df - 20) * 0.044 / 10;
  if (df <= 60) return 2.042 - (df - 30) * 0.042 / 30;
  if (df <= 120) return 2.000 - (df - 60) * 0.020 / 60;
  return 1.960;
}

function lnGamma(z) {
  const g = 7;
  const c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - lnGamma(1 - z);
  z -= 1;
  let x = c[0];
  for (let i = 1; i < g + 2; i++) x += c[i] / (z + i);
  const t = z + g + 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}

function betacf(a, b, x) {
  const MAXIT = 200, EPS = 3e-7, FPMIN = 1e-30;
  const qap = a + 1, qam = a - 1, qab = a + b;
  let c = 1, d = 1 - qab * x / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d; let h = d;
  for (let m = 1; m <= MAXIT; m++) {
    const m2 = 2 * m;
    let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d; h *= d * c;
    aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d; const del = d * c; h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return h;
}

function regularizedBeta(x, a, b) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const lbeta = lnGamma(a) + lnGamma(b) - lnGamma(a + b);
  if (x < (a + 1) / (a + b + 2)) {
    return Math.exp(a * Math.log(x) + b * Math.log(1 - x) - lbeta) / a * betacf(a, b, x);
  }
  return 1 - Math.exp(b * Math.log(1 - x) + a * Math.log(x) - lbeta) / b * betacf(b, a, 1 - x);
}

function fDistPValue(F, d1, d2) {
  if (!isFinite(F) || F <= 0) return 1;
  return regularizedBeta(d2 / (d2 + d1 * F), d2 / 2, d1 / 2);
}

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1,3), 16);
  const g = parseInt(hex.slice(3,5), 16);
  const b = parseInt(hex.slice(5,7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/* ═══════════════════════════════════════════════════════════
   BOUNDS HELPER
═══════════════════════════════════════════════════════════ */
function clampToBounds(p, lo, hi) {
  if (!lo || !lo.length) return;
  for (let i = 0; i < p.length; i++) {
    if (lo[i] > -Infinity) p[i] = Math.max(p[i], lo[i]);
    if (hi[i] < Infinity)  p[i] = Math.min(p[i], hi[i]);
  }
}
function boundsFromOpts(opts) {
  const rows = opts.paramRows || [];
  if (!rows.length) return { lo: null, hi: null };
  const lo = rows.map(r => (r && r.min > -1e9) ? r.min : -Infinity);
  const hi = rows.map(r => (r && r.max < 1e9)  ? r.max :  Infinity);
  return { lo, hi };
}

/* ═══════════════════════════════════════════════════════════
   FITTING ENGINE — LEVENBERG-MARQUARDT
═══════════════════════════════════════════════════════════ */
function levenbergMarquardt(fn, xArr, yArr, p0, opts) {
  opts = opts || {};
  const maxIter = opts.maxIter || 1000;
  const tol     = opts.tol != null ? parseFloat(opts.tol) || 1e-8 : 1e-8;
  const EPS     = 1e-7;
  const { lo, hi } = boundsFromOpts(opts);

  const n = xArr.length;
  const m = p0.length;

  let p = p0.map(Number);
  clampToBounds(p, lo, hi);
  let lambda = 1e-2;
  let converged = false;
  let iter = 0;

  const sqrtW = opts.weights ? opts.weights.map(w => Math.sqrt(Math.max(w, 0))) : null;

  function evalResiduals(params) {
    return xArr.map((x, i) => {
      const yp = fn(x, params);
      const r = isFinite(yp) ? yArr[i] - yp : 0;
      return sqrtW ? r * sqrtW[i] : r;
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
    clampToBounds(pNew, lo, hi);
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

  return finaliseFit(fn, xArr, yArr, p, { converged, iter, weights: opts.weights });
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
  const dof = Math.max(n - m, 1);
  let paramErrors = coeffs.map(() => NaN);
  let covMatrix = null;
  try {
    const sig2 = sseVal / dof;
    const inv = invertMatrix(VtV);
    if (inv) {
      paramErrors = inv.map((row, i) => Math.sqrt(Math.abs(sig2 * row[i])));
      covMatrix = inv.map(row => row.map(v => sig2 * v));
    }
  } catch (_) {}
  return {
    params: coeffs, paramErrors, covMatrix, dof,
    rSq, adjRSq, rmse, sse: sseVal, aic, bic,
    converged: true, iter: 0, n, residuals
  };
}

/* ── Gauss-Newton with backtracking line search ──────────── */
function gaussNewton(fn, xArr, yArr, p0, opts) {
  opts = opts || {};
  const maxIter = opts.maxIter || 1000;
  const tol     = opts.tol != null ? parseFloat(opts.tol) || 1e-8 : 1e-8;
  const EPS = 1e-7;
  const { lo, hi } = boundsFromOpts(opts);
  const n = xArr.length, m = p0.length;
  let p = p0.map(Number);
  clampToBounds(p, lo, hi);
  let converged = false, iter = 0;

  const sqrtW_gn = opts.weights ? opts.weights.map(w => Math.sqrt(Math.max(w, 0))) : null;
  function evalR(params) {
    return xArr.map((x, i) => {
      const v = fn(x, params);
      const r = isFinite(v) ? yArr[i] - v : 0;
      return sqrtW_gn ? r * sqrtW_gn[i] : r;
    });
  }
  function sse(r) { return r.reduce((s, v) => s + v * v, 0); }
  function jacobian(params, r0) {
    const cols = [];
    for (let j = 0; j < m; j++) {
      const pp = params.slice();
      const h = Math.max(Math.abs(params[j]) * EPS, EPS);
      pp[j] += h;
      const r1 = evalR(pp);
      cols.push(r1.map((v, i) => (v - r0[i]) / h));
    }
    return cols;
  }

  for (iter = 0; iter < maxIter; iter++) {
    const r = evalR(p);
    const curSSE = sse(r);
    if (!isFinite(curSSE)) break;
    const J = jacobian(p, r);
    const JtJ = Array.from({ length: m }, (_, a) =>
      Array.from({ length: m }, (_, b) => J[a].reduce((s, _, i) => s + J[a][i] * J[b][i], 0)));
    const beta = J.map(col => col.reduce((s, v, i) => s - v * r[i], 0));
    const A = JtJ.map((row, a) => row.map((v, b) => a === b ? v + 1e-10 : v));
    let delta;
    try { delta = solveLinear(A, beta); } catch (_) { break; }
    if (!delta.every(isFinite)) break;
    // Backtracking line search
    let alpha = 1;
    let pNew = p.map((v, i) => v + alpha * delta[i]);
    clampToBounds(pNew, lo, hi);
    let newSSE = sse(evalR(pNew));
    for (let ls = 0; ls < 12 && newSSE >= curSSE; ls++) {
      alpha *= 0.5;
      pNew = p.map((v, i) => v + alpha * delta[i]);
      clampToBounds(pNew, lo, hi);
      newSSE = sse(evalR(pNew));
    }
    if (newSSE >= curSSE) break;
    p = pNew;
    const stepNorm = alpha * Math.sqrt(delta.reduce((s, d) => s + d * d, 0));
    if (stepNorm < tol && Math.abs(curSSE - newSSE) < tol) { converged = true; break; }
  }
  return finaliseFit(fn, xArr, yArr, p, { converged, iter, weights: opts.weights });
}

/* ── Nelder-Mead Simplex ─────────────────────────────────── */
function nelderMead(fn, xArr, yArr, p0, opts) {
  opts = opts || {};
  const maxIter = opts.maxIter || 2000;
  const tol     = opts.tol != null ? parseFloat(opts.tol) || 1e-8 : 1e-8;
  const { lo, hi } = boundsFromOpts(opts);
  const n = xArr.length, m = p0.length;

  function obj(params) {
    let s = 0;
    for (let i = 0; i < n; i++) {
      const v = fn(xArr[i], params);
      if (isFinite(v)) s += (yArr[i] - v) ** 2 * (opts.weights ? Math.max(opts.weights[i], 0) : 1);
    }
    return isFinite(s) ? s : 1e30;
  }
  function clampV(v) { clampToBounds(v, lo, hi); return v; }

  // Initial simplex: perturb each parameter by 5 % (or 0.05 if zero); clamp all vertices
  let simplex = [clampV(p0.slice())];
  for (let j = 0; j < m; j++) {
    const v = p0.slice();
    v[j] += Math.abs(v[j]) > 1e-8 ? 0.05 * Math.abs(v[j]) : 0.05;
    simplex.push(clampV(v));
  }
  let fval = simplex.map(obj);
  let converged = false, iter = 0;

  for (iter = 0; iter < maxIter; iter++) {
    // Sort vertices best → worst
    const ord = Array.from({ length: m + 1 }, (_, i) => i).sort((a, b) => fval[a] - fval[b]);
    simplex = ord.map(i => simplex[i]);
    fval    = ord.map(i => fval[i]);

    // Convergence: RMS spread of vertices < tol
    const spread = Math.sqrt(simplex.slice(1).reduce((s, v) =>
      s + v.reduce((ss, vi, j) => ss + (vi - simplex[0][j]) ** 2, 0), 0) / m);
    if (spread < tol) { converged = true; break; }

    // Centroid of all but worst
    const c = Array(m).fill(0);
    for (let i = 0; i < m; i++) for (let j = 0; j < m; j++) c[j] += simplex[i][j] / m;

    // Reflection
    const xr = clampV(c.map((ci, j) => ci + (ci - simplex[m][j])));
    const fr = obj(xr);

    if (fr < fval[0]) {
      // Expansion
      const xe = clampV(c.map((ci, j) => ci + 2 * (xr[j] - ci)));
      const fe = obj(xe);
      simplex[m] = fe < fr ? xe : xr;
      fval[m]    = fe < fr ? fe : fr;
    } else if (fr < fval[m - 1]) {
      simplex[m] = xr; fval[m] = fr;
    } else {
      // Contraction
      const inside = fr >= fval[m];
      const xc = clampV(c.map((ci, j) => ci + 0.5 * ((inside ? simplex[m][j] : xr[j]) - ci)));
      const fc = obj(xc);
      if (fc < (inside ? fval[m] : fr)) { simplex[m] = xc; fval[m] = fc; }
      else {
        // Shrink toward best
        for (let i = 1; i <= m; i++) {
          simplex[i] = clampV(simplex[0].map((s0, j) => s0 + 0.5 * (simplex[i][j] - s0)));
          fval[i]    = obj(simplex[i]);
        }
      }
    }
  }
  return finaliseFit(fn, xArr, yArr, simplex[0], { converged, iter, weights: opts.weights });
}

/* ── BFGS (quasi-Newton, inverse-Hessian form) ───────────── */
function bfgs(fn, xArr, yArr, p0, opts) {
  opts = opts || {};
  const maxIter = opts.maxIter || 1000;
  const tol     = opts.tol != null ? parseFloat(opts.tol) || 1e-8 : 1e-8;
  const EPS = 1e-6;
  const { lo, hi } = boundsFromOpts(opts);
  const n = xArr.length, m = p0.length;

  function obj(params) {
    let s = 0;
    for (let i = 0; i < n; i++) {
      const v = fn(xArr[i], params);
      if (isFinite(v)) s += (yArr[i] - v) ** 2 * (opts.weights ? Math.max(opts.weights[i], 0) : 1);
    }
    return isFinite(s) ? s : 1e30;
  }
  function grad(params) {
    const f0 = obj(params);
    return params.map((_, j) => {
      const pp = params.slice();
      const h = Math.max(Math.abs(params[j]) * EPS, EPS);
      pp[j] += h;
      return (obj(pp) - f0) / h;
    });
  }

  // Inverse-Hessian approximation (starts as identity)
  let H = Array.from({ length: m }, (_, i) => Array.from({ length: m }, (_, j) => i === j ? 1 : 0));
  let p = p0.map(Number);
  clampToBounds(p, lo, hi);
  let g = grad(p);
  let converged = false, iter = 0;

  for (iter = 0; iter < maxIter; iter++) {
    const gNorm = Math.sqrt(g.reduce((s, v) => s + v * v, 0));
    if (gNorm < tol) { converged = true; break; }

    // Search direction d = -H g
    const d = Array(m).fill(0).map((_, i) => -H[i].reduce((s, hij, j) => s + hij * g[j], 0));
    const dg = d.reduce((s, di, i) => s + di * g[i], 0);
    if (dg >= 0) {
      // Curvature condition violated — restart with identity
      H = Array.from({ length: m }, (_, i) => Array.from({ length: m }, (_, j) => i === j ? 1 : 0));
      continue;
    }

    // Backtracking Armijo line search
    const f0 = obj(p);
    let alpha = 1;
    let pNew = p.map((v, i) => v + alpha * d[i]);
    clampToBounds(pNew, lo, hi);
    let fNew = obj(pNew);
    for (let ls = 0; ls < 20 && fNew > f0 + 1e-4 * alpha * dg; ls++) {
      alpha *= 0.5;
      pNew = p.map((v, i) => v + alpha * d[i]);
      clampToBounds(pNew, lo, hi);
      fNew = obj(pNew);
    }
    if (!isFinite(fNew) || fNew >= f0) break;

    const s = pNew.map((v, i) => v - p[i]);
    const gNew = grad(pNew);
    const y = gNew.map((v, i) => v - g[i]);
    const sy = s.reduce((acc, si, i) => acc + si * y[i], 0);

    if (sy > 1e-14) {
      const rho = 1 / sy;
      const Hy  = Array(m).fill(0).map((_, i) => H[i].reduce((acc, hij, j) => acc + hij * y[j], 0));
      const yHy = y.reduce((acc, yi, i) => acc + yi * Hy[i], 0);
      H = H.map((row, i) => row.map((hij, j) =>
        hij - rho * (Hy[i] * s[j] + s[i] * Hy[j]) + rho * (rho * yHy + 1) * s[i] * s[j]
      ));
    }

    p = pNew; g = gNew;
    const stepNorm = Math.sqrt(s.reduce((acc, v) => acc + v * v, 0));
    if (stepNorm < tol) { converged = true; break; }
  }
  return finaliseFit(fn, xArr, yArr, p, { converged, iter, weights: opts.weights });
}

/* ── Shared finalisation (stats + param errors) ─────────── */
function finaliseFit(fn, xArr, yArr, p, meta) {
  const EPS = 1e-7;
  const n = xArr.length, m = p.length;
  const r = xArr.map((x, i) => { const v = fn(x, p); return isFinite(v) ? yArr[i] - v : 0; });
  const sseVal = r.reduce((s, v) => s + v * v, 0);
  const yMean  = mean(yArr);
  const sst    = yArr.reduce((s, v) => s + (v - yMean) ** 2, 0);
  const rSq    = sst < 1e-15 ? 1 : Math.max(0, 1 - sseVal / sst);
  const adjRSq = sst < 1e-15 ? 1 : 1 - (1 - rSq) * Math.max(n - 1, 1) / Math.max(n - m - 1, 1);
  const rmse   = Math.sqrt(sseVal / Math.max(n - m, 1));
  const aic    = n * Math.log(Math.max(sseVal / n, 1e-20)) + 2 * m;
  const bic    = n * Math.log(Math.max(sseVal / n, 1e-20)) + m * Math.log(n);
  let paramErrors = p.map(() => NaN);
  let covMatrix = null;
  const dof = Math.max(n - m, 1);
  const weights = meta.weights || null;
  try {
    const J_cols = [];
    for (let j = 0; j < m; j++) {
      const pp = p.slice();
      const h = Math.max(Math.abs(p[j]) * EPS, EPS);
      pp[j] += h;
      const r1 = xArr.map((x, i) => { const v = fn(x, pp); return isFinite(v) ? yArr[i] - v : 0; });
      // Scale Jacobian columns by sqrt(w) for weighted covariance
      J_cols.push(r1.map((v, i) => {
        const dri = (v - r[i]) / h;
        return weights ? dri * Math.sqrt(Math.max(weights[i], 0)) : dri;
      }));
    }
    const JtJ = Array.from({ length: m }, (_, a) =>
      Array.from({ length: m }, (_, b) => J_cols[a].reduce((s, _, i) => s + J_cols[a][i] * J_cols[b][i], 0)));
    // sig2 based on weighted SSE for correct covariance, but report unweighted stats
    const wSSE = weights ? r.reduce((s, ri, i) => s + ri * ri * Math.max(weights[i], 0), 0) : sseVal;
    const sig2 = wSSE / dof;
    const inv = invertMatrix(JtJ);
    if (inv) {
      paramErrors = inv.map((row, i) => Math.sqrt(Math.abs(sig2 * row[i])));
      covMatrix = inv.map(row => row.map(v => sig2 * v));
    }
  } catch (_) {}
  return { params: p, paramErrors, covMatrix, dof, rSq, adjRSq, rmse, sse: sseVal, aic, bic,
           converged: meta.converged, iter: meta.iter, n, residuals: r };
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
    autoInit(x, y) {
      // Log-linear regression on positive pairs: ln(y) = ln(a) + b*ln(x)
      const pairs = x.map((xi, i) => [xi, y[i]]).filter(([xi, yi]) => xi > 0 && yi > 0);
      if (pairs.length < 2) return [Math.abs(mean(y)) || 1, 1];
      const lx = pairs.map(([xi]) => Math.log(xi));
      const ly = pairs.map(([, yi]) => Math.log(yi));
      const xlm = mean(lx), ylm = mean(ly);
      const denom = lx.reduce((s, lxi) => s + (lxi - xlm) ** 2, 0) || 1;
      const b = lx.reduce((s, lxi, i) => s + (lxi - xlm) * (ly[i] - ylm), 0) / denom;
      const a = Math.exp(ylm - b * xlm);
      return [isFinite(a) ? a : 1, isFinite(b) ? b : 1];
    }
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
    autoInit(x, y) {
      const L = Math.max(...y) * 1.05;
      const half = L / 2;
      const idx = y.reduce((b, yi, i) => Math.abs(yi - half) < Math.abs(y[b] - half) ? i : b, 0);
      const x0 = x[idx];
      // Estimate k from local slope at midpoint: dy/dx|x0 ≈ L*k/4
      const i1 = Math.max(idx - 2, 0), i2 = Math.min(idx + 2, x.length - 1);
      const slope = i2 > i1 ? (y[i2] - y[i1]) / (x[i2] - x[i1] || 1) : 1;
      const k = Math.max(4 * slope / L, 0.01);
      return [L, k, x0];
    }
  },
  'Gaussian': {
    params: ['A', 'μ', 'σ', 'C'],
    fn: (x, [A, mu, sig, C]) => A * Math.exp(-0.5 * ((x - mu) / (sig || 1e-10)) ** 2) + C,
    analytic: false,
    autoInit(x, y) {
      // Robust baseline: mean of bottom 25% avoids peak bias
      const sortedY = y.slice().sort((a, b) => a - b);
      const nBase = Math.max(2, Math.ceil(y.length * 0.25));
      const C = sortedY.slice(0, nBase).reduce((s, v) => s + v, 0) / nBase;
      const shifted = y.map(v => v - C);
      const maxI = shifted.indexOf(Math.max(...shifted));
      const mu = x[maxI];
      const A = Math.max(shifted[maxI], 1e-6);
      const halfAmp = A / 2;
      let half = -1;
      for (let i = 0; i < maxI; i++) { if (shifted[i] >= halfAmp) { half = i; break; } }
      const xRange = Math.max(...x) - Math.min(...x);
      const sig = half >= 0 ? Math.max(Math.abs(x[half] - mu) / 1.177, xRange / 10) : xRange / 6;
      return [A, mu, sig, C];
    }
  },
  'Lorentzian': {
    params: ['A', 'x₀', 'γ', 'C'],
    fn: (x, [A, x0, g, C]) => A * g * g / ((x - x0) ** 2 + g * g) + C,
    analytic: false,
    autoInit(x, y) {
      const sortedY = y.slice().sort((a, b) => a - b);
      const nBase = Math.max(2, Math.ceil(y.length * 0.25));
      const C = sortedY.slice(0, nBase).reduce((s, v) => s + v, 0) / nBase;
      const shifted = y.map(v => v - C);
      const maxI = shifted.indexOf(Math.max(...shifted));
      const A = Math.max(shifted[maxI], 1e-6);
      const x0 = x[maxI];
      // HWHM estimate from left side of peak
      const halfAmp = A / 2;
      let half = -1;
      for (let i = 0; i < maxI; i++) { if (shifted[i] >= halfAmp) { half = i; break; } }
      const xRange = Math.max(...x) - Math.min(...x);
      const g = half >= 0 ? Math.max(Math.abs(x[half] - x0), xRange / 10) : xRange / 8;
      return [A, x0, g, C];
    }
  },
  'Michaelis-Menten': {
    params: ['Vmax', 'Km'],
    fn: (x, [Vm, Km]) => Vm * x / ((Km || 1e-10) + x),
    analytic: false,
    autoInit(x, y) {
      const Vmax = Math.max(...y) * 1.5;
      const half = Math.max(...y) / 2;
      const idx = y.reduce((b, yi, i) => Math.abs(yi - half) < Math.abs(y[b] - half) ? i : b, 0);
      return [Vmax, Math.max(x[idx], 1e-6)];
    }
  },
  'Hill': {
    params: ['Vmax', 'Kd', 'n'],
    fn: (x, [Vm, Kd, n]) => Vm * Math.pow(x, n) / (Math.pow(Math.abs(Kd), n) + Math.pow(x, n)),
    analytic: false,
    autoInit(x, y) {
      const Vmax = Math.max(...y) * 1.2;
      const half = Math.max(...y) / 2;
      const idx = y.reduce((b, yi, i) => Math.abs(yi - half) < Math.abs(y[b] - half) ? i : b, 0);
      return [Vmax, Math.max(x[idx], 1e-6), 1.5];
    }
  },
  'Sine': {
    params: ['A', 'ω', 'φ', 'C'],
    fn: (x, [A, w, phi, C]) => A * Math.sin(w * x + phi) + C,
    analytic: false,
    autoInit(x, y) {
      const C = (Math.max(...y) + Math.min(...y)) / 2;
      const A = (Math.max(...y) - Math.min(...y)) / 2;
      const centered = y.map(v => v - C);
      // Count zero crossings to estimate frequency
      let zc = 0;
      for (let i = 1; i < centered.length; i++) { if (centered[i - 1] * centered[i] < 0) zc++; }
      const xRange = Math.max(...x) - Math.min(...x);
      const omega = zc > 1 ? Math.PI * zc / xRange : 2 * Math.PI / Math.max(xRange, 1e-10);
      return [A, omega, 0, C];
    }
  },
  'Damped-Sine': {
    params: ['A', 'γ', 'ω', 'φ', 'C'],
    fn: (x, [A, g, w, phi, C]) => A * Math.exp(-g * x) * Math.sin(w * x + phi) + C,
    analytic: false,
    autoInit(x, y) {
      const C = mean(y);
      const centered = y.map(v => v - C);
      const A = Math.max(...centered.map(Math.abs)) || 1;
      let zc = 0;
      for (let i = 1; i < centered.length; i++) { if (centered[i - 1] * centered[i] < 0) zc++; }
      const xRange = Math.max(...x) - Math.min(...x);
      const omega = zc > 1 ? Math.PI * zc / xRange : 4 * Math.PI / Math.max(xRange, 1e-10);
      // Estimate damping from ratio of early vs late peak amplitudes
      const q = Math.ceil(y.length / 4);
      const earlyAmp = Math.max(...centered.slice(0, q).map(Math.abs)) || A;
      const lateAmp  = Math.max(...centered.slice(y.length - q).map(Math.abs)) || 0.01;
      const gamma = earlyAmp > lateAmp ? Math.log(earlyAmp / lateAmp) / (xRange * 0.75) : 0.1;
      return [A, Math.max(gamma, 0.01), omega, 0, C];
    }
  },
  'Weibull': {
    params: ['λ', 'k'],
    fn: (x, [lam, k]) => 1 - Math.exp(-Math.pow(Math.max(x, 1e-12) / (lam || 1e-10), k)),
    analytic: false,
    autoInit(x, y) {
      // λ ≈ x where F ≈ 0.632 (= 1−1/e, the Weibull scale characteristic)
      const idx = y.reduce((b, yi, i) => Math.abs(yi - 0.632) < Math.abs(y[b] - 0.632) ? i : b, 0);
      const lam = Math.max(x[idx], x[0], 1e-6);
      // Log-log linearisation: ln(−ln(1−F)) = k·ln(x) − k·ln(λ) → slope = k
      const valid = x.map((xi, i) => [xi, y[i]]).filter(([xi, yi]) => xi > 0 && yi > 0 && yi < 1);
      let k = 2;
      if (valid.length >= 3) {
        const lx = valid.map(([xi]) => Math.log(xi));
        const ly = valid.map(([, yi]) => Math.log(-Math.log(1 - yi)));
        const xlm = mean(lx), ylm = mean(ly);
        const kEst = lx.reduce((s, lxi, i) => s + (lxi - xlm) * (ly[i] - ylm), 0) /
                     (lx.reduce((s, lxi) => s + (lxi - xlm) ** 2, 0) || 1);
        if (isFinite(kEst) && kEst > 0.1) k = Math.min(kEst, 20);
      }
      return [lam, k];
    }
  },
  'Boltzmann': {
    params: ['A', 'Vh', 'k'],
    fn: (x, [A, Vh, k]) => A / (1 + Math.exp(-(x - Vh) / (k || 1e-10))),
    analytic: false,
    autoInit(x, y) {
      const yf = y.filter(isFinite);
      const A = Math.max(...yf);
      const Vh = x[Math.floor(x.length / 2)];
      return [isFinite(A) ? A : 1, Vh, 10];
    }
  },
  'Double-Boltzmann': {
    params: ['A1', 'Vh1', 'k1', 'A2', 'Vh2', 'k2'],
    fn: (x, [A1, Vh1, k1, A2, Vh2, k2]) =>
      A1 / (1 + Math.exp(-(x - Vh1) / (k1 || 1e-10))) +
      A2 / (1 + Math.exp(-(x - Vh2) / (k2 || 1e-10))),
    analytic: false,
    autoInit(x, y) {
      const yf = y.filter(isFinite);
      const A = Math.max(...yf);
      const xlo = x[Math.floor(x.length * 0.25)];
      const xhi = x[Math.floor(x.length * 0.75)];
      return [isFinite(A) ? A * 0.6 : 1, xlo, 8, isFinite(A) ? A * 0.4 : 0.5, xhi, 8];
    }
  },
  'HH-Activation': {
    params: ['g', 'Vm', 'km', 'p', 'Erev'],
    fn: (x, [g, Vm, km, p, Erev]) => {
      const m = 1 / (1 + Math.exp(-(x - Vm) / (km || 1e-10)));
      return g * Math.pow(Math.max(m, 1e-12), p) * (x - Erev);
    },
    analytic: false,
    autoInit(x, y) {
      let Erev = x[Math.floor(x.length / 2)];
      for (let i = 0; i < x.length - 1; i++) {
        if (y[i] * y[i + 1] <= 0) {
          Erev = x[i] + (x[i + 1] - x[i]) * Math.abs(y[i]) / (Math.abs(y[i]) + Math.abs(y[i + 1]));
          break;
        }
      }
      const maxAbs = Math.max(...y.map(Math.abs).filter(isFinite));
      const Vm = x[Math.floor(x.length * 0.3)];
      return [isFinite(maxAbs) ? maxAbs / 50 : 1, Vm, 10, 2, Erev];
    }
  },
  'HH-Na-IV': {
    params: ['g', 'Vm', 'km', 'Vh', 'kh', 'Erev'],
    fn: (x, [g, Vm, km, Vh, kh, Erev]) => {
      const m = 1 / (1 + Math.exp(-(x - Vm) / (km || 1e-10)));
      const h = 1 / (1 + Math.exp((x - Vh) / (kh || 1e-10)));
      return g * m * m * m * h * (x - Erev);
    },
    analytic: false,
    autoInit(x, y) {
      let Erev = x[Math.floor(x.length * 0.75)];
      for (let i = 0; i < x.length - 1; i++) {
        if (y[i] * y[i + 1] <= 0) {
          Erev = x[i] + (x[i + 1] - x[i]) * Math.abs(y[i]) / (Math.abs(y[i]) + Math.abs(y[i + 1]));
          break;
        }
      }
      const xRng = x[x.length - 1] - x[0];
      const Vm = x[0] + xRng * 0.35;
      const Vh = x[0] + xRng * 0.6;
      const maxAbs = Math.max(...y.map(Math.abs).filter(isFinite));
      return [isFinite(maxAbs) ? maxAbs / 80 : 0.5, Vm, 7, Vh, 7, Erev];
    }
  },
  'Kir': {
    params: ['g', 'EK', 'Vh', 'k'],
    fn: (x, [g, EK, Vh, k]) => g * (x - EK) / (1 + Math.exp((x - Vh) / (k || 1e-10))),
    analytic: false,
    autoInit(x, y) {
      let EK = x[Math.floor(x.length / 2)];
      for (let i = 0; i < x.length - 1; i++) {
        if (y[i] * y[i + 1] <= 0) {
          EK = x[i] + (x[i + 1] - x[i]) * Math.abs(y[i]) / (Math.abs(y[i]) + Math.abs(y[i + 1]));
          break;
        }
      }
      const maxAbs = Math.max(...y.map(Math.abs).filter(isFinite));
      return [isFinite(maxAbs) ? maxAbs / 50 : 0.5, EK, EK - 20, 10];
    }
  },
  'GHK': {
    params: ['A', 'r', 'Vt'],
    fn: (x, [A, r, Vt]) => {
      const vt = Vt || 25.7;
      if (Math.abs(x) < 1e-6) return A * vt * (1 - r);
      return A * x * (1 - r * Math.exp(-x / vt)) / (1 - Math.exp(-x / vt));
    },
    analytic: false,
    autoInit(x, y) {
      const maxAbs = Math.max(...y.map(Math.abs).filter(isFinite));
      return [isFinite(maxAbs) ? maxAbs / 80 : 0.5, 0.1, 25.7];
    }
  },
  'Tau-Gaussian': {
    params: ['tau_max', 'Vpeak', 'k', 'tau_min'],
    fn: (x, [tau_max, Vpeak, k, tau_min]) =>
      tau_max * Math.exp(-0.5 * ((x - Vpeak) / (k || 1e-10)) ** 2) + tau_min,
    analytic: false,
    autoInit(x, y) {
      const yf = y.filter(isFinite);
      const tau_min = Math.max(Math.min(...yf), 0);
      const tau_max = Math.max(...yf) - tau_min;
      const imax = y.indexOf(Math.max(...yf));
      const Vpeak = x[imax >= 0 ? imax : Math.floor(x.length / 2)];
      const xRng = (x[x.length - 1] - x[0]) / 4;
      return [isFinite(tau_max) ? tau_max : 1, Vpeak, xRng, tau_min];
    }
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
function injectOutliers(arr, count, scale) {
  if (!count || count <= 0) return arr;
  if (!scale || scale <= 0) scale = 4;
  const result = arr.slice();
  const n = result.length;
  const finite = arr.filter(v => isFinite(v));
  if (!finite.length) return result;
  const lo = Math.min(...finite), hi = Math.max(...finite);
  const range = Math.max(hi - lo, Math.abs(hi + lo) * 0.1, 1e-10);
  const pool = Array.from({ length: n }, (_, i) => i);
  for (let k = 0; k < Math.min(count, n); k++) {
    const j = Math.floor(Math.random() * pool.length);
    const i = pool.splice(j, 1)[0];
    result[i] += (Math.random() < 0.5 ? 1 : -1) * range * scale * (0.8 + Math.random() * 0.4);
  }
  return result;
}

const EXAMPLES = {
  'exponential-decay': {
    title: 'Exp Decay (Radioactive)',
    params: [
      { key: 'A',    label: 'Amplitude (A)',  value: 95,   min: 1,    max: 500,  step: 1    },
      { key: 'b',    label: 'Decay rate (b)', value: 0.18, min: 0.01, max: 5,    step: 0.01 },
      { key: 'C',    label: 'Offset (C)',      value: 2,    min: -100, max: 200,  step: 0.5  },
      { key: 'noise',   label: 'Noise (σ)',       value: 1.5,  min: 0,    max: 30,   step: 0.1  },
      { key: 'N',       label: 'Points (N)',      value: 24,   min: 5,    max: 200,  step: 1    },
      { key: 'xmax',    label: 'x max',           value: 20,   min: 1,    max: 200,  step: 1    },
      { key: 'outliers',label: 'Outliers',         value: 0,    min: 0,    max: 8,    step: 1    },
    ],
    generate(p) {
      const t = linspace(0, p.xmax, p.N);
      return { name: 'Exp Decay (Radioactive)', x: t, y: noisyGauss(t.map(x => p.A * Math.exp(-p.b * x) + p.C), p.noise), xlabel: 'Time (s)', ylabel: 'Activity (Bq)', suggestModel: 'Exp-Decay-Offset' };
    }
  },
  'gaussian-peak': {
    title: 'Gaussian Peak (Spectroscopy)',
    params: [
      { key: 'A',    label: 'Amplitude (A)', value: 120,  min: 1,    max: 1000, step: 1    },
      { key: 'mu',   label: 'Center (μ)',     value: 0.5,  min: -20,  max: 20,   step: 0.1  },
      { key: 'sig',  label: 'Width (σ)',      value: 1.2,  min: 0.05, max: 20,   step: 0.05 },
      { key: 'C',    label: 'Baseline (C)',   value: 5,    min: -50,  max: 200,  step: 1    },
      { key: 'noise',   label: 'Noise (σ)',      value: 3,    min: 0,    max: 50,   step: 0.5  },
      { key: 'N',       label: 'Points (N)',     value: 40,   min: 5,    max: 200,  step: 1    },
      { key: 'xmin',    label: 'x min',          value: -6,   min: -50,  max: 0,    step: 0.5  },
      { key: 'xmax',    label: 'x max',          value: 6,    min: 0,    max: 50,   step: 0.5  },
      { key: 'outliers',label: 'Outliers',        value: 0,    min: 0,    max: 8,    step: 1    },
    ],
    generate(p) {
      const x = linspace(p.xmin, p.xmax, p.N);
      return { name: 'Gaussian Peak (Spectroscopy)', x, y: noisyGauss(x.map(xi => p.A * Math.exp(-0.5 * ((xi - p.mu) / p.sig) ** 2) + p.C), p.noise), xlabel: 'Wavenumber (cm⁻¹)', ylabel: 'Absorbance', suggestModel: 'Gaussian' };
    }
  },
  'logistic-growth': {
    title: 'Logistic Growth (Cell Culture)',
    params: [
      { key: 'L',    label: 'Capacity (L)',    value: 1e6,  min: 100,  max: 1e9,  step: 1e4  },
      { key: 'k',    label: 'Growth rate (k)', value: 0.18, min: 0.01, max: 2,    step: 0.01 },
      { key: 'x0',   label: 'Midpoint (x₀)',   value: 20,   min: 1,    max: 100,  step: 0.5  },
      { key: 'noise',   label: 'Noise (σ)',        value: 1.5e4,min: 0,    max: 5e5,  step: 1e3  },
      { key: 'N',       label: 'Points (N)',       value: 32,   min: 5,    max: 200,  step: 1    },
      { key: 'xmax',    label: 'x max',            value: 48,   min: 5,    max: 200,  step: 1    },
      { key: 'outliers',label: 'Outliers',          value: 0,    min: 0,    max: 8,    step: 1    },
    ],
    generate(p) {
      const t = linspace(0, p.xmax, p.N);
      return { name: 'Logistic Growth (Cell Culture)', x: t, y: noisyGauss(t.map(x => p.L / (1 + Math.exp(-p.k * (x - p.x0)))), p.noise), xlabel: 'Time (h)', ylabel: 'Cell Count', suggestModel: 'Logistic' };
    }
  },
  'michaelis-menten': {
    title: 'Michaelis-Menten (Enzyme Kinetics)',
    params: [
      { key: 'Vmax', label: 'Vmax',          value: 450,  min: 1,    max: 5000, step: 10   },
      { key: 'Km',      label: 'Km',            value: 12,   min: 0.01, max: 500,  step: 0.5  },
      { key: 'noise',   label: 'Noise (σ)',      value: 8,    min: 0,    max: 100,  step: 0.5  },
      { key: 'outliers',label: 'Outliers',        value: 0,    min: 0,    max: 6,    step: 1    },
    ],
    generate(p) {
      const S = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 40, 80, 150, 250];
      return { name: 'Michaelis-Menten (Enzyme Kinetics)', x: S, y: noisyGauss(S.map(s => p.Vmax * s / (p.Km + s)), p.noise), xlabel: '[S] (mM)', ylabel: 'v (μmol·min⁻¹)', suggestModel: 'Michaelis-Menten' };
    }
  },
  'damped-oscillation': {
    title: 'Damped Oscillation (Vibration)',
    params: [
      { key: 'A',     label: 'Amplitude (A)', value: 8,    min: 0.1,   max: 100,  step: 0.5  },
      { key: 'gamma', label: 'Damping (γ)',    value: 0.3,  min: 0,     max: 5,    step: 0.05 },
      { key: 'omega', label: 'Frequency (ω)', value: 3.2,  min: 0.1,   max: 20,   step: 0.1  },
      { key: 'phi',   label: 'Phase (φ)',      value: 0.5,  min: -3.14, max: 3.14, step: 0.1  },
      { key: 'noise',   label: 'Noise (σ)',      value: 0.3,  min: 0,     max: 10,   step: 0.05 },
      { key: 'N',       label: 'Points (N)',     value: 60,   min: 5,     max: 300,  step: 1    },
      { key: 'xmax',    label: 'x max',          value: 10,   min: 1,     max: 100,  step: 1    },
      { key: 'outliers',label: 'Outliers',        value: 0,    min: 0,     max: 8,    step: 1    },
    ],
    generate(p) {
      const t = linspace(0, p.xmax, p.N);
      return { name: 'Damped Oscillation (Vibration)', x: t, y: noisyGauss(t.map(x => p.A * Math.exp(-p.gamma * x) * Math.sin(p.omega * x + p.phi)), p.noise), xlabel: 'Time (s)', ylabel: 'Displacement (mm)', suggestModel: 'Damped-Sine' };
    }
  },
  'linear-calibration': {
    title: 'Linear Calibration',
    params: [
      { key: 'm',    label: 'Slope (m)',      value: 2.45, min: -100, max: 100,  step: 0.05 },
      { key: 'b',    label: 'Intercept (b)',  value: 0.12, min: -100, max: 100,  step: 0.05 },
      { key: 'noise',   label: 'Noise (σ)',       value: 0.15, min: 0,    max: 20,   step: 0.05 },
      { key: 'N',       label: 'Points (N)',      value: 18,   min: 3,    max: 200,  step: 1    },
      { key: 'xmax',    label: 'x max',           value: 10,   min: 1,    max: 100,  step: 1    },
      { key: 'outliers',label: 'Outliers',         value: 0,    min: 0,    max: 8,    step: 1    },
    ],
    generate(p) {
      const c = linspace(0, p.xmax, p.N);
      return { name: 'Linear Calibration', x: c, y: noisyGauss(c.map(x => p.m * x + p.b), p.noise), xlabel: 'Concentration (mM)', ylabel: 'Absorbance', suggestModel: 'Linear' };
    }
  },
  'hill-equation': {
    title: 'Hill Equation (Dose-Response)',
    params: [
      { key: 'Vmax', label: 'Vmax',            value: 300,  min: 1,    max: 5000, step: 10   },
      { key: 'Kd',   label: 'Kd (EC50)',       value: 4,    min: 0.01, max: 200,  step: 0.1  },
      { key: 'n',       label: 'Hill coeff. (n)', value: 2.5,  min: 0.1,  max: 10,   step: 0.1  },
      { key: 'noise',   label: 'Noise (σ)',        value: 6,    min: 0,    max: 100,  step: 1    },
      { key: 'outliers',label: 'Outliers',          value: 0,    min: 0,    max: 6,    step: 1    },
    ],
    generate(p) {
      const S = [0.1,0.25,0.5,1,1.5,2,3,4,6,8,12,18,25,35,50,75,100];
      return { name: 'Hill Equation (Dose-Response)', x: S, y: noisyGauss(S.map(x => p.Vmax * Math.pow(x, p.n) / (Math.pow(p.Kd, p.n) + Math.pow(x, p.n))), p.noise), xlabel: '[Ligand] (μM)', ylabel: 'Response (%)', suggestModel: 'Hill' };
    }
  },
  'power-law': {
    title: 'Power Law (Allometric Scaling)',
    params: [
      { key: 'a',    label: 'Scale (a)',   value: 0.014, min: 0.001, max: 100,  step: 0.001 },
      { key: 'b',    label: 'Exponent (b)',value: 0.75,  min: 0.1,   max: 3,    step: 0.05  },
      { key: 'noise',   label: 'Noise (σ%)',  value: 8,     min: 0,     max: 50,   step: 1     },
      { key: 'N',       label: 'Points (N)',  value: 24,    min: 4,     max: 100,  step: 1     },
      { key: 'outliers',label: 'Outliers',     value: 0,     min: 0,     max: 8,    step: 1     },
    ],
    generate(p) {
      const masses = [0.01,0.03,0.07,0.15,0.3,0.5,1,2,5,10,20,50,100,200,500,1000,2000,5000,10000,30000,60000,100000,300000,700000];
      const x = masses.slice(0, p.N);
      const yClean = x.map(m => p.a * Math.pow(m, p.b));
      const y = yClean.map(v => v * (1 + (p.noise / 100) * gauss()));
      return { name: 'Allometric Scaling (Power Law)', x, y, xlabel: 'Body Mass (g)', ylabel: 'Metabolic Rate (W)', suggestModel: 'Power' };
    }
  },
  'lorentzian-peak': {
    title: 'Lorentzian Peak (NMR)',
    params: [
      { key: 'A',    label: 'Amplitude (A)', value: 200,  min: 1,    max: 2000, step: 5    },
      { key: 'x0',   label: 'Center (x₀)',   value: 3.6,  min: -50,  max: 50,   step: 0.1  },
      { key: 'g',    label: 'Half-width (γ)', value: 0.4,  min: 0.01, max: 10,   step: 0.05 },
      { key: 'C',    label: 'Baseline (C)',   value: 4,    min: -50,  max: 200,  step: 1    },
      { key: 'noise',   label: 'Noise (σ)',      value: 4,    min: 0,    max: 50,   step: 0.5  },
      { key: 'N',       label: 'Points (N)',     value: 50,   min: 5,    max: 200,  step: 1    },
      { key: 'outliers',label: 'Outliers',        value: 0,    min: 0,    max: 8,    step: 1    },
    ],
    generate(p) {
      const x = linspace(p.x0 - 6 * p.g, p.x0 + 6 * p.g, p.N);
      return { name: 'Lorentzian Peak (NMR)', x, y: noisyGauss(x.map(xi => p.A * p.g * p.g / ((xi - p.x0) ** 2 + p.g * p.g) + p.C), p.noise), xlabel: 'Chemical Shift (ppm)', ylabel: 'Intensity (a.u.)', suggestModel: 'Lorentzian' };
    }
  },
  'weibull-survival': {
    title: 'Weibull CDF (Reliability)',
    params: [
      { key: 'lam',  label: 'Scale (λ)',      value: 500,  min: 10,   max: 10000, step: 10  },
      { key: 'k',    label: 'Shape (k)',       value: 2.2,  min: 0.5,  max: 10,    step: 0.1 },
      { key: 'noise',   label: 'Noise (σ)',       value: 0.02, min: 0,    max: 0.2,   step: 0.005},
      { key: 'N',       label: 'Points (N)',      value: 30,   min: 5,    max: 100,   step: 1   },
      { key: 'outliers',label: 'Outliers',         value: 0,    min: 0,    max: 8,     step: 1   },
    ],
    generate(p) {
      const t = linspace(10, p.lam * 2, p.N);
      return { name: 'Weibull CDF (Reliability)', x: t, y: noisyGauss(t.map(x => 1 - Math.exp(-Math.pow(x / p.lam, p.k))), p.noise).map(v => Math.max(0, Math.min(1, v))), xlabel: 'Time to Failure (h)', ylabel: 'Failure Probability', suggestModel: 'Weibull' };
    }
  },
  'polynomial-calibration': {
    title: 'Polynomial Calibration Curve',
    params: [
      { key: 'a3',   label: 'a₃ (cubic)',     value: -0.008, min: -1,   max: 1,    step: 0.001 },
      { key: 'a2',   label: 'a₂ (quadratic)', value: 0.22,   min: -5,   max: 5,    step: 0.01  },
      { key: 'a1',   label: 'a₁ (linear)',    value: 1.85,   min: -20,  max: 20,   step: 0.05  },
      { key: 'a0',   label: 'a₀ (offset)',    value: 0.05,   min: -10,  max: 10,   step: 0.01  },
      { key: 'noise',   label: 'Noise (σ)',       value: 0.4,    min: 0,    max: 5,    step: 0.05  },
      { key: 'N',       label: 'Points (N)',      value: 22,     min: 5,    max: 100,  step: 1     },
      { key: 'xmax',    label: 'x max',           value: 20,     min: 1,    max: 100,  step: 1     },
      { key: 'outliers',label: 'Outliers',         value: 0,      min: 0,    max: 8,    step: 1     },
    ],
    generate(p) {
      const x = linspace(0, p.xmax, p.N);
      return { name: 'Polynomial Calibration (Cubic)', x, y: noisyGauss(x.map(xi => p.a3*xi**3 + p.a2*xi**2 + p.a1*xi + p.a0), p.noise), xlabel: 'Concentration (mM)', ylabel: 'Signal (mV)', suggestModel: 'Polynomial-3' };
    }
  },
  'sinusoidal': {
    title: 'Sinusoidal Signal',
    params: [
      { key: 'A',    label: 'Amplitude (A)', value: 5,    min: 0.1,   max: 100,  step: 0.1  },
      { key: 'omega',label: 'Frequency (ω)', value: 1.4,  min: 0.05,  max: 20,   step: 0.05 },
      { key: 'phi',  label: 'Phase (φ)',      value: 0.8,  min: -3.14, max: 3.14, step: 0.05 },
      { key: 'C',    label: 'Offset (C)',     value: 1.2,  min: -50,   max: 50,   step: 0.1  },
      { key: 'noise',   label: 'Noise (σ)',      value: 0.4,  min: 0,     max: 10,   step: 0.05 },
      { key: 'N',       label: 'Points (N)',     value: 60,   min: 10,    max: 300,  step: 1    },
      { key: 'xmax',    label: 'x max (periods)',value: 8,    min: 1,     max: 50,   step: 0.5  },
      { key: 'outliers',label: 'Outliers',        value: 0,    min: 0,     max: 8,    step: 1    },
    ],
    generate(p) {
      const xmax = p.xmax * (2 * Math.PI / p.omega);
      const t = linspace(0, xmax, p.N);
      return { name: 'Sinusoidal Signal', x: t, y: noisyGauss(t.map(x => p.A * Math.sin(p.omega * x + p.phi) + p.C), p.noise), xlabel: 'Time (s)', ylabel: 'Amplitude', suggestModel: 'Sine' };
    }
  },
  'gv-boltzmann': {
    title: 'G-V Curve (Boltzmann)',
    params: [
      { key: 'A',    label: 'G max (nS)',            value: 1.0,  min: 0.01, max: 20,   step: 0.01  },
      { key: 'Vh',   label: 'Half-activation (mV)',  value: -30,  min: -120, max: 60,   step: 1     },
      { key: 'k',    label: 'Slope factor (mV)',     value: 8,    min: 1,    max: 30,   step: 0.5   },
      { key: 'noise',label: 'Noise (σ)',              value: 0.02, min: 0,    max: 0.5,  step: 0.005 },
      { key: 'N',    label: 'Points (N)',             value: 33,   min: 5,    max: 100,  step: 1     },
    ],
    generate(p) {
      const V = linspace(-100, 60, p.N);
      const G = V.map(v => p.A / (1 + Math.exp(-(v - p.Vh) / p.k)));
      return { name: 'G-V Curve (Boltzmann)', x: V, y: noisyGauss(G, p.noise), xlabel: 'Voltage (mV)', ylabel: 'Conductance (nS)', suggestModel: 'Boltzmann' };
    }
  },
  'kir-iv': {
    title: 'Kir Channel I-V',
    params: [
      { key: 'g',    label: 'Conductance (nS)',   value: 2.0,  min: 0.1,  max: 20,   step: 0.1  },
      { key: 'EK',   label: 'Reversal E_K (mV)',  value: -80,  min: -120, max: 0,    step: 1    },
      { key: 'Vh',   label: 'Half-block V (mV)',  value: -60,  min: -120, max: 0,    step: 1    },
      { key: 'k',    label: 'Slope factor (mV)',  value: 12,   min: 1,    max: 30,   step: 0.5  },
      { key: 'noise',label: 'Noise (σ, pA)',      value: 2,    min: 0,    max: 30,   step: 0.5  },
      { key: 'N',    label: 'Points (N)',          value: 29,   min: 5,    max: 100,  step: 1    },
    ],
    generate(p) {
      const V = linspace(-120, 20, p.N);
      const I = V.map(v => p.g * (v - p.EK) / (1 + Math.exp((v - p.Vh) / p.k)));
      return { name: 'Kir Channel I-V', x: V, y: noisyGauss(I, p.noise), xlabel: 'Voltage (mV)', ylabel: 'Current (pA)', suggestModel: 'Kir' };
    }
  },
  'hhna-iv': {
    title: 'HH Na Channel I-V',
    params: [
      { key: 'g',    label: 'Max conductance (nS)', value: 50,   min: 1,    max: 500,  step: 1    },
      { key: 'Vm',   label: 'Act. V½ (mV)',         value: -30,  min: -80,  max: 0,    step: 1    },
      { key: 'km',   label: 'Act. slope (mV)',      value: 7,    min: 1,    max: 20,   step: 0.5  },
      { key: 'Vh',   label: 'Inact. V½ (mV)',       value: -55,  min: -100, max: 0,    step: 1    },
      { key: 'kh',   label: 'Inact. slope (mV)',    value: 7,    min: 1,    max: 20,   step: 0.5  },
      { key: 'Erev', label: 'Na reversal (mV)',      value: 50,   min: 0,    max: 120,  step: 1    },
      { key: 'noise',label: 'Noise (σ, pA)',         value: 5,    min: 0,    max: 100,  step: 1    },
      { key: 'N',    label: 'Points (N)',            value: 35,   min: 5,    max: 100,  step: 1    },
    ],
    generate(p) {
      const V = linspace(-80, 60, p.N);
      const I = V.map(v => {
        const m = 1 / (1 + Math.exp(-(v - p.Vm) / p.km));
        const h = 1 / (1 + Math.exp((v - p.Vh) / p.kh));
        return p.g * m * m * m * h * (v - p.Erev);
      });
      return { name: 'HH Na Channel I-V', x: V, y: noisyGauss(I, p.noise), xlabel: 'Voltage (mV)', ylabel: 'Current (pA)', suggestModel: 'HH-Na-IV' };
    }
  },
  'tau-voltage': {
    title: 'Voltage-Dependent τ',
    params: [
      { key: 'tau_max', label: 'τ max (ms)',        value: 5,    min: 0.1,  max: 50,   step: 0.1  },
      { key: 'Vpeak',   label: 'Peak voltage (mV)', value: -40,  min: -100, max: 60,   step: 1    },
      { key: 'k',       label: 'Width σ (mV)',       value: 15,   min: 2,    max: 60,   step: 0.5  },
      { key: 'tau_min', label: 'τ min (ms)',         value: 0.5,  min: 0,    max: 10,   step: 0.1  },
      { key: 'noise',   label: 'Noise (σ, ms)',      value: 0.1,  min: 0,    max: 2,    step: 0.05 },
      { key: 'N',       label: 'Points (N)',          value: 33,   min: 5,    max: 100,  step: 1    },
    ],
    generate(p) {
      const V = linspace(-100, 60, p.N);
      const tau = V.map(v => p.tau_max * Math.exp(-0.5 * ((v - p.Vpeak) / p.k) ** 2) + p.tau_min);
      return { name: 'Voltage-Dependent τ', x: V, y: noisyGauss(tau, p.noise), xlabel: 'Voltage (mV)', ylabel: 'τ (ms)', suggestModel: 'Tau-Gaussian' };
    }
  }
};

function generateExample(key, overrides) {
  const ex = EXAMPLES[key];
  if (!ex) return null;
  const p = {};
  ex.params.forEach(d => { p[d.key] = d.value; });
  if (overrides) Object.assign(p, overrides);
  // Round integer params
  ex.params.forEach(d => { if (d.step === 1) p[d.key] = Math.round(p[d.key]); });
  return ex.generate(p);
}

/* ═══════════════════════════════════════════════════════════
   APPLICATION STATE
═══════════════════════════════════════════════════════════ */
const DS_COLORS = ['#0b7a6e','#2563eb','#dc2626','#7c3aed','#f59e0b','#15803d','#c2410c','#db2777','#0891b2'];
let colorIdx = 0;
let idCounter = 0;
let _annIdCounter = 0;
function nextId() { return ++idCounter; }
function nextAnnId() { return ++_annIdCounter; }
function nextColor() { return DS_COLORS[colorIdx++ % DS_COLORS.length]; }

const DEFAULT_GRAPH_STYLE = {
  fontFamily: '',       // '' = theme default (DM Mono)
  fontSize: '',         // '' = theme default (11)
  fontColor: '',        // '' = theme text color
  plotBgColor: '',      // '' = theme plot bg
  paperBgColor: '',     // '' = theme paper bg
  showGridX: true, gridXColor: '', gridXWidth: 1, gridXDash: 'solid',
  showGridY: true, gridYColor: '', gridYWidth: 1, gridYDash: 'solid',
  showZeroLineX: true, zeroLineXColor: '', zeroLineXWidth: 1,
  showZeroLineY: true, zeroLineYColor: '', zeroLineYWidth: 1,
  tickFontSize: '',     // '' = theme default (10)
  showTicksX: true, showTicksY: true,
  showAxisLineX: false, showAxisLineY: false, axisLineColor: '',
  legendFontSize: '', legendBgColor: '', legendBorderColor: '',
  xMin: '', xMax: '', yMin: '', yMax: '', xDtick: '', yDtick: '',
};

const state = {
  datasets: [],    // {id, name, x, y, sigY?, color, visible}
  fits: [],        // {id, dsId, model, params, result, color, visible, label}
  annotations: [], // [{id, type, visible, x, y, label, font*, line*, arrow*}]
  graphStyle: Object.assign({}, DEFAULT_GRAPH_STYLE),
  activeDatasetId: null,
  activeFitId: null,
  fitConfig: { model: 'Exponential', customExpr: 'a * exp(-b * x) + c', customParams: [], xExtraMin: null, xExtraMax: null },
  plotConfig: { showResiduals: true, logX: false, logY: false, showCI: false, normalizeResiduals: false, showOutliers: false, showLegend: true, residualTab: 'residuals', logSuggestDismissed: { x: false, y: false } },
  paramRows: [],   // [{name, init, min, max}]  — live init guess state
  sweepParams: null,  // non-null while sweep slider is active
  selection: { dsId: null, indices: new Set() },
  editHistory: { undo: [], redo: [] },
  editSelectRadius: 0,
  currentWorker: null,
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
  let xlabel = null, ylabel = null, title = null;

  if (rows.length === 0) return { x: [], y: [], xlabel, ylabel, title };

  const firstRow = rows[0];
  const isNum = v => v.trim() !== '' && isFinite(parseFloat(v.replace(',', '.')));

  if (firstRow.length === 1 && !isNum(firstRow[0])) {
    // Single non-numeric cell → plot title
    title = firstRow[0].trim();
    startRow = 1;
  } else if (firstRow.length >= 2 && (!isNum(firstRow[0]) || !isNum(firstRow[1]))) {
    // Two columns with at least one non-numeric → X / Y axis labels
    xlabel = firstRow[0].trim();
    ylabel = firstRow[1].trim();
    startRow = 1;
  }

  const xs = [], ys = [];
  for (let i = startRow; i < rows.length; i++) {
    const row = rows[i];
    if (row.length < 2) continue;
    const x = parseFloat(row[0].replace(',', '.'));
    const y = parseFloat(row[1].replace(',', '.'));
    if (isFinite(x) && isFinite(y)) { xs.push(x); ys.push(y); }
  }
  return { x: xs, y: ys, xlabel, ylabel, title };
}

let _pendingImport = null; // { name, rows, headers, startRow }

function rowsToXYCols(rows, headers, startRow, xCol, yCol, sigCol) {
  const xs = [], ys = [], sigs = [];
  for (let i = startRow; i < rows.length; i++) {
    const row = rows[i];
    const xv = parseFloat((row[xCol] || '').replace(',', '.'));
    const yv = parseFloat((row[yCol] || '').replace(',', '.'));
    if (isFinite(xv) && isFinite(yv)) {
      xs.push(xv); ys.push(yv);
      if (sigCol != null) {
        const sv = parseFloat((row[sigCol] || '').replace(',', '.'));
        sigs.push(isFinite(sv) && sv > 0 ? sv : NaN);
      }
    }
  }
  const sigY = (sigCol != null && sigs.some(v => isFinite(v))) ? sigs : null;
  return { x: xs, y: ys, sigY };
}

function needsColumnPicker(rows) {
  const isNum = v => v.trim() !== '' && isFinite(parseFloat(v.replace(',', '.')));
  const dataRow = rows.find(r => r.some(v => isNum(v)));
  return dataRow && dataRow.length >= 3;
}

function openColumnPicker(name, rows) {
  const isNum = v => v.trim() !== '' && isFinite(parseFloat(v.replace(',', '.')));
  const hasHeader = rows.length > 0 && rows[0].some(v => !isNum(v));
  const headers = hasHeader
    ? rows[0].map((v, i) => v.trim() || `Col ${i + 1}`)
    : rows[0].map((_, i) => `Col ${i + 1}`);
  const startRow = hasHeader ? 1 : 0;
  _pendingImport = { name, rows, headers, startRow };
  const xSel  = document.getElementById('col-picker-x');
  const ySel  = document.getElementById('col-picker-y');
  const sigSel = document.getElementById('col-picker-sig');
  xSel.innerHTML  = headers.map((h, i) => `<option value="${i}">${h}</option>`).join('');
  ySel.innerHTML  = headers.map((h, i) => `<option value="${i}"${i === 1 ? ' selected' : ''}>${h}</option>`).join('');
  // Auto-select σ column when header looks like an uncertainty column
  const sigKeywords = /^(sig|sigma|err|error|uncertainty|sd|std|stdev|s\.?e\.?)$/i;
  const autoSigIdx = headers.findIndex(h => sigKeywords.test(h.trim()));
  sigSel.innerHTML = `<option value="">— None (X, Y only) —</option>` +
    headers.map((h, i) => `<option value="${i}"${i === autoSigIdx && autoSigIdx >= 0 ? ' selected' : ''}>${h}</option>`).join('');
  updateColPickerPreview();
  document.getElementById('col-picker-modal').style.display = 'flex';
}

function updateColPickerPreview() {
  if (!_pendingImport) return;
  const { rows, headers, startRow } = _pendingImport;
  const xCol  = parseInt(document.getElementById('col-picker-x').value);
  const yCol  = parseInt(document.getElementById('col-picker-y').value);
  const sigVal = document.getElementById('col-picker-sig').value;
  const sigCol = sigVal !== '' ? parseInt(sigVal) : null;
  const previewRows = rows.slice(startRow, startRow + 5);
  const hdr = sigCol != null
    ? `${headers[xCol]}  →  ${headers[yCol]}  ±  ${headers[sigCol]}`
    : `${headers[xCol]}  →  ${headers[yCol]}`;
  const lines = [hdr];
  for (const r of previewRows) {
    const xv = r[xCol] != null ? r[xCol] : '—';
    const yv = r[yCol] != null ? r[yCol] : '—';
    if (sigCol != null) {
      const sv = r[sigCol] != null ? r[sigCol] : '—';
      lines.push(`  ${String(xv).padEnd(12)} ${String(yv).padEnd(12)} ${sv}`);
    } else {
      lines.push(`  ${String(xv).padEnd(14)} ${yv}`);
    }
  }
  const total = rows.length - startRow;
  if (total > 5) lines.push(`  … (${total} rows total)`);
  document.getElementById('col-picker-preview').textContent = lines.join('\n');
}

function importFromColumnPicker() {
  if (!_pendingImport) return;
  const { name, rows, headers, startRow } = _pendingImport;
  const xCol  = parseInt(document.getElementById('col-picker-x').value);
  const yCol  = parseInt(document.getElementById('col-picker-y').value);
  const sigVal = document.getElementById('col-picker-sig').value;
  const sigCol = sigVal !== '' ? parseInt(sigVal) : null;
  const { x, y, sigY } = rowsToXYCols(rows, headers, startRow, xCol, yCol, sigCol);
  if (!x.length) { setConsole('No valid X,Y pairs in selected columns.', 'error'); return; }
  const sigNote = sigY ? ` ± ${headers[sigCol]}` : '';
  const dsName = `${name} (${headers[xCol]} vs ${headers[yCol]}${sigNote})`;
  importDataset(dsName, x, y, sigY);
  syncFitDatasetSelect(); renderDatasetList(); updatePlots();
  setConsole(`Imported: ${dsName} (${x.length} points${sigY ? ', σ loaded' : ''}).`, '');
  document.getElementById('col-picker-modal').style.display = 'none';
  _pendingImport = null;
}

function applyParsedMeta({ xlabel, ylabel, title }) {
  if (xlabel != null) document.getElementById('plot-xlabel').value = xlabel;
  if (ylabel != null) document.getElementById('plot-ylabel').value = ylabel;
  if (title  != null) document.getElementById('plot-title').value  = title;
}

function importDataset(name, x, y, sigY, color) {
  if (!x.length || !y.length) return null;
  const ds = { id: nextId(), name: name || `Dataset ${state.datasets.length + 1}`, x, y, originalY: y.slice(), color: color || nextColor(), visible: true, enabled: true, excludedIndices: new Set() };
  if (sigY && sigY.length === x.length) ds.sigY = sigY;
  state.datasets.push(ds);
  if (!state.activeDatasetId) {
    state.activeDatasetId = ds.id;
    autoNameTab(ds.name);
  }
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

function computeAutoLegendPos() {
  if (state.plotConfig.legendPos && state.plotConfig.legendPos.x != null) return state.plotConfig.legendPos;
  const xs = [], ys = [];
  for (const ds of state.datasets) {
    if (!ds.visible || ds.enabled === false) continue;
    xs.push(...ds.x); ys.push(...ds.y);
  }
  if (!xs.length) return { x: 0.99, y: 0.02 };
  const xMin = Math.min(...xs), xMax = Math.max(...xs);
  const yMin = Math.min(...ys), yMax = Math.max(...ys);
  const xRange = xMax - xMin || 1, yRange = yMax - yMin || 1;
  let brCount = 0, trCount = 0;
  for (let i = 0; i < xs.length; i++) {
    const nx = (xs[i] - xMin) / xRange;
    const ny = (ys[i] - yMin) / yRange;
    if (nx > 0.65) {
      if (ny < 0.35) brCount++;
      else if (ny > 0.65) trCount++;
    }
  }
  return brCount <= trCount ? { x: 0.99, y: 0.02 } : { x: 0.99, y: 0.98 };
}

function createDefaultAnnotation(type) {
  const isPeak = type === 'peak';
  const isText = type === 'text' || isPeak;
  return {
    id: nextAnnId(), type: type || 'hline', visible: true,
    x: 0, y: 0, label: '',
    fontFamily: 'DM Sans, sans-serif', fontSize: 12,
    fontBold: false, fontItalic: false, fontColor: '#374151',
    labelAnchor: isText ? 'center' : 'left',
    labelVAnchor: isText ? 'bottom' : 'bottom',
    bgColor: '#ffffff', bgOpacity: 0.85,
    borderShow: false, borderColor: '#d4d9e8',
    lineColor: '#6b7280', lineWidth: 1.5, lineDash: 'dash', lineOpacity: 0.7,
    showArrow: isText, arrowHead: 2, arrowSize: 1, arrowWidth: 1,
    arrowColor: '#374151', ax: 0, ay: -40,
    fitId: null,
  };
}

function buildPlotlyAnnotations() {
  const shapes = [], annotations = [];
  for (const ann of state.annotations) {
    if (!ann.visible) continue;
    let txt = ann.label || '';
    if (ann.fontBold && txt)   txt = `<b>${txt}</b>`;
    if (ann.fontItalic && txt) txt = `<i>${txt}</i>`;
    const fontObj = { family: ann.fontFamily || 'DM Sans, sans-serif', size: ann.fontSize || 12, color: ann.fontColor || '#374151' };
    const bgRgba   = hexToRgba(ann.bgColor || '#ffffff', ann.bgOpacity ?? 0.85);
    const borderCol = ann.borderShow ? (ann.borderColor || '#d4d9e8') : 'rgba(0,0,0,0)';
    const borderPad = ann.borderShow ? 3 : 0;
    const lineOpacity = ann.lineOpacity ?? 0.7;

    if (ann.type === 'hline') {
      shapes.push({ type: 'line', x0: 0, x1: 1, y0: ann.y, y1: ann.y, xref: 'paper', yref: 'y',
        line: { color: hexToRgba(ann.lineColor || '#6b7280', lineOpacity), width: ann.lineWidth ?? 1.5, dash: ann.lineDash || 'dash' } });
      if (txt) {
        const xPos = ann.labelAnchor === 'right' ? 0.99 : ann.labelAnchor === 'center' ? 0.5 : 0.01;
        annotations.push({ text: txt, x: xPos, y: ann.y, xref: 'paper', yref: 'y',
          xanchor: ann.labelAnchor || 'left', yanchor: ann.labelVAnchor || 'bottom',
          showarrow: false, font: fontObj, bgcolor: bgRgba, bordercolor: borderCol, borderpad: borderPad, borderwidth: ann.borderShow ? 1 : 0 });
      }
    } else if (ann.type === 'vline') {
      shapes.push({ type: 'line', x0: ann.x, x1: ann.x, y0: 0, y1: 1, xref: 'x', yref: 'paper',
        line: { color: hexToRgba(ann.lineColor || '#6b7280', lineOpacity), width: ann.lineWidth ?? 1.5, dash: ann.lineDash || 'dash' } });
      if (txt) {
        const yPos = ann.labelVAnchor === 'top' ? 0.97 : ann.labelVAnchor === 'middle' ? 0.5 : 0.03;
        annotations.push({ text: txt, x: ann.x, y: yPos, xref: 'x', yref: 'paper',
          xanchor: ann.labelAnchor || 'center', yanchor: ann.labelVAnchor || 'bottom',
          showarrow: false, font: fontObj, bgcolor: bgRgba, bordercolor: borderCol, borderpad: borderPad, borderwidth: ann.borderShow ? 1 : 0 });
      }
    } else {  // text or peak
      annotations.push({ text: txt || ' ', x: ann.x, y: ann.y, xref: 'x', yref: 'y',
        xanchor: ann.labelAnchor || 'center', yanchor: ann.labelVAnchor || 'bottom',
        showarrow: ann.showArrow !== false,
        ax: ann.ax ?? 0, ay: ann.ay ?? -40,
        arrowhead: ann.arrowHead ?? 2, arrowsize: ann.arrowSize ?? 1,
        arrowwidth: ann.arrowWidth ?? 1, arrowcolor: ann.arrowColor || '#374151',
        font: fontObj, bgcolor: bgRgba, bordercolor: borderCol, borderpad: borderPad, borderwidth: ann.borderShow ? 1 : 0 });
    }
  }
  return { shapes, annotations };
}

function baseLayout(extra) {
  const tc = themeColors();
  const gs = state.graphStyle || {};
  const gcol = (ov, fb) => (ov && ov !== '') ? ov : fb;
  const gnum = (ov, fb) => { const v = parseFloat(ov); return (isFinite(v) && v > 0) ? v : fb; };

  const fontFamily  = gcol(gs.fontFamily, "'DM Mono', monospace");
  const fontSize    = gnum(gs.fontSize, 11);
  const fontColor   = gcol(gs.fontColor, tc.textCol);
  const tickColor   = gcol(gs.fontColor, tc.tickCol);
  const tickSize    = gnum(gs.tickFontSize, 10);
  const axisLineCo  = gcol(gs.axisLineColor, tc.gridCol);

  const axisBase = (isX) => ({
    gridcolor:       (isX ? gs.showGridX : gs.showGridY) !== false
      ? gcol(isX ? gs.gridXColor : gs.gridYColor, tc.gridCol) : 'rgba(0,0,0,0)',
    gridwidth:       isX ? (gs.gridXWidth || 1) : (gs.gridYWidth || 1),
    griddash:        isX ? (gs.gridXDash || 'solid') : (gs.gridYDash || 'solid'),
    showgrid:        (isX ? gs.showGridX : gs.showGridY) !== false,
    zeroline:        (isX ? gs.showZeroLineX : gs.showZeroLineY) !== false,
    zerolinecolor:   (isX ? gs.showZeroLineX : gs.showZeroLineY) !== false
      ? gcol(isX ? gs.zeroLineXColor : gs.zeroLineYColor, tc.zeroLine) : 'rgba(0,0,0,0)',
    zerolinewidth:   isX ? (gs.zeroLineXWidth || 1) : (gs.zeroLineYWidth || 1),
    showticklabels:  (isX ? gs.showTicksX : gs.showTicksY) !== false,
    showline:        !!(isX ? gs.showAxisLineX : gs.showAxisLineY),
    linecolor:       axisLineCo, linewidth: 1,
    tickfont: { size: tickSize, color: tickColor },
    type: (isX ? state.plotConfig.logX : state.plotConfig.logY) ? 'log' : 'linear',
    ...(() => {
      const minV = parseFloat(isX ? gs.xMin : gs.yMin);
      const maxV = parseFloat(isX ? gs.xMax : gs.yMax);
      const dt   = parseFloat(isX ? gs.xDtick : gs.yDtick);
      const out  = {};
      if (isFinite(minV) && isFinite(maxV) && minV < maxV) { out.range = [minV, maxV]; out.autorange = false; }
      if (isFinite(dt) && dt > 0) out.dtick = dt;
      return out;
    })(),
  });

  const base = {
    plot_bgcolor:  gcol(gs.plotBgColor, tc.plotBg),
    paper_bgcolor: gcol(gs.paperBgColor, tc.paperBg),
    margin: { l: 52, r: 16, t: 28, b: 44 },
    font: { family: fontFamily, size: fontSize, color: fontColor },
    xaxis: axisBase(true),
    yaxis: axisBase(false),
    legend: (() => {
      const lp = computeAutoLegendPos();
      return {
        font: { size: gnum(gs.legendFontSize, 10), color: fontColor },
        bgcolor:     gcol(gs.legendBgColor, isDark() ? 'rgba(10,22,40,0.82)' : 'rgba(255,255,255,0.82)'),
        bordercolor: gcol(gs.legendBorderColor, tc.gridCol), borderwidth: 1,
        x: lp.x, y: lp.y,
        xanchor: lp.x > 0.5 ? 'right' : 'left',
        yanchor: lp.y > 0.5 ? 'top' : 'bottom',
      };
    })(),
    hovermode: 'closest',
    showlegend: state.plotConfig.showLegend,
    dragmode: 'pan',
  };
  return Object.assign(base, extra || {});
}

function computeCIBands(fit, xs) {
  const { covMatrix, dof, params } = fit.result;
  if (!covMatrix || dof <= 0) return null;
  const m = params.length;
  const tCrit = tCritical95(dof);
  const EPS = 1e-7;
  const lower = [], upper = [];
  for (const x of xs) {
    const y0 = fitEval(fit, x);
    if (!isFinite(y0)) { lower.push(null); upper.push(null); continue; }
    const g = params.map((_, j) => {
      const pp = params.slice();
      const h = Math.max(Math.abs(pp[j]) * EPS, EPS);
      pp[j] += h;
      try { const v = fit.fn(x, pp); return isFinite(v) ? (v - y0) / h : 0; } catch (_) { return 0; }
    });
    let variance = 0;
    for (let i = 0; i < m; i++)
      for (let j = 0; j < m; j++)
        variance += g[i] * covMatrix[i][j] * g[j];
    if (!isFinite(variance) || variance < 0) variance = 0;
    const hw = tCrit * Math.sqrt(variance);
    lower.push(y0 - hw);
    upper.push(y0 + hw);
  }
  return { lower, upper };
}

function predictAtX(fit, x) {
  const { params, covMatrix, dof } = fit.result;
  const y = fitEval(fit, x);
  if (!isFinite(y)) return null;
  if (!covMatrix || dof <= 0) return { y, lower: null, upper: null, hw: null };
  const EPS = 1e-7;
  const g = params.map((_, j) => {
    const pp = params.slice();
    const h = Math.max(Math.abs(pp[j]) * EPS, EPS);
    pp[j] += h;
    try { const v = fit.fn(x, pp); return isFinite(v) ? (v - y) / h : 0; } catch (_) { return 0; }
  });
  let variance = 0;
  for (let i = 0; i < params.length; i++)
    for (let j = 0; j < params.length; j++)
      variance += g[i] * covMatrix[i][j] * g[j];
  if (!isFinite(variance) || variance < 0) variance = 0;
  const hw = tCritical95(dof) * Math.sqrt(variance);
  return { y, lower: y - hw, upper: y + hw, hw };
}

function solveXfromY(fit, targetY, xMin, xMax) {
  const N = 500;
  const step = (xMax - xMin) / (N - 1);
  const roots = [];
  let prevX = xMin, prevY = fitEval(fit, xMin) - targetY;
  for (let i = 1; i < N; i++) {
    const curX = xMin + step * i;
    const curY = fitEval(fit, curX) - targetY;
    if (!isFinite(prevY) || !isFinite(curY) || prevY * curY > 0) { prevX = curX; prevY = curY; continue; }
    // Bisect in [prevX, curX]
    let lo = prevX, hi = curX;
    for (let k = 0; k < 52; k++) {
      const mid = (lo + hi) / 2;
      const fm = fitEval(fit, mid) - targetY;
      if (!isFinite(fm) || Math.abs(hi - lo) < 1e-12 * (Math.abs(mid) || 1)) break;
      if ((fitEval(fit, lo) - targetY) * fm < 0) hi = mid; else lo = mid;
    }
    const xSol = (lo + hi) / 2;
    // CI via delta method: dx_CI ≈ CI_y / |df/dx|
    const h = Math.max(Math.abs(xSol) * 1e-6, 1e-8);
    const dfdx = (fitEval(fit, xSol + h) - fitEval(fit, xSol - h)) / (2 * h);
    let xCIHW = null;
    if (isFinite(dfdx) && Math.abs(dfdx) > 1e-30) {
      const predCI = predictAtX(fit, xSol);
      if (predCI && predCI.hw != null) xCIHW = predCI.hw / Math.abs(dfdx);
    }
    roots.push({ x: xSol, xCIHW });
    prevX = curX; prevY = curY;
  }
  return roots;
}

function runFTest(fitA, fitB) {
  if (fitA.dsId !== fitB.dsId) return { error: 'Fits must use the same dataset.' };
  const pA = fitA.result.params.length, pB = fitB.result.params.length;
  if (pA === pB) return { error: 'Models have the same number of parameters — not nested.' };
  const [simple, complex] = pA <= pB ? [fitA, fitB] : [fitB, fitA];
  const n = simple.result.n, p1 = simple.result.params.length, p2 = complex.result.params.length;
  const dof2 = n - p2;
  if (dof2 <= 0) return { error: 'Insufficient degrees of freedom in the complex model.' };
  if (complex.result.sse <= 0) return { error: 'SSE of complex model is zero or negative.' };
  const sseSimple = simple.result.sse, sseComplex = complex.result.sse;
  const deltaP = p2 - p1;
  const F = ((sseSimple - sseComplex) / deltaP) / (sseComplex / dof2);
  const pVal = fDistPValue(F, deltaP, dof2);
  return { F, pVal, deltaP, dof2, simple, complex, sseSimple, sseComplex, n };
}

function buildMainTraces() {
  const traces = [];
  for (const ds of state.datasets) {
    if (!ds.visible || ds.enabled === false) continue;
    const excluded = ds.excludedIndices || new Set();
    // Active (non-excluded) points
    const activeX = ds.x.filter((_, i) => !excluded.has(i));
    const activeY = ds.y.filter((_, i) => !excluded.has(i));
    const activeOrigIdx = ds.x.map((_, i) => i).filter(i => !excluded.has(i));
    const activeSigRaw = ds.sigY ? ds.sigY.filter((_, i) => !excluded.has(i)) : null;
    // Plotly renders NaN error bars inconsistently; map to null (= no bar for that point)
    const activeSig = activeSigRaw?.some(v => isFinite(v))
      ? activeSigRaw.map(v => (isFinite(v) && v > 0) ? v : null)
      : null;
    traces.push({
      x: activeX, y: activeY,
      mode: 'markers', type: 'scatter', name: ds.name,
      marker: { color: ds.color, size: 6, opacity: 0.85 },
      ...(activeSig ? { error_y: { type: 'data', array: activeSig, visible: true,
        color: ds.color, thickness: 1.5, width: 4, opacity: 0.55 } } : {}),
      opacity: 1, showlegend: true,
      customdata: activeOrigIdx,
    });
    // Excluded (masked) points — shown as dim crosses
    if (excluded.size > 0) {
      const exX = ds.x.filter((_, i) => excluded.has(i));
      const exY = ds.y.filter((_, i) => excluded.has(i));
      traces.push({
        x: exX, y: exY, mode: 'markers', type: 'scatter',
        name: '_excluded', showlegend: false, hoverinfo: 'skip',
        marker: { color: ds.color, size: 7, opacity: 0.25,
                  symbol: 'x', line: { color: ds.color, width: 1.5 } },
      });
    }
  }
  for (const fit of state.fits) {
    if (!fit.visible || !fit.result) continue;
    const ds = state.datasets.find(d => d.id === fit.dsId);
    if (!ds || ds.enabled === false) continue;
    const xMin = state.fitConfig.xExtraMin ?? Math.min(...ds.x);
    const xMax = state.fitConfig.xExtraMax ?? Math.max(...ds.x);
    const xs = linspace(xMin, xMax, fit.curvePoints || 300);
    const ys = xs.map(x => {
      const v = fitEval(fit, x);
      return isFinite(v) ? v : null;
    });
    if (state.plotConfig.showCI && fit.fn) {
      const bands = computeCIBands(fit, xs);
      if (bands) {
        const bandColor = hexToRgba(fit.color || ds.color, 0.14);
        traces.push({
          x: [...xs, ...xs.slice().reverse()],
          y: [...bands.upper, ...bands.lower.slice().reverse()],
          fill: 'toself', fillcolor: bandColor,
          line: { color: 'transparent' }, mode: 'none', type: 'scatter',
          showlegend: false, hoverinfo: 'skip', name: '_ci_' + fit.id,
        });
      }
    }
    traces.push({
      x: xs, y: ys,
      mode: 'lines', type: 'scatter',
      name: fit.label || fit.model,
      line: { color: fit.color || ds.color, width: 2, dash: 'solid' },
      showlegend: true,
    });
    // Outlier rings for active fit when showOutliers is on — computed live so edit-mode moves update instantly
    if (state.plotConfig.showOutliers && fit.id === state.activeFitId && fit.fn) {
      const excl = ds.excludedIndices || new Set();
      const liveRes = [];
      ds.x.forEach((x, i) => {
        if (excl.has(i)) return;
        const v = fitEval(fit, x);
        liveRes.push({ i, r: isFinite(v) ? ds.y[i] - v : 0 });
      });
      if (!liveRes.length) return;
      const liveRmse = Math.sqrt(liveRes.reduce((s, e) => s + e.r * e.r, 0) / liveRes.length);
      if (liveRmse <= 0) return;
      const threshold = 2.5 * liveRmse;
      const ols = [], olx = [], oly = [], olr = [];
      liveRes.forEach(({ i, r }) => {
        if (Math.abs(r) > threshold) { ols.push(i); olx.push(ds.x[i]); oly.push(ds.y[i]); olr.push(r); }
      });
      if (olx.length) traces.push({
        x: olx, y: oly, mode: 'markers', type: 'scatter',
        name: '_outliers', showlegend: false,
        hovertemplate: olx.map((_, k) => `Outlier #${ols[k]}<br>res=${fmt(olr[k])}<extra></extra>`),
        marker: { color: 'rgba(0,0,0,0)', size: 14, line: { color: '#ef4444', width: 2 } },
      });
    }
  }
  // Selection overlay in edit mode
  if (state.selection.dsId && state.selection.indices.size) {
    const sds = state.datasets.find(d => d.id === state.selection.dsId);
    if (sds) {
      const sx = [], sy = [];
      state.selection.indices.forEach(i => { if (i < sds.x.length) { sx.push(sds.x[i]); sy.push(sds.y[i]); } });
      if (sx.length) traces.push({
        x: sx, y: sy, mode: 'markers', type: 'scatter',
        name: '_sel', showlegend: false, hoverinfo: 'skip',
        marker: { color: 'rgba(0,0,0,0)', size: 16, line: { color: '#f59e0b', width: 2.5 } },
      });
    }
  }
  // Parameter sweep preview
  if (state.sweepParams) {
    const fn = _getSweepFn();
    const sweepDs = state.datasets.find(d => d.id === state.activeDatasetId);
    if (fn && sweepDs && sweepDs.x.length) {
      const xMin = state.fitConfig.xExtraMin ?? Math.min(...sweepDs.x);
      const xMax = state.fitConfig.xExtraMax ?? Math.max(...sweepDs.x);
      const xs = linspace(xMin, xMax, 200);
      const ys = xs.map(x => { try { const v = fn(x, state.sweepParams); return isFinite(v) ? v : null; } catch (_) { return null; } });
      traces.push({ x: xs, y: ys, mode: 'lines', type: 'scatter', name: '_sweep', showlegend: false, hoverinfo: 'skip', line: { color: '#f59e0b', width: 2, dash: 'dot' } });
    }
  }
  return traces;
}

function _getSweepFn() {
  const model = state.fitConfig.model;
  const m = MODELS[model];
  if (model === 'Custom' && customCompiled) {
    const paramNames = state.fitConfig.customParams;
    return (x, params) => {
      const scope = { x };
      paramNames.forEach((name, i) => { scope[name] = params[i]; });
      try { const v = customCompiled.evaluate(scope); return isFinite(v) ? v : null; } catch (_) { return null; }
    };
  }
  return m?.fn || null;
}

function buildResidualVsXPanel(xlabel, tc) {
  const normalize = state.plotConfig.normalizeResiduals;
  const traces = [];
  for (const fit of state.fits) {
    if (!fit.visible || !fit.result) continue;
    const ds = state.datasets.find(d => d.id === fit.dsId);
    if (!ds || ds.enabled === false) continue;
    const excl = ds.excludedIndices || new Set();
    const xRes = ds.x.filter((_, i) => !excl.has(i));
    const scale = normalize && fit.result.rmse > 0 ? 1 / fit.result.rmse : 1;
    const residuals = fit.result.residuals.map(v => v * scale);
    traces.push({
      x: xRes, y: residuals,
      mode: 'markers', type: 'scatter',
      name: fit.label || fit.model,
      marker: { color: fit.color || ds.color, size: 5, opacity: 0.8 },
      opacity: 1,
      showlegend: false,
    });
    traces.push({
      x: [Math.min(...ds.x), Math.max(...ds.x)], y: [0, 0],
      mode: 'lines', type: 'scatter',
      line: { color: tc.gridCol, width: 1, dash: 'dot' },
      opacity: 1,
      showlegend: false, hoverinfo: 'skip',
    });
  }
  const layout = baseLayout({
    margin: { l: 56, r: 20, t: 10, b: 36 },
    yaxis: Object.assign(baseLayout().yaxis, { title: { text: normalize ? 'Norm. Residuals (σ)' : 'Residuals', font: { size: 10, color: tc.tickCol } }, type: 'linear', zeroline: true }),
    xaxis: Object.assign(baseLayout().xaxis, { title: { text: xlabel, font: { size: 10, color: tc.tickCol } } }),
    showlegend: false,
  });
  return { traces, layout };
}

function buildQQPanel(tc) {
  const noLayout = baseLayout({
    annotations: [{ text: 'No active fit', x: 0.5, y: 0.5, xref: 'paper', yref: 'paper', showarrow: false, font: { color: tc.tickCol, size: 11 } }],
    margin: { l: 56, r: 20, t: 10, b: 36 }, showlegend: false,
  });
  const data = getLiveResiduals();
  if (!data) return { traces: [], layout: noLayout };
  const { residuals, fit, ds } = data;
  const n = residuals.length;
  const sorted = residuals.slice().sort((a, b) => a - b);
  const mu = sorted.reduce((s, r) => s + r, 0) / n;
  const sigma = Math.sqrt(sorted.reduce((s, r) => s + (r - mu) ** 2, 0) / Math.max(n - 1, 1));
  const stdRes = sorted.map(r => (r - mu) / (sigma || 1));
  const theoQ  = sorted.map((_, i) => probitApprox((i + 1 - 0.375) / (n + 0.25)));
  const lo = Math.min(theoQ[0], stdRes[0]) - 0.3;
  const hi = Math.max(theoQ[n - 1], stdRes[n - 1]) + 0.3;
  return {
    traces: [
      { x: theoQ, y: stdRes, mode: 'markers', type: 'scatter',
        marker: { color: fit.color || ds.color, size: 5, opacity: 0.85 },
        showlegend: false, hovertemplate: 'Theoretical: %{x:.2f}<br>Sample: %{y:.2f}<extra></extra>' },
      { x: [lo, hi], y: [lo, hi], mode: 'lines', type: 'scatter',
        line: { color: '#ef4444', dash: 'dash', width: 1.5 },
        showlegend: false, hoverinfo: 'skip' },
    ],
    layout: baseLayout({
      margin: { l: 56, r: 20, t: 10, b: 36 },
      xaxis: Object.assign(baseLayout().xaxis, { title: { text: 'Theoretical Quantiles', font: { size: 10, color: tc.tickCol } } }),
      yaxis: Object.assign(baseLayout().yaxis, { title: { text: 'Sample Quantiles (σ)', font: { size: 10, color: tc.tickCol } }, type: 'linear', zeroline: false }),
      showlegend: false,
    }),
  };
}

function buildHistPanel(tc) {
  const noLayout = baseLayout({
    annotations: [{ text: 'No active fit', x: 0.5, y: 0.5, xref: 'paper', yref: 'paper', showarrow: false, font: { color: tc.tickCol, size: 11 } }],
    margin: { l: 56, r: 20, t: 10, b: 36 }, showlegend: false,
  });
  const data = getLiveResiduals();
  if (!data) return { traces: [], layout: noLayout };
  const { residuals, fit, ds } = data;
  const n = residuals.length;
  const nBins = Math.max(5, Math.ceil(Math.log2(n)) + 1);
  const mu = residuals.reduce((s, r) => s + r, 0) / n;
  const sigma = Math.sqrt(residuals.reduce((s, r) => s + (r - mu) ** 2, 0) / Math.max(n - 1, 1));
  const rMin = Math.min(...residuals), rMax = Math.max(...residuals);
  const pad = sigma || Math.abs(rMax - rMin) * 0.1 || 1;
  const xs = linspace(rMin - pad, rMax + pad, 200);
  const binWidth = (rMax - rMin) / Math.max(nBins, 1);
  const normScale = n * (binWidth || 1);
  const normalY = sigma > 0
    ? xs.map(x => normScale * Math.exp(-0.5 * ((x - mu) / sigma) ** 2) / (sigma * Math.sqrt(2 * Math.PI)))
    : xs.map(() => 0);
  const col = fit.color || ds.color;
  return {
    traces: [
      { x: residuals, type: 'histogram', nbinsx: nBins,
        marker: { color: hexToRgba(col, 0.6), line: { color: col, width: 1 } },
        showlegend: false, hovertemplate: '%{y} points<extra></extra>' },
      { x: xs, y: normalY, type: 'scatter', mode: 'lines',
        line: { color: '#ef4444', width: 1.5 },
        showlegend: false, hoverinfo: 'skip' },
    ],
    layout: baseLayout({
      margin: { l: 56, r: 20, t: 10, b: 36 },
      xaxis: Object.assign(baseLayout().xaxis, { title: { text: 'Residual', font: { size: 10, color: tc.tickCol } } }),
      yaxis: Object.assign(baseLayout().yaxis, { title: { text: 'Count', font: { size: 10, color: tc.tickCol } }, type: 'linear', zeroline: false }),
      barmode: 'overlay', showlegend: false,
    }),
  };
}

function buildConvergencePanel(tc) {
  const makeEmpty = msg => ({ traces: [], layout: baseLayout({
    annotations: [{ text: msg, x: 0.5, y: 0.5, xref: 'paper', yref: 'paper',
      showarrow: false, font: { color: tc.tickCol, size: 11 } }],
    margin: { l: 56, r: 20, t: 10, b: 36 }, showlegend: false,
  })});
  const fit = state.fits.find(f => f.id === state.activeFitId);
  if (!fit) return makeEmpty('No active fit');
  if (!fit.sseHistory || fit.sseHistory.length < 2)
    return makeEmpty(fit.sseHistory ? 'Not enough history — run the fit again' : 'Convergence data not available for this fit');

  // Filter out non-finite / non-positive SSE values that would break log scale
  const valid = fit.sseHistory.filter(p => isFinite(p[1]) && p[1] > 0);
  if (valid.length < 2) return makeEmpty('SSE values are not positive — cannot plot convergence');
  const iters = valid.map(p => p[0]);
  const sses  = valid.map(p => p[1]);

  const convergedText = fit.result?.converged ? '✓ Converged' : '⚠ Not converged';
  const iterText  = fit.result?.iter        != null ? `${fit.result.iter} iter`                          : '';
  const lambdaText= fit.result?.finalLambda != null ? ` · λ=${fit.result.finalLambda.toExponential(2)}`  : '';
  const gradText  = fit.result?.gradNorm    != null ? ` · |∇|=${fit.result.gradNorm.toExponential(2)}`   : '';
  const subtitle  = [convergedText, iterText + lambdaText + gradText].filter(Boolean).join(' · ');

  const btnStyle = {
    bgcolor: tc.paperBg, bordercolor: tc.gridCol,
    font: { size: 8, color: tc.tickCol },
  };
  const updatemenus = [
    {
      type: 'buttons', direction: 'left', showactive: true, active: 1,
      x: 0, xanchor: 'left', y: 1, yanchor: 'bottom',
      pad: { r: 0, t: 2 },
      ...btnStyle,
      buttons: [
        { label: 'Log X',    method: 'relayout',
          args: [{ 'xaxis.type': 'log',    'xaxis.autorange': true, 'xaxis.title.text': 'Iteration (log)' }] },
        { label: 'Linear X', method: 'relayout',
          args: [{ 'xaxis.type': 'linear', 'xaxis.autorange': true, 'xaxis.title.text': 'Iteration' }] },
      ],
    },
    {
      type: 'buttons', direction: 'left', showactive: true, active: 0,
      x: 1, xanchor: 'right', y: 1, yanchor: 'bottom',
      pad: { r: 0, t: 2 },
      ...btnStyle,
      buttons: [
        { label: 'Log Y',    method: 'relayout',
          args: [{ 'yaxis.type': 'log',    'yaxis.autorange': true, 'yaxis.title.text': 'SSE (log)' }] },
        { label: 'Linear Y', method: 'relayout',
          args: [{ 'yaxis.type': 'linear', 'yaxis.autorange': true, 'yaxis.title.text': 'SSE' }] },
      ],
    },
  ];

  return {
    traces: [{
      x: iters, y: sses, type: 'scatter', mode: 'lines+markers',
      line: { color: fit.color || '#0b7a6e', width: 1.5 },
      marker: { color: fit.color || '#0b7a6e', size: 3 },
      showlegend: false, hovertemplate: 'iter %{x}<br>SSE %{y:.4g}<extra></extra>',
    }],
    layout: baseLayout({
      margin: { l: 64, r: 20, t: subtitle ? 30 : 24, b: 36 },
      title: subtitle ? { text: subtitle, font: { size: 9.5, color: tc.tickCol }, x: 0.5, xref: 'paper', y: 1, yref: 'paper', yanchor: 'bottom', pad: { t: 2 } } : undefined,
      xaxis: Object.assign(baseLayout().xaxis, { title: { text: 'Iteration', font: { size: 10, color: tc.tickCol } }, type: 'linear', autorange: true }),
      yaxis: Object.assign(baseLayout().yaxis, {
        title: { text: 'SSE (log)', font: { size: 10, color: tc.tickCol } },
        type: 'log', autorange: true, zeroline: false,
      }),
      updatemenus,
      showlegend: false,
    }),
  };
}

function buildResidualPanel(xlabel, tc) {
  const tab = state.plotConfig.residualTab || 'residuals';
  if (tab === 'qq')          return buildQQPanel(tc);
  if (tab === 'hist')        return buildHistPanel(tc);
  if (tab === 'convergence') return buildConvergencePanel(tc);
  return buildResidualVsXPanel(xlabel, tc);
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
  const _annData = buildPlotlyAnnotations();
  if (_annData.shapes.length) mainLayout.shapes = _annData.shapes;
  if (_annData.annotations.length) mainLayout.annotations = _annData.annotations;

  const mainEl  = document.getElementById('main-plot');
  const residEl = document.getElementById('residual-plot');

  const { traces: resTraces, layout: resLayout } = buildResidualPanel(xlabel, tc);

  if (!plotsInitialised) {
    const legendIcon = {
      width: 857, height: 1000,
      path: 'M0 143h143v-143h-143v143z m214 0h643v-143h-643v143z m-214 286h143v-143h-143v143z m214 0h643v-143h-643v143z m-214 286h143v-143h-143v143z m214 0h643v-143h-643v143z',
      ascent: 850, descent: -150,
    };
    const plotCfg = {
      responsive: true, displaylogo: false, scrollZoom: true,
      edits: { legendPosition: true },
      modeBarButtonsToRemove: ['sendDataToCloud','editInChartStudio'],
      modeBarButtonsToAdd: [{
        name: 'Toggle legend',
        icon: legendIcon,
        click() {
          state.plotConfig.showLegend = !state.plotConfig.showLegend;
          updatePlots();
        },
      }],
    };
    Plotly.newPlot(mainEl, mainTraces, mainLayout, plotCfg);
    Plotly.newPlot(residEl, resTraces, resLayout, { responsive: true, displaylogo: false, modeBarButtonsToRemove: ['sendDataToCloud','editInChartStudio'] });
    plotsInitialised = true;
  } else {
    Plotly.react(mainEl, mainTraces, mainLayout);
    Plotly.react(residEl, resTraces, resLayout);
  }

  checkLogSuggest();
  syncResidualDimState();

  // After every react() the browser layout may still be settling (e.g. stats bar
  // just grew). Schedule one resize pass so Plotly re-measures the real container
  // dimensions instead of stale pre-reflow values — this prevents the tab bar from
  // being obscured by an oversized SVG.
  requestAnimationFrame(() => {
    void mainEl.offsetWidth;
    Plotly.Plots.resize(mainEl);
    if (!residEl.classList.contains('hidden')) Plotly.Plots.resize(residEl);
  });
}

function checkLogSuggest() {
  const banner = document.getElementById('log-suggest-banner');
  if (!banner) return;
  if (!state.datasets.length) { banner.style.display = 'none'; return; }
  const dis = state.plotConfig.logSuggestDismissed || {};
  const allX = [], allY = [];
  for (const ds of state.datasets) {
    if (ds.enabled === false || !ds.visible) continue;
    for (const v of ds.x) if (isFinite(v) && v > 0) allX.push(v);
    for (const v of ds.y) if (isFinite(v) && v > 0) allY.push(v);
  }
  const xSpan = allX.length > 1 ? Math.max(...allX) / Math.min(...allX) : 1;
  const ySpan = allY.length > 1 ? Math.max(...allY) / Math.min(...allY) : 1;
  const suggestX = xSpan > 100 && !state.plotConfig.logX && !dis.x;
  const suggestY = ySpan > 100 && !state.plotConfig.logY && !dis.y;
  if (!suggestX && !suggestY) { banner.style.display = 'none'; return; }
  const parts = [];
  if (suggestX) parts.push(`X spans ~${Math.round(Math.log10(xSpan))} decades`);
  if (suggestY) parts.push(`Y spans ~${Math.round(Math.log10(ySpan))} decades`);
  document.getElementById('log-suggest-text').textContent = parts.join(' · ') + ' — consider log scale:';
  document.getElementById('log-suggest-apply-x').style.display = suggestX ? '' : 'none';
  document.getElementById('log-suggest-apply-y').style.display = suggestY ? '' : 'none';
  banner.style.display = 'flex';
}

function fitEval(fit, x) {
  if (!fit.fn) return NaN;
  try { return fit.fn(x, fit.result.params); } catch (_) { return NaN; }
}

/* ═══════════════════════════════════════════════════════════
   UI RENDERING
═══════════════════════════════════════════════════════════ */
function renderMaskCount() {
  const el = document.getElementById('mask-count');
  if (!el) return;
  const ds = state.datasets.find(d => d.id === state.activeDatasetId);
  const n = ds && ds.excludedIndices ? ds.excludedIndices.size : 0;
  el.textContent = n > 0 ? `${n} masked` : '0 masked';
  el.style.color = n > 0 ? 'var(--amber)' : 'var(--dimmer)';
}

function renderDatasetList() {
  const el = document.getElementById('dataset-list');
  if (!state.datasets.length) {
    el.innerHTML = '<div class="panel-empty-hint">Load an example<br>or import a CSV to begin.</div>';
    return;
  }
  el.innerHTML = state.datasets.map(ds => {
    const off = ds.enabled === false;
    return `
    <div class="ds-item${ds.id === state.activeDatasetId ? ' active' : ''}${off ? ' ds-item-off' : ''}" data-dsid="${ds.id}">
      <span class="ds-swatch" style="background:${ds.color}"></span>
      <span class="ds-label" title="${ds.name}">${ds.name}</span>
      <span class="ds-count">${ds.x.length}pt</span>
      <button class="ds-toggle${off ? ' ds-off' : ''}" data-toggleid="${ds.id}" title="${off ? 'Enable dataset' : 'Disable dataset'}">${off ? '○' : '●'}</button>
      <button class="ds-delete" data-delid="${ds.id}" title="Remove dataset">×</button>
    </div>`;
  }).join('');
  el.querySelectorAll('.ds-item').forEach(item => {
    item.addEventListener('click', () => {
      state.activeDatasetId = parseInt(item.dataset.dsid);
      syncFitDatasetSelect();
      renderDatasetList();
      renderFitList();
    });
  });
  el.querySelectorAll('.ds-toggle').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const id = parseInt(btn.dataset.toggleid);
      const ds = state.datasets.find(d => d.id === id);
      if (!ds) return;
      ds.enabled = ds.enabled === false ? true : false;
      // If the active fit belongs to a dataset that just got disabled, deselect it
      if (ds.enabled === false) {
        const activeFit = state.fits.find(f => f.id === state.activeFitId);
        if (activeFit && activeFit.dsId === ds.id) {
          const fallback = state.fits.find(f => {
            const fds = state.datasets.find(d => d.id === f.dsId);
            return f.id !== state.activeFitId && fds && fds.enabled !== false;
          });
          state.activeFitId = fallback ? fallback.id : null;
        }
      }
      syncFitDatasetSelect();
      renderDatasetList();
      renderFitList();
      renderStatsTable();
      updatePlots();
    });
  });
  el.querySelectorAll('.ds-delete').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const id = parseInt(btn.dataset.delid);
      // Collect deleted fit IDs before removing them so annotations can be cleaned up
      const deletedFitIds = new Set(state.fits.filter(f => f.dsId === id).map(f => f.id));
      state.datasets = state.datasets.filter(d => d.id !== id);
      state.fits = state.fits.filter(f => f.dsId !== id);
      // Remove annotations that referenced any of the deleted fits
      if (deletedFitIds.size) state.annotations = state.annotations.filter(a => !deletedFitIds.has(a.fitId));
      if (state.selection.dsId === id) state.selection = { dsId: null, indices: new Set() };
      if (state.activeDatasetId === id) {
        state.activeDatasetId = state.datasets.length ? state.datasets[state.datasets.length - 1].id : null;
      }
      if (state.activeFitId && !state.fits.find(f => f.id === state.activeFitId)) {
        state.activeFitId = state.fits.length ? state.fits[state.fits.length - 1].id : null;
      }
      syncFitDatasetSelect();
      renderDatasetList();
      renderFitList();
      renderAnnList();
      updatePlots();
      const active = state.fits.find(f => f.id === state.activeFitId);
      if (active) renderStats(active); else setConsole('Dataset removed.', '');
    });
  });
  renderMaskCount();
}

function renderFitList() {
  const el = document.getElementById('fit-list');
  const cnt = document.getElementById('fit-count');
  cnt.textContent = state.fits.length;
  if (!state.fits.length) {
    el.innerHTML = '<div class="panel-empty-hint">Press <strong>▶ Fit</strong><br>after loading data.</div>';
    const corrEl = document.getElementById('corr-matrix-container');
    if (corrEl) corrEl.innerHTML = '';
    return;
  }
  el.innerHTML = state.fits.map(fit => {
    const ds = state.datasets.find(d => d.id === fit.dsId);
    const dsOff = ds && ds.enabled === false;
    return `
    <div class="fit-item${fit.id === state.activeFitId ? ' active' : ''}${dsOff ? ' fit-item-off' : ''}" data-fitid="${fit.id}">
      <span class="ds-swatch" style="background:${fit.color};opacity:${dsOff ? 0.3 : 1}"></span>
      <span class="ds-label">
        <span style="display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${fit.label}</span>
        <span class="fit-item-eq">${fit.model}${dsOff ? ' (dataset off)' : ''}</span>
      </span>
      <button class="ds-delete" data-delid="${fit.id}" title="Remove fit">×</button>
    </div>`;
  }).join('');
  el.querySelectorAll('.fit-item').forEach(item => {
    item.addEventListener('click', () => {
      const fitId = parseInt(item.dataset.fitid);
      const fit = state.fits.find(f => f.id === fitId);
      const ds = fit && state.datasets.find(d => d.id === fit.dsId);
      if (ds && ds.enabled === false) return; // block interaction with disabled-dataset fits
      state.activeFitId = fitId;
      renderFitList();
      if (fit) { renderParamResults(fit); renderStatsTable(); }
    });
  });
  el.querySelectorAll('.ds-delete').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const id = parseInt(btn.dataset.delid);
      state.fits = state.fits.filter(f => f.id !== id);
      // Remove annotations that referenced this fit (e.g. auto-peak annotations)
      state.annotations = state.annotations.filter(a => a.fitId !== id);
      if (state.activeFitId === id) {
        const enabledFit = state.fits.find(f => {
          const fds = state.datasets.find(d => d.id === f.dsId);
          return fds && fds.enabled !== false;
        });
        state.activeFitId = enabledFit ? enabledFit.id : (state.fits.length ? state.fits[state.fits.length - 1].id : null);
      }
      renderFitList();
      renderAnnList();
      updatePlots();
      const active = state.fits.find(f => f.id === state.activeFitId);
      if (active) renderStats(active); else setConsole('Fit removed.', '');
    });
  });
  syncFTestSelects();
}

function syncFTestSelects() {
  const selA = document.getElementById('ftest-fit-a');
  const selB = document.getElementById('ftest-fit-b');
  if (!selA || !selB) return;
  const fits = state.fits.filter(f => {
    const ds = state.datasets.find(d => d.id === f.dsId);
    return ds && ds.enabled !== false;
  });
  const empty = '<option value="">— no fits —</option>';
  const opts = fits.map(f => `<option value="${f.id}">${f.label || f.model}</option>`).join('');
  selA.innerHTML = opts || empty;
  selB.innerHTML = opts || empty;
  if (fits.length >= 2) {
    selA.value = fits[fits.length - 2].id;
    selB.value = fits[fits.length - 1].id;
  } else if (fits.length === 1) {
    selA.value = fits[0].id;
    selB.value = fits[0].id;
  }
  const res = document.getElementById('ftest-result');
  if (res) { res.style.display = 'none'; res.innerHTML = ''; }
}

function renderPredResult(result, mode) {
  const el = document.getElementById('pred-result');
  if (!el) return;
  if (mode === 'x2y') {
    const { y, lower, upper, hw } = result;
    const ciRow = hw != null
      ? `<tr><td>95% CI</td><td>[${fmt(lower)}, ${fmt(upper)}]</td></tr>
         <tr><td>± hw</td><td>${fmt(hw)}</td></tr>`
      : `<tr><td>95% CI</td><td>—</td></tr>`;
    el.innerHTML = `<table class="pred-table">
      <tr><td>Ŷ</td><td class="pred-val-hi">${fmt(y)}</td></tr>
      ${ciRow}
    </table>`;
  } else {
    if (!result.length) {
      el.innerHTML = `<div class="pred-note">No solution found in the fit curve range.</div>`;
    } else {
      const rows = result.map((r, i) =>
        `<tr><td>X${result.length > 1 ? (i + 1) : ''}</td><td class="pred-val-hi">${fmt(r.x)}</td></tr>` +
        (r.xCIHW != null ? `<tr><td>± CI</td><td>${fmt(r.xCIHW)}</td></tr>` : '')
      ).join('');
      el.innerHTML = `<table class="pred-table">${rows}</table>`;
      if (result.length > 1)
        el.innerHTML += `<div class="pred-note">${result.length} solutions found — verify on plot.</div>`;
    }
  }
  el.style.display = '';
}

function renderFTestResult(result) {
  const el = document.getElementById('ftest-result');
  if (!el) return;
  if (result.error) {
    el.innerHTML = `<div class="pred-note" style="color:var(--error,#e53e3e)">${result.error}</div>`;
    el.style.display = '';
    return;
  }
  const sig = result.pVal < 0.05;
  const pStr = result.pVal < 0.001 ? result.pVal.toExponential(2) : result.pVal.toFixed(4);
  el.innerHTML = `<table class="pred-table">
    <tr><td>F statistic</td><td class="pred-val-hi">${fmt(result.F)}</td></tr>
    <tr><td>df₁, df₂</td><td>${result.deltaP}, ${result.dof2}</td></tr>
    <tr><td>p-value</td><td class="${sig ? 'ftest-sig' : 'ftest-ns'}">${pStr}</td></tr>
    <tr><td>SSE (simple)</td><td>${fmt(result.sseSimple)}</td></tr>
    <tr><td>SSE (complex)</td><td>${fmt(result.sseComplex)}</td></tr>
  </table>
  <div class="pred-note">${sig
    ? `Significant (p&lt;0.05): <em>${result.complex.label || result.complex.model}</em> fits better.`
    : `Not significant (p≥0.05): extra parameters not justified.`}</div>`;
  el.style.display = '';
}

/* ═══════════════════════════════════════════════════════════
   ANNOTATION MANAGEMENT
═══════════════════════════════════════════════════════════ */
function renderAnnList() {
  const el = document.getElementById('ann-list');
  const cnt = document.getElementById('ann-count');
  if (!el) return;
  if (cnt) cnt.textContent = state.annotations.length;
  if (!state.annotations.length) {
    el.innerHTML = '<div class="panel-empty-hint" style="font-size:.72em">No annotations. Use + Add or Peaks.</div>';
    return;
  }
  const typeLabel = { hline: 'H—', vline: '|V', text: 'T', peak: '⌃' };
  el.innerHTML = state.annotations.map(ann => {
    const disp = ann.label || (ann.type === 'hline' ? `y = ${fmt(ann.y)}` : ann.type === 'vline' ? `x = ${fmt(ann.x)}` : `(${fmt(ann.x)}, ${fmt(ann.y)})`);
    return `<div class="ann-item${ann.visible ? '' : ' ann-disabled'}" data-annid="${ann.id}">
      <span class="ann-item-type" title="${ann.type}">${typeLabel[ann.type] || '?'}</span>
      <span class="ann-item-label" title="${disp}">${disp}</span>
      <button class="ann-item-btn" data-ann-toggle="${ann.id}" title="${ann.visible ? 'Hide' : 'Show'}">${ann.visible ? '●' : '○'}</button>
      <button class="ann-item-btn" data-ann-edit="${ann.id}" title="Edit">✎</button>
      <button class="ann-item-btn" data-ann-del="${ann.id}" title="Remove">×</button>
    </div>`;
  }).join('');
  el.querySelectorAll('[data-ann-toggle]').forEach(btn => {
    btn.addEventListener('click', () => {
      const ann = state.annotations.find(a => a.id === parseInt(btn.dataset.annToggle));
      if (ann) { ann.visible = !ann.visible; renderAnnList(); updatePlots(); }
    });
  });
  el.querySelectorAll('[data-ann-edit]').forEach(btn => {
    btn.addEventListener('click', () => openAnnEditor(parseInt(btn.dataset.annEdit)));
  });
  el.querySelectorAll('[data-ann-del]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.annotations = state.annotations.filter(a => a.id !== parseInt(btn.dataset.annDel));
      renderAnnList(); updatePlots();
    });
  });
}

let _editingAnnId = null;

function openAnnEditor(id) {
  const ann = id != null ? state.annotations.find(a => a.id === id) : createDefaultAnnotation('hline');
  if (!ann) return;
  _editingAnnId = id ?? null;
  document.getElementById('ann-modal-title').textContent = id != null ? 'Edit Annotation' : 'Add Annotation';

  const knownFamilies = ['DM Sans, sans-serif','DM Mono, monospace','Arial, sans-serif',
    'Helvetica, sans-serif','Times New Roman, serif','Georgia, serif',
    'Courier New, monospace','Verdana, sans-serif','Trebuchet MS, sans-serif'];

  document.getElementById('ann-type').value            = ann.type;
  document.getElementById('ann-x').value               = ann.x ?? 0;
  document.getElementById('ann-y').value               = ann.y ?? 0;
  document.getElementById('ann-label').value            = ann.label || '';
  const famSel = document.getElementById('ann-font-family');
  if (knownFamilies.includes(ann.fontFamily)) {
    famSel.value = ann.fontFamily;
    document.getElementById('ann-row-font-custom').style.display = 'none';
  } else {
    famSel.value = '__custom__';
    document.getElementById('ann-row-font-custom').style.display = '';
    document.getElementById('ann-font-custom').value = ann.fontFamily || '';
  }
  document.getElementById('ann-font-size').value        = ann.fontSize  ?? 12;
  document.getElementById('ann-font-bold').checked      = !!ann.fontBold;
  document.getElementById('ann-font-italic').checked    = !!ann.fontItalic;
  document.getElementById('ann-font-color').value       = ann.fontColor  || '#374151';
  document.getElementById('ann-font-color-hex').value   = ann.fontColor  || '#374151';
  document.getElementById('ann-anchor').value           = ann.labelAnchor  || 'left';
  document.getElementById('ann-vanchor').value          = ann.labelVAnchor || 'bottom';
  document.getElementById('ann-bg-color').value         = ann.bgColor  || '#ffffff';
  const bgOp = ann.bgOpacity ?? 0.85;
  document.getElementById('ann-bg-opacity').value       = bgOp;
  document.getElementById('ann-bg-opacity-val').textContent = bgOp.toFixed(2);
  document.getElementById('ann-border-color').value     = ann.borderColor || '#d4d9e8';
  document.getElementById('ann-border-show').checked    = !!ann.borderShow;
  document.getElementById('ann-line-style').value       = ann.lineDash   || 'dash';
  document.getElementById('ann-line-width').value       = ann.lineWidth  ?? 1.5;
  document.getElementById('ann-line-color').value       = ann.lineColor  || '#6b7280';
  document.getElementById('ann-line-color-hex').value   = ann.lineColor  || '#6b7280';
  const lineOp = ann.lineOpacity ?? 0.7;
  document.getElementById('ann-line-opacity').value     = lineOp;
  document.getElementById('ann-line-opacity-val').textContent = lineOp.toFixed(2);
  document.getElementById('ann-arrow-show').checked     = ann.showArrow !== false;
  document.getElementById('ann-arrow-opts').style.display = ann.showArrow !== false ? '' : 'none';
  document.getElementById('ann-arrow-head').value       = ann.arrowHead  ?? 2;
  document.getElementById('ann-arrow-size').value       = ann.arrowSize  ?? 1;
  document.getElementById('ann-arrow-width').value      = ann.arrowWidth ?? 1;
  document.getElementById('ann-arrow-color').value      = ann.arrowColor || '#374151';
  document.getElementById('ann-arrow-color-hex').value  = ann.arrowColor || '#374151';
  document.getElementById('ann-ax').value               = ann.ax ?? 0;
  document.getElementById('ann-ay').value               = ann.ay ?? -40;

  syncAnnModalSections();
  document.getElementById('ann-modal').style.display = 'flex';
}

function syncAnnModalSections() {
  const type = document.getElementById('ann-type').value;
  const isLine = type === 'hline' || type === 'vline';
  document.getElementById('ann-row-x').style.display = type === 'hline' ? 'none' : '';
  document.getElementById('ann-row-y').style.display = type === 'vline' ? 'none' : '';
  document.getElementById('ann-section-line').style.display = isLine ? '' : 'none';
  document.getElementById('ann-section-arrow').style.display = isLine ? 'none' : '';
}

function saveAnn() {
  const type = document.getElementById('ann-type').value;
  const famSel = document.getElementById('ann-font-family');
  const fontFamily = famSel.value === '__custom__'
    ? (document.getElementById('ann-font-custom').value.trim() || 'DM Sans, sans-serif')
    : famSel.value;
  const annData = {
    type,
    x: parseFloat(document.getElementById('ann-x').value) || 0,
    y: parseFloat(document.getElementById('ann-y').value) || 0,
    label: document.getElementById('ann-label').value || '',
    fontFamily,
    fontSize:    parseFloat(document.getElementById('ann-font-size').value)  || 12,
    fontBold:    document.getElementById('ann-font-bold').checked,
    fontItalic:  document.getElementById('ann-font-italic').checked,
    fontColor:   document.getElementById('ann-font-color').value,
    labelAnchor: document.getElementById('ann-anchor').value,
    labelVAnchor:document.getElementById('ann-vanchor').value,
    bgColor:     document.getElementById('ann-bg-color').value,
    bgOpacity:   parseFloat(document.getElementById('ann-bg-opacity').value),
    borderShow:  document.getElementById('ann-border-show').checked,
    borderColor: document.getElementById('ann-border-color').value,
    lineColor:   document.getElementById('ann-line-color').value,
    lineWidth:   parseFloat(document.getElementById('ann-line-width').value) || 1.5,
    lineDash:    document.getElementById('ann-line-style').value,
    lineOpacity: parseFloat(document.getElementById('ann-line-opacity').value),
    showArrow:   document.getElementById('ann-arrow-show').checked,
    arrowHead:   parseInt(document.getElementById('ann-arrow-head').value),
    arrowSize:   parseFloat(document.getElementById('ann-arrow-size').value) || 1,
    arrowWidth:  parseFloat(document.getElementById('ann-arrow-width').value) || 1,
    arrowColor:  document.getElementById('ann-arrow-color').value,
    ax: parseFloat(document.getElementById('ann-ax').value) || 0,
    ay: parseFloat(document.getElementById('ann-ay').value) || -40,
  };
  if (_editingAnnId != null) {
    const idx = state.annotations.findIndex(a => a.id === _editingAnnId);
    if (idx !== -1) state.annotations[idx] = Object.assign({}, state.annotations[idx], annData);
  } else {
    state.annotations.push(Object.assign(createDefaultAnnotation(type), annData, { id: nextAnnId(), visible: true }));
  }
  document.getElementById('ann-modal').style.display = 'none';
  renderAnnList();
  updatePlots();
}

function autoAnnotatePeaks() {
  const peakParams = new Set(['μ', 'mu', 'x₀', 'x0', 'xc', 'center', 'centre', 'peak']);
  const visible = state.fits.filter(f => {
    if (!f.result || !f.visible) return false;
    const ds = state.datasets.find(d => d.id === f.dsId);
    return !ds || ds.enabled !== false;
  });
  if (!visible.length) { setConsole('No active fits to annotate.', 'warn'); return; }
  let added = 0;
  for (const fit of visible) {
    const idx = fit.paramNames.findIndex(n => peakParams.has(n.toLowerCase ? n.toLowerCase() : n));
    if (idx === -1) continue;
    if (state.annotations.some(a => a.fitId === fit.id)) continue;
    const peakX = fit.result.params[idx];
    const peakY = fitEval(fit, peakX);
    if (!isFinite(peakX) || !isFinite(peakY)) continue;
    const ann = createDefaultAnnotation('peak');
    ann.x = peakX; ann.y = peakY;
    ann.label = fit.label || fit.model;
    ann.fontColor = fit.color; ann.arrowColor = fit.color;
    ann.fitId = fit.id;
    state.annotations.push(ann);
    added++;
  }
  if (added) { renderAnnList(); updatePlots(); setConsole(`Added ${added} peak annotation${added > 1 ? 's' : ''}.`, ''); }
  else setConsole('No new peak centres found — Gaussian / Lorentzian fits needed, or already annotated.', 'warn');
}

/* ═══════════════════════════════════════════════════════════
   GRAPH STYLE EDITOR
═══════════════════════════════════════════════════════════ */
function openGraphStyleEditor() {
  const gs = state.graphStyle;
  const tc = themeColors();
  const modal = document.getElementById('gs-modal');

  // Font
  const knownFamilies = ['DM Mono, monospace','DM Sans, sans-serif','Arial, sans-serif',
    'Helvetica, sans-serif','Times New Roman, serif','Georgia, serif',
    'Courier New, monospace','Verdana, sans-serif','Trebuchet MS, sans-serif'];
  const famSel = document.getElementById('gs-font-family');
  if (!gs.fontFamily || knownFamilies.includes(gs.fontFamily)) {
    famSel.value = gs.fontFamily || '';
    document.getElementById('gs-row-font-custom').style.display = 'none';
  } else {
    famSel.value = '__custom__';
    document.getElementById('gs-font-custom').value = gs.fontFamily;
    document.getElementById('gs-row-font-custom').style.display = '';
  }
  document.getElementById('gs-font-size').value   = gs.fontSize || '';
  _gsSetColorField('gs-font-color', 'gs-font-color-hex', gs.fontColor, tc.textCol);

  // Background
  _gsSetColorField('gs-plot-bg',    'gs-plot-bg-hex',    gs.plotBgColor,   tc.plotBg);
  _gsSetColorField('gs-paper-bg',   'gs-paper-bg-hex',   gs.paperBgColor,  tc.paperBg);

  // Grid X
  document.getElementById('gs-grid-x-show').checked  = gs.showGridX !== false;
  _gsSetColorField('gs-grid-x-color', 'gs-grid-x-color-hex', gs.gridXColor, tc.gridCol);
  document.getElementById('gs-grid-x-width').value = gs.gridXWidth || 1;
  document.getElementById('gs-grid-x-dash').value  = gs.gridXDash  || 'solid';
  // Grid Y
  document.getElementById('gs-grid-y-show').checked  = gs.showGridY !== false;
  _gsSetColorField('gs-grid-y-color', 'gs-grid-y-color-hex', gs.gridYColor, tc.gridCol);
  document.getElementById('gs-grid-y-width').value = gs.gridYWidth || 1;
  document.getElementById('gs-grid-y-dash').value  = gs.gridYDash  || 'solid';

  // Zero lines
  document.getElementById('gs-zeroline-x-show').checked = gs.showZeroLineX !== false;
  _gsSetColorField('gs-zeroline-x-color', 'gs-zeroline-x-color-hex', gs.zeroLineXColor, tc.zeroLine);
  document.getElementById('gs-zeroline-x-width').value = gs.zeroLineXWidth || 1;
  document.getElementById('gs-zeroline-y-show').checked = gs.showZeroLineY !== false;
  _gsSetColorField('gs-zeroline-y-color', 'gs-zeroline-y-color-hex', gs.zeroLineYColor, tc.zeroLine);
  document.getElementById('gs-zeroline-y-width').value = gs.zeroLineYWidth || 1;

  // Axes & Ticks
  document.getElementById('gs-tick-size').value       = gs.tickFontSize || '';
  document.getElementById('gs-show-ticks-x').checked  = gs.showTicksX !== false;
  document.getElementById('gs-show-ticks-y').checked  = gs.showTicksY !== false;
  document.getElementById('gs-axis-line-x').checked   = !!gs.showAxisLineX;
  document.getElementById('gs-axis-line-y').checked   = !!gs.showAxisLineY;
  _gsSetColorField('gs-axis-line-color', 'gs-axis-line-color-hex', gs.axisLineColor, tc.gridCol);

  // Legend
  document.getElementById('gs-legend-font-size').value = gs.legendFontSize || '';
  _gsSetColorField('gs-legend-bg',     'gs-legend-bg-hex',     gs.legendBgColor,     isDark() ? '#0a1628' : '#ffffff');
  _gsSetColorField('gs-legend-border', 'gs-legend-border-hex', gs.legendBorderColor, tc.gridCol);

  // Scale & Axis Range
  document.getElementById('gs-log-x').checked  = !!state.plotConfig.logX;
  document.getElementById('gs-log-y').checked  = !!state.plotConfig.logY;
  document.getElementById('gs-xmin').value     = gs.xMin   || '';
  document.getElementById('gs-xmax').value     = gs.xMax   || '';
  document.getElementById('gs-ymin').value     = gs.yMin   || '';
  document.getElementById('gs-ymax').value     = gs.yMax   || '';
  document.getElementById('gs-x-dtick').value  = gs.xDtick || '';
  document.getElementById('gs-y-dtick').value  = gs.yDtick || '';

  modal.style.display = 'flex';
}

function _gsSetColorField(pickId, hexId, override, themeDefault) {
  const pick = document.getElementById(pickId);
  const hex  = document.getElementById(hexId);
  if (!pick || !hex) return;
  if (override && override !== '') {
    pick.value = override;
    hex.value  = override;
  } else {
    hex.value  = '';
    // Show the current theme default in the picker so user can see what they're overriding
    pick.value = /^#[0-9a-fA-F]{6}$/.test(themeDefault) ? themeDefault : '#888888';
  }
}

function saveGraphStyle() {
  const gs = state.graphStyle;
  const famSel = document.getElementById('gs-font-family');
  if (famSel.value === '__custom__') {
    gs.fontFamily = document.getElementById('gs-font-custom').value.trim() || '';
  } else {
    gs.fontFamily = famSel.value;  // '' or a known family
  }
  gs.fontSize       = document.getElementById('gs-font-size').value.trim();
  gs.fontColor      = document.getElementById('gs-font-color-hex').value.trim();
  gs.plotBgColor    = document.getElementById('gs-plot-bg-hex').value.trim();
  gs.paperBgColor   = document.getElementById('gs-paper-bg-hex').value.trim();

  gs.showGridX      = document.getElementById('gs-grid-x-show').checked;
  gs.gridXColor     = document.getElementById('gs-grid-x-color-hex').value.trim();
  gs.gridXWidth     = parseFloat(document.getElementById('gs-grid-x-width').value) || 1;
  gs.gridXDash      = document.getElementById('gs-grid-x-dash').value;
  gs.showGridY      = document.getElementById('gs-grid-y-show').checked;
  gs.gridYColor     = document.getElementById('gs-grid-y-color-hex').value.trim();
  gs.gridYWidth     = parseFloat(document.getElementById('gs-grid-y-width').value) || 1;
  gs.gridYDash      = document.getElementById('gs-grid-y-dash').value;

  gs.showZeroLineX  = document.getElementById('gs-zeroline-x-show').checked;
  gs.zeroLineXColor = document.getElementById('gs-zeroline-x-color-hex').value.trim();
  gs.zeroLineXWidth = parseFloat(document.getElementById('gs-zeroline-x-width').value) || 1;
  gs.showZeroLineY  = document.getElementById('gs-zeroline-y-show').checked;
  gs.zeroLineYColor = document.getElementById('gs-zeroline-y-color-hex').value.trim();
  gs.zeroLineYWidth = parseFloat(document.getElementById('gs-zeroline-y-width').value) || 1;

  gs.tickFontSize   = document.getElementById('gs-tick-size').value.trim();
  gs.showTicksX     = document.getElementById('gs-show-ticks-x').checked;
  gs.showTicksY     = document.getElementById('gs-show-ticks-y').checked;
  gs.showAxisLineX  = document.getElementById('gs-axis-line-x').checked;
  gs.showAxisLineY  = document.getElementById('gs-axis-line-y').checked;
  gs.axisLineColor  = document.getElementById('gs-axis-line-color-hex').value.trim();

  gs.legendFontSize    = document.getElementById('gs-legend-font-size').value.trim();
  gs.legendBgColor     = document.getElementById('gs-legend-bg-hex').value.trim();
  gs.legendBorderColor = document.getElementById('gs-legend-border-hex').value.trim();

  // Scale & Axis Range
  state.plotConfig.logX = document.getElementById('gs-log-x').checked;
  state.plotConfig.logY = document.getElementById('gs-log-y').checked;
  gs.xMin   = document.getElementById('gs-xmin').value.trim();
  gs.xMax   = document.getElementById('gs-xmax').value.trim();
  gs.yMin   = document.getElementById('gs-ymin').value.trim();
  gs.yMax   = document.getElementById('gs-ymax').value.trim();
  gs.xDtick = document.getElementById('gs-x-dtick').value.trim();
  gs.yDtick = document.getElementById('gs-y-dtick').value.trim();

  document.getElementById('gs-modal').style.display = 'none';
  updatePlots();
  setConsole('Graph style updated.', '');
}

function sweepRange(row) {
  const lo = row.min > -1e9 ? row.min : -Infinity;
  const hi = row.max <  1e9 ? row.max :  Infinity;
  const init = row.init;
  let rMin, rMax;
  if (isFinite(lo) && isFinite(hi)) {
    rMin = lo; rMax = hi;
  } else {
    const span = Math.abs(init) > 1e-10 ? 4 * Math.abs(init) : 20;
    rMin = init - span / 2;
    rMax = init + span / 2;
    if (isFinite(lo)) rMin = Math.max(rMin, lo);
    if (isFinite(hi)) rMax = Math.min(rMax, hi);
  }
  if (rMin >= rMax) { rMin = init - 10; rMax = init + 10; }
  return { rMin, rMax };
}

function renderParamTable() {
  const model = state.fitConfig.model;
  const m = MODELS[model];
  const container = document.getElementById('param-table-container');
  state.sweepParams = null;

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

  container.innerHTML = `
    <div class="param-row param-row-header">
      <span class="param-name"></span>
      <span class="param-col-hdr">Init</span>
      <span class="param-col-hdr">Min</span>
      <span class="param-col-hdr">Max</span>
      <span class="param-col-hdr">Fit</span>
    </div>` + state.paramRows.map((row, i) => `
    <div class="param-row" data-pi="${i}">
      <span class="param-name">${row.name}</span>
      <input class="param-input" data-field="init" type="number" value="${fmt(row.init)}" step="any" title="Initial value">
      <input class="param-input param-bound" data-field="min"  type="number" value="${row.min <= -1e9 ? '' : fmt(row.min)}" step="any" placeholder="-∞" title="Lower bound (leave blank for -∞)">
      <input class="param-input param-bound" data-field="max"  type="number" value="${row.max >= 1e9 ? '' : fmt(row.max)}" step="any" placeholder="+∞" title="Upper bound (leave blank for +∞)">
      <span class="param-fit-val" title="">—</span>
    </div>
    <div class="param-sweep-row" data-si="${i}">
      <span style="font-size:.62em;color:var(--dimmer);font-family:var(--mono)">sweep</span>
      <input type="range" class="param-sweep-range" data-si="${i}" step="any">
      <span class="param-sweep-val">—</span>
    </div>`).join('');

  container.querySelectorAll('.param-row:not(.param-row-header)').forEach(row => {
    const i = parseInt(row.dataset.pi);
    row.querySelectorAll('.param-input').forEach(inp => {
      inp.addEventListener('change', () => {
        const v = parseFloat(inp.value);
        if (isFinite(v)) {
          state.paramRows[i][inp.dataset.field] = v;
          // Recalibrate sweep range if init changed
          if (inp.dataset.field === 'init') {
            const sld = container.querySelector(`.param-sweep-range[data-si="${i}"]`);
            if (sld) { const { rMin, rMax } = sweepRange(state.paramRows[i]); sld.min = rMin; sld.max = rMax; sld.step = (rMax - rMin) / 200; sld.value = v; }
          }
        } else if (inp.dataset.field === 'min') state.paramRows[i].min = -1e10;
        else if (inp.dataset.field === 'max') state.paramRows[i].max = 1e10;
      });
    });
  });

  // Set up sweep sliders
  container.querySelectorAll('.param-sweep-row').forEach(sweepRow => {
    const si = parseInt(sweepRow.dataset.si);
    const row = state.paramRows[si];
    if (!row) return;
    const slider  = sweepRow.querySelector('.param-sweep-range');
    const valSpan = sweepRow.querySelector('.param-sweep-val');
    const { rMin, rMax } = sweepRange(row);
    slider.min = rMin; slider.max = rMax;
    slider.step = (rMax - rMin) / 200;
    slider.value = row.init;
    valSpan.textContent = fmt(row.init);

    slider.addEventListener('input', () => {
      const v = parseFloat(slider.value);
      valSpan.textContent = fmt(v);
      const initInp = container.querySelector(`.param-row[data-pi="${si}"] [data-field="init"]`);
      if (initInp) initInp.value = fmt(v);
      state.paramRows[si].init = v;
      state.sweepParams = state.paramRows.map((r, j) => {
        const sld = container.querySelector(`.param-sweep-range[data-si="${j}"]`);
        return sld ? parseFloat(sld.value) : r.init;
      });
      updateSweepPreview();
    });

    slider.addEventListener('change', () => {
      state.sweepParams = null;
      updatePlots();
    });
  });
}

function updateSweepPreview() {
  const tc      = themeColors();
  const xlabel  = document.getElementById('plot-xlabel').value || 'x';
  const ylabel  = document.getElementById('plot-ylabel').value || 'y';
  const title   = document.getElementById('plot-title').value  || '';
  const mainTraces = buildMainTraces();
  const mainLayout = baseLayout({
    title: title ? { text: title, font: { size: 13, color: tc.textCol }, x: 0.5 } : undefined,
    xaxis: Object.assign(baseLayout().xaxis, { title: { text: xlabel, font: { size: 11, color: tc.tickCol } } }),
    yaxis: Object.assign(baseLayout().yaxis, { title: { text: ylabel, font: { size: 11, color: tc.tickCol } } }),
    margin: { l: 56, r: 20, t: title ? 36 : 18, b: 44 },
  });
  const _annData = buildPlotlyAnnotations();
  if (_annData.shapes.length) mainLayout.shapes = _annData.shapes;
  if (_annData.annotations.length) mainLayout.annotations = _annData.annotations;
  if (plotsInitialised) Plotly.react(document.getElementById('main-plot'), mainTraces, mainLayout);
}

function renderParamResults(fit) {
  if (!fit || !fit.result) return;
  const container = document.getElementById('param-table-container');
  const rows = container.querySelectorAll('.param-row:not(.param-row-header)');
  const { params, paramErrors } = fit.result;
  rows.forEach((row, i) => {
    if (params[i] == null) return;
    const val = params[i];
    const err = paramErrors && paramErrors[i];
    const initInp = row.querySelector('[data-field="init"]');
    if (initInp) {
      initInp.value = fmt(val);
      if (i < state.paramRows.length) state.paramRows[i].init = val;
    }
    const fitSpan = row.querySelector('.param-fit-val');
    if (fitSpan) {
      fitSpan.textContent = fmt(val);
      fitSpan.title = err && isFinite(err) ? `${fit.paramNames[i]} = ${fmt(val)} ± ${fmt(err)}` : `${fit.paramNames[i]} = ${fmt(val)}`;
    }
    // Recalibrate sweep slider to new value
    const slider = container.querySelector(`.param-sweep-range[data-si="${i}"]`);
    const valSpan = container.querySelector(`.param-sweep-row[data-si="${i}"] .param-sweep-val`);
    if (slider && i < state.paramRows.length) {
      const { rMin, rMax } = sweepRange(state.paramRows[i]);
      slider.min = rMin; slider.max = rMax;
      slider.step = (rMax - rMin) / 200;
      slider.value = val;
      if (valSpan) valSpan.textContent = fmt(val);
    }
  });
  renderCorrMatrix(fit);
}

function renderCorrMatrix(fit) {
  const el = document.getElementById('corr-matrix-container');
  if (!el) return;
  const { covMatrix, params } = fit.result || {};
  const names = fit.paramNames || [];
  if (!covMatrix || names.length < 2) { el.innerHTML = ''; return; }
  const m = names.length;
  const corr = Array.from({ length: m }, (_, i) =>
    Array.from({ length: m }, (_, j) => {
      const denom = Math.sqrt(Math.abs(covMatrix[i][i] * covMatrix[j][j]));
      return denom < 1e-20 ? (i === j ? 1 : 0) : covMatrix[i][j] / denom;
    })
  );
  function corrColor(v) {
    const c = Math.max(-1, Math.min(1, v));
    if (c >= 0) {
      const t = c;
      const r = Math.round(255 - t * (255 - 29)), g = Math.round(255 - t * (255 - 78)), b = Math.round(255 - t * (255 - 216));
      return `rgb(${r},${g},${b})`;
    } else {
      const t = -c;
      const r = Math.round(255 - t * (255 - 220)), g = Math.round(255 - t * (255 - 38)), b = Math.round(255 - t * (255 - 38));
      return `rgb(${r},${g},${b})`;
    }
  }
  const isDk = document.body.classList.contains('dark-mode');
  const header = `<tr><th></th>${names.map(n => `<th title="${n}">${n.length > 4 ? n.slice(0,4) : n}</th>`).join('')}</tr>`;
  const bodyRows = corr.map((row, i) =>
    `<tr><td>${names[i].length > 4 ? names[i].slice(0,4) : names[i]}</td>` +
    row.map((v, j) => {
      const bg = corrColor(v);
      const txtClr = Math.abs(v) > 0.55 ? '#fff' : (isDk ? '#e2e8f0' : '#1a202c');
      return `<td style="background:${bg};color:${txtClr}" title="${names[i]}↔${names[j]}: ${v.toFixed(3)}">${v.toFixed(2)}</td>`;
    }).join('') + '</tr>'
  ).join('');
  el.innerHTML = `<div class="corr-matrix-label">Parameter Correlations</div><table class="corr-matrix"><thead>${header}</thead><tbody>${bodyRows}</tbody></table>`;
}

let _consoleMsg = { text: '', type: '', timer: null };

function setConsole(msg, type) {
  if (_consoleMsg.timer) clearTimeout(_consoleMsg.timer);
  _consoleMsg.text = msg;
  _consoleMsg.type = type;
  if (type !== 'error') {
    _consoleMsg.timer = setTimeout(() => {
      _consoleMsg.text = '';
      _consoleMsg.timer = null;
      renderStatsTable();
    }, 5000);
  } else {
    _consoleMsg.timer = null;
  }
  renderStatsTable();
}

function renderStats(fit) {
  renderStatsTable();
}

function renderStatsTable() {
  const el = document.getElementById('app-console');
  if (!el) return;

  let msgHtml = '';
  if (_consoleMsg.text) {
    const cls = _consoleMsg.type === 'error' ? 'console-status-err' : _consoleMsg.type === 'warn' ? 'console-status-warn' : 'console-hint';
    msgHtml = `<div class="stats-msg-row"><span class="${cls}">${_consoleMsg.text}</span></div>`;
  }

  if (!state.fits.length) {
    el.innerHTML = msgHtml || '<span class="console-hint">Load a dataset and press <strong>▶ Fit</strong> to begin.</span>';
    return;
  }

  const visibleFits = state.fits.filter(fit => {
    const ds = state.datasets.find(d => d.id === fit.dsId);
    return ds && ds.enabled !== false;
  });
  if (!visibleFits.length) {
    el.innerHTML = msgHtml || '<span class="console-hint">All datasets are disabled — enable a dataset to see fit statistics.</span>';
    return;
  }

  const rows = visibleFits.map(fit => {
    const r = fit.result;
    const isActive = fit.id === state.activeFitId;
    const ds = state.datasets.find(d => d.id === fit.dsId);
    const dsName = ds ? ds.name : '—';
    const lambdaTip  = r?.finalLambda != null ? ` λ=${r.finalLambda.toExponential(2)}` : '';
    const gradTip    = r?.gradNorm    != null ? ` |∇|=${r.gradNorm.toExponential(2)}`   : '';
    const diagTip    = lambdaTip + gradTip;
    const statusText = !r ? '—' : r.converged ? `✓ ${r.iter}` : `⚠ ${r.iter}`;
    const statusCls  = !r ? '' : r.converged ? 'stat-status-ok' : 'stat-status-warn';
    const label = (fit.label || fit.model).replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return `<tr class="stats-row${isActive ? ' active' : ''}" data-fit-id="${fit.id}">
      <td><span class="stats-color-dot" style="background:${fit.color}"></span></td>
      <td title="${label}">${label}</td>
      <td title="${dsName}">${dsName}</td>
      <td>${r ? fmt(r.rSq, 5) : '—'}</td>
      <td>${r ? fmt(r.adjRSq, 5) : '—'}</td>
      <td>${r ? fmt(r.rmse) : '—'}</td>
      <td>${r ? fmt(r.sse) : '—'}</td>
      <td>${r?.chiSqRed != null ? fmt(r.chiSqRed) : '—'}</td>
      <td>${r ? fmt(r.aic) : '—'}</td>
      <td>${r ? fmt(r.bic) : '—'}</td>
      <td>${r ? r.n : '—'}</td>
      <td class="${statusCls}" title="${diagTip.trim()}">${statusText}${diagTip ? ' ⓘ' : ''}</td>
    </tr>`;
  }).join('');

  el.innerHTML = msgHtml + `<div class="stats-table-wrap"><table class="stats-table">
    <thead><tr>
      <th></th><th>Fit</th><th>Dataset</th>
      <th>R²</th><th>Adj-R²</th><th>RMSE</th><th>SSE</th><th title="Reduced chi-square (σ-weighted fits only)">χ²ᵣ</th><th>AIC</th><th>BIC</th><th>N</th><th>Status</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table></div>`;

  el.querySelectorAll('.stats-row').forEach(tr => {
    tr.addEventListener('click', () => {
      const id = parseInt(tr.dataset.fitId);
      const fit = state.fits.find(f => f.id === id);
      if (!fit) return;
      state.activeFitId = id;
      renderParamResults(fit);
      renderFitList();
      renderStatsTable();
    });
  });
}

function syncFitDatasetSelect() {
  const sel = document.getElementById('fit-dataset-select');
  const cur = sel.value;
  const fittable = state.datasets.filter(d => d.enabled !== false);
  sel.innerHTML = fittable.length
    ? fittable.map(ds => `<option value="${ds.id}">${ds.name}</option>`).join('')
    : '<option value="">— no enabled dataset —</option>';
  const activeEnabled = fittable.find(d => d.id === state.activeDatasetId);
  if (activeEnabled) sel.value = state.activeDatasetId;
  else if (cur) sel.value = cur;
  syncWeightOptions();
}

function syncWeightOptions() {
  const dsId  = parseInt(document.getElementById('fit-dataset-select')?.value);
  const ds    = state.datasets.find(d => d.id === dsId);
  const wSel  = document.getElementById('opt-weights');
  const sigOpt = wSel?.querySelector('option[value="sigma"]');
  if (!sigOpt) return;
  if (ds?.sigY) {
    sigOpt.disabled = false;
    sigOpt.textContent = '1/σ² (data σ)';
  } else {
    sigOpt.disabled = true;
    sigOpt.textContent = '1/σ² (no σ data)';
    if (wSel.value === 'sigma') wSel.value = 'none';
  }
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
   MULTI-START WRAPPER
   Runs nStarts pilot fits from randomly perturbed starting
   points, then polishes the best with full iterations.
═══════════════════════════════════════════════════════════ */
function multiStartFit(solve, modelFn, xArr, yArr, p0, opts, nStarts) {
  const pilotOpts = { ...opts, maxIter: Math.max(150, Math.ceil(opts.maxIter / 4)) };

  function quickSSE(params) {
    let s = 0;
    for (let i = 0; i < xArr.length; i++) {
      const v = modelFn(xArr[i], params);
      if (isFinite(v)) s += (yArr[i] - v) ** 2;
    }
    return isFinite(s) ? s : Infinity;
  }

  // Run pilot from user's p0 first
  let best = solve(modelFn, xArr, yArr, p0, pilotOpts);

  // Perturbed pilots
  for (let s = 1; s < nStarts; s++) {
    const pPerturb = p0.map((v, i) => {
      const row = state.paramRows[i];
      // Log-scale perturbation: multiply by 10^U(-1,1)
      let pv = Math.abs(v) > 1e-10
        ? v * Math.pow(10, (Math.random() * 2 - 1))
        : (Math.random() * 2 - 1) * 2;
      if (row) {
        if (row.min > -1e9) pv = Math.max(pv, row.min);
        if (row.max <  1e9) pv = Math.min(pv, row.max);
      }
      return isFinite(pv) ? pv : v;
    });
    const r = solve(modelFn, xArr, yArr, pPerturb, pilotOpts);
    if (r.sse < best.sse) best = r;
  }

  // Full polish from best pilot
  const polished = solve(modelFn, xArr, yArr, best.params, opts);
  return polished.sse <= best.sse ? polished : best;
}

/* ═══════════════════════════════════════════════════════════
   FIT ENGINE — INPUT VALIDATION
═══════════════════════════════════════════════════════════ */
function validateFitInput(xArr, yArr, model, p0) {
  if (xArr.length < 3) return 'Need at least 3 non-masked points to fit.';
  if (xArr.some(v => !isFinite(v)) || yArr.some(v => !isFinite(v))) return 'Data contains non-finite values (NaN or Infinity).';
  const yMean = yArr.reduce((s, v) => s + v, 0) / yArr.length;
  const yVar  = yArr.reduce((s, v) => s + (v - yMean) ** 2, 0);
  if (yVar === 0) return 'Y values are all identical — no variation to fit.';
  const m = MODELS[model];
  if (m && m.fn && p0) {
    let anyFinite = false;
    for (let i = 0; i < Math.min(xArr.length, 5); i++) {
      const v = m.fn(xArr[i], p0);
      if (isFinite(v)) { anyFinite = true; break; }
    }
    if (!anyFinite) return 'Model returns non-finite values at initial parameters — try Auto Init or adjust manually.';
  }
  return null;
}

/* ═══════════════════════════════════════════════════════════
   FIT ENGINE — DISPATCH
═══════════════════════════════════════════════════════════ */
function setResidualDim(dim) {
  document.getElementById('residual-tab-bar')?.classList.toggle('resid-dim', dim);
  document.getElementById('residual-plot')?.classList.toggle('resid-dim', dim);
}

function syncResidualDimState() {
  const fit = state.fits.find(f => f.id === state.activeFitId);
  const ds  = fit ? state.datasets.find(d => d.id === fit.dsId) : null;
  setResidualDim(ds ? ds.enabled === false : false);
}

function setFitting(active) {
  const btnFit    = document.getElementById('btn-fit');
  const btnCancel = document.getElementById('btn-cancel-fit');
  if (btnFit)    btnFit.disabled = active;
  if (btnCancel) btnCancel.style.display = active ? '' : 'none';
  if (active) setResidualDim(true);
  else syncResidualDimState();
}

function runFit() {
  const model = state.fitConfig.model;
  const dsId  = parseInt(document.getElementById('fit-dataset-select').value);
  const ds    = state.datasets.find(d => d.id === dsId);
  if (!ds) { setConsole('No dataset selected. Load data first.', 'error'); return; }

  const maxIter    = parseInt(document.getElementById('opt-max-iter').value) || 20;
  const tol        = parseFloat(document.getElementById('opt-tol').value)    || 1e-8;
  const curvePts   = parseInt(document.getElementById('opt-curve-pts').value) || 300;
  const algoKey    = document.getElementById('opt-algo').value;
  const nStarts    = parseInt(document.getElementById('opt-n-starts').value)  || 1;
  const weightMode = document.getElementById('opt-weights').value;

  // Filter excluded points
  const excluded = ds.excludedIndices || new Set();
  const xArr = ds.x.filter((_, i) => !excluded.has(i));
  const yArr = ds.y.filter((_, i) => !excluded.has(i));

  // Compute weights
  let weights = null;
  if (weightMode === '1/y2') {
    weights = yArr.map(y => 1 / Math.max(y * y, 1e-20));
  } else if (weightMode === '1/y') {
    weights = yArr.map(y => 1 / Math.max(Math.abs(y), 1e-10));
  } else if (weightMode === 'sigma') {
    if (!ds.sigY) {
      setConsole('No σ data on this dataset — fitting unweighted.', 'warn');
    } else {
      const sigArr = ds.sigY.filter((_, i) => !excluded.has(i));
      weights = sigArr.map(s => (isFinite(s) && s > 0) ? 1 / (s * s) : 1e-40);
    }
  }
  state.sweepParams = null;

  const m = MODELS[model];

  // Polynomials: analytic solve in main thread (instant, no worker needed)
  if (m && m.analytic) {
    const errMsg = validateFitInput(xArr, yArr, model, null);
    if (errMsg) { setConsole(errMsg, 'error'); return; }
    const degree   = m.degree;
    const result   = fitPolynomialAnalytic(degree, xArr, yArr);
    const modelFn  = (x, p) => p.reduce((s, c, j) => s + c * Math.pow(x, degree - j), 0);
    const paramNames = m.params;
    _finaliseFitRecord({ result, modelFn, paramNames, model, algoKey, dsId, ds, excluded, weightMode, nStarts, curvePts, sseHistory: null });
    return;
  }

  // For custom equation, validate compiled state upfront
  let customExpr = null, paramNames = null, p0 = null;
  if (model === 'Custom') {
    if (!customCompiled) { setConsole('Parse the custom equation first.', 'error'); return; }
    paramNames = state.fitConfig.customParams;
    if (!paramNames.length) { setConsole('No free parameters in custom equation.', 'error'); return; }
    customExpr = state.fitConfig.customExpr;
    p0 = state.paramRows.length === paramNames.length ? state.paramRows.map(r => r.init) : paramNames.map(() => 1);
  } else if (m && m.fn) {
    paramNames = m.params;
    p0 = state.paramRows.length === paramNames.length ? state.paramRows.map(r => r.init) : m.autoInit(xArr, yArr);
  } else {
    setConsole('Unknown model.', 'error'); return;
  }

  // Validate and apply parameter bounds
  for (let i = 0; i < state.paramRows.length; i++) {
    const row = state.paramRows[i];
    if (row.min > -1e9 && row.max < 1e9 && row.min > row.max) {
      setConsole(`Bound error: min > max for parameter "${row.name}".`, 'error'); return;
    }
    if (row.min > -1e9 && p0[i] < row.min) p0[i] = row.min;
    if (row.max < 1e9  && p0[i] > row.max) p0[i] = row.max;
  }

  const errMsg = validateFitInput(xArr, yArr, model, p0);
  if (errMsg) { setConsole(errMsg, 'error'); return; }

  // Cancel any running worker
  if (state.currentWorker) { state.currentWorker.terminate(); state.currentWorker = null; }

  const jobId = nextId();
  let worker;
  try {
    worker = new Worker('fitting-worker.js');
  } catch (e) {
    // Web Workers may be blocked (e.g. file:// protocol) — fall back to synchronous fit
    _runFitSync({ model, dsId, ds, excluded, xArr, yArr, weights, algoKey, nStarts, maxIter, tol, curvePts, weightMode, paramNames, p0, paramRows: state.paramRows.map(r => ({ init: r.init, min: r.min, max: r.max })) });
    return;
  }

  state.currentWorker = worker;
  setFitting(true);
  setConsole('Fitting… (0 iter)', '');

  worker.onmessage = (e) => {
    const msg = e.data;
    if (msg.jobId !== jobId) return;

    if (msg.type === 'progress') {
      setConsole(`Fitting… (${msg.iter} iter, SSE=${msg.sse.toExponential(3)})`, '');
      return;
    }

    if (msg.type === 'error') {
      state.currentWorker = null;
      setFitting(false);
      setConsole('Fit error: ' + msg.message, 'error');
      return;
    }

    if (msg.type === 'result') {
      state.currentWorker = null;
      setFitting(false);
      worker.terminate();

      const result   = msg.result;
      const sseHistory = msg.sseHistory || null;
      const modelFn  = model === 'Custom'
        ? ((compiled => (x, params) => {
            const scope = { x };
            paramNames.forEach((name, i) => { scope[name] = params[i]; });
            const v = compiled.evaluate(scope);
            return isFinite(v) ? v : NaN;
          })(customCompiled))
        : m.fn;

      _finaliseFitRecord({ result, modelFn, paramNames, model, algoKey, dsId, ds, excluded, weightMode, nStarts, curvePts, sseHistory });
    }
  };

  worker.onerror = (e) => {
    state.currentWorker = null;
    setFitting(false);
    setConsole('Worker error: ' + (e.message || 'unknown'), 'error');
  };

  const paramRows = state.paramRows.map(r => ({ init: r.init, min: r.min, max: r.max }));
  worker.postMessage({
    jobId, modelKey: model, customExpr, paramNames, p0, x: xArr, y: yArr,
    opts: { algo: algoKey, maxIter, tol, weights, nStarts, paramRows },
  });
}

function _runFitSync({ model, dsId, ds, excluded, xArr, yArr, weights, algoKey, nStarts, maxIter, tol, curvePts, weightMode, paramNames, p0, paramRows }) {
  const SOLVERS = { lm: levenbergMarquardt, gn: gaussNewton, nm: nelderMead, bfgs };
  const solve = SOLVERS[algoKey] || levenbergMarquardt;
  const opts  = { maxIter, tol, weights, paramRows };
  const m = MODELS[model];
  setConsole('Fitting (sync)…', '');
  let result, modelFn;
  if (model === 'Custom') {
    const compiled = customCompiled;
    modelFn = (x, params) => {
      const scope = { x };
      paramNames.forEach((name, i) => { scope[name] = params[i]; });
      const v = compiled.evaluate(scope);
      return isFinite(v) ? v : NaN;
    };
  } else {
    modelFn = m.fn;
  }
  result = nStarts > 1
    ? multiStartFit(solve, modelFn, xArr, yArr, p0, opts, nStarts)
    : solve(modelFn, xArr, yArr, p0, opts);
  _finaliseFitRecord({ result, modelFn, paramNames, model, algoKey, dsId, ds, excluded, weightMode, nStarts, curvePts, sseHistory: null });
}

function _finaliseFitRecord({ result, modelFn, paramNames, model, algoKey, dsId, ds, excluded, weightMode, nStarts, curvePts, sseHistory }) {
  const m = MODELS[model];
  const fitColor = state.fits.some(f => f.dsId === dsId) ? nextColor() : ds.color;
  const algoNames = { lm: 'LM', gn: 'GN', nm: 'NM', bfgs: 'BFGS' };
  const rSqStr    = isFinite(result.rSq) ? ` (R²=${result.rSq.toFixed(4)})` : '';
  const msTag     = (nStarts > 1 && !m?.analytic) ? `×${nStarts}` : '';
  const wTag      = weightMode === 'sigma' ? ' W:σ' : weightMode !== 'none' ? ` W:${weightMode}` : '';
  const excTag    = excluded.size > 0 ? ` -${excluded.size}pt` : '';
  const fitLabel  = `${model} [${algoNames[algoKey] || algoKey}${msTag}${wTag}${excTag}]${rSqStr}`;

  // Compute reduced chi-square when σ weights were used
  if (weightMode === 'sigma' && ds.sigY && result.residuals) {
    const sigArr = ds.sigY.filter((_, i) => !excluded.has(i));
    const dof = Math.max(result.n - result.params.length, 1);
    const chiSq = result.residuals.reduce((s, r, i) => {
      const sv = sigArr[i];
      return s + (isFinite(sv) && sv > 0 ? (r / sv) ** 2 : 0);
    }, 0);
    result.chiSqRed = chiSq / dof;
  }

  const fitRecord = {
    id: nextId(), dsId, model, algo: algoKey,
    label: fitLabel, color: fitColor,
    result, fn: modelFn, visible: true,
    paramNames, curvePoints: curvePts, sseHistory,
  };
  state.fits.push(fitRecord);
  state.activeFitId = fitRecord.id;

  renderFitList();
  renderParamResults(fitRecord);
  renderStats(fitRecord);
  updatePlots();
}

/* ═══════════════════════════════════════════════════════════
   TRY ALL MODELS
═══════════════════════════════════════════════════════════ */
function tryAllModels() {
  const dsId = parseInt(document.getElementById('fit-dataset-select').value);
  const ds   = state.datasets.find(d => d.id === dsId);
  if (!ds) { setConsole('No dataset selected.', 'error'); return; }
  const excluded = ds.excludedIndices || new Set();
  const xArr = ds.x.filter((_, i) => !excluded.has(i));
  const yArr = ds.y.filter((_, i) => !excluded.has(i));
  if (xArr.length < 3) { setConsole('Need at least 3 non-masked points.', 'error'); return; }

  setConsole('Running all models…', '');
  const opts = { maxIter: 500, tol: 1e-7 };
  const rows = [];

  for (const [key, m] of Object.entries(MODELS)) {
    if (key === 'Custom') continue;
    try {
      let result, modelFn;
      if (m.analytic) {
        result  = fitPolynomialAnalytic(m.degree, xArr, yArr);
        modelFn = (x, p) => p.reduce((s, c, j) => s + c * Math.pow(x, m.degree - j), 0);
      } else {
        modelFn = m.fn;
        const p0 = m.autoInit(xArr, yArr);
        result = levenbergMarquardt(modelFn, xArr, yArr, p0, opts);
      }
      if (isFinite(result.rSq)) {
        rows.push({ key, rSq: result.rSq, rmse: result.rmse, aic: result.aic, bic: result.bic,
                    result, modelFn, paramNames: m.params });
      }
    } catch (_) { /* skip models that error */ }
  }

  rows.sort((a, b) => b.rSq - a.rSq);
  setConsole(`Compared ${rows.length} models. Best: ${rows[0]?.key} (R²=${rows[0]?.rSq.toFixed(4)}).`, '');
  showModelCompareModal(rows, dsId, ds);
}

function showModelCompareModal(rows, dsId, ds) {
  const body = document.getElementById('model-compare-body');
  const fmtN = v => isFinite(v) ? v.toPrecision(4) : '—';
  body.innerHTML = `
    <table style="width:100%;border-collapse:collapse;font-size:.8em">
      <thead>
        <tr style="border-bottom:2px solid var(--border)">
          <th style="text-align:left;padding:6px 10px">Model</th>
          <th style="text-align:right;padding:6px 8px">R²</th>
          <th style="text-align:right;padding:6px 8px">RMSE</th>
          <th style="text-align:right;padding:6px 8px">AIC</th>
          <th style="text-align:right;padding:6px 8px">BIC</th>
          <th style="padding:6px 8px"></th>
        </tr>
      </thead>
      <tbody>
        ${rows.map((r, i) => `
          <tr style="border-bottom:1px solid var(--border);${i === 0 ? 'font-weight:600' : ''}">
            <td style="padding:5px 10px">${r.key}</td>
            <td style="text-align:right;padding:5px 8px;font-family:var(--mono)">${fmtN(r.rSq)}</td>
            <td style="text-align:right;padding:5px 8px;font-family:var(--mono)">${fmtN(r.rmse)}</td>
            <td style="text-align:right;padding:5px 8px;font-family:var(--mono)">${fmtN(r.aic)}</td>
            <td style="text-align:right;padding:5px 8px;font-family:var(--mono)">${fmtN(r.bic)}</td>
            <td style="padding:5px 8px">
              <button class="btn btn-primary" style="font-size:.7em;padding:2px 9px" data-idx="${i}">Apply</button>
            </td>
          </tr>`).join('')}
      </tbody>
    </table>`;

  body.querySelectorAll('[data-idx]').forEach(btn => {
    btn.addEventListener('click', () => {
      const r = rows[parseInt(btn.dataset.idx)];
      const fitColor = state.fits.some(f => f.dsId === dsId) ? nextColor() : ds.color;
      const fitRecord = {
        id: nextId(), dsId, model: r.key, algo: 'lm',
        label: `${r.key} [LM] (R²=${r.rSq.toFixed(4)})`,
        color: fitColor, result: r.result, fn: r.modelFn,
        visible: true, paramNames: r.paramNames, curvePoints: 300, sseHistory: null,
      };
      state.fits.push(fitRecord);
      state.activeFitId = fitRecord.id;
      document.getElementById('model-select').value = r.key;
      syncModelCustomSection();
      renderFitList();
      renderParamResults(fitRecord);
      renderStats(fitRecord);
      renderCorrMatrix(fitRecord);
      updatePlots();
      setConsole(`Applied ${r.key} (R²=${r.rSq.toFixed(4)}).`, '');
      document.getElementById('model-compare-modal').style.display = 'none';
    });
  });

  document.getElementById('model-compare-modal').style.display = 'flex';
}

/* ═══════════════════════════════════════════════════════════
   EXPORT
═══════════════════════════════════════════════════════════ */
function exportFilename() {
  const title = document.getElementById('plot-title').value.trim();
  return (title || 'curve-fit').replace(/[^\w\s\-]/g, '').trim().replace(/\s+/g, '-').toLowerCase() || 'curve-fit';
}
function exportPNG() {
  Plotly.downloadImage('main-plot', { format: 'png', width: 1920, height: 1200, filename: exportFilename() });
}
function exportSVG() {
  Plotly.downloadImage('main-plot', { format: 'svg', width: 1920, height: 1200, filename: exportFilename() });
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
    const excl = ds.excludedIndices || new Set();
    csv += `\nX,Y,YFit,Residual,Masked\n`;
    ds.x.forEach((x, i) => {
      const masked = excl.has(i);
      const yFit = (!masked && fit.fn) ? fit.fn(x, fit.result.params) : NaN;
      const residual = isFinite(yFit) ? ds.y[i] - yFit : '';
      csv += `${x},${ds.y[i]},${isFinite(yFit) ? yFit : ''},${residual},${masked ? 1 : 0}\n`;
    });
  }
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${exportFilename()}-results.csv`; a.click();
}

function exportReport() {
  const fit = state.fits.find(f => f.id === state.activeFitId);
  if (!fit || !fit.result) { setConsole('No active fit to export.', 'warn'); return; }
  const ds = state.datasets.find(d => d.id === fit.dsId);
  const r = fit.result;
  const rptXlabel = document.getElementById('plot-xlabel').value.trim();
  const rptYlabel = document.getElementById('plot-ylabel').value.trim();
  const rptTitle  = document.getElementById('plot-title').value.trim();
  let txt = `=======================================================\n`;
  txt += `  Advanced Curve Fitting Studio — Fit Report\n`;
  txt += `  Generated: ${new Date().toISOString()}\n`;
  txt += `=======================================================\n\n`;
  if (rptTitle)  txt += `Title    : ${rptTitle}\n`;
  txt += `Dataset  : ${ds ? ds.name : '—'}  (${r.n} points)\n`;
  if (rptXlabel) txt += `X label  : ${rptXlabel}\n`;
  if (rptYlabel) txt += `Y label  : ${rptYlabel}\n`;
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
  txt += `BIC       : ${r.bic.toFixed(4)}\n`;
  if (r.chiSqRed != null) txt += `χ²ᵣ       : ${r.chiSqRed.toExponential(4)}\n`;
  txt += `\n`;
  txt += `─── Algorithm ────────────────────────────────────────\n`;
  txt += `Status    : ${r.converged ? 'Converged' : 'Max iterations reached'}\n`;
  txt += `Iterations: ${r.iter}\n`;
  txt += `=======================================================\n`;
  const blob = new Blob([txt], { type: 'text/plain' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${exportFilename()}-report.txt`; a.click();
}

/* ═══════════════════════════════════════════════════════════
   EXAMPLE GENERATOR MODAL
═══════════════════════════════════════════════════════════ */
let currentExampleKey = null;

function openExampleEditor(key) {
  const ex = EXAMPLES[key];
  if (!ex) return;
  currentExampleKey = key;
  document.getElementById('example-modal-title').textContent = ex.title;
  const body = document.getElementById('example-modal-body');
  body.innerHTML = ex.params.map(p => `
    <div class="ex-param-row">
      <label class="ex-param-label">${p.label}</label>
      <input class="ctrl-input ex-param-input" type="number"
        data-key="${p.key}" value="${p.value}"
        min="${p.min}" max="${p.max}" step="${p.step}">
    </div>`).join('') + `
    <div class="ex-param-row" style="border-top:1px solid var(--border);padding-top:6px;margin-top:4px">
      <label class="ex-param-label">Outlier scale</label>
      <input class="ctrl-input ex-param-input" type="number"
        data-key="outlierScale" value="4" min="0.5" max="20" step="0.5">
    </div>`;
  document.getElementById('example-modal').style.display = 'flex';
}

function closeExampleModal() {
  document.getElementById('example-modal').style.display = 'none';
  currentExampleKey = null;
}

function loadExampleFromModal() {
  if (!currentExampleKey) return;
  const ex = EXAMPLES[currentExampleKey];
  const p = {};
  document.getElementById('example-modal-body').querySelectorAll('.ex-param-input').forEach(inp => {
    let v = parseFloat(inp.value);
    if (!isFinite(v)) v = parseFloat(inp.min) || 0;
    p[inp.dataset.key] = v;
  });
  // Round integer params
  ex.params.forEach(d => { if (d.step === 1) p[d.key] = Math.max(d.min, Math.round(p[d.key])); });

  const data = ex.generate(p);
  if (p.outliers > 0) data.y = injectOutliers(data.y, Math.round(p.outliers), p.outlierScale || 4);
  closeExampleModal();
  const ds = importDataset(data.name, data.x, data.y);
  if (!ds) return;
  applyParsedMeta({ xlabel: data.xlabel, ylabel: data.ylabel, title: null });
  if (data.suggestModel) {
    document.getElementById('model-select').value = data.suggestModel;
    syncModelCustomSection();
  }
  syncFitDatasetSelect();
  renderDatasetList();
  updatePlots();
  autoInitParams();
  setConsole(`Loaded: ${data.name} (${data.x.length} points).  Press ▶ Fit to fit.`, '');
}

/* ═══════════════════════════════════════════════════════════
   POINT EDIT MODE
═══════════════════════════════════════════════════════════ */
function computeYDataDelta(pixelDY, mainEl) {
  const fl = mainEl._fullLayout;
  if (fl && fl.yaxis && fl.yaxis._length) {
    const ya = fl.yaxis;
    return -pixelDY * (ya.range[1] - ya.range[0]) / ya._length;
  }
  const layout = mainEl.layout;
  if (!layout || !layout.yaxis || !layout.yaxis.range) return 0;
  const m = layout.margin || { t: 28, b: 44 };
  const h = mainEl.offsetHeight - (m.t || 28) - (m.b || 44);
  if (h <= 0) return 0;
  const [y0, y1] = layout.yaxis.range;
  return -pixelDY * (y1 - y0) / h;
}

// Convert a data-space point to pixel coords within the plot div
function dataToPx(dataX, dataY, xa, ya) {
  if (!xa || !ya || !xa._length || !ya._length) return { px: -9999, py: -9999 };
  const xr = xa.range, yr = ya.range;
  let px, py;
  if (xa.type === 'log') {
    const lx = dataX > 0 ? Math.log10(dataX) : xr[0];
    px = xa._offset + (lx - xr[0]) / (xr[1] - xr[0]) * xa._length;
  } else {
    px = xa._offset + (dataX - xr[0]) / (xr[1] - xr[0]) * xa._length;
  }
  if (ya.type === 'log') {
    const ly = dataY > 0 ? Math.log10(dataY) : yr[0];
    py = ya._offset + (1 - (ly - yr[0]) / (yr[1] - yr[0])) * ya._length;
  } else {
    py = ya._offset + (1 - (dataY - yr[0]) / (yr[1] - yr[0])) * ya._length;
  }
  return { px, py };
}

// Find the nearest-dataset and all its points within radiusPx pixels of (clickPx, clickPy)
function findPointsInRadius(clickPx, clickPy, radiusPx) {
  const mainEl = document.getElementById('main-plot');
  const fl = mainEl._fullLayout;
  if (!fl) return null;
  const xa = fl.xaxis, ya = fl.yaxis;
  if (!xa || !ya) return null;
  const r2 = radiusPx * radiusPx;
  let bestDs = null, bestDist2 = Infinity;
  for (const ds of state.datasets) {
    if (ds.visible === false) continue;
    for (let i = 0; i < ds.x.length; i++) {
      const { px, py } = dataToPx(ds.x[i], ds.y[i], xa, ya);
      const d2 = (px - clickPx) ** 2 + (py - clickPy) ** 2;
      if (d2 < bestDist2) { bestDist2 = d2; bestDs = ds; }
    }
  }
  if (!bestDs || bestDist2 > r2) return null;
  const indices = new Set();
  for (let i = 0; i < bestDs.x.length; i++) {
    const { px, py } = dataToPx(bestDs.x[i], bestDs.y[i], xa, ya);
    const d2 = (px - clickPx) ** 2 + (py - clickPy) ** 2;
    if (d2 <= r2) indices.add(i);
  }
  return { ds: bestDs, indices };
}

function nudgeSelection(delta) {
  const ds = state.datasets.find(d => d.id === state.selection.dsId);
  if (!ds) return;
  const logY = state.plotConfig.logY;
  state.selection.indices.forEach(i => {
    if (i < 0 || i >= ds.y.length) return;
    if (logY) {
      ds.y[i] = ds.y[i] > 0 ? Math.pow(10, Math.log10(ds.y[i]) + delta) : ds.y[i];
    } else {
      ds.y[i] += delta;
    }
  });
  updatePlots();
}

function resetSelectionToOriginal() {
  const ds = state.datasets.find(d => d.id === state.selection.dsId);
  if (!ds || !ds.originalY) return;
  pushEditHistory();
  state.selection.indices.forEach(i => {
    if (i >= 0 && i < ds.originalY.length) ds.y[i] = ds.originalY[i];
  });
  updatePlots();
}

/* ── Edit history (undo/redo) ────────────────────────── */
function pushEditHistory() {
  const ds = state.datasets.find(d => d.id === state.selection.dsId);
  if (!ds) return;
  const h = state.editHistory;
  h.undo.push({ dsId: ds.id, y: ds.y.slice() });
  if (h.undo.length > 100) h.undo.shift();
  h.redo = [];
  syncUndoRedoButtons();
}

function undoEdit() {
  const h = state.editHistory;
  if (!h.undo.length) return;
  const entry = h.undo.pop();
  const ds = state.datasets.find(d => d.id === entry.dsId);
  if (ds) {
    h.redo.push({ dsId: ds.id, y: ds.y.slice() });
    if (h.redo.length > 100) h.redo.shift();
    ds.y = entry.y;
    updatePlots();
  }
  syncUndoRedoButtons();
}

function redoEdit() {
  const h = state.editHistory;
  if (!h.redo.length) return;
  const entry = h.redo.pop();
  const ds = state.datasets.find(d => d.id === entry.dsId);
  if (ds) {
    h.undo.push({ dsId: ds.id, y: ds.y.slice() });
    if (h.undo.length > 100) h.undo.shift();
    ds.y = entry.y;
    updatePlots();
  }
  syncUndoRedoButtons();
}

function syncUndoRedoButtons() {
  const bu = document.getElementById('btn-edit-undo');
  const br = document.getElementById('btn-edit-redo');
  const bx = document.getElementById('btn-edit-reset');
  if (bu) bu.disabled = !state.editHistory.undo.length;
  if (br) br.disabled = !state.editHistory.redo.length;
  if (bx) bx.disabled = !state.selection.indices.size;
}

/* ── Radius canvas overlay ───────────────────────────── */
function syncRadiusCanvas() {
  const canvas = document.getElementById('edit-radius-canvas');
  const mainEl = document.getElementById('main-plot');
  if (!canvas || !mainEl) return;
  const w = mainEl.offsetWidth, h = mainEl.offsetHeight;
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;
}

function drawRadiusOverlay(mx, my) {
  const canvas = document.getElementById('edit-radius-canvas');
  if (!canvas) return;
  syncRadiusCanvas();
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const r = state.editSelectRadius;
  if (r <= 0 || mx == null) return;
  ctx.beginPath();
  ctx.arc(mx, my, r, 0, 2 * Math.PI);
  ctx.strokeStyle = 'rgba(245,158,11,0.8)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([5, 3]);
  ctx.stroke();
}

function clearRadiusOverlay() {
  const canvas = document.getElementById('edit-radius-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function initEditMode() {
  const mainEl = document.getElementById('main-plot');
  let nearPoint = null;       // { ds, clickIdx } captured on mousedown near a point
  let dragStartClientY = 0;
  let isDragging = false;
  let histPushed = false;
  let lastMouseX = null, lastMouseY = null;
  let arrowKeyActive = false;

  // Always show the canvas so the radius circle can render
  const canvas = document.getElementById('edit-radius-canvas');
  if (canvas) { canvas.style.display = 'block'; canvas.style.pointerEvents = 'none'; syncRadiusCanvas(); }

  // Radius circle preview follows mouse
  mainEl.addEventListener('mousemove', e => {
    const rect = mainEl.getBoundingClientRect();
    lastMouseX = e.clientX - rect.left;
    lastMouseY = e.clientY - rect.top;
    if (state.editSelectRadius > 0) drawRadiusOverlay(lastMouseX, lastMouseY);
  });
  mainEl.addEventListener('mouseleave', () => clearRadiusOverlay());

  // Shift+scroll: adjust capture radius.  Plain scroll → Plotly zoom (scrollZoom:true).
  mainEl.addEventListener('wheel', e => {
    if (!e.shiftKey) return;
    e.preventDefault();
    const delta = e.deltaY < 0 ? 5 : -5;
    state.editSelectRadius = Math.max(0, Math.min(300, state.editSelectRadius + delta));
    document.getElementById('edit-radius-display').textContent = state.editSelectRadius + ' px';
    syncRadiusCanvas();
    drawRadiusOverlay(lastMouseX, lastMouseY);
  }, { passive: false });

  // Capture-phase mousedown — intercepts near-point clicks before Plotly starts a pan
  mainEl.addEventListener('mousedown', function(e) {
    if (e.button !== 0) return;
    const rect = mainEl.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const hitR = state.editSelectRadius > 0 ? state.editSelectRadius : 10;
    const result = findPointsInRadius(mx, my, hitR);

    if (!result || !result.indices.size) {
      nearPoint = null;
      return; // not near any point — fall through to Plotly (pan)
    }

    e.stopPropagation(); // prevent Plotly from seeing this mousedown

    const { ds, indices } = result;

    if (state.editSelectRadius > 0) {
      // Radius mode: commit selection immediately so drag moves all captured points
      if (e.shiftKey && state.selection.dsId === ds.id) {
        indices.forEach(i => state.selection.indices.has(i) ? state.selection.indices.delete(i) : state.selection.indices.add(i));
      } else {
        state.selection = { dsId: ds.id, indices: new Set(indices) };
      }
      nearPoint = { ds, clickIdx: -1 };
    } else {
      // Exact mode: find nearest point; defer selection to mouseup to avoid flicker on drag
      const fl = mainEl._fullLayout;
      const xa = fl && fl.xaxis, ya = fl && fl.yaxis;
      let clickIdx = -1, bestD2 = Infinity;
      indices.forEach(i => {
        const { px, py } = dataToPx(ds.x[i], ds.y[i], xa, ya);
        const d2 = (mx - px) ** 2 + (my - py) ** 2;
        if (d2 < bestD2) { bestD2 = d2; clickIdx = i; }
      });
      nearPoint = { ds, clickIdx };
    }

    dragStartClientY = e.clientY;
    isDragging = false;
    histPushed = false;

    updatePlots();
    syncUndoRedoButtons();
  }, { capture: true });

  // Drag: move selected point(s) vertically
  document.addEventListener('mousemove', e => {
    if (!nearPoint || e.buttons !== 1) return;
    if (!isDragging && Math.abs(e.clientY - dragStartClientY) > 3) {
      isDragging = true;
      // Exact mode: commit selection now that we know it's a drag
      if (state.editSelectRadius <= 0 && nearPoint.clickIdx >= 0) {
        const idx = nearPoint.clickIdx;
        if (!(state.selection.dsId === nearPoint.ds.id && state.selection.indices.has(idx))) {
          state.selection = { dsId: nearPoint.ds.id, indices: new Set([idx]) };
          updatePlots();
        }
      }
    }
    if (!isDragging || !state.selection.indices.size) return;
    if (!histPushed) { pushEditHistory(); histPushed = true; }
    nudgeSelection(computeYDataDelta(e.movementY, mainEl));
  });

  // Mouseup: commit click-selection, or end drag
  document.addEventListener('mouseup', e => {
    if (!nearPoint) return;
    if (!isDragging) {
      const { ds, clickIdx: idx } = nearPoint;
      if (idx >= 0) {
        if (e.shiftKey && state.selection.dsId === ds.id) {
          state.selection.indices.has(idx) ? state.selection.indices.delete(idx) : state.selection.indices.add(idx);
        } else if (state.selection.dsId === ds.id && state.selection.indices.has(idx)) {
          state.selection.indices.delete(idx);
        } else {
          state.selection = { dsId: ds.id, indices: new Set([idx]) };
        }
        updatePlots();
      }
    }
    nearPoint = null;
    isDragging = false;
    histPushed = false;
    syncUndoRedoButtons();
  });

  // Click on empty space → clear selection
  mainEl.addEventListener('click', e => {
    const rect = mainEl.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const result = findPointsInRadius(mx, my, Math.max(state.editSelectRadius, 10));
    if (result && result.indices.size) return; // near a point, already handled by mouseup
    if (!state.selection.indices.size) return;
    state.selection = { dsId: null, indices: new Set() };
    updatePlots();
    syncUndoRedoButtons();
  });

  // Escape: clear selection
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (state.selection.indices.size) { state.selection = { dsId: null, indices: new Set() }; updatePlots(); syncUndoRedoButtons(); }
      return;
    }
    if (e.ctrlKey && e.key === 'z') { e.preventDefault(); undoEdit(); return; }
    if (e.ctrlKey && (e.key === 'y' || e.key === 'Z')) { e.preventDefault(); redoEdit(); return; }
    if (!state.selection.indices.size) return;
    const tag = document.activeElement && document.activeElement.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

    if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && state.selection.indices.size === 1) {
      e.preventDefault();
      const ds = state.datasets.find(d => d.id === state.selection.dsId);
      if (!ds) return;
      const cur = [...state.selection.indices][0];
      const next = e.key === 'ArrowRight' ? Math.min(cur + 1, ds.x.length - 1) : Math.max(cur - 1, 0);
      if (next !== cur) { state.selection = { dsId: ds.id, indices: new Set([next]) }; updatePlots(); syncUndoRedoButtons(); }
      return;
    }

    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    e.preventDefault();
    if (!arrowKeyActive) { pushEditHistory(); arrowKeyActive = true; }
    const step = parseFloat(document.getElementById('edit-nudge-step').value) || 0.1;
    nudgeSelection(e.key === 'ArrowUp' ? step : -step);
  });
  document.addEventListener('keyup', e => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') arrowKeyActive = false;
  });
}

/* ═══════════════════════════════════════════════════════════
   TAB SYSTEM
═══════════════════════════════════════════════════════════ */
let tabList = [];
let activeTabId = null;

function nextTabId() { return 'tab_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6); }

function autoNameTab(name) {
  if (!activeTabId || !name) return;
  const tab = tabList.find(t => t.id === activeTabId);
  if (!tab || !tab.autoNamed) return;
  tab.name = name.replace(/\.[^.]+$/, '').slice(0, 30).trim() || tab.name;
  renderTabBar();
}

function clearWorkspace() {
  // Cancel any in-flight fit worker so its result doesn't land on the new workspace
  if (state.currentWorker) { state.currentWorker.terminate(); state.currentWorker = null; setFitting(false); }

  // Reset all state to factory defaults
  state.datasets      = [];
  state.fits          = [];
  state.annotations   = [];
  state.graphStyle    = Object.assign({}, DEFAULT_GRAPH_STYLE);
  state.activeDatasetId = null;
  state.activeFitId   = null;
  state.paramRows     = [];
  state.sweepParams   = null;
  state.editHistory   = { undo: [], redo: [] };
  state.editSelectRadius = 0;
  state.selection     = { dsId: null, indices: new Set() };
  state.fitConfig     = { model: 'Exponential', customExpr: 'a * exp(-b * x) + c', customParams: [], xExtraMin: null, xExtraMax: null };
  state.plotConfig    = { showResiduals: true, logX: false, logY: false, showCI: false, normalizeResiduals: false, showOutliers: false, showLegend: true, residualTab: 'residuals', logSuggestDismissed: { x: false, y: false } };

  // Model selector
  const modelSel = document.getElementById('model-select');
  if (modelSel) { modelSel.value = 'Exponential'; syncModelCustomSection(); }
  const eqInput = document.getElementById('custom-eq-input');
  if (eqInput) eqInput.value = 'a * exp(-b * x) + c';

  // Toolbar toggle buttons
  ['btn-toggle-residuals', 'btn-ci-bands', 'btn-norm-resid', 'btn-show-outliers'].forEach(id => {
    const b = document.getElementById(id); if (b) b.classList.remove('active');
  });
  const bResid = document.getElementById('btn-toggle-residuals'); if (bResid) bResid.classList.add('active');

  // Edit mode
  const bEdit = document.getElementById('btn-edit-mode'); if (bEdit) bEdit.classList.remove('active');
  const editControls = document.getElementById('edit-mode-controls'); if (editControls) editControls.style.display = 'none';

  // Residual panel visibility and active tab
  const rBar = document.getElementById('residual-tab-bar'); if (rBar) rBar.classList.remove('hidden');
  const rPlot = document.getElementById('residual-plot');   if (rPlot) rPlot.classList.remove('hidden');
  document.querySelectorAll('.resid-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === 'residuals'));

  // Plot labels
  ['plot-xlabel', 'plot-ylabel', 'plot-title'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });

  // Solver / curve settings (match HTML default attribute values)
  const solverDefaults = { 'opt-algo': 'lm', 'opt-max-iter': '20', 'opt-tol': '1e-8', 'opt-n-starts': '8', 'opt-weights': 'none', 'opt-curve-pts': '300' };
  Object.entries(solverDefaults).forEach(([id, v]) => { const el = document.getElementById(id); if (el) el.value = v; });

  // Extrapolation range
  ['opt-extrap-xmin', 'opt-extrap-xmax'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });

  // Predict / Solve
  const predMode = document.getElementById('pred-mode'); if (predMode) predMode.value = 'x2y';
  const predLbl = document.getElementById('pred-label'); if (predLbl) predLbl.textContent = 'X value';
  const predInput = document.getElementById('pred-input'); if (predInput) predInput.value = '';
  const predResult = document.getElementById('pred-result'); if (predResult) predResult.style.display = 'none';

  // F-test
  const ftResult = document.getElementById('ftest-result'); if (ftResult) ftResult.style.display = 'none';

  // Log-scale suggest banner
  const logBanner = document.getElementById('log-suggest-banner'); if (logBanner) logBanner.style.display = 'none';

  syncFitDatasetSelect();
  renderDatasetList();
  renderFitList();
  renderAnnList();
  updatePlots();
  renderStatsTable();
  syncUndoRedoButtons();
}

function saveCurrentTab() {
  if (!activeTabId) return;
  const tab = tabList.find(t => t.id === activeTabId);
  if (tab) tab.payload = buildSessionPayload();
}

function closeAllModals() {
  ['gs-modal', 'ann-modal', 'col-picker-modal', 'save-modal'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
}

function activateTab(id) {
  closeAllModals();
  saveCurrentTab();
  activeTabId = id;
  const tab = tabList.find(t => t.id === id);
  if (tab && tab.payload) {
    restoreSessionPayload(tab.payload);
  } else {
    clearWorkspace();
  }
  renderTabBar();
}

function addNewTab(name) {
  const id = nextTabId();
  tabList.push({ id, name: name || `Tab ${tabList.length + 1}`, payload: null, autoNamed: true });
  activateTab(id);
}

function closeTab(id) {
  const idx = tabList.findIndex(t => t.id === id);
  if (idx < 0) return;
  tabList.splice(idx, 1);
  if (!tabList.length) tabList.push({ id: nextTabId(), name: 'Tab 1', payload: null });
  if (activeTabId === id) {
    activateTab(tabList[Math.min(idx, tabList.length - 1)].id);
  } else {
    renderTabBar();
  }
}

function renderTabBar() {
  const bar = document.getElementById('app-tabbar');
  if (!bar) return;
  const tabsHtml = tabList.map(t => `
    <div class="app-tab${t.id === activeTabId ? ' active' : ''}" data-tab-id="${t.id}">
      <span class="app-tab-label">${t.name.replace(/</g,'&lt;')}</span>
      <span class="app-tab-close" data-close-id="${t.id}" title="Close tab">×</span>
    </div>`).join('');
  bar.innerHTML = tabsHtml + `<button class="app-tab-add" id="btn-add-tab" title="New tab">+</button>`;

  bar.querySelectorAll('.app-tab').forEach(el => {
    el.addEventListener('click', e => {
      if (e.target.dataset.closeId) return;
      const tid = el.dataset.tabId;
      if (tid !== activeTabId) activateTab(tid);
    });
    el.addEventListener('dblclick', e => {
      if (e.target.dataset.closeId) return;
      const tab = tabList.find(t => t.id === el.dataset.tabId);
      if (!tab) return;
      const label = el.querySelector('.app-tab-label');
      const old = tab.name;
      label.contentEditable = 'true';
      label.focus();
      const sel = window.getSelection(), range = document.createRange();
      range.selectNodeContents(label);
      sel.removeAllRanges(); sel.addRange(range);
      const finish = () => {
        label.contentEditable = 'false';
        const newName = label.textContent.trim();
        if (newName && newName !== old) { tab.name = newName; tab.autoNamed = false; }
        else { tab.name = old; }
        label.textContent = tab.name;
        label.removeEventListener('blur', finish);
        label.removeEventListener('keydown', onKey);
      };
      const onKey = e => {
        if (e.key === 'Enter') { e.preventDefault(); label.blur(); }
        if (e.key === 'Escape') { label.textContent = old; label.blur(); }
      };
      label.addEventListener('blur', finish);
      label.addEventListener('keydown', onKey);
    });
  });

  bar.querySelectorAll('[data-close-id]').forEach(el => {
    el.addEventListener('click', e => { e.stopPropagation(); closeTab(el.dataset.closeId); });
  });

  const addBtn = bar.querySelector('#btn-add-tab');
  if (addBtn) addBtn.addEventListener('click', () => addNewTab());
}

/* ═══════════════════════════════════════════════════════════
   SESSION PERSISTENCE
═══════════════════════════════════════════════════════════ */
function buildSessionPayload() {
  // Capture legend position from live Plotly figure (user may have dragged it)
  const mainEl = document.getElementById('main-plot');
  let legendPos = null;
  if (mainEl && mainEl.layout && mainEl.layout.legend != null) {
    const ll = mainEl.layout.legend;
    if (ll.x != null) legendPos = { x: ll.x, y: ll.y != null ? ll.y : 0.99 };
  }

  const leftPanel  = document.getElementById('panel-left');
  const rightPanel = document.getElementById('panel-right');
  const residualEl = document.getElementById('residual-plot');
  const statsBar   = document.querySelector('.app-statsbar');

  return {
    version: 2,
    savedAt: new Date().toISOString(),
    datasets: state.datasets.map(d => Object.assign({}, d, { excludedIndices: [...(d.excludedIndices || [])] })),
    fits: state.fits.map(f => ({
      id: f.id, dsId: f.dsId, model: f.model, label: f.label,
      color: f.color, visible: f.visible, paramNames: f.paramNames,
      curvePoints: f.curvePoints, result: f.result,
      customExpr: f.customExpr || null, sseHistory: f.sseHistory || null,
    })),
    fitConfig: state.fitConfig,
    plotConfig: Object.assign({}, state.plotConfig, { legendPos }),
    paramRows: state.paramRows,
    axisLabels: {
      xlabel: document.getElementById('plot-xlabel').value,
      ylabel: document.getElementById('plot-ylabel').value,
      title:  document.getElementById('plot-title').value,
    },
    panelSizes: {
      left:     leftPanel  ? leftPanel.offsetWidth   : null,
      right:    rightPanel ? rightPanel.offsetWidth  : null,
      residual: residualEl ? residualEl.offsetHeight : null,
      stats:    statsBar   ? statsBar.offsetHeight   : null,
    },
    optimizerOptions: {
      maxIter:  parseInt(document.getElementById('opt-max-iter').value)  || 20,
      tol:      parseFloat(document.getElementById('opt-tol').value)     || 1e-8,
      curvePts: parseInt(document.getElementById('opt-curve-pts').value) || 300,
      algo:     document.getElementById('opt-algo').value || 'lm',
      nStarts:  parseInt(document.getElementById('opt-n-starts').value)  || 1,
      weights:  document.getElementById('opt-weights').value || 'none',
    },
    annotations: state.annotations,
    graphStyle: state.graphStyle,
    activeDatasetId: state.activeDatasetId,
    activeFitId: state.activeFitId,
  };
}

function restoreSessionPayload(payload) {
  state.datasets = (payload.datasets || []).map(d => {
    if (!d.originalY) d.originalY = d.y.slice();  // backfill for older saves
    if (d.enabled == null) d.enabled = true;       // backfill for older saves
    if (d.sigY && d.sigY.length !== d.x.length) delete d.sigY;  // guard against corrupt saves
    d.excludedIndices = new Set(d.excludedIndices || []);
    return d;
  });
  state.fits = [];
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
  state.plotConfig = Object.assign(
    { showResiduals: true, logX: false, logY: false, showCI: false, normalizeResiduals: false, showOutliers: false, showLegend: true, residualTab: 'residuals', logSuggestDismissed: { x: false, y: false } },
    payload.plotConfig || {}
  );
  state.plotConfig.logSuggestDismissed = { x: false, y: false };
  state.annotations = (payload.annotations || []).map(a => ({ ...createDefaultAnnotation(a.type || 'hline'), ...a }));
  state.graphStyle = Object.assign({}, DEFAULT_GRAPH_STYLE, payload.graphStyle || {});
  state.activeDatasetId = payload.activeDatasetId;
  state.activeFitId = payload.activeFitId;

  // Restore paramRows before syncModelCustomSection so renderParamTable picks them up
  if (payload.paramRows) state.paramRows = payload.paramRows;

  const modelSel = document.getElementById('model-select');
  if (modelSel) { modelSel.value = state.fitConfig.model; syncModelCustomSection(); }
  const eqInput = document.getElementById('custom-eq-input');
  if (eqInput && state.fitConfig.customExpr) { eqInput.value = state.fitConfig.customExpr; parseCustomEquation(state.fitConfig.customExpr); }
  // Reset toggle button states before restoring to prevent state leak across tabs
  ['btn-toggle-residuals', 'btn-ci-bands', 'btn-norm-resid', 'btn-show-outliers'].forEach(id => {
    const b = document.getElementById(id);
    if (b) b.classList.remove('active');
  });
  if (state.plotConfig.showResiduals !== false) document.getElementById('btn-toggle-residuals').classList.add('active');
  if (state.plotConfig.showCI)             document.getElementById('btn-ci-bands').classList.add('active');
  if (state.plotConfig.normalizeResiduals) document.getElementById('btn-norm-resid').classList.add('active');
  if (state.plotConfig.showOutliers)       document.getElementById('btn-show-outliers').classList.add('active');
  const tabOff = state.plotConfig.showResiduals === false;
  document.getElementById('residual-tab-bar').classList.toggle('hidden', tabOff);
  document.getElementById('residual-plot').classList.toggle('hidden', tabOff);
  const activeTab = state.plotConfig.residualTab || 'residuals';
  document.querySelectorAll('.resid-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === activeTab));

  // Restore axis labels before updatePlots() reads them
  if (payload.axisLabels) {
    if (payload.axisLabels.xlabel != null) document.getElementById('plot-xlabel').value = payload.axisLabels.xlabel;
    if (payload.axisLabels.ylabel != null) document.getElementById('plot-ylabel').value = payload.axisLabels.ylabel;
    if (payload.axisLabels.title  != null) document.getElementById('plot-title').value  = payload.axisLabels.title;
  }

  // Restore optimizer options
  if (payload.optimizerOptions) {
    const o = payload.optimizerOptions;
    if (o.maxIter  != null) document.getElementById('opt-max-iter').value  = o.maxIter;
    if (o.tol      != null) document.getElementById('opt-tol').value       = o.tol;
    if (o.curvePts != null) document.getElementById('opt-curve-pts').value = o.curvePts;
    if (o.algo     != null) document.getElementById('opt-algo').value      = o.algo;
    if (o.nStarts  != null) document.getElementById('opt-n-starts').value  = o.nStarts;
    if (o.weights  != null) document.getElementById('opt-weights').value   = o.weights;
  }

  syncFitDatasetSelect();
  renderDatasetList();
  renderFitList();
  renderAnnList();
  updatePlots();

  // Restore panel sizes after plots are initialised, then trigger Plotly resize
  if (payload.panelSizes) {
    const leftPanel  = document.getElementById('panel-left');
    const rightPanel = document.getElementById('panel-right');
    const residualEl = document.getElementById('residual-plot');
    const statsBarEl = document.querySelector('.app-statsbar');
    if (payload.panelSizes.left     && leftPanel)  leftPanel.style.width   = payload.panelSizes.left     + 'px';
    if (payload.panelSizes.right    && rightPanel) rightPanel.style.width  = payload.panelSizes.right    + 'px';
    if (payload.panelSizes.residual && residualEl) residualEl.style.height = payload.panelSizes.residual + 'px';
    if (payload.panelSizes.stats    && statsBarEl) statsBarEl.style.height = payload.panelSizes.stats    + 'px';
    requestAnimationFrame(() => {
      Plotly.Plots.resize('main-plot');
      const resEl = document.getElementById('residual-plot');
      if (resEl && !resEl.classList.contains('hidden')) Plotly.Plots.resize('residual-plot');
    });
  }

  const active = state.fits.find(f => f.id === state.activeFitId);
  if (active) renderParamResults(active);
  renderStatsTable();
}

function buildMultiTabPayload() {
  saveCurrentTab();
  return {
    version: 3,
    savedAt: new Date().toISOString(),
    tabs: tabList.map(t => ({ id: t.id, name: t.name, payload: t.payload, autoNamed: t.autoNamed ?? false })),
    activeTabId,
  };
}

function restoreMultiTabPayload(data) {
  if (data.version === 3 && Array.isArray(data.tabs) && data.tabs.length) {
    tabList = data.tabs.map(t => ({ id: t.id, name: t.name, payload: t.payload, autoNamed: t.autoNamed ?? false }));
    activeTabId = data.activeTabId || tabList[0].id;
    if (!tabList.find(t => t.id === activeTabId)) activeTabId = tabList[0].id;
    renderTabBar();
    const active = tabList.find(t => t.id === activeTabId);
    if (active && active.payload) restoreSessionPayload(active.payload);
    else clearWorkspace();
  } else {
    // Legacy v1/v2 — wrap as single tab
    tabList = [{ id: nextTabId(), name: 'Session', payload: data }];
    activeTabId = tabList[0].id;
    renderTabBar();
    restoreSessionPayload(data);
  }
}

function saveSession() {
  // Show save modal with tab selection
  const modal = document.getElementById('save-modal');
  if (!modal) return;
  saveCurrentTab();

  // Populate tab checkboxes
  const list = modal.querySelector('#save-tab-list');
  list.innerHTML = tabList.map(t => `
    <label class="save-tab-row">
      <input type="checkbox" class="save-tab-cb" value="${t.id}" checked>
      <span class="save-tab-name">${t.name.replace(/</g,'&lt;')}</span>
      ${t.id === activeTabId ? '<span class="save-tab-badge">current</span>' : ''}
    </label>`).join('');

  // Sync radio → checkbox visibility
  const radios = modal.querySelectorAll('input[name="save-scope"]');
  function syncTabList() {
    const scope = modal.querySelector('input[name="save-scope"]:checked').value;
    list.style.display = scope === 'select' ? 'flex' : 'none';
    if (scope === 'current') {
      list.querySelectorAll('.save-tab-cb').forEach(cb => { cb.checked = (cb.value === activeTabId); });
    } else if (scope === 'all') {
      list.querySelectorAll('.save-tab-cb').forEach(cb => { cb.checked = true; });
    }
  }
  radios.forEach(r => r.addEventListener('change', syncTabList));
  syncTabList();

  modal.style.display = 'flex';
}

function performSave(tabIds) {
  try {
    const selectedTabs = tabList.filter(t => tabIds.includes(t.id));
    if (!selectedTabs.length) { setConsole('No tabs selected.', 'warn'); return; }
    const payload = {
      version: 3,
      savedAt: new Date().toISOString(),
      tabs: selectedTabs.map(t => ({ id: t.id, name: t.name, payload: t.payload })),
      activeTabId: tabIds.includes(activeTabId) ? activeTabId : selectedTabs[0].id,
    };
    const json = JSON.stringify(payload, null, 2);
    localStorage.setItem('cfs_session', json);
    const blob = new Blob([json], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `curve-fit-session-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    setConsole(`Session saved (${selectedTabs.length} tab${selectedTabs.length > 1 ? 's' : ''}) — file downloaded.`, '');
  } catch (e) {
    setConsole('Save failed: ' + e.message, 'error');
  }
}

function loadSession() {
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = '.json';
  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const data = JSON.parse(ev.target.result);
        restoreMultiTabPayload(data);
        setConsole(`Session loaded: ${file.name}`, '');
      } catch (e) { setConsole('Load failed: ' + e.message, 'error'); }
    };
    reader.readAsText(file);
  });
  fileInput.click();
}

/* ═══════════════════════════════════════════════════════════
   RESIZABLE PANELS
═══════════════════════════════════════════════════════════ */
function initResizablePanels() {
  const leftPanel  = document.getElementById('panel-left');
  const rightPanel = document.getElementById('panel-right');
  const residualEl = document.getElementById('residual-plot');
  const statsBar   = document.querySelector('.app-statsbar');
  const rhLeft     = document.getElementById('rh-left');
  const rhRight    = document.getElementById('rh-right');
  const rhResidual = document.getElementById('rh-residual');
  const rhStats    = document.getElementById('rh-stats');

  let drag = null;

  let resizeRafId = null;
  function schedulePlotResize() {
    if (!plotsInitialised) return;
    if (resizeRafId !== null) cancelAnimationFrame(resizeRafId);
    resizeRafId = requestAnimationFrame(() => {
      resizeRafId = null;
      // Reading offsetWidth forces a synchronous layout flush so Plotly measures
      // the post-resize container dimensions rather than stale pre-reflow values.
      void document.getElementById('panel-center').offsetWidth;
      Plotly.Plots.resize(document.getElementById('main-plot'));
      if (!residualEl.classList.contains('hidden')) Plotly.Plots.resize(document.getElementById('residual-plot'));
    });
  }

  function getClient(e) {
    return e.touches ? { x: e.touches[0].clientX, y: e.touches[0].clientY }
                     : { x: e.clientX,             y: e.clientY };
  }

  function onMove(e) {
    if (!drag) return;
    const { x, y } = getClient(e);
    if (drag.type === 'left') {
      leftPanel.style.width = Math.max(120, Math.min(400, drag.size + (x - drag.x))) + 'px';
    } else if (drag.type === 'right') {
      rightPanel.style.width = Math.max(180, Math.min(460, drag.size - (x - drag.x))) + 'px';
    } else if (drag.type === 'residual') {
      residualEl.style.height = Math.max(60, Math.min(360, drag.size - (y - drag.y))) + 'px';
    } else if (drag.type === 'stats') {
      statsBar.style.height = Math.max(28, Math.min(480, drag.size - (y - drag.y))) + 'px';
    }
    schedulePlotResize();
    if (e.cancelable) e.preventDefault();
  }

  function onUp() {
    if (!drag) return;
    document.querySelectorAll('.panel-resize.dragging').forEach(h => h.classList.remove('dragging'));
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    drag = null;
    schedulePlotResize();
  }

  function startDrag(type, handle, e) {
    const { x, y } = getClient(e);
    const size = type === 'left'     ? leftPanel.offsetWidth
               : type === 'right'    ? rightPanel.offsetWidth
               : type === 'stats'    ? statsBar.offsetHeight
               :                       residualEl.offsetHeight;
    drag = { type, x, y, size };
    handle.classList.add('dragging');
    document.body.style.userSelect = 'none';
    document.body.style.cursor = (type === 'residual' || type === 'stats') ? 'row-resize' : 'col-resize';
    e.preventDefault();
  }

  rhLeft.addEventListener('mousedown',     e => startDrag('left',     rhLeft,     e));
  rhRight.addEventListener('mousedown',    e => startDrag('right',    rhRight,    e));
  rhResidual.addEventListener('mousedown', e => startDrag('residual', rhResidual, e));
  rhStats.addEventListener('mousedown',    e => startDrag('stats',    rhStats,    e));
  rhLeft.addEventListener('touchstart',     e => startDrag('left',     rhLeft,     e), { passive: false });
  rhRight.addEventListener('touchstart',    e => startDrag('right',    rhRight,    e), { passive: false });
  rhResidual.addEventListener('touchstart', e => startDrag('residual', rhResidual, e), { passive: false });
  rhStats.addEventListener('touchstart',    e => startDrag('stats',    rhStats,    e), { passive: false });

  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup',   onUp);
  document.addEventListener('touchmove', onMove, { passive: false });
  document.addEventListener('touchend',  onUp);
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
      if (!EXAMPLES[key]) return;
      document.getElementById('examples-menu').classList.remove('open');
      openExampleEditor(key);
    });
  });

  /* ── Example modal ────────────────────────────────────── */
  document.getElementById('example-modal-load').addEventListener('click', loadExampleFromModal);
  document.getElementById('example-modal-cancel').addEventListener('click', closeExampleModal);
  document.getElementById('example-modal-close').addEventListener('click', closeExampleModal);
  document.getElementById('example-modal').addEventListener('click', e => {
    if (e.target === document.getElementById('example-modal')) closeExampleModal();
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
        const name = file.name.replace(/\.[^.]+$/, '');
        if (needsColumnPicker(rows)) { openColumnPicker(name, rows); return; }
        const parsed = rowsToXY(rows);
        const { x, y } = parsed;
        if (!x.length) { setConsole('Could not parse any X,Y pairs from file.', 'error'); return; }
        applyParsedMeta(parsed);
        const ds = importDataset(name, x, y);
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
        const name = file.name.replace(/\.[^.]+$/, '');
        if (needsColumnPicker(rows)) { openColumnPicker(name, rows); return; }
        const parsed = rowsToXY(rows);
        const { x, y } = parsed;
        if (!x.length) { setConsole('Could not parse file.', 'error'); return; }
        applyParsedMeta(parsed);
        const ds = importDataset(name, x, y);
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
      if (needsColumnPicker(rows)) { closePasteModal(); openColumnPicker(name, rows); return; }
      const parsed = rowsToXY(rows);
      const { x, y } = parsed;
      if (!x.length) { setConsole('No valid data found in pasted text.', 'error'); return; }
      applyParsedMeta(parsed);
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

  /* ── Cancel fit button ────────────────────────────────── */
  document.getElementById('btn-cancel-fit').addEventListener('click', () => {
    if (state.currentWorker) {
      state.currentWorker.terminate();
      state.currentWorker = null;
    }
    setFitting(false);
    setConsole('Fit cancelled.', 'warn');
  });

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
    state.selection = { dsId: null, indices: new Set() };
    syncFitDatasetSelect(); renderDatasetList(); renderFitList();
    updatePlots();
    setConsole('All datasets and fits cleared.', '');
  });

  /* ── Clear all fits ───────────────────────────────────── */
  document.getElementById('btn-clear-all-fits').addEventListener('click', () => {
    state.fits = [];
    state.activeFitId = null;
    renderFitList();
    updatePlots();
    setConsole('All fits cleared.', '');
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
  document.getElementById('btn-try-all').addEventListener('click', tryAllModels);
  document.getElementById('model-compare-close').addEventListener('click', () => {
    document.getElementById('model-compare-modal').style.display = 'none';
  });
  document.getElementById('model-compare-modal').addEventListener('click', e => {
    if (e.target === e.currentTarget) e.currentTarget.style.display = 'none';
  });

  document.getElementById('btn-copy-params').addEventListener('click', () => {
    const fit = state.fits.find(f => f.id === state.activeFitId);
    if (!fit || !fit.result || !fit.paramNames.length) { setConsole('No active fit parameters to copy.', 'error'); return; }
    const ds = state.datasets.find(d => d.id === fit.dsId);
    const r = fit.result;
    const lines = [
      `Fit:     ${fit.label || fit.model}`,
      `Model:   ${fit.model}`,
      `Dataset: ${ds ? ds.name : 'unknown'}`,
      '',
      'Parameters',
    ];
    fit.paramNames.forEach((name, i) => {
      const val = r.params[i];
      const err = r.paramErrors && r.paramErrors[i];
      lines.push(err && isFinite(err)
        ? `  ${name.padEnd(8)} = ${fmt(val)} ± ${fmt(err)}`
        : `  ${name.padEnd(8)} = ${fmt(val)}`);
    });
    lines.push('');
    lines.push('Statistics');
    lines.push(`  R²       = ${isFinite(r.rSq)     ? r.rSq.toFixed(6)     : 'N/A'}`);
    lines.push(`  Adj-R²   = ${isFinite(r.adjRSq)  ? r.adjRSq.toFixed(6)  : 'N/A'}`);
    lines.push(`  RMSE     = ${isFinite(r.rmse)    ? fmt(r.rmse)          : 'N/A'}`);
    lines.push(`  SSE      = ${isFinite(r.sse)     ? fmt(r.sse)           : 'N/A'}`);
    lines.push(`  AIC      = ${isFinite(r.aic)     ? r.aic.toFixed(3)     : 'N/A'}`);
    lines.push(`  BIC      = ${isFinite(r.bic)     ? r.bic.toFixed(3)     : 'N/A'}`);
    if (r.chiSqRed != null) lines.push(`  χ²ᵣ      = ${fmt(r.chiSqRed)}`);
    lines.push(`  N        = ${r.n}`);
    lines.push(`  Status   = ${r.converged ? 'Converged' : 'Not converged'} (${r.iter} iter)`);
    navigator.clipboard.writeText(lines.join('\n'))
      .then(() => setConsole('Parameters and stats copied to clipboard.', ''))
      .catch(() => setConsole('Clipboard access denied.', 'error'));
  });

  document.getElementById('opt-extrap-xmin').addEventListener('input', function () {
    const v = parseFloat(this.value);
    state.fitConfig.xExtraMin = isFinite(v) ? v : null;
    if (state.fits.length) updatePlots();
  });
  document.getElementById('opt-extrap-xmax').addEventListener('input', function () {
    const v = parseFloat(this.value);
    state.fitConfig.xExtraMax = isFinite(v) ? v : null;
    if (state.fits.length) updatePlots();
  });
  document.getElementById('btn-extrap-reset').addEventListener('click', () => {
    state.fitConfig.xExtraMin = null;
    state.fitConfig.xExtraMax = null;
    document.getElementById('opt-extrap-xmin').value = '';
    document.getElementById('opt-extrap-xmax').value = '';
    if (state.fits.length) updatePlots();
  });

  /* ── Toggle buttons ───────────────────────────────────── */
  document.getElementById('btn-toggle-residuals').addEventListener('click', function () {
    state.plotConfig.showResiduals = !state.plotConfig.showResiduals;
    this.classList.toggle('active', state.plotConfig.showResiduals);
    document.getElementById('residual-tab-bar').classList.toggle('hidden', !state.plotConfig.showResiduals);
    document.getElementById('residual-plot').classList.toggle('hidden', !state.plotConfig.showResiduals);
    if (state.plotConfig.showResiduals) Plotly.Plots.resize('residual-plot');
  });
  document.getElementById('btn-ci-bands').addEventListener('click', function () {
    state.plotConfig.showCI = !state.plotConfig.showCI;
    this.classList.toggle('active', state.plotConfig.showCI);
    updatePlots();
  });
  document.getElementById('btn-norm-resid').addEventListener('click', function () {
    state.plotConfig.normalizeResiduals = !state.plotConfig.normalizeResiduals;
    this.classList.toggle('active', state.plotConfig.normalizeResiduals);
    updatePlots();
  });
  document.getElementById('btn-show-outliers').addEventListener('click', function () {
    state.plotConfig.showOutliers = !state.plotConfig.showOutliers;
    this.classList.toggle('active', state.plotConfig.showOutliers);
    updatePlots();
  });
  document.getElementById('btn-mask-outliers').addEventListener('click', () => {
    const fit = state.fits.find(f => f.id === state.activeFitId);
    if (!fit || !fit.result || fit.result.rmse <= 0) { setConsole('Run a fit first.', 'warn'); return; }
    const ds = state.datasets.find(d => d.id === fit.dsId);
    if (!ds) return;
    if (!ds.excludedIndices) ds.excludedIndices = new Set();
    const threshold = 2.5 * fit.result.rmse;
    // Build map from residual index (non-excluded subset) → original ds.x index
    const origIndices = ds.x.map((_, i) => i).filter(i => !ds.excludedIndices.has(i));
    let added = 0;
    fit.result.residuals.forEach((r, ri) => {
      const origIdx = origIndices[ri];
      if (origIdx != null && Math.abs(r) > threshold && !ds.excludedIndices.has(origIdx)) {
        ds.excludedIndices.add(origIdx); added++;
      }
    });
    renderDatasetList(); updatePlots();
    setConsole(added > 0 ? `Masked ${added} outlier(s) — re-fit to update.` : 'No new outliers above 2.5σ.', '');
  });
  document.getElementById('btn-unmask-all').addEventListener('click', () => {
    const ds = state.datasets.find(d => d.id === state.activeDatasetId);
    if (!ds) { setConsole('No active dataset.', 'warn'); return; }
    const n = ds.excludedIndices ? ds.excludedIndices.size : 0;
    ds.excludedIndices = new Set();
    renderDatasetList(); updatePlots();
    setConsole(n > 0 ? `Unmasked ${n} point(s).` : 'No masked points.', '');
  });

  /* ── Column picker modal ──────────────────────────────────── */
  document.getElementById('col-picker-close').addEventListener('click', () => {
    document.getElementById('col-picker-modal').style.display = 'none'; _pendingImport = null;
  });
  document.getElementById('col-picker-cancel').addEventListener('click', () => {
    document.getElementById('col-picker-modal').style.display = 'none'; _pendingImport = null;
  });
  document.getElementById('col-picker-modal').addEventListener('click', e => {
    if (e.target === document.getElementById('col-picker-modal')) {
      document.getElementById('col-picker-modal').style.display = 'none'; _pendingImport = null;
    }
  });
  document.getElementById('col-picker-x').addEventListener('change', updateColPickerPreview);
  document.getElementById('col-picker-y').addEventListener('change', updateColPickerPreview);
  document.getElementById('col-picker-sig').addEventListener('change', updateColPickerPreview);
  document.getElementById('col-picker-import').addEventListener('click', importFromColumnPicker);

  /* ── Residual tabs ────────────────────────────────────── */
  document.querySelectorAll('.resid-tab').forEach(btn => {
    btn.addEventListener('click', function () {
      state.plotConfig.residualTab = this.dataset.tab;
      document.querySelectorAll('.resid-tab').forEach(b => b.classList.toggle('active', b === this));
      updatePlots();
    });
  });

  /* ── Log-scale suggest banner ─────────────────────────── */
  document.getElementById('log-suggest-apply-x').addEventListener('click', () => {
    state.plotConfig.logX = true;
    updatePlots();
  });
  document.getElementById('log-suggest-apply-y').addEventListener('click', () => {
    state.plotConfig.logY = true;
    updatePlots();
  });
  document.getElementById('log-suggest-dismiss').addEventListener('click', () => {
    if (!state.plotConfig.logSuggestDismissed) state.plotConfig.logSuggestDismissed = {};
    state.plotConfig.logSuggestDismissed.x = true;
    state.plotConfig.logSuggestDismissed.y = true;
    document.getElementById('log-suggest-banner').style.display = 'none';
  });

  /* ── Plot label live update ───────────────────────────── */
  ['plot-xlabel','plot-ylabel','plot-title'].forEach(id => {
    document.getElementById(id).addEventListener('input', () => { if (state.datasets.length) updatePlots(); });
  });

  /* ── Export ───────────────────────────────────────────── */
  document.getElementById('exp-png').addEventListener('click', () => { exportPNG(); document.getElementById('export-menu').classList.remove('open'); });
  document.getElementById('exp-svg').addEventListener('click', () => { exportSVG(); document.getElementById('export-menu').classList.remove('open'); });
  document.getElementById('exp-csv').addEventListener('click', () => { exportCSV(); document.getElementById('export-menu').classList.remove('open'); });
  document.getElementById('exp-report').addEventListener('click', () => { exportReport(); document.getElementById('export-menu').classList.remove('open'); });

  /* ── Session ──────────────────────────────────────────── */
  document.getElementById('btn-save').addEventListener('click', saveSession);
  document.getElementById('btn-load').addEventListener('click', loadSession);

  /* ── Full-screen overlay open / close ─────────────────── */
  const appOverlay = document.getElementById('app-overlay');
  let appEverOpened = false;
  function openApp() {
    appOverlay.classList.add('open');
    document.body.style.overflow = 'hidden';
    document.getElementById('accBtn').style.display = 'none';
    requestAnimationFrame(() => {
      if (!appEverOpened) {
        // First open: plots were init'd in a hidden zero-size div — do a full re-render
        plotsInitialised = false;
        updatePlots();
        appEverOpened = true;
        if (localStorage.getItem(TUT_KEY) !== '1') setTimeout(tutShow, 320);
      } else {
        Plotly.Plots.resize('main-plot');
        const resEl = document.getElementById('residual-plot');
        if (resEl && !resEl.classList.contains('hidden')) Plotly.Plots.resize(resEl);
      }
    });
  }
  function closeApp() {
    appOverlay.classList.remove('open');
    document.body.style.overflow = '';
    document.getElementById('accBtn').style.display = '';
  }
  const btnLaunch = document.getElementById('btn-launch-app');
  if (btnLaunch) btnLaunch.addEventListener('click', openApp);
  document.getElementById('btn-close-app').addEventListener('click', closeApp);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && appOverlay.classList.contains('open')) closeApp();
  });
  document.getElementById('btn-auto-restore').addEventListener('click', () => {
    const isOn = localStorage.getItem('cfs_autorestore') !== '0';
    const next = !isOn;
    localStorage.setItem('cfs_autorestore', next ? '1' : '0');
    document.getElementById('btn-auto-restore').classList.toggle('active', next);
    setConsole(next ? 'Auto-restore ON — saved session will be restored on next reload.' : 'Auto-restore OFF — next reload will start fresh.', '');
  });

  /* ── Save modal ───────────────────────────────────────── */
  const saveModal = document.getElementById('save-modal');
  if (saveModal) {
    document.getElementById('save-modal-close').addEventListener('click', () => { saveModal.style.display = 'none'; });
    document.getElementById('save-modal-cancel').addEventListener('click', () => { saveModal.style.display = 'none'; });
    document.getElementById('save-modal-confirm').addEventListener('click', () => {
      const scope = saveModal.querySelector('input[name="save-scope"]:checked').value;
      let ids;
      if (scope === 'current') {
        ids = [activeTabId];
      } else if (scope === 'all') {
        ids = tabList.map(t => t.id);
      } else {
        ids = [...saveModal.querySelectorAll('.save-tab-cb:checked')].map(cb => cb.value);
      }
      saveModal.style.display = 'none';
      performSave(ids);
    });
    saveModal.addEventListener('click', e => { if (e.target === saveModal) saveModal.style.display = 'none'; });
  }

  /* ── Resize plots when window resizes ─────────────────── */
  window.addEventListener('resize', () => {
    if (plotsInitialised) { Plotly.Plots.resize('main-plot'); Plotly.Plots.resize('residual-plot'); }
  });

  /* ── Edit controls panel toggle ───────────────────────── */
  document.getElementById('btn-edit-mode').addEventListener('click', function () {
    const ctrl = document.getElementById('edit-mode-controls');
    const showing = ctrl.style.display === 'flex';
    ctrl.style.display = showing ? 'none' : 'flex';
    this.classList.toggle('active', !showing);
    if (!showing) syncUndoRedoButtons();
  });

  /* ── Undo / Redo / Reset buttons ─────────────────────── */
  document.getElementById('btn-edit-undo').addEventListener('click', undoEdit);
  document.getElementById('btn-edit-redo').addEventListener('click', redoEdit);
  document.getElementById('btn-edit-reset').addEventListener('click', resetSelectionToOriginal);

  /* ── Graph Style Editor ─────────────────────────────────── */
  document.getElementById('btn-graph-style').addEventListener('click', openGraphStyleEditor);
  document.getElementById('gs-modal-close').addEventListener('click',  () => { document.getElementById('gs-modal').style.display = 'none'; });
  document.getElementById('gs-cancel-btn').addEventListener('click',   () => { document.getElementById('gs-modal').style.display = 'none'; });
  document.getElementById('gs-save-btn').addEventListener('click', saveGraphStyle);
  document.getElementById('gs-reset-btn').addEventListener('click', () => {
    state.graphStyle = Object.assign({}, DEFAULT_GRAPH_STYLE);
    document.getElementById('gs-modal').style.display = 'none';
    updatePlots();
    setConsole('Graph style reset to theme defaults.', '');
  });
  document.getElementById('gs-modal').addEventListener('click', e => { if (e.target === e.currentTarget) e.currentTarget.style.display = 'none'; });
  document.getElementById('gs-font-family').addEventListener('change', function () {
    document.getElementById('gs-row-font-custom').style.display = this.value === '__custom__' ? '' : 'none';
  });
  // Sync color picker ↔ hex for all gs- color pairs
  [['gs-font-color','gs-font-color-hex'],['gs-plot-bg','gs-plot-bg-hex'],['gs-paper-bg','gs-paper-bg-hex'],
   ['gs-grid-x-color','gs-grid-x-color-hex'],['gs-grid-y-color','gs-grid-y-color-hex'],
   ['gs-zeroline-x-color','gs-zeroline-x-color-hex'],['gs-zeroline-y-color','gs-zeroline-y-color-hex'],
   ['gs-axis-line-color','gs-axis-line-color-hex'],['gs-legend-bg','gs-legend-bg-hex'],['gs-legend-border','gs-legend-border-hex']
  ].forEach(([pickId, hexId]) => {
    const pick = document.getElementById(pickId), hex = document.getElementById(hexId);
    if (!pick || !hex) return;
    pick.addEventListener('input', () => { hex.value = pick.value; });
    hex.addEventListener('input', () => { if (/^#[0-9a-fA-F]{6}$/.test(hex.value)) pick.value = hex.value; });
  });
  // Clear buttons restore individual fields to "auto"
  document.getElementById('gs-modal').addEventListener('click', e => {
    const id = e.target.dataset.gsClear;
    if (!id) return;
    const hexEl = document.getElementById(`gs-${id}-hex`);
    if (hexEl) hexEl.value = '';
  });

  /* ── Annotations ─────────────────────────────────────────── */
  document.getElementById('btn-ann-add').addEventListener('click', () => openAnnEditor(null));
  document.getElementById('btn-ann-peaks').addEventListener('click', autoAnnotatePeaks);
  document.getElementById('ann-modal-close').addEventListener('click', () => { document.getElementById('ann-modal').style.display = 'none'; });
  document.getElementById('ann-modal-cancel').addEventListener('click', () => { document.getElementById('ann-modal').style.display = 'none'; });
  document.getElementById('ann-modal-save').addEventListener('click', saveAnn);
  document.getElementById('ann-modal').addEventListener('click', e => { if (e.target === e.currentTarget) e.currentTarget.style.display = 'none'; });
  document.getElementById('ann-type').addEventListener('change', syncAnnModalSections);
  document.getElementById('ann-font-family').addEventListener('change', function () {
    document.getElementById('ann-row-font-custom').style.display = this.value === '__custom__' ? '' : 'none';
  });
  // Sync color picker ↔ hex text fields
  [['ann-font-color','ann-font-color-hex'],['ann-line-color','ann-line-color-hex'],['ann-arrow-color','ann-arrow-color-hex']].forEach(([pickId, hexId]) => {
    document.getElementById(pickId).addEventListener('input', function () { document.getElementById(hexId).value = this.value; });
    document.getElementById(hexId).addEventListener('input', function () {
      if (/^#[0-9a-fA-F]{6}$/.test(this.value)) document.getElementById(pickId).value = this.value;
    });
  });
  // Opacity sliders display value
  document.getElementById('ann-bg-opacity').addEventListener('input', function () {
    document.getElementById('ann-bg-opacity-val').textContent = parseFloat(this.value).toFixed(2);
  });
  document.getElementById('ann-line-opacity').addEventListener('input', function () {
    document.getElementById('ann-line-opacity-val').textContent = parseFloat(this.value).toFixed(2);
  });
  // Arrow show toggle
  document.getElementById('ann-arrow-show').addEventListener('change', function () {
    document.getElementById('ann-arrow-opts').style.display = this.checked ? '' : 'none';
  });

  /* ── Predict / Solve ────────────────────────────────────── */
  const predModeEl = document.getElementById('pred-mode');
  const predLabelEl = document.getElementById('pred-label');
  const predInputEl = document.getElementById('pred-input');
  if (predModeEl) {
    predModeEl.addEventListener('change', () => {
      predLabelEl.textContent = predModeEl.value === 'x2y' ? 'X value' : 'Y value';
      const res = document.getElementById('pred-result');
      if (res) { res.style.display = 'none'; res.innerHTML = ''; }
    });
  }
  document.getElementById('btn-predict').addEventListener('click', () => {
    const fit = state.fits.find(f => f.id === state.activeFitId);
    if (!fit || !fit.result) { setConsole('No active fit — run a fit first.', 'error'); return; }
    const val = parseFloat(predInputEl.value);
    if (!isFinite(val)) { setConsole('Enter a valid number.', 'error'); return; }
    const mode = predModeEl ? predModeEl.value : 'x2y';
    if (mode === 'x2y') {
      const result = predictAtX(fit, val);
      if (!result) { setConsole('Model returned non-finite value at that X.', 'error'); return; }
      renderPredResult(result, 'x2y');
      setConsole(`Ŷ at X=${fmt(val)}: ${fmt(result.y)}`, '');
    } else {
      const ds = state.datasets.find(d => d.id === fit.dsId);
      const xArr = ds ? ds.x.filter((_, i) => !(ds.excludedIndices || new Set()).has(i)) : [];
      const xMin = state.fitConfig.xExtraMin ?? (xArr.length ? Math.min(...xArr) : -100);
      const xMax = state.fitConfig.xExtraMax ?? (xArr.length ? Math.max(...xArr) : 100);
      const roots = solveXfromY(fit, val, xMin, xMax);
      renderPredResult(roots, 'y2x');
      if (!roots.length) setConsole(`No X found where model = ${fmt(val)} in data range.`, 'warn');
      else setConsole(`X where model = ${fmt(val)}: ${roots.map(r => fmt(r.x)).join(', ')}`, '');
    }
  });
  if (predInputEl) {
    predInputEl.addEventListener('keydown', e => {
      if (e.key === 'Enter') document.getElementById('btn-predict').click();
    });
  }

  /* ── F-test ─────────────────────────────────────────────── */
  document.getElementById('btn-ftest').addEventListener('click', () => {
    const idA = parseInt(document.getElementById('ftest-fit-a').value);
    const idB = parseInt(document.getElementById('ftest-fit-b').value);
    if (!idA || !idB) { setConsole('Select two fits for the F-test.', 'error'); return; }
    if (idA === idB) { setConsole('Select two different fits.', 'error'); return; }
    const fitA = state.fits.find(f => f.id === idA);
    const fitB = state.fits.find(f => f.id === idB);
    if (!fitA || !fitB) { setConsole('One or both fits not found.', 'error'); return; }
    const result = runFTest(fitA, fitB);
    renderFTestResult(result);
    if (!result.error)
      setConsole(`F-test: F=${fmt(result.F)}, p=${result.pVal < 0.001 ? result.pVal.toExponential(2) : result.pVal.toFixed(4)}`, '');
  });

  /* ── Initial state ────────────────────────────────────── */
  document.getElementById('btn-toggle-residuals').classList.add('active');
  syncModelCustomSection();
  initResizablePanels();
  tutInit();
}

/* ═══════════════════════════════════════════════════════════
   FIRST-RUN TUTORIAL
═══════════════════════════════════════════════════════════ */
const TUT_KEY = 'cfs_tutorial_done';
let _tutStep = 0;

const TUT_SLIDES = [
  {
    title: 'Welcome to Advanced Curve Fitting Studio',
    body: 'A fully offline, browser-native platform for scientific curve fitting and nonlinear regression. Load data, choose from <strong>24 built-in models</strong>, and fit with Levenberg-Marquardt, Gauss-Newton, Nelder-Mead, or BFGS — no installation or internet required.',
    illus: `<svg viewBox="0 0 500 160" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="500" height="160" rx="8" fill="#07111e"/>
      <line x1="50" y1="20" x2="50" y2="148" stroke="#1c3050" stroke-width="1.5"/>
      <line x1="50" y1="148" x2="490" y2="148" stroke="#1c3050" stroke-width="1.5"/>
      <line x1="50" y1="104" x2="490" y2="104" stroke="#1c3050" stroke-width="0.5" opacity=".5"/>
      <line x1="50" y1="60" x2="490" y2="60" stroke="#1c3050" stroke-width="0.5" opacity=".5"/>
      <line x1="173" y1="20" x2="173" y2="148" stroke="#1c3050" stroke-width="0.5" opacity=".5"/>
      <line x1="296" y1="20" x2="296" y2="148" stroke="#1c3050" stroke-width="0.5" opacity=".5"/>
      <line x1="419" y1="20" x2="419" y2="148" stroke="#1c3050" stroke-width="0.5" opacity=".5"/>
      <path d="M58,28 C110,42 165,68 220,91 C268,112 322,128 386,138 C420,143 456,144 486,144.5 L486,150 C456,150 420,149 386,144 C322,135 268,119 220,98 C165,75 110,49 58,34Z" fill="#0b9e8a" opacity="0.12"/>
      <path d="M58,31 C110,45 165,71 220,94 C268,115 322,131 386,141 C420,145 456,146 486,146" stroke="#0b9e8a" stroke-width="2.5" stroke-linecap="round"/>
      <circle cx="61" cy="26" r="3.5" fill="#3b82f6"/><circle cx="84" cy="38" r="3.5" fill="#3b82f6"/>
      <circle cx="110" cy="50" r="3.5" fill="#3b82f6"/><circle cx="138" cy="64" r="3.5" fill="#3b82f6"/>
      <circle cx="164" cy="75" r="3.5" fill="#3b82f6"/><circle cx="193" cy="86" r="3.5" fill="#3b82f6"/>
      <circle cx="224" cy="97" r="3.5" fill="#3b82f6"/><circle cx="258" cy="108" r="3.5" fill="#3b82f6"/>
      <circle cx="297" cy="117" r="3.5" fill="#3b82f6"/><circle cx="342" cy="126" r="3.5" fill="#3b82f6"/>
      <circle cx="390" cy="134" r="3.5" fill="#3b82f6"/><circle cx="440" cy="139" r="3.5" fill="#3b82f6"/>
      <circle cx="73" cy="33" r="3" fill="#3b82f6" opacity=".6"/><circle cx="122" cy="57" r="3" fill="#3b82f6" opacity=".6"/>
      <circle cx="153" cy="70" r="3" fill="#3b82f6" opacity=".6"/><circle cx="208" cy="91" r="3" fill="#3b82f6" opacity=".6"/>
      <circle cx="248" cy="103" r="3" fill="#3b82f6" opacity=".6"/><circle cx="286" cy="113" r="3" fill="#3b82f6" opacity=".6"/>
      <circle cx="362" cy="129" r="3" fill="#3b82f6" opacity=".6"/><circle cx="420" cy="136" r="3" fill="#3b82f6" opacity=".6"/>
      <circle cx="465" cy="141" r="3" fill="#3b82f6" opacity=".6"/>
      <rect x="330" y="15" width="156" height="22" rx="5" fill="#0d2040" stroke="#1c3050"/>
      <circle cx="344" cy="26" r="4.5" fill="#0b9e8a"/>
      <text x="354" y="30.5" font-size="10" fill="#94a3b8" font-family="monospace">Exp-Decay  R²=0.998</text>
    </svg>`
  },
  {
    title: 'Load Your Data',
    body: 'Click <strong>Examples</strong> for built-in synthetic datasets, <strong>Import Data</strong> to upload a CSV/TSV/TXT file, or <strong>Paste Data</strong> to paste from a spreadsheet. Drag-and-drop onto the plot also works. Three-column files (X, Y, σ) unlock error-weighted fitting.',
    illus: `<svg viewBox="0 0 500 160" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="500" height="160" rx="8" fill="#07111e"/>
      <rect x="16" y="16" width="126" height="28" rx="6" fill="#0b2c44" stroke="#0b9e8a" stroke-width="1.5"/>
      <text x="79" y="34" font-size="11" fill="#0b9e8a" text-anchor="middle" font-family="sans-serif" font-weight="600">Examples ▾</text>
      <rect x="154" y="16" width="114" height="28" rx="6" fill="#0d2040" stroke="#1c3050"/>
      <text x="211" y="34" font-size="11" fill="#7a90ae" text-anchor="middle" font-family="sans-serif">Import Data</text>
      <rect x="280" y="16" width="104" height="28" rx="6" fill="#0d2040" stroke="#1c3050"/>
      <text x="332" y="34" font-size="11" fill="#7a90ae" text-anchor="middle" font-family="sans-serif">Paste Data</text>
      <rect x="16" y="56" width="216" height="90" rx="6" fill="#0d2040" stroke="#1c3050"/>
      <text x="30" y="74" font-size="10" fill="#0b9e8a" font-family="monospace" font-weight="600">x</text>
      <text x="96" y="74" font-size="10" fill="#0b9e8a" font-family="monospace" font-weight="600">y</text>
      <text x="162" y="74" font-size="10" fill="#0b9e8a" font-family="monospace" font-weight="600">σ  (optional)</text>
      <line x1="16" y1="79" x2="232" y2="79" stroke="#1c3050"/>
      <text x="30" y="94" font-size="10" fill="#94a3b8" font-family="monospace">0.0</text><text x="96" y="94" font-size="10" fill="#94a3b8" font-family="monospace">95.2</text><text x="162" y="94" font-size="10" fill="#94a3b8" font-family="monospace">0.8</text>
      <text x="30" y="110" font-size="10" fill="#94a3b8" font-family="monospace">1.0</text><text x="96" y="110" font-size="10" fill="#94a3b8" font-family="monospace">78.4</text><text x="162" y="110" font-size="10" fill="#94a3b8" font-family="monospace">1.1</text>
      <text x="30" y="126" font-size="10" fill="#94a3b8" font-family="monospace">2.0</text><text x="96" y="126" font-size="10" fill="#94a3b8" font-family="monospace">63.1</text><text x="162" y="126" font-size="10" fill="#94a3b8" font-family="monospace">0.9</text>
      <text x="30" y="138" font-size="9" fill="#3b4f6b" font-family="monospace">...</text>
      <rect x="248" y="56" width="236" height="90" rx="6" fill="#0d2040" stroke="#1c3050" stroke-dasharray="5 3"/>
      <path d="M366,86 L366,112 M352,99 L380,99 M352,99 L358,93 M380,99 L374,93" stroke="#1c3050" stroke-width="2" stroke-linecap="round"/>
      <text x="366" y="130" font-size="10" fill="#3b4f6b" text-anchor="middle" font-family="sans-serif">drag &amp; drop files here</text>
      <text x="366" y="143" font-size="9" fill="#253448" text-anchor="middle" font-family="sans-serif">.csv  ·  .tsv  ·  .txt</text>
    </svg>`
  },
  {
    title: 'Select a Model and Fit',
    body: 'Choose from <strong>24 built-in models</strong> across 7 groups — or write a <strong>Custom Equation</strong> in x. Click <strong>Auto Init</strong> for data-driven starting guesses, then press <strong>▶ Fit</strong> (or Ctrl+Enter). Set optional Min/Max bounds on any parameter. Drag the sweep slider for a live preview without fitting.',
    illus: `<svg viewBox="0 0 500 160" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="500" height="160" rx="8" fill="#07111e"/>
      <text x="16" y="26" font-size="9" fill="#5a7090" font-family="sans-serif" letter-spacing=".07em" font-weight="600">FIT MODEL</text>
      <rect x="16" y="31" width="220" height="26" rx="5" fill="#0d2040" stroke="#0b9e8a" stroke-width="1.5"/>
      <text x="27" y="48" font-size="11" fill="#e2e8f0" font-family="sans-serif">Exponential  y = a·eᵇˣ</text>
      <text x="224" y="48" font-size="10" fill="#6b82a0" font-family="sans-serif">▾</text>
      <rect x="16" y="65" width="220" height="86" rx="5" fill="#0d2040" stroke="#1c3050"/>
      <text x="25" y="80" font-size="9" fill="#5a7090" font-family="monospace" letter-spacing=".04em">PARAM   INIT       FIT</text>
      <line x1="16" y1="84" x2="236" y2="84" stroke="#1c3050"/>
      <text x="25" y="98" font-size="9.5" fill="#94a3b8" font-family="monospace">a     95.0     94.8 ±0.9</text>
      <text x="25" y="112" font-size="9.5" fill="#94a3b8" font-family="monospace">b     0.18     0.179±0.003</text>
      <text x="25" y="126" font-size="9.5" fill="#94a3b8" font-family="monospace">c     2.00     2.11 ±0.29</text>
      <rect x="22" y="135" width="70" height="8" rx="3" fill="#1c3050"/>
      <rect x="22" y="135" width="44" height="8" rx="3" fill="#0b9e8a" opacity=".45"/>
      <text x="96" y="142" font-size="8" fill="#4a6080" font-family="sans-serif">param sweep</text>
      <rect x="252" y="31" width="112" height="26" rx="6" fill="#0d2040" stroke="#1c3050"/>
      <text x="308" y="48" font-size="11" fill="#7a90ae" text-anchor="middle" font-family="sans-serif">Auto Init</text>
      <rect x="376" y="31" width="108" height="26" rx="6" fill="#0b2c44" stroke="#0b9e8a" stroke-width="1.5"/>
      <text x="430" y="48" font-size="12" fill="#0b9e8a" text-anchor="middle" font-family="sans-serif" font-weight="600">▶  Fit</text>
      <rect x="252" y="67" width="232" height="22" rx="5" fill="#0d2040" stroke="#1c3050"/>
      <text x="262" y="82" font-size="10" fill="#0b9e8a" font-family="monospace" font-weight="600">R² = 0.9984</text>
      <text x="366" y="82" font-size="10" fill="#7a90ae" font-family="monospace">RMSE 1.23</text>
      <rect x="252" y="97" width="232" height="54" rx="5" fill="#0d2040" stroke="#1c3050"/>
      <text x="262" y="111" font-size="9" fill="#5a7090" font-family="sans-serif">Residuals</text>
      <line x1="252" y1="124" x2="484" y2="124" stroke="#1c3050" stroke-width="0.8" stroke-dasharray="4 2"/>
      <circle cx="269" cy="120" r="2.5" fill="#3b82f6"/><circle cx="290" cy="129" r="2.5" fill="#3b82f6"/>
      <circle cx="314" cy="121" r="2.5" fill="#3b82f6"/><circle cx="340" cy="128" r="2.5" fill="#3b82f6"/>
      <circle cx="366" cy="120" r="2.5" fill="#3b82f6"/><circle cx="394" cy="128" r="2.5" fill="#3b82f6"/>
      <circle cx="420" cy="121" r="2.5" fill="#3b82f6"/><circle cx="448" cy="129" r="2.5" fill="#3b82f6"/>
      <circle cx="470" cy="121" r="2.5" fill="#3b82f6"/>
    </svg>`
  },
  {
    title: 'Analyse Results',
    body: 'Converged parameters appear with <strong>± standard errors</strong>. The stats bar shows <strong>R², Adj-R², RMSE, SSE, AIC, BIC, and N</strong>. Four diagnostic tabs — Residuals, Q-Q Plot, Histogram, and Convergence — help assess fit quality. Click <strong>Try All</strong> to rank every model by R² in one shot.',
    illus: `<svg viewBox="0 0 500 160" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="500" height="160" rx="8" fill="#07111e"/>
      <rect x="12" y="12" width="476" height="22" rx="5" fill="#0d2040" stroke="#1c3050"/>
      <text x="22" y="27" font-size="9.5" fill="#0b9e8a" font-family="monospace" font-weight="600">R² 0.9984</text>
      <text x="98" y="27" font-size="9.5" fill="#7a90ae" font-family="monospace">Adj-R² 0.998</text>
      <text x="200" y="27" font-size="9.5" fill="#7a90ae" font-family="monospace">RMSE 1.23</text>
      <text x="284" y="27" font-size="9.5" fill="#7a90ae" font-family="monospace">AIC −32.4</text>
      <text x="360" y="27" font-size="9.5" fill="#7a90ae" font-family="monospace">BIC −28.1</text>
      <text x="432" y="27" font-size="9.5" fill="#7a90ae" font-family="monospace">N 24</text>
      <rect x="12" y="42" width="238" height="106" rx="5" fill="#0d2040" stroke="#1c3050"/>
      <text x="22" y="57" font-size="9" fill="#0b9e8a" font-family="sans-serif" font-weight="600">Residuals</text>
      <text x="76" y="57" font-size="9" fill="#3b4f6b" font-family="sans-serif">Q-Q</text>
      <text x="110" y="57" font-size="9" fill="#3b4f6b" font-family="sans-serif">Histogram</text>
      <text x="176" y="57" font-size="9" fill="#3b4f6b" font-family="sans-serif">Convergence</text>
      <line x1="12" y1="60" x2="250" y2="60" stroke="#1c3050"/>
      <line x1="12" y1="96" x2="250" y2="96" stroke="#1c3050" stroke-width="0.7" stroke-dasharray="4 2"/>
      <circle cx="30" cy="91" r="2.8" fill="#3b82f6"/><circle cx="54" cy="102" r="2.8" fill="#3b82f6"/>
      <circle cx="80" cy="90" r="2.8" fill="#3b82f6"/><circle cx="104" cy="101" r="2.8" fill="#3b82f6"/>
      <circle cx="130" cy="92" r="2.8" fill="#3b82f6"/><circle cx="156" cy="100" r="2.8" fill="#3b82f6"/>
      <circle cx="180" cy="91" r="2.8" fill="#3b82f6"/><circle cx="204" cy="101" r="2.8" fill="#3b82f6"/>
      <circle cx="228" cy="92" r="2.8" fill="#3b82f6"/><circle cx="244" cy="99" r="2.8" fill="#3b82f6"/>
      <text x="22" y="136" font-size="9" fill="#3b4f6b" font-family="monospace">SSE 33.5  · df 21  · converged</text>
      <rect x="262" y="42" width="226" height="106" rx="5" fill="#0d2040" stroke="#1c3050"/>
      <text x="272" y="57" font-size="9" fill="#6b82a0" font-family="sans-serif" font-weight="600">Try All Models — by R²</text>
      <line x1="262" y1="61" x2="488" y2="61" stroke="#1c3050"/>
      <rect x="270" y="65" width="210" height="14" rx="3" fill="#0b2640" stroke="#0b9e8a" stroke-width=".8"/>
      <text x="276" y="75" font-size="9" fill="#0b9e8a" font-family="monospace">Exp-Decay-Offset  0.9984</text>
      <text x="455" y="75" font-size="8.5" fill="#0b9e8a" font-family="sans-serif">Apply</text>
      <text x="276" y="91" font-size="9" fill="#7a90ae" font-family="monospace">Exponential       0.9921</text>
      <text x="455" y="91" font-size="8.5" fill="#5a7090" font-family="sans-serif">Apply</text>
      <text x="276" y="107" font-size="9" fill="#5a7090" font-family="monospace">Gaussian          0.9401</text>
      <text x="455" y="107" font-size="8.5" fill="#3b4f6b" font-family="sans-serif">Apply</text>
      <text x="276" y="123" font-size="9" fill="#3b4f6b" font-family="monospace">Logistic          0.8873</text>
      <text x="276" y="139" font-size="9" fill="#253448" font-family="monospace">Power Law         0.7120</text>
    </svg>`
  },
  {
    title: 'Multiple Independent Workspaces',
    body: 'Click <strong>+</strong> in the tab bar to open a new workspace. Every tab is completely independent — its own datasets, fits, annotations, graph style, and settings. Double-click a tab name to rename it. Use <strong>Save Session</strong> to export all tabs to JSON, and reload them anytime.',
    illus: `<svg viewBox="0 0 500 160" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="500" height="160" rx="8" fill="#07111e"/>
      <rect x="0" y="0" width="500" height="36" rx="0" fill="#060e1a"/>
      <rect x="10" y="6" width="110" height="28" rx="5" fill="#0d2040" stroke="#0b9e8a" stroke-width="1.2"/>
      <text x="56" y="24" font-size="10" fill="#0b9e8a" text-anchor="middle" font-family="sans-serif" font-weight="600">Exp Decay</text>
      <text x="108" y="24" font-size="10" fill="#2a3e56" font-family="sans-serif">×</text>
      <rect x="126" y="6" width="96" height="28" rx="5" fill="#09141f" stroke="#1c3050"/>
      <text x="166" y="24" font-size="10" fill="#4a6080" text-anchor="middle" font-family="sans-serif">G-V Curve</text>
      <text x="211" y="24" font-size="10" fill="#1e2e40" font-family="sans-serif">×</text>
      <rect x="228" y="6" width="86" height="28" rx="5" fill="#09141f" stroke="#1c3050"/>
      <text x="264" y="24" font-size="10" fill="#4a6080" text-anchor="middle" font-family="sans-serif">Kir I-V</text>
      <text x="303" y="24" font-size="10" fill="#1e2e40" font-family="sans-serif">×</text>
      <rect x="320" y="10" width="28" height="20" rx="5" fill="#09141f" stroke="#1c3050"/>
      <text x="334" y="24.5" font-size="14" fill="#2a3e56" text-anchor="middle" font-family="sans-serif">+</text>
      <line x1="0" y1="36" x2="500" y2="36" stroke="#1c3050"/>
      <rect x="0" y="36" width="130" height="124" fill="#060e1a"/>
      <line x1="130" y1="36" x2="130" y2="160" stroke="#1c3050"/>
      <text x="12" y="58" font-size="9" fill="#3b82f6" font-family="monospace">● Dataset 1</text>
      <text x="20" y="72" font-size="9" fill="#2a3e56" font-family="monospace">  Exp-Decay fit</text>
      <text x="12" y="94" font-size="8.5" fill="#1e2e40" font-family="sans-serif">Tab 2: G-V Curve</text>
      <text x="12" y="108" font-size="8.5" fill="#1e2e40" font-family="sans-serif">Tab 3: Kir I-V</text>
      <text x="148" y="60" font-size="9" fill="#5a7090" font-family="sans-serif" font-weight="600">INDEPENDENT WORKSPACES</text>
      <text x="148" y="78" font-size="9" fill="#3b4f6b" font-family="sans-serif">Each tab has its own datasets, fits,</text>
      <text x="148" y="93" font-size="9" fill="#3b4f6b" font-family="sans-serif">annotations, graph style, and settings.</text>
      <text x="148" y="112" font-size="9" fill="#2a3a4e" font-family="sans-serif">Double-click a tab name to rename it.</text>
      <text x="148" y="127" font-size="9" fill="#2a3a4e" font-family="sans-serif">Tabs never inherit state from each other.</text>
      <rect x="148" y="140" width="90" height="14" rx="4" fill="#0d2040" stroke="#1c3050"/>
      <text x="193" y="151" font-size="9" fill="#5a7090" text-anchor="middle" font-family="sans-serif">Save Session</text>
      <rect x="248" y="140" width="80" height="14" rx="4" fill="#0d2040" stroke="#1c3050"/>
      <text x="288" y="151" font-size="9" fill="#5a7090" text-anchor="middle" font-family="sans-serif">Load Session</text>
    </svg>`
  },
  {
    title: 'Annotate, Style, and Export',
    body: 'Add <strong>reference lines, text callouts, and auto-peak markers</strong> from the Annotations panel. Click <strong>⚙ Style</strong> to adjust fonts, colours, grid, axis range, and log scale. <strong>Export</strong> saves the plot as PNG or SVG. <strong>Copy Params</strong> copies all fit results to the clipboard.',
    illus: `<svg viewBox="0 0 500 160" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="500" height="160" rx="8" fill="#07111e"/>
      <rect x="12" y="12" width="240" height="136" rx="6" fill="#0d2040" stroke="#1c3050"/>
      <line x1="12" y1="87" x2="252" y2="87" stroke="#dc2626" stroke-width="1.3" stroke-dasharray="5 3" opacity=".85"/>
      <rect x="186" y="79" width="54" height="13" rx="3" fill="#1a0a0a" opacity=".9"/>
      <text x="213" y="89" font-size="9" fill="#dc2626" text-anchor="middle" font-family="sans-serif">EC₅₀ = 2.4</text>
      <path d="M22,140 C62,140 92,140 108,102 C118,82 124,60 128,50 C132,40 138,40 152,50 C156,60 162,82 172,102 C192,140 222,140 248,140" stroke="#0b9e8a" stroke-width="2.2" fill="none"/>
      <circle cx="128" cy="50" r="4" fill="#f59e0b" stroke="#07111e" stroke-width="1.5"/>
      <line x1="128" y1="45" x2="128" y2="28" stroke="#f59e0b" stroke-width="1.5"/>
      <polygon points="124,28 132,28 128,22" fill="#f59e0b"/>
      <rect x="96" y="16" width="84" height="14" rx="3" fill="#1c1200" opacity=".9"/>
      <text x="138" y="26.5" font-size="9" fill="#f59e0b" text-anchor="middle" font-family="sans-serif">peak  x = −39 mV</text>
      <text x="22" y="56" font-size="9" fill="#5a7090" font-family="sans-serif">Gaussian fit</text>
      <rect x="268" y="12" width="220" height="62" rx="5" fill="#0d2040" stroke="#1c3050"/>
      <text x="280" y="28" font-size="9" fill="#5a7090" font-family="sans-serif" font-weight="600">⚙ GRAPH STYLE</text>
      <text x="280" y="43" font-size="9" fill="#3b4f6b" font-family="sans-serif">Fonts · Background · Grid · Zero lines</text>
      <text x="280" y="57" font-size="9" fill="#3b4f6b" font-family="sans-serif">Axis range · Log scale · Tick spacing</text>
      <rect x="268" y="82" width="220" height="66" rx="5" fill="#0d2040" stroke="#1c3050"/>
      <text x="280" y="97" font-size="9" fill="#5a7090" font-family="sans-serif" font-weight="600">SAVE &amp; EXPORT</text>
      <rect x="280" y="101" width="88" height="20" rx="5" fill="#0a1628" stroke="#1c3050"/>
      <text x="324" y="115" font-size="9.5" fill="#7a90ae" text-anchor="middle" font-family="sans-serif">Save Session</text>
      <rect x="378" y="101" width="96" height="20" rx="5" fill="#0a1628" stroke="#1c3050"/>
      <text x="426" y="115" font-size="9.5" fill="#7a90ae" text-anchor="middle" font-family="sans-serif">Export PNG/SVG</text>
      <rect x="280" y="129" width="88" height="14" rx="4" fill="#0a1628" stroke="#1c3050"/>
      <text x="324" y="139.5" font-size="9" fill="#5a7090" text-anchor="middle" font-family="sans-serif">Copy Params</text>
      <rect x="378" y="129" width="96" height="14" rx="4" fill="#0a1628" stroke="#1c3050"/>
      <text x="426" y="139.5" font-size="9" fill="#5a7090" text-anchor="middle" font-family="sans-serif">Predict / Solve</text>
    </svg>`
  }
];

function tutShow() {
  _tutStep = 0;
  const el = document.getElementById('tut-overlay');
  if (!el) return;
  el.style.display = 'flex';
  tutRender();
  document.getElementById('tut-next').focus();
}

function tutClose() {
  const el = document.getElementById('tut-overlay');
  if (el) el.style.display = 'none';
}

function tutRender() {
  const n = TUT_SLIDES.length;
  const s = TUT_SLIDES[_tutStep];
  document.getElementById('tut-illus').innerHTML = s.illus;
  document.getElementById('tut-title').textContent = s.title;
  document.getElementById('tut-body').innerHTML = s.body;
  document.getElementById('tut-count').textContent = `${_tutStep + 1} / ${n}`;
  document.getElementById('tut-prev').disabled = _tutStep === 0;
  document.getElementById('tut-next').textContent = _tutStep === n - 1 ? 'Get Started!' : 'Next →';
  const dots = document.getElementById('tut-dots');
  dots.innerHTML = '';
  for (let i = 0; i < n; i++) {
    const d = document.createElement('div');
    d.className = 'tut-dot' + (i === _tutStep ? ' active' : '');
    dots.appendChild(d);
  }
}

function tutInit() {
  document.getElementById('tut-prev').addEventListener('click', () => {
    if (_tutStep > 0) { _tutStep--; tutRender(); }
  });
  document.getElementById('tut-next').addEventListener('click', () => {
    if (_tutStep < TUT_SLIDES.length - 1) { _tutStep++; tutRender(); }
    else tutClose();
  });
  document.getElementById('tut-skip').addEventListener('click', tutClose);
  document.getElementById('tut-no-show').addEventListener('click', () => {
    localStorage.setItem(TUT_KEY, '1');
    tutClose();
  });
  document.getElementById('tut-overlay').addEventListener('keydown', e => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      if (_tutStep < TUT_SLIDES.length - 1) { _tutStep++; tutRender(); } else tutClose();
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (_tutStep > 0) { _tutStep--; tutRender(); }
    } else if (e.key === 'Escape') {
      e.preventDefault(); tutClose();
    }
  });
}

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

  // Scroll-reveal for page sections
  const revealObs = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); });
  }, { threshold: 0.07 });
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

})();
