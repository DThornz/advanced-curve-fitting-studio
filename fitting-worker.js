'use strict';
importScripts('https://cdnjs.cloudflare.com/ajax/libs/mathjs/12.4.0/math.min.js');

/* ── Math utilities ──────────────────────────────────────── */
function mean(arr) { return arr.reduce((s, v) => s + v, 0) / arr.length; }

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
    for (let j = col; j <= n; j++) M[col][j] /= pivot;
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

/* ── Shared finalisation ─────────────────────────────────── */
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
      J_cols.push(r1.map((v, i) => {
        const dri = (v - r[i]) / h;
        return weights ? dri * Math.sqrt(Math.max(weights[i], 0)) : dri;
      }));
    }
    const JtJ = Array.from({ length: m }, (_, a) =>
      Array.from({ length: m }, (_, b) => J_cols[a].reduce((s, _, i) => s + J_cols[a][i] * J_cols[b][i], 0)));
    const wSSE = weights ? r.reduce((s, ri, i) => s + ri * ri * Math.max(weights[i], 0), 0) : sseVal;
    const sig2 = wSSE / dof;
    const inv = invertMatrix(JtJ);
    if (inv) {
      paramErrors = inv.map((row, i) => Math.sqrt(Math.abs(sig2 * row[i])));
      covMatrix = inv.map(row => row.map(v => sig2 * v));
    }
  } catch (_) {}
  return {
    params: p, paramErrors, covMatrix, dof,
    rSq, adjRSq, rmse, sse: sseVal, aic, bic,
    converged: meta.converged, iter: meta.iter, n, residuals: r,
    finalLambda: meta.finalLambda ?? null,
    gradNorm:    meta.gradNorm    ?? null,
  };
}

/* ── Levenberg-Marquardt ─────────────────────────────────── */
function levenbergMarquardt(fn, xArr, yArr, p0, opts) {
  opts = opts || {};
  const maxIter = opts.maxIter || 1000;
  const tol     = opts.tol != null ? parseFloat(opts.tol) || 1e-8 : 1e-8;
  const EPS     = 1e-7;
  const n = xArr.length, m = p0.length;
  let p = p0.map(Number), lambda = 1e-2, converged = false, iter = 0;
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
    return cols;
  }

  for (iter = 0; iter < maxIter; iter++) {
    const r = evalResiduals(p);
    const curSSE = sse(r);
    if (!isFinite(curSSE)) break;
    if (opts.onProgress) opts.onProgress(iter, curSSE);
    const J = jacobian(p, r);
    const JtJ = Array.from({ length: m }, (_, a) =>
      Array.from({ length: m }, (_, b) => J[a].reduce((s, _, i) => s + J[a][i] * J[b][i], 0)));
    const beta = J.map(col => col.reduce((s, v, i) => s - v * r[i], 0));
    const A = JtJ.map((row, a) => row.map((v, b) => a === b ? v * (1 + lambda) + 1e-10 : v));
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
  return finaliseFit(fn, xArr, yArr, p, { converged, iter, weights: opts.weights, finalLambda: lambda });
}

