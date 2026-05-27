// Pre-processing helpers: undo/redo, smoothing algorithms, FFT filtering, data table, renderDatasetList

/* ═══════════════════════════════════════════════════════════
   UI RENDERING
═══════════════════════════════════════════════════════════ */

/* ─── Pre-Process helpers ────────────────────────────────── */
function _ppPushUndo(ds) {
  state.editHistory.undo.push({ dsId: ds.id, y: ds.y.slice(), excl: new Set(ds.excludedIndices) });
  if (state.editHistory.undo.length > 100) state.editHistory.undo.shift();
  state.editHistory.redo = [];
  syncUndoRedoButtons();
}

function _solveLU(A, b) {
  const n = A.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let maxRow = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(M[row][col]) > Math.abs(M[maxRow][col])) maxRow = row;
    }
    [M[col], M[maxRow]] = [M[maxRow], M[col]];
    if (Math.abs(M[col][col]) < 1e-14) return null;
    for (let row = col + 1; row < n; row++) {
      const f = M[row][col] / M[col][col];
      for (let j = col; j <= n; j++) M[row][j] -= f * M[col][j];
    }
  }
  const x = new Array(n).fill(0);
  for (let row = n - 1; row >= 0; row--) {
    x[row] = M[row][n];
    for (let j = row + 1; j < n; j++) x[row] -= M[row][j] * x[j];
    x[row] /= M[row][row];
  }
  return x;
}

function applySmoothing(method, winSize, sigma, polyOrd) {
  const ds = state.datasets.find(d => d.id === state.activeDatasetId);
  if (!ds) { setConsole('No active dataset.', 'warn'); return; }
  if (ds.y.length < 3) { setConsole('Need at least 3 points to smooth.', 'warn'); return; }
  const w = Math.max(3, winSize % 2 === 0 ? winSize + 1 : winSize);
  const excl = ds.excludedIndices || new Set();
  _ppPushUndo(ds);
  const fns = { movavg: _smMovAvg, gaussian: _smGaussian, median: _smMedian, savgol: _smSavGol };
  ds.y = (fns[method] || _smMovAvg)(ds.y, excl, w, sigma, polyOrd);
  updatePlots();
  const labels = { movavg: 'Moving Average', gaussian: 'Gaussian', median: 'Median', savgol: 'Savitzky-Golay' };
  setConsole(`Applied ${labels[method] || method} (window=${w}) to "${ds.name}".`, '');
}

function _smMovAvg(y, excl, w) {
  const n = y.length, h = w >> 1;
  return y.map((v, i) => {
    if (excl.has(i)) return v;
    let sum = 0, cnt = 0;
    for (let j = Math.max(0, i - h); j <= Math.min(n - 1, i + h); j++) {
      if (!excl.has(j)) { sum += y[j]; cnt++; }
    }
    return cnt > 0 ? sum / cnt : v;
  });
}

function _smGaussian(y, excl, w, sigma) {
  const n = y.length, h = w >> 1, sig = Math.max(sigma, 0.1);
  return y.map((v, i) => {
    if (excl.has(i)) return v;
    let sum = 0, wsum = 0;
    for (let j = Math.max(0, i - h); j <= Math.min(n - 1, i + h); j++) {
      if (!excl.has(j)) {
        const wt = Math.exp(-0.5 * ((j - i) / sig) ** 2);
        sum += y[j] * wt; wsum += wt;
      }
    }
    return wsum > 0 ? sum / wsum : v;
  });
}

function _smMedian(y, excl, w) {
  const n = y.length, h = w >> 1;
  return y.map((v, i) => {
    if (excl.has(i)) return v;
    const vals = [];
    for (let j = Math.max(0, i - h); j <= Math.min(n - 1, i + h); j++) {
      if (!excl.has(j)) vals.push(y[j]);
    }
    if (!vals.length) return v;
    vals.sort((a, b) => a - b);
    const m = vals.length >> 1;
    return vals.length & 1 ? vals[m] : (vals[m - 1] + vals[m]) / 2;
  });
}

