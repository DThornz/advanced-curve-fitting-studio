// UI rendering: fit list, annotation editor, graph style editor, param table, stats table, sync helpers

function _fitQualityBadge(rSq) {
  if (!isFinite(rSq)) return '<span class="fit-quality-badge badge-none" title="No statistics yet"></span>';
  const cls = rSq >= 0.99 ? 'badge-green' : rSq >= 0.95 ? 'badge-amber' : 'badge-red';
  const label = rSq >= 0.99 ? 'excellent' : rSq >= 0.95 ? 'acceptable' : 'poor';
  return `<span class="fit-quality-badge ${cls}" title="R² = ${rSq.toFixed(4)} (${label})"></span>`;
}

let _dragSrcFitId = null;

function renderFitList() {
  const el = document.getElementById('fit-list');
  const cnt = document.getElementById('fit-count');
  cnt.textContent = state.fits.length;
  if (!state.fits.length) {
    el.innerHTML = '<div class="panel-empty-hint">Press <strong>▶ Fit</strong><br>after loading data.</div>';
    const corrEl = document.getElementById('corr-matrix-container');
    if (corrEl) corrEl.innerHTML = '';
    const sidePanel = document.getElementById('statsbar-corr');
    if (sidePanel) sidePanel.classList.add('corr-empty');
    document.querySelector('.app-statsbar')?.classList.add('corr-empty');
    return;
  }
  el.innerHTML = state.fits.map(fit => {
    const ds = state.datasets.find(d => d.id === fit.dsId);
    const dsOff = ds && ds.enabled === false;
    const rSq = fit.result?.rSq;
    const notesTip = fit.notes?.trim() ? ` title="${fit.notes.trim().replace(/"/g,'&quot;').slice(0,200)}"` : '';
    return `
    <div class="fit-item${fit.id === state.activeFitId ? ' active' : ''}${dsOff ? ' fit-item-off' : ''}" data-fitid="${fit.id}" draggable="true">
      <span class="ds-swatch" style="background:${fit.color};opacity:${dsOff ? 0.3 : 1}"></span>
      <span class="ds-label">
        <span style="display:flex;align-items:center;gap:3px;overflow:hidden">
          ${_fitQualityBadge(rSq)}
          <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${fit.label}</span>
          ${fit.notes?.trim() ? `<span class="fit-notes-dot"${notesTip}>📝</span>` : ''}
        </span>
        <span class="fit-item-eq">${fit.model}${dsOff ? ' (dataset off)' : ''}</span>
      </span>
      <button class="ds-delete" data-delid="${fit.id}" title="Remove fit">×</button>
    </div>`;
  }).join('');
  el.querySelectorAll('.fit-item').forEach(item => {
    item.addEventListener('click', () => {
      const fitId = parseInt(item.dataset.fitid);
      const fit = state.fits.find(f => f.id === fitId);
      const ds = fit && state.datasets.find(d => d.id === fit.dsId);
      if (ds && ds.enabled === false) return;
      state.activeFitId = fitId;
      renderFitList();
      if (fit) { renderParamResults(fit); renderStatsTable(); }
    });
    // Drag-drop reordering
    item.addEventListener('dragstart', e => {
      _dragSrcFitId = parseInt(item.dataset.fitid);
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', String(_dragSrcFitId));
      setTimeout(() => item.classList.add('dragging'), 0);
    });
    item.addEventListener('dragend', () => item.classList.remove('dragging'));
    item.addEventListener('dragover', e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; item.classList.add('drag-over'); });
    item.addEventListener('dragleave', () => item.classList.remove('drag-over'));
    item.addEventListener('drop', e => {
      e.preventDefault();
      item.classList.remove('drag-over');
      const tgtId = parseInt(item.dataset.fitid);
      if (_dragSrcFitId === null || _dragSrcFitId === tgtId) return;
      const si = state.fits.findIndex(f => f.id === _dragSrcFitId);
      const ti = state.fits.findIndex(f => f.id === tgtId);
      if (si < 0 || ti < 0) return;
      state.fits.splice(ti, 0, state.fits.splice(si, 1)[0]);
      _dragSrcFitId = null;
      renderFitList();
      updatePlots();
    });
  });
  el.querySelectorAll('.ds-delete').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const id = parseInt(btn.dataset.delid);
      state.fits = state.fits.filter(f => f.id !== id);
      state.annotations = state.annotations.filter(a => a.fitId !== id);
      if (state.activeFitId === id) {
        const enabledFit = state.fits.find(f => {
          const fds = state.datasets.find(d => d.id === f.dsId);
          return fds && fds.enabled !== false;
        });
        state.activeFitId = enabledFit ? enabledFit.id : (state.fits.length ? state.fits[state.fits.length - 1].id : null);
      }
      renderFitList();
      renderAnnList();
      updatePlots();
      const active = state.fits.find(f => f.id === state.activeFitId);
      if (active) renderStats(active); else setConsole('Fit removed.', '');
    });
  });
  syncFTestSelects();
}

function showCompareModal() {
  const modal = document.getElementById('compare-modal');
  if (!modal) return;
  const selA = document.getElementById('compare-fit-a');
  const selB = document.getElementById('compare-fit-b');
  const fits = state.fits.filter(f => f.result);
  if (fits.length < 2) { setConsole('Need at least 2 fits with results to compare.', 'warn'); return; }
  const opts = fits.map(f => `<option value="${f.id}">${f.label || f.model}</option>`).join('');
  selA.innerHTML = opts;
  selB.innerHTML = opts;
  if (fits.length >= 2) { selA.value = fits[fits.length - 2].id; selB.value = fits[fits.length - 1].id; }
  renderCompareTable();
  modal.style.display = 'flex';
}

function renderCompareTable() {
  const selA = document.getElementById('compare-fit-a');
  const selB = document.getElementById('compare-fit-b');
  const tbody = document.getElementById('compare-tbody');
  if (!selA || !selB || !tbody) return;
  const fitA = state.fits.find(f => f.id === parseInt(selA.value));
  const fitB = state.fits.find(f => f.id === parseInt(selB.value));
  if (!fitA?.result || !fitB?.result) { tbody.innerHTML = '<tr><td colspan="3">Select two fits with results.</td></tr>'; return; }
  const rA = fitA.result, rB = fitB.result;
  const fmt6 = v => isFinite(v) ? v.toPrecision(6) : '—';

  const metrics = [
    { name: 'Model', a: fitA.model, b: fitB.model, better: null },
    { name: 'Dataset', a: (state.datasets.find(d=>d.id===fitA.dsId)||{}).name||'—', b: (state.datasets.find(d=>d.id===fitB.dsId)||{}).name||'—', better: null },
    { name: 'N points', a: rA.n, b: rB.n, better: null },
    { name: 'Parameters', a: rA.params.length, b: rB.params.length, better: null },
    { name: 'R²', a: fmt6(rA.rSq), b: fmt6(rB.rSq), better: rA.rSq >= rB.rSq ? 'a' : 'b' },
    { name: 'Adj. R²', a: fmt6(rA.adjRSq), b: fmt6(rB.adjRSq), better: rA.adjRSq >= rB.adjRSq ? 'a' : 'b' },
    { name: 'RMSE', a: fmt6(rA.rmse), b: fmt6(rB.rmse), better: rA.rmse <= rB.rmse ? 'a' : 'b' },
    { name: 'SSE', a: fmt6(rA.sse), b: fmt6(rB.sse), better: rA.sse <= rB.sse ? 'a' : 'b' },
    { name: 'AIC', a: fmt6(rA.aic), b: fmt6(rB.aic), better: rA.aic <= rB.aic ? 'a' : 'b' },
    { name: 'BIC', a: fmt6(rA.bic), b: fmt6(rB.bic), better: rA.bic <= rB.bic ? 'a' : 'b' },
    { name: 'Status', a: rA.converged ? '✓ Converged' : '⚠ Max iter', b: rB.converged ? '✓ Converged' : '⚠ Max iter', better: null },
  ];
  if (rA.chiSqRed != null || rB.chiSqRed != null)
    metrics.push({ name: 'χ²ᵣ', a: rA.chiSqRed != null ? fmt6(rA.chiSqRed) : '—', b: rB.chiSqRed != null ? fmt6(rB.chiSqRed) : '—',
      better: (rA.chiSqRed != null && rB.chiSqRed != null) ? (Math.abs(rA.chiSqRed - 1) <= Math.abs(rB.chiSqRed - 1) ? 'a' : 'b') : null });

  tbody.innerHTML = metrics.map(m => `
    <tr>
      <td style="font-weight:500;padding:3px 8px;white-space:nowrap">${m.name}</td>
      <td style="padding:3px 8px;text-align:right;${m.better==='a'?'color:var(--teal);font-weight:600':''}">${m.a}</td>
      <td style="padding:3px 8px;text-align:right;${m.better==='b'?'color:var(--teal);font-weight:600':''}">${m.b}</td>
    </tr>`).join('');
}