/* ── Gauss-Newton ────────────────────────────────────────── */
function gaussNewton(fn, xArr, yArr, p0, opts) {
  opts = opts || {};
  const maxIter = opts.maxIter || 1000;
  const tol     = opts.tol != null ? parseFloat(opts.tol) || 1e-8 : 1e-8;
  const EPS = 1e-7;
  const n = xArr.length, m = p0.length;
  let p = p0.map(Number), converged = false, iter = 0;
  const sqrtW = opts.weights ? opts.weights.map(w => Math.sqrt(Math.max(w, 0))) : null;
  function evalR(params) {
    return xArr.map((x, i) => {
      const v = fn(x, params);
      const r = isFinite(v) ? yArr[i] - v : 0;
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
      const r1 = evalR(pp);
      cols.push(r1.map((v, i) => (v - r0[i]) / h));
    }
    return cols;
  }
  for (iter = 0; iter < maxIter; iter++) {
    const r = evalR(p);
    const curSSE = sse(r);
    if (!isFinite(curSSE)) break;
    if (opts.onProgress) opts.onProgress(iter, curSSE);
    const J = jacobian(p, r);
    const JtJ = Array.from({ length: m }, (_, a) =>
      Array.from({ length: m }, (_, b) => J[a].reduce((s, _, i) => s + J[a][i] * J[b][i], 0)));
    const beta = J.map(col => col.reduce((s, v, i) => s - v * r[i], 0));
    const A = JtJ.map((row, a) => row.map((v, b) => a === b ? v + 1e-10 : v));
    let delta;
    try { delta = solveLinear(A, beta); } catch (_) { break; }
    if (!delta.every(isFinite)) break;
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
  return finaliseFit(fn, xArr, yArr, p, { converged, iter, weights: opts.weights });
}

/* ── Nelder-Mead Simplex ─────────────────────────────────── */
function nelderMead(fn, xArr, yArr, p0, opts) {
  opts = opts || {};
  const maxIter = opts.maxIter || 2000;
  const tol     = opts.tol != null ? parseFloat(opts.tol) || 1e-8 : 1e-8;
  const n = xArr.length, m = p0.length;
  function obj(params) {
    let s = 0;
    for (let i = 0; i < n; i++) {
      const v = fn(xArr[i], params);
      if (isFinite(v)) s += (yArr[i] - v) ** 2 * (opts.weights ? Math.max(opts.weights[i], 0) : 1);
    }
    return isFinite(s) ? s : 1e30;
  }
  let simplex = [p0.slice()];
  for (let j = 0; j < m; j++) {
    const v = p0.slice();
    v[j] += Math.abs(v[j]) > 1e-8 ? 0.05 * Math.abs(v[j]) : 0.05;
    simplex.push(v);
  }
  let fval = simplex.map(obj);
  let converged = false, iter = 0;
  for (iter = 0; iter < maxIter; iter++) {
    const ord = Array.from({ length: m + 1 }, (_, i) => i).sort((a, b) => fval[a] - fval[b]);
    simplex = ord.map(i => simplex[i]);
    fval    = ord.map(i => fval[i]);
    if (opts.onProgress) opts.onProgress(iter, fval[0]);
    const spread = Math.sqrt(simplex.slice(1).reduce((s, v) =>
      s + v.reduce((ss, vi, j) => ss + (vi - simplex[0][j]) ** 2, 0), 0) / m);
    if (spread < tol) { converged = true; break; }
    const c = Array(m).fill(0);
    for (let i = 0; i < m; i++) for (let j = 0; j < m; j++) c[j] += simplex[i][j] / m;
    const xr = c.map((ci, j) => ci + (ci - simplex[m][j]));
    const fr = obj(xr);
    if (fr < fval[0]) {
      const xe = c.map((ci, j) => ci + 2 * (xr[j] - ci));
      const fe = obj(xe);
      simplex[m] = fe < fr ? xe : xr;
      fval[m]    = fe < fr ? fe : fr;
    } else if (fr < fval[m - 1]) {
      simplex[m] = xr; fval[m] = fr;
    } else {
      const inside = fr >= fval[m];
      const xc = c.map((ci, j) => ci + 0.5 * ((inside ? simplex[m][j] : xr[j]) - ci));
      const fc = obj(xc);
      if (fc < (inside ? fval[m] : fr)) { simplex[m] = xc; fval[m] = fc; }
      else {
        for (let i = 1; i <= m; i++) {
          simplex[i] = simplex[0].map((s0, j) => s0 + 0.5 * (simplex[i][j] - s0));
          fval[i]    = obj(simplex[i]);
        }
      }
    }
  }
  return finaliseFit(fn, xArr, yArr, simplex[0], { converged, iter, weights: opts.weights });
}

/* ── BFGS ────────────────────────────────────────────────── */
function bfgs(fn, xArr, yArr, p0, opts) {
  opts = opts || {};
  const maxIter = opts.maxIter || 1000;
  const tol     = opts.tol != null ? parseFloat(opts.tol) || 1e-8 : 1e-8;
  const EPS = 1e-6;
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
  let H = Array.from({ length: m }, (_, i) => Array.from({ length: m }, (_, j) => i === j ? 1 : 0));
  let p = p0.map(Number), g = grad(p), converged = false, iter = 0;
  for (iter = 0; iter < maxIter; iter++) {
    const gNorm = Math.sqrt(g.reduce((s, v) => s + v * v, 0));
    if (gNorm < tol) { converged = true; break; }
    const f0 = obj(p);
    if (opts.onProgress) opts.onProgress(iter, f0);
    const d = Array(m).fill(0).map((_, i) => -H[i].reduce((s, hij, j) => s + hij * g[j], 0));
    const dg = d.reduce((s, di, i) => s + di * g[i], 0);
    if (dg >= 0) {
      H = Array.from({ length: m }, (_, i) => Array.from({ length: m }, (_, j) => i === j ? 1 : 0));
      continue;
    }
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
        hij - rho * (Hy[i] * s[j] + s[i] * Hy[j]) + rho * (rho * yHy + 1) * s[i] * s[j]));
    }
    p = pNew; g = gNew;
    const stepNorm = Math.sqrt(s.reduce((acc, v) => acc + v * v, 0));
    if (stepNorm < tol) { converged = true; break; }
  }
  const gNormFinal = Math.sqrt(g.reduce((s, v) => s + v * v, 0));
  return finaliseFit(fn, xArr, yArr, p, { converged, iter, weights: opts.weights, gradNorm: gNormFinal });
}

