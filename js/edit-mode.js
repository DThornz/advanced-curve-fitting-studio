// Point edit mode: drag-to-move, radius selection, undo/redo, keyboard nudge, canvas overlay

/* ═══════════════════════════════════════════════════════════
   POINT EDIT MODE
═══════════════════════════════════════════════════════════ */
function computeYDataDelta(pixelDY, mainEl) {
  const fl = mainEl._fullLayout;
  if (fl && fl.yaxis && fl.yaxis._length) {
    const ya = fl.yaxis;
    return -pixelDY * (ya.range[1] - ya.range[0]) / ya._length;
  }
  const layout = mainEl.layout;
  if (!layout || !layout.yaxis || !layout.yaxis.range) return 0;
  const m = layout.margin || { t: 28, b: 44 };
  const h = mainEl.offsetHeight - (m.t || 28) - (m.b || 44);
  if (h <= 0) return 0;
  const [y0, y1] = layout.yaxis.range;
  return -pixelDY * (y1 - y0) / h;
}

// Convert a data-space point to pixel coords within the plot div
function dataToPx(dataX, dataY, xa, ya) {
  if (!xa || !ya || !xa._length || !ya._length) return { px: -9999, py: -9999 };
  const xr = xa.range, yr = ya.range;
  let px, py;
  if (xa.type === 'log') {
    const lx = dataX > 0 ? Math.log10(dataX) : xr[0];
    px = xa._offset + (lx - xr[0]) / (xr[1] - xr[0]) * xa._length;
  } else {
    px = xa._offset + (dataX - xr[0]) / (xr[1] - xr[0]) * xa._length;
  }
  if (ya.type === 'log') {
    const ly = dataY > 0 ? Math.log10(dataY) : yr[0];
    py = ya._offset + (1 - (ly - yr[0]) / (yr[1] - yr[0])) * ya._length;
  } else {
    py = ya._offset + (1 - (dataY - yr[0]) / (yr[1] - yr[0])) * ya._length;
  }
  return { px, py };
}

// Find the nearest-dataset and all its points within radiusPx pixels of (clickPx, clickPy)
function findPointsInRadius(clickPx, clickPy, radiusPx) {
  const mainEl = document.getElementById('main-plot');
  const fl = mainEl._fullLayout;
  if (!fl) return null;
  const xa = fl.xaxis, ya = fl.yaxis;
  if (!xa || !ya) return null;
  const r2 = radiusPx * radiusPx;
  let bestDs = null, bestDist2 = Infinity;
  for (const ds of state.datasets) {
    if (ds.visible === false) continue;
    for (let i = 0; i < ds.x.length; i++) {
      const { px, py } = dataToPx(ds.x[i], ds.y[i], xa, ya);
      const d2 = (px - clickPx) ** 2 + (py - clickPy) ** 2;
      if (d2 < bestDist2) { bestDist2 = d2; bestDs = ds; }
    }
  }
  if (!bestDs || bestDist2 > r2) return null;
  const indices = new Set();
  for (let i = 0; i < bestDs.x.length; i++) {
    const { px, py } = dataToPx(bestDs.x[i], bestDs.y[i], xa, ya);
    const d2 = (px - clickPx) ** 2 + (py - clickPy) ** 2;
    if (d2 <= r2) indices.add(i);
  }
  return { ds: bestDs, indices };
}

function nudgeSelection(delta) {
  const ds = state.datasets.find(d => d.id === state.selection.dsId);
  if (!ds) return;
  const logY = state.plotConfig.logY;
  state.selection.indices.forEach(i => {
    if (i < 0 || i >= ds.y.length) return;
    if (logY) {
      ds.y[i] = ds.y[i] > 0 ? Math.pow(10, Math.log10(ds.y[i]) + delta) : ds.y[i];
    } else {
      ds.y[i] += delta;
    }
  });
  updatePlots();
}

function resetSelectionToOriginal() {
  const ds = state.datasets.find(d => d.id === state.selection.dsId);
  if (!ds || !ds.originalY) return;
  pushEditHistory();
  state.selection.indices.forEach(i => {
    if (i >= 0 && i < ds.originalY.length) ds.y[i] = ds.originalY[i];
  });
  updatePlots();
}

/* ── Edit history (undo/redo) ────────────────────────── */
function pushEditHistory() {
  const ds = state.datasets.find(d => d.id === state.selection.dsId);
  if (!ds) return;
  const h = state.editHistory;
  h.undo.push({ dsId: ds.id, y: ds.y.slice(), excl: new Set(ds.excludedIndices) });
  if (h.undo.length > 100) h.undo.shift();
  h.redo = [];
  syncUndoRedoButtons();
}