function syncFTestSelects() {
  const selA = document.getElementById('ftest-fit-a');
  const selB = document.getElementById('ftest-fit-b');
  if (!selA || !selB) return;
  const fits = state.fits.filter(f => {
    const ds = state.datasets.find(d => d.id === f.dsId);
    return ds && ds.enabled !== false;
  });
  const empty = '<option value="">— no fits —</option>';
  const opts = fits.map(f => `<option value="${f.id}">${f.label || f.model}</option>`).join('');
  selA.innerHTML = opts || empty;
  selB.innerHTML = opts || empty;
  if (fits.length >= 2) {
    selA.value = fits[fits.length - 2].id;
    selB.value = fits[fits.length - 1].id;
  } else if (fits.length === 1) {
    selA.value = fits[0].id;
    selB.value = fits[0].id;
  }
  const res = document.getElementById('ftest-result');
  if (res) { res.style.display = 'none'; res.innerHTML = ''; }
}

function renderPredResult(result, mode) {
  const el = document.getElementById('pred-result');
  if (!el) return;
  if (mode === 'x2y') {
    const { y, lower, upper, hw } = result;
    const ciRow = hw != null
      ? `<tr><td>95% CI</td><td>[${fmt(lower)}, ${fmt(upper)}]</td></tr>
         <tr><td>± hw</td><td>${fmt(hw)}</td></tr>`
      : `<tr><td>95% CI</td><td>—</td></tr>`;
    el.innerHTML = `<table class="pred-table">
      <tr><td>Ŷ</td><td class="pred-val-hi">${fmt(y)}</td></tr>
      ${ciRow}
    </table>`;
  } else {
    if (!result.length) {
      el.innerHTML = `<div class="pred-note">No solution found in the fit curve range.</div>`;
    } else {
      const rows = result.map((r, i) =>
        `<tr><td>X${result.length > 1 ? (i + 1) : ''}</td><td class="pred-val-hi">${fmt(r.x)}</td></tr>` +
        (r.xCIHW != null ? `<tr><td>± CI</td><td>${fmt(r.xCIHW)}</td></tr>` : '')
      ).join('');
      el.innerHTML = `<table class="pred-table">${rows}</table>`;
      if (result.length > 1)
        el.innerHTML += `<div class="pred-note">${result.length} solutions found — verify on plot.</div>`;
    }
  }
  el.style.display = '';
}

function renderFTestResult(result) {
  const el = document.getElementById('ftest-result');
  if (!el) return;
  if (result.error) {
    el.innerHTML = `<div class="pred-note" style="color:var(--error,#e53e3e)">${result.error}</div>`;
    el.style.display = '';
    return;
  }
  const sig = result.pVal < 0.05;
  const pStr = result.pVal < 0.001 ? result.pVal.toExponential(2) : result.pVal.toFixed(4);
  el.innerHTML = `<table class="pred-table">
    <tr><td>F statistic</td><td class="pred-val-hi">${fmt(result.F)}</td></tr>
    <tr><td>df₁, df₂</td><td>${result.deltaP}, ${result.dof2}</td></tr>
    <tr><td>p-value</td><td class="${sig ? 'ftest-sig' : 'ftest-ns'}">${pStr}</td></tr>
    <tr><td>SSE (simple)</td><td>${fmt(result.sseSimple)}</td></tr>
    <tr><td>SSE (complex)</td><td>${fmt(result.sseComplex)}</td></tr>
  </table>
  <div class="pred-note">${sig
    ? `Significant (p&lt;0.05): <em>${result.complex.label || result.complex.model}</em> fits better.`
    : `Not significant (p≥0.05): extra parameters not justified.`}</div>`;
  el.style.display = '';
}

/* ═══════════════════════════════════════════════════════════
   ANNOTATION MANAGEMENT
═══════════════════════════════════════════════════════════ */
function renderAnnList() {
  const el = document.getElementById('ann-list');
  const cnt = document.getElementById('ann-count');
  if (!el) return;
  if (cnt) cnt.textContent = state.annotations.length;
  if (!state.annotations.length) {
    el.innerHTML = '<div class="panel-empty-hint" style="font-size:.72em">No annotations. Use + Add or Peaks.</div>';
    return;
  }
  const typeLabel = { hline: 'H—', vline: '|V', text: 'T', peak: '⌃' };
  el.innerHTML = state.annotations.map(ann => {
    const disp = ann.label || (ann.type === 'hline' ? `y = ${fmt(ann.y)}` : ann.type === 'vline' ? `x = ${fmt(ann.x)}` : `(${fmt(ann.x)}, ${fmt(ann.y)})`);
    return `<div class="ann-item${ann.visible ? '' : ' ann-disabled'}" data-annid="${ann.id}">
      <span class="ann-item-type" title="${ann.type}">${typeLabel[ann.type] || '?'}</span>
      <span class="ann-item-label" title="${disp}">${disp}</span>
      <button class="ann-item-btn" data-ann-toggle="${ann.id}" title="${ann.visible ? 'Hide' : 'Show'}">${ann.visible ? '●' : '○'}</button>
      <button class="ann-item-btn" data-ann-edit="${ann.id}" title="Edit">✎</button>
      <button class="ann-item-btn" data-ann-del="${ann.id}" title="Remove">×</button>
    </div>`;
  }).join('');
  el.querySelectorAll('[data-ann-toggle]').forEach(btn => {
    btn.addEventListener('click', () => {
      const ann = state.annotations.find(a => a.id === parseInt(btn.dataset.annToggle));
      if (ann) { ann.visible = !ann.visible; renderAnnList(); updatePlots(); }
    });
  });
  el.querySelectorAll('[data-ann-edit]').forEach(btn => {
    btn.addEventListener('click', () => openAnnEditor(parseInt(btn.dataset.annEdit)));
  });
  el.querySelectorAll('[data-ann-del]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.annotations = state.annotations.filter(a => a.id !== parseInt(btn.dataset.annDel));
      renderAnnList(); updatePlots();
    });
  });
}

let _editingAnnId = null;

