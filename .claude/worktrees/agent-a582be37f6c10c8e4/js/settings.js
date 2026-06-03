// Application settings: SETT_KEY, SETT_DEFAULTS, CFS_SETTINGS, loadSettings, saveSettings, applySettings
/* ═══════════════════════════════════════════════════════════
   SETTINGS
═══════════════════════════════════════════════════════════ */
const SETT_KEY = 'cfs_ui_settings';
const SETT_DEFAULTS = {
  uiFontSize: 15, uiFontFamily: "'DM Sans',system-ui,sans-serif",
  monoFont: "'DM Mono',monospace", animSpeed: 'normal',
  defaultAlgo: 'lm', defaultPilots: 8, defaultWeights: 'none',
  displayDecimals: 5, fitLineWidth: 2, markerSize: 6,
  defaultCI: false, defaultLegend: true,
};
let CFS_SETTINGS = { ...SETT_DEFAULTS };

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETT_KEY);
    if (raw) CFS_SETTINGS = { ...SETT_DEFAULTS, ...JSON.parse(raw) };
  } catch {}
}

function saveSettings() {
  localStorage.setItem(SETT_KEY, JSON.stringify(CFS_SETTINGS));
}

function applySettings(s) {
  s = s || CFS_SETTINGS;
  document.documentElement.style.fontSize = s.uiFontSize + 'px';
  document.documentElement.style.setProperty('--sans', s.uiFontFamily);
  document.documentElement.style.setProperty('--mono', s.monoFont);
  // Animation speed
  const dur = s.animSpeed === 'none' ? '0s' : s.animSpeed === 'fast' ? '0.08s' : '0.18s';
  document.documentElement.style.setProperty('--anim-dur', dur);
  if (s.animSpeed === 'none') {
    document.documentElement.style.setProperty('--transition-override', '0s');
  } else {
    document.documentElement.style.removeProperty('--transition-override');
  }
}

// Apply persisted settings at startup
loadSettings();
applySettings();