function undoEdit() {
  const h = state.editHistory;
  if (!h.undo.length) return;
  const entry = h.undo.pop();
  const ds = state.datasets.find(d => d.id === entry.dsId);
  if (ds) {
    h.redo.push({ dsId: ds.id, y: ds.y.slice(), excl: new Set(ds.excludedIndices) });
    if (h.redo.length > 100) h.redo.shift();
    ds.y = entry.y;
    if (entry.excl !== undefined) ds.excludedIndices = new Set(entry.excl);
    updatePlots();
  }
  syncUndoRedoButtons();
}

function redoEdit() {
  const h = state.editHistory;
  if (!h.redo.length) return;
  const entry = h.redo.pop();
  const ds = state.datasets.find(d => d.id === entry.dsId);
  if (ds) {
    h.undo.push({ dsId: ds.id, y: ds.y.slice(), excl: new Set(ds.excludedIndices) });
    if (h.undo.length > 100) h.undo.shift();
    ds.y = entry.y;
    if (entry.excl !== undefined) ds.excludedIndices = new Set(entry.excl);
    updatePlots();
  }
  syncUndoRedoButtons();
}

function syncUndoRedoButtons() {
  const bu = document.getElementById('btn-edit-undo');
  const br = document.getElementById('btn-edit-redo');
  const bx = document.getElementById('btn-edit-reset');
  if (bu) bu.disabled = !state.editHistory.undo.length;
  if (br) br.disabled = !state.editHistory.redo.length;
  if (bx) bx.disabled = !state.selection.indices.size;
  const ppu = document.getElementById('pp-undo');
  if (ppu) ppu.disabled = !state.editHistory.undo.length;
}

/* ── Radius canvas overlay ───────────────────────────── */
function syncRadiusCanvas() {
  const canvas = document.getElementById('edit-radius-canvas');
  const mainEl = document.getElementById('main-plot');
  if (!canvas || !mainEl) return;
  const w = mainEl.offsetWidth, h = mainEl.offsetHeight;
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;
}

function drawRadiusOverlay(mx, my) {
  const canvas = document.getElementById('edit-radius-canvas');
  if (!canvas) return;
  syncRadiusCanvas();
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const r = state.editSelectRadius;
  if (r <= 0 || mx == null) return;
  ctx.beginPath();
  ctx.arc(mx, my, r, 0, 2 * Math.PI);
  ctx.strokeStyle = 'rgba(245,158,11,0.8)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([5, 3]);
  ctx.stroke();
}