function openAnnEditor(id) {
  const ann = id != null ? state.annotations.find(a => a.id === id) : createDefaultAnnotation('hline');
  if (!ann) return;
  _editingAnnId = id ?? null;
  document.getElementById('ann-modal-title').textContent = id != null ? 'Edit Annotation' : 'Add Annotation';

  const knownFamilies = ['DM Sans, sans-serif','DM Mono, monospace','Arial, sans-serif',
    'Helvetica, sans-serif','Times New Roman, serif','Georgia, serif',
    'Courier New, monospace','Verdana, sans-serif','Trebuchet MS, sans-serif'];

  document.getElementById('ann-type').value            = ann.type;
  document.getElementById('ann-x').value               = ann.x ?? 0;
  document.getElementById('ann-y').value               = ann.y ?? 0;
  document.getElementById('ann-label').value            = ann.label || '';
  const famSel = document.getElementById('ann-font-family');
  if (knownFamilies.includes(ann.fontFamily)) {
    famSel.value = ann.fontFamily;
    document.getElementById('ann-row-font-custom').style.display = 'none';
  } else {
    famSel.value = '__custom__';
    document.getElementById('ann-row-font-custom').style.display = '';
    document.getElementById('ann-font-custom').value = ann.fontFamily || '';
  }
  document.getElementById('ann-font-size').value        = ann.fontSize  ?? 12;
  document.getElementById('ann-font-bold').checked      = !!ann.fontBold;
  document.getElementById('ann-font-italic').checked    = !!ann.fontItalic;
  document.getElementById('ann-font-color').value       = ann.fontColor  || '#374151';
  document.getElementById('ann-font-color-hex').value   = ann.fontColor  || '#374151';
  document.getElementById('ann-anchor').value           = ann.labelAnchor  || 'left';
  document.getElementById('ann-vanchor').value          = ann.labelVAnchor || 'bottom';
  document.getElementById('ann-bg-color').value         = ann.bgColor  || '#ffffff';
  const bgOp = ann.bgOpacity ?? 0.85;
  document.getElementById('ann-bg-opacity').value       = bgOp;
  document.getElementById('ann-bg-opacity-val').textContent = bgOp.toFixed(2);
  document.getElementById('ann-border-color').value     = ann.borderColor || '#d4d9e8';
  document.getElementById('ann-border-show').checked    = !!ann.borderShow;
  document.getElementById('ann-line-style').value       = ann.lineDash   || 'dash';
  document.getElementById('ann-line-width').value       = ann.lineWidth  ?? 1.5;
  document.getElementById('ann-line-color').value       = ann.lineColor  || '#6b7280';
  document.getElementById('ann-line-color-hex').value   = ann.lineColor  || '#6b7280';
  const lineOp = ann.lineOpacity ?? 0.7;
  document.getElementById('ann-line-opacity').value     = lineOp;
  document.getElementById('ann-line-opacity-val').textContent = lineOp.toFixed(2);
  document.getElementById('ann-arrow-show').checked     = ann.showArrow !== false;
  document.getElementById('ann-arrow-opts').style.display = ann.showArrow !== false ? '' : 'none';
  document.getElementById('ann-arrow-head').value       = ann.arrowHead  ?? 2;
  document.getElementById('ann-arrow-size').value       = ann.arrowSize  ?? 1;
  document.getElementById('ann-arrow-width').value      = ann.arrowWidth ?? 1;
  document.getElementById('ann-arrow-color').value      = ann.arrowColor || '#374151';
  document.getElementById('ann-arrow-color-hex').value  = ann.arrowColor || '#374151';
  document.getElementById('ann-ax').value               = ann.ax ?? 0;
  document.getElementById('ann-ay').value               = ann.ay ?? -40;

  syncAnnModalSections();
  document.getElementById('ann-modal').style.display = 'flex';
}

function syncAnnModalSections() {
  const type = document.getElementById('ann-type').value;
  const isLine = type === 'hline' || type === 'vline';
  document.getElementById('ann-row-x').style.display = type === 'hline' ? 'none' : '';
  document.getElementById('ann-row-y').style.display = type === 'vline' ? 'none' : '';
  document.getElementById('ann-section-line').style.display = isLine ? '' : 'none';
  document.getElementById('ann-section-arrow').style.display = isLine ? 'none' : '';
}

function saveAnn() {
  const type = document.getElementById('ann-type').value;
  const famSel = document.getElementById('ann-font-family');
  const fontFamily = famSel.value === '__custom__'
    ? (document.getElementById('ann-font-custom').value.trim() || 'DM Sans, sans-serif')
    : famSel.value;
  const annData = {
    type,
    x: parseFloat(document.getElementById('ann-x').value) || 0,
    y: parseFloat(document.getElementById('ann-y').value) || 0,
    label: document.getElementById('ann-label').value || '',
    fontFamily,
    fontSize:    parseFloat(document.getElementById('ann-font-size').value)  || 12,
    fontBold:    document.getElementById('ann-font-bold').checked,
    fontItalic:  document.getElementById('ann-font-italic').checked,
    fontColor:   document.getElementById('ann-font-color').value,
    labelAnchor: document.getElementById('ann-anchor').value,
    labelVAnchor:document.getElementById('ann-vanchor').value,
    bgColor:     document.getElementById('ann-bg-color').value,
    bgOpacity:   parseFloat(document.getElementById('ann-bg-opacity').value),
    borderShow:  document.getElementById('ann-border-show').checked,
    borderColor: document.getElementById('ann-border-color').value,
    lineColor:   document.getElementById('ann-line-color').value,
    lineWidth:   parseFloat(document.getElementById('ann-line-width').value) || 1.5,
    lineDash:    document.getElementById('ann-line-style').value,
    lineOpacity: parseFloat(document.getElementById('ann-line-opacity').value),
    showArrow:   document.getElementById('ann-arrow-show').checked,
    arrowHead:   parseInt(document.getElementById('ann-arrow-head').value),
    arrowSize:   parseFloat(document.getElementById('ann-arrow-size').value) || 1,
    arrowWidth:  parseFloat(document.getElementById('ann-arrow-width').value) || 1,
    arrowColor:  document.getElementById('ann-arrow-color').value,
    ax: parseFloat(document.getElementById('ann-ax').value) || 0,
    ay: parseFloat(document.getElementById('ann-ay').value) || -40,
  };
  if (_editingAnnId != null) {
    const idx = state.annotations.findIndex(a => a.id === _editingAnnId);
    if (idx !== -1) state.annotations[idx] = Object.assign({}, state.annotations[idx], annData);
  } else {
    state.annotations.push(Object.assign(createDefaultAnnotation(type), annData, { id: nextAnnId(), visible: true }));
  }
  document.getElementById('ann-modal').style.display = 'none';
  renderAnnList();
  updatePlots();
}

function autoAnnotatePeaks() {
  const peakParams = new Set(['μ', 'mu', 'x₀', 'x0', 'xc', 'center', 'centre', 'peak']);
  const visible = state.fits.filter(f => {
    if (!f.result || !f.visible) return false;
    const ds = state.datasets.find(d => d.id === f.dsId);
    return !ds || ds.enabled !== false;
  });
  if (!visible.length) { setConsole('No active fits to annotate.', 'warn'); return; }
  let added = 0;
  for (const fit of visible) {
    const idx = fit.paramNames.findIndex(n => peakParams.has(n.toLowerCase ? n.toLowerCase() : n));
    if (idx === -1) continue;
    if (state.annotations.some(a => a.fitId === fit.id)) continue;
    const peakX = fit.result.params[idx];
    const peakY = fitEval(fit, peakX);
    if (!isFinite(peakX) || !isFinite(peakY)) continue;
    const ann = createDefaultAnnotation('peak');
    ann.x = peakX; ann.y = peakY;
    ann.label = fit.label || fit.model;
    ann.fontColor = fit.color; ann.arrowColor = fit.color;
    ann.fitId = fit.id;
    state.annotations.push(ann);
    added++;
  }
  if (added) { renderAnnList(); updatePlots(); setConsole(`Added ${added} peak annotation${added > 1 ? 's' : ''}.`, ''); }
  else setConsole('No new peak centres found — Gaussian / Lorentzian fits needed, or already annotated.', 'warn');
}

