// Tab system: tabList, activeTabId, addNewTab, closeTab, activateTab, renderTabBar, clearWorkspace

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
  // Cancel any in-flight fit worker so its result doesn't land on the new workspace
  if (state.currentWorker) { state.currentWorker.terminate(); state.currentWorker = null; setFitting(false); }

  // Reset all state to factory defaults
  state.datasets      = [];
  state.fits          = [];
  state.annotations   = [];
  state.graphStyle    = Object.assign({}, DEFAULT_GRAPH_STYLE);
  state.activeDatasetId = null;
  state.activeFitId   = null;
  state.paramRows     = [];
  state.sweepParams   = null;
  state.editHistory   = { undo: [], redo: [] };
  state.editSelectRadius = 0;
  state.selection     = { dsId: null, indices: new Set() };
  state.fitConfig     = { model: 'Exponential', customExpr: 'a * exp(-b * x) + c', customParams: [], xExtraMin: null, xExtraMax: null };
  state.plotConfig    = { showResiduals: true, logX: false, logY: false, showCI: false, normalizeResiduals: false, showOutliers: false, showLegend: true, residualTab: 'residuals', logSuggestDismissed: { x: false, y: false } };

  // Model selector
  const modelSel = document.getElementById('model-select');
  if (modelSel) { modelSel.value = 'Exponential'; syncModelCustomSection(); }
  const eqInput = document.getElementById('custom-eq-input');
  if (eqInput) eqInput.value = 'a * exp(-b * x) + c';

  // Toolbar toggle buttons
  ['btn-toggle-residuals', 'btn-ci-bands', 'btn-norm-resid', 'btn-show-outliers'].forEach(id => {
    const b = document.getElementById(id); if (b) b.classList.remove('active');
  });
  const bResid = document.getElementById('btn-toggle-residuals'); if (bResid) bResid.classList.add('active');

  // Edit mode
  const bEdit = document.getElementById('btn-edit-mode'); if (bEdit) bEdit.classList.remove('active');
  const editControls = document.getElementById('edit-mode-controls'); if (editControls) editControls.style.display = 'none';

  // Residual panel visibility and active tab
  const rBar = document.getElementById('residual-tab-bar'); if (rBar) rBar.classList.remove('hidden');
  const rPlot = document.getElementById('residual-plot');   if (rPlot) rPlot.classList.remove('hidden');
  document.querySelectorAll('.resid-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === 'residuals'));

  // Plot labels
  ['plot-xlabel', 'plot-ylabel', 'plot-title'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });

  // Solver / curve settings (match HTML default attribute values)
  const solverDefaults = { 'opt-algo': 'lm', 'opt-max-iter': '20', 'opt-tol': '1e-8', 'opt-n-starts': '8', 'opt-weights': 'none', 'opt-curve-pts': '300' };
  Object.entries(solverDefaults).forEach(([id, v]) => { const el = document.getElementById(id); if (el) el.value = v; });

  // Extrapolation range
  ['opt-extrap-xmin', 'opt-extrap-xmax'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });

  // Predict / Solve
  const predMode = document.getElementById('pred-mode'); if (predMode) predMode.value = 'x2y';
  const predLbl = document.getElementById('pred-label'); if (predLbl) predLbl.textContent = 'X value';
  const predInput = document.getElementById('pred-input'); if (predInput) predInput.value = '';
  const predResult = document.getElementById('pred-result'); if (predResult) predResult.style.display = 'none';

  // F-test
  const ftResult = document.getElementById('ftest-result'); if (ftResult) ftResult.style.display = 'none';

  // Log-scale suggest banner
  const logBanner = document.getElementById('log-suggest-banner'); if (logBanner) logBanner.style.display = 'none';

  syncFitDatasetSelect();
  renderDatasetList();
  renderFitList();
  renderAnnList();
  updatePlots();
  renderStatsTable();
  syncUndoRedoButtons();
}

function saveCurrentTab() {
  if (!activeTabId) return;
  const tab = tabList.find(t => t.id === activeTabId);
  if (tab) tab.payload = buildSessionPayload();
}

function closeAllModals() {
  ['gs-modal', 'ann-modal', 'col-picker-modal', 'save-modal', 'relnotes-modal', 'tut-overlay', 'settings-modal'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
}

function activateTab(id) {
  closeAllModals();
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
