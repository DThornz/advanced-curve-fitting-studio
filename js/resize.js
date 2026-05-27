// Resizable panels: left, right, residual, stats panel drag handles

/* ═══════════════════════════════════════════════════════════
   RESIZABLE PANELS
═══════════════════════════════════════════════════════════ */
function initResizablePanels() {
  const leftPanel  = document.getElementById('panel-left');
  const rightPanel = document.getElementById('panel-right');
  const residualEl = document.getElementById('residual-plot');
  const statsBar   = document.querySelector('.app-statsbar');
  const rhLeft     = document.getElementById('rh-left');
  const rhRight    = document.getElementById('rh-right');
  const rhResidual = document.getElementById('rh-residual');
  const rhStats    = document.getElementById('rh-stats');
  const rhCorr     = document.getElementById('rh-corr');
  const corrPanel  = document.getElementById('statsbar-corr');

  let drag = null;

  let resizeRafId = null;
  function schedulePlotResize() {
    if (!plotsInitialised) return;
    if (resizeRafId !== null) cancelAnimationFrame(resizeRafId);
    resizeRafId = requestAnimationFrame(() => {
      resizeRafId = null;
      // Reading offsetWidth forces a synchronous layout flush so Plotly measures
      // the post-resize container dimensions rather than stale pre-reflow values.
      void document.getElementById('panel-center').offsetWidth;
      Plotly.Plots.resize(document.getElementById('main-plot'));
      if (!residualEl.classList.contains('hidden')) Plotly.Plots.resize(document.getElementById('residual-plot'));
    });
  }

  function getClient(e) {
    return e.touches ? { x: e.touches[0].clientX, y: e.touches[0].clientY }
                     : { x: e.clientX,             y: e.clientY };
  }

  function onMove(e) {
    if (!drag) return;
    const { x, y } = getClient(e);
    if (drag.type === 'left') {
      leftPanel.style.width = Math.max(120, Math.min(400, drag.size + (x - drag.x))) + 'px';
    } else if (drag.type === 'right') {
      rightPanel.style.width = Math.max(180, Math.min(520, drag.size - (x - drag.x))) + 'px';
    } else if (drag.type === 'residual') {
      residualEl.style.height = Math.max(60, Math.min(360, drag.size - (y - drag.y))) + 'px';
    } else if (drag.type === 'stats') {
      statsBar.style.height = Math.max(28, Math.min(480, drag.size - (y - drag.y))) + 'px';
    } else if (drag.type === 'corr') {
      corrPanel.style.flexBasis = Math.max(150, Math.min(560, drag.size - (x - drag.x))) + 'px';
    }
    schedulePlotResize();
    if (e.cancelable) e.preventDefault();
  }

  function onUp() {
    if (!drag) return;
    document.querySelectorAll('.panel-resize.dragging').forEach(h => h.classList.remove('dragging'));
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    drag = null;
    schedulePlotResize();
  }

  function startDrag(type, handle, e) {
    const { x, y } = getClient(e);
    const size = type === 'left'     ? leftPanel.offsetWidth
               : type === 'right'    ? rightPanel.offsetWidth
               : type === 'stats'    ? statsBar.offsetHeight
               : type === 'corr'     ? corrPanel.offsetWidth
               :                       residualEl.offsetHeight;
    drag = { type, x, y, size };
    handle.classList.add('dragging');
    document.body.style.userSelect = 'none';
    document.body.style.cursor = (type === 'residual' || type === 'stats') ? 'ns-resize' : 'col-resize';
    e.preventDefault();
  }

  rhLeft.addEventListener('mousedown',     e => startDrag('left',     rhLeft,     e));
  rhRight.addEventListener('mousedown',    e => startDrag('right',    rhRight,    e));
  rhResidual.addEventListener('mousedown', e => startDrag('residual', rhResidual, e));
  rhStats.addEventListener('mousedown',    e => startDrag('stats',    rhStats,    e));
  rhCorr.addEventListener('mousedown',     e => startDrag('corr',     rhCorr,     e));
  rhLeft.addEventListener('touchstart',     e => startDrag('left',     rhLeft,     e), { passive: false });
  rhRight.addEventListener('touchstart',    e => startDrag('right',    rhRight,    e), { passive: false });
  rhResidual.addEventListener('touchstart', e => startDrag('residual', rhResidual, e), { passive: false });
  rhStats.addEventListener('touchstart',    e => startDrag('stats',    rhStats,    e), { passive: false });
  rhCorr.addEventListener('touchstart',     e => startDrag('corr',     rhCorr,     e), { passive: false });

  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup',   onUp);
  document.addEventListener('touchmove', onMove, { passive: false });
  document.addEventListener('touchend',  onUp);
}