function _smSavGol(y, excl, w, _sig, polyOrd) {
  const n = y.length, h = w >> 1, result = y.slice();
  for (let i = 0; i < n; i++) {
    if (excl.has(i)) continue;
    const xi = [], yi = [];
    for (let j = Math.max(0, i - h); j <= Math.min(n - 1, i + h); j++) {
      if (!excl.has(j)) { xi.push(j - i); yi.push(y[j]); }
    }
    const deg = Math.min(polyOrd, xi.length - 1);
    if (xi.length < 2 || deg < 1) continue;
    const m = xi.length, d = deg + 1;
    const ATA = Array.from({ length: d }, () => new Array(d).fill(0));
    const ATy = new Array(d).fill(0);
    for (let r = 0; r < m; r++) {
      const row = Array.from({ length: d }, (_, k) => Math.pow(xi[r], k));
      for (let a = 0; a < d; a++) {
        ATy[a] += row[a] * yi[r];
        for (let b = 0; b < d; b++) ATA[a][b] += row[a] * row[b];
      }
    }
    const c = _solveLU(ATA, ATy);
    if (c) result[i] = c[0];
  }
  return result;
}

/* — FFT-based filtering — */
function _nextPow2(n) { let p = 1; while (p < n) p <<= 1; return p; }

function _fftInPlace(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = -2 * Math.PI / len;
    const wRe = Math.cos(ang), wIm = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let j = 0; j < (len >> 1); j++) {
        const ur = re[i+j], ui = im[i+j];
        const vr = re[i+j+(len>>1)]*cr - im[i+j+(len>>1)]*ci;
        const vi = re[i+j+(len>>1)]*ci + im[i+j+(len>>1)]*cr;
        re[i+j] = ur+vr; im[i+j] = ui+vi;
        re[i+j+(len>>1)] = ur-vr; im[i+j+(len>>1)] = ui-vi;
        const nr = cr*wRe - ci*wIm; ci = cr*wIm + ci*wRe; cr = nr;
      }
    }
  }
}

function _ifftInPlace(re, im) {
  for (let i = 0; i < im.length; i++) im[i] = -im[i];
  _fftInPlace(re, im);
  const n = re.length;
  for (let i = 0; i < n; i++) { re[i] /= n; im[i] = -im[i] / n; }
}

let _ppSpecView = 'spectrum';

function _detectSpectrumPeaks(freqPct, yData, useDb) {
  const n = freqPct.length;
  if (n < 5) return [];
  // Noise floor = median of non-DC bins
  const vals = yData.slice(1).slice().sort((a, b) => a - b);
  const floor = vals[Math.floor(vals.length * 0.5)];
  const thr   = useDb ? floor + 10 : floor * 5;
  const peaks = [];
  for (let i = 2; i < n - 1; i++) {
    if (yData[i] > yData[i - 1] && yData[i] > yData[i + 1] && yData[i] > thr) {
      peaks.push({ freq: freqPct[i], val: yData[i] });
    }
  }
  return peaks.sort((a, b) => b.val - a.val).slice(0, 5);
}

function _computeSTFT(y, useDb) {
  const n      = y.length;
  const winLen = Math.max(8, Math.min(Math.floor(n / 4), 64));
  const hop    = Math.max(1, Math.floor(winLen / 4));
  const N      = _nextPow2(winLen);
  const halfN  = N >> 1;
  const z = [], timeLabels = [];
  for (let start = 0; start + winLen <= n; start += hop) {
    const re = new Float64Array(N), im = new Float64Array(N);
    for (let i = 0; i < winLen; i++) {
      const w = 0.5 * (1 - Math.cos(2 * Math.PI * i / (winLen - 1)));
      re[i] = y[start + i] * w;
    }
    _fftInPlace(re, im);
    const frame = [];
    for (let k = 0; k <= halfN; k++) {
      const m = Math.sqrt(re[k] * re[k] + im[k] * im[k]) / N;
      frame.push(useDb ? (m > 1e-14 ? 20 * Math.log10(m) : -140) : m);
    }
    z.push(frame);
    timeLabels.push(start + Math.floor(winLen / 2));
  }
  const freqPct = Array.from({ length: halfN + 1 }, (_, k) => k / halfN * 100);
  return { z, freqPct, timeLabels, winLen };
}

