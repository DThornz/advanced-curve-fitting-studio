// Data parsing and import: delimiter detection, CSV parsing, column picker, importDataset
/* ═══════════════════════════════════════════════════════════
   DATA PARSING
═══════════════════════════════════════════════════════════ */
function detectDelimiter(text) {
  const sample = text.slice(0, 500);
  const counts = { ',': 0, '\t': 0, ';': 0, ' ': 0 };
  for (const ch of sample) if (ch in counts) counts[ch]++;
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

function _parseCSVLine(line, delim) {
  if (!line.includes('"')) return line.split(delim).map(s => s.trim());
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === delim && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function parseDelimited(text, delim) {
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1); // strip UTF-8 BOM
  if (delim === 'auto' || !delim) delim = detectDelimiter(text);
  const lines = text.trim().split(/\r?\n/)
    .filter(l => l.trim() && !l.trim().startsWith('#'));
  const rows = lines.map(l => _parseCSVLine(l, delim));
  return rows;
}

function rowsToXY(rows) {
  let startRow = 0;
  let xlabel = null, ylabel = null, title = null;

  if (rows.length === 0) return { x: [], y: [], xlabel, ylabel, title };

  const firstRow = rows[0];
  const isNum = v => v.trim() !== '' && isFinite(parseFloat(v.replace(',', '.')));

  if (firstRow.length === 1 && !isNum(firstRow[0])) {
    // Single non-numeric cell → plot title
    title = firstRow[0].trim();
    startRow = 1;
  } else if (firstRow.length >= 2 && (!isNum(firstRow[0]) || !isNum(firstRow[1]))) {
    // Two columns with at least one non-numeric → X / Y axis labels
    xlabel = firstRow[0].trim();
    ylabel = firstRow[1].trim();
    startRow = 1;
  }

  const xs = [], ys = [];
  for (let i = startRow; i < rows.length; i++) {
    const row = rows[i];
    if (row.length < 2) continue;
    const x = parseFloat(row[0].replace(',', '.'));
    const y = parseFloat(row[1].replace(',', '.'));
    if (isFinite(x) && isFinite(y)) { xs.push(x); ys.push(y); }
  }
  return { x: xs, y: ys, xlabel, ylabel, title };
}

let _pendingImport = null; // { name, rows, headers, startRow, numericCols }

/* ── Aggregation helpers (replicates / grouped modes) ─────── */
function _aggMean(a)   { return a.reduce((s, v) => s + v, 0) / a.length; }
function _aggMedian(a) {
  const b = a.slice().sort((x, y) => x - y), m = b.length >> 1;
  return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2;
}
function _aggCenter(a, method) { return method === 'median' ? _aggMedian(a) : _aggMean(a); }
function _sampleSD(a) {
  if (a.length < 2) return NaN;
  const m = _aggMean(a);
  return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1));
}
function _spread(a, sigMethod) {
  if (sigMethod === 'none' || a.length < 2) return NaN;
  const sd = _sampleSD(a);
  return sigMethod === 'sem' ? sd / Math.sqrt(a.length) : sd;
}
function _cellNum(row, col) { return parseFloat((row[col] || '').replace(',', '.')); }

function rowsToXYCols(rows, headers, startRow, xCol, yCol, sigCol) {
  const xs = [], ys = [], sigs = [];
  for (let i = startRow; i < rows.length; i++) {
    const row = rows[i];
    const xv = _cellNum(row, xCol), yv = _cellNum(row, yCol);
    if (isFinite(xv) && isFinite(yv)) {
      xs.push(xv); ys.push(yv);
      if (sigCol != null) {
        const sv = _cellNum(row, sigCol);
        sigs.push(isFinite(sv) && sv > 0 ? sv : NaN);
      }
    }
  }
  const sigY = (sigCol != null && sigs.some(v => isFinite(v))) ? sigs : null;
  return { x: xs, y: ys, sigY };
}

