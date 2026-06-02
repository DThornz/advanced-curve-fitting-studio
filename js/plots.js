// Plot engine: theme colors, layout builders, trace builders, updatePlots, fitEval, predict/solve functions
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
      else if (!isX && state.plotConfig.axisRangeMode === 'data') {
        // Clamp Y-axis to data extent only, ignoring extrapolated fit curve values
        const allY = state.datasets.filter(d => d.enabled !== false).flatMap(d => d.y.filter(isFinite));
        if (allY.length) {
          const dMin = Math.min(...allY), dMax = Math.max(...allY);
          const pad = (dMax - dMin) * 0.05 || 1;
          out.range = [dMin - pad, dMax + pad]; out.autorange = false;
        }
      }
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

function computePIBands(fit, xs) {
  const { covMatrix, dof, params, rmse, wrmse } = fit.result;
  if (!covMatrix || dof <= 0 || rmse == null) return null;
  const m = params.length;
  const tCrit = tCritical95(dof);
  const effectiveRmse = wrmse != null ? wrmse : rmse;
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
    const hw = tCrit * Math.sqrt(variance + effectiveRmse * effectiveRmse);
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
    if (state.plotConfig.showPI && fit.fn) {
      const piBands = computePIBands(fit, xs);
      if (piBands) {
        const piColor = hexToRgba(fit.color || ds.color, 0.07);
        traces.push({
          x: [...xs, ...xs.slice().reverse()],
          y: [...piBands.upper, ...piBands.lower.slice().reverse()],
          fill: 'toself', fillcolor: piColor,
          line: { color: 'transparent' }, mode: 'none', type: 'scatter',
          showlegend: false, hoverinfo: 'skip', name: '_pi_' + fit.id,
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
      const nPar = fit.result && fit.result.params ? fit.result.params.length : 0;
      const liveRmse = Math.sqrt(liveRes.reduce((s, e) => s + e.r * e.r, 0) / Math.max(liveRes.length - nPar, 1));
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
    let xRes, residualsRaw, rmseForScale;
    if (fit.fn) {
      const live = getLiveResidualsWithIdx(fit, ds);
      xRes = live.pairs.map(p => ds.x[p.origIdx]);
      residualsRaw = live.pairs.map(p => p.r);
      rmseForScale = live.rmse;
    } else {
      const excl = ds.excludedIndices || new Set();
      xRes = ds.x.filter((_, i) => !excl.has(i));
      residualsRaw = fit.result.residuals || [];
      rmseForScale = fit.result.rmse;
    }
    const scale = normalize && rmseForScale > 0 ? 1 / rmseForScale : 1;
    const residuals = residualsRaw.map(v => v * scale);
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
  const sigma = (fit.result && fit.result.rmse) ? fit.result.rmse :
    Math.sqrt(sorted.reduce((s, r) => s + r * r, 0) / Math.max(n - 1, 1));
  const stdRes = sorted.map(r => r / (sigma || 1));
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
