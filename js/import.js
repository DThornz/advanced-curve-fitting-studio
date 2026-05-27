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

let _pendingImport = null; // { name, rows, headers, startRow }

function rowsToXYCols(rows, headers, startRow, xCol, yCol, sigCol) {
  const xs = [], ys = [], sigs = [];
  for (let i = startRow; i < rows.length; i++) {
    const row = rows[i];
    const xv = parseFloat((row[xCol] || '').replace(',', '.'));
    const yv = parseFloat((row[yCol] || '').replace(',', '.'));
    if (isFinite(xv) && isFinite(yv)) {
      xs.push(xv); ys.push(yv);
      if (sigCol != null) {
        const sv = parseFloat((row[sigCol] || '').replace(',', '.'));
        sigs.push(isFinite(sv) && sv > 0 ? sv : NaN);
      }
    }
  }
  const sigY = (sigCol != null && sigs.some(v => isFinite(v))) ? sigs : null;
  return { x: xs, y: ys, sigY };
}

function needsColumnPicker(rows) {
  const isNum = v => v.trim() !== '' && isFinite(parseFloat(v.replace(',', '.')));
  const dataRow = rows.find(r => r.some(v => isNum(v)));
  return dataRow && dataRow.length >= 3;
}

function openColumnPicker(name, rows) {
  const isNum = v => v.trim() !== '' && isFinite(parseFloat(v.replace(',', '.')));
  const hasHeader = rows.length > 0 && rows[0].some(v => !isNum(v));
  const headers = hasHeader
    ? rows[0].map((v, i) => v.trim() || `Col ${i + 1}`)
    : rows[0].map((_, i) => `Col ${i + 1}`);
  const startRow = hasHeader ? 1 : 0;
  _pendingImport = { name, rows, headers, startRow };
  const xSel  = document.getElementById('col-picker-x');
  const ySel  = document.getElementById('col-picker-y');
  const sigSel = document.getElementById('col-picker-sig');
  // Auto-select σ column when header looks like an uncertainty column
  const sigKeywords = /^(sig|sigma|err|error|uncertainty|sd|std|stdev|s\.?e\.?)$/i;
  const autoSigIdx = headers.findIndex(h => sigKeywords.test(h.trim()));
  // Use DOM methods to prevent XSS from malicious CSV header names
  [xSel, ySel, sigSel].forEach(sel => { while (sel.options.length) sel.remove(0); });
  const noneOpt = document.createElement('option');
  noneOpt.value = '';
  noneOpt.textContent = '— None (X, Y only) —';
  sigSel.appendChild(noneOpt);
  headers.forEach((h, i) => {
    [xSel, ySel, sigSel].forEach((sel, si) => {
      const opt = document.createElement('option');
      opt.value = String(i);
      opt.textContent = h;
      if (si === 0 && i === 0) opt.selected = true;
      if (si === 1 && i === 1) opt.selected = true;
      if (si === 2 && i === autoSigIdx && autoSigIdx >= 0) opt.selected = true;
      sel.appendChild(opt);
    });
  });
  updateColPickerPreview();
  document.getElementById('col-picker-modal').style.display = 'flex';
}

function updateColPickerPreview() {
  if (!_pendingImport) return;
  const { rows, headers, startRow } = _pendingImport;
  const xCol  = parseInt(document.getElementById('col-picker-x').value);
  const yCol  = parseInt(document.getElementById('col-picker-y').value);
  const sigVal = document.getElementById('col-picker-sig').value;
  const sigCol = sigVal !== '' ? parseInt(sigVal) : null;
  const previewRows = rows.slice(startRow, startRow + 5);
  const hdr = sigCol != null
    ? `${headers[xCol]}  →  ${headers[yCol]}  ±  ${headers[sigCol]}`
    : `${headers[xCol]}  →  ${headers[yCol]}`;
  const lines = [hdr];
  for (const r of previewRows) {
    const xv = r[xCol] != null ? r[xCol] : '—';
    const yv = r[yCol] != null ? r[yCol] : '—';
    if (sigCol != null) {
      const sv = r[sigCol] != null ? r[sigCol] : '—';
      lines.push(`  ${String(xv).padEnd(12)} ${String(yv).padEnd(12)} ${sv}`);
    } else {
      lines.push(`  ${String(xv).padEnd(14)} ${yv}`);
    }
  }
  const total = rows.length - startRow;
  if (total > 5) lines.push(`  … (${total} rows total)`);
  document.getElementById('col-picker-preview').textContent = lines.join('\n');
}

function importFromColumnPicker() {
  if (!_pendingImport) return;
  const { name, rows, headers, startRow } = _pendingImport;
  const xCol  = parseInt(document.getElementById('col-picker-x').value);
  const yCol  = parseInt(document.getElementById('col-picker-y').value);
  const sigVal = document.getElementById('col-picker-sig').value;
  const sigCol = sigVal !== '' ? parseInt(sigVal) : null;
  const { x, y, sigY } = rowsToXYCols(rows, headers, startRow, xCol, yCol, sigCol);
  if (!x.length) { setConsole('No valid X,Y pairs in selected columns.', 'error'); return; }
  const sigNote = sigY ? ` ± ${headers[sigCol]}` : '';
  const dsName = `${name} (${headers[xCol]} vs ${headers[yCol]}${sigNote})`;
  importDataset(dsName, x, y, sigY);
  syncFitDatasetSelect(); renderDatasetList(); updatePlots();
  setConsole(`Imported: ${dsName} (${x.length} points${sigY ? ', σ loaded' : ''}).`, '');
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