function _ppCutoffShapes() {
  const t      = document.getElementById('pp-fft-type')?.value || 'lowpass';
  const single = t === 'lowpass' || t === 'highpass';
  const cutoff = parseFloat(document.getElementById('pp-fft-cutoff')?.value) || 20;
  const lo     = single ? cutoff : parseFloat(document.getElementById('pp-fft-lo')?.value) || 10;
  const hi     = single ? cutoff : parseFloat(document.getElementById('pp-fft-hi')?.value) || 30;
  const line   = { color: 'rgba(220,38,38,0.8)', width: 1.5, dash: 'dash' };
  const vline  = x => ({ type: 'line', x0: x, x1: x, y0: 0, y1: 1, yref: 'paper', line });
  return single ? [vline(cutoff)] : [vline(lo), vline(hi)];
}

function renderFFTSpectrum() {
  const ds     = state.datasets.find(d => d.id === state.activeDatasetId);
  const plotEl = document.getElementById('pp-fft-spectrum-plot');
  if (!plotEl) return;
  if (!ds || ds.y.length < 8) {
    Plotly.purge(plotEl);
    plotEl.innerHTML = '<p style="font-size:.78em;color:var(--dim);text-align:center;padding:32px 0">No active dataset or fewer than 8 points.</p>';
    return;
  }

  const dark  = document.body.classList.contains('dark-mode');
  const textC = dark ? '#8fa3c0' : '#4b5563';
  const gridC = dark ? '#1c3050' : '#e5e7eb';
  const bgC   = dark ? '#0a1628' : '#f9fafb';
  const useDb = document.getElementById('pp-fft-db-scale')?.checked ?? true;
  const cfg   = { responsive: true, displayModeBar: false, scrollZoom: true };
  const base  = {
    margin: { t: 4, r: 8, b: 36, l: 50 },
    paper_bgcolor: bgC, plot_bgcolor: bgC,
    showlegend: false, font: { size: 9, color: textC },
    dragmode: 'pan'
  };

  if (_ppSpecView === 'stft') {
    const { z, freqPct, timeLabels } = _computeSTFT(ds.y, useDb);
    if (z.length < 2) {
      Plotly.purge(plotEl);
      plotEl.innerHTML = '<p style="font-size:.78em;color:var(--dim);text-align:center;padding:32px 0">Not enough points for spectrogram (need ≥ 32 points).</p>';
      return;
    }
    Plotly.react(plotEl, [{
      type: 'heatmap', x: freqPct, y: timeLabels, z,
      colorscale: 'Viridis', showscale: false, zsmooth: 'best',
      hovertemplate: '%{x:.1f}% Nyq<br>pos %{y}<br>%{z:.2f}<extra></extra>'
    }], {
      ...base,
      xaxis: { title: { text: '% Nyquist', font: { size: 9 } }, color: textC, gridcolor: gridC, tickfont: { size: 8 }, range: [0, 100] },
      yaxis: { title: { text: 'Sample pos.', font: { size: 9 } }, color: textC, gridcolor: gridC, tickfont: { size: 8 } },
      shapes: _ppCutoffShapes()
    }, cfg);
  } else {
    const n  = ds.y.length;
    const N  = _nextPow2(n);
    const re = new Float64Array(N), im = new Float64Array(N);
    for (let i = 0; i < n; i++) re[i] = ds.y[i];
    _fftInPlace(re, im);
    const halfN = N >> 1;
    const freqPct = [], mag = [];
    for (let k = 0; k <= halfN; k++) {
      freqPct.push(k / halfN * 100);
      mag.push(Math.sqrt(re[k] * re[k] + im[k] * im[k]) / N);
    }
    const yData  = useDb ? mag.map(m => m > 1e-14 ? 20 * Math.log10(m) : -140) : mag;
    const peaks  = _detectSpectrumPeaks(freqPct, yData, useDb);
    const traces = [{
      x: freqPct, y: yData, type: 'scatter', mode: 'lines',
      line: { color: '#0b7a6e', width: 1.2 },
      hovertemplate: '%{x:.1f}% Nyq<br>%{y:.2f}<extra></extra>'
    }];
    if (peaks.length) {
      traces.push({
        x: peaks.map(p => p.freq), y: peaks.map(p => p.val),
        type: 'scatter', mode: 'markers+text',
        marker: { color: '#dc2626', size: 7, symbol: 'triangle-down' },
        text: peaks.map(p => `${p.freq.toFixed(1)}%`),
        textposition: 'top center', textfont: { size: 8, color: '#dc2626' },
        hovertemplate: 'Peak: %{x:.1f}% Nyquist<br>%{y:.2f}<extra></extra>',
        showlegend: false
      });
    }
    Plotly.react(plotEl, traces, {
      ...base,
      xaxis: { title: { text: '% Nyquist', font: { size: 9 } }, color: textC, gridcolor: gridC, tickfont: { size: 8 }, range: [0, 100], fixedrange: false },
      yaxis: { title: { text: useDb ? 'dB' : 'Magnitude', font: { size: 9 } }, color: textC, gridcolor: gridC, tickfont: { size: 8 } },
      shapes: _ppCutoffShapes()
    }, cfg);
  }
}

