// Export functions: PNG, SVG, CSV, report text, Python, R, LaTeX, MATLAB, Jupyter, Excel, HTML, JSON, BibTeX

/* ── Shared Python model body helper (used by Python & Jupyter exports) ── */
// Convert display parameter names (which may contain Greek letters, subscripts,
// the ∞ sign, combining marks, etc.) into valid ASCII identifiers usable as
// variable names in generated Python / R code. Deterministic so the function
// signature and body produced in different places stay consistent.
const _GREEK_MAP = {
  'α':'alpha','β':'beta','γ':'gamma','δ':'delta','ε':'epsilon','ζ':'zeta',
  'η':'eta','θ':'theta','ι':'iota','κ':'kappa','λ':'lambda','μ':'mu','ν':'nu',
  'ξ':'xi','ο':'omicron','π':'pi','ρ':'rho','σ':'sigma','ς':'sigma','τ':'tau',
  'υ':'upsilon','φ':'phi','χ':'chi','ψ':'psi','ω':'omega',
  'Α':'Alpha','Β':'Beta','Γ':'Gamma','Δ':'Delta','Θ':'Theta','Λ':'Lambda',
  'Π':'Pi','Σ':'Sigma','Φ':'Phi','Ψ':'Psi','Ω':'Omega'
};
const _SUB_MAP = { '₀':'0','₁':'1','₂':'2','₃':'3','₄':'4','₅':'5','₆':'6','₇':'7','₈':'8','₉':'9' };
// Reserved words in Python and/or R — appending '_' keeps generated code valid
// (e.g. λ → "lambda" is a Python keyword).
const _RESERVED_IDENTS = new Set([
  'lambda','def','class','return','import','from','as','with','try','except',
  'finally','global','nonlocal','pass','break','continue','del','raise','yield',
  'assert','async','await','and','or','not','is','in','if','elif','else','for',
  'while','None','True','False',
  'function','repeat','next','TRUE','FALSE','NULL','Inf','NaN','NA'
]);
function _safeIdents(names) {
  const seen = {};
  return names.map((nm, idx) => {
    let s = '';
    for (const ch of String(nm)) {
      if (_GREEK_MAP[ch]) s += _GREEK_MAP[ch];
      else if (_SUB_MAP[ch]) s += _SUB_MAP[ch];
      else if (ch === '∞') s += 'inf';
      else if (ch === '·' || ch === '̇' || ch === '̂') continue; // drop dots/combining marks
      else if (/[A-Za-z0-9_]/.test(ch)) s += ch;
      // anything else is dropped
    }
    if (!s) s = 'p' + idx;
    if (/^[0-9]/.test(s)) s = 'p' + s;
    if (_RESERVED_IDENTS.has(s)) s = s + '_';
    if (seen[s] != null) { seen[s] += 1; s = s + '_' + seen[s]; } else { seen[s] = 0; }
    return s;
  });
}

function _pyModelBody(fit) {
  const n = _safeIdents(fit.paramNames);
  // Polynomials are degree-driven and not in the table below — build the body.
  const polyMatch = /^Polynomial-(\d+)$/.exec(fit.model);
  if (polyMatch) {
    const deg = n.length - 1;
    const terms = n.map((c, i) => {
      const pw = deg - i;
      return pw === 0 ? `${c}` : pw === 1 ? `${c} * x` : `${c} * x**${pw}`;
    });
    return `return ${terms.join(' + ')}`;
  }
  const defs = {
    'Linear':            `return ${n[0]} * x + ${n[1]}`,
    'Power':             `return ${n[0]} * np.abs(x)**${n[1]}`,
    'Exponential':       `return ${n[0]} * np.exp(${n[1]} * x)`,
    'Exp-Decay-Offset':  `return ${n[0]} * np.exp(-${n[1]} * x) + ${n[2]}`,
    'Logistic':          `return ${n[0]} / (1 + np.exp(-${n[1]} * (x - ${n[2]})))`,
    'Gaussian':          `return ${n[0]} * np.exp(-0.5 * ((x - ${n[1]}) / ${n[2]})**2) + ${n[3]}`,
    'Lorentzian':        `return ${n[0]} * ${n[2]}**2 / ((x - ${n[1]})**2 + ${n[2]}**2) + ${n[3]}`,
    'Michaelis-Menten':  `return ${n[0]} * x / (${n[1]} + x)`,
    'Hill':              `return ${n[0]} * x**${n[2]} / (${n[1]}**${n[2]} + x**${n[2]})`,
    'Sine':              `return ${n[0]} * np.sin(${n[1]} * x + ${n[2]}) + ${n[3]}`,
    'Damped-Sine':       `return ${n[0]} * np.exp(-${n[1]} * x) * np.sin(${n[2]} * x + ${n[3]}) + ${n[4]}`,
    'Weibull':           `return 1 - np.exp(-(np.maximum(x, 1e-12) / ${n[0]})**${n[1]})`,
    'Double-Gaussian':   `return (${n[0]} * np.exp(-0.5 * ((x - ${n[1]}) / ${n[2]})**2) +\n           ${n[3]} * np.exp(-0.5 * ((x - ${n[4]}) / ${n[5]})**2) + ${n[6]})`,
    'Biexponential':     `return ${n[0]} * np.exp(-np.abs(${n[1]}) * x) + ${n[2]} * np.exp(-np.abs(${n[3]}) * x) + ${n[4]}`,
    'Rational':          `return (${n[0]} + ${n[1]} * x) / np.maximum(1 + ${n[2]} * x, 1e-10)`,
    'Power-Offset':      `return ${n[0]} * np.abs(x)**${n[1]} + ${n[2]}`,
    'Boltzmann':         `return ${n[0]} / (1 + np.exp(-(x - ${n[1]}) / np.maximum(np.abs(${n[2]}), 1e-10)))`,
    'Double-Boltzmann':  `return (${n[0]}/(1+np.exp(-(x-${n[1]})/np.maximum(np.abs(${n[2]}),1e-10))) +\n           ${n[3]}/(1+np.exp(-(x-${n[4]})/np.maximum(np.abs(${n[5]}),1e-10))))`,
    'HH-Activation':     `return ${n[0]} * np.power(np.maximum(1/(1+np.exp(-(x-${n[1]})/np.maximum(${n[2]},1e-10))),1e-12),${n[3]}) * (x-${n[4]})`,
    'HH-Na-IV':          `return ${n[0]} * (1/(1+np.exp(-(x-${n[1]})/np.maximum(${n[2]},1e-10))))**3 * (1/(1+np.exp((x-${n[3]})/np.maximum(${n[4]},1e-10)))) * (x-${n[5]})`,
    'Kir':               `return ${n[0]} * (x-${n[1]}) / (1+np.exp((x-${n[2]})/np.maximum(np.abs(${n[3]}),1e-10)))`,
    'GHK':               `return np.where(np.abs(x)<1e-6, ${n[0]}*${n[2]}*(1-${n[1]}), ${n[0]}*x*(1-${n[1]}*np.exp(-x/np.maximum(${n[2]},1e-10)))/np.maximum(1-np.exp(-x/np.maximum(${n[2]},1e-10)),1e-10))`,
    'Tau-Gaussian':      `return ${n[0]} * np.exp(-0.5*((x-${n[1]})/np.maximum(${n[2]},1e-10))**2) + ${n[3]}`,
    '4PL':               `return ${n[1]} + (${n[0]} - ${n[1]}) / (1 + (np.maximum(x, 0) / np.maximum(np.abs(${n[2]}), 1e-12))**${n[3]})`,
    'Gompertz':          `return ${n[0]} * np.exp(-np.exp(-${n[1]} * (x - ${n[2]})))`,
    'Pseudo-Voigt':      `eta_c = np.clip(${n[4]}, 0, 1)\n    L = ${n[2]}**2 / ((x-${n[1]})**2 + ${n[2]}**2)\n    G = np.exp(-0.5*((x-${n[1]})/np.maximum(${n[3]},1e-10))**2)\n    return ${n[0]} * (eta_c*L + (1-eta_c)*G) + ${n[5]}`,
    'Fano':              `eps = (x - ${n[1]}) / np.maximum(${n[2]}, 1e-10)\n    return ${n[0]} * (${n[3]} + eps)**2 / (1 + eps**2) + ${n[4]}`,
    'Oral-PK':           `return np.where(np.abs(${n[1]}-${n[2]})<1e-9*max(abs(${n[1]})+abs(${n[2]}),1), ${n[0]}*${n[1]}*x*np.exp(-${n[1]}*x), ${n[0]}*${n[1]}/(${n[1]}-${n[2]})*(np.exp(-${n[2]}*x)-np.exp(-${n[1]}*x)))`,
    'KWW':               `return ${n[0]} * np.exp(-(np.maximum(x,0)/np.maximum(${n[1]},1e-12))**np.maximum(${n[2]},1e-6)) + ${n[3]}`,
    'Langevin':          `u = ${n[1]} * x\n    return np.where(np.abs(u)<1e-6, ${n[0]}*u/3, ${n[0]}*(1/np.tanh(u) - 1/u))`,
    'Stern-Volmer':      `return ${n[0]} / (np.maximum(1+${n[1]}*x,1e-10) * np.maximum(1+${n[2]}*x,1e-10))`,
    'Van-t-Hoff':        `return np.exp(${n[1]} - ${n[0]} / np.maximum(x, 1e-6))`,
    'Ramberg-Osgood':    `return x/np.maximum(${n[0]},1e-12) + np.sign(x)*(np.abs(x)/np.maximum(${n[1]},1e-12))**(1.0/np.maximum(${n[2]},1e-6))`,
    // v1.6.0 models
    'Two-Compartment-PK':`return ${n[0]} * np.exp(-np.abs(${n[1]}) * x) + ${n[2]} * np.exp(-np.abs(${n[3]}) * x)`,
    'PK-Lag':            `t_eff = np.maximum(x - ${n[3]}, 0)\n    ka, ke = ${n[1]}, ${n[2]}\n    return np.where(x <= ${n[3]}, 0, np.where(np.abs(ka-ke)<1e-9, ${n[0]}*ka*t_eff*np.exp(-ka*t_eff), ${n[0]}*ka/(ka-ke)*(np.exp(-ke*t_eff)-np.exp(-ka*t_eff))))`,
    'Substrate-Inhibition':`return ${n[0]} * x / (${n[1]} + x + x**2 / np.maximum(np.abs(${n[2]}), 1e-10))`,
    'Langmuir':          `return ${n[0]} * ${n[1]} * x / (1 + ${n[1]} * x)`,
    'Freundlich':        `return ${n[0]} * np.maximum(x, 1e-12)**(1.0 / np.maximum(np.abs(${n[1]}), 1e-6))`,
    'Temkin':            `return ${n[1]} * np.log(np.maximum(np.abs(${n[0]}) * np.maximum(x, 1e-300), 1e-300))`,
    'Power-Law-Fluid':   `return ${n[0]} * np.abs(x)**(${n[1]} - 1)`,
    'Herschel-Bulkley':  `return ${n[0]} + ${n[1]} * np.abs(x)**${n[2]}`,
    'Cross-Model':       `return ${n[1]} + (${n[0]} - ${n[1]}) / (1 + np.abs(${n[2]} * x)**np.abs(${n[3]}))`,
    'EMG':               `from scipy.special import erfc as _erfc\n    sg = max(abs(${n[2]}), 1e-10); tk = max(abs(${n[3]}), 1e-10)\n    u = sg/tk; z = (x - ${n[1]})/sg\n    ea = (u - z)/np.sqrt(2)\n    return np.where(ea > 25, ${n[4]}, 0.5*${n[0]}*np.exp(0.5*u**2 - z*u)*_erfc(ea) + ${n[4]})`,
    'Asymmetric-Gaussian':`from scipy.special import erf as _erf\n    z = (x - ${n[1]})/max(abs(${n[2]}), 1e-10)\n    return ${n[0]}*np.exp(-0.5*z**2)*(1 + _erf(${n[3]}*z/np.sqrt(2))) + ${n[4]}`,
    'Voigt':             `fG=max(abs(${n[2]}),1e-10); fL=max(abs(${n[3]}),1e-10)\n    fV5=fG**5+2.69269*fG**4*fL+2.42843*fG**3*fL**2+4.47163*fG**2*fL**3+0.07842*fG*fL**4+fL**5\n    fV=fV5**0.2; f=fL/fV\n    eta=np.clip(1.36603*f-0.47719*f**2+0.11116*f**3, 0, 1); hw=fV/2\n    L=hw**2/((x-${n[1]})**2+hw**2); G=np.exp(-4*np.log(2)*(x-${n[1]})**2/fV**2)\n    return ${n[0]}*(eta*L+(1-eta)*G)+${n[4]}`,
    'Arrhenius':         `return ${n[0]} * np.exp(-${n[1]} / np.maximum(x, 1e-6))`,
    'Extended-Arrhenius':`return ${n[0]} * np.maximum(x, 1e-12)**${n[1]} * np.exp(-${n[2]} / np.maximum(x, 1e-6))`,
    'Erf-Diffusion':     `from scipy.special import erf as _erf\n    return ${n[0]} * _erf((x - ${n[1]}) / max(abs(${n[2]}), 1e-10)) + ${n[3]}`,
    'Softplus':          `t = ${n[1]} * (x - ${n[2]})\n    return ${n[0]} * np.where(t > 20, t, np.log1p(np.exp(np.minimum(t, 20)))) + ${n[3]}`,
    'Erf-Sigmoid':       `from scipy.special import erf as _erf\n    return ${n[0]} * 0.5 * (1 + _erf(${n[1]} * (x - ${n[2]}))) + ${n[3]}`,
  };
  return defs[fit.model] || `# Custom/unknown model: ${fit.model}\n    raise NotImplementedError("Define your model here")`;
}