// Wide-format replicates: one X column + several Y columns → mean ± σ per row.
function rowsToReplicates(rows, startRow, xCol, yCols, aggMethod, sigMethod) {
  const xs = [], ys = [], sigs = [];
  for (let i = startRow; i < rows.length; i++) {
    const row = rows[i];
    const xv = _cellNum(row, xCol);
    if (!isFinite(xv)) continue;
    const reps = yCols.map(c => _cellNum(row, c)).filter(isFinite);
    if (reps.length < 1) continue;
    xs.push(xv);
    ys.push(_aggCenter(reps, aggMethod));
    const sd = _spread(reps, sigMethod);
    sigs.push(isFinite(sd) && sd > 0 ? sd : NaN);
  }
  const sigY = sigs.some(v => isFinite(v)) ? sigs : null;
  return { x: xs, y: ys, sigY };
}

// Long-format groups: X, Y, group column → one dataset per group label.
// Replicate Y values sharing an X within a group are aggregated to mean ± σ.
function rowsToGroups(rows, startRow, xCol, yCol, groupCol, aggMethod, sigMethod) {
  const groups = new Map(); // label → Map(xKey → { x, ys: [] })
  const order = [];
  for (let i = startRow; i < rows.length; i++) {
    const row = rows[i];
    const xv = _cellNum(row, xCol), yv = _cellNum(row, yCol);
    if (!isFinite(xv) || !isFinite(yv)) continue;
    const label = (row[groupCol] != null ? String(row[groupCol]).trim() : '') || '(blank)';
    if (!groups.has(label)) { groups.set(label, new Map()); order.push(label); }
    const xmap = groups.get(label);
    const key = String(xv);
    if (!xmap.has(key)) xmap.set(key, { x: xv, ys: [] });
    xmap.get(key).ys.push(yv);
  }
  return order.map(label => {
    const xmap = groups.get(label);
    const pts = [...xmap.values()].sort((a, b) => a.x - b.x);
    const x = pts.map(p => p.x);
    const y = pts.map(p => _aggCenter(p.ys, aggMethod));
    const sigs = pts.map(p => { const sd = _spread(p.ys, sigMethod); return isFinite(sd) && sd > 0 ? sd : NaN; });
    const sigY = sigs.some(v => isFinite(v)) ? sigs : null;
    const hasReplicates = pts.some(p => p.ys.length > 1);
    return { label, x, y, sigY, hasReplicates };
  });
}

function needsColumnPicker(rows) {
  const isNum = v => v.trim() !== '' && isFinite(parseFloat(v.replace(',', '.')));
  const dataRow = rows.find(r => r.some(v => isNum(v)));
  return dataRow && dataRow.length >= 3;
}

// Which columns hold mostly numeric data (used to seed X/Y/σ pickers & replicate list).
function _numericColumns(rows, headers, startRow) {
  const out = [];
  for (let c = 0; c < headers.length; c++) {
    let num = 0, tot = 0;
    for (let i = startRow; i < rows.length; i++) {
      const cell = rows[i][c];
      if (cell == null || cell.trim() === '') continue;
      tot++;
      if (isFinite(parseFloat(cell.replace(',', '.')))) num++;
    }
    if (tot > 0 && num / tot >= 0.6) out.push(c);
  }
  return out;
}

