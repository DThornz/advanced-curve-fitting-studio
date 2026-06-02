// Application state: DS_COLORS, counters, DEFAULT_GRAPH_STYLE, state object
/* ═══════════════════════════════════════════════════════════
   APPLICATION STATE
═══════════════════════════════════════════════════════════ */
const DS_COLORS = ['#0b7a6e','#2563eb','#dc2626','#7c3aed','#f59e0b','#15803d','#c2410c','#db2777','#0891b2'];
let colorIdx = 0;
let idCounter = 0;
let _annIdCounter = 0;
function nextId() { return ++idCounter; }
function nextAnnId() { return ++_annIdCounter; }
function nextColor() { return DS_COLORS[colorIdx++ % DS_COLORS.length]; }

const DEFAULT_GRAPH_STYLE = {
  fontFamily: '',       // '' = theme default (DM Mono)
  fontSize: '',         // '' = theme default (11)
  fontColor: '',        // '' = theme text color
  plotBgColor: '',      // '' = theme plot bg
  paperBgColor: '',     // '' = theme paper bg
  showGridX: true, gridXColor: '', gridXWidth: 1, gridXDash: 'solid',
  showGridY: true, gridYColor: '', gridYWidth: 1, gridYDash: 'solid',
  showZeroLineX: true, zeroLineXColor: '', zeroLineXWidth: 1,
  showZeroLineY: true, zeroLineYColor: '', zeroLineYWidth: 1,
  tickFontSize: '',     // '' = theme default (10)
  showTicksX: true, showTicksY: true,
  showAxisLineX: false, showAxisLineY: false, axisLineColor: '',
  legendFontSize: '', legendBgColor: '', legendBorderColor: '',
  xMin: '', xMax: '', yMin: '', yMax: '', xDtick: '', yDtick: '',
};

const state = {
  datasets: [],    // {id, name, x, y, sigY?, color, visible}
  fits: [],        // {id, dsId, model, params, result, color, visible, label}
  annotations: [], // [{id, type, visible, x, y, label, font*, line*, arrow*}]
  graphStyle: Object.assign({}, DEFAULT_GRAPH_STYLE),
  activeDatasetId: null,
  activeFitId: null,
  fitConfig: { model: 'Exponential', customExpr: 'a * exp(-b * x) + c', customParams: [], xExtraMin: null, xExtraMax: null },
  plotConfig: { showResiduals: true, logX: false, logY: false, showCI: false, showPI: false, normalizeResiduals: false, showOutliers: false, showLegend: true, residualTab: 'residuals', logSuggestDismissed: { x: false, y: false }, axisRangeMode: 'auto' },
  paramRows: [],   // [{name, init, min, max}]  — live init guess state
  sweepParams: null,  // non-null while sweep slider is active
  selection: { dsId: null, indices: new Set() },
  editHistory: { undo: [], redo: [] },
  editSelectRadius: 0,
  currentWorker: null,
};
