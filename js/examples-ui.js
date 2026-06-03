// Example generator modal: openExampleEditor, editGeneratedDataset, closeExampleModal, loadExampleFromModal

/* ═══════════════════════════════════════════════════════════
   EXAMPLE GENERATOR MODAL
═══════════════════════════════════════════════════════════ */
let currentExampleKey = null;
let currentExampleDsId = null;

function _buildExParamsHtml(params) {
  return params.map(p => `
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
}

function _renderExEq(latex) {
  if (!latex) return '';
  try { return katex.renderToString(latex, { throwOnError: false, displayMode: true }); } catch { return ''; }
}

function openExampleEditor(key, savedState = null) {
  const ex = EXAMPLES[key];
  if (!ex) return;
  currentExampleKey = key;
  document.getElementById('example-modal-title').textContent = ex.title;
  const body = document.getElementById('example-modal-body');
  const hasPresets = Array.isArray(ex.presets) && ex.presets.length > 0;
  const activePresetIdx = hasPresets ? (savedState?.presetIdx ?? 0) : 0;
  const activeDef = hasPresets ? ex.presets[activePresetIdx] : ex;
  const activeEq = hasPresets ? (activeDef.eq || '') : (EXAMPLE_EQ[key] || '');

  const presetDropdownHtml = hasPresets ? `
    <div class="ex-param-row" style="margin-bottom:10px">
      <label class="ex-param-label" style="font-weight:600;color:var(--text)">Preset</label>
      <select class="ctrl-select" id="ex-preset-select" style="flex:1">
        ${ex.presets.map((pr, i) => `<option value="${i}"${i === activePresetIdx ? ' selected' : ''}>${pr.label}</option>`).join('')}
      </select>
    </div>` : '';

  const eqHtml = _renderExEq(activeEq);
  body.innerHTML = presetDropdownHtml +
    (eqHtml ? `<div id="ex-eq-display" style="background:var(--input-bg);border:1px solid var(--border);border-radius:4px;padding:6px 10px;margin-bottom:10px;overflow-x:auto;text-align:center">${eqHtml}</div>` : `<div id="ex-eq-display"></div>`) + `
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px">
      <span style="font-weight:600;font-size:.8em;flex:1">Model Parameters</span>
      <span class="panel-tip" data-tip="ex-model-params">?</span>
    </div>
    <div id="ex-params-container">${_buildExParamsHtml(activeDef.params)}</div>

    <div class="ex-noise-section">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px">
        <span class="ex-noise-hd" style="margin:0;flex:1">Additional Background Noise</span>
        <span class="panel-tip" data-tip="ex-extra-noise">?</span>
      </div>
      <div class="ex-param-row">
        <label class="ex-param-label">Noise type</label>
        <select class="ctrl-select" id="ex-extra-noise-type" style="flex:1">
          <option value="none">None</option>
          <option value="gaussian">Gaussian</option>
          <option value="uniform">Uniform (white)</option>
          <option value="laplacian">Laplacian (heavy-tail)</option>
        </select>
      </div>
      <div class="ex-param-row">
        <label class="ex-param-label">Amplitude (σ, y-units)</label>
        <input class="ctrl-input" type="number" id="ex-extra-noise-amp" value="0" min="0" step="any" style="flex:1">
      </div>
    </div>
    <div class="ex-noise-section">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
        <span class="ex-noise-hd" style="margin:0;flex:1">Sinusoidal Interference (up to 3)</span>
        <span class="panel-tip" data-tip="ex-freq-noise">?</span>
      </div>
      <div class="ex-freq-hdr"><span>Amplitude</span><span>Freq (cyc/range)</span><span>Phase (0–1)</span></div>
      ${[1, 2, 3].map(i => `
      <div class="ex-freq-grid">
        <input class="ctrl-input" type="number" id="ex-freq${i}-amp"   value="0"  min="0"   step="any"  title="Amplitude — set 0 to skip">
        <input class="ctrl-input" type="number" id="ex-freq${i}-freq"  value="${i}" min="0.1" step="0.5" title="Cycles per x-range">
        <input class="ctrl-input" type="number" id="ex-freq${i}-phase" value="0"  min="0" max="1" step="0.05" title="Phase 0–1 (fraction of 2π)">
      </div>`).join('')}
    </div>
    <div class="ex-noise-section">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
        <span class="ex-noise-hd" style="margin:0;flex:1">Inject Trend / Baseline</span>
      </div>
      <div class="ex-param-row">
        <label class="ex-param-label" title="Total rise added across the x-range (linear drift)">Linear drift (Δy over range)</label>
        <input class="ctrl-input" type="number" id="ex-trend-slope" value="0" step="any" style="flex:1">
      </div>
      <div class="ex-param-row">
        <label class="ex-param-label" title="Quadratic component added across the x-range">Curvature (quadratic Δy)</label>
        <input class="ctrl-input" type="number" id="ex-trend-curv" value="0" step="any" style="flex:1">
      </div>
      <div class="ex-param-row">
        <label class="ex-param-label" title="Constant offset added to every point">Baseline offset</label>
        <input class="ctrl-input" type="number" id="ex-trend-offset" value="0" step="any" style="flex:1">
      </div>
      <p style="font-size:.68em;color:var(--dim);margin:4px 0 0">Adds a deterministic trend you can remove later with Pre-Process → Baseline / De-trend.</p>
    </div>
    <div class="ex-noise-section">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
        <span class="ex-noise-hd" style="margin:0;flex:1">Output Format</span>
      </div>
      <div class="ex-param-row">
        <label class="ex-param-label">Format</label>
        <select class="ctrl-select" id="ex-output-format" style="flex:1">
          <option value="single">Single dataset</option>
          <option value="replicates">Replicates → mean ± σ</option>
          <option value="multi">Multiple series (separate datasets)</option>
        </select>
      </div>
      <div class="ex-param-row" id="ex-output-count-row" style="display:none">
        <label class="ex-param-label" id="ex-output-count-label">Replicates</label>
        <input class="ctrl-input" type="number" id="ex-output-count" value="4" min="2" max="24" step="1" style="flex:1">
      </div>
      <p style="font-size:.68em;color:var(--dim);margin:4px 0 0" id="ex-output-desc">One dataset. “Replicates” generates the curve N times and stores mean ± σ (error bars); “Multiple series” creates N independent datasets — try “Fit All Datasets”.</p>
    </div>`;

  if (hasPresets) {
    document.getElementById('ex-preset-select').addEventListener('change', function() {
      const idx = parseInt(this.value);
      const pr = ex.presets[idx];
      const eqD = document.getElementById('ex-eq-display');
      if (eqD) {
        const h = _renderExEq(pr.eq || '');
        eqD.innerHTML = h;
        eqD.style.display = h ? '' : 'none';
      }
      const pc = document.getElementById('ex-params-container');
      if (pc) pc.innerHTML = _buildExParamsHtml(pr.params);
    });
  }

  // Restore saved values when re-editing a generated dataset
  if (savedState) {
    body.querySelectorAll('.ex-param-input').forEach(inp => {
      if (inp.dataset.key && savedState.params?.[inp.dataset.key] !== undefined)
        inp.value = savedState.params[inp.dataset.key];
    });
    const nte = document.getElementById('ex-extra-noise-type');
    const nae = document.getElementById('ex-extra-noise-amp');
    if (nte) nte.value = savedState.extraNoise?.type || 'none';
    if (nae) nae.value = savedState.extraNoise?.amp  || 0;
    savedState.freqRows?.forEach((r, i) => {
      const ae = document.getElementById(`ex-freq${i + 1}-amp`);
      const fe = document.getElementById(`ex-freq${i + 1}-freq`);
      const pe = document.getElementById(`ex-freq${i + 1}-phase`);
      if (ae) ae.value = r.amp;
      if (fe) fe.value = r.freq;
      if (pe) pe.value = r.phase;
    });
    if (savedState.trend) {
      const ts = document.getElementById('ex-trend-slope'), tc = document.getElementById('ex-trend-curv'), to = document.getElementById('ex-trend-offset');
      if (ts) ts.value = savedState.trend.slope ?? 0;
      if (tc) tc.value = savedState.trend.curv ?? 0;
      if (to) to.value = savedState.trend.offset ?? 0;
    }
    if (savedState.output) {
      const of = document.getElementById('ex-output-format'), oc = document.getElementById('ex-output-count');
      if (of) of.value = savedState.output.format || 'single';
      if (oc) oc.value = savedState.output.count ?? 4;
    }
  }

  // Output-format row visibility + label (run after any savedState restore)
  const ofSel = document.getElementById('ex-output-format');
  if (ofSel) {
    const syncOut = () => {
      const v = ofSel.value;
      const row = document.getElementById('ex-output-count-row');
      const lbl = document.getElementById('ex-output-count-label');
      if (row) row.style.display = v === 'single' ? 'none' : 'flex';
      if (lbl) lbl.textContent = v === 'replicates' ? 'Replicates' : 'Series';
    };
    ofSel.addEventListener('change', syncOut);
    syncOut();
  }

  const loadBtn = document.getElementById('example-modal-load');
  const footerNote = document.querySelector('#example-modal .modal-footer > span');
  if (savedState) {
    if (loadBtn) loadBtn.textContent = 'Regenerate';
    if (footerNote) footerNote.textContent = 'Regenerates data in place — existing fits are preserved but should be re-run.';
  } else {
    if (loadBtn) loadBtn.textContent = 'Load Dataset';
    if (footerNote) footerNote.textContent = 'Noise is re-randomised each time you load.';
  }
  document.getElementById('example-modal').style.display = 'flex';
}

function editGeneratedDataset(dsId) {
  const ds = state.datasets.find(d => d.id === dsId);
  if (!ds?._exKey) return;
  currentExampleDsId = dsId;
  openExampleEditor(ds._exKey, ds._exSavedState);
}

function closeExampleModal() {
  document.getElementById('example-modal').style.display = 'none';
  currentExampleKey = null;
  currentExampleDsId = null;
  const loadBtn = document.getElementById('example-modal-load');
  if (loadBtn) loadBtn.textContent = 'Load Dataset';
  const footerNote = document.querySelector('#example-modal .modal-footer > span');
  if (footerNote) footerNote.textContent = 'Noise is re-randomised each time you load.';
}

function loadExampleFromModal() {
  if (!currentExampleKey) return;
  const ex = EXAMPLES[currentExampleKey];
  const hasPresets = Array.isArray(ex.presets) && ex.presets.length > 0;
  const activePresetIdx = hasPresets ? (parseInt(document.getElementById('ex-preset-select')?.value ?? 0)) : 0;
  const activeDef = hasPresets ? ex.presets[activePresetIdx] : ex;
  const p = {};
  document.getElementById('example-modal-body').querySelectorAll('.ex-param-input').forEach(inp => {
    let v = parseFloat(inp.value);
    if (!isFinite(v)) v = parseFloat(inp.min) || 0;
    p[inp.dataset.key] = v;
  });
  // Round integer params
  activeDef.params.forEach(d => { if (d.step === 1) p[d.key] = Math.max(d.min, Math.round(p[d.key])); });

  // Additional background noise
  const extraType = (document.getElementById('ex-extra-noise-type') || {}).value || 'none';
  const extraAmp  = parseFloat((document.getElementById('ex-extra-noise-amp') || {}).value) || 0;

  // Sinusoidal frequency components — collect all 3 rows (including disabled ones for save)
  const freqRows = [1, 2, 3].map(i => ({
    amp:   parseFloat((document.getElementById(`ex-freq${i}-amp`)   || {}).value) || 0,
    freq:  parseFloat((document.getElementById(`ex-freq${i}-freq`)  || {}).value) || i,
    phase: parseFloat((document.getElementById(`ex-freq${i}-phase`) || {}).value) || 0
  }));
  const activeFreqComps = freqRows.filter(r => r.amp > 0);

  // Injected trend / baseline
  const trend = {
    slope:  parseFloat((document.getElementById('ex-trend-slope')  || {}).value) || 0,
    curv:   parseFloat((document.getElementById('ex-trend-curv')   || {}).value) || 0,
    offset: parseFloat((document.getElementById('ex-trend-offset') || {}).value) || 0
  };

  // Output format
  const outFmt   = (document.getElementById('ex-output-format') || {}).value || 'single';
  const outCount = Math.max(2, Math.min(24, Math.round(parseFloat((document.getElementById('ex-output-count') || {}).value) || 4)));

  // Generates one fresh realisation (fresh noise + outliers + interference + trend).
  const buildOne = () => {
    const d = activeDef.generate(p);
    if (p.outliers > 0) d.y = injectOutliers(d.y, Math.round(p.outliers), p.outlierScale || 4);
    if (extraType !== 'none' && extraAmp > 0) d.y = addExtraNoise(d.y, extraType, extraAmp);
    if (activeFreqComps.length) d.y = addFreqNoise(d.y, d.x, activeFreqComps);
    if (trend.slope || trend.curv || trend.offset) d.y = _addTrend(d.x, d.y, trend);
    return d;
  };

  // Build the list of datasets to produce based on the chosen output format.
  const first = buildOne();
  const meta = { xlabel: first.xlabel, ylabel: first.ylabel, suggestModel: first.suggestModel };
  let datasets;
  if (outFmt === 'replicates') {
    const reals = [first.y];
    for (let r = 1; r < outCount; r++) {
      const d = buildOne();
      if (d.y.length === first.x.length) reals.push(d.y);
    }
    const n = first.x.length;
    const y = new Array(n), sigY = new Array(n);
    for (let i = 0; i < n; i++) {
      const col = reals.map(a => a[i]).filter(isFinite);
      const m = col.reduce((s, v) => s + v, 0) / col.length;
      const sd = col.length > 1 ? Math.sqrt(col.reduce((s, v) => s + (v - m) ** 2, 0) / (col.length - 1)) : NaN;
      y[i] = m; sigY[i] = sd > 0 ? sd : NaN;
    }
    datasets = [{ name: `${first.name} (mean ± σ, n=${outCount})`, x: first.x, y, sigY: sigY.some(isFinite) ? sigY : null }];
  } else if (outFmt === 'multi') {
    datasets = [{ name: `${first.name} #1`, x: first.x, y: first.y, sigY: first.sigY || null }];
    for (let s = 2; s <= outCount; s++) {
      const d = buildOne();
      datasets.push({ name: `${first.name} #${s}`, x: d.x, y: d.y, sigY: d.sigY || null });
    }
  } else {
    datasets = [{ name: first.name, x: first.x, y: first.y, sigY: first.sigY || null }];
  }

  // Snapshot of all form state for re-editing later
  const savedState = {
    presetIdx:   activePresetIdx,
    params:      { ...p },
    extraNoise:  { type: extraType, amp: extraAmp },
    freqRows, trend,
    output:      { format: outFmt, count: outCount }
  };

  const editDsId = currentExampleDsId;
  const exKey    = currentExampleKey;
  closeExampleModal();

  // Edit-in-place only when exactly one dataset is produced (single / replicates).
  if (editDsId && datasets.length === 1) {
    const editDs = state.datasets.find(d => d.id === editDsId);
    if (editDs) {
      const d0 = datasets[0];
      editDs.x = d0.x; editDs.y = d0.y; editDs.originalY = d0.y.slice();
      if (d0.sigY && d0.sigY.length === d0.x.length) editDs.sigY = d0.sigY; else delete editDs.sigY;
      editDs.name = d0.name;
      editDs._exKey = exKey || editDs._exKey;
      editDs._exSavedState = savedState;
      state.editHistory.undo = state.editHistory.undo.filter(h => h.dsId !== editDs.id);
      state.editHistory.redo = [];
      syncUndoRedoButtons();
      if (state.activeDatasetId !== editDs.id) { state.activeDatasetId = editDs.id; syncFitDatasetSelect(); }
      renderDatasetList();
      updatePlots();
      setConsole(`Regenerated: ${d0.name} (${d0.x.length} points). Re-run fits to update results.`, '');
      return;
    }
  }

  // Otherwise create new dataset(s).
  let firstDs = null;
  datasets.forEach((d, i) => {
    const ds = importDataset(d.name, d.x, d.y, d.sigY || null);
    if (!ds) return;
    if (i === 0) { ds._exKey = exKey; ds._exSavedState = savedState; firstDs = ds; }
  });
  if (!firstDs) return;
  applyParsedMeta({ xlabel: meta.xlabel, ylabel: meta.ylabel, title: null });
  if (meta.suggestModel) {
    document.getElementById('model-select').value = meta.suggestModel;
    syncModelCustomSection();
  }
  state.activeDatasetId = firstDs.id;
  syncFitDatasetSelect();
  renderDatasetList();
  updatePlots();
  autoInitParams();
  if (datasets.length > 1) {
    setConsole(`Loaded ${datasets.length} series from "${first.name}". Pick a model and press “Fit All Datasets”.`, '');
  } else {
    setConsole(`Loaded: ${datasets[0].name} (${datasets[0].x.length} points).  Press ▶ Fit to fit.`, '');
  }
}

// Adds a deterministic trend/baseline across the x-range: offset + slope·u + curv·u²,
// where u = (x − xmin)/(xmax − xmin) ∈ [0, 1]. slope/curv are total Δy across the range.
function _addTrend(x, y, t) {
  const xmin = arrMin(x), xmax = arrMax(x), rng = (xmax - xmin) || 1;
  return y.map((v, i) => {
    const u = (x[i] - xmin) / rng;
    return v + t.offset + t.slope * u + t.curv * u * u;
  });
}
