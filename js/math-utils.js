// Math utility functions: mean, linspace, matrix solvers, statistical helpers, fmt, hexToRgba
function mean(arr) { return arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0; }
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

// Returns live per-point residuals keyed by original dataset index.
// Always reflects the current ds.y (after point edits), not the stale stored result.
function getLiveResidualsWithIdx(fit, ds) {
  const excl = ds.excludedIndices || new Set();
  const pairs = [];
  ds.x.forEach((x, i) => {
    if (excl.has(i)) return;
    const yhat = fitEval(fit, x);
    pairs.push({ origIdx: i, r: isFinite(yhat) ? ds.y[i] - yhat : 0 });
  });
  const nParams = fit.result && fit.result.params ? fit.result.params.length : 0;
  const dof = Math.max(pairs.length - nParams, 1);
  const rmse = pairs.length > 0 ? Math.sqrt(pairs.reduce((s, pair) => s + pair.r * pair.r, 0) / dof) : 0;
  return { pairs, rmse };
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
  const p = precision == null ? (CFS_SETTINGS ? CFS_SETTINGS.displayDecimals : 5) : precision;
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
  if (df <= 200) return 1.980 - (df - 120) * 0.020 / 80;
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

// Abramowitz & Stegun approximation, max error 7.5e-8
function normalCDF(z) {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const poly = t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  const p = 1 - 0.3989422804 * Math.exp(-0.5 * z * z) * poly;
  return z >= 0 ? p : 1 - p;
}

function durbinWatson(residuals) {
  if (!residuals || residuals.length < 4) return null;
  let num = 0, den = 0;
  for (let i = 1; i < residuals.length; i++) num += (residuals[i] - residuals[i - 1]) ** 2;
  for (const e of residuals) den += e * e;
  return den > 0 ? num / den : null;
}

function runsTestP(residuals) {
  if (!residuals || residuals.length < 10) return null;
  const signs = residuals.map(e => (e >= 0 ? 1 : -1));
  const nPos = signs.filter(s => s > 0).length;
  const nNeg = signs.filter(s => s < 0).length;
  if (nPos < 3 || nNeg < 3) return null;
  const n = nPos + nNeg;
  let runs = 1;
  for (let i = 1; i < signs.length; i++) if (signs[i] !== signs[i - 1]) runs++;
  const eR  = 1 + (2 * nPos * nNeg) / n;
  const varR = (2 * nPos * nNeg * (2 * nPos * nNeg - n)) / (n * n * (n - 1));
  if (varR <= 0) return null;
  const z = (runs - eR) / Math.sqrt(varR);
  return 2 * (1 - normalCDF(Math.abs(z)));
}

// Condition number of J estimated as sqrt(λmax/λmin) of parameter correlation matrix.
// Uses power iteration + deflation shift on the correlation matrix derived from covMatrix.
function jacobianConditionNumber(covMatrix) {
  if (!covMatrix || covMatrix.length < 2) return null;
  const m = covMatrix.length;
  const d = covMatrix.map((row, i) => Math.sqrt(Math.abs(row[i])));
  if (d.some(v => !v || !isFinite(v))) return null;
  // Build correlation matrix R; bail if any entry is non-finite
  const R = covMatrix.map((row, i) => row.map((v, j) => v / (d[i] * d[j])));
  if (R.some(row => row.some(v => !isFinite(v)))) return null;
  // Power iteration for dominant eigenvalue
  function powerMax(mat, nIter) {
    let v = Array(m).fill(1 / Math.sqrt(m));
    let lam = 0;
    for (let k = 0; k < nIter; k++) {
      const w  = mat.map(row => row.reduce((s, a, j) => s + a * v[j], 0));
      const norm = Math.sqrt(w.reduce((s, a) => s + a * a, 0));
      if (!norm || !isFinite(norm)) return null;
      const lamNew = v.reduce((s, vj, j) => s + vj * w[j], 0);
      if (Math.abs(lamNew - lam) < 1e-10 * (Math.abs(lam) + 1)) { lam = lamNew; break; }
      v = w.map(a => a / norm);
      lam = lamNew;
    }
    return lam > 0 ? lam : null;
  }
  const lamMax = powerMax(R, 100);
  if (!lamMax) return null;
  // Smallest eigenvalue via shift-invert: lam_min(R) = lamMax − lam_max(lamMax·I − R)
  const Rsh = R.map((row, i) => row.map((v, j) => (i === j ? lamMax : 0) - v));
  const lamShift = powerMax(Rsh, 100);
  if (lamShift == null) return null;
  const lamMin = lamMax - lamShift;
  if (!isFinite(lamMin) || lamMin < 1e-12) return null;
  return Math.sqrt(lamMax / lamMin); // cond(J) = sqrt(cond(J'J)) = sqrt(cond(C))
}

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1,3), 16);
  const g = parseInt(hex.slice(3,5), 16);
  const b = parseInt(hex.slice(5,7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