function clearRadiusOverlay() {
  const canvas = document.getElementById('edit-radius-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

let _editModeInitialized = false;
function initEditMode() {
  if (_editModeInitialized) return;
  _editModeInitialized = true;
  const mainEl = document.getElementById('main-plot');
  let nearPoint = null;       // { ds, clickIdx } captured on mousedown near a point
  let dragStartClientY = 0;
  let isDragging = false;
  let histPushed = false;
  let lastMouseX = null, lastMouseY = null;
  let arrowKeyActive = false;

  // Always show the canvas so the radius circle can render
  const canvas = document.getElementById('edit-radius-canvas');
  if (canvas) { canvas.style.display = 'block'; canvas.style.pointerEvents = 'none'; syncRadiusCanvas(); }

  // Radius circle preview follows mouse
  mainEl.addEventListener('mousemove', e => {
    const rect = mainEl.getBoundingClientRect();
    lastMouseX = e.clientX - rect.left;
    lastMouseY = e.clientY - rect.top;
    if (state.editSelectRadius > 0) drawRadiusOverlay(lastMouseX, lastMouseY);
  });
  mainEl.addEventListener('mouseleave', () => clearRadiusOverlay());

  // Shift+scroll: adjust capture radius.  Plain scroll → Plotly zoom (scrollZoom:true).
  mainEl.addEventListener('wheel', e => {
    if (!e.shiftKey) return;
    e.preventDefault();
    const delta = e.deltaY < 0 ? 5 : -5;
    state.editSelectRadius = Math.max(0, Math.min(300, state.editSelectRadius + delta));
    document.getElementById('edit-radius-display').textContent = state.editSelectRadius + ' px';
    syncRadiusCanvas();
    drawRadiusOverlay(lastMouseX, lastMouseY);
  }, { passive: false });

  // Capture-phase mousedown — intercepts near-point clicks before Plotly starts a pan
  mainEl.addEventListener('mousedown', function(e) {
    if (e.button !== 0) return;
    const rect = mainEl.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const hitR = state.editSelectRadius > 0 ? state.editSelectRadius : 10;
    const result = findPointsInRadius(mx, my, hitR);

    if (!result || !result.indices.size) {
      nearPoint = null;
      return; // not near any point — fall through to Plotly (pan)
    }

    e.stopPropagation(); // prevent Plotly from seeing this mousedown

    const { ds, indices } = result;

    if (state.editSelectRadius > 0) {
      // Radius mode: commit selection immediately so drag moves all captured points
      if (e.shiftKey && state.selection.dsId === ds.id) {
        indices.forEach(i => state.selection.indices.has(i) ? state.selection.indices.delete(i) : state.selection.indices.add(i));
      } else {
        state.selection = { dsId: ds.id, indices: new Set(indices) };
      }
      nearPoint = { ds, clickIdx: -1 };
    } else {
      // Exact mode: find nearest point; defer selection to mouseup to avoid flicker on drag
      const fl = mainEl._fullLayout;
      const xa = fl && fl.xaxis, ya = fl && fl.yaxis;
      let clickIdx = -1, bestD2 = Infinity;
      indices.forEach(i => {
        const { px, py } = dataToPx(ds.x[i], ds.y[i], xa, ya);
        const d2 = (mx - px) ** 2 + (my - py) ** 2;
        if (d2 < bestD2) { bestD2 = d2; clickIdx = i; }
      });
      nearPoint = { ds, clickIdx };
    }

    dragStartClientY = e.clientY;
    isDragging = false;
    histPushed = false;

    updatePlots();
    syncUndoRedoButtons();
  }, { capture: true });

  // Drag: move selected point(s) vertically
  document.addEventListener('mousemove', e => {
    if (!nearPoint || e.buttons !== 1) return;
    if (!isDragging && Math.abs(e.clientY - dragStartClientY) > 3) {
      isDragging = true;
      // Exact mode: commit selection now that we know it's a drag
      if (state.editSelectRadius <= 0 && nearPoint.clickIdx >= 0) {
        const idx = nearPoint.clickIdx;
        if (!(state.selection.dsId === nearPoint.ds.id && state.selection.indices.has(idx))) {
          state.selection = { dsId: nearPoint.ds.id, indices: new Set([idx]) };
          updatePlots();
        }
      }
    }
    if (!isDragging || !state.selection.indices.size) return;
    if (!histPushed) { pushEditHistory(); histPushed = true; }
    nudgeSelection(computeYDataDelta(e.movementY, mainEl));
  });

  // Mouseup: commit click-selection, or end drag
  document.addEventListener('mouseup', e => {
    if (!nearPoint) return;
    if (!isDragging) {
      const { ds, clickIdx: idx } = nearPoint;
      if (idx >= 0) {
        if (e.shiftKey && state.selection.dsId === ds.id) {
          state.selection.indices.has(idx) ? state.selection.indices.delete(idx) : state.selection.indices.add(idx);
        } else if (state.selection.dsId === ds.id && state.selection.indices.has(idx)) {
          state.selection.indices.delete(idx);
        } else {
          state.selection = { dsId: ds.id, indices: new Set([idx]) };
        }
        updatePlots();
      }
    }
    nearPoint = null;
    isDragging = false;
    histPushed = false;
    syncUndoRedoButtons();
  });

  // Click on empty space → clear selection
  mainEl.addEventListener('click', e => {
    const rect = mainEl.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const result = findPointsInRadius(mx, my, Math.max(state.editSelectRadius, 10));
    if (result && result.indices.size) return; // near a point, already handled by mouseup
    if (!state.selection.indices.size) return;
    state.selection = { dsId: null, indices: new Set() };
    updatePlots();
    syncUndoRedoButtons();
  });

  // Escape: clear selection
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (state.selection.indices.size) { state.selection = { dsId: null, indices: new Set() }; updatePlots(); syncUndoRedoButtons(); }
      return;
    }
    if (e.ctrlKey && e.key === 'z') { e.preventDefault(); undoEdit(); return; }
    if (e.ctrlKey && (e.key === 'y' || e.key === 'Z')) { e.preventDefault(); redoEdit(); return; }
    if (!state.selection.indices.size) return;
    const tag = document.activeElement && document.activeElement.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

    if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && state.selection.indices.size === 1) {
      e.preventDefault();
      const ds = state.datasets.find(d => d.id === state.selection.dsId);
      if (!ds) return;
      const cur = [...state.selection.indices][0];
      const next = e.key === 'ArrowRight' ? Math.min(cur + 1, ds.x.length - 1) : Math.max(cur - 1, 0);
      if (next !== cur) { state.selection = { dsId: ds.id, indices: new Set([next]) }; updatePlots(); syncUndoRedoButtons(); }
      return;
    }

    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    e.preventDefault();
    if (!arrowKeyActive) { pushEditHistory(); arrowKeyActive = true; }
    const step = parseFloat(document.getElementById('edit-nudge-step').value) || 0.1;
    nudgeSelection(e.key === 'ArrowUp' ? step : -step);
  });
  document.addEventListener('keyup', e => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') arrowKeyActive = false;
  });
}
