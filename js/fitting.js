// Fitting engine: custom equation parsing, auto-init, multi-start, fit dispatch, try-all models, model compare

/* ═══════════════════════════════════════════════════════════
   CUSTOM EQUATION PARSING
═══════════════════════════════════════════════════════════ */
let customCompiled = null;

// Shared set used by parseCustomEquation and the Equation Editor validator
// Extend Math.js with special functions, polyfilling any the bundled build lacks,
// so custom equations using erf/erfc/gamma/lgamma/factorial always evaluate.
function _extendMathFns(m) {
  if (!m || typeof m.import !== 'function') return;
  const erfPoly = z => {                       // Abramowitz & Stegun 7.1.26 (|err| < 1.5e-7)
    const t = 1 / (1 + 0.3275911 * Math.abs(z));
    const p = t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
    return Math.sign(z) * (1 - p * Math.exp(-z * z));
  };
  const lnGamma = z => {                        // Lanczos approximation
    const g = 7, c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028,
      771.32342877765313, -176.61502916214059, 12.507343278686905,
      -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
    if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - lnGamma(1 - z);
    z -= 1; let a = c[0]; const t = z + g + 0.5;
    for (let i = 1; i < g + 2; i++) a += c[i] / (z + i);
    return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(a);
  };
  const erfFn = (typeof m.erf === 'function') ? (z => m.erf(z)) : erfPoly;
  const ext = {};
  // NOTE: 'gamma' is intentionally not polyfilled — it must remain a plain
  // parameter name (Damped-Sine etc.). lgamma covers the special-function need.
  if (typeof m.erf       !== 'function') ext.erf       = erfPoly;
  if (typeof m.erfc      !== 'function') ext.erfc      = z => 1 - erfFn(z);
  if (typeof m.lgamma    !== 'function') ext.lgamma    = lnGamma;
  if (typeof m.factorial !== 'function') ext.factorial = z => Math.exp(lnGamma(z + 1));
  try { if (Object.keys(ext).length) m.import(ext, { override: false, silent: true }); } catch (_) {}
}
if (typeof math !== 'undefined') _extendMathFns(math);

