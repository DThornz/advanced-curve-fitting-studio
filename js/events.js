// Event wiring: initEvents — all DOM listeners for toolbar, modals, fit, export, session, edit, annotations

/* ═══════════════════════════════════════════════════════════
   EVENTS
═══════════════════════════════════════════════════════════ */
function initEvents() {
  /* ── Dropdown toggles ─────────────────────────────────── */
  // The topbar uses overflow-x:auto (to prevent button wrapping at any screen
  // width), which clips position:absolute children. Use position:fixed for all
  // dropdowns, anchored to the trigger button's live viewport rect.
  function setupDropdown(btnId, menuId, preferredW) {
    const btn  = document.getElementById(btnId);
    const menu = document.getElementById(menuId);
    if (!btn || !menu) return;
    function positionMenu() {
      const r    = btn.getBoundingClientRect();
      const w    = Math.min(window.innerWidth - 16, preferredW || 540);
      const left = Math.max(8, Math.min(r.left, window.innerWidth - w - 8));
      menu.style.cssText = `position:fixed;top:${Math.round(r.bottom + 4)}px;left:${Math.round(left)}px;width:${w}px;`;
    }
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const wasOpen = menu.classList.contains('open');
      document.querySelectorAll('.app-dropdown.open').forEach(m => { m.classList.remove('open'); m.style.cssText = ''; });
      if (!wasOpen) { positionMenu(); menu.classList.add('open'); }
    });
    document.addEventListener('click', e => {
      if (!menu.contains(e.target) && e.target !== btn) { menu.classList.remove('open'); menu.style.cssText = ''; }
    });
    // Item clicks inside the menu close it via their own handlers; clear fixed
    // positioning in the next frame so it doesn't persist across orientations.
    menu.addEventListener('click', () => {
      requestAnimationFrame(() => { if (!menu.classList.contains('open')) menu.style.cssText = ''; });
    });
  }
  setupDropdown('btn-examples', 'examples-menu', 740);
  setupDropdown('btn-export',   'export-menu',   220);
  setupDropdown('btn-session',  'session-menu',  200);

  /* ── Examples menu: auto-column layout ───────────────────
     Parse all items/sections ONCE from original HTML, then
     rebuild columns to fill available viewport height on open. */
  let _exSections = null;

  function _getExSections() {
    if (_exSections) return _exSections;
    _exSections = [];
    let cur = null;
    document.getElementById('examples-cols-wrap')
      ?.querySelectorAll('.examples-col-hdr, .app-dropdown-item[data-example]')
      .forEach(el => {
        if (el.classList.contains('examples-col-hdr')) {
          if (cur) _exSections.push(cur);
          cur = { hdr: el.textContent.trim(), items: [] };
        } else {
          if (!cur) cur = { hdr: '', items: [] };
          cur.items.push({ key: el.dataset.example, html: el.outerHTML });
        }
      });
    if (cur) _exSections.push(cur);
    return _exSections;
  }

  const EX_COL_W = 210;  // fixed column width (px) → consistent text wrapping

  // Split sections into exactly `n` order-preserving columns, balancing item weight.
  function _splitExColumns(sections, n) {
    const weight = sec => (sec.hdr ? 1 : 0) + sec.items.length + 0.4; // +sep allowance
    const total  = sections.reduce((s, sec) => s + weight(sec), 0);
    const target = total / n;
    const cols = []; let col = [], w = 0;
    sections.forEach(sec => {
      const sw = weight(sec);
      // move to next column once we've met our share AND more columns remain
      if (col.length && cols.length < n - 1 && w >= target - sw / 2) {
        cols.push(col); col = []; w = 0;
      }
      col.push(sec); w += sw;
    });
    if (col.length) cols.push(col);
    return cols;
  }

  function _renderExColumns(columns) {
    const colsWrap = document.getElementById('examples-cols-wrap');
    colsWrap.innerHTML = columns.map(secs =>
      `<div class="examples-col">${secs.map((sec, si) =>
        (sec.hdr ? `<div class="examples-col-hdr">${sec.hdr}</div>` : '') +
        sec.items.map(it => it.html).join('') +
        (si < secs.length - 1 ? '<div class="app-dropdown-sep"></div>' : '')
      ).join('')}</div>`
    ).join('');
    colsWrap.querySelectorAll('.app-dropdown-item[data-example]').forEach(el => {
      el.addEventListener('click', () => {
        const menu = document.getElementById('examples-menu');
        openExampleEditor(el.dataset.example);
        menu.classList.remove('open');
        menu.style.cssText = '';
      });
    });
  }

  function _rebuildExMenuColumns() {
    if (window.innerWidth < 640) return;   // mobile handled by CSS
    const menu = document.getElementById('examples-menu');
    const colsWrap = document.getElementById('examples-cols-wrap');
    if (!menu || !colsWrap || !menu.classList.contains('open')) return;

    const sections = _getExSections();
    if (!sections.length) return;

    // Clear any prior scroll fallback before measuring
    colsWrap.style.maxHeight = '';
    colsWrap.style.overflowY = '';

    // How many columns can fit horizontally
    const maxByWidth = Math.max(1, Math.floor((window.innerWidth - 24) / EX_COL_W));
    const maxCols    = Math.min(sections.length, maxByWidth, 8);

    // Anchor left edge from current fixed position (set by positionMenu)
    const startLeft = parseFloat(menu.style.left) || menu.getBoundingClientRect().left;

    // Try increasing column counts until the rendered content fits the viewport
    const availFor = () => window.innerHeight - colsWrap.getBoundingClientRect().top - 12;
    for (let n = 1; n <= maxCols; n++) {
      const columns = _splitExColumns(sections, n);
      _renderExColumns(columns);

      // Size + reposition so we measure at the real on-screen geometry
      const width = columns.length * EX_COL_W + 8;
      const left  = Math.max(8, Math.min(startLeft, window.innerWidth - width - 8));
      menu.style.width = width + 'px';
      menu.style.left  = Math.round(left) + 'px';

      if (colsWrap.scrollHeight <= availFor()) break;  // fits — done
    }

    // If even the widest layout overflows (very short viewport), scroll the columns
    if (colsWrap.scrollHeight > availFor()) {
      colsWrap.style.maxHeight = Math.max(120, availFor()) + 'px';
      colsWrap.style.overflowY = 'auto';
    }
  }

  // Hook: rebuild columns whenever the examples menu opens
  document.getElementById('btn-examples').addEventListener('click', () => {
    // Run after positionMenu() sets the fixed position/width
    setTimeout(_rebuildExMenuColumns, 0);
  });
  // Also rebuild on window resize while open
  window.addEventListener('resize', () => {
    if (document.getElementById('examples-menu')?.classList.contains('open'))
      _rebuildExMenuColumns();
  }, { passive: true });

  /* ── Example datasets ─────────────────────────────────── */
  document.getElementById('examples-menu').querySelectorAll('.app-dropdown-item').forEach(item => {
    item.addEventListener('click', () => {
      const key = item.dataset.example;
      if (!EXAMPLES[key]) return;
      document.getElementById('examples-menu').classList.remove('open');
      openExampleEditor(key);
    });
  });

  /* ── Example modal ────────────────────────────────────── */
  document.getElementById('example-modal-load').addEventListener('click', loadExampleFromModal);
  document.getElementById('example-modal-cancel').addEventListener('click', closeExampleModal);
  document.getElementById('example-modal-close').addEventListener('click', closeExampleModal);
  document.getElementById('example-modal').addEventListener('click', e => {
    if (e.target === document.getElementById('example-modal')) closeExampleModal();
  });

  /* ── CSV Import ───────────────────────────────────────── */
  document.getElementById('btn-import').addEventListener('click', () => document.getElementById('file-input').click());
  document.getElementById('file-input').addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const rows = parseDelimited(ev.target.result, 'auto');
        const name = file.name.replace(/\.[^.]+$/, '');
        if (needsColumnPicker(rows)) { openColumnPicker(name, rows); return; }
        const parsed = rowsToXY(rows);
        const { x, y } = parsed;
        if (!x.length) { setConsole('Could not parse any X,Y pairs from file.', 'error'); return; }
        applyParsedMeta(parsed);
        const ds = importDataset(name, x, y);
        syncFitDatasetSelect();
        renderDatasetList();
        updatePlots();
        setConsole(`Imported: ${ds.name} (${x.length} points).`, '');
      } catch (err) { setConsole('Import error: ' + err.message, 'error'); }
    };
    reader.readAsText(file);
    e.target.value = '';
  });

  /* ── Drag & drop onto plot area ───────────────────────── */
  const plotArea = document.getElementById('main-plot');
  plotArea.addEventListener('dragover', e => e.preventDefault());
  plotArea.addEventListener('drop', e => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const rows = parseDelimited(ev.target.result, 'auto');
        const name = file.name.replace(/\.[^.]+$/, '');
        if (needsColumnPicker(rows)) { openColumnPicker(name, rows); return; }
        const parsed = rowsToXY(rows);
        const { x, y } = parsed;
        if (!x.length) { setConsole('Could not parse file.', 'error'); return; }
        applyParsedMeta(parsed);
        const ds = importDataset(name, x, y);
        syncFitDatasetSelect(); renderDatasetList(); updatePlots();
        setConsole(`Imported: ${ds.name} (${x.length} points).`, '');
      } catch (err) { setConsole('Drop import error: ' + err.message, 'error'); }
    };
    reader.readAsText(file);
  });

  /* ── Paste modal ──────────────────────────────────────── */
  document.getElementById('btn-paste').addEventListener('click', () => {
    document.getElementById('paste-modal').style.display = 'flex';
    document.getElementById('paste-textarea').focus();
  });
  function closePasteModal() { document.getElementById('paste-modal').style.display = 'none'; }
  document.getElementById('paste-modal-close').addEventListener('click', closePasteModal);
  document.getElementById('paste-cancel').addEventListener('click', closePasteModal);
  document.getElementById('paste-modal').addEventListener('click', e => { if (e.target === document.getElementById('paste-modal')) closePasteModal(); });
  document.getElementById('paste-textarea').addEventListener('input', () => {
    const text = document.getElementById('paste-textarea').value;
    if (!text.trim()) { document.getElementById('paste-preview').textContent = ''; return; }
    try {
      const delim = document.getElementById('paste-delim').value;
      const rows = parseDelimited(text, delim);
      const { x, y } = rowsToXY(rows);
      document.getElementById('paste-preview').textContent = x.length ? `Preview: ${x.length} rows parsed. X ∈ [${fmt(Math.min(...x))}, ${fmt(Math.max(...x))}], Y ∈ [${fmt(Math.min(...y))}, ${fmt(Math.max(...y))}]` : 'No numeric pairs found.';
    } catch (_) { document.getElementById('paste-preview').textContent = 'Parse error.'; }
  });
  document.getElementById('paste-import').addEventListener('click', () => {
    const text = document.getElementById('paste-textarea').value;
    const delim = document.getElementById('paste-delim').value;
    const name  = document.getElementById('paste-ds-name').value.trim() || `Dataset ${state.datasets.length + 1}`;
    try {
      const rows = parseDelimited(text, delim);
      if (needsColumnPicker(rows)) { closePasteModal(); openColumnPicker(name, rows); return; }
      const parsed = rowsToXY(rows);
      const { x, y } = parsed;
      if (!x.length) { setConsole('No valid data found in pasted text.', 'error'); return; }
      applyParsedMeta(parsed);
      importDataset(name, x, y);
      syncFitDatasetSelect(); renderDatasetList(); updatePlots();
      closePasteModal();
      document.getElementById('paste-textarea').value = '';
      setConsole(`Imported: ${name} (${x.length} points).`, '');
    } catch (err) { setConsole('Paste import error: ' + err.message, 'error'); }
  });

  /* ── Fit button ───────────────────────────────────────── */
  document.getElementById('btn-fit').addEventListener('click', runFit);
  document.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) runFit(); });
  // Ctrl+F: quick re-fit (overrides browser find when app is open)
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'f' && !e.shiftKey && !e.altKey) {
      const appOverlay = document.getElementById('app-overlay');
      if (appOverlay && appOverlay.classList.contains('open')) { e.preventDefault(); runFit(); }
    }
  });

  /* ── Cancel fit button ────────────────────────────────── */
  document.getElementById('btn-cancel-fit').addEventListener('click', () => {
    if (state.currentWorker) {
      state.currentWorker.terminate();
      state.currentWorker = null;
    }
    setFitting(false);
    setConsole('Fit cancelled.', 'warn');
  });

  /* ── Remove fit ───────────────────────────────────────── */
  document.getElementById('btn-clear-fit').addEventListener('click', () => {
    if (!state.activeFitId) return;
    state.fits = state.fits.filter(f => f.id !== state.activeFitId);
    state.activeFitId = state.fits.length ? state.fits[state.fits.length - 1].id : null;
    renderFitList();
    const active = state.fits.find(f => f.id === state.activeFitId);
    if (active) renderStats(active); else setConsole('Fit removed.', '');
    updatePlots();
  });

  /* ── Clear all ────────────────────────────────────────── */
  document.getElementById('btn-clear-all').addEventListener('click', () => {
    state.datasets = []; state.fits = [];
    state.activeDatasetId = null; state.activeFitId = null;
    state.selection = { dsId: null, indices: new Set() };
    if (state.selectedDatasetIds) state.selectedDatasetIds.clear();
    syncFitDatasetSelect(); renderDatasetList(); renderFitList();
    updatePlots();
    setConsole('All datasets and fits cleared.', '');
  });

  document.getElementById('btn-combine-ds').addEventListener('click', combineSelectedDatasets);

  /* ── Clear all fits ───────────────────────────────────── */
  document.getElementById('btn-clear-all-fits').addEventListener('click', () => {
    state.fits = [];
    state.activeFitId = null;
    renderFitList();
    updatePlots();
    setConsole('All fits cleared.', '');
  });

  /* ── Model select ─────────────────────────────────────── */
  document.getElementById('model-select').addEventListener('change', syncModelCustomSection);

  /* ── Edit as Custom button ────────────────────────────── */
  document.getElementById('model-edit-as-custom').addEventListener('click', () => {
    const model = document.getElementById('model-select').value;
    const jsEq = MODEL_EQ_JS[model];
    if (!jsEq) return;
    const eqInput = document.getElementById('custom-eq-input');
    eqInput.value = jsEq;
    document.getElementById('model-select').value = 'Custom';
    syncModelCustomSection();
  });

  /* ── Custom equation input ────────────────────────────── */
  let eqDebounce;
  document.getElementById('custom-eq-input').addEventListener('input', e => {
    clearTimeout(eqDebounce);
    eqDebounce = setTimeout(() => parseCustomEquation(e.target.value), 400);
  });

  /* ── Auto init ────────────────────────────────────────── */
  document.getElementById('btn-auto-init').addEventListener('click', autoInitParams);
  document.getElementById('btn-try-all').addEventListener('click', tryAllModels);
  document.getElementById('btn-fit-all').addEventListener('click', runFitAllDatasets);
  document.getElementById('constraint-add-select').addEventListener('change', function () {
    renderConstraintBuilder(this.value);
  });
  document.getElementById('model-compare-close').addEventListener('click', () => {
    document.getElementById('model-compare-modal').style.display = 'none';
  });
  document.getElementById('model-compare-modal').addEventListener('click', e => {
    if (e.target === e.currentTarget) e.currentTarget.style.display = 'none';
  });

  document.getElementById('btn-copy-params').addEventListener('click', () => {
    const fit = state.fits.find(f => f.id === state.activeFitId);
    if (!fit || !fit.result || !fit.paramNames.length) { setConsole('No active fit parameters to copy.', 'error'); return; }
    const ds = state.datasets.find(d => d.id === fit.dsId);
    const r = fit.result;
    const lines = [
      `Fit:     ${fit.label || fit.model}`,
      `Model:   ${fit.model}`,
      `Dataset: ${ds ? ds.name : 'unknown'}`,
      '',
      'Parameters',
    ];
    fit.paramNames.forEach((name, i) => {
      const val = r.params[i];
      const err = r.paramErrors && r.paramErrors[i];
      lines.push(err && isFinite(err)
        ? `  ${name.padEnd(8)} = ${fmt(val)} ± ${fmt(err)}`
        : `  ${name.padEnd(8)} = ${fmt(val)}`);
    });
    lines.push('');
    lines.push('Statistics');
    lines.push(`  R²       = ${isFinite(r.rSq)     ? r.rSq.toFixed(6)     : 'N/A'}`);
    lines.push(`  Adj-R²   = ${isFinite(r.adjRSq)  ? r.adjRSq.toFixed(6)  : 'N/A'}`);
    lines.push(`  RMSE     = ${isFinite(r.rmse)    ? fmt(r.rmse)          : 'N/A'}`);
    lines.push(`  SSE      = ${isFinite(r.sse)     ? fmt(r.sse)           : 'N/A'}`);
    lines.push(`  AIC      = ${isFinite(r.aic)     ? r.aic.toFixed(3)     : 'N/A'}`);
    lines.push(`  BIC      = ${isFinite(r.bic)     ? r.bic.toFixed(3)     : 'N/A'}`);
    if (r.chiSqRed != null) lines.push(`  χ²ᵣ      = ${fmt(r.chiSqRed)}`);
    lines.push(`  N        = ${r.n}`);
    lines.push(`  Status   = ${r.converged ? 'Converged' : 'Not converged'} (${r.iter} iter)`);
    // Extended diagnostics
    const _ds2 = state.datasets.find(d => d.id === fit.dsId);
    const _excl2 = (_ds2 && _ds2.excludedIndices) || new Set();
    const _yv2 = _ds2 ? _ds2.y.filter((_, i) => !_excl2.has(i)) : [];
    const _res2 = r.residuals || [];
    if (_res2.length) {
      const _mae = _res2.reduce((s, e) => s + Math.abs(e), 0) / _res2.length;
      const _maxE = Math.max(..._res2.map(Math.abs));
      const _ym = _yv2.length ? _yv2.reduce((s, y) => s + y, 0) / _yv2.length : 0;
      lines.push('');
      lines.push('Diagnostics');
      lines.push(`  MAE      = ${fmt(_mae)}`);
      lines.push(`  Max|e|   = ${fmt(_maxE)}`);
      if (isFinite(r.rmse) && Math.abs(_ym) > 1e-12)
        lines.push(`  CV%      = ${(r.rmse / Math.abs(_ym) * 100).toFixed(2)}%`);
      const _dof2 = r.dof || 1;
      lines.push(`  df       = ${_dof2}`);
      if (r.n > 0 && r.sse > 0)
        lines.push(`  Log-lik  = ${(-r.n / 2 * (Math.log(2 * Math.PI * r.sse / r.n) + 1)).toFixed(3)}`);
      const _nP2 = fit.paramNames ? fit.paramNames.length : 0;
      if (_yv2.length >= 2 && _nP2 > 0 && r.sse != null && _dof2 > 0) {
        const _sst = _yv2.reduce((s, y) => s + (y - _ym) ** 2, 0);
        const _ssr = _sst - r.sse;
        if (_ssr > 0) {
          const _fS = (_ssr / _nP2) / (r.sse / _dof2);
          const _fP = fDistPValue(_fS, _nP2, _dof2);
          lines.push(`  F-stat   = ${fmt(_fS, 4)}${_fP < 0.001 ? ' (p<0.001)' : ` (p=${_fP.toFixed(3)})`}`);
        }
      }
      const _dw = durbinWatson(_res2);
      if (_dw != null) lines.push(`  DW       = ${_dw.toFixed(3)}`);
      const _rp = runsTestP(_res2);
      if (_rp != null) lines.push(`  Runs p   = ${_rp < 0.001 ? '< 0.001' : _rp.toFixed(3)}`);
      const _cj = jacobianConditionNumber(r.covMatrix);
      if (_cj != null) lines.push(`  Cond(J)  = ${_cj > 9999 ? _cj.toExponential(2) : _cj.toFixed(1)}`);
    }
    navigator.clipboard.writeText(lines.join('\n'))
      .then(() => setConsole('Parameters and stats copied to clipboard.', ''))
      .catch(() => setConsole('Clipboard access denied.', 'error'));
  });

  document.getElementById('opt-extrap-xmin').addEventListener('input', function () {
    const v = parseFloat(this.value);
    state.fitConfig.xExtraMin = isFinite(v) ? v : null;
    if (state.fits.length) updatePlots();
  });
  document.getElementById('opt-extrap-xmax').addEventListener('input', function () {
    const v = parseFloat(this.value);
    state.fitConfig.xExtraMax = isFinite(v) ? v : null;
    if (state.fits.length) updatePlots();
  });
  document.getElementById('btn-extrap-reset').addEventListener('click', () => {
    state.fitConfig.xExtraMin = null;
    state.fitConfig.xExtraMax = null;
    document.getElementById('opt-extrap-xmin').value = '';
    document.getElementById('opt-extrap-xmax').value = '';
    if (state.fits.length) updatePlots();
  });

  /* ── Toggle buttons ───────────────────────────────────── */
  document.getElementById('btn-toggle-residuals').addEventListener('click', function () {
    state.plotConfig.showResiduals = !state.plotConfig.showResiduals;
    this.classList.toggle('active', state.plotConfig.showResiduals);
    document.getElementById('residual-tab-bar').classList.toggle('hidden', !state.plotConfig.showResiduals);
    document.getElementById('residual-plot').classList.toggle('hidden', !state.plotConfig.showResiduals);
    requestAnimationFrame(() => {
      Plotly.Plots.resize('main-plot');
      if (state.plotConfig.showResiduals) Plotly.Plots.resize('residual-plot');
    });
  });
  document.getElementById('btn-ci-bands').addEventListener('click', function () {
    state.plotConfig.showCI = !state.plotConfig.showCI;
    this.classList.toggle('active', state.plotConfig.showCI);
    updatePlots();
  });
  document.getElementById('btn-pi-bands').addEventListener('click', function () {
    state.plotConfig.showPI = !state.plotConfig.showPI;
    this.classList.toggle('active', state.plotConfig.showPI);
    updatePlots();
  });
  document.getElementById('btn-norm-resid').addEventListener('click', function () {
    state.plotConfig.normalizeResiduals = !state.plotConfig.normalizeResiduals;
    this.classList.toggle('active', state.plotConfig.normalizeResiduals);
    updatePlots();
  });
  document.getElementById('btn-show-outliers').addEventListener('click', function () {
    state.plotConfig.showOutliers = !state.plotConfig.showOutliers;
    this.classList.toggle('active', state.plotConfig.showOutliers);
    updatePlots();
  });
  document.getElementById('btn-mask-outliers').addEventListener('click', () => {
    const fit = state.fits.find(f => f.id === state.activeFitId);
    if (!fit || !fit.result || fit.result.rmse <= 0) { setConsole('Run a fit first.', 'warn'); return; }
    const ds = state.datasets.find(d => d.id === fit.dsId);
    if (!ds) return;
    if (!ds.excludedIndices) ds.excludedIndices = new Set();
    const { pairs, rmse } = getLiveResidualsWithIdx(fit, ds);
    const threshold = 2.5 * rmse;
    let added = 0;
    pairs.forEach(({ origIdx, r }) => {
      if (Math.abs(r) > threshold && !ds.excludedIndices.has(origIdx)) {
        ds.excludedIndices.add(origIdx); added++;
      }
    });
    renderDatasetList(); updatePlots();
    setConsole(added > 0 ? `Masked ${added} outlier(s) — re-fit to update.` : 'No new outliers above 2.5σ.', '');
  });
  document.getElementById('btn-unmask-all').addEventListener('click', () => {
    const ds = state.datasets.find(d => d.id === state.activeDatasetId);
    if (!ds) { setConsole('No active dataset.', 'warn'); return; }
    const n = ds.excludedIndices ? ds.excludedIndices.size : 0;
    ds.excludedIndices = new Set();
    renderDatasetList(); updatePlots();
    setConsole(n > 0 ? `Unmasked ${n} point(s).` : 'No masked points.', '');
  });
  // Pre-Process modal
  (function() {
    const ppModal = document.getElementById('preprocess-modal');
    const closePP = () => { ppModal.style.display = 'none'; };
    document.getElementById('btn-preprocess').addEventListener('click', () => { ppModal.style.display = 'flex'; syncUndoRedoButtons(); });
    document.getElementById('pp-modal-close').addEventListener('click', closePP);
    document.getElementById('pp-close').addEventListener('click', closePP);
    ppModal.addEventListener('click', e => { if (e.target === ppModal) closePP(); });

    const smDescs = {
      movavg:  'Replaces each point with the unweighted mean of its neighbors. Fast and simple; blurs sharp features.',
      gaussian:'Weighted average using a Gaussian kernel — nearer points contribute more. Better shape preservation than moving average.',
      savgol:  'Fits a local polynomial to each window (Savitzky-Golay). Best for preserving peak heights and curvature.',
      median:  'Replaces each point with the window median. Excellent at removing spike noise while keeping edges sharp.'
    };
    const fftDescs = {
      lowpass: 'Passes low-frequency components; removes rapid fluctuations. Good for denoising signals with a smooth trend.',
      highpass:'Removes slow baseline drift; passes rapid variations and fine structure.',
      bandpass:'Passes only a specified frequency band. Useful for isolating a periodic signal of known frequency.',
      notch:   'Rejects a specific frequency band. Useful for eliminating periodic interference (e.g. 50/60 Hz hum).'
    };

    const smMethod = document.getElementById('pp-sm-method');
    smMethod.addEventListener('change', () => {
      const m = smMethod.value;
      document.getElementById('pp-sm-sigma-row').style.display = m === 'gaussian' ? 'flex' : 'none';
      document.getElementById('pp-sm-poly-row').style.display  = m === 'savgol'   ? 'flex' : 'none';
      document.getElementById('pp-sm-desc').textContent = smDescs[m] || '';
    });

    document.getElementById('pp-sm-apply').addEventListener('click', () => {
      const method = smMethod.value;
      const win    = parseInt(document.getElementById('pp-sm-win').value)   || 5;
      const sigma  = parseFloat(document.getElementById('pp-sm-sigma').value) || 1.5;
      const poly   = parseInt(document.getElementById('pp-sm-poly').value)  || 3;
      applySmoothing(method, win, sigma, poly);
      if (_specVisible) renderFFTSpectrum();
    });

    const fftType = document.getElementById('pp-fft-type');
    fftType.addEventListener('change', () => {
      const t = fftType.value;
      const single = t === 'lowpass' || t === 'highpass';
      document.getElementById('pp-fft-cutoff-row').style.display = single ? 'flex' : 'none';
      document.getElementById('pp-fft-lo-row').style.display     = single ? 'none' : 'flex';
      document.getElementById('pp-fft-hi-row').style.display     = single ? 'none' : 'flex';
      document.getElementById('pp-fft-desc').textContent = fftDescs[t] || '';
      // Update cutoff lines reactively
      if (_specVisible) {
        const el = document.getElementById('pp-fft-spectrum-plot');
        if (el?.data) Plotly.relayout(el, { shapes: _ppCutoffShapes() });
      }
    });

    document.getElementById('pp-fft-apply').addEventListener('click', () => {
      const t       = fftType.value;
      const rolloff = document.getElementById('pp-fft-rolloff').value;
      const single  = t === 'lowpass' || t === 'highpass';
      let lo = single ? parseFloat(document.getElementById('pp-fft-cutoff').value) || 20
                      : parseFloat(document.getElementById('pp-fft-lo').value) || 10;
      let hi = single ? lo : parseFloat(document.getElementById('pp-fft-hi').value) || 30;
      if (hi < lo) [lo, hi] = [hi, lo];
      applyFourierFilter(t, lo, hi, rolloff);
      if (_specVisible) renderFFTSpectrum(); // re-render with filtered data
    });

    document.getElementById('pp-undo').addEventListener('click', () => {
      if (!state.editHistory.undo.length) { setConsole('Nothing to undo.', ''); return; }
      undoEdit();
      if (_specVisible) renderFFTSpectrum();
    });

    document.getElementById('pp-restore').addEventListener('click', () => {
      restoreOriginalData();
      if (_specVisible) renderFFTSpectrum();
    });

    // ── Normalize / Transform (#3) ────────────────────────────
    const tfDescs = {
      minmax: 'Linearly rescales to the [0, 1] interval. A display convenience — note it changes parameter scale and meaning.',
      zscore: 'Centres to mean 0 and scales to unit standard deviation. Useful for comparing differently-scaled signals.',
      log:    'Natural logarithm — variance-stabilising for multiplicative/exponential data. Requires all Y > 0.',
      log10:  'Base-10 logarithm — same as ln but in decades. Requires all Y > 0.',
      sqrt:   'Square root — variance-stabilising for Poisson-like count data. Requires Y ≥ 0.',
      boxcox: 'Box–Cox power transform with parameter λ (λ = 0 ⇒ log). Requires all Y > 0. Use Auto to maximise the profile likelihood.'
    };
    const tfMethod = document.getElementById('pp-tf-method');
    tfMethod.addEventListener('change', () => {
      document.getElementById('pp-tf-lambda-row').style.display = tfMethod.value === 'boxcox' ? 'flex' : 'none';
      document.getElementById('pp-tf-desc').textContent = tfDescs[tfMethod.value] || '';
    });
    document.getElementById('pp-tf-lambda-auto').addEventListener('click', () => {
      const ds = state.datasets.find(d => d.id === state.activeDatasetId);
      if (!ds) { setConsole('No active dataset.', 'warn'); return; }
      if (ds.y.some(v => !(v > 0))) { setConsole('Box–Cox requires all Y > 0.', 'error'); return; }
      const lam = _boxcoxAutoLambda(ds.y);
      document.getElementById('pp-tf-lambda').value = lam;
      setConsole(`Auto Box–Cox λ = ${lam} (maximum-likelihood estimate).`, '');
    });
    document.getElementById('pp-tf-apply').addEventListener('click', () => {
      const lam = parseFloat(document.getElementById('pp-tf-lambda').value);
      applyTransform(tfMethod.value, lam);
      if (_specVisible) renderFFTSpectrum();
    });

    // ── Baseline / De-trend (#5) ──────────────────────────────
    const blDescs = {
      poly:   'Fits a low-order polynomial trend and subtracts it — good for removing drift or background under peaks and oscillations.',
      lowess: 'Fits a locally-weighted regression (tricube kernel) baseline and subtracts it — follows slow, non-polynomial trends.'
    };
    const blMethod = document.getElementById('pp-bl-method');
    blMethod.addEventListener('change', () => {
      const poly = blMethod.value === 'poly';
      document.getElementById('pp-bl-deg-row').style.display  = poly ? 'flex' : 'none';
      document.getElementById('pp-bl-frac-row').style.display = poly ? 'none' : 'flex';
      document.getElementById('pp-bl-desc').textContent = blDescs[blMethod.value] || '';
    });
    document.getElementById('pp-bl-apply').addEventListener('click', () => {
      const deg  = parseInt(document.getElementById('pp-bl-deg').value) || 1;
      const frac = parseFloat(document.getElementById('pp-bl-frac').value) || 0.3;
      applyBaseline(blMethod.value, deg, frac);
      if (_specVisible) renderFFTSpectrum();
    });

    // ── Repair / Impute (#4) ──────────────────────────────────
    const rpDescs = {
      outliers: 'Flags points whose robust (MAD-based) z-score exceeds the threshold and replaces them with an interpolated estimate from the remaining points.',
      nan:      'Replaces any non-finite (NaN/Inf) Y values with an interpolated estimate from the surrounding finite points.'
    };
    const rpMethod = document.getElementById('pp-rp-method');
    rpMethod.addEventListener('change', () => {
      document.getElementById('pp-rp-thresh-row').style.display = rpMethod.value === 'outliers' ? 'flex' : 'none';
      document.getElementById('pp-rp-desc').textContent = rpDescs[rpMethod.value] || '';
    });
    document.getElementById('pp-rp-apply').addEventListener('click', () => {
      const thresh = parseFloat(document.getElementById('pp-rp-thresh').value) || 3.5;
      const fill   = document.getElementById('pp-rp-fill').value;
      applyRepair(rpMethod.value, thresh, fill);
      if (_specVisible) renderFFTSpectrum();
    });

    // ── Spectrum preview ──────────────────────────────────────
    let _specVisible = false;
    const specBtn  = document.getElementById('pp-fft-spectrum-btn');
    const specWrap = document.getElementById('pp-fft-spectrum-wrap');

    specBtn.addEventListener('click', () => {
      _specVisible = !_specVisible;
      specWrap.style.display = _specVisible ? 'block' : 'none';
      specBtn.textContent = _specVisible ? '▤ Hide Spectrum' : '▤ Show Spectrum';
      if (_specVisible) renderFFTSpectrum();
    });

    document.getElementById('pp-fft-db-scale').addEventListener('change', () => {
      if (_specVisible) renderFFTSpectrum();
    });

    // View toggle: Spectrum ↔ Spectrogram
    ['spectrum', 'stft'].forEach(view => {
      document.getElementById(`pp-spec-btn-${view}`).addEventListener('click', () => {
        _ppSpecView = view;
        document.getElementById('pp-spec-btn-spectrum').classList.toggle('pp-sv-on', view === 'spectrum');
        document.getElementById('pp-spec-btn-stft').classList.toggle('pp-sv-on', view === 'stft');
        document.getElementById('pp-spec-label').textContent = view === 'stft'
          ? 'Spectrogram (STFT) — x: % Nyquist, y: sample pos., color: amplitude'
          : 'Power spectrum — red ▾ = detected peaks · dashed = cutoff';
        if (_specVisible) renderFFTSpectrum();
      });
    });

    // Reactive cutoff marker lines while typing
    ['pp-fft-cutoff', 'pp-fft-lo', 'pp-fft-hi'].forEach(id => {
      document.getElementById(id).addEventListener('input', () => {
        if (!_specVisible) return;
        const el = document.getElementById('pp-fft-spectrum-plot');
        if (el?.data) Plotly.relayout(el, { shapes: _ppCutoffShapes() });
      });
    });
  })();
  document.getElementById('btn-data-table').addEventListener('click', openDataTable);
  document.getElementById('data-table-close').addEventListener('click', () => {
    document.getElementById('data-table-modal').style.display = 'none';
  });
  document.getElementById('data-table-close2').addEventListener('click', () => {
    document.getElementById('data-table-modal').style.display = 'none';
  });
  document.getElementById('data-table-modal').addEventListener('click', e => {
    if (e.target === document.getElementById('data-table-modal')) document.getElementById('data-table-modal').style.display = 'none';
  });
  document.getElementById('dt-check-all').addEventListener('change', function () {
    const ds = state.datasets.find(d => d.id === state.activeDatasetId);
    if (!ds) return;
    if (this.checked) {
      ds.excludedIndices = new Set();
    } else {
      ds.excludedIndices = new Set(ds.x.map((_, i) => i));
    }
    openDataTable();
    renderMaskCount();
    updatePlots();
  });
  document.getElementById('dt-include-all').addEventListener('click', () => {
    const ds = state.datasets.find(d => d.id === state.activeDatasetId);
    if (!ds) return;
    ds.excludedIndices = new Set();
    openDataTable();
    renderMaskCount();
    updatePlots();
  });
  document.getElementById('dt-exclude-selected').addEventListener('click', () => {
    const ds = state.datasets.find(d => d.id === state.activeDatasetId);
    const fit = state.fits.find(f => f.id === state.activeFitId && f.dsId === ds?.id);
    if (!fit || !fit.result || fit.result.rmse <= 0) { setConsole('Run a fit first.', 'warn'); return; }
    if (!ds) return;
    if (!ds.excludedIndices) ds.excludedIndices = new Set();
    const { pairs, rmse } = getLiveResidualsWithIdx(fit, ds);
    const threshold = 2.5 * rmse;
    let added = 0;
    pairs.forEach(({ origIdx, r }) => {
      if (Math.abs(r) > threshold) { ds.excludedIndices.add(origIdx); added++; }
    });
    openDataTable();
    renderMaskCount();
    updatePlots();
    setConsole(added > 0 ? `Excluded ${added} outlier(s).` : 'No outliers above 2.5σ.', '');
  });

  /* ── Column picker modal ──────────────────────────────────── */
  document.getElementById('col-picker-close').addEventListener('click', () => {
    document.getElementById('col-picker-modal').style.display = 'none'; _pendingImport = null;
  });
  document.getElementById('col-picker-cancel').addEventListener('click', () => {
    document.getElementById('col-picker-modal').style.display = 'none'; _pendingImport = null;
  });
  document.getElementById('col-picker-modal').addEventListener('click', e => {
    if (e.target === document.getElementById('col-picker-modal')) {
      document.getElementById('col-picker-modal').style.display = 'none'; _pendingImport = null;
    }
  });
  document.getElementById('col-picker-mode').addEventListener('change', updateColPickerMode);
  document.getElementById('col-picker-x').addEventListener('change', updateColPickerPreview);
  document.getElementById('col-picker-y').addEventListener('change', updateColPickerPreview);
  document.getElementById('col-picker-sig').addEventListener('change', updateColPickerPreview);
  document.getElementById('col-picker-group').addEventListener('change', updateColPickerPreview);
  document.getElementById('col-picker-agg').addEventListener('change', updateColPickerPreview);
  document.getElementById('col-picker-sigmethod').addEventListener('change', updateColPickerPreview);
  document.getElementById('col-picker-import').addEventListener('click', importFromColumnPicker);

  /* ── Residual tabs ────────────────────────────────────── */
  document.querySelectorAll('.resid-tab').forEach(btn => {
    btn.addEventListener('click', function () {
      state.plotConfig.residualTab = this.dataset.tab;
      document.querySelectorAll('.resid-tab').forEach(b => b.classList.toggle('active', b === this));
      updatePlots();
    });
  });

  /* ── Log-scale suggest banner ─────────────────────────── */
  document.getElementById('log-suggest-apply-x').addEventListener('click', () => {
    state.plotConfig.logX = true;
    updatePlots();
  });
  document.getElementById('log-suggest-apply-y').addEventListener('click', () => {
    state.plotConfig.logY = true;
    updatePlots();
  });
  document.getElementById('log-suggest-dismiss').addEventListener('click', () => {
    if (!state.plotConfig.logSuggestDismissed) state.plotConfig.logSuggestDismissed = {};
    state.plotConfig.logSuggestDismissed.x = true;
    state.plotConfig.logSuggestDismissed.y = true;
    document.getElementById('log-suggest-banner').style.display = 'none';
  });

  /* ── Plot label live update ───────────────────────────── */
  let _labelDebounce;
  ['plot-xlabel','plot-ylabel','plot-title'].forEach(id => {
    document.getElementById(id).addEventListener('input', () => {
      clearTimeout(_labelDebounce);
      _labelDebounce = setTimeout(() => { if (state.datasets.length) updatePlots(); }, 300);
    });
  });

  /* ── Export ───────────────────────────────────────────── */
  const _closeExport = () => document.getElementById('export-menu').classList.remove('open');
  document.getElementById('exp-png')       .addEventListener('click', () => { exportPNG();              _closeExport(); });
  document.getElementById('exp-svg')       .addEventListener('click', () => { exportSVG();              _closeExport(); });
  document.getElementById('exp-copy-plot') .addEventListener('click', () => { copyPlotToClipboard();    _closeExport(); });
  document.getElementById('exp-html')      .addEventListener('click', () => { exportStandaloneHTML();   _closeExport(); });
  document.getElementById('exp-csv')       .addEventListener('click', () => { exportCSV();              _closeExport(); });
  document.getElementById('exp-report')    .addEventListener('click', () => { exportReport();           _closeExport(); });
  document.getElementById('exp-excel')     .addEventListener('click', () => { exportExcel();            _closeExport(); });
  document.getElementById('exp-json')      .addEventListener('click', () => { exportJSON();             _closeExport(); });
  document.getElementById('exp-python')    .addEventListener('click', () => { exportPython();           _closeExport(); });
  document.getElementById('exp-jupyter')   .addEventListener('click', () => { exportJupyter();          _closeExport(); });
  document.getElementById('exp-r')         .addEventListener('click', () => { exportR();                _closeExport(); });
  document.getElementById('exp-latex')     .addEventListener('click', () => { exportLatex();            _closeExport(); });
  document.getElementById('exp-latex-doc') .addEventListener('click', () => { exportLatexDoc();         _closeExport(); });
  document.getElementById('exp-matlab')    .addEventListener('click', () => { exportMATLAB();           _closeExport(); });
  document.getElementById('exp-bibtex')    .addEventListener('click', () => { exportBibTeX();           _closeExport(); });

  /* ── Session ──────────────────────────────────────────── */
  document.getElementById('btn-save').addEventListener('click', saveSession);
  document.getElementById('btn-load').addEventListener('click', loadSession);

  function syncSessionAutoRestore() {
    const isOn = localStorage.getItem('cfs_autorestore') !== '0';
    const item = document.getElementById('sess-auto-restore');
    if (item) item.textContent = (isOn ? '● ' : '○ ') + ' Auto-restore';
  }
  syncSessionAutoRestore();

  document.getElementById('sess-save').addEventListener('click', () => {
    saveSession();
    const m = document.getElementById('session-menu');
    m.classList.remove('open'); m.style.cssText = '';
  });
  document.getElementById('sess-load').addEventListener('click', () => {
    loadSession();
    const m = document.getElementById('session-menu');
    m.classList.remove('open'); m.style.cssText = '';
  });
  document.getElementById('sess-shortcuts').addEventListener('click', () => {
    document.getElementById('shortcuts-modal').style.display = 'flex';
    const m = document.getElementById('session-menu');
    m.classList.remove('open'); m.style.cssText = '';
  });
  document.getElementById('sess-settings').addEventListener('click', () => openSettings());

  // Settings modal controls
  document.getElementById('settings-modal-close')?.addEventListener('click', () => { document.getElementById('settings-modal').style.display = 'none'; });
  document.getElementById('settings-modal-close-btn')?.addEventListener('click', () => { document.getElementById('settings-modal').style.display = 'none'; });

  function settChanged() {
    CFS_SETTINGS.uiFontSize    = parseFloat(document.getElementById('sett-font-size').value) || 15;
    CFS_SETTINGS.uiFontFamily  = document.getElementById('sett-font-family').value;
    CFS_SETTINGS.monoFont      = document.getElementById('sett-mono-font').value;
    CFS_SETTINGS.animSpeed     = document.getElementById('sett-anim-speed').value;
    CFS_SETTINGS.defaultAlgo   = document.getElementById('sett-algo').value;
    CFS_SETTINGS.defaultPilots = parseInt(document.getElementById('sett-pilots').value) || 8;
    CFS_SETTINGS.defaultWeights= document.getElementById('sett-weights').value;
    CFS_SETTINGS.displayDecimals = parseInt(document.getElementById('sett-decimals').value) || 5;
    CFS_SETTINGS.fitLineWidth  = parseFloat(document.getElementById('sett-line-width').value) || 2;
    CFS_SETTINGS.markerSize    = parseInt(document.getElementById('sett-marker-size').value) || 6;
    CFS_SETTINGS.defaultCI     = document.getElementById('sett-default-ci').checked;
    CFS_SETTINGS.defaultLegend = document.getElementById('sett-default-legend').checked;
    applySettings(CFS_SETTINGS);
    saveSettings();
    if (CFS_SETTINGS.fitLineWidth || CFS_SETTINGS.markerSize) updatePlots();
    document.getElementById('sett-font-size-val').textContent = CFS_SETTINGS.uiFontSize + 'px';
    document.getElementById('sett-line-width-val').textContent = CFS_SETTINGS.fitLineWidth + 'px';
    document.getElementById('sett-marker-size-val').textContent = CFS_SETTINGS.markerSize + 'px';
  }

  ['sett-font-size','sett-font-family','sett-mono-font','sett-anim-speed','sett-algo','sett-pilots','sett-weights','sett-decimals','sett-line-width','sett-marker-size','sett-default-ci','sett-default-legend'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', settChanged);
    document.getElementById(id)?.addEventListener('input', settChanged);
  });

  document.getElementById('sett-theme-light')?.addEventListener('click', () => {
    document.body.classList.remove('dark-mode');
    const dt = document.getElementById('dark-toggle');
    if (dt) dt.checked = false;
    localStorage.setItem('dark', '0');
    document.getElementById('sett-theme-dark')?.classList.remove('active');
    document.getElementById('sett-theme-light')?.classList.add('active');
    updatePlots();
  });

  document.getElementById('sett-theme-dark')?.addEventListener('click', () => {
    document.body.classList.add('dark-mode');
    const dt = document.getElementById('dark-toggle');
    if (dt) dt.checked = true;
    localStorage.setItem('dark', '1');
    document.getElementById('sett-theme-light')?.classList.remove('active');
    document.getElementById('sett-theme-dark')?.classList.add('active');
    updatePlots();
  });

  document.getElementById('sett-reset-btn')?.addEventListener('click', () => {
    CFS_SETTINGS = { ...SETT_DEFAULTS };
    saveSettings();
    applySettings(CFS_SETTINGS);
    openSettings(); // repopulate
    updatePlots();
  });

  document.getElementById('sess-tutorial').addEventListener('click', () => {
    const m = document.getElementById('session-menu');
    m.classList.remove('open'); m.style.cssText = '';
    localStorage.removeItem(TUT_KEY);
    tutShow();
  });
  function openReleaseNotes() {
    document.getElementById('relnotes-modal').style.display = 'flex';
    const m = document.getElementById('session-menu');
    if (m) { m.classList.remove('open'); m.style.cssText = ''; }
  }
  function openSettings() {
    const m = document.getElementById('session-menu');
    if (m) { m.classList.remove('open'); m.style.cssText = ''; }
    const modal = document.getElementById('settings-modal');
    if (!modal) return;
    // Populate controls from CFS_SETTINGS
    const s = CFS_SETTINGS;
    const fontSize = document.getElementById('sett-font-size');
    if (fontSize) { fontSize.value = s.uiFontSize; document.getElementById('sett-font-size-val').textContent = s.uiFontSize + 'px'; }
    const ff = document.getElementById('sett-font-family');
    if (ff) ff.value = s.uiFontFamily;
    const mf = document.getElementById('sett-mono-font');
    if (mf) mf.value = s.monoFont;
    const as = document.getElementById('sett-anim-speed');
    if (as) as.value = s.animSpeed;
    const algo = document.getElementById('sett-algo');
    if (algo) algo.value = s.defaultAlgo;
    const pilots = document.getElementById('sett-pilots');
    if (pilots) pilots.value = String(s.defaultPilots);
    const weights = document.getElementById('sett-weights');
    if (weights) weights.value = s.defaultWeights;
    const dec = document.getElementById('sett-decimals');
    if (dec) dec.value = String(s.displayDecimals);
    const lw = document.getElementById('sett-line-width');
    if (lw) { lw.value = s.fitLineWidth; document.getElementById('sett-line-width-val').textContent = s.fitLineWidth + 'px'; }
    const ms = document.getElementById('sett-marker-size');
    if (ms) { ms.value = s.markerSize; document.getElementById('sett-marker-size-val').textContent = s.markerSize + 'px'; }
    const ci = document.getElementById('sett-default-ci');
    if (ci) ci.checked = s.defaultCI;
    const leg = document.getElementById('sett-default-legend');
    if (leg) leg.checked = s.defaultLegend;
    // Theme buttons
    const isDark = document.body.classList.contains('dark-mode');
    document.getElementById('sett-theme-dark')?.classList.toggle('active', isDark);
    document.getElementById('sett-theme-light')?.classList.toggle('active', !isDark);
    modal.style.display = 'flex';
  }

  document.getElementById('sess-relnotes').addEventListener('click', openReleaseNotes);
  document.getElementById('btn-relnotes').addEventListener('click', openReleaseNotes);
  const heroReln = document.getElementById('hero-relnotes');
  if (heroReln) heroReln.addEventListener('click', openReleaseNotes);
  document.getElementById('relnotes-modal-close').addEventListener('click', () => {
    document.getElementById('relnotes-modal').style.display = 'none';
  });
  document.getElementById('relnotes-modal-close-btn').addEventListener('click', () => {
    document.getElementById('relnotes-modal').style.display = 'none';
  });
  document.getElementById('relnotes-modal').addEventListener('click', e => {
    if (e.target === document.getElementById('relnotes-modal')) document.getElementById('relnotes-modal').style.display = 'none';
  });
  document.getElementById('sess-auto-restore').addEventListener('click', () => {
    document.getElementById('btn-auto-restore').click();
    syncSessionAutoRestore();
    const m = document.getElementById('session-menu');
    m.classList.remove('open'); m.style.cssText = '';
  });

  /* ── Full-screen overlay open / close ─────────────────── */
  const appOverlay = document.getElementById('app-overlay');
  let appEverOpened = false;
  function openApp() {
    appOverlay.classList.add('open');
    document.body.style.overflow = 'hidden';
    document.getElementById('accBtn').style.display = 'none';
    requestAnimationFrame(() => {
      if (!appEverOpened) {
        // First open: plots were init'd in a hidden zero-size div — do a full re-render
        plotsInitialised = false;
        updatePlots();
        appEverOpened = true;
        if (localStorage.getItem(TUT_KEY) !== '1') setTimeout(tutShow, 320);
      } else {
        // Re-open: theme may have changed while app was closed — re-render with current colors
        updatePlots();
      }
    });
  }
  function closeApp() {
    appOverlay.classList.remove('open');
    document.body.style.overflow = '';
    document.getElementById('accBtn').style.display = '';
  }
  const btnLaunch = document.getElementById('btn-launch-app');
  if (btnLaunch) btnLaunch.addEventListener('click', openApp);
  document.getElementById('btn-close-app').addEventListener('click', closeApp);

  // ── Mobile panel drawers ─────────────────────────────────────
  (function() {
    const leftPanel  = document.getElementById('panel-left');
    const rightPanel = document.getElementById('panel-right');
    const backdrop   = document.getElementById('mob-panel-backdrop');
    const btnL = document.getElementById('mob-btn-left');
    const btnR = document.getElementById('mob-btn-right');
    function mobClose() {
      leftPanel.classList.remove('mob-open');
      rightPanel.classList.remove('mob-open');
      backdrop.classList.remove('mob-active');
      btnL.classList.remove('mob-active');
      btnR.classList.remove('mob-active');
    }
    function mobToggle(panel, btn) {
      const opening = !panel.classList.contains('mob-open');
      mobClose();
      if (opening) {
        panel.classList.add('mob-open');
        backdrop.classList.add('mob-active');
        btn.classList.add('mob-active');
      }
    }
    btnL.addEventListener('click', () => mobToggle(leftPanel, btnL));
    btnR.addEventListener('click', () => mobToggle(rightPanel, btnR));
    backdrop.addEventListener('click', mobClose);
  })();
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && appOverlay.classList.contains('open')) {
      const openModal = document.querySelector('.app-modal[style*="flex"]');
      if (openModal) { openModal.style.display = 'none'; return; }
      closeApp();
    }
    if (e.key === '?' && appOverlay.classList.contains('open') && !e.target.matches('input,textarea,select')) {
      document.getElementById('shortcuts-modal').style.display = 'flex';
    }
  });
  document.getElementById('btn-shortcuts').addEventListener('click', () => {
    document.getElementById('shortcuts-modal').style.display = 'flex';
  });
  document.getElementById('shortcuts-modal-close').addEventListener('click', () => {
    document.getElementById('shortcuts-modal').style.display = 'none';
  });
  document.getElementById('shortcuts-modal-ok').addEventListener('click', () => {
    document.getElementById('shortcuts-modal').style.display = 'none';
  });
  document.getElementById('shortcuts-modal').addEventListener('click', e => {
    if (e.target === document.getElementById('shortcuts-modal')) document.getElementById('shortcuts-modal').style.display = 'none';
  });

  /* ── Equation Editor Modal ────────────────────────────────── */
  (function() {
    const overlay  = document.getElementById('eq-editor-modal');
    const ta       = document.getElementById('eq-editor-textarea');
    const statEl   = document.getElementById('eq-editor-status');
    const mainIn   = document.getElementById('custom-eq-input');

    const MATH_FNS = CUSTOM_EQ_MATH_SYMS;

    function validateExpr(expr) {
      if (!expr.trim()) { statEl.textContent = ''; return; }
      try {
        const syms = new Set();
        math.parse(expr).traverse(n => { if (n.type === 'SymbolNode') syms.add(n.name); });
        syms.delete('x');
        MATH_FNS.forEach(f => syms.delete(f));
        const params = [...syms].sort();
        if (!params.length) {
          statEl.style.color = 'var(--amber)';
          statEl.textContent = '⚠ No free parameters detected (only x)';
        } else {
          statEl.style.color = 'var(--teal)';
          statEl.textContent = `✓ Parameters: ${params.join(', ')}`;
        }
      } catch (err) {
        statEl.style.color = 'var(--red)';
        statEl.textContent = `✗ ${err.message}`;
      }
    }

    function insertAtCursor(text, cursorBack) {
      const s = ta.selectionStart, e = ta.selectionEnd;
      ta.value = ta.value.slice(0, s) + text + ta.value.slice(e);
      const pos = s + text.length + (cursorBack || 0);
      ta.selectionStart = ta.selectionEnd = pos;
      ta.focus();
      ta.dispatchEvent(new Event('input'));
    }

    function openEditor() {
      ta.value = mainIn.value;
      validateExpr(ta.value);
      overlay.style.display = 'flex';
      requestAnimationFrame(() => { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); });
    }
    function closeEditor() { overlay.style.display = 'none'; }

    document.getElementById('btn-eq-editor').addEventListener('click', openEditor);
    document.getElementById('eq-editor-close').addEventListener('click', closeEditor);
    document.getElementById('eq-editor-cancel').addEventListener('click', closeEditor);
    overlay.addEventListener('click', e => { if (e.target === overlay) closeEditor(); });

    document.getElementById('eq-editor-apply').addEventListener('click', () => {
      const expr = ta.value.trim();
      mainIn.value = expr;
      parseCustomEquation(expr);
      closeEditor();
    });

    let debounce;
    ta.addEventListener('input', () => { clearTimeout(debounce); debounce = setTimeout(() => validateExpr(ta.value), 280); });

    // Keyboard: Ctrl+Enter applies, Escape closes
    ta.addEventListener('keydown', e => {
      // stopPropagation on Escape: without it the global handler fires after
      // closeEditor() already hid the modal, finds no open modal, and calls closeApp().
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeEditor(); }
      if (e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); document.getElementById('eq-editor-apply').click(); }
    });

    // Palette buttons
    overlay.querySelectorAll('.eq-pal-btn[data-ins]').forEach(btn => {
      btn.addEventListener('click', () => insertAtCursor(btn.dataset.ins, btn.dataset.cur ? parseInt(btn.dataset.cur) : 0));
    });

    // Example items
    overlay.querySelectorAll('.eq-ex-item[data-eq]').forEach(item => {
      item.addEventListener('click', () => {
        ta.value = item.dataset.eq;
        ta.dispatchEvent(new Event('input'));
        ta.focus();
        ta.setSelectionRange(ta.value.length, ta.value.length);
      });
    });
  })();
  /* ────────────────────────────────────────────────────────── */

  document.getElementById('btn-auto-restore').addEventListener('click', () => {
    const isOn = localStorage.getItem('cfs_autorestore') !== '0';
    const next = !isOn;
    localStorage.setItem('cfs_autorestore', next ? '1' : '0');
    document.getElementById('btn-auto-restore').classList.toggle('active', next);
    setConsole(next ? 'Auto-restore ON — saved session will be restored on next reload.' : 'Auto-restore OFF — next reload will start fresh.', '');
    syncSessionAutoRestore();
  });

  /* ── Save modal ───────────────────────────────────────── */
  const saveModal = document.getElementById('save-modal');
  if (saveModal) {
    document.getElementById('save-modal-close').addEventListener('click', () => { saveModal.style.display = 'none'; });
    document.getElementById('save-modal-cancel').addEventListener('click', () => { saveModal.style.display = 'none'; });
    document.getElementById('save-modal-confirm').addEventListener('click', () => {
      const scope = saveModal.querySelector('input[name="save-scope"]:checked').value;
      let ids;
      if (scope === 'current') {
        ids = [activeTabId];
      } else if (scope === 'all') {
        ids = tabList.map(t => t.id);
      } else {
        ids = [...saveModal.querySelectorAll('.save-tab-cb:checked')].map(cb => cb.value);
      }
      saveModal.style.display = 'none';
      performSave(ids);
    });
    saveModal.addEventListener('click', e => { if (e.target === saveModal) saveModal.style.display = 'none'; });
  }

  /* ── Resize plots when window resizes ─────────────────── */
  window.addEventListener('resize', () => {
    if (plotsInitialised) { Plotly.Plots.resize('main-plot'); Plotly.Plots.resize('residual-plot'); }
  });

  /* ── Edit controls panel toggle ───────────────────────── */
  document.getElementById('btn-edit-mode').addEventListener('click', function () {
    const ctrl = document.getElementById('edit-mode-controls');
    const showing = ctrl.style.display === 'flex';
    ctrl.style.display = showing ? 'none' : 'flex';
    this.classList.toggle('active', !showing);
    if (!showing) syncUndoRedoButtons();
  });

  /* ── Undo / Redo / Reset buttons ─────────────────────── */
  document.getElementById('btn-edit-undo').addEventListener('click', undoEdit);
  document.getElementById('btn-edit-redo').addEventListener('click', redoEdit);
  document.getElementById('btn-edit-reset').addEventListener('click', resetSelectionToOriginal);

  /* ── Graph Style Editor ─────────────────────────────────── */
  document.getElementById('btn-graph-style').addEventListener('click', openGraphStyleEditor);
  document.getElementById('gs-modal-close').addEventListener('click',  () => { document.getElementById('gs-modal').style.display = 'none'; });
  document.getElementById('gs-cancel-btn').addEventListener('click',   () => { document.getElementById('gs-modal').style.display = 'none'; });
  document.getElementById('gs-save-btn').addEventListener('click', saveGraphStyle);
  document.getElementById('gs-reset-btn').addEventListener('click', () => {
    state.graphStyle = Object.assign({}, DEFAULT_GRAPH_STYLE);
    document.getElementById('gs-modal').style.display = 'none';
    updatePlots();
    setConsole('Graph style reset to theme defaults.', '');
  });
  document.getElementById('gs-modal').addEventListener('click', e => { if (e.target === e.currentTarget) e.currentTarget.style.display = 'none'; });
  document.getElementById('gs-font-family').addEventListener('change', function () {
    document.getElementById('gs-row-font-custom').style.display = this.value === '__custom__' ? '' : 'none';
  });
  // Sync color picker ↔ hex for all gs- color pairs
  [['gs-font-color','gs-font-color-hex'],['gs-plot-bg','gs-plot-bg-hex'],['gs-paper-bg','gs-paper-bg-hex'],
   ['gs-grid-x-color','gs-grid-x-color-hex'],['gs-grid-y-color','gs-grid-y-color-hex'],
   ['gs-zeroline-x-color','gs-zeroline-x-color-hex'],['gs-zeroline-y-color','gs-zeroline-y-color-hex'],
   ['gs-axis-line-color','gs-axis-line-color-hex'],['gs-legend-bg','gs-legend-bg-hex'],['gs-legend-border','gs-legend-border-hex']
  ].forEach(([pickId, hexId]) => {
    const pick = document.getElementById(pickId), hex = document.getElementById(hexId);
    if (!pick || !hex) return;
    pick.addEventListener('input', () => { hex.value = pick.value; });
    hex.addEventListener('input', () => { if (/^#[0-9a-fA-F]{6}$/.test(hex.value)) pick.value = hex.value; });
  });
  // Clear buttons restore individual fields to "auto"
  document.getElementById('gs-modal').addEventListener('click', e => {
    const id = e.target.dataset.gsClear;
    if (!id) return;
    const hexEl = document.getElementById(`gs-${id}-hex`);
    if (hexEl) hexEl.value = '';
  });

  /* ── Annotations ─────────────────────────────────────────── */
  document.getElementById('btn-ann-add').addEventListener('click', () => openAnnEditor(null));
  document.getElementById('btn-ann-peaks').addEventListener('click', autoAnnotatePeaks);
  document.getElementById('ann-modal-close').addEventListener('click', () => { document.getElementById('ann-modal').style.display = 'none'; });
  document.getElementById('ann-modal-cancel').addEventListener('click', () => { document.getElementById('ann-modal').style.display = 'none'; });
  document.getElementById('ann-modal-save').addEventListener('click', saveAnn);
  document.getElementById('ann-modal').addEventListener('click', e => { if (e.target === e.currentTarget) e.currentTarget.style.display = 'none'; });
  document.getElementById('ann-type').addEventListener('change', syncAnnModalSections);
  document.getElementById('ann-font-family').addEventListener('change', function () {
    document.getElementById('ann-row-font-custom').style.display = this.value === '__custom__' ? '' : 'none';
  });
  // Sync color picker ↔ hex text fields
  [['ann-font-color','ann-font-color-hex'],['ann-line-color','ann-line-color-hex'],['ann-arrow-color','ann-arrow-color-hex']].forEach(([pickId, hexId]) => {
    document.getElementById(pickId).addEventListener('input', function () { document.getElementById(hexId).value = this.value; });
    document.getElementById(hexId).addEventListener('input', function () {
      if (/^#[0-9a-fA-F]{6}$/.test(this.value)) document.getElementById(pickId).value = this.value;
    });
  });
  // Opacity sliders display value
  document.getElementById('ann-bg-opacity').addEventListener('input', function () {
    document.getElementById('ann-bg-opacity-val').textContent = parseFloat(this.value).toFixed(2);
  });
  document.getElementById('ann-line-opacity').addEventListener('input', function () {
    document.getElementById('ann-line-opacity-val').textContent = parseFloat(this.value).toFixed(2);
  });
  // Arrow show toggle
  document.getElementById('ann-arrow-show').addEventListener('change', function () {
    document.getElementById('ann-arrow-opts').style.display = this.checked ? '' : 'none';
  });

  /* ── Predict / Solve ────────────────────────────────────── */
  const predModeEl = document.getElementById('pred-mode');
  const predLabelEl = document.getElementById('pred-label');
  const predInputEl = document.getElementById('pred-input');
  if (predModeEl) {
    predModeEl.addEventListener('change', () => {
      predLabelEl.textContent = predModeEl.value === 'x2y' ? 'X value' : 'Y value';
      const res = document.getElementById('pred-result');
      if (res) { res.style.display = 'none'; res.innerHTML = ''; }
    });
  }
  document.getElementById('btn-predict').addEventListener('click', () => {
    const fit = state.fits.find(f => f.id === state.activeFitId);
    if (!fit || !fit.result) { setConsole('No active fit — run a fit first.', 'error'); return; }
    const val = parseFloat(predInputEl.value);
    if (!isFinite(val)) { setConsole('Enter a valid number.', 'error'); return; }
    const mode = predModeEl ? predModeEl.value : 'x2y';
    if (mode === 'x2y') {
      const result = predictAtX(fit, val);
      if (!result) { setConsole('Model returned non-finite value at that X.', 'error'); return; }
      renderPredResult(result, 'x2y');
      setConsole(`Ŷ at X=${fmt(val)}: ${fmt(result.y)}`, '');
    } else {
      const ds = state.datasets.find(d => d.id === fit.dsId);
      const xArr = ds ? ds.x.filter((_, i) => !(ds.excludedIndices || new Set()).has(i)) : [];
      const xMin = state.fitConfig.xExtraMin ?? (xArr.length ? Math.min(...xArr) : -100);
      const xMax = state.fitConfig.xExtraMax ?? (xArr.length ? Math.max(...xArr) : 100);
      const roots = solveXfromY(fit, val, xMin, xMax);
      renderPredResult(roots, 'y2x');
      if (!roots.length) setConsole(`No X found where model = ${fmt(val)} in data range.`, 'warn');
      else setConsole(`X where model = ${fmt(val)}: ${roots.map(r => fmt(r.x)).join(', ')}`, '');
    }
  });
  if (predInputEl) {
    predInputEl.addEventListener('keydown', e => {
      if (e.key === 'Enter') document.getElementById('btn-predict').click();
    });
  }

  /* ── F-test ─────────────────────────────────────────────── */
  document.getElementById('btn-ftest').addEventListener('click', () => {
    const idA = parseInt(document.getElementById('ftest-fit-a').value);
    const idB = parseInt(document.getElementById('ftest-fit-b').value);
    if (!idA || !idB) { setConsole('Select two fits for the F-test.', 'error'); return; }
    if (idA === idB) { setConsole('Select two different fits.', 'error'); return; }
    const fitA = state.fits.find(f => f.id === idA);
    const fitB = state.fits.find(f => f.id === idB);
    if (!fitA || !fitB) { setConsole('One or both fits not found.', 'error'); return; }
    const result = runFTest(fitA, fitB);
    renderFTestResult(result);
    if (!result.error)
      setConsole(`F-test: F=${fmt(result.F)}, p=${result.pVal < 0.001 ? result.pVal.toExponential(2) : result.pVal.toFixed(4)}`, '');
  });

  /* ── Initial state ────────────────────────────────────── */
  document.getElementById('btn-toggle-residuals').classList.add('active');
  syncModelCustomSection();
  initResizablePanels();
  tutInit();

  /* ── Unsaved-data guard ────────────────────────────────── */
  let _allowLeave = false;

  function _hasSessionData() {
    const payload = buildMultiTabPayload();
    return payload.tabs.some(t => {
      const p = t.payload;
      return p && ((p.datasets && p.datasets.length > 0) || (p.fits && p.fits.length > 0));
    });
  }

  function _saveAllAndLeave(doLeave) {
    const payload = buildMultiTabPayload();
    const json = JSON.stringify(payload, null, 2);
    try { localStorage.setItem('cfs_session', json); } catch (_) {}
    const blob = new Blob([json], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `curve-fit-session-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    if (doLeave) { _allowLeave = true; location.reload(); }
  }

  // Native dialog for browser X button, address-bar navigation, etc.
  window.addEventListener('beforeunload', function(e) {
    if (_allowLeave) return;
    if (!_hasSessionData()) return;
    // Auto-save to localStorage so Auto-restore can recover the session
    try { localStorage.setItem('cfs_session', JSON.stringify(buildMultiTabPayload())); } catch (_) {}
    e.preventDefault();
    e.returnValue = '';
  });

  // Custom modal for F5 / Ctrl+R / Cmd+R — intercept before browser refresh
  const _unsavedModal = document.getElementById('unsaved-modal');
  let _pendingLeave = null;

  function _showUnsavedModal(leaveCallback) {
    _pendingLeave = leaveCallback;
    _unsavedModal.style.display = 'flex';
  }
  function _hideUnsavedModal() {
    _unsavedModal.style.display = 'none';
    _pendingLeave = null;
  }

  document.getElementById('unsaved-cancel').addEventListener('click', _hideUnsavedModal);

  document.getElementById('unsaved-leave').addEventListener('click', function() {
    const cb = _pendingLeave;
    _hideUnsavedModal();
    _allowLeave = true;
    if (cb) cb();
  });

  document.getElementById('unsaved-save').addEventListener('click', function() {
    _hideUnsavedModal();
    _saveAllAndLeave(true);
  });

  // Capture-phase keydown so we run before any other handler
  document.addEventListener('keydown', function(e) {
    const isRefresh = e.key === 'F5' ||
                      ((e.ctrlKey || e.metaKey) && (e.key === 'r' || e.key === 'R'));
    if (!isRefresh) return;
    if (!_hasSessionData()) return;
    e.preventDefault();
    _showUnsavedModal(() => location.reload());
  }, true);

  /* ── Example dataset search ─────────────────────────────── */
  (function initExampleSearch() {
    const searchEl  = document.getElementById('examples-search');
    const resultsEl = document.getElementById('examples-search-results');
    const colsEl    = document.getElementById('examples-cols-wrap');
    if (!searchEl || !resultsEl || !colsEl) return;

    let focusIdx = -1;
    let currentHits = [];

    function score(key, ex, q) {
      const title = (ex.title || '').toLowerCase();
      const tags  = (ex.tags  || '').toLowerCase();
      const presets = (ex.presets || []).map(p => p.label + ' ' + (p.suggestModel || '')).join(' ').toLowerCase();
      const blob = key + ' ' + title + ' ' + tags + ' ' + presets;
      if (!blob.includes(q)) return 0;
      if (title.startsWith(q) || key.startsWith(q)) return 3;
      if (title.split(/\s+/).some(w => w.startsWith(q))) return 2;
      return 1;
    }

    function render() {
      resultsEl.querySelectorAll('.srp-item').forEach((el, i) => el.classList.toggle('focused', i === focusIdx));
    }

    function pick(key) {
      searchEl.value = '';
      resultsEl.style.display = 'none';
      colsEl.style.display = 'flex';
      focusIdx = -1; currentHits = [];
      openExampleEditor(key);
      document.getElementById('examples-menu').classList.remove('open');
    }

    function buildResults(q) {
      if (!q) { resultsEl.style.display = 'none'; colsEl.style.display = 'flex'; return; }
      currentHits = Object.entries(EXAMPLES)
        .map(([k, ex]) => ({ k, ex, s: score(k, ex, q) }))
        .filter(e => e.s > 0)
        .sort((a, b) => b.s - a.s)
        .slice(0, 8);
      colsEl.style.display = 'none';
      if (!currentHits.length) {
        resultsEl.innerHTML = `<div class="srp-empty">No examples match "<strong>${q}</strong>"</div>`;
        resultsEl.style.display = '';
        return;
      }
      resultsEl.innerHTML = currentHits.map(({ k, ex }, i) => {
        const desc = ex.presets
          ? ex.presets.map(p => p.label.split(/[—–-]/)[0].trim()).join(' · ')
          : (ex.tags || '').split(' ').slice(0, 5).join(' ');
        return `<div class="srp-item" data-idx="${i}" data-example="${k}">
          <span class="srp-name">${ex.title || k}</span>
          <span class="srp-desc">${desc}</span>
        </div>`;
      }).join('');
      resultsEl.style.display = '';
      focusIdx = -1;
      resultsEl.querySelectorAll('.srp-item').forEach(item => {
        item.addEventListener('mousedown', e => { e.preventDefault(); pick(item.dataset.example); });
        item.addEventListener('mouseover', () => { focusIdx = parseInt(item.dataset.idx); render(); });
      });
    }

    searchEl.addEventListener('input', () => buildResults(searchEl.value.trim().toLowerCase()));
    searchEl.addEventListener('keydown', e => {
      if (e.key === 'Escape') { searchEl.value = ''; buildResults(''); return; }
      if (!currentHits.length) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); focusIdx = Math.min(focusIdx + 1, currentHits.length - 1); render(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); focusIdx = Math.max(focusIdx - 1, 0); render(); }
      else if (e.key === 'Enter') {
        if (focusIdx >= 0) { e.preventDefault(); pick(currentHits[focusIdx].k); }
        else if (currentHits.length === 1) { e.preventDefault(); pick(currentHits[0].k); }
      }
    });
    document.getElementById('btn-examples')?.addEventListener('click', () => {
      setTimeout(() => { if (document.getElementById('examples-menu').classList.contains('open')) searchEl.focus(); }, 50);
    });
  })();

  /* ── Model search autocomplete ───────────────────────────── */
  (function initModelSearch() {
    const searchEl  = document.getElementById('model-search');
    const resultsEl = document.getElementById('model-search-results');
    const sel       = document.getElementById('model-select');
    if (!searchEl || !resultsEl || !sel) return;

    // Snapshot all options once — never modify the <select> while typing
    const allOpts = Array.from(sel.querySelectorAll('option'))
      .filter(o => o.value)
      .map(o => {
        const parts = o.textContent.trim().split(/\s{2,}/);
        return {
          value: o.value,
          name:  parts[0] || o.value,
          desc:  parts.slice(1).join('  '),
          group: (o.parentElement instanceof HTMLOptGroupElement) ? o.parentElement.label : '',
        };
      });

    let focusIdx = -1;
    let currentHits = [];

    function score(o, q) {
      const v = o.value.toLowerCase(), n = o.name.toLowerCase(), g = o.group.toLowerCase(), d = o.desc.toLowerCase();
      if (v === q || n === q) return 4;
      if (v.startsWith(q) || n.startsWith(q)) return 3;
      if (n.split(/\s+/).some(w => w.startsWith(q))) return 2;
      if (v.includes(q) || n.includes(q) || g.includes(q) || d.includes(q)) return 1;
      return 0;
    }

    function render() {
      resultsEl.querySelectorAll('.srp-item').forEach((el, i) => el.classList.toggle('focused', i === focusIdx));
    }

    function pick(opt) {
      sel.value = opt.value;
      sel.dispatchEvent(new Event('change'));
      searchEl.value = '';
      resultsEl.style.display = 'none';
      focusIdx = -1; currentHits = [];
    }

    function buildResults(q) {
      if (!q) { resultsEl.style.display = 'none'; return; }
      currentHits = allOpts
        .map(o => ({ o, s: score(o, q) }))
        .filter(e => e.s > 0)
        .sort((a, b) => b.s - a.s)
        .slice(0, 8)
        .map(e => e.o);
      if (!currentHits.length) {
        resultsEl.innerHTML = `<div class="srp-empty">No models match "<strong>${q}</strong>"</div>`;
        resultsEl.style.display = '';
        return;
      }
      resultsEl.innerHTML = currentHits.map((o, i) =>
        `<div class="srp-item" data-idx="${i}">
          <span class="srp-name">${o.name}</span>
          ${o.desc ? `<span class="srp-desc">${o.desc}</span>` : ''}
          <span class="srp-group">${o.group}</span>
        </div>`
      ).join('');
      resultsEl.style.display = '';
      focusIdx = -1;
      resultsEl.querySelectorAll('.srp-item').forEach(item => {
        item.addEventListener('mousedown', e => { e.preventDefault(); pick(currentHits[parseInt(item.dataset.idx)]); });
        item.addEventListener('mouseover', () => { focusIdx = parseInt(item.dataset.idx); render(); });
      });
    }

    searchEl.addEventListener('input', () => buildResults(searchEl.value.trim().toLowerCase()));
    searchEl.addEventListener('keydown', e => {
      if (e.key === 'Escape') { searchEl.value = ''; resultsEl.style.display = 'none'; return; }
      if (!currentHits.length) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); focusIdx = Math.min(focusIdx + 1, currentHits.length - 1); render(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); focusIdx = Math.max(focusIdx - 1, 0); render(); }
      else if (e.key === 'Enter') {
        if (focusIdx >= 0) { e.preventDefault(); pick(currentHits[focusIdx]); }
        else if (currentHits.length === 1) { e.preventDefault(); pick(currentHits[0]); }
      }
    });
    // Hide panel when focus leaves both the input and the results
    searchEl.addEventListener('blur', () => setTimeout(() => {
      if (!resultsEl.contains(document.activeElement)) resultsEl.style.display = 'none';
    }, 150));
    document.addEventListener('click', e => {
      if (!searchEl.contains(e.target) && !resultsEl.contains(e.target)) resultsEl.style.display = 'none';
    });
  })();

  /* ── Fit comparison modal ─────────────────────────────── */
  const compareModal = document.getElementById('compare-modal');
  if (compareModal) {
    document.getElementById('btn-compare-fits')?.addEventListener('click', showCompareModal);
    document.getElementById('compare-modal-close')?.addEventListener('click',  () => { compareModal.style.display = 'none'; });
    document.getElementById('compare-modal-close2')?.addEventListener('click', () => { compareModal.style.display = 'none'; });
    compareModal.addEventListener('click', e => { if (e.target === compareModal) compareModal.style.display = 'none'; });
    document.getElementById('compare-fit-a')?.addEventListener('change', renderCompareTable);
    document.getElementById('compare-fit-b')?.addEventListener('change', renderCompareTable);
  }

  /* ── Axis range mode toggle ───────────────────────────── */
  document.getElementById('btn-axis-range-mode')?.addEventListener('click', function() {
    state.plotConfig.axisRangeMode = state.plotConfig.axisRangeMode === 'data' ? 'auto' : 'data';
    this.classList.toggle('active', state.plotConfig.axisRangeMode === 'data');
    this.title = state.plotConfig.axisRangeMode === 'data'
      ? 'Y-axis: data range only (click for auto)'
      : 'Y-axis: auto range (click for data range only)';
    updatePlots();
  });
}