/* ═══════════════════════════════════════════════════════════
   GRAPH STYLE EDITOR
═══════════════════════════════════════════════════════════ */
function openGraphStyleEditor() {
  const gs = state.graphStyle;
  const tc = themeColors();
  const modal = document.getElementById('gs-modal');

  // Font
  const knownFamilies = ['DM Mono, monospace','DM Sans, sans-serif','Arial, sans-serif',
    'Helvetica, sans-serif','Times New Roman, serif','Georgia, serif',
    'Courier New, monospace','Verdana, sans-serif','Trebuchet MS, sans-serif'];
  const famSel = document.getElementById('gs-font-family');
  if (!gs.fontFamily || knownFamilies.includes(gs.fontFamily)) {
    famSel.value = gs.fontFamily || '';
    document.getElementById('gs-row-font-custom').style.display = 'none';
  } else {
    famSel.value = '__custom__';
    document.getElementById('gs-font-custom').value = gs.fontFamily;
    document.getElementById('gs-row-font-custom').style.display = '';
  }
  document.getElementById('gs-font-size').value   = gs.fontSize || '';
  _gsSetColorField('gs-font-color', 'gs-font-color-hex', gs.fontColor, tc.textCol);

  // Background
  _gsSetColorField('gs-plot-bg',    'gs-plot-bg-hex',    gs.plotBgColor,   tc.plotBg);
  _gsSetColorField('gs-paper-bg',   'gs-paper-bg-hex',   gs.paperBgColor,  tc.paperBg);

  // Grid X
  document.getElementById('gs-grid-x-show').checked  = gs.showGridX !== false;
  _gsSetColorField('gs-grid-x-color', 'gs-grid-x-color-hex', gs.gridXColor, tc.gridCol);
  document.getElementById('gs-grid-x-width').value = gs.gridXWidth || 1;
  document.getElementById('gs-grid-x-dash').value  = gs.gridXDash  || 'solid';
  // Grid Y
  document.getElementById('gs-grid-y-show').checked  = gs.showGridY !== false;
  _gsSetColorField('gs-grid-y-color', 'gs-grid-y-color-hex', gs.gridYColor, tc.gridCol);
  document.getElementById('gs-grid-y-width').value = gs.gridYWidth || 1;
  document.getElementById('gs-grid-y-dash').value  = gs.gridYDash  || 'solid';

  // Zero lines
  document.getElementById('gs-zeroline-x-show').checked = gs.showZeroLineX !== false;
  _gsSetColorField('gs-zeroline-x-color', 'gs-zeroline-x-color-hex', gs.zeroLineXColor, tc.zeroLine);
  document.getElementById('gs-zeroline-x-width').value = gs.zeroLineXWidth || 1;
  document.getElementById('gs-zeroline-y-show').checked = gs.showZeroLineY !== false;
  _gsSetColorField('gs-zeroline-y-color', 'gs-zeroline-y-color-hex', gs.zeroLineYColor, tc.zeroLine);
  document.getElementById('gs-zeroline-y-width').value = gs.zeroLineYWidth || 1;

  // Axes & Ticks
  document.getElementById('gs-tick-size').value       = gs.tickFontSize || '';
  document.getElementById('gs-show-ticks-x').checked  = gs.showTicksX !== false;
  document.getElementById('gs-show-ticks-y').checked  = gs.showTicksY !== false;
  document.getElementById('gs-axis-line-x').checked   = !!gs.showAxisLineX;
  document.getElementById('gs-axis-line-y').checked   = !!gs.showAxisLineY;
  _gsSetColorField('gs-axis-line-color', 'gs-axis-line-color-hex', gs.axisLineColor, tc.gridCol);

  // Legend
  document.getElementById('gs-legend-font-size').value = gs.legendFontSize || '';
  _gsSetColorField('gs-legend-bg',     'gs-legend-bg-hex',     gs.legendBgColor,     isDark() ? '#0a1628' : '#ffffff');
  _gsSetColorField('gs-legend-border', 'gs-legend-border-hex', gs.legendBorderColor, tc.gridCol);

  // Scale & Axis Range
  document.getElementById('gs-log-x').checked  = !!state.plotConfig.logX;
  document.getElementById('gs-log-y').checked  = !!state.plotConfig.logY;
  document.getElementById('gs-xmin').value     = gs.xMin   || '';
  document.getElementById('gs-xmax').value     = gs.xMax   || '';
  document.getElementById('gs-ymin').value     = gs.yMin   || '';
  document.getElementById('gs-ymax').value     = gs.yMax   || '';
  document.getElementById('gs-x-dtick').value  = gs.xDtick || '';
  document.getElementById('gs-y-dtick').value  = gs.yDtick || '';

  modal.style.display = 'flex';
}

function _gsSetColorField(pickId, hexId, override, themeDefault) {
  const pick = document.getElementById(pickId);
  const hex  = document.getElementById(hexId);
  if (!pick || !hex) return;
  if (override && override !== '') {
    pick.value = override;
    hex.value  = override;
  } else {
    hex.value  = '';
    // Show the current theme default in the picker so user can see what they're overriding
    pick.value = /^#[0-9a-fA-F]{6}$/.test(themeDefault) ? themeDefault : '#888888';
  }
}

function saveGraphStyle() {
  const gs = state.graphStyle;
  const famSel = document.getElementById('gs-font-family');
  if (famSel.value === '__custom__') {
    gs.fontFamily = document.getElementById('gs-font-custom').value.trim() || '';
  } else {
    gs.fontFamily = famSel.value;  // '' or a known family
  }
  gs.fontSize       = document.getElementById('gs-font-size').value.trim();
  gs.fontColor      = document.getElementById('gs-font-color-hex').value.trim();
  gs.plotBgColor    = document.getElementById('gs-plot-bg-hex').value.trim();
  gs.paperBgColor   = document.getElementById('gs-paper-bg-hex').value.trim();

  gs.showGridX      = document.getElementById('gs-grid-x-show').checked;
  gs.gridXColor     = document.getElementById('gs-grid-x-color-hex').value.trim();
  gs.gridXWidth     = parseFloat(document.getElementById('gs-grid-x-width').value) || 1;
  gs.gridXDash      = document.getElementById('gs-grid-x-dash').value;
  gs.showGridY      = document.getElementById('gs-grid-y-show').checked;
  gs.gridYColor     = document.getElementById('gs-grid-y-color-hex').value.trim();
  gs.gridYWidth     = parseFloat(document.getElementById('gs-grid-y-width').value) || 1;
  gs.gridYDash      = document.getElementById('gs-grid-y-dash').value;

  gs.showZeroLineX  = document.getElementById('gs-zeroline-x-show').checked;
  gs.zeroLineXColor = document.getElementById('gs-zeroline-x-color-hex').value.trim();
  gs.zeroLineXWidth = parseFloat(document.getElementById('gs-zeroline-x-width').value) || 1;
  gs.showZeroLineY  = document.getElementById('gs-zeroline-y-show').checked;
  gs.zeroLineYColor = document.getElementById('gs-zeroline-y-color-hex').value.trim();
  gs.zeroLineYWidth = parseFloat(document.getElementById('gs-zeroline-y-width').value) || 1;

  gs.tickFontSize   = document.getElementById('gs-tick-size').value.trim();
  gs.showTicksX     = document.getElementById('gs-show-ticks-x').checked;
  gs.showTicksY     = document.getElementById('gs-show-ticks-y').checked;
  gs.showAxisLineX  = document.getElementById('gs-axis-line-x').checked;
  gs.showAxisLineY  = document.getElementById('gs-axis-line-y').checked;
  gs.axisLineColor  = document.getElementById('gs-axis-line-color-hex').value.trim();

  gs.legendFontSize    = document.getElementById('gs-legend-font-size').value.trim();
  gs.legendBgColor     = document.getElementById('gs-legend-bg-hex').value.trim();
  gs.legendBorderColor = document.getElementById('gs-legend-border-hex').value.trim();

  // Scale & Axis Range
  state.plotConfig.logX = document.getElementById('gs-log-x').checked;
  state.plotConfig.logY = document.getElementById('gs-log-y').checked;
  gs.xMin   = document.getElementById('gs-xmin').value.trim();
  gs.xMax   = document.getElementById('gs-xmax').value.trim();
  gs.yMin   = document.getElementById('gs-ymin').value.trim();
  gs.yMax   = document.getElementById('gs-ymax').value.trim();
  gs.xDtick = document.getElementById('gs-x-dtick').value.trim();
  gs.yDtick = document.getElementById('gs-y-dtick').value.trim();

  document.getElementById('gs-modal').style.display = 'none';
  updatePlots();
  setConsole('Graph style updated.', '');
}

function sweepRange(row) {
  const lo = row.min > -1e9 ? row.min : -Infinity;
  const hi = row.max <  1e9 ? row.max :  Infinity;
  const init = row.init;
  let rMin, rMax;
  if (isFinite(lo) && isFinite(hi)) {
    rMin = lo; rMax = hi;
  } else {
    const span = Math.abs(init) > 1e-10 ? 4 * Math.abs(init) : 20;
    rMin = init - span / 2;
    rMax = init + span / 2;
    if (isFinite(lo)) rMin = Math.max(rMin, lo);
    if (isFinite(hi)) rMax = Math.min(rMax, hi);
  }
  if (rMin >= rMax) { rMin = init - 10; rMax = init + 10; }
  return { rMin, rMax };
}