function openColumnPicker(name, rows) {
  const isNum = v => v.trim() !== '' && isFinite(parseFloat(v.replace(',', '.')));
  const hasHeader = rows.length > 0 && rows[0].some(v => !isNum(v));
  const headers = hasHeader
    ? rows[0].map((v, i) => v.trim() || `Col ${i + 1}`)
    : rows[0].map((_, i) => `Col ${i + 1}`);
  const startRow = hasHeader ? 1 : 0;
  const numericCols = _numericColumns(rows, headers, startRow);
  _pendingImport = { name, rows, headers, startRow, numericCols };

  const xSel  = document.getElementById('col-picker-x');
  const ySel  = document.getElementById('col-picker-y');
  const sigSel = document.getElementById('col-picker-sig');
  const grpSel = document.getElementById('col-picker-group');
  const yColsBox = document.getElementById('col-picker-ycols');
  // Auto-select σ column when header looks like an uncertainty column
  const sigKeywords = /^(sig|sigma|err|error|uncertainty|sd|std|stdev|s\.?e\.?)$/i;
  const autoSigIdx = headers.findIndex(h => sigKeywords.test(h.trim()));
  const numSet = new Set(numericCols);
  const firstNum = numericCols[0] ?? 0;
  const secondNum = numericCols.find(c => c !== firstNum) ?? (firstNum + 1);

  // Use DOM methods (not innerHTML) to prevent XSS from malicious CSV header names
  [xSel, ySel, sigSel, grpSel].forEach(sel => { while (sel.options.length) sel.remove(0); });
  const noneOpt = document.createElement('option');
  noneOpt.value = ''; noneOpt.textContent = '— None (X, Y only) —';
  sigSel.appendChild(noneOpt);
  headers.forEach((h, i) => {
    [xSel, ySel, sigSel, grpSel].forEach((sel, si) => {
      // X/Y/σ pickers: numeric columns only; Group picker: all columns
      if (si < 3 && !numSet.has(i)) return;
      const opt = document.createElement('option');
      opt.value = String(i); opt.textContent = h;
      if (si === 0 && i === firstNum) opt.selected = true;
      if (si === 1 && i === secondNum) opt.selected = true;
      if (si === 2 && i === autoSigIdx && autoSigIdx >= 0) opt.selected = true;
      sel.appendChild(opt);
    });
  });
  // Default group = first non-numeric column if any, else first column
  const firstNonNum = headers.findIndex((_, i) => !numSet.has(i));
  grpSel.value = String(firstNonNum >= 0 ? firstNonNum : 0);

  // Build replicate Y-column checkboxes (numeric cols except the X default)
  yColsBox.innerHTML = '';
  numericCols.forEach(c => {
    const id = `ycol-cb-${c}`;
    const wrap = document.createElement('label');
    wrap.style.cssText = 'display:flex;align-items:center;gap:6px;cursor:pointer';
    const cb = document.createElement('input');
    cb.type = 'checkbox'; cb.className = 'col-picker-ycol-cb'; cb.value = String(c); cb.id = id;
    cb.checked = c !== firstNum;            // everything except X by default
    cb.addEventListener('change', updateColPickerPreview);
    const span = document.createElement('span');
    span.textContent = headers[c];
    wrap.appendChild(cb); wrap.appendChild(span);
    yColsBox.appendChild(wrap);
  });

  document.getElementById('col-picker-mode').value = 'single';
  updateColPickerMode();
  document.getElementById('col-picker-modal').style.display = 'flex';
}

function _checkedYCols() {
  return [...document.querySelectorAll('.col-picker-ycol-cb')].filter(cb => cb.checked).map(cb => parseInt(cb.value));
}

function updateColPickerMode() {
  const mode = document.getElementById('col-picker-mode').value;
  const show = (id, on) => { const el = document.getElementById(id); if (el) el.style.display = on ? '' : 'none'; };
  show('col-picker-y-row',     mode === 'single' || mode === 'grouped');
  show('col-picker-sig-row',   mode === 'single');
  show('col-picker-ycols-row', mode === 'multi' || mode === 'replicates');
  show('col-picker-group-row', mode === 'grouped');
  show('col-picker-agg-row',   mode === 'replicates' || mode === 'grouped');
  const descs = {
    single:     'One X column, one Y column, and an optional uncertainty (σ) column.',
    multi:      'One shared X column; each ticked Y column becomes its own dataset. Use “Fit All Datasets” to fit the same model to every one.',
    replicates: 'One shared X column; ticked Y columns are replicate measurements, collapsed to mean ± σ per row (σ enables 1/σ² weighting).',
    grouped:    'Long-format data: one X, one Y, and a category column. Each label becomes a dataset; repeated X within a label are averaged to mean ± σ.'
  };
  const d = document.getElementById('col-picker-mode-desc');
  if (d) d.textContent = descs[mode] || '';
  const hint = document.getElementById('col-picker-ycols-hint');
  if (hint) hint.textContent = mode === 'replicates' ? '(≥ 2 for a σ estimate)' : '';
  updateColPickerPreview();
}

