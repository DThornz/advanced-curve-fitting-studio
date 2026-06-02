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
    <div id="ex-params-container">${_buildExParamsHtml(activeDef.params)}</div>`;

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
    </div>`;

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

  const data = activeDef.generate(p);
  if (p.outliers > 0) data.y = injectOutliers(data.y, Math.round(p.outliers), p.outlierScale || 4);

  // Additional background noise
  const extraType = (document.getElementById('ex-extra-noise-type') || {}).value || 'none';
  const extraAmp  = parseFloat((document.getElementById('ex-extra-noise-amp') || {}).value) || 0;
  if (extraType !== 'none' && extraAmp > 0) data.y = addExtraNoise(data.y, extraType, extraAmp);

  // Sinusoidal frequency components — collect all 3 rows (including disabled ones for save)
  const freqRows = [1, 2, 3].map(i => ({
    amp:   parseFloat((document.getElementById(`ex-freq${i}-amp`)   || {}).value) || 0,
    freq:  parseFloat((document.getElementById(`ex-freq${i}-freq`)  || {}).value) || i,
    phase: parseFloat((document.getElementById(`ex-freq${i}-phase`) || {}).value) || 0
  }));
  const activeFreqComps = freqRows.filter(r => r.amp > 0);
  if (activeFreqComps.length) data.y = addFreqNoise(data.y, data.x, activeFreqComps);

  // Snapshot of all form state for re-editing later
  const savedState = {
    presetIdx:   activePresetIdx,
    params:      { ...p },
    extraNoise:  { type: extraType, amp: extraAmp },
    freqRows
  };

  const editDsId = currentExampleDsId;
  const exKey    = currentExampleKey;
  closeExampleModal();

  if (editDsId) {
    // Update existing generated dataset in place
    const editDs = state.datasets.find(d => d.id === editDsId);
    if (!editDs) return;
    editDs.x         = data.x;
    editDs.y         = data.y;
    editDs.originalY = data.y.slice();
    editDs.name      = data.name;
    editDs._exKey        = exKey || editDs._exKey;
    editDs._exSavedState = savedState;
    // Drop stale undo history for this dataset
    state.editHistory.undo = state.editHistory.undo.filter(h => h.dsId !== editDs.id);
    state.editHistory.redo = [];
    syncUndoRedoButtons();
    if (state.activeDatasetId !== editDs.id) {
      state.activeDatasetId = editDs.id;
      syncFitDatasetSelect();
    }
    renderDatasetList();
    updatePlots();
    setConsole(`Regenerated: ${data.name} (${data.x.length} points). Re-run fits to update results.`, '');
  } else {
    // Create a new dataset
    const ds = importDataset(data.name, data.x, data.y);
    if (!ds) return;
    ds._exKey        = exKey;
    ds._exSavedState = savedState;
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
}