function renderParamTable() {
  const model = state.fitConfig.model;
  const m = MODELS[model];
  const container = document.getElementById('param-table-container');
  state.sweepParams = null;

  // For Custom, params come from state.fitConfig.customParams
  const paramNames = model === 'Custom' ? state.fitConfig.customParams : (m ? m.params : []);
  if (m && m.analytic) {
    container.innerHTML = `<div class="panel-empty-hint" style="text-align:left;padding:6px 0;font-size:.72em">Analytic fit — no initial values needed.</div>`;
    state.paramRows = paramNames.map(name => ({ name, init: 1, min: -Infinity, max: Infinity }));
    return;
  }
  if (!paramNames.length) {
    container.innerHTML = '<div class="panel-empty-hint">No parameters.</div>';
    state.paramRows = [];
    return;
  }
  // Preserve existing values for same names
  const prev = {};
  state.paramRows.forEach(r => { prev[r.name] = r; });
  state.paramRows = paramNames.map(name => ({
    name,
    init: prev[name] ? prev[name].init : 1,
    min: prev[name] ? prev[name].min : -1e10,
    max: prev[name] ? prev[name].max : 1e10,
    locked: prev[name] ? (prev[name].locked || false) : false,
  }));

  container.innerHTML = `
    <div class="param-row param-row-header">
      <span class="param-name"></span>
      <span class="param-col-hdr">Init</span>
      <span class="param-col-hdr">Min</span>
      <span class="param-col-hdr">Max</span>
      <span class="param-col-hdr">Fit</span>
      <span class="param-col-hdr" style="width:24px"></span>
    </div>` + state.paramRows.map((row, i) => `
    <div class="param-row" data-pi="${i}">
      <span class="param-name">${row.name}</span>
      <input class="param-input" data-field="init" type="number" value="${fmt(row.init)}" step="any" title="Initial value">
      <input class="param-input param-bound" data-field="min"  type="number" value="${row.min <= -1e9 ? '' : fmt(row.min)}" step="any" placeholder="-∞" title="Lower bound (leave blank for -∞)">
      <input class="param-input param-bound" data-field="max"  type="number" value="${row.max >= 1e9 ? '' : fmt(row.max)}" step="any" placeholder="+∞" title="Upper bound (leave blank for +∞)">
      <span class="param-fit-val" title="">—</span>
      <button class="param-lock-btn${row.locked ? ' locked' : ''}" data-pi="${i}" title="${row.locked ? 'Unlock parameter' : 'Lock parameter (hold fixed)'}">${row.locked ? '🔒' : '🔓'}</button>
    </div>
    <div class="param-sweep-row" data-si="${i}">
      <span style="font-size:.62em;color:var(--dimmer);font-family:var(--mono)">sweep</span>
      <input type="range" class="param-sweep-range" data-si="${i}" step="any">
      <span class="param-sweep-val">—</span>
    </div>`).join('');

  container.querySelectorAll('.param-row:not(.param-row-header)').forEach(row => {
    const i = parseInt(row.dataset.pi);
    row.querySelectorAll('.param-input').forEach(inp => {
      inp.addEventListener('change', () => {
        const v = parseFloat(inp.value);
        if (isFinite(v)) {
          state.paramRows[i][inp.dataset.field] = v;
          // Recalibrate sweep range if init changed
          if (inp.dataset.field === 'init') {
            const sld = container.querySelector(`.param-sweep-range[data-si="${i}"]`);
            if (sld) { const { rMin, rMax } = sweepRange(state.paramRows[i]); sld.min = rMin; sld.max = rMax; sld.step = (rMax - rMin) / 200; sld.value = v; }
          }
        } else if (inp.dataset.field === 'min') state.paramRows[i].min = -1e10;
        else if (inp.dataset.field === 'max') state.paramRows[i].max = 1e10;
      });
    });
  });

  container.querySelectorAll('.param-lock-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const i = parseInt(btn.dataset.pi);
      if (i >= 0 && i < state.paramRows.length) {
        state.paramRows[i].locked = !state.paramRows[i].locked;
        btn.textContent = state.paramRows[i].locked ? '🔒' : '🔓';
        btn.title = state.paramRows[i].locked ? 'Unlock parameter (hold fixed)' : 'Lock parameter (hold fixed)';
        btn.classList.toggle('locked', state.paramRows[i].locked);
      }
    });
  });

  // Set up sweep sliders
  container.querySelectorAll('.param-sweep-row').forEach(sweepRow => {
    const si = parseInt(sweepRow.dataset.si);
    const row = state.paramRows[si];
    if (!row) return;
    const slider  = sweepRow.querySelector('.param-sweep-range');
    const valSpan = sweepRow.querySelector('.param-sweep-val');
    const { rMin, rMax } = sweepRange(row);
    slider.min = rMin; slider.max = rMax;
    slider.step = (rMax - rMin) / 200;
    slider.value = row.init;
    valSpan.textContent = fmt(row.init);

    slider.addEventListener('input', () => {
      const v = parseFloat(slider.value);
      valSpan.textContent = fmt(v);
      const initInp = container.querySelector(`.param-row[data-pi="${si}"] [data-field="init"]`);
      if (initInp) initInp.value = fmt(v);
      state.paramRows[si].init = v;
      state.sweepParams = state.paramRows.map((r, j) => {
        const sld = container.querySelector(`.param-sweep-range[data-si="${j}"]`);
        return sld ? parseFloat(sld.value) : r.init;
      });
      // Visual cue when slider is pinned at a bound
      const span = parseFloat(slider.max) - parseFloat(slider.min);
      const pct = span > 0 ? (v - parseFloat(slider.min)) / span : 0.5;
      slider.classList.toggle('at-bound', pct < 0.015 || pct > 0.985);
      updateSweepPreview();
    });

    slider.addEventListener('change', () => {
      state.sweepParams = null;
      updatePlots();
    });
  });
}

function updateSweepPreview() {
  const tc      = themeColors();
  const xlabel  = document.getElementById('plot-xlabel').value || 'x';
  const ylabel  = document.getElementById('plot-ylabel').value || 'y';
  const title   = document.getElementById('plot-title').value  || '';
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
  if (plotsInitialised) Plotly.react(document.getElementById('main-plot'), mainTraces, mainLayout);
}

function renderParamResults(fit) {
  if (!fit || !fit.result) return;
  const container = document.getElementById('param-table-container');
  const rows = container.querySelectorAll('.param-row:not(.param-row-header)');
  const { params, paramErrors } = fit.result;
  rows.forEach((row, i) => {
    if (params[i] == null) return;
    const val = params[i];
    const err = paramErrors && paramErrors[i];
    const initInp = row.querySelector('[data-field="init"]');
    if (initInp) {
      initInp.value = fmt(val);
      if (i < state.paramRows.length) state.paramRows[i].init = val;
    }
    const fitSpan = row.querySelector('.param-fit-val');
    if (fitSpan) {
      fitSpan.textContent = fmt(val);
      fitSpan.title = err && isFinite(err) ? `${fit.paramNames[i]} = ${fmt(val)} ± ${fmt(err)}` : `${fit.paramNames[i]} = ${fmt(val)}`;
    }
    // Recalibrate sweep slider to new value
    const slider = container.querySelector(`.param-sweep-range[data-si="${i}"]`);
    const valSpan = container.querySelector(`.param-sweep-row[data-si="${i}"] .param-sweep-val`);
    if (slider && i < state.paramRows.length) {
      const { rMin, rMax } = sweepRange(state.paramRows[i]);
      slider.min = rMin; slider.max = rMax;
      slider.step = (rMax - rMin) / 200;
      slider.value = val;
      if (valSpan) valSpan.textContent = fmt(val);
    }
  });
  // Update fit notes textarea
  const notesSection = document.getElementById('fit-notes-section');
  const notesInput   = document.getElementById('fit-notes-input');
  if (notesSection && notesInput) {
    notesSection.style.display = '';
    notesInput.value = fit.notes || '';
    notesInput.oninput = () => {
      fit.notes = notesInput.value;
      // Refresh badge in fit list (notes icon)
      const item = document.querySelector(`.fit-item[data-fitid="${fit.id}"] .ds-label`);
      if (item) {
        const dot = item.querySelector('.fit-notes-dot');
        if (fit.notes.trim() && !dot) renderFitList();
        else if (!fit.notes.trim() && dot) renderFitList();
      }
    };
  }
  renderCorrMatrix(fit);
}