function applyFourierFilter(type, cutoffLo, cutoffHi, rolloff) {
  const ds = state.datasets.find(d => d.id === state.activeDatasetId);
  if (!ds) { setConsole('No active dataset.', 'warn'); return; }
  const n = ds.y.length;
  if (n < 8) { setConsole('Need at least 8 points for Fourier filtering.', 'warn'); return; }
  _ppPushUndo(ds);

  const N = _nextPow2(n);
  const re = new Float64Array(N), im = new Float64Array(N);
  for (let i = 0; i < n; i++) re[i] = ds.y[i];
  _fftInPlace(re, im);

  const halfN = N >> 1;
  const loIdx = Math.round(cutoffLo / 100 * halfN);
  const hiIdx = Math.round(cutoffHi / 100 * halfN);
  const tw = Math.max(2, Math.round(halfN * 0.06));

  function stepGain(k, edge, ascending) {
    const d = ascending ? k - edge : edge - k;
    if (rolloff === 'brick') return d >= 0 ? 1 : 0;
    const t = Math.max(0, Math.min(1, (d + tw * 0.5) / tw));
    if (rolloff === 'cosine') return 0.5 - 0.5 * Math.cos(Math.PI * t);
    return Math.pow(Math.sin(Math.PI * t * 0.5), 2);
  }

  function gain(k) {
    switch (type) {
      case 'lowpass':  return stepGain(k, loIdx, false);
      case 'highpass': return stepGain(k, loIdx, true);
      case 'bandpass': return stepGain(k, loIdx, true) * stepGain(k, hiIdx, false);
      case 'notch':    return 1 - stepGain(k, loIdx, true) * stepGain(k, hiIdx, false);
      default: return 1;
    }
  }

  re[0] *= gain(0); im[0] *= gain(0);
  if (halfN > 0) { re[halfN] *= gain(halfN); im[halfN] *= gain(halfN); }
  for (let k = 1; k < halfN; k++) {
    const g = gain(k);
    re[k] *= g; im[k] *= g;
    re[N - k] *= g; im[N - k] *= g;
  }
  _ifftInPlace(re, im);

  for (let i = 0; i < n; i++) ds.y[i] = re[i];
  updatePlots();
  const labels = { lowpass: 'Low-pass', highpass: 'High-pass', bandpass: 'Band-pass', notch: 'Notch' };
  setConsole(`Applied ${labels[type]} Fourier filter to "${ds.name}".`, '');
}