const CUSTOM_EQ_MATH_SYMS = new Set([
  // Trig
  'sin','cos','tan','asin','acos','atan','atan2',
  'cot','sec','csc','acot','asec','acsc',
  // Hyperbolic + inverse
  'sinh','cosh','tanh','coth','sech','csch',
  'asinh','acosh','atanh','acoth','asech','acsch',
  // Common
  'exp','log','log2','log10','sqrt','abs','sign','pow',
  'ceil','floor','round','max','min','mod',
  // Error & special — NOTE: 'gamma' is deliberately NOT included so it stays
  // usable as a free parameter (e.g. Damped-Sine's damping γ); use lgamma instead.
  'erf','erfc','lgamma','factorial','nthRoot','cbrt',
  // Logical
  'and','or','not','xor',
  // Constants / keywords
  'pi','e','true','false','Infinity','NaN',
]);

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
    const mathFns = CUSTOM_EQ_MATH_SYMS;
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
  const curvePts   = Math.max(10, parseInt(document.getElementById('opt-curve-pts').value) || 300);
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
    if (yArr.some(v => v === 0)) setConsole('Warning: 1/y² weighting with y=0 — those points get near-infinite weight. Consider excluding them.', 'warn');
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

  // IRLS Huber: run synchronously with iterative Huber weights
  if (weightMode === 'huber') {
    const errMsg = validateFitInput(xArr, yArr, state.fitConfig.model, null);
    if (errMsg) { setConsole(errMsg, 'error'); return; }
    let modelFn, paramNames2, p02;
    const m2 = MODELS[state.fitConfig.model];
    if (state.fitConfig.model === 'Custom') {
      if (!customCompiled) { setConsole('Parse custom equation first.', 'error'); return; }
      paramNames2 = state.fitConfig.customParams;
      const cExpr = state.fitConfig.customExpr;
      modelFn = (x, params) => {
        const scope = { x };
        paramNames2.forEach((nm, i) => { scope[nm] = params[i]; });
        try { const v = customCompiled.evaluate(scope); return isFinite(v) ? v : NaN; } catch (_) { return NaN; }
      };
      p02 = state.paramRows.length === paramNames2.length ? state.paramRows.map(r => r.init) : paramNames2.map(() => 1);
    } else {
      if (!m2 || !m2.fn) { setConsole('Unknown model.', 'error'); return; }
      paramNames2 = m2.params;
      modelFn = m2.fn;
      p02 = state.paramRows.length === paramNames2.length ? state.paramRows.map(r => r.init) : m2.autoInit(xArr, yArr);
    }
    const algoKey2 = document.getElementById('opt-algo').value;
    const maxIter2 = parseInt(document.getElementById('opt-max-iter').value) || 1000;
    const tol2 = parseFloat(document.getElementById('opt-tol').value) || 1e-8;
    const curvePts2 = Math.max(10, parseInt(document.getElementById('opt-curve-pts').value) || 300);
    const nStarts2 = parseInt(document.getElementById('opt-n-starts').value) || 1;
    const SOLVERS2 = { lm: levenbergMarquardt, gn: gaussNewton, nm: nelderMead, bfgs };
    const solve2 = SOLVERS2[algoKey2] || levenbergMarquardt;
    const paramRows2 = state.paramRows.map(r => ({ init: r.init, min: r.locked ? r.init : r.min, max: r.locked ? r.init : r.max }));
    setConsole('IRLS fitting (Huber)…', '');
    let result2 = solve2(modelFn, xArr, yArr, p02, { maxIter: maxIter2, tol: tol2, paramRows: paramRows2 });
    const IRLS_ITERS = 20, HUBER_C = 1.345;
    for (let iter = 0; iter < IRLS_ITERS; iter++) {
      const resid = result2.residuals || xArr.map((x, i) => yArr[i] - modelFn(x, result2.params));
      const sortedResid = resid.slice().sort((a, b) => a - b);
      const medR = sortedResid[Math.floor(sortedResid.length / 2)];
      const centeredAbs = resid.map(r => Math.abs(r - medR));
      centeredAbs.sort((a, b) => a - b);
      const mad = centeredAbs[Math.floor(centeredAbs.length / 2)];
      const s = mad / 0.6745;
      if (!isFinite(s) || s === 0) break;
      const thresh = HUBER_C * s;
      const huberW = resid.map(r => {
        const ar = Math.abs(r);
        return ar <= thresh ? 1 : thresh / ar;
      });
      const p02b = result2.params.slice();
      result2 = solve2(modelFn, xArr, yArr, p02b, { maxIter: maxIter2, tol: tol2, weights: huberW, paramRows: paramRows2 });
    }
    _finaliseFitRecord({ result: result2, modelFn, paramNames: paramNames2, model: state.fitConfig.model, algoKey: algoKey2, dsId: parseInt(document.getElementById('fit-dataset-select').value), ds: state.datasets.find(d => d.id === parseInt(document.getElementById('fit-dataset-select').value)), excluded, weightMode: 'huber', nStarts: nStarts2, curvePts: curvePts2, sseHistory: null });
    return;
  }

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

  // Validate and apply parameter bounds — use local lo/hi for locked params to avoid mutating state
  for (let i = 0; i < state.paramRows.length; i++) {
    const row = state.paramRows[i];
    const lo = row.locked ? row.init : row.min;
    const hi = row.locked ? row.init : row.max;
    if (row.locked) {
      p0[i] = row.init;
    }
    if (lo > -1e9 && hi < 1e9 && lo > hi && !row.locked) {
      setConsole(`Bound error: min > max for parameter "${row.name}".`, 'error'); return;
    }
    if (lo > -1e9 && p0[i] < lo) p0[i] = lo;
    if (hi < 1e9  && p0[i] > hi) p0[i] = hi;
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
    _runFitSync({ model, dsId, ds, excluded, xArr, yArr, weights, algoKey, nStarts, maxIter, tol, curvePts, weightMode, paramNames, p0, paramRows: state.paramRows.map(r => ({ init: r.init, min: r.locked ? r.init : r.min, max: r.locked ? r.init : r.max })) });
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

      _finaliseFitRecord({ result, modelFn, paramNames, model, algoKey, dsId, ds, excluded, weightMode, nStarts, curvePts, sseHistory, paramRows: state.paramRows });
    }
  };

  worker.onerror = (e) => {
    state.currentWorker = null;
    setFitting(false);
    setConsole('Worker error: ' + (e.message || 'unknown'), 'error');
  };

  const paramRows = state.paramRows.map(r => ({ init: r.init, min: r.locked ? r.init : r.min, max: r.locked ? r.init : r.max }));
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
  _finaliseFitRecord({ result, modelFn, paramNames, model, algoKey, dsId, ds, excluded, weightMode, nStarts, curvePts, sseHistory: null, paramRows });
}

function _finaliseFitRecord({ result, modelFn, paramNames, model, algoKey, dsId, ds, excluded, weightMode, nStarts, curvePts, sseHistory, paramRows: capturedRows, defer }) {
  if (!state.datasets.find(d => d.id === dsId)) { setConsole('Dataset was removed during fitting.', 'warn'); return; }
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

  const rows = capturedRows || state.paramRows;
  const fitBounds = rows && rows.length ? {
    lo: rows.map(r => (r && typeof r.min === 'number' && r.min > -1e9) ? r.min : null),
    hi: rows.map(r => (r && typeof r.max === 'number' && r.max < 1e9) ? r.max : null),
  } : null;

  const fitRecord = {
    id: nextId(), dsId, model, algo: algoKey,
    label: fitLabel, color: fitColor,
    result, fn: modelFn, visible: true,
    paramNames, curvePoints: curvePts, sseHistory,
    bounds: fitBounds, notes: '',
  };
  state.fits.push(fitRecord);
  state.activeFitId = fitRecord.id;

  if (defer) return fitRecord;   // batch caller refreshes UI once at the end

  renderFitList();
  renderParamResults(fitRecord);
  renderStats(fitRecord);
  updatePlots();
  return fitRecord;
}

