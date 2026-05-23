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

  return finaliseFit(fn, xArr, yArr, p, { converged, iter });
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

/* ── Gauss-Newton with backtracking line search ──────────── */
function gaussNewton(fn, xArr, yArr, p0, opts) {
  opts = opts || {};
  const maxIter = opts.maxIter || 1000;
  const tol     = opts.tol != null ? parseFloat(opts.tol) || 1e-8 : 1e-8;
  const EPS = 1e-7;
  const n = xArr.length, m = p0.length;
  let p = p0.map(Number);
  let converged = false, iter = 0;

  function evalR(params) {
    return xArr.map((x, i) => { const v = fn(x, params); return isFinite(v) ? yArr[i] - v : 0; });
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
    let newSSE = sse(evalR(pNew));
    for (let ls = 0; ls < 12 && newSSE >= curSSE; ls++) {
      alpha *= 0.5;
      pNew = p.map((v, i) => v + alpha * delta[i]);
      newSSE = sse(evalR(pNew));
    }
    if (newSSE >= curSSE) break;
    p = pNew;
    const stepNorm = alpha * Math.sqrt(delta.reduce((s, d) => s + d * d, 0));
    if (stepNorm < tol && Math.abs(curSSE - newSSE) < tol) { converged = true; break; }
  }
  return finaliseFit(fn, xArr, yArr, p, { converged, iter });
}

/* ── Nelder-Mead Simplex ─────────────────────────────────── */
function nelderMead(fn, xArr, yArr, p0, opts) {
  opts = opts || {};
  const maxIter = opts.maxIter || 2000;
  const tol     = opts.tol != null ? parseFloat(opts.tol) || 1e-8 : 1e-8;
  const n = xArr.length, m = p0.length;

  function obj(params) {
    let s = 0;
    for (let i = 0; i < n; i++) { const v = fn(xArr[i], params); if (isFinite(v)) s += (yArr[i] - v) ** 2; }
    return isFinite(s) ? s : 1e30;
  }

  // Initial simplex: perturb each parameter by 5 % (or 0.05 if zero)
  let simplex = [p0.slice()];
  for (let j = 0; j < m; j++) {
    const v = p0.slice();
    v[j] += Math.abs(v[j]) > 1e-8 ? 0.05 * Math.abs(v[j]) : 0.05;
    simplex.push(v);
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
    const xr = c.map((ci, j) => ci + (ci - simplex[m][j]));
    const fr = obj(xr);

    if (fr < fval[0]) {
      // Expansion
      const xe = c.map((ci, j) => ci + 2 * (xr[j] - ci));
      const fe = obj(xe);
      simplex[m] = fe < fr ? xe : xr;
      fval[m]    = fe < fr ? fe : fr;
    } else if (fr < fval[m - 1]) {
      simplex[m] = xr; fval[m] = fr;
    } else {
      // Contraction
      const inside = fr >= fval[m];
      const xc = c.map((ci, j) => ci + 0.5 * ((inside ? simplex[m][j] : xr[j]) - ci));
      const fc = obj(xc);
      if (fc < (inside ? fval[m] : fr)) { simplex[m] = xc; fval[m] = fc; }
      else {
        // Shrink toward best
        for (let i = 1; i <= m; i++) {
          simplex[i] = simplex[0].map((s0, j) => s0 + 0.5 * (simplex[i][j] - s0));
          fval[i]    = obj(simplex[i]);
        }
      }
    }
  }
  return finaliseFit(fn, xArr, yArr, simplex[0], { converged, iter });
}