function restoreOriginalData() {
  const ds = state.datasets.find(d => d.id === state.activeDatasetId);
  if (!ds) { setConsole('No active dataset.', 'warn'); return; }
  if (!ds.originalY) { setConsole('No original data stored for this dataset.', 'warn'); return; }
  state.editHistory.undo.push({ dsId: ds.id, y: ds.y.slice(), excl: new Set(ds.excludedIndices) });
  if (state.editHistory.undo.length > 100) state.editHistory.undo.shift();
  state.editHistory.redo = [];
  syncUndoRedoButtons();
  ds.y = ds.originalY.slice();
  updatePlots();
  setConsole(`"${ds.name}" restored to original imported values.`, '');
}

function openDataTable() {
  const ds = state.datasets.find(d => d.id === state.activeDatasetId);
  if (!ds) { setConsole('No active dataset.', 'warn'); return; }
  const fit = state.fits.find(f => f.id === state.activeFitId && f.dsId === ds.id);
  const excl = ds.excludedIndices || new Set();
  const resMap = new Map();
  let liveRmse = Infinity;
  if (fit && fit.result && fit.fn) {
    const live = getLiveResidualsWithIdx(fit, ds);
    live.pairs.forEach(({ origIdx, r }) => resMap.set(origIdx, r));
    liveRmse = live.rmse;
  }

  document.getElementById('data-table-title').textContent = `Data Table — ${ds.name}`;
  document.getElementById('data-table-summary').textContent =
    `${ds.x.length} points · ${excl.size} excluded` + (fit ? ` · Residuals from "${fit.label || fit.model}"` : ' · No active fit for residuals');

  const tbody = document.getElementById('dt-tbody');
  tbody.innerHTML = ds.x.map((x, i) => {
    const included = !excl.has(i);
    const res = resMap.has(i) ? fmt(resMap.get(i)) : '—';
    const resClass = resMap.has(i) && Math.abs(resMap.get(i)) > 2.5 * liveRmse ? ' style="color:var(--red)"' : '';
    return `<tr class="${included ? '' : 'dt-row-excluded'}">
      <td><input type="checkbox" class="dt-check" data-idx="${i}" ${included ? 'checked' : ''}></td>
      <td style="color:var(--dimmer);font-family:var(--mono)">${i}</td>
      <td style="font-family:var(--mono)">${fmt(x)}</td>
      <td style="font-family:var(--mono)">${fmt(ds.y[i])}</td>
      <td style="font-family:var(--mono)"${resClass}>${res}</td>
    </tr>`;
  }).join('');

  tbody.querySelectorAll('.dt-check').forEach(cb => {
    cb.addEventListener('change', () => {
      const idx = parseInt(cb.dataset.idx);
      if (cb.checked) excl.delete(idx); else excl.add(idx);
      ds.excludedIndices = excl;
      const row = cb.closest('tr');
      if (row) row.className = excl.has(idx) ? 'dt-row-excluded' : '';
      document.getElementById('data-table-summary').textContent =
        `${ds.x.length} points · ${excl.size} excluded` + (fit ? ` · Residuals from "${fit.label || fit.model}"` : ' · No active fit for residuals');
      renderMaskCount();
      updatePlots();
    });
  });

  const checkAll = document.getElementById('dt-check-all');
  checkAll.checked = excl.size === 0;
  checkAll.indeterminate = excl.size > 0 && excl.size < ds.x.length;

  document.getElementById('data-table-modal').style.display = 'flex';
}

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
      ${ds._exKey ? `<button class="ds-edit" data-editid="${ds.id}" title="Re-open example generator with saved parameters">✏</button>` : ''}
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
      // Clear stale undo/redo history for the deleted dataset
      state.editHistory.undo = state.editHistory.undo.filter(h => h.dsId !== id);
      state.editHistory.redo = state.editHistory.redo.filter(h => h.dsId !== id);
      syncUndoRedoButtons();
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
  el.querySelectorAll('.ds-edit').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      editGeneratedDataset(parseInt(btn.dataset.editid));
    });
  });
  renderMaskCount();
}