function updateColPickerPreview() {
  if (!_pendingImport) return;
  const { rows, headers, startRow } = _pendingImport;
  const mode = document.getElementById('col-picker-mode').value;
  const xCol = parseInt(document.getElementById('col-picker-x').value);
  const lines = [];

  if (mode === 'single') {
    const yCol = parseInt(document.getElementById('col-picker-y').value);
    const sigVal = document.getElementById('col-picker-sig').value;
    const sigCol = sigVal !== '' ? parseInt(sigVal) : null;
    lines.push(sigCol != null ? `${headers[xCol]}  →  ${headers[yCol]}  ±  ${headers[sigCol]}` : `${headers[xCol]}  →  ${headers[yCol]}`);
    for (const r of rows.slice(startRow, startRow + 5)) {
      const xv = r[xCol] ?? '—', yv = r[yCol] ?? '—';
      lines.push(sigCol != null ? `  ${String(xv).padEnd(12)} ${String(yv).padEnd(12)} ${r[sigCol] ?? '—'}` : `  ${String(xv).padEnd(14)} ${yv}`);
    }
  } else if (mode === 'multi') {
    const yCols = _checkedYCols();
    lines.push(`X = ${headers[xCol]}   →   ${yCols.length} dataset(s): ${yCols.map(c => headers[c]).join(', ') || '(none selected)'}`);
  } else if (mode === 'replicates') {
    const yCols = _checkedYCols();
    const agg = document.getElementById('col-picker-agg').value;
    const sm  = document.getElementById('col-picker-sigmethod').value;
    lines.push(`X = ${headers[xCol]}   replicates: ${yCols.map(c => headers[c]).join(', ') || '(none)'}`);
    lines.push(`→ y = ${agg}(replicates), σ = ${sm === 'none' ? 'none' : sm.toUpperCase()}`);
    const rep = rowsToReplicates(rows, startRow, xCol, yCols, agg, sm);
    for (let i = 0; i < Math.min(5, rep.x.length); i++) {
      const s = rep.sigY && isFinite(rep.sigY[i]) ? ` ± ${rep.sigY[i].toPrecision(3)}` : '';
      lines.push(`  ${String(rep.x[i]).padEnd(12)} ${rep.y[i].toPrecision(4)}${s}`);
    }
  } else if (mode === 'grouped') {
    const yCol = parseInt(document.getElementById('col-picker-y').value);
    const gCol = parseInt(document.getElementById('col-picker-group').value);
    const agg = document.getElementById('col-picker-agg').value;
    const sm  = document.getElementById('col-picker-sigmethod').value;
    const ds = rowsToGroups(rows, startRow, xCol, yCol, gCol, agg, sm);
    lines.push(`Group = ${headers[gCol]}   →   ${ds.length} dataset(s)`);
    ds.slice(0, 6).forEach(g => lines.push(`  ${g.label.padEnd(16)} ${g.x.length} pts${g.hasReplicates ? ` (mean ± ${sm === 'none' ? 'σ off' : sm.toUpperCase()})` : ''}`));
  }
  document.getElementById('col-picker-preview').textContent = lines.join('\n');
}

