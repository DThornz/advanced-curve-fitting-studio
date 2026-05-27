// Fitting solvers: bounds helpers, Levenberg-Marquardt, polynomial, Gauss-Newton, Nelder-Mead, BFGS, finaliseFit
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

    // Augment diagonal — proper Marquardt scaling: JtJ + λ·diag(|JtJ|)
    const A = JtJ.map((row, a) =>
      row.map((v, b) => a === b ? v + lambda * Math.max(Math.abs(v), 1e-10) : v)
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
      if (stepNorm < tol || Math.abs(curSSE - newSSE) < tol) { converged = true; break; }
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
  const adjRSq = sst < 1e-15 ? 1 : 1 - (1 - rSq) * Math.max(n - 1, 1) / Math.max(n - m, 1);
  const rmse = Math.sqrt(sseVal / Math.max(n - m, 1));
  const LOG2PIE = Math.log(2 * Math.PI) + 1;
  const aic = n * Math.log(Math.max(sseVal / n, 1e-20)) + n * LOG2PIE + 2 * m;
  const bic = n * Math.log(Math.max(sseVal / n, 1e-20)) + n * LOG2PIE + m * Math.log(n);
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
    if (stepNorm < tol || Math.abs(curSSE - newSSE) < tol) { converged = true; break; }
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
  const adjRSq = sst < 1e-15 ? 1 : 1 - (1 - rSq) * Math.max(n - 1, 1) / Math.max(n - m, 1);
  const rmse   = Math.sqrt(sseVal / Math.max(n - m, 1));
  const LOG2PIE = Math.log(2 * Math.PI) + 1;
  const aic    = n * Math.log(Math.max(sseVal / n, 1e-20)) + n * LOG2PIE + 2 * m;
  const bic    = n * Math.log(Math.max(sseVal / n, 1e-20)) + n * LOG2PIE + m * Math.log(n);
  let paramErrors = p.map(() => NaN);
  let covMatrix = null;
  const dof = Math.max(n - m, 1);
  const weights = meta.weights || null;
  const wSSE = weights ? r.reduce((s, ri, i) => s + ri * ri * Math.max(weights[i], 0), 0) : sseVal;
  const sig2Base = wSSE / dof;
  const wrmse = Math.sqrt(Math.max(sig2Base, 0));
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
    const inv = invertMatrix(JtJ);
    if (inv) {
      paramErrors = inv.map((row, i) => Math.sqrt(Math.abs(sig2Base * row[i])));
      covMatrix = inv.map(row => row.map(v => sig2Base * v));
    }
  } catch (_) {}
  return { params: p, paramErrors, covMatrix, dof, rSq, adjRSq, rmse, wrmse, sse: sseVal, aic, bic,
           converged: meta.converged, iter: meta.iter, n, residuals: r };
}