function renderCorrMatrix(fit) {
  const el = document.getElementById('corr-matrix-container');
  const sidePanel = document.getElementById('statsbar-corr');
  if (!el) return;
  const { covMatrix } = fit ? (fit.result || {}) : {};
  const names = fit ? (fit.paramNames || []) : [];
  if (!covMatrix || names.length < 2) {
    el.innerHTML = '';
    if (sidePanel) sidePanel.classList.add('corr-empty');
    document.querySelector('.app-statsbar')?.classList.add('corr-empty');
    return;
  }
  if (sidePanel) sidePanel.classList.remove('corr-empty');
  document.querySelector('.app-statsbar')?.classList.remove('corr-empty');
  const m = names.length;
  const corr = Array.from({ length: m }, (_, i) =>
    Array.from({ length: m }, (_, j) => {
      const denom = Math.sqrt(Math.abs(covMatrix[i][i] * covMatrix[j][j]));
      return denom < 1e-20 ? (i === j ? 1 : 0) : covMatrix[i][j] / denom;
    })
  );
  const isDk = document.body.classList.contains('dark-mode');
  // Diverging colormap: neutral (v≈0) blends into the panel background so it
  // works in both themes; positive → blue, negative → red.
  const neutral = isDk ? [18, 36, 63] : [247, 249, 252];
  function corrColor(v) {
    const t = Math.min(1, Math.abs(Math.max(-1, Math.min(1, v))));
    const end = v >= 0 ? [37, 99, 235] : [220, 38, 38];
    const mix = k => Math.round(neutral[k] + (end[k] - neutral[k]) * t);
    return `rgb(${mix(0)},${mix(1)},${mix(2)})`;
  }
  // Pick black/white text by the cell's relative luminance for guaranteed contrast.
  function textOn(rgb) {
    const m = rgb.match(/\d+/g).map(Number);
    const lum = (0.299 * m[0] + 0.587 * m[1] + 0.114 * m[2]) / 255;
    return lum < 0.55 ? '#ffffff' : '#15212e';
  }
  const header = `<tr><th></th>${names.map(n => `<th title="${n}">${n.length>4?n.slice(0,4):n}</th>`).join('')}</tr>`;
  const bodyRows = corr.map((row, i) =>
    `<tr><td>${names[i].length>4?names[i].slice(0,4):names[i]}</td>` +
    row.map((v, j) => {
      const bg = corrColor(v);
      return `<td style="background:${bg};color:${textOn(bg)}" title="${names[i]}↔${names[j]}: ${v.toFixed(3)}">${v.toFixed(2)}</td>`;
    }).join('') + '</tr>'
  ).join('');

  // All pairwise values for the scrollable list
  const allPairs = [];
  for (let i = 0; i < m; i++)
    for (let j = i+1; j < m; j++)
      allPairs.push({ i, j, v: corr[i][j] });
  allPairs.sort((a, b) => Math.abs(b.v) - Math.abs(a.v));
  const listHtml = allPairs.map(({ i, j, v }) => {
    const av = Math.abs(v);
    const barColor = corrColor(v);
    const valCls = av >= 0.95 ? 'style="color:var(--red)"' : av >= 0.70 ? 'style="color:var(--amber)"' : '';
    return `<div class="corr-list-row">
      <span class="corr-list-pair" title="${names[i]} ↔ ${names[j]}">${names[i]} ↔ ${names[j]}</span>
      <span class="corr-list-bar" style="background:${barColor}"></span>
      <span class="corr-list-val" ${valCls}>${v.toFixed(3)}</span>
    </div>`;
  }).join('');

  // Suggestions (up to 3, most severe)
  const pairs = allPairs.filter(p => Math.abs(p.v) >= 0.70);
  let suggHtml = '';
  if (pairs.length === 0) {
    suggHtml = `<div class="corr-suggestion corr-ok">✓ All parameters well-determined.</div>`;
  } else {
    suggHtml = pairs.slice(0,3).map(({ i, j, v }) => {
      const ar = Math.abs(v), dir = v > 0 ? 'positively' : 'negatively';
      let advice, cls;
      if (ar >= 0.95) { cls = 'corr-strong'; advice = 'Near-redundant — fix one or reparameterise.'; }
      else if (ar >= 0.85) { cls = 'corr-high'; advice = 'Partially dependent — widen x-range.'; }
      else { cls = 'corr-moderate'; advice = 'Mild dependency.'; }
      return `<div class="corr-suggestion ${cls}"><span class="corr-pair"><b>${names[i]}</b> ↔ <b>${names[j]}</b> r=${v.toFixed(2)}</span> ${advice}</div>`;
    }).join('');
  }

  el.innerHTML = `
    <div class="corr-matrix-label">Parameter Correlations<span class="panel-tip" data-tip="corr-matrix">?</span></div>
    <div class="corr-panel-cols">
      <div class="corr-panel-heatmap">
        <table class="corr-matrix"><thead>${header}</thead><tbody>${bodyRows}</tbody></table>
      </div>
      <div class="corr-panel-list">${listHtml || '<span style="color:var(--dimmer);font-size:.72em">—</span>'}</div>
    </div>
    <div class="corr-suggestions" style="margin-top:6px">${suggHtml}</div>`;
}

let _consoleMsg = { text: '', type: '', timer: null };
let _expandedFitIds = new Set();

function setConsole(msg, type) {
  if (_consoleMsg.timer) clearTimeout(_consoleMsg.timer);
  _consoleMsg.text = msg;
  _consoleMsg.type = type;
  if (type !== 'error') {
    _consoleMsg.timer = setTimeout(() => {
      _consoleMsg.text = '';
      _consoleMsg.timer = null;
      renderStatsTable();
    }, 5000);
  } else {
    _consoleMsg.timer = null;
  }
  renderStatsTable();
}

function renderStats(fit) {
  renderStatsTable();
}