/* ═══════════════════════════════════════════════════════════
   EXPORT
═══════════════════════════════════════════════════════════ */
function exportFilename() {
  const title = document.getElementById('plot-title').value.trim();
  return (title || 'curve-fit').replace(/[^\w\s\-]/g, '').trim().replace(/\s+/g, '-').toLowerCase() || 'curve-fit';
}
function exportPNG() {
  Plotly.downloadImage('main-plot', { format: 'png', width: 1920, height: 1200, filename: exportFilename() });
}
function exportSVG() {
  Plotly.downloadImage('main-plot', { format: 'svg', width: 1920, height: 1200, filename: exportFilename() });
}

function exportCSV() {
  const fit = state.fits.find(f => f.id === state.activeFitId);
  if (!fit || !fit.result) { setConsole('No active fit to export.', 'warn'); return; }
  const ds = state.datasets.find(d => d.id === fit.dsId);
  let csv = `Curve Fitting Studio — Fit Results\nModel: ${fit.model}\nDataset: ${ds ? ds.name : 'unknown'}\n\n`;
  csv += 'Parameter,Value,StdError\n';
  fit.paramNames.forEach((n, i) => {
    csv += `${n},${fit.result.params[i]},${isFinite(fit.result.paramErrors?.[i]) ? fit.result.paramErrors[i] : 'NaN'}\n`;
  });
  csv += `\nR2,${fit.result.rSq}\nAdjR2,${fit.result.adjRSq}\nRMSE,${fit.result.rmse}\nSSE,${fit.result.sse}\nAIC,${fit.result.aic}\nBIC,${fit.result.bic}\n`;
  if (ds) {
    const excl = ds.excludedIndices || new Set();
    csv += `\nX,Y,YFit,Residual,Masked\n`;
    ds.x.forEach((x, i) => {
      const masked = excl.has(i);
      const yFit = (!masked && fit.fn) ? fit.fn(x, fit.result.params) : NaN;
      const residual = isFinite(yFit) ? ds.y[i] - yFit : '';
      csv += `${x},${ds.y[i]},${isFinite(yFit) ? yFit : ''},${residual},${masked ? 1 : 0}\n`;
    });
  }
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = `${exportFilename()}-results.csv`; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

function exportReport() {
  const fit = state.fits.find(f => f.id === state.activeFitId);
  if (!fit || !fit.result) { setConsole('No active fit to export.', 'warn'); return; }
  const ds = state.datasets.find(d => d.id === fit.dsId);
  const r = fit.result;
  const rptXlabel = document.getElementById('plot-xlabel').value.trim();
  const rptYlabel = document.getElementById('plot-ylabel').value.trim();
  const rptTitle  = document.getElementById('plot-title').value.trim();
  let txt = `=======================================================\n`;
  txt += `  Curve Fitting Studio — Fit Report\n`;
  txt += `  Generated: ${new Date().toISOString()}\n`;
  txt += `=======================================================\n\n`;
  if (rptTitle)  txt += `Title    : ${rptTitle}\n`;
  txt += `Dataset  : ${ds ? ds.name : '—'}  (${r.n} points)\n`;
  if (rptXlabel) txt += `X label  : ${rptXlabel}\n`;
  if (rptYlabel) txt += `Y label  : ${rptYlabel}\n`;
  txt += `Model    : ${fit.model}\n\n`;
  txt += `─── Parameters ───────────────────────────────────────\n`;
  txt += `${'Name'.padEnd(12)}  ${'Value'.padEnd(16)}  ${'Std. Error'.padEnd(16)}\n`;
  txt += `${'-'.repeat(46)}\n`;
  fit.paramNames.forEach((n, i) => {
    const v  = fmt(r.params[i]);
    const se = isFinite(r.paramErrors?.[i]) ? fmt(r.paramErrors[i]) : '—';
    txt += `${n.padEnd(12)}  ${v.padEnd(16)}  ${se}\n`;
  });
  txt += `\n─── Goodness of Fit ──────────────────────────────────\n`;
  txt += `R²        : ${r.rSq.toFixed(8)}\n`;
  txt += `Adj. R²   : ${r.adjRSq.toFixed(8)}\n`;
  txt += `RMSE      : ${r.rmse.toExponential(4)}\n`;
  txt += `SSE       : ${r.sse.toExponential(4)}\n`;
  txt += `AIC       : ${r.aic.toFixed(4)}\n`;
  txt += `BIC       : ${r.bic.toFixed(4)}\n`;
  if (r.chiSqRed != null) txt += `χ²ᵣ       : ${r.chiSqRed.toExponential(4)}\n`;
  txt += `\n`;
  txt += `─── Algorithm ────────────────────────────────────────\n`;
  txt += `Status    : ${r.converged ? 'Converged' : 'Max iterations reached'}\n`;
  txt += `Iterations: ${r.iter}\n`;
  if (fit.notes && fit.notes.trim()) {
    txt += `\n─── Notes ────────────────────────────────────────────\n`;
    txt += fit.notes.trim() + '\n';
  }
  txt += `=======================================================\n`;
  const blob = new Blob([txt], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = `${exportFilename()}-report.txt`; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

function exportPython() {
  const fit = state.fits.find(f => f.id === state.activeFitId);
  if (!fit || !fit.result) { setConsole('No active fit to export.', 'warn'); return; }
  const ds = state.datasets.find(d => d.id === fit.dsId);
  const r = fit.result;
  const excl = ds ? (ds.excludedIndices || new Set()) : new Set();
  const xData = ds ? ds.x.filter((_, i) => !excl.has(i)) : [];
  const yData = ds ? ds.y.filter((_, i) => !excl.has(i)) : [];

  const paramStr = _safeIdents(fit.paramNames).join(', ');
  const p0Str = r.params.map(v => v.toPrecision(6)).join(', ');
  const xArr = '[' + xData.map(v => v.toPrecision(8)).join(', ') + ']';
  const yArr = '[' + yData.map(v => v.toPrecision(8)).join(', ') + ']';

  const fnBody = _pyModelBody(fit);

  const bounds = fit.bounds;
  const hasLo = bounds && bounds.lo && bounds.lo.some(v => v !== null);
  const hasHi = bounds && bounds.hi && bounds.hi.some(v => v !== null);
  const hasBounds = hasLo || hasHi;
  const loStr = bounds ? '[' + bounds.lo.map(v => v !== null ? v.toPrecision(6) : '-np.inf').join(', ') + ']' : '[-np.inf]';
  const hiStr = bounds ? '[' + bounds.hi.map(v => v !== null ? v.toPrecision(6) : 'np.inf').join(', ') + ']' : '[np.inf]';

  const lines = [
    `import numpy as np`,
    `from scipy.optimize import curve_fit`,
    `import matplotlib.pyplot as plt`,
    ``,
    `# Data`,
    `x_data = np.array(${xArr})`,
    `y_data = np.array(${yArr})`,
    ``,
    `# Model: ${fit.model}`,
    `def model(x, ${paramStr}):`,
    `    ${fnBody}`,
    ``,
    `# Initial parameters from fit`,
    `p0 = [${p0Str}]`,
    ...(hasBounds ? [
    `bounds = (${loStr}, ${hiStr})`,
    ] : []),
    ``,
    `# Fit`,
    hasBounds
      ? `popt, pcov = curve_fit(model, x_data, y_data, p0=p0, bounds=bounds, maxfev=10000)`
      : `popt, pcov = curve_fit(model, x_data, y_data, p0=p0, maxfev=10000)`,
    `perr = np.sqrt(np.diag(pcov))`,
    ``,
    `# Results`,
    `param_names = [${fit.paramNames.map(n => `'${n}'`).join(', ')}]`,
    `for name, val, err in zip(param_names, popt, perr):`,
    `    print(f"{name} = {val:.6g} ± {err:.6g}")`,
    ``,
    `# Plot`,
    `x_fit = np.linspace(x_data.min(), x_data.max(), 300)`,
    `y_fit = model(x_fit, *popt)`,
    `plt.scatter(x_data, y_data, label='Data')`,
    `plt.plot(x_fit, y_fit, label=f'${fit.model} fit')`,
    `plt.legend()`,
    `plt.tight_layout()`,
    `plt.show()`,
  ];

  const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
  const pyUrl = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = pyUrl;
  a.download = `${exportFilename()}-fit.py`; a.click();
  setTimeout(() => URL.revokeObjectURL(pyUrl), 60000);
  setConsole('Python script downloaded.', '');
}

function exportR() {
  const fit = state.fits.find(f => f.id === state.activeFitId);
  if (!fit || !fit.result) { setConsole('No active fit to export.', 'warn'); return; }
  const ds = state.datasets.find(d => d.id === fit.dsId);
  const r = fit.result;
  const excl = ds ? (ds.excludedIndices || new Set()) : new Set();
  const xData = ds ? ds.x.filter((_, i) => !excl.has(i)) : [];
  const yData = ds ? ds.y.filter((_, i) => !excl.has(i)) : [];

  const pn = _safeIdents(fit.paramNames);
  const startStr = pn.map((n, i) => `${n}=${r.params[i].toPrecision(6)}`).join(', ');
  const xArr = 'c(' + xData.map(v => v.toPrecision(15)).join(', ') + ')';
  const yArr = 'c(' + yData.map(v => v.toPrecision(15)).join(', ') + ')';

  const modelDefs = {
    'Linear':           `${pn[0]} * x + ${pn[1]}`,
    'Power':            `${pn[0]} * abs(x)^${pn[1]}`,
    'Exponential':      `${pn[0]} * exp(${pn[1]} * x)`,
    'Exp-Decay-Offset': `${pn[0]} * exp(-${pn[1]} * x) + ${pn[2]}`,
    'Logistic':         `${pn[0]} / (1 + exp(-${pn[1]} * (x - ${pn[2]})))`,
    'Gaussian':         `${pn[0]} * exp(-0.5 * ((x - ${pn[1]}) / ${pn[2]})^2) + ${pn[3]}`,
    'Lorentzian':       `${pn[0]} * ${pn[2]}^2 / ((x - ${pn[1]})^2 + ${pn[2]}^2) + ${pn[3]}`,
    'Michaelis-Menten': `${pn[0]} * x / (${pn[1]} + x)`,
    'Hill':             `${pn[0]} * x^${pn[2]} / (${pn[1]}^${pn[2]} + x^${pn[2]})`,
    'Sine':             `${pn[0]} * sin(${pn[1]} * x + ${pn[2]}) + ${pn[3]}`,
    'Damped-Sine':      `${pn[0]} * exp(-${pn[1]} * x) * sin(${pn[2]} * x + ${pn[3]}) + ${pn[4]}`,
    'Double-Gaussian':  `${pn[0]} * exp(-0.5*((x-${pn[1]})/${pn[2]})^2) + ${pn[3]} * exp(-0.5*((x-${pn[4]})/${pn[5]})^2) + ${pn[6]}`,
    'Biexponential':    `${pn[0]} * exp(-abs(${pn[1]}) * x) + ${pn[2]} * exp(-abs(${pn[3]}) * x) + ${pn[4]}`,
    'Rational':         `(${pn[0]} + ${pn[1]} * x) / (1 + ${pn[2]} * x)`,
    'Power-Offset':     `${pn[0]} * abs(x)^${pn[1]} + ${pn[2]}`,
    'Boltzmann':        `${pn[0]} / (1 + exp(-(x - ${pn[1]}) / pmax(abs(${pn[2]}), 1e-10)))`,
    'Double-Boltzmann': `${pn[0]}/(1+exp(-(x-${pn[1]})/pmax(abs(${pn[2]}),1e-10))) + ${pn[3]}/(1+exp(-(x-${pn[4]})/pmax(abs(${pn[5]}),1e-10)))`,
    'HH-Activation':    `${pn[0]} * pmax(1/(1+exp(-(x-${pn[1]})/pmax(${pn[2]},1e-10))),1e-12)^${pn[3]} * (x-${pn[4]})`,
    'HH-Na-IV':         `${pn[0]} * (1/(1+exp(-(x-${pn[1]})/pmax(${pn[2]},1e-10))))^3 * (1/(1+exp((x-${pn[3]})/pmax(${pn[4]},1e-10)))) * (x-${pn[5]})`,
    'Kir':              `${pn[0]} * (x-${pn[1]}) / (1+exp((x-${pn[2]})/pmax(abs(${pn[3]}),1e-10)))`,
    'GHK':              `ifelse(abs(x)<1e-6, ${pn[0]}*${pn[2]}*(1-${pn[1]}), ${pn[0]}*x*(1-${pn[1]}*exp(-x/pmax(${pn[2]},1e-10)))/pmax(1-exp(-x/pmax(${pn[2]},1e-10)),1e-10))`,
    'Tau-Gaussian':     `${pn[0]} * exp(-0.5*((x-${pn[1]})/pmax(${pn[2]},1e-10))^2) + ${pn[3]}`,
    '4PL':              `${pn[1]} + (${pn[0]} - ${pn[1]}) / (1 + (pmax(x, 0) / pmax(abs(${pn[2]}), 1e-12))^${pn[3]})`,
    'Gompertz':         `${pn[0]} * exp(-exp(-${pn[1]} * (x - ${pn[2]})))`,
    'Pseudo-Voigt':     `${pn[0]} * (pmin(pmax(${pn[4]},0),1)*${pn[2]}^2/((x-${pn[1]})^2+${pn[2]}^2) + (1-pmin(pmax(${pn[4]},0),1))*exp(-0.5*((x-${pn[1]})/pmax(${pn[3]},1e-10))^2)) + ${pn[5]}`,
    'Fano':             `${pn[0]} * (${pn[3]} + (x-${pn[1]})/pmax(${pn[2]},1e-10))^2 / (1 + ((x-${pn[1]})/pmax(${pn[2]},1e-10))^2) + ${pn[4]}`,
    'Oral-PK':          `ifelse(abs(${pn[1]}-${pn[2]})<1e-9*(abs(${pn[1]})+abs(${pn[2]})+1), ${pn[0]}*${pn[1]}*x*exp(-${pn[1]}*x), ${pn[0]}*${pn[1]}/(${pn[1]}-${pn[2]})*(exp(-${pn[2]}*x)-exp(-${pn[1]}*x)))`,
    'KWW':              `${pn[0]} * exp(-(pmax(x,0)/pmax(${pn[1]},1e-12))^pmax(${pn[2]},1e-6)) + ${pn[3]}`,
    'Langevin':         `ifelse(abs(${pn[1]}*x)<1e-6, ${pn[0]}*${pn[1]}*x/3, ${pn[0]}*(1/tanh(${pn[1]}*x) - 1/(${pn[1]}*x)))`,
    'Stern-Volmer':     `${pn[0]} / (pmax(1+${pn[1]}*x,1e-10) * pmax(1+${pn[2]}*x,1e-10))`,
    'Van-t-Hoff':       `exp(${pn[1]} - ${pn[0]} / pmax(x, 1e-6))`,
    'Ramberg-Osgood':   `x/pmax(${pn[0]},1e-12)+sign(x)*(abs(x)/pmax(${pn[1]},1e-12))^(1/pmax(${pn[2]},1e-6))`,
    // v1.6.0+ models  (erf(z) = 2*pnorm(z*sqrt(2)) - 1 in base R)
    'Two-Compartment-PK':  `${pn[0]}*exp(-abs(${pn[1]})*x) + ${pn[2]}*exp(-abs(${pn[3]})*x)`,
    'PK-Lag':              `ifelse(x>${pn[3]}, ${pn[0]}*${pn[1]}/(${pn[1]}-${pn[2]})*(exp(-${pn[2]}*(x-${pn[3]}))-exp(-${pn[1]}*(x-${pn[3]}))), 0)`,
    'Substrate-Inhibition':`${pn[0]}*x/(${pn[1]} + x + x^2/abs(${pn[2]}))`,
    'Langmuir':            `${pn[0]}*${pn[1]}*x/(1 + ${pn[1]}*x)`,
    'Freundlich':          `${pn[0]}*pmax(x,1e-12)^(1/abs(${pn[1]}))`,
    'Temkin':              `${pn[1]}*log(abs(${pn[0]})*pmax(x,1e-300))`,
    'Power-Law-Fluid':     `${pn[0]}*abs(x)^(${pn[1]} - 1)`,
    'Herschel-Bulkley':    `${pn[0]} + ${pn[1]}*abs(x)^${pn[2]}`,
    'Cross-Model':         `${pn[1]} + (${pn[0]} - ${pn[1]})/(1 + abs(${pn[2]}*x)^abs(${pn[3]}))`,
    'Carreau':             `${pn[1]} + (${pn[0]} - ${pn[1]})*(1 + (${pn[2]}*x)^2)^((${pn[3]} - 1)/2)`,
    'Quemada':             `((sqrt(${pn[0]}) + sqrt(${pn[1]})*sqrt(pmax(x,0)/abs(${pn[2]})))/(1 + sqrt(pmax(x,0)/abs(${pn[2]}))))^2`,
    'Arrhenius':           `${pn[0]}*exp(-${pn[1]}/pmax(x,1e-6))`,
    'Extended-Arrhenius':  `${pn[0]}*pmax(x,1e-12)^${pn[1]}*exp(-${pn[2]}/pmax(x,1e-6))`,
    'EMG':                 `${pn[0]}*exp(0.5*(${pn[2]}/${pn[3]})^2 - (x-${pn[1]})/${pn[3]})*pnorm((x-${pn[1]})/${pn[2]} - ${pn[2]}/${pn[3]}) + ${pn[4]}`,
    'Asymmetric-Gaussian': `${pn[0]}*exp(-0.5*((x-${pn[1]})/${pn[2]})^2)*2*pnorm(${pn[3]}*(x-${pn[1]})/${pn[2]}) + ${pn[4]}`,
    'Erf-Diffusion':       `${pn[0]}*(2*pnorm(((x-${pn[1]})/abs(${pn[2]}))*sqrt(2)) - 1) + ${pn[3]}`,
    'Softplus':            `${pn[0]}*log(1 + exp(${pn[1]}*(x-${pn[2]}))) + ${pn[3]}`,
    'Erf-Sigmoid':         `${pn[0]}*pnorm(${pn[1]}*(x-${pn[2]})*sqrt(2)) + ${pn[3]}`,
  };
  let formula;
  const polyR = /^Polynomial-(\d+)$/.exec(fit.model);
  if (polyR) {
    const deg = pn.length - 1;
    formula = pn.map((c, i) => {
      const pw = deg - i;
      return pw === 0 ? `${c}` : pw === 1 ? `${c}*x` : `${c}*x^${pw}`;
    }).join(' + ');
  } else {
    formula = modelDefs[fit.model] || `# Define formula for ${fit.model} here`;
  }

  const rBounds = fit.bounds;
  const rHasLo = rBounds && rBounds.lo && rBounds.lo.some(v => v !== null);
  const rHasHi = rBounds && rBounds.hi && rBounds.hi.some(v => v !== null);
  const rHasBounds = rHasLo || rHasHi;
  const rLoStr = rBounds ? 'c(' + rBounds.lo.map(v => v !== null ? v.toPrecision(6) : '-Inf').join(', ') + ')' : null;
  const rHiStr = rBounds ? 'c(' + rBounds.hi.map(v => v !== null ? v.toPrecision(6) : 'Inf').join(', ') + ')' : null;

  const lines = [
    `# Curve Fitting Studio — R export`,
    `# Model: ${fit.model}`,
    ``,
    `# Data`,
    `x_data <- ${xArr}`,
    `y_data <- ${yArr}`,
    `df <- data.frame(x = x_data, y = y_data)`,
    ``,
    ...(rHasBounds ? [
    `# Fit with nlsLM (supports parameter bounds; requires minpack.lm)`,
    `library(minpack.lm)`,
    `fit_result <- nlsLM(y ~ ${formula},`,
    `             data = df,`,
    `             start = list(${startStr}),`,
    `             lower = ${rLoStr},`,
    `             upper = ${rHiStr},`,
    `             control = nls.lm.control(maxiter = 500))`,
    ] : [
    `# Fit with nls()`,
    `fit_result <- nls(y ~ ${formula},`,
    `           data = df,`,
    `           start = list(${startStr}),`,
    `           control = nls.control(maxiter = 500))`,
    ]),
    ``,
    `# Results`,
    `print(summary(fit_result))`,
    ``,
    `# Plot`,
    `plot(df$x, df$y, pch = 16, xlab = "x", ylab = "y", main = "${fit.model} fit")`,
    `x_seq <- seq(min(df$x), max(df$x), length.out = 300)`,
    `lines(x_seq, predict(fit_result, newdata = data.frame(x = x_seq)), col = "red", lwd = 2)`,
  ];

  const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
  const rUrl = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = rUrl;
  a.download = `${exportFilename()}-fit.R`; a.click();
  setTimeout(() => URL.revokeObjectURL(rUrl), 60000);
  setConsole('R script downloaded.', '');
}

function exportLatex() {
  const fit = state.fits.find(f => f.id === state.activeFitId);
  if (!fit || !fit.result) { setConsole('No active fit to export.', 'warn'); return; }
  const r = fit.result;
  const p = r.params;
  const fmtL = v => {
    if (!isFinite(v)) return '?';
    const abs = Math.abs(v);
    if (abs >= 1e4 || (abs < 1e-3 && abs !== 0)) {
      const exp = Math.floor(Math.log10(abs));
      const mant = v / Math.pow(10, exp);
      return `${mant.toFixed(3)} \\times 10^{${exp}}`;
    }
    return v.toPrecision(4).replace(/\.?0+$/, '');
  };

  const latexDefs = {
    'Linear':           `y = ${fmtL(p[0])}x + ${fmtL(p[1])}`,
    'Power':            `y = ${fmtL(p[0])} x^{${fmtL(p[1])}}`,
    'Exponential':      `y = ${fmtL(p[0])} e^{${fmtL(p[1])} x}`,
    'Exp-Decay-Offset': `y = ${fmtL(p[0])} e^{-${fmtL(p[1])} x} + ${fmtL(p[2])}`,
    'Logistic':         `y = \\frac{${fmtL(p[0])}}{1 + e^{-${fmtL(p[1])}(x - ${fmtL(p[2])})}}`,
    'Gaussian':         `y = ${fmtL(p[0])} e^{-\\frac{(x - ${fmtL(p[1])})^2}{2 \\cdot ${fmtL(p[2])}^2}} + ${fmtL(p[3])}`,
    'Lorentzian':       `y = \\frac{${fmtL(p[0])} \\cdot ${fmtL(p[2])}^2}{(x - ${fmtL(p[1])})^2 + ${fmtL(p[2])}^2} + ${fmtL(p[3])}`,
    'Michaelis-Menten': `y = \\frac{${fmtL(p[0])} x}{${fmtL(p[1])} + x}`,
    'Hill':             `y = \\frac{${fmtL(p[0])} x^{${fmtL(p[2])}}}{${fmtL(p[1])}^{${fmtL(p[2])}} + x^{${fmtL(p[2])}}}`,
    'Sine':             `y = ${fmtL(p[0])} \\sin(${fmtL(p[1])} x + ${fmtL(p[2])}) + ${fmtL(p[3])}`,
    'Damped-Sine':      `y = ${fmtL(p[0])} e^{-${fmtL(p[1])} x} \\sin(${fmtL(p[2])} x + ${fmtL(p[3])}) + ${fmtL(p[4])}`,
    'Weibull':          `y = 1 - e^{-(x / ${fmtL(p[0])})^{${fmtL(p[1])}}}`,
    'Double-Gaussian':  `y = ${fmtL(p[0])} e^{-(x-${fmtL(p[1])})^2/(2\\cdot${fmtL(p[2])}^2)} + ${fmtL(p[3])} e^{-(x-${fmtL(p[4])})^2/(2\\cdot${fmtL(p[5])}^2)} + ${fmtL(p[6])}`,
    'Biexponential':    `y = ${fmtL(p[0])} e^{-${fmtL(p[1])} x} + ${fmtL(p[2])} e^{-${fmtL(p[3])} x} + ${fmtL(p[4])}`,
    'Rational':         `y = \\frac{${fmtL(p[0])} + ${fmtL(p[1])} x}{1 + ${fmtL(p[2])} x}`,
    'Power-Offset':     `y = ${fmtL(p[0])} x^{${fmtL(p[1])}} + ${fmtL(p[2])}`,
    'Boltzmann':        `y = \\frac{${fmtL(p[0])}}{1 + e^{-(x - ${fmtL(p[1])})/${fmtL(p[2])}}}`,
    'Double-Boltzmann': `y = \\frac{${fmtL(p[0])}}{1+e^{-(x-${fmtL(p[1])})/${fmtL(p[2])}}} + \\frac{${fmtL(p[3])}}{1+e^{-(x-${fmtL(p[4])})/${fmtL(p[5])}}}`,
    'HH-Activation':    `y = ${fmtL(p[0])} m^{${fmtL(p[3])}}(x-${fmtL(p[4])}),\\; m=\\tfrac{1}{1+e^{-(x-${fmtL(p[1])})/${fmtL(p[2])}}}`,
    'HH-Na-IV':         `y = ${fmtL(p[0])} m^3 h (x-${fmtL(p[5])}),\\; m=\\tfrac{1}{1+e^{-(x-${fmtL(p[1])})/${fmtL(p[2])}}},\\; h=\\tfrac{1}{1+e^{(x-${fmtL(p[3])})/${fmtL(p[4])}}}`,
    'Kir':              `y = ${fmtL(p[0])} \\frac{x-${fmtL(p[1])}}{1+e^{(x-${fmtL(p[2])})/${fmtL(p[3])}}}`,
    'GHK':              `y = ${fmtL(p[0])} \\frac{x(1-${fmtL(p[1])} e^{-x/${fmtL(p[2])}})}{1-e^{-x/${fmtL(p[2])}}}`,
    'Tau-Gaussian':     `y = ${fmtL(p[0])} e^{-\\frac{(x-${fmtL(p[1])})^2}{2 \\cdot ${fmtL(p[2])}^2}} + ${fmtL(p[3])}`,
    '4PL':              `y = ${fmtL(p[1])} + \\frac{${fmtL(p[0])} - ${fmtL(p[1])}}{1 + \\left(\\frac{x}{${fmtL(p[2])}}\\right)^{${fmtL(p[3])}}}`,
    'Gompertz':         `y = ${fmtL(p[0])} e^{-e^{-${fmtL(p[1])}(x - ${fmtL(p[2])})}}`,
    'Pseudo-Voigt':     `y = ${fmtL(p[0])}\\left[${fmtL(p[4])}\\frac{${fmtL(p[2])}^2}{(x-${fmtL(p[1])})^2+${fmtL(p[2])}^2} + (1-${fmtL(p[4])})e^{-\\frac{(x-${fmtL(p[1])})^2}{2\\cdot${fmtL(p[3])}^2}}\\right] + ${fmtL(p[5])}`,
    'Fano':             `y = ${fmtL(p[0])}\\frac{(${fmtL(p[3])}+\\varepsilon)^2}{1+\\varepsilon^2} + ${fmtL(p[4])},\\;\\varepsilon=\\frac{x-${fmtL(p[1])}}{${fmtL(p[2])}}`,
    'Oral-PK':          `C = \\frac{${fmtL(p[0])} k_a}{k_a - k_e}\\left(e^{-k_e t}-e^{-k_a t}\\right),\\;k_a=${fmtL(p[1])},\\;k_e=${fmtL(p[2])}`,
    'KWW':              `y = ${fmtL(p[0])} e^{-(x/${fmtL(p[1])})^{${fmtL(p[2])}}} + ${fmtL(p[3])}`,
    'Langevin':         `y = ${fmtL(p[0])}\\left(\\coth(${fmtL(p[1])} x) - \\frac{1}{${fmtL(p[1])} x}\\right)`,
    'Stern-Volmer':     `\\frac{F_0}{F} = (1+K_D[Q])(1+K_S[Q]),\\;F_0=${fmtL(p[0])},\\;K_D=${fmtL(p[1])},\\;K_S=${fmtL(p[2])}`,
    'Van-t-Hoff':       `\\ln K = \\frac{\\Delta S}{R} - \\frac{\\Delta H}{RT},\\;\\Delta H/R=${fmtL(p[0])}\\text{ K},\\;\\Delta S/R=${fmtL(p[1])}`,
    'Ramberg-Osgood':      `\\varepsilon = \\frac{\\sigma}{${fmtL(p[0])}} + \\left(\\frac{\\sigma}{${fmtL(p[1])}}\\right)^{1/${fmtL(p[2])}}`,
    // v1.6.0
    'Two-Compartment-PK':  `C = ${fmtL(p[0])} e^{-${fmtL(p[1])} t} + ${fmtL(p[2])} e^{-${fmtL(p[3])} t}`,
    'PK-Lag':              `C = \\frac{${fmtL(p[0])} k_a}{k_a-k_e}(e^{-k_e(t-t_{\\rm lag})}-e^{-k_a(t-t_{\\rm lag})}),\\;k_a=${fmtL(p[1])},\\;k_e=${fmtL(p[2])},\\;t_{\\rm lag}=${fmtL(p[3])}`,
    'Substrate-Inhibition':`v = \\frac{${fmtL(p[0])} [S]}{${fmtL(p[1])} + [S] + [S]^2/${fmtL(p[2])}}`,
    'Langmuir':            `q = \\frac{${fmtL(p[0])} \\cdot ${fmtL(p[1])} C}{1 + ${fmtL(p[1])} C}`,
    'Freundlich':          `q = ${fmtL(p[0])} C^{1/${fmtL(p[1])}}`,
    'Temkin':              `q = ${fmtL(p[1])} \\ln(${fmtL(p[0])} C)`,
    'Power-Law-Fluid':     `\\eta = ${fmtL(p[0])} |\\dot{\\gamma}|^{${fmtL(p[1])}-1}`,
    'Herschel-Bulkley':    `\\tau = ${fmtL(p[0])} + ${fmtL(p[1])} |\\dot{\\gamma}|^{${fmtL(p[2])}}`,
    'Cross-Model':         `\\eta = ${fmtL(p[1])} + \\frac{${fmtL(p[0])} - ${fmtL(p[1])}}{1+(${fmtL(p[2])}\\dot{\\gamma})^{${fmtL(p[3])}}}`,
    'EMG':                 `y = \\tfrac{${fmtL(p[0])}}{2}e^{\\sigma^2/2\\tau^2-(x-\\mu)/\\tau}\\,\\mathrm{erfc}\\!\\left(\\tfrac{\\sigma/\\tau-(x-\\mu)/\\sigma}{\\sqrt{2}}\\right)+${fmtL(p[4])},\\;\\mu=${fmtL(p[1])},\\;\\sigma=${fmtL(p[2])},\\;\\tau=${fmtL(p[3])}`,
    'Asymmetric-Gaussian': `y = ${fmtL(p[0])} e^{-(x-${fmtL(p[1])})^2/2\\sigma^2}\\left[1+\\mathrm{erf}\\!\\left(\\frac{${fmtL(p[3])}(x-${fmtL(p[1])})}{\\sigma\\sqrt{2}}\\right)\\right]+${fmtL(p[4])},\\;\\sigma=${fmtL(p[2])}`,
    'Voigt':               `y=A(\\eta L+(1-\\eta)G)+C,\\;A=${fmtL(p[0])},\\;x_0=${fmtL(p[1])},\\;f_G=${fmtL(p[2])},\\;f_L=${fmtL(p[3])},\\;C=${fmtL(p[4])}`,
    'Arrhenius':           `k = ${fmtL(p[0])} \\exp\\!\\left(-\\frac{${fmtL(p[1])}}{T}\\right)`,
    'Extended-Arrhenius':  `k = ${fmtL(p[0])} T^{${fmtL(p[1])}} \\exp\\!\\left(-\\frac{${fmtL(p[2])}}{T}\\right)`,
    'Erf-Diffusion':       `y = ${fmtL(p[0])}\\,\\mathrm{erf}\\!\\left(\\frac{x-${fmtL(p[1])}}{${fmtL(p[2])}}\\right)+${fmtL(p[3])}`,
    'Softplus':            `y = ${fmtL(p[0])}\\ln\\!\\left(1+e^{${fmtL(p[1])}(x-${fmtL(p[2])})}\\right)+${fmtL(p[3])}`,
    'Erf-Sigmoid':         `y = \\frac{${fmtL(p[0])}}{2}\\!\\left[1+\\mathrm{erf}\\!\\left(${fmtL(p[1])}(x-${fmtL(p[2])})\\right)\\right]+${fmtL(p[3])}`,
  };

  let latex = latexDefs[fit.model];
  if (!latex) {
    latex = `y = f(x; ${fit.paramNames.map((n, i) => `${n}=${fmtL(p[i])}`).join(', ')})`;
  }
  const full = `$${latex}$`;

  navigator.clipboard.writeText(full)
    .then(() => setConsole('LaTeX equation copied to clipboard.', ''))
    .catch(() => {
      const ta = document.createElement('textarea');
      ta.value = full; document.body.appendChild(ta);
      ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
      setConsole('LaTeX equation copied.', '');
    });
}

function exportMATLAB() {
  const fit = state.fits.find(f => f.id === state.activeFitId);
  if (!fit || !fit.result) { setConsole('No active fit to export.', 'warn'); return; }
  const ds = state.datasets.find(d => d.id === fit.dsId);
  const r = fit.result;
  const excl = ds ? (ds.excludedIndices || new Set()) : new Set();
  const xData = ds ? ds.x.filter((_, i) => !excl.has(i)) : [];
  const yData = ds ? ds.y.filter((_, i) => !excl.has(i)) : [];

  const p0Str = r.params.map(v => v.toPrecision(6)).join(', ');
  const xArr = xData.map(v => v.toPrecision(15)).join('; ');
  const yArr = yData.map(v => v.toPrecision(15)).join('; ');
  const namesComment = fit.paramNames.map((n, i) => `%   p(${i+1}) = ${n}`).join('\n');

  const modelDefs = {
    'Linear':           `p(1) .* x + p(2)`,
    'Power':            `p(1) .* abs(x).^p(2)`,
    'Exponential':      `p(1) .* exp(p(2) .* x)`,
    'Exp-Decay-Offset': `p(1) .* exp(-p(2) .* x) + p(3)`,
    'Logistic':         `p(1) ./ (1 + exp(-p(2) .* (x - p(3))))`,
    'Gaussian':         `p(1) .* exp(-0.5 .* ((x - p(2)) ./ p(3)).^2) + p(4)`,
    'Lorentzian':       `p(1) .* p(3).^2 ./ ((x - p(2)).^2 + p(3).^2) + p(4)`,
    'Michaelis-Menten': `p(1) .* x ./ (p(2) + x)`,
    'Hill':             `p(1) .* x.^p(3) ./ (p(2).^p(3) + x.^p(3))`,
    'Sine':             `p(1) .* sin(p(2) .* x + p(3)) + p(4)`,
    'Damped-Sine':      `p(1) .* exp(-p(2) .* x) .* sin(p(3) .* x + p(4)) + p(5)`,
    'Weibull':          `1 - exp(-(max(x, 1e-12) ./ p(1)).^p(2))`,
    'Double-Gaussian':  `p(1).*exp(-0.5.*((x-p(2))./p(3)).^2) + p(4).*exp(-0.5.*((x-p(5))./p(6)).^2) + p(7)`,
    'Biexponential':    `p(1).*exp(-abs(p(2)).*x) + p(3).*exp(-abs(p(4)).*x) + p(5)`,
    'Rational':         `(p(1) + p(2).*x) ./ (1 + p(3).*x)`,
    'Power-Offset':     `p(1) .* abs(x).^p(2) + p(3)`,
    'Boltzmann':        `p(1) ./ (1 + exp(-(x - p(2)) ./ max(abs(p(3)), 1e-10)))`,
    'Double-Boltzmann': `p(1)./(1+exp(-(x-p(2))./max(abs(p(3)),1e-10))) + p(4)./(1+exp(-(x-p(5))./max(abs(p(6)),1e-10)))`,
    'HH-Activation':    `p(1) .* max(1./(1+exp(-(x-p(2))./max(p(3),1e-10))),1e-12).^p(4) .* (x-p(5))`,
    'HH-Na-IV':         `p(1) .* (1./(1+exp(-(x-p(2))./max(p(3),1e-10)))).^3 .* (1./(1+exp((x-p(4))./max(p(5),1e-10)))) .* (x-p(6))`,
    'Kir':              `p(1) .* (x-p(2)) ./ (1+exp((x-p(3))./max(abs(p(4)),1e-10)))`,
    'GHK':              `(abs(x)<1e-6).*(p(1).*p(3).*(1-p(2))) + (abs(x)>=1e-6).*(p(1).*x.*(1-p(2).*exp(-x./max(p(3),1e-10)))./max(1-exp(-x./max(p(3),1e-10)),1e-10))`,
    'Tau-Gaussian':     `p(1) .* exp(-0.5.*((x-p(2))./max(p(3),1e-10)).^2) + p(4)`,
    '4PL':              `p(2) + (p(1)-p(2)) ./ (1 + (max(x,0)./max(abs(p(3)),1e-12)).^p(4))`,
    'Gompertz':         `p(1) .* exp(-exp(-p(2).*(x-p(3))))`,
    'Pseudo-Voigt':     `p(1).*(min(max(p(5),0),1).*p(3).^2./((x-p(2)).^2+p(3).^2)+(1-min(max(p(5),0),1)).*exp(-0.5.*((x-p(2))./max(p(4),1e-10)).^2))+p(6)`,
    'Fano':             `p(1).*(p(4)+(x-p(2))./max(p(3),1e-10)).^2./(1+((x-p(2))./max(p(3),1e-10)).^2)+p(5)`,
    'Oral-PK':          `(abs(p(2)-p(3))<1e-9*(abs(p(2))+abs(p(3))+1)).*(p(1).*p(2).*x.*exp(-p(2).*x))+(abs(p(2)-p(3))>=1e-9*(abs(p(2))+abs(p(3))+1)).*(p(1).*p(2)./(p(2)-p(3)).*(exp(-p(3).*x)-exp(-p(2).*x)))`,
    'KWW':              `p(1).*exp(-(max(x,0)./max(p(2),1e-12)).^max(p(3),1e-6))+p(4)`,
    'Langevin':         `(abs(p(2).*x)<1e-6).*(p(1).*p(2).*x./3)+(abs(p(2).*x)>=1e-6).*(p(1).*(1./tanh(p(2).*x)-1./(p(2).*x)))`,
    'Stern-Volmer':     `p(1)./(max(1+p(2).*x,1e-10).*max(1+p(3).*x,1e-10))`,
    'Van-t-Hoff':       `exp(p(2)-p(1)./max(x,1e-6))`,
    'Ramberg-Osgood':   `x./max(p(1),1e-12)+sign(x).*(abs(x)./max(p(2),1e-12)).^(1./max(p(3),1e-6))`,
    // v1.6.0+ models  (MATLAB has built-in erf / erfc)
    'Two-Compartment-PK':  `p(1).*exp(-abs(p(2)).*x) + p(3).*exp(-abs(p(4)).*x)`,
    'PK-Lag':              `(x>p(4)).*(p(1).*p(2)./(p(2)-p(3)).*(exp(-p(3).*(x-p(4)))-exp(-p(2).*(x-p(4)))))`,
    'Substrate-Inhibition':`p(1).*x./(p(2) + x + x.^2./abs(p(3)))`,
    'Langmuir':            `p(1).*p(2).*x./(1 + p(2).*x)`,
    'Freundlich':          `p(1).*max(x,1e-12).^(1./abs(p(2)))`,
    'Temkin':              `p(2).*log(abs(p(1)).*max(x,1e-300))`,
    'Power-Law-Fluid':     `p(1).*abs(x).^(p(2)-1)`,
    'Herschel-Bulkley':    `p(1) + p(2).*abs(x).^p(3)`,
    'Cross-Model':         `p(2) + (p(1)-p(2))./(1 + abs(p(3).*x).^abs(p(4)))`,
    'Carreau':             `p(2) + (p(1)-p(2)).*(1 + (p(3).*x).^2).^((p(4)-1)/2)`,
    'Quemada':             `((sqrt(p(1)) + sqrt(p(2)).*sqrt(max(x,0)./abs(p(3))))./(1 + sqrt(max(x,0)./abs(p(3))))).^2`,
    'Arrhenius':           `p(1).*exp(-p(2)./max(x,1e-6))`,
    'Extended-Arrhenius':  `p(1).*max(x,1e-12).^p(2).*exp(-p(3)./max(x,1e-6))`,
    'EMG':                 `0.5.*p(1).*exp(0.5.*(p(3)./p(4)).^2 - (x-p(2))./p(4)).*erfc((p(3)./p(4) - (x-p(2))./p(3))./sqrt(2)) + p(5)`,
    'Asymmetric-Gaussian': `p(1).*exp(-0.5.*((x-p(2))./p(3)).^2).*(1 + erf(p(4).*(x-p(2))./(p(3).*sqrt(2)))) + p(5)`,
    'Erf-Diffusion':       `p(1).*erf((x-p(2))./max(abs(p(3)),1e-10)) + p(4)`,
    'Softplus':            `p(1).*log(1 + exp(p(2).*(x-p(3)))) + p(4)`,
    'Erf-Sigmoid':         `p(1).*0.5.*(1 + erf(p(2).*(x-p(3)))) + p(4)`,
  };
  let fnExpr;
  if (/^Polynomial-\d+$/.test(fit.model)) {
    fnExpr = `polyval(p, x)`;   // p is ordered high-degree → constant, matching CFS
  } else {
    fnExpr = modelDefs[fit.model] || `% Define model for ${fit.model} here`;
  }

  const mBounds = fit.bounds;
  const mHasLo = mBounds && mBounds.lo && mBounds.lo.some(v => v !== null);
  const mHasHi = mBounds && mBounds.hi && mBounds.hi.some(v => v !== null);
  const mHasBounds = mHasLo || mHasHi;
  const mLoStr = mBounds ? '[' + mBounds.lo.map(v => v !== null ? v.toPrecision(6) : '-Inf').join(', ') + ']' : '[]';
  const mHiStr = mBounds ? '[' + mBounds.hi.map(v => v !== null ? v.toPrecision(6) : 'Inf').join(', ') + ']' : '[]';

  const lines = [
    `% Curve Fitting Studio — MATLAB export`,
    `% Model: ${fit.model}`,
    `% Parameter map:`,
    namesComment,
    ``,
    `% Data`,
    `x_data = [${xArr}]';`,
    `y_data = [${yArr}]';`,
    ``,
    `% Model (Optimization Toolbox — lsqcurvefit)`,
    `model = @(p, x) ${fnExpr};`,
    ``,
    `% Initial parameters from fit`,
    `p0 = [${p0Str}];`,
    ...(mHasBounds ? [
    `lb = ${mLoStr};`,
    `ub = ${mHiStr};`,
    ] : []),
    ``,
    `% Fit`,
    `opts = optimoptions('lsqcurvefit', 'MaxFunctionEvaluations', 10000, 'Display', 'off');`,
    mHasBounds
      ? `[popt, ~, res, ~, ~, ~, J] = lsqcurvefit(model, p0, x_data, y_data, lb, ub, opts);`
      : `[popt, ~, res, ~, ~, ~, J] = lsqcurvefit(model, p0, x_data, y_data, [], [], opts);`,
    ``,
    `% Parameter uncertainties`,
    `MSE  = sum(res.^2) / (numel(x_data) - numel(p0));`,
    `Cov  = MSE * full(pinv(full(J)' * full(J)));`,
    `perr = sqrt(diag(Cov));`,
    ``,
    `% Results`,
    `param_names = {${fit.paramNames.map(n => `'${n}'`).join(', ')}};`,
    `for i = 1:numel(popt)`,
    `    fprintf('%s = %.6g +/- %.6g\\n', param_names{i}, popt(i), perr(i));`,
    `end`,
    ``,
    `% Plot`,
    `figure;`,
    `scatter(x_data, y_data, 36, 'filled'); hold on;`,
    `x_fit = linspace(min(x_data), max(x_data), 300)';`,
    `plot(x_fit, model(popt, x_fit), 'r-', 'LineWidth', 2);`,
    `xlabel('x'); ylabel('y');`,
    `title('${fit.model} fit');`,
    `legend('Data', 'Fit');`,
  ];

  const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
  const mUrl = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = mUrl;
  a.download = `${exportFilename()}-fit.m`; a.click();
  setTimeout(() => URL.revokeObjectURL(mUrl), 60000);
  setConsole('MATLAB script downloaded.', '');
}

/* ═══════════════════════════════════════════════════════════
   LATEX DOCUMENT FRAGMENT
═══════════════════════════════════════════════════════════ */
function exportLatexDoc() {
  const fit = state.fits.find(f => f.id === state.activeFitId);
  if (!fit || !fit.result) { setConsole('No active fit to export.', 'warn'); return; }
  const r = fit.result;
  const ds = state.datasets.find(d => d.id === fit.dsId);
  const title = document.getElementById('plot-title').value.trim() || fit.model + ' fit';
  const xlabel = document.getElementById('plot-xlabel').value.trim() || 'x';
  const ylabel = document.getElementById('plot-ylabel').value.trim() || 'y';

  // Reuse fmtL from exportLatex (redefined here for self-containment)
  const fmtL = v => {
    if (!isFinite(v)) return '?';
    const abs = Math.abs(v);
    if (abs >= 1e4 || (abs < 1e-3 && abs !== 0)) {
      const exp = Math.floor(Math.log10(abs));
      return `${(v / Math.pow(10, exp)).toFixed(3)} \\times 10^{${exp}}`;
    }
    return v.toPrecision(4).replace(/\.?0+$/, '');
  };

  // Parameter table rows
  const paramRows = fit.paramNames.map((nm, i) => {
    const val = r.params[i];
    const err = isFinite(r.paramErrors?.[i]) ? r.paramErrors[i] : null;
    const latexName = nm.replace(/[_^{}\\]/g, '\\$&');  // basic escape
    return `  ${latexName} & $${fmtL(val)}$ & ${err ? `$${fmtL(err)}$` : '---'} \\\\`;
  }).join('\n');

  const lines = [
    `% ───────────────────────────────────────────────────────`,
    `% Curve Fitting Studio — LaTeX document fragment`,
    `% Model   : ${fit.model}`,
    `% Dataset : ${ds ? ds.name : '—'}`,
    `% Date    : ${new Date().toISOString().slice(0, 10)}`,
    `% ───────────────────────────────────────────────────────`,
    ``,
    `\\begin{figure}[htbp]`,
    `\\centering`,
    `% Insert your Tikz/pgfplots or includegraphics here`,
    `\\caption{${title}. ${xlabel} vs.\\ ${ylabel}.}`,
    `\\label{fig:${exportFilename()}}`,
    `\\end{figure}`,
    ``,
    `\\begin{equation}`,
    `  % Equation (with fitted parameter values substituted)`,
    `  % See parameter table below for symbol values.`,
    `\\label{eq:${exportFilename()}}`,
    `\\end{equation}`,
    ``,
    `\\begin{table}[htbp]`,
    `\\centering`,
    `\\caption{Fitted parameters for ${fit.model} model ($R^2 = ${isFinite(r.rSq) ? r.rSq.toFixed(6) : '?'}$, $\\text{RMSE} = ${isFinite(r.rmse) ? r.rmse.toExponential(3) : '?'}$, $n = ${r.n}$, AIC $= ${isFinite(r.aic) ? r.aic.toFixed(2) : '?'}$).}`,
    `\\label{tab:${exportFilename()}-params}`,
    `\\begin{tabular}{lcc}`,
    `\\hline`,
    `Parameter & Value & Std.\\ Error \\\\`,
    `\\hline`,
    paramRows,
    `\\hline`,
    `\\end{tabular}`,
    `\\end{table}`,
    ``,
    `% Goodness-of-fit summary`,
    `% $R^2 = ${isFinite(r.rSq) ? r.rSq.toFixed(8) : '?'}$`,
    `% Adj.\\ $R^2 = ${isFinite(r.adjRSq) ? r.adjRSq.toFixed(8) : '?'}$`,
    `% RMSE $= ${isFinite(r.rmse) ? r.rmse.toExponential(4) : '?'}$`,
    `% SSE $= ${isFinite(r.sse) ? r.sse.toExponential(4) : '?'}$`,
    `% AIC $= ${isFinite(r.aic) ? r.aic.toFixed(4) : '?'}$`,
    `% BIC $= ${isFinite(r.bic) ? r.bic.toFixed(4) : '?'}$`,
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = `${exportFilename()}-latex.tex`; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  setConsole('LaTeX document fragment downloaded.', '');
}

/* ═══════════════════════════════════════════════════════════
   JUPYTER NOTEBOOK EXPORT
═══════════════════════════════════════════════════════════ */
function exportJupyter() {
  const fit = state.fits.find(f => f.id === state.activeFitId);
  if (!fit || !fit.result) { setConsole('No active fit to export.', 'warn'); return; }
  const ds = state.datasets.find(d => d.id === fit.dsId);
  const r = fit.result;
  const excl = ds ? (ds.excludedIndices || new Set()) : new Set();
  const xData = ds ? ds.x.filter((_, i) => !excl.has(i)) : [];
  const yData = ds ? ds.y.filter((_, i) => !excl.has(i)) : [];
  const xLabel = document.getElementById('plot-xlabel').value.trim() || 'x';
  const yLabel = document.getElementById('plot-ylabel').value.trim() || 'y';
  const pTitle = document.getElementById('plot-title').value.trim() || fit.model + ' Fit';
  const paramStr = _safeIdents(fit.paramNames).join(', ');
  const p0Str = r.params.map(v => v.toPrecision(6)).join(', ');
  const fnBody = _pyModelBody(fit);
  const xArr = '[' + xData.map(v => v.toPrecision(8)).join(', ') + ']';
  const yArr = '[' + yData.map(v => v.toPrecision(8)).join(', ') + ']';
  const bounds = fit.bounds;
  const hasLo = bounds?.lo?.some(v => v !== null);
  const hasHi = bounds?.hi?.some(v => v !== null);
  const hasBounds = hasLo || hasHi;
  const loStr = bounds ? '[' + bounds.lo.map(v => v !== null ? v.toPrecision(6) : '-np.inf').join(', ') + ']' : '[-np.inf]';
  const hiStr = bounds ? '[' + bounds.hi.map(v => v !== null ? v.toPrecision(6) : 'np.inf').join(', ') + ']' : '[np.inf]';

  const src = lines => lines.map((l, i) => i < lines.length - 1 ? l + '\n' : l);
  const md  = lines => ({ cell_type: 'markdown', metadata: {}, source: src(lines) });
  const code = lines => ({ cell_type: 'code', execution_count: null, metadata: {}, outputs: [], source: src(lines) });

  const cells = [
    md([
      `# ${pTitle}`,
      '',
      `**Model:** ${fit.model}  `,
      `**Dataset:** ${ds ? ds.name : '—'}  `,
      `**Date:** ${new Date().toISOString().slice(0, 10)}  `,
      `**R²:** ${isFinite(r.rSq) ? r.rSq.toFixed(6) : '—'}  `,
      `**RMSE:** ${isFinite(r.rmse) ? r.rmse.toExponential(4) : '—'}`,
    ]),
    code([
      `import numpy as np`,
      `import matplotlib.pyplot as plt`,
      `from scipy.optimize import curve_fit`,
    ]),
    code([
      `# ── Data ──────────────────────────────────────────────`,
      `x_data = np.array(${xArr})`,
      `y_data = np.array(${yArr})`,
    ]),
    code([
      `# ── Model: ${fit.model} ──────────────────────────────────`,
      `def model(x, ${paramStr}):`,
      `    ${fnBody}`,
      ``,
      `# Initial parameters (converged values from CFS)`,
      `p0 = [${p0Str}]`,
      ...(hasBounds ? [
      `bounds = (${loStr}, ${hiStr})`,
      `popt, pcov = curve_fit(model, x_data, y_data, p0=p0, bounds=bounds, maxfev=100000)`,
      ] : [
      `popt, pcov = curve_fit(model, x_data, y_data, p0=p0, maxfev=100000)`,
      ]),
      `perr = np.sqrt(np.diag(pcov))`,
      `y_fit = model(x_data, *popt)`,
      `residuals = y_data - y_fit`,
    ]),
    code([
      `# ── Statistics ────────────────────────────────────────`,
      `ss_res = np.sum(residuals**2)`,
      `ss_tot = np.sum((y_data - np.mean(y_data))**2)`,
      `r_sq = 1 - ss_res / ss_tot if ss_tot > 0 else float('nan')`,
      `rmse = np.sqrt(ss_res / max(len(y_data) - len(popt), 1))`,
      `n, m = len(y_data), len(popt)`,
      `aic = n * np.log(ss_res / n) + 2*m + n*(np.log(2*np.pi) + 1)`,
      `bic = n * np.log(ss_res / n) + m*np.log(n) + n*(np.log(2*np.pi) + 1)`,
      `print(f"R²     = {r_sq:.6f}")`,
      `print(f"RMSE   = {rmse:.4e}")`,
      `print(f"AIC    = {aic:.4f}")`,
      `print(f"BIC    = {bic:.4f}")`,
      `print()`,
      `print(f"{'Parameter':<14}{'Value':>14}{'Std Error':>14}")`,
      `print('-' * 42)`,
      `for name, val, err in zip([${fit.paramNames.map(n=>`'${n}'`).join(',')}], popt, perr):`,
      `    print(f"{name:<14}{val:>14.6g}{err:>14.6g}")`,
    ]),
    code([
      `# ── Plot ──────────────────────────────────────────────`,
      `fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(8, 7), gridspec_kw={'height_ratios': [3, 1]})`,
      `x_smooth = np.linspace(x_data.min(), x_data.max(), 400)`,
      `ax1.scatter(x_data, y_data, s=30, label='Data')`,
      `ax1.plot(x_smooth, model(x_smooth, *popt), 'r-', lw=2, label=f'${fit.model} fit ($R^2$={r_sq:.4f})')`,
      `ax1.set_xlabel('${xLabel}'); ax1.set_ylabel('${yLabel}')`,
      `ax1.set_title('${pTitle}'); ax1.legend()`,
      `ax2.scatter(x_data, residuals, s=25, c='gray')`,
      `ax2.axhline(0, color='r', lw=1, ls='--')`,
      `ax2.set_xlabel('${xLabel}'); ax2.set_ylabel('Residuals')`,
      `plt.tight_layout(); plt.show()`,
    ]),
  ];

  const nb = {
    nbformat: 4, nbformat_minor: 5,
    metadata: {
      kernelspec: { display_name: 'Python 3', language: 'python', name: 'python3' },
      language_info: { name: 'python', version: '3.10.0' },
    },
    cells,
  };

  const blob = new Blob([JSON.stringify(nb, null, 1)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = `${exportFilename()}-fit.ipynb`; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  setConsole('Jupyter notebook downloaded.', '');
}

/* ═══════════════════════════════════════════════════════════
   EXCEL WORKBOOK EXPORT (lazy SheetJS)
═══════════════════════════════════════════════════════════ */
function exportExcel() {
  const fit = state.fits.find(f => f.id === state.activeFitId);
  if (!fit || !fit.result) { setConsole('No active fit to export.', 'warn'); return; }
  function _doExcel() {
    const r = fit.result;
    const ds = state.datasets.find(d => d.id === fit.dsId);
    const excl = ds ? (ds.excludedIndices || new Set()) : new Set();
    const wb = XLSX.utils.book_new();

    // Sheet 1: Data + Residuals
    const dataRows = [['X', 'Y', 'Y_fit', 'Residual', 'Masked']];
    if (ds) {
      ds.x.forEach((x, i) => {
        const masked = excl.has(i);
        const yFit = (!masked && fit.fn) ? fit.fn(x, r.params) : null;
        const resid = yFit !== null && isFinite(yFit) ? ds.y[i] - yFit : null;
        dataRows.push([x, ds.y[i], yFit, resid, masked ? 1 : 0]);
      });
    }
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(dataRows), 'Data');

    // Sheet 2: Parameters + Statistics
    const paramRows = [
      ['Parameter', 'Value', 'Std. Error', '95% CI (±)', 't-stat'],
      ...fit.paramNames.map((nm, i) => {
        const v = r.params[i], e = r.paramErrors?.[i];
        const ci = (isFinite(e) && isFinite(r.n) && r.n > fit.paramNames.length)
          ? e * 1.96 : null;
        const tstat = (isFinite(v) && isFinite(e) && e > 0) ? Math.abs(v / e) : null;
        return [nm, v, isFinite(e) ? e : null, ci, tstat];
      }),
      [], ['Statistic', 'Value'],
      ['R²',       r.rSq],   ['Adj. R²', r.adjRSq],
      ['RMSE',     r.rmse],  ['SSE',     r.sse],
      ['AIC',      r.aic],   ['BIC',     r.bic],
      ['N points', r.n],     ['Parameters', fit.paramNames.length],
      ['Converged', r.converged ? 'Yes' : 'No'],
      ['Algorithm', fit.algo || '—'],
      ...(r.chiSqRed != null ? [['χ²ᵣ', r.chiSqRed]] : []),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(paramRows), 'Parameters');

    // Sheet 3: Diagnostics (covariance matrix)
    if (r.covMatrix && r.covMatrix.length) {
      const hdr = ['', ...fit.paramNames];
      const covRows = [hdr, ...r.covMatrix.map((row, i) => [fit.paramNames[i], ...row])];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(covRows), 'Covariance');
    }

    XLSX.writeFile(wb, `${exportFilename()}-fit.xlsx`);
    setConsole('Excel workbook downloaded.', '');
  }

  if (typeof XLSX !== 'undefined') { _doExcel(); return; }
  setConsole('Loading SheetJS…', '');
  const s = document.createElement('script');
  s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
  s.onload = _doExcel;
  s.onerror = () => setConsole('Failed to load SheetJS. Check internet connection.', 'error');
  document.head.appendChild(s);
}

/* ═══════════════════════════════════════════════════════════
   STANDALONE PLOTLY HTML EXPORT
═══════════════════════════════════════════════════════════ */
function exportStandaloneHTML() {
  const mainEl = document.getElementById('main-plot');
  if (!mainEl?.data?.length) { setConsole('No plot to export.', 'warn'); return; }
  const safeTitle = (document.getElementById('plot-title').value.trim() || 'Curve Fitting Studio')
    .replace(/[<>&"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
  const replacer = (k, v) => (typeof v === 'function' ? undefined : v);
  const tracesJSON  = JSON.stringify(mainEl.data,   replacer);
  const layoutJSON  = JSON.stringify(mainEl.layout, replacer);
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${safeTitle}</title>
<script src="https://cdn.plot.ly/plotly-2.27.0.min.js"><\/script>
</head>
<body style="margin:0;background:#fff">
<div id="plot" style="width:100%;height:100vh"></div>
<script>
Plotly.newPlot('plot',${tracesJSON},${layoutJSON},{responsive:true,displayModeBar:true});
<\/script>
</body>
</html>`;
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = `${exportFilename()}-plot.html`; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  setConsole('Standalone Plotly HTML exported.', '');
}

/* ═══════════════════════════════════════════════════════════
   COPY PLOT TO CLIPBOARD (PNG)
═══════════════════════════════════════════════════════════ */
function copyPlotToClipboard() {
  if (!document.getElementById('main-plot')?.data) { setConsole('No plot to copy.', 'warn'); return; }
  if (!navigator.clipboard?.write) {
    setConsole('Clipboard image API not supported in this browser.', 'warn'); return;
  }
  setConsole('Capturing plot image…', '');
  Plotly.toImage('main-plot', { format: 'png', width: 1920, height: 1200 })
    .then(dataUrl => {
      const base64 = dataUrl.split(',')[1];
      const bytes = atob(base64);
      const arr = new Uint8Array(bytes.length);
      for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
      const blob = new Blob([arr], { type: 'image/png' });
      return navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    })
    .then(() => setConsole('Plot image copied to clipboard (1920×1200 PNG).', ''))
    .catch(err => setConsole('Copy failed: ' + (err.message || err), 'error'));
}

/* ═══════════════════════════════════════════════════════════
   BIBTEX CITATION
═══════════════════════════════════════════════════════════ */
function exportBibTeX() {
  const fit = state.fits.find(f => f.id === state.activeFitId);
  const r = fit?.result;
  const year = new Date().getFullYear();
  const modelNote = fit ? ` Fitted model: ${fit.model}.` : '';
  const statsNote = (r && isFinite(r.rSq))
    ? ` Fitted parameters: ${fit.paramNames.map((n, i) => `${n} = ${r.params[i].toPrecision(4)}`).join(', ')}. R\\textsuperscript{2} = ${r.rSq.toFixed(4)}.`
    : '';
  const bib = `@software{CurveStudio${year},
  author       = {Mirza, Asad},
  title        = {{Curve Fitting Studio}},
  year         = {${year}},
  version      = {1.8.2},
  url          = {https://dthornz.github.io/curve-fitting-studio/},
  urldate      = {${new Date().toISOString().slice(0, 10)}},
  note         = {Browser-native nonlinear regression platform.${modelNote}${statsNote}},
  license      = {Non-commercial},
}`;
  navigator.clipboard.writeText(bib)
    .then(() => setConsole('BibTeX entry copied to clipboard.', ''))
    .catch(() => {
      const blob = new Blob([bib], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `${exportFilename()}-citation.bib`; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      setConsole('BibTeX downloaded (clipboard unavailable).', '');
    });
}

/* ═══════════════════════════════════════════════════════════
   API JSON SCHEMA EXPORT
═══════════════════════════════════════════════════════════ */
function exportJSON() {
  const fit = state.fits.find(f => f.id === state.activeFitId);
  if (!fit || !fit.result) { setConsole('No active fit to export.', 'warn'); return; }
  const r = fit.result;
  const ds = state.datasets.find(d => d.id === fit.dsId);
  const excl = ds ? (ds.excludedIndices || new Set()) : new Set();
  // Keep x, y, y_fit and residuals all the same length and index-aligned with
  // the full dataset; excluded points get null for the fit/residual columns.
  const fullX = ds ? ds.x : [];
  const fullY = ds ? ds.y : [];
  const yFit = fit.fn ? fullX.map((x, i) => excl.has(i) ? null : fit.fn(x, r.params)) : [];
  const residuals = fullX.map((x, i) => {
    const yf = yFit[i];
    return (yf == null || !isFinite(yf)) ? null : fullY[i] - yf;
  });

  const schema = {
    schema: 'curve-fitting-studio/v1',
    generated: new Date().toISOString(),
    model: fit.model,
    label: fit.label,
    dataset: ds ? ds.name : null,
    parameters: Object.fromEntries(
      fit.paramNames.map((n, i) => [n, {
        value: r.params[i],
        std_error: isFinite(r.paramErrors?.[i]) ? r.paramErrors[i] : null,
        ci_95: (isFinite(r.paramErrors?.[i]) && r.n > fit.paramNames.length)
          ? r.paramErrors[i] * 1.96 : null,
      }])
    ),
    covariance: r.covMatrix || null,
    statistics: {
      r_sq:     r.rSq,
      adj_r_sq: r.adjRSq,
      rmse:     r.rmse,
      sse:      r.sse,
      aic:      r.aic,
      bic:      r.bic,
      n:        r.n,
      n_params: fit.paramNames.length,
      dof:      r.n - fit.paramNames.length,
      converged: r.converged,
      iterations: r.iter,
      chi_sq_red: r.chiSqRed ?? null,
    },
    data: {
      x:         fullX,
      y:         fullY,
      y_fit:     yFit,
      residuals,
      excluded:  ds ? [...excl] : [],
    },
    metadata: {
      xlabel:    document.getElementById('plot-xlabel').value.trim() || null,
      ylabel:    document.getElementById('plot-ylabel').value.trim() || null,
      title:     document.getElementById('plot-title').value.trim()  || null,
      algorithm: fit.algo || null,
      fit_color: fit.color,
    },
  };

  const blob = new Blob([JSON.stringify(schema, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = `${exportFilename()}-schema.json`; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  setConsole('API JSON schema exported.', '');
}