function importFromColumnPicker() {
  if (!_pendingImport) return;
  const { name, rows, headers, startRow } = _pendingImport;
  const mode = document.getElementById('col-picker-mode').value;
  const xCol = parseInt(document.getElementById('col-picker-x').value);
  let imported = 0, withSig = 0;

  if (mode === 'single') {
    const yCol = parseInt(document.getElementById('col-picker-y').value);
    const sigVal = document.getElementById('col-picker-sig').value;
    const sigCol = sigVal !== '' ? parseInt(sigVal) : null;
    const { x, y, sigY } = rowsToXYCols(rows, headers, startRow, xCol, yCol, sigCol);
    if (!x.length) { setConsole('No valid X,Y pairs in selected columns.', 'error'); return; }
    const sigNote = sigY ? ` ± ${headers[sigCol]}` : '';
    importDataset(`${name} (${headers[xCol]} vs ${headers[yCol]}${sigNote})`, x, y, sigY);
    imported = 1; withSig = sigY ? 1 : 0;

  } else if (mode === 'multi') {
    const yCols = _checkedYCols().filter(c => c !== xCol);
    if (!yCols.length) { setConsole('Select at least one Y column.', 'error'); return; }
    for (const c of yCols) {
      const { x, y } = rowsToXYCols(rows, headers, startRow, xCol, c, null);
      if (x.length) { importDataset(`${headers[c]} (${headers[xCol]})`, x, y, null); imported++; }
    }
    if (!imported) { setConsole('No valid data in the selected columns.', 'error'); return; }

  } else if (mode === 'replicates') {
    const yCols = _checkedYCols().filter(c => c !== xCol);
    if (yCols.length < 2) { setConsole('Select at least two replicate Y columns.', 'error'); return; }
    const agg = document.getElementById('col-picker-agg').value;
    const sm  = document.getElementById('col-picker-sigmethod').value;
    const { x, y, sigY } = rowsToReplicates(rows, startRow, xCol, yCols, agg, sm);
    if (!x.length) { setConsole('No valid replicate rows found.', 'error'); return; }
    const tag = sigY ? ` ± ${sm.toUpperCase()}` : '';
    importDataset(`${name} (${agg} of ${yCols.length} reps${tag})`, x, y, sigY);
    imported = 1; withSig = sigY ? 1 : 0;

  } else if (mode === 'grouped') {
    const yCol = parseInt(document.getElementById('col-picker-y').value);
    const gCol = parseInt(document.getElementById('col-picker-group').value);
    const agg = document.getElementById('col-picker-agg').value;
    const sm  = document.getElementById('col-picker-sigmethod').value;
    const dsList = rowsToGroups(rows, startRow, xCol, yCol, gCol, agg, sm);
    if (!dsList.length) { setConsole('No groups found in the selected column.', 'error'); return; }
    for (const g of dsList) {
      if (!g.x.length) continue;
      importDataset(`${g.label} (${headers[gCol]})`, g.x, g.y, g.sigY);
      imported++; if (g.sigY) withSig++;
    }
    if (!imported) { setConsole('No valid grouped data found.', 'error'); return; }
  }

  syncFitDatasetSelect(); renderDatasetList(); updatePlots();
  const sigMsg = withSig ? `, ${withSig} with σ` : '';
  setConsole(`Imported ${imported} dataset${imported === 1 ? '' : 's'}${sigMsg}.`, '');
  document.getElementById('col-picker-modal').style.display = 'none';
  _pendingImport = null;
}

function applyParsedMeta({ xlabel, ylabel, title }) {
  if (xlabel != null) document.getElementById('plot-xlabel').value = xlabel;
  if (ylabel != null) document.getElementById('plot-ylabel').value = ylabel;
  if (title  != null) document.getElementById('plot-title').value  = title;
}

function importDataset(name, x, y, sigY, color) {
  if (!x.length || !y.length) return null;
  const ds = { id: nextId(), name: name || `Dataset ${state.datasets.length + 1}`, x, y, originalY: y.slice(), color: color || nextColor(), visible: true, enabled: true, excludedIndices: new Set() };
  if (sigY && sigY.length === x.length) ds.sigY = sigY;
  state.datasets.push(ds);
  if (!state.activeDatasetId) {
    state.activeDatasetId = ds.id;
    autoNameTab(ds.name);
  }
  return ds;
}