/* ═══════════════════════════════════════════════════════════
   BATCH FIT — fit the selected model to every enabled dataset
═══════════════════════════════════════════════════════════ */
function runFitAllDatasets() {
  const model = state.fitConfig.model;
  const targets = state.datasets.filter(d => d.enabled !== false);
  if (!targets.length) { setConsole('No enabled datasets to fit.', 'error'); return; }

  const m          = MODELS[model];
  const maxIter    = parseInt(document.getElementById('opt-max-iter').value) || 500;
  const tol        = parseFloat(document.getElementById('opt-tol').value)    || 1e-8;
  const curvePts   = Math.max(10, parseInt(document.getElementById('opt-curve-pts').value) || 300);
  const algoKey    = document.getElementById('opt-algo').value;
  const nStarts    = parseInt(document.getElementById('opt-n-starts').value)  || 1;
  let   weightMode = document.getElementById('opt-weights').value;
  if (weightMode === 'huber') weightMode = 'none';   // IRLS not run in batch — fall back to OLS

  // Resolve the model function + parameter scaffolding once.
  let isCustom = false;
  if (model === 'Custom') {
    if (!customCompiled) { setConsole('Parse the custom equation first.', 'error'); return; }
    if (!state.fitConfig.customParams.length) { setConsole('No free parameters in custom equation.', 'error'); return; }
    isCustom = true;
  } else if (!m || (!m.fn && !m.analytic)) {
    setConsole('Unknown model.', 'error'); return;
  }

  const SOLVERS = { lm: levenbergMarquardt, gn: gaussNewton, nm: nelderMead, bfgs };
  const solve = SOLVERS[algoKey] || levenbergMarquardt;
  const customParams = state.fitConfig.customParams;
  const customModelFn = isCustom ? (x, params) => {
    const scope = { x };
    customParams.forEach((nm, i) => { scope[nm] = params[i]; });
    try { const v = customCompiled.evaluate(scope); return isFinite(v) ? v : NaN; } catch (_) { return NaN; }
  } : null;

  if (state.currentWorker) { state.currentWorker.terminate(); state.currentWorker = null; }
  state.sweepParams = null;

  let ok = 0; const skipped = [];
  for (const ds of targets) {
    const excluded = ds.excludedIndices || new Set();
    const xArr = ds.x.filter((_, i) => !excluded.has(i));
    const yArr = ds.y.filter((_, i) => !excluded.has(i));

    // Per-dataset weights
    let weights = null;
    if (weightMode === '1/y2')      weights = yArr.map(y => 1 / Math.max(y * y, 1e-20));
    else if (weightMode === '1/y')  weights = yArr.map(y => 1 / Math.max(Math.abs(y), 1e-10));
    else if (weightMode === 'sigma' && ds.sigY) {
      const sigArr = ds.sigY.filter((_, i) => !excluded.has(i));
      weights = sigArr.map(s => (isFinite(s) && s > 0) ? 1 / (s * s) : 1e-40);
    }

    try {
      let result, modelFn, paramNames;
      if (m && m.analytic) {
        const err = validateFitInput(xArr, yArr, model, null);
        if (err) { skipped.push(`${ds.name}: ${err}`); continue; }
        result = fitPolynomialAnalytic(m.degree, xArr, yArr);
        modelFn = (x, p) => p.reduce((s, c, j) => s + c * Math.pow(x, m.degree - j), 0);
        paramNames = m.params;
      } else {
        paramNames = isCustom ? customParams : m.params;
        modelFn = isCustom ? customModelFn : m.fn;
        const p0 = isCustom
          ? (state.paramRows.length === paramNames.length ? state.paramRows.map(r => r.init) : paramNames.map(() => 1))
          : m.autoInit(xArr, yArr);
        const err = validateFitInput(xArr, yArr, model, p0);
        if (err) { skipped.push(`${ds.name}: ${err}`); continue; }
        const opts = { maxIter, tol, weights };
        result = nStarts > 1
          ? multiStartFit(solve, modelFn, xArr, yArr, p0, opts, nStarts)
          : solve(modelFn, xArr, yArr, p0, opts);
      }
      _finaliseFitRecord({ result, modelFn, paramNames, model, algoKey, dsId: ds.id, ds, excluded, weightMode, nStarts, curvePts, sseHistory: null, paramRows: null, defer: true });
      ok++;
    } catch (e) {
      skipped.push(`${ds.name}: ${e.message || 'error'}`);
    }
  }

  renderFitList();
  const active = state.fits.find(f => f.id === state.activeFitId);
  if (active) { renderParamResults(active); renderStats(active); }
  updatePlots();
  const skipMsg = skipped.length ? ` · ${skipped.length} skipped (${skipped[0]}${skipped.length > 1 ? ', …' : ''})` : '';
  setConsole(`Batch fit: ${ok}/${targets.length} dataset${targets.length === 1 ? '' : 's'} fit with ${model}${skipMsg}.`, ok ? '' : 'warn');
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
