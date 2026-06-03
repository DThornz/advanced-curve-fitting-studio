// Session persistence: buildSessionPayload, restoreSessionPayload, multi-tab save/load

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
      bounds: f.bounds || null, notes: f.notes || '',
    })),
    fitConfig: state.fitConfig,
    plotConfig: Object.assign({}, state.plotConfig, { legendPos }),
    paramRows: state.paramRows,
    constraints: state.constraints,
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
    if (f.notes == null) f.notes = '';
    state.fits.push(Object.assign(f, { fn: fn || (() => NaN) }));
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
  if (state.activeDatasetId && !state.datasets.find(d => d.id === state.activeDatasetId)) {
    state.activeDatasetId = state.datasets.length ? state.datasets[0].id : null;
  }
  state.activeFitId = payload.activeFitId;

  // Restore paramRows before syncModelCustomSection so renderParamTable picks them up
  if (payload.paramRows) state.paramRows = payload.paramRows;
  state.constraints = Array.isArray(payload.constraints) ? payload.constraints : [];

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
  if (!data || typeof data !== 'object') throw new Error('Invalid session file format.');
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
    try { localStorage.setItem('cfs_session', json); } catch (_) { /* QuotaExceededError: session too large, skip autosave */ }
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
    reader.onerror = () => setConsole('File read error — could not read the session file.', 'error');
    reader.readAsText(file);
  });
  fileInput.click();
}