/* ── BFGS (quasi-Newton, inverse-Hessian form) ───────────── */
function bfgs(fn, xArr, yArr, p0, opts) {
  opts = opts || {};
  const maxIter = opts.maxIter || 1000;
  const tol     = opts.tol != null ? parseFloat(opts.tol) || 1e-8 : 1e-8;
  const EPS = 1e-6;
  const n = xArr.length, m = p0.length;

  function obj(params) {
    let s = 0;
    for (let i = 0; i < n; i++) { const v = fn(xArr[i], params); if (isFinite(v)) s += (yArr[i] - v) ** 2; }
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
    let fNew = obj(pNew);
    for (let ls = 0; ls < 20 && fNew > f0 + 1e-4 * alpha * dg; ls++) {
      alpha *= 0.5;
      pNew = p.map((v, i) => v + alpha * d[i]);
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
  return finaliseFit(fn, xArr, yArr, p, { converged, iter });
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
  try {
    const J_cols = [];
    for (let j = 0; j < m; j++) {
      const pp = p.slice();
      const h = Math.max(Math.abs(p[j]) * EPS, EPS);
      pp[j] += h;
      const r1 = xArr.map((x, i) => { const v = fn(x, pp); return isFinite(v) ? yArr[i] - v : 0; });
      J_cols.push(r1.map((v, i) => (v - r[i]) / h));
    }
    const JtJ = Array.from({ length: m }, (_, a) =>
      Array.from({ length: m }, (_, b) => J_cols[a].reduce((s, _, i) => s + J_cols[a][i] * J_cols[b][i], 0)));
    const sig2 = sseVal / Math.max(n - m, 1);
    const inv = invertMatrix(JtJ);
    if (inv) paramErrors = inv.map((row, i) => Math.sqrt(Math.abs(sig2 * row[i])));
  } catch (_) {}
  return { params: p, paramErrors, rSq, adjRSq, rmse, sse: sseVal, aic, bic,
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
  'exponential-decay': {
    title: 'Exp Decay (Radioactive)',
    params: [
      { key: 'A',    label: 'Amplitude (A)',  value: 95,   min: 1,    max: 500,  step: 1    },
      { key: 'b',    label: 'Decay rate (b)', value: 0.18, min: 0.01, max: 5,    step: 0.01 },
      { key: 'C',    label: 'Offset (C)',      value: 2,    min: -100, max: 200,  step: 0.5  },
      { key: 'noise',label: 'Noise (σ)',       value: 1.5,  min: 0,    max: 30,   step: 0.1  },
      { key: 'N',    label: 'Points (N)',      value: 24,   min: 5,    max: 200,  step: 1    },
      { key: 'xmax', label: 'x max',           value: 20,   min: 1,    max: 200,  step: 1    },
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
      { key: 'noise',label: 'Noise (σ)',      value: 3,    min: 0,    max: 50,   step: 0.5  },
      { key: 'N',    label: 'Points (N)',     value: 40,   min: 5,    max: 200,  step: 1    },
      { key: 'xmin', label: 'x min',          value: -6,   min: -50,  max: 0,    step: 0.5  },
      { key: 'xmax', label: 'x max',          value: 6,    min: 0,    max: 50,   step: 0.5  },
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
      { key: 'noise',label: 'Noise (σ)',        value: 1.5e4,min: 0,    max: 5e5,  step: 1e3  },
      { key: 'N',    label: 'Points (N)',       value: 32,   min: 5,    max: 200,  step: 1    },
      { key: 'xmax', label: 'x max',            value: 48,   min: 5,    max: 200,  step: 1    },
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
      { key: 'Km',   label: 'Km',            value: 12,   min: 0.01, max: 500,  step: 0.5  },
      { key: 'noise',label: 'Noise (σ)',      value: 8,    min: 0,    max: 100,  step: 0.5  },
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
      { key: 'noise', label: 'Noise (σ)',      value: 0.3,  min: 0,     max: 10,   step: 0.05 },
      { key: 'N',     label: 'Points (N)',     value: 60,   min: 5,     max: 300,  step: 1    },
      { key: 'xmax',  label: 'x max',          value: 10,   min: 1,     max: 100,  step: 1    },
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
      { key: 'noise',label: 'Noise (σ)',       value: 0.15, min: 0,    max: 20,   step: 0.05 },
      { key: 'N',    label: 'Points (N)',      value: 18,   min: 3,    max: 200,  step: 1    },
      { key: 'xmax', label: 'x max',           value: 10,   min: 1,    max: 100,  step: 1    },
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
      { key: 'n',    label: 'Hill coeff. (n)', value: 2.5,  min: 0.1,  max: 10,   step: 0.1  },
      { key: 'noise',label: 'Noise (σ)',        value: 6,    min: 0,    max: 100,  step: 1    },
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
      { key: 'noise',label: 'Noise (σ%)',  value: 8,     min: 0,     max: 50,   step: 1     },
      { key: 'N',    label: 'Points (N)',  value: 24,    min: 4,     max: 100,  step: 1     },
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
      { key: 'noise',label: 'Noise (σ)',      value: 4,    min: 0,    max: 50,   step: 0.5  },
      { key: 'N',    label: 'Points (N)',     value: 50,   min: 5,    max: 200,  step: 1    },
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
      { key: 'noise',label: 'Noise (σ)',       value: 0.02, min: 0,    max: 0.2,   step: 0.005},
      { key: 'N',    label: 'Points (N)',      value: 30,   min: 5,    max: 100,   step: 1   },
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
      { key: 'noise',label: 'Noise (σ)',       value: 0.4,    min: 0,    max: 5,    step: 0.05  },
      { key: 'N',    label: 'Points (N)',      value: 22,     min: 5,    max: 100,  step: 1     },
      { key: 'xmax', label: 'x max',           value: 20,     min: 1,    max: 100,  step: 1     },
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
      { key: 'noise',label: 'Noise (σ)',      value: 0.4,  min: 0,     max: 10,   step: 0.05 },
      { key: 'N',    label: 'Points (N)',     value: 60,   min: 10,    max: 300,  step: 1    },
      { key: 'xmax', label: 'x max (periods)',value: 8,    min: 1,     max: 50,   step: 0.5  },
    ],
    generate(p) {
      const xmax = p.xmax * (2 * Math.PI / p.omega);
      const t = linspace(0, xmax, p.N);
      return { name: 'Sinusoidal Signal', x: t, y: noisyGauss(t.map(x => p.A * Math.sin(p.omega * x + p.phi) + p.C), p.noise), xlabel: 'Time (s)', ylabel: 'Amplitude', suggestModel: 'Sine' };
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
  editMode: false,
  selection: { dsId: null, indices: new Set() },
  editHistory: { undo: [], redo: [] },
  editSelectRadius: 0,
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

function applyParsedMeta({ xlabel, ylabel, title }) {
  if (xlabel != null) document.getElementById('plot-xlabel').value = xlabel;
  if (ylabel != null) document.getElementById('plot-ylabel').value = ylabel;
  if (title  != null) document.getElementById('plot-title').value  = title;
}

function importDataset(name, x, y, color) {
  if (!x.length || !y.length) return null;
  const ds = { id: nextId(), name: name || `Dataset ${state.datasets.length + 1}`, x, y, originalY: y.slice(), color: color || nextColor(), visible: true, enabled: true };
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
    legend: (() => {
      const lp = computeAutoLegendPos();
      return {
        font: { size: 10, color: tc.textCol },
        bgcolor: isDark() ? 'rgba(10,22,40,0.82)' : 'rgba(255,255,255,0.82)',
        bordercolor: tc.gridCol, borderwidth: 1,
        x: lp.x, y: lp.y,
        xanchor: lp.x > 0.5 ? 'right' : 'left',
        yanchor: lp.y > 0.5 ? 'top' : 'bottom',
      };
    })(),
    hovermode: 'closest',
    showlegend: true,
    dragmode: state.editMode ? false : 'zoom',
  };
  return Object.assign(base, extra || {});
}

function buildMainTraces() {
  const traces = [];
  for (const ds of state.datasets) {
    if (!ds.visible) continue;
    const dimmed = ds.enabled === false;
    traces.push({
      x: ds.x, y: ds.y,
      mode: 'markers',
      type: 'scatter',
      name: ds.name,
      marker: { color: ds.color, size: 6, opacity: dimmed ? 0.25 : 0.85 },
      opacity: dimmed ? 0.3 : 1,
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
  // Selection overlay in edit mode
  if (state.editMode && state.selection.dsId && state.selection.indices.size) {
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
    const plotCfg = { responsive: true, displaylogo: false, edits: { legendPosition: true }, modeBarButtonsToRemove: ['sendDataToCloud','editInChartStudio'] };
    Plotly.newPlot(mainEl, mainTraces, mainLayout, plotCfg);
    const resTraces = buildResidualTraces();
    const resLayout = baseLayout({
      margin: { l: 56, r: 20, t: 10, b: 36 },
      yaxis: Object.assign(baseLayout().yaxis, { title: { text: 'Residuals', font: { size: 10, color: tc.tickCol } }, zeroline: true }),
      xaxis: Object.assign(baseLayout().xaxis, { title: { text: xlabel, font: { size: 10, color: tc.tickCol } } }),
      showlegend: false,
    });
    Plotly.newPlot(residEl, resTraces, resLayout, { responsive: true, displaylogo: false, modeBarButtonsToRemove: ['sendDataToCloud','editInChartStudio'] });
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
      syncFitDatasetSelect();
      renderDatasetList();
      updatePlots();
    });
  });
  el.querySelectorAll('.ds-delete').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const id = parseInt(btn.dataset.delid);
      state.datasets = state.datasets.filter(d => d.id !== id);
      state.fits = state.fits.filter(f => f.dsId !== id);
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
      updatePlots();
      const active = state.fits.find(f => f.id === state.activeFitId);
      if (active) renderStats(active); else setConsole('Dataset removed.', '');
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
      <button class="ds-delete" data-delid="${fit.id}" title="Remove fit">×</button>
    </div>`).join('');
  el.querySelectorAll('.fit-item').forEach(item => {
    item.addEventListener('click', () => {
      state.activeFitId = parseInt(item.dataset.fitid);
      renderFitList();
      const fit = state.fits.find(f => f.id === state.activeFitId);
      if (fit) { renderParamResults(fit); renderStatsTable(); }
    });
  });
  el.querySelectorAll('.ds-delete').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const id = parseInt(btn.dataset.delid);
      state.fits = state.fits.filter(f => f.id !== id);
      if (state.activeFitId === id) {
        state.activeFitId = state.fits.length ? state.fits[state.fits.length - 1].id : null;
      }
      renderFitList();
      updatePlots();
      const active = state.fits.find(f => f.id === state.activeFitId);
      if (active) renderStats(active); else setConsole('Fit removed.', '');
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

  const rows = state.fits.map(fit => {
    const r = fit.result;
    const isActive = fit.id === state.activeFitId;
    const ds = state.datasets.find(d => d.id === fit.dsId);
    const dsName = ds ? ds.name : '—';
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
      <td>${r ? fmt(r.aic) : '—'}</td>
      <td>${r ? fmt(r.bic) : '—'}</td>
      <td>${r ? r.n : '—'}</td>
      <td class="${statusCls}">${statusText}</td>
    </tr>`;
  }).join('');

  el.innerHTML = msgHtml + `<div class="stats-table-wrap"><table class="stats-table">
    <thead><tr>
      <th></th><th>Fit</th><th>Dataset</th>
      <th>R²</th><th>Adj-R²</th><th>RMSE</th><th>SSE</th><th>AIC</th><th>BIC</th><th>N</th><th>Status</th>
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
   FIT ENGINE — DISPATCH
═══════════════════════════════════════════════════════════ */
function runFit() {
  const model = state.fitConfig.model;
  const dsId  = parseInt(document.getElementById('fit-dataset-select').value);
  const ds    = state.datasets.find(d => d.id === dsId);
  if (!ds) { setConsole('No dataset selected. Load data first.', 'error'); return; }
  if (ds.x.length < 2) { setConsole('Need at least 2 data points.', 'error'); return; }

  const maxIter  = parseInt(document.getElementById('opt-max-iter').value) || 1000;
  const tol      = parseFloat(document.getElementById('opt-tol').value)    || 1e-8;
  const curvePts = parseInt(document.getElementById('opt-curve-pts').value) || 300;
  const algoKey  = document.getElementById('opt-algo').value;
  const nStarts  = parseInt(document.getElementById('opt-n-starts').value)  || 1;

  const SOLVERS = { lm: levenbergMarquardt, gn: gaussNewton, nm: nelderMead, bfgs };
  const solve = SOLVERS[algoKey] || levenbergMarquardt;

  setConsole('Fitting…', '');

  let result, modelFn, paramNames;
  const m = MODELS[model];
  const opts = { maxIter, tol };

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
    result = nStarts > 1
      ? multiStartFit(solve, modelFn, ds.x, ds.y, p0, opts, nStarts)
      : solve(modelFn, ds.x, ds.y, p0, opts);
  } else if (m && m.fn) {
    paramNames = m.params;
    modelFn = m.fn;
    const p0 = state.paramRows.length === paramNames.length
      ? state.paramRows.map(r => r.init)
      : m.autoInit(ds.x, ds.y);
    result = nStarts > 1
      ? multiStartFit(solve, modelFn, ds.x, ds.y, p0, opts, nStarts)
      : solve(modelFn, ds.x, ds.y, p0, opts);
  } else {
    setConsole('Unknown model.', 'error');
    return;
  }

  const fitColor = nextColor();
  const algoNames = { lm: 'LM', gn: 'GN', nm: 'NM', bfgs: 'BFGS' };
  const rSqStr    = isFinite(result.rSq) ? ` (R²=${result.rSq.toFixed(4)})` : '';
  const msTag     = (nStarts > 1 && !m?.analytic) ? `×${nStarts}` : '';
  const fitLabel  = `${model} [${algoNames[algoKey] || algoKey}${msTag}]${rSqStr}`;

  const fitRecord = {
    id: nextId(), dsId, model, algo: algoKey,
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
    </div>`).join('');
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
  let editDragActive = false;
  let editJustDragged = false;
  let editDragHistPushed = false;
  let arrowKeyActive = false;
  let lastMouseX = null, lastMouseY = null;

  // Track mouse position for the radius circle preview
  mainEl.addEventListener('mousemove', e => {
    const rect = mainEl.getBoundingClientRect();
    lastMouseX = e.clientX - rect.left;
    lastMouseY = e.clientY - rect.top;
    if (state.editMode && state.editSelectRadius > 0) drawRadiusOverlay(lastMouseX, lastMouseY);
  });
  mainEl.addEventListener('mouseleave', () => { if (state.editMode) clearRadiusOverlay(); });

  // Scroll wheel changes capture radius
  mainEl.addEventListener('wheel', e => {
    if (!state.editMode) return;
    e.preventDefault();
    const delta = e.deltaY < 0 ? 5 : -5;
    state.editSelectRadius = Math.max(0, Math.min(300, state.editSelectRadius + delta));
    document.getElementById('edit-radius-display').textContent = state.editSelectRadius + ' px';
    syncRadiusCanvas();
    drawRadiusOverlay(lastMouseX, lastMouseY);
  }, { passive: false });

  // Start drag when mousedown with an active selection
  mainEl.addEventListener('mousedown', () => {
    if (!state.editMode || !state.selection.indices.size) return;
    editDragActive = true;
    editJustDragged = false;
    editDragHistPushed = false;
  });

  document.addEventListener('mousemove', e => {
    if (!editDragActive || !state.editMode) return;
    if (e.buttons !== 1) { editDragActive = false; return; }
    const dy = e.movementY;
    if (!dy) return;
    if (!editDragHistPushed) { pushEditHistory(); editDragHistPushed = true; }
    editJustDragged = true;
    nudgeSelection(computeYDataDelta(dy, mainEl));
  });

  document.addEventListener('mouseup', () => {
    if (editDragActive) editDragActive = false;
    setTimeout(() => { editJustDragged = false; }, 80);
  });

  // Click-to-select (and deselect) via Plotly's event
  mainEl.on('plotly_click', function(data) {
    if (!state.editMode) return;
    if (editJustDragged) { editJustDragged = false; return; }
    const shift = data.event && data.event.shiftKey;
    const rect = mainEl.getBoundingClientRect();
    const clickX = data.event.clientX - rect.left;
    const clickY = data.event.clientY - rect.top;

    if (state.editSelectRadius > 0) {
      // Radius-based multi-select
      const result = findPointsInRadius(clickX, clickY, state.editSelectRadius);
      if (!result || !result.indices.size) return;
      const { ds, indices } = result;
      if (shift && state.selection.dsId === ds.id) {
        indices.forEach(i => {
          state.selection.indices.has(i) ? state.selection.indices.delete(i) : state.selection.indices.add(i);
        });
      } else {
        state.selection = { dsId: ds.id, indices };
      }
    } else {
      // Exact click
      const pt = data.points[0];
      if (!pt || pt.data.mode !== 'markers' || pt.data.name === '_sel') return;
      const ds = state.datasets.find(d => d.name === pt.data.name);
      if (!ds) return;
      const idx = pt.pointIndex;
      if (shift && state.selection.dsId === ds.id) {
        // Shift+click: toggle this point
        state.selection.indices.has(idx) ? state.selection.indices.delete(idx) : state.selection.indices.add(idx);
      } else if (state.selection.dsId === ds.id && state.selection.indices.has(idx)) {
        // Click on already-selected point: deselect it
        state.selection.indices.delete(idx);
      } else {
        state.selection = { dsId: ds.id, indices: new Set([idx]) };
      }
    }
    updatePlots();
    syncUndoRedoButtons();
  });

  // Arrow-key nudge (↑↓) + point navigation (←→) + Ctrl+Z/Y
  document.addEventListener('keydown', e => {
    if (e.ctrlKey && e.key === 'z' && state.editMode) { e.preventDefault(); undoEdit(); return; }
    if (e.ctrlKey && (e.key === 'y' || e.key === 'Z') && state.editMode) { e.preventDefault(); redoEdit(); return; }
    if (!state.editMode || !state.selection.indices.size) return;
    const tag = document.activeElement && document.activeElement.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

    // ← → : snap selection to adjacent point (only when exactly 1 point selected)
    if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && state.selection.indices.size === 1) {
      e.preventDefault();
      const ds = state.datasets.find(d => d.id === state.selection.dsId);
      if (!ds || !ds.x.length) return;
      const cur = [...state.selection.indices][0];
      const next = e.key === 'ArrowRight'
        ? Math.min(cur + 1, ds.x.length - 1)
        : Math.max(cur - 1, 0);
      if (next !== cur) {
        state.selection = { dsId: ds.id, indices: new Set([next]) };
        updatePlots();
        syncUndoRedoButtons();
      }
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
  state.datasets = [];
  state.fits = [];
  state.activeDatasetId = null;
  state.activeFitId = null;
  state.paramRows = [];
  state.editHistory = { undo: [], redo: [] };
  state.selection = { dsId: null, indices: new Set() };
  syncFitDatasetSelect();
  renderDatasetList();
  renderFitList();
  updatePlots();
  renderStatsTable();
  syncUndoRedoButtons();
}

function saveCurrentTab() {
  if (!activeTabId) return;
  const tab = tabList.find(t => t.id === activeTabId);
  if (tab) tab.payload = buildSessionPayload();
}

function activateTab(id) {
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

  return {
    version: 2,
    savedAt: new Date().toISOString(),
    datasets: state.datasets,
    fits: state.fits.map(f => ({
      id: f.id, dsId: f.dsId, model: f.model, label: f.label,
      color: f.color, visible: f.visible, paramNames: f.paramNames,
      curvePoints: f.curvePoints, result: f.result,
      customExpr: f.customExpr || null,
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
    },
    optimizerOptions: {
      maxIter:  parseInt(document.getElementById('opt-max-iter').value)  || 1000,
      tol:      parseFloat(document.getElementById('opt-tol').value)     || 1e-8,
      curvePts: parseInt(document.getElementById('opt-curve-pts').value) || 300,
      algo:     document.getElementById('opt-algo').value || 'lm',
      nStarts:  parseInt(document.getElementById('opt-n-starts').value)  || 1,
    },
    activeDatasetId: state.activeDatasetId,
    activeFitId: state.activeFitId,
  };
}

function restoreSessionPayload(payload) {
  state.datasets = (payload.datasets || []).map(d => {
    if (!d.originalY) d.originalY = d.y.slice();  // backfill for older saves
    if (d.enabled == null) d.enabled = true;       // backfill for older saves
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
  state.plotConfig = payload.plotConfig || state.plotConfig;
  state.activeDatasetId = payload.activeDatasetId;
  state.activeFitId = payload.activeFitId;

  // Restore paramRows before syncModelCustomSection so renderParamTable picks them up
  if (payload.paramRows) state.paramRows = payload.paramRows;

  const modelSel = document.getElementById('model-select');
  if (modelSel) { modelSel.value = state.fitConfig.model; syncModelCustomSection(); }
  const eqInput = document.getElementById('custom-eq-input');
  if (eqInput && state.fitConfig.customExpr) { eqInput.value = state.fitConfig.customExpr; parseCustomEquation(state.fitConfig.customExpr); }
  // Reset toggle button states before restoring to prevent state leak across tabs
  ['btn-log-x', 'btn-log-y', 'btn-toggle-residuals'].forEach(id => {
    const b = document.getElementById(id);
    if (b) b.classList.remove('active');
  });
  if (state.plotConfig.logX)          document.getElementById('btn-log-x').classList.add('active');
  if (state.plotConfig.logY)          document.getElementById('btn-log-y').classList.add('active');
  if (state.plotConfig.showResiduals !== false) document.getElementById('btn-toggle-residuals').classList.add('active');
  document.getElementById('residual-plot').classList.toggle('hidden', state.plotConfig.showResiduals === false);

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
  }

  syncFitDatasetSelect();
  renderDatasetList();
  renderFitList();
  updatePlots();

  // Restore panel sizes after plots are initialised, then trigger Plotly resize
  if (payload.panelSizes) {
    const leftPanel  = document.getElementById('panel-left');
    const rightPanel = document.getElementById('panel-right');
    const residualEl = document.getElementById('residual-plot');
    if (payload.panelSizes.left     && leftPanel)  leftPanel.style.width   = payload.panelSizes.left     + 'px';
    if (payload.panelSizes.right    && rightPanel) rightPanel.style.width  = payload.panelSizes.right    + 'px';
    if (payload.panelSizes.residual && residualEl) residualEl.style.height = payload.panelSizes.residual + 'px';
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
  const rhLeft     = document.getElementById('rh-left');
  const rhRight    = document.getElementById('rh-right');
  const rhResidual = document.getElementById('rh-residual');

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
               :                       residualEl.offsetHeight;
    drag = { type, x, y, size };
    handle.classList.add('dragging');
    document.body.style.userSelect = 'none';
    document.body.style.cursor = type === 'residual' ? 'row-resize' : 'col-resize';
    e.preventDefault();
  }

  rhLeft.addEventListener('mousedown',     e => startDrag('left',     rhLeft,     e));
  rhRight.addEventListener('mousedown',    e => startDrag('right',    rhRight,    e));
  rhResidual.addEventListener('mousedown', e => startDrag('residual', rhResidual, e));
  rhLeft.addEventListener('touchstart',     e => startDrag('left',     rhLeft,     e), { passive: false });
  rhRight.addEventListener('touchstart',    e => startDrag('right',    rhRight,    e), { passive: false });
  rhResidual.addEventListener('touchstart', e => startDrag('residual', rhResidual, e), { passive: false });

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
        const parsed = rowsToXY(rows);
        const { x, y } = parsed;
        if (!x.length) { setConsole('Could not parse any X,Y pairs from file.', 'error'); return; }
        applyParsedMeta(parsed);
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
        const parsed = rowsToXY(rows);
        const { x, y } = parsed;
        if (!x.length) { setConsole('Could not parse file.', 'error'); return; }
        applyParsedMeta(parsed);
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

  /* ── Edit mode toggle ─────────────────────────────────── */
  document.getElementById('btn-edit-mode').addEventListener('click', function () {
    state.editMode = !state.editMode;
    this.classList.toggle('active', state.editMode);
    document.querySelector('.app-shell').classList.toggle('edit-mode', state.editMode);
    const ctrl = document.getElementById('edit-mode-controls');
    ctrl.style.display = state.editMode ? 'flex' : 'none';
    const canvas = document.getElementById('edit-radius-canvas');
    if (state.editMode) {
      canvas.style.display = 'block';
      syncRadiusCanvas();
      syncUndoRedoButtons();
      setConsole('Edit mode ON — click to select, scroll to set radius, drag or ↑↓ to move. Ctrl+Z / Ctrl+Y to undo/redo.', '');
    } else {
      state.selection = { dsId: null, indices: new Set() };
      clearRadiusOverlay();
      canvas.style.display = 'none';
    }
    updatePlots();
  });

  /* ── Undo / Redo / Reset buttons ─────────────────────── */
  document.getElementById('btn-edit-undo').addEventListener('click', undoEdit);
  document.getElementById('btn-edit-redo').addEventListener('click', redoEdit);
  document.getElementById('btn-edit-reset').addEventListener('click', resetSelectionToOriginal);

  /* ── Initial state ────────────────────────────────────── */
  document.getElementById('btn-toggle-residuals').classList.add('active');
  syncModelCustomSection();
  initResizablePanels();
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

  // Auto-restore saved session or load example on first visit
  const autoRestore = localStorage.getItem('cfs_autorestore') !== '0';
  document.getElementById('btn-auto-restore').classList.toggle('active', autoRestore);
  const saved = localStorage.getItem('cfs_session');
  if (autoRestore && saved) {
    try { restoreMultiTabPayload(JSON.parse(saved)); return; } catch (_) {}
  }
  loadDefaultExample();
}

init();

})();