function renderStatsTable() {
  const el = document.getElementById('app-console');
  if (!el) return;

  let msgHtml = '';
  if (_consoleMsg.text) {
    const cls = _consoleMsg.type === 'error' ? 'console-status-err' : _consoleMsg.type === 'warn' ? 'console-status-warn' : 'console-hint';
    msgHtml = `<div class="stats-msg-row"><span class="${cls}">${_consoleMsg.text}</span></div>`;
  }

  if (!state.fits.length) {
    el.innerHTML = msgHtml || '<span class="console-hint">Load a dataset and press <strong>▶ Fit</strong> to begin.</span>';
    return;
  }

  const visibleFits = state.fits.filter(fit => {
    const ds = state.datasets.find(d => d.id === fit.dsId);
    return ds && ds.enabled !== false;
  });
  if (!visibleFits.length) {
    el.innerHTML = msgHtml || '<span class="console-hint">All datasets are disabled — enable a dataset to see fit statistics.</span>';
    return;
  }

  const NCOLS = 12;
  const rows = visibleFits.map(fit => {
    const r = fit.result;
    const isActive = fit.id === state.activeFitId;
    const isExpanded = _expandedFitIds.has(fit.id);
    const ds = state.datasets.find(d => d.id === fit.dsId);
    const dsName = ds ? ds.name : '—';
    const lambdaTip  = r?.finalLambda != null ? ` λ=${r.finalLambda.toExponential(2)}` : '';
    const gradTip    = r?.gradNorm    != null ? ` |∇|=${r.gradNorm.toExponential(2)}`   : '';
    const diagTip    = lambdaTip + gradTip;
    const statusText = !r ? '—' : r.converged ? `✓ ${r.iter}` : `⚠ ${r.iter}`;
    const statusCls  = !r ? '' : r.converged ? 'stat-status-ok' : 'stat-status-warn';
    const label = (fit.label || fit.model).replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const chevron = `<span class="stats-chevron">${isExpanded ? '▾' : '▸'}</span>`;
    const expandHtml = (isExpanded && r) ? buildStatExpandRow(fit, r, NCOLS) : '';
    return `<tr class="stats-row${isActive ? ' active' : ''}" data-fit-id="${fit.id}">
      <td><span class="stats-color-dot" style="background:${fit.color}"></span></td>
      <td title="${label}">${chevron}${label}</td>
      <td title="${dsName}">${dsName}</td>
      <td>${r ? fmt(r.rSq, 5) : '—'}</td>
      <td>${r ? fmt(r.adjRSq, 5) : '—'}</td>
      <td>${r ? fmt(r.rmse) : '—'}</td>
      <td>${r ? fmt(r.sse) : '—'}</td>
      <td>${r?.chiSqRed != null ? fmt(r.chiSqRed) : '—'}</td>
      <td>${r ? fmt(r.aic) : '—'}</td>
      <td>${r ? fmt(r.bic) : '—'}</td>
      <td>${r ? r.n : '—'}</td>
      <td class="${statusCls}" title="${diagTip.trim()}">${statusText}${diagTip ? ' ⓘ' : ''}</td>
    </tr>${expandHtml}`;
  }).join('');

  el.innerHTML = msgHtml + `<div class="stats-table-wrap"><table class="stats-table">
    <thead><tr>
      <th></th><th>Fit</th><th>Dataset</th>
      <th>R²</th><th>Adj-R²</th><th>RMSE</th><th>SSE</th><th title="Reduced chi-square (σ-weighted fits only)">χ²ᵣ</th><th>AIC</th><th>BIC</th><th>N</th><th>Status</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table></div>`;

  el.querySelectorAll('.stats-row').forEach(tr => {
    tr.addEventListener('click', () => {
      const id = parseInt(tr.dataset.fitId);
      const fit = state.fits.find(f => f.id === id);
      if (!fit) return;
      state.activeFitId = id;
      if (_expandedFitIds.has(id)) _expandedFitIds.delete(id);
      else _expandedFitIds.add(id);
      renderParamResults(fit);
      renderFitList();
      renderStatsTable();
    });
  });
}