/* ── Analytic polynomial ─────────────────────────────────── */
function fitPolynomialAnalytic(degree, xArr, yArr) {
  const n = xArr.length, m = degree + 1;
  const V = xArr.map(x => Array.from({ length: m }, (_, j) => Math.pow(x, degree - j)));
  const VtV = Array.from({ length: m }, (_, a) =>
    Array.from({ length: m }, (_, b) => V.reduce((s, row) => s + row[a] * row[b], 0)));
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
  let paramErrors = coeffs.map(() => NaN), covMatrix = null;
  try {
    const sig2 = sseVal / dof;
    const inv = invertMatrix(VtV);
    if (inv) {
      paramErrors = inv.map((row, i) => Math.sqrt(Math.abs(sig2 * row[i])));
      covMatrix = inv.map(row => row.map(v => sig2 * v));
    }
  } catch (_) {}
  return { params: coeffs, paramErrors, covMatrix, dof, rSq, adjRSq, rmse,
           sse: sseVal, aic, bic, converged: true, iter: 0, n, residuals,
           finalLambda: null, gradNorm: null };
}

/* ── Multi-start wrapper ─────────────────────────────────── */
function multiStartFit(solve, modelFn, xArr, yArr, p0, opts, nStarts) {
  const pilotMax = Math.max(150, Math.ceil(opts.maxIter / 4));
  const pilotOpts = { ...opts, maxIter: pilotMax, onProgress: null };
  function quickSSE(params) {
    let s = 0;
    for (let i = 0; i < xArr.length; i++) {
      const v = modelFn(xArr[i], params);
      if (isFinite(v)) s += (yArr[i] - v) ** 2;
    }
    return isFinite(s) ? s : Infinity;
  }
  let best = solve(modelFn, xArr, yArr, p0, pilotOpts);
  const paramRows = opts.paramRows || [];
  for (let s = 1; s < nStarts; s++) {
    const pPerturb = p0.map((v, i) => {
      const row = paramRows[i];
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
    if (opts.onProgress) opts.onProgress(s * pilotMax, best.sse);
  }
  // Offset polish iteration numbers so they follow the pilot summaries on the
  // x-axis rather than restarting at 1 — keeps the convergence chart monotonic.
  const polishOffset = (nStarts - 1) * pilotMax;
  const polishProgress = opts.onProgress
    ? (iter, sse) => opts.onProgress(polishOffset + iter, sse)
    : null;
  const polished = solve(modelFn, xArr, yArr, best.params, { ...opts, onProgress: polishProgress });
  return polished.sse <= best.sse ? polished : best;
}

/* ── Model function table ────────────────────────────────── */
const MODEL_FNS = {
  'Linear':           (x, [a, b])            => a * x + b,
  'Power':            (x, [a, b])            => a * Math.pow(Math.abs(x) + 1e-12, b),
  'Exponential':      (x, [a, b])            => a * Math.exp(b * x),
  'Exp-Decay-Offset': (x, [a, b, c])         => a * Math.exp(-b * x) + c,
  'Logistic':         (x, [L, k, x0])        => L / (1 + Math.exp(-k * (x - x0))),
  'Gaussian':         (x, [A, mu, sig, C])   => A * Math.exp(-0.5 * ((x - mu) / (sig || 1e-10)) ** 2) + C,
  'Lorentzian':       (x, [A, x0, g, C])     => A * g * g / ((x - x0) ** 2 + g * g) + C,
  'Michaelis-Menten': (x, [Vm, Km])          => Vm * x / ((Km || 1e-10) + x),
  'Hill':             (x, [Vm, Kd, n])       => Vm * Math.pow(x, n) / (Math.pow(Math.abs(Kd), n) + Math.pow(x, n)),
  'Sine':             (x, [A, w, phi, C])    => A * Math.sin(w * x + phi) + C,
  'Damped-Sine':      (x, [A, g, w, phi, C]) => A * Math.exp(-g * x) * Math.sin(w * x + phi) + C,
  'Weibull':          (x, [lam, k])          => 1 - Math.exp(-Math.pow(Math.max(x, 1e-12) / (lam || 1e-10), k)),
};

const MODEL_DEGREES = {
  'Polynomial-2': 2, 'Polynomial-3': 3, 'Polynomial-4': 4,
  'Polynomial-5': 5, 'Polynomial-6': 6,
};

/* ── Message handler ─────────────────────────────────────── */
self.onmessage = function(e) {
  const { jobId, modelKey, customExpr, paramNames, p0, x, y, opts } = e.data;

  try {
    let result, modelFn;
    const sseHistory = [];

    if (MODEL_DEGREES[modelKey] != null) {
      result = fitPolynomialAnalytic(MODEL_DEGREES[modelKey], x, y);
      self.postMessage({ type: 'result', jobId, result, sseHistory });
      return;
    }

    if (modelKey === 'Custom') {
      const compiled = math.compile(customExpr);
      modelFn = (xv, params) => {
        const scope = { x: xv };
        (paramNames || []).forEach((name, i) => { scope[name] = params[i]; });
        try { const v = compiled.evaluate(scope); return isFinite(v) ? v : NaN; } catch (_) { return NaN; }
      };
    } else {
      modelFn = MODEL_FNS[modelKey];
      if (!modelFn) throw new Error('Unknown model: ' + modelKey);
    }

    const SOLVERS = { lm: levenbergMarquardt, gn: gaussNewton, nm: nelderMead, bfgs };
    const solve = SOLVERS[opts.algo] || levenbergMarquardt;

    let lastProgressIter = -1;
    const onProgress = (iter, sse) => {
      sseHistory.push([iter, sse]);
      if (iter - lastProgressIter >= 20) {
        lastProgressIter = iter;
        self.postMessage({ type: 'progress', jobId, iter, sse });
      }
    };

    const fitOpts = { ...opts, onProgress };
    result = opts.nStarts > 1
      ? multiStartFit(solve, modelFn, x, y, p0, fitOpts, opts.nStarts)
      : solve(modelFn, x, y, p0, fitOpts);

    self.postMessage({ type: 'result', jobId, result, sseHistory });

  } catch (err) {
    self.postMessage({ type: 'error', jobId, message: err.message });
  }
};