function buildStatExpandRow(fit, r, colSpan) {
  const dof = r.dof || 1;
  const tc = tCritical95(dof);
  const algoNames = { lm: 'Levenberg-Marquardt', gn: 'Gauss-Newton', nm: 'Nelder-Mead', bfgs: 'BFGS' };
  const weightNames = { sigma: '1/σ²', huber: 'Huber IRLS', y2: '1/y²', y: '1/y', none: 'none' };
  const statusStr = r.converged ? '✓ Converged' : '⚠ Did not converge';
  const iterStr = r.iter != null ? ` (${r.iter} iter)` : '';
  const metaStr = [
    statusStr + iterStr,
    algoNames[fit.algoKey] || fit.algoKey || '—',
    `N = ${r.n}`,
    `dof = ${dof}`,
    `Weights: ${weightNames[fit.weightMode] || fit.weightMode || 'none'}`,
    r.finalLambda != null ? `λ = ${r.finalLambda.toExponential(2)}` : null,
  ].filter(Boolean).join('  ·  ');

  const pna = '<span class="sep-na">—</span>';
  let paramRows = '';
  if (r.params && fit.paramNames) {
    paramRows = fit.paramNames.map((name, i) => {
      const val = r.params[i];
      const rawErr = r.paramErrors && r.paramErrors[i];
      const err = rawErr && isFinite(rawErr) && rawErr > 0 ? rawErr : null;
      const sem = (err && r.n > 0) ? err / Math.sqrt(r.n) : null;
      const ciLo = err ? val - tc * err : null;
      const ciHi = err ? val + tc * err : null;
      const tStat = err ? val / err : null;
      const tCls = tStat != null ? (Math.abs(tStat) >= 2 ? 'sep-sig' : 'sep-insig') : '';
      return `<tr>
        <td class="sep-name">${name}</td>
        <td>${fmt(val, 6)}</td>
        <td>${err ? fmt(err, 4) : pna}</td>
        <td>${sem ? fmt(sem, 4) : pna}</td>
        <td>${ciLo != null ? fmt(ciLo, 5) + ' &ndash; ' + fmt(ciHi, 5) : pna}</td>
        <td class="${tCls}">${tStat != null ? fmt(tStat, 3) : pna}</td>
      </tr>`;
    }).join('');
  }

  // Summary stat chips (model quality)
  const sqChip = (lbl, val, tip) =>
    `<div class="stats-ext-chip">` +
    `<span class="stats-ext-chip-lbl">${lbl}<span class="stats-ext-tip" title="${tip}">ⓘ</span></span>` +
    `<span class="stats-ext-chip-val">${val}</span></div>`;
  const sumChipsHtml = [
    sqChip('R²',     isFinite(r.rSq)    ? r.rSq.toFixed(6)    : '—', 'Coefficient of determination — fraction of variance in y explained by the model. Closer to 1 is better.'),
    sqChip('Adj-R²', isFinite(r.adjRSq) ? r.adjRSq.toFixed(6) : '—', 'R² penalised for the number of fitted parameters — use this when comparing models of different complexity.'),
    sqChip('RMSE',   fmt(r.rmse),   'Root Mean Square Error — typical residual magnitude in the same units as y. Should be comparable to your measurement noise.'),
    sqChip('SSE',    fmt(r.sse),    'Sum of Squared Errors — the raw objective minimised by the solver.'),
    sqChip('AIC',    fmt(r.aic),    'Akaike Information Criterion — model quality penalised for complexity. Lower is better; differences > 10 are decisive.'),
    sqChip('BIC',    fmt(r.bic),    'Bayesian Information Criterion — like AIC but with a stronger penalty for parameter count. Lower is better.'),
    sqChip('N',      String(r.n),   'Number of non-masked data points used in the fit.'),
    ...(r.chiSqRed != null ? [sqChip('χ²ᵣ', fmt(r.chiSqRed), 'Reduced chi-square = Σ(rᵢ/σᵢ)²/dof; shown only for 1/σ² weighted fits. ≈ 1 means well-calibrated noise model.')] : []),
  ].join('');

  // ── Extended statistics ──────────────────────────────────
  const ds = state.datasets.find(d => d.id === fit.dsId);
  const excl = (ds && ds.excludedIndices) || new Set();
  const yVals = ds ? ds.y.filter((_, i) => !excl.has(i)) : [];
  const nP = fit.paramNames ? fit.paramNames.length : 0;
  const resids = r.residuals || [];

  // MAE
  const mae = resids.length ? resids.reduce((s, e) => s + Math.abs(e), 0) / resids.length : null;

  // Max |residual|
  const maxE = resids.length ? Math.max(...resids.map(Math.abs)) : null;

  // CV% = RMSE / |ȳ| × 100
  const yMean = yVals.length ? yVals.reduce((s, y) => s + y, 0) / yVals.length : 0;
  const cvPct = (r.rmse != null && isFinite(r.rmse) && Math.abs(yMean) > 1e-12)
    ? (r.rmse / Math.abs(yMean)) * 100 : null;

  // Log-likelihood (Gaussian MLE): LL = −n/2·(ln(2π·SSE/n)+1)
  const logLik = (r.n > 0 && r.sse > 0)
    ? -r.n / 2 * (Math.log(2 * Math.PI * r.sse / r.n) + 1) : null;

  // Overall F-statistic: F = (SSR/nP) / (SSE/dof), SSR = SST − SSE
  let fStat = null, fPVal = null;
  if (yVals.length >= 2 && nP > 0 && r.sse != null && dof > 0) {
    const sst = yVals.reduce((s, y) => s + (y - yMean) ** 2, 0);
    const ssr = sst - r.sse;
    if (ssr > 0 && nP > 0) {
      fStat = (ssr / nP) / (r.sse / dof);
      fPVal = fDistPValue(fStat, nP, dof);
    }
  }

  // Durbin-Watson
  const dw = durbinWatson(resids);

  // Runs test
  const runsP = runsTestP(resids);

  // Condition number of J (from covariance matrix)
  const condJ = jacobianConditionNumber(r.covMatrix);

  // ── Helper: one ext-stat chip ─────────────────────────────
  const chip = (lbl, tooltip, valHtml, chipCls = '') =>
    `<div class="stats-ext-chip${chipCls ? ' ' + chipCls : ''}">` +
    `<span class="stats-ext-chip-lbl">${lbl}<span class="stats-ext-tip" title="${tooltip}">ⓘ</span></span>` +
    `<span class="stats-ext-chip-val">${valHtml}</span>` +
    `</div>`;
  const na = `<span class="sep-na">—</span>`;

  // Durbin-Watson chip
  let dwChipCls = '', dwValHtml = na;
  if (dw != null) {
    const dwGood = dw >= 1.5 && dw <= 2.5;
    dwChipCls = dwGood ? 'chip-good' : 'chip-warn';
    const dwA = dwGood ? 'stats-ext-good' : 'stats-ext-warn';
    const dwTxt = dw < 1.5 ? 'pos. autocorr.' : dw > 2.5 ? 'neg. autocorr.' : 'no autocorr.';
    dwValHtml = `${dw.toFixed(3)}<span class="${dwA} stats-ext-annot"> ${dwTxt}</span>`;
  }

  // Runs test chip
  let runsChipCls = '', runsPValHtml = na;
  if (runsP != null) {
    runsChipCls = runsP < 0.05 ? 'chip-warn' : 'chip-good';
    const runsA = runsP < 0.05 ? 'stats-ext-warn' : 'stats-ext-good';
    const runsTxt = runsP < 0.05 ? 'pattern!' : 'random';
    runsPValHtml = `${runsP < 0.001 ? '< 0.001' : runsP.toFixed(3)}<span class="${runsA} stats-ext-annot"> ${runsTxt}</span>`;
  }

  // Cond(J) chip
  let condChipCls = '', condValHtml = na;
  if (condJ != null) {
    condChipCls = condJ > 1000 ? 'chip-bad' : condJ > 100 ? 'chip-warn' : 'chip-good';
    const condA = condJ > 1000 ? 'stats-ext-bad' : condJ > 100 ? 'stats-ext-warn' : 'stats-ext-good';
    const condTxt = condJ > 1000 ? 'ill-cond.' : condJ > 100 ? 'moderate' : 'well-cond.';
    condValHtml = `${condJ > 9999 ? condJ.toExponential(2) : condJ.toFixed(1)}<span class="${condA} stats-ext-annot"> ${condTxt}</span>`;
  }

  // F-stat chip
  const fPStr = fPVal == null ? '' : fPVal < 0.001 ? ' (p<0.001)' : ` (p=${fPVal.toFixed(3)})`;
  const fHtml = fStat != null ? `${fmt(fStat, 4)}${fPStr}` : na;

  const extChipsHtml = [
    chip('MAE',          'Mean Absolute Error — average of |residuals|; less sensitive to outliers than RMSE because errors are not squared.',                                                                           mae    != null ? fmt(mae)              : na),
    chip('Max |e|',      'Largest absolute residual — the single worst-case data point.',                                                                                                                               maxE   != null ? fmt(maxE)             : na),
    chip('CV%',          'Coefficient of Variation — RMSE as a percentage of |ȳ|; scale-free fit quality useful for comparing fits across datasets with different y magnitudes.',                                       cvPct  != null ? cvPct.toFixed(2) + '%': na),
    chip('df',           'Degrees of freedom = N − p, where p is the number of fitted parameters. Required for confidence intervals and hypothesis tests.',                                                             String(dof)),
    chip('Log-lik',      'Gaussian MLE: LL = −N/2·(ln(2π·SSE/N)+1). Higher (less negative) is better; the basis for AIC and BIC.',                                                                                    logLik != null ? logLik.toFixed(3)     : na),
    chip('F-statistic',  'Overall model F-test: F = (SSR/p)/(SSE/df). Tests whether the model explains significantly more variance than the mean alone. Approximate for nonlinear models.',                            fHtml),
    chip('Durbin-Watson','First-order autocorrelation: d = Σ(eᵢ−eᵢ₋₁)²/Σeᵢ². Range 0–4; ≈ 2 is ideal. < 1.5 = pos. autocorr., > 2.5 = neg. autocorr.',                                                             dwValHtml,   dwChipCls),
    chip('Runs test p',  'Wald-Wolfowitz test: checks whether residual signs are random. p < 0.05 suggests a systematic pattern — the model may be misspecified.',                                                     runsPValHtml, runsChipCls),
    chip('Cond(J)',      'Jacobian condition number ≈ √(λmax/λmin) of parameter correlation matrix. < 100: well-conditioned; 100–1000: moderate; > 1000: ill-conditioned (inflated std errors).',                     condValHtml,  condChipCls),
  ].join('');

  return `<tr class="stats-expand-row">
    <td colspan="${colSpan}">
      <div class="stats-expand-body">
        <div class="stats-expand-meta">${metaStr}</div>
        <table class="stats-param-detail">
          <thead><tr>
            <th class="sth-left">Parameter</th>
            <th>Value</th>
            <th>SE <span class="sth-sub">std error</span></th>
            <th>SEM <span class="sth-sub">SE/√N</span></th>
            <th>95% CI <span class="sth-sub">t<sub>${dof}</sub> = ${fmt(tc, 3)}</span></th>
            <th>t-stat</th>
          </tr></thead>
          <tbody>${paramRows}</tbody>
        </table>
        <div class="stats-chips-section">
          <div class="stats-chips-group">
            <span class="stats-chips-label">Model Quality</span>
            <div class="stats-ext-chips">${sumChipsHtml}</div>
          </div>
          <div class="stats-chips-group">
            <span class="stats-chips-label">Diagnostics</span>
            <div class="stats-ext-chips">${extChipsHtml}</div>
          </div>
        </div>
      </div>
    </td>
  </tr>`;
}

function syncFitDatasetSelect() {
  const sel = document.getElementById('fit-dataset-select');
  const cur = sel.value;
  const fittable = state.datasets.filter(d => d.enabled !== false);
  sel.innerHTML = fittable.length
    ? fittable.map(ds => `<option value="${ds.id}">${ds.name}</option>`).join('')
    : '<option value="">— no enabled dataset —</option>';
  const activeEnabled = fittable.find(d => d.id === state.activeDatasetId);
  if (activeEnabled) sel.value = state.activeDatasetId;
  else if (cur) sel.value = cur;
  syncWeightOptions();
}

function syncWeightOptions() {
  const dsId  = parseInt(document.getElementById('fit-dataset-select')?.value);
  const ds    = state.datasets.find(d => d.id === dsId);
  const wSel  = document.getElementById('opt-weights');
  const sigOpt = wSel?.querySelector('option[value="sigma"]');
  if (!sigOpt) return;
  if (ds?.sigY) {
    sigOpt.disabled = false;
    sigOpt.textContent = '1/σ² (data σ)';
  } else {
    sigOpt.disabled = true;
    sigOpt.textContent = '1/σ² (no σ data)';
    if (wSel.value === 'sigma') wSel.value = 'none';
  }
}

function syncModelCustomSection() {
  const model = document.getElementById('model-select').value;
  state.fitConfig.model = model;
  document.getElementById('custom-eq-section').style.display = model === 'Custom' ? '' : 'none';
  const eqEl = document.getElementById('model-eq-display');
  if (eqEl) {
    const latex = MODEL_EQ[model];
    eqEl.innerHTML = latex ? katex.renderToString(latex, { throwOnError: false, displayMode: false }) : '';
  }
  const editBtn = document.getElementById('model-edit-as-custom');
  if (editBtn) editBtn.style.display = (model !== 'Custom' && MODEL_EQ_JS[model]) ? '' : 'none';
  if (model === 'Custom') {
    // Auto-parse the current equation value immediately on model change
    const eqInput = document.getElementById('custom-eq-input');
    parseCustomEquation(eqInput.value);
  } else {
    renderParamTable();
  }
}
