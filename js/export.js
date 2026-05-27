// Export functions: PNG, SVG, CSV, report text, Python, R, LaTeX, MATLAB

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
    csv += `${n},${fit.result.params[i]},${isFinite(fit.result.paramErrors[i]) ? fit.result.paramErrors[i] : 'NaN'}\n`;
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
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${exportFilename()}-results.csv`; a.click();
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
    const se = isFinite(r.paramErrors[i]) ? fmt(r.paramErrors[i]) : '—';
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
  txt += `=======================================================\n`;
  const blob = new Blob([txt], { type: 'text/plain' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${exportFilename()}-report.txt`; a.click();
}

function exportPython() {
  const fit = state.fits.find(f => f.id === state.activeFitId);
  if (!fit || !fit.result) { setConsole('No active fit to export.', 'warn'); return; }
  const ds = state.datasets.find(d => d.id === fit.dsId);
  const r = fit.result;
  const excl = ds ? (ds.excludedIndices || new Set()) : new Set();
  const xData = ds ? ds.x.filter((_, i) => !excl.has(i)) : [];
  const yData = ds ? ds.y.filter((_, i) => !excl.has(i)) : [];

  const paramStr = fit.paramNames.join(', ');
  const p0Str = r.params.map(v => v.toPrecision(6)).join(', ');
  const xArr = '[' + xData.map(v => v.toPrecision(8)).join(', ') + ']';
  const yArr = '[' + yData.map(v => v.toPrecision(8)).join(', ') + ']';

  let fnBody = '';
  const modelDefs = {
    'Linear':           `return ${fit.paramNames[0]} * x + ${fit.paramNames[1]}`,
    'Power':            `return ${fit.paramNames[0]} * np.abs(x)**${fit.paramNames[1]}`,
    'Exponential':      `return ${fit.paramNames[0]} * np.exp(${fit.paramNames[1]} * x)`,
    'Exp-Decay-Offset': `return ${fit.paramNames[0]} * np.exp(-${fit.paramNames[1]} * x) + ${fit.paramNames[2]}`,
    'Logistic':         `return ${fit.paramNames[0]} / (1 + np.exp(-${fit.paramNames[1]} * (x - ${fit.paramNames[2]})))`,
    'Gaussian':         `return ${fit.paramNames[0]} * np.exp(-0.5 * ((x - ${fit.paramNames[1]}) / ${fit.paramNames[2]})**2) + ${fit.paramNames[3]}`,
    'Lorentzian':       `return ${fit.paramNames[0]} * ${fit.paramNames[2]}**2 / ((x - ${fit.paramNames[1]})**2 + ${fit.paramNames[2]}**2) + ${fit.paramNames[3]}`,
    'Michaelis-Menten': `return ${fit.paramNames[0]} * x / (${fit.paramNames[1]} + x)`,
    'Hill':             `return ${fit.paramNames[0]} * x**${fit.paramNames[2]} / (${fit.paramNames[1]}**${fit.paramNames[2]} + x**${fit.paramNames[2]})`,
    'Sine':             `return ${fit.paramNames[0]} * np.sin(${fit.paramNames[1]} * x + ${fit.paramNames[2]}) + ${fit.paramNames[3]}`,
    'Damped-Sine':      `return ${fit.paramNames[0]} * np.exp(-${fit.paramNames[1]} * x) * np.sin(${fit.paramNames[2]} * x + ${fit.paramNames[3]}) + ${fit.paramNames[4]}`,
    'Weibull':          `return 1 - np.exp(-(np.maximum(x, 1e-12) / ${fit.paramNames[0]})**${fit.paramNames[1]})`,
    'Double-Gaussian':  `return (${fit.paramNames[0]} * np.exp(-0.5 * ((x - ${fit.paramNames[1]}) / ${fit.paramNames[2]})**2) +\n           ${fit.paramNames[3]} * np.exp(-0.5 * ((x - ${fit.paramNames[4]}) / ${fit.paramNames[5]})**2) + ${fit.paramNames[6]})`,
    'Biexponential':    `return ${fit.paramNames[0]} * np.exp(-np.abs(${fit.paramNames[1]}) * x) + ${fit.paramNames[2]} * np.exp(-np.abs(${fit.paramNames[3]}) * x) + ${fit.paramNames[4]}`,
    'Rational':         `return (${fit.paramNames[0]} + ${fit.paramNames[1]} * x) / np.maximum(1 + ${fit.paramNames[2]} * x, 1e-10)`,
    'Power-Offset':     `return ${fit.paramNames[0]} * np.abs(x)**${fit.paramNames[1]} + ${fit.paramNames[2]}`,
    'Boltzmann':        `return ${fit.paramNames[0]} / (1 + np.exp(-(x - ${fit.paramNames[1]}) / np.maximum(np.abs(${fit.paramNames[2]}), 1e-10)))`,
    'Double-Boltzmann': `return (${fit.paramNames[0]}/(1+np.exp(-(x-${fit.paramNames[1]})/np.maximum(np.abs(${fit.paramNames[2]}),1e-10))) +\n           ${fit.paramNames[3]}/(1+np.exp(-(x-${fit.paramNames[4]})/np.maximum(np.abs(${fit.paramNames[5]}),1e-10))))`,
    'HH-Activation':    `return ${fit.paramNames[0]} * np.power(np.maximum(1/(1+np.exp(-(x-${fit.paramNames[1]})/np.maximum(${fit.paramNames[2]},1e-10))),1e-12),${fit.paramNames[3]}) * (x-${fit.paramNames[4]})`,
    'HH-Na-IV':         `return ${fit.paramNames[0]} * (1/(1+np.exp(-(x-${fit.paramNames[1]})/np.maximum(${fit.paramNames[2]},1e-10))))**3 * (1/(1+np.exp((x-${fit.paramNames[3]})/np.maximum(${fit.paramNames[4]},1e-10)))) * (x-${fit.paramNames[5]})`,
    'Kir':              `return ${fit.paramNames[0]} * (x-${fit.paramNames[1]}) / (1+np.exp((x-${fit.paramNames[2]})/np.maximum(np.abs(${fit.paramNames[3]}),1e-10)))`,
    'GHK':              `return np.where(np.abs(x)<1e-6, ${fit.paramNames[0]}*${fit.paramNames[2]}*(1-${fit.paramNames[1]}), ${fit.paramNames[0]}*x*(1-${fit.paramNames[1]}*np.exp(-x/np.maximum(${fit.paramNames[2]},1e-10)))/np.maximum(1-np.exp(-x/np.maximum(${fit.paramNames[2]},1e-10)),1e-10))`,
    'Tau-Gaussian':     `return ${fit.paramNames[0]} * np.exp(-0.5*((x-${fit.paramNames[1]})/np.maximum(${fit.paramNames[2]},1e-10))**2) + ${fit.paramNames[3]}`,
    '4PL':              `return ${fit.paramNames[1]} + (${fit.paramNames[0]} - ${fit.paramNames[1]}) / (1 + (np.maximum(x, 0) / np.maximum(np.abs(${fit.paramNames[2]}), 1e-12))**${fit.paramNames[3]})`,
    'Gompertz':         `return ${fit.paramNames[0]} * np.exp(-np.exp(-${fit.paramNames[1]} * (x - ${fit.paramNames[2]})))`,
    'Pseudo-Voigt':     `eta_c = np.clip(${fit.paramNames[4]}, 0, 1)\n    L = ${fit.paramNames[2]}**2 / ((x-${fit.paramNames[1]})**2 + ${fit.paramNames[2]}**2)\n    G = np.exp(-0.5*((x-${fit.paramNames[1]})/np.maximum(${fit.paramNames[3]},1e-10))**2)\n    return ${fit.paramNames[0]} * (eta_c*L + (1-eta_c)*G) + ${fit.paramNames[5]}`,
    'Fano':             `eps = (x - ${fit.paramNames[1]}) / np.maximum(${fit.paramNames[2]}, 1e-10)\n    return ${fit.paramNames[0]} * (${fit.paramNames[3]} + eps)**2 / (1 + eps**2) + ${fit.paramNames[4]}`,
    'Oral-PK':          `return np.where(np.abs(${fit.paramNames[1]}-${fit.paramNames[2]})<1e-9*max(abs(${fit.paramNames[1]})+abs(${fit.paramNames[2]}),1), ${fit.paramNames[0]}*${fit.paramNames[1]}*x*np.exp(-${fit.paramNames[1]}*x), ${fit.paramNames[0]}*${fit.paramNames[1]}/(${fit.paramNames[1]}-${fit.paramNames[2]})*(np.exp(-${fit.paramNames[2]}*x)-np.exp(-${fit.paramNames[1]}*x)))`,
    'KWW':              `return ${fit.paramNames[0]} * np.exp(-(np.maximum(x,0)/np.maximum(${fit.paramNames[1]},1e-12))**np.maximum(${fit.paramNames[2]},1e-6)) + ${fit.paramNames[3]}`,
    'Langevin':         `u = ${fit.paramNames[1]} * x\n    return np.where(np.abs(u)<1e-6, ${fit.paramNames[0]}*u/3, ${fit.paramNames[0]}*(1/np.tanh(u) - 1/u))`,
    'Stern-Volmer':     `return ${fit.paramNames[0]} / (np.maximum(1+${fit.paramNames[1]}*x,1e-10) * np.maximum(1+${fit.paramNames[2]}*x,1e-10))`,
    'Van-t-Hoff':       `return np.exp(${fit.paramNames[1]} - ${fit.paramNames[0]} / np.maximum(x, 1e-6))`,
    'Ramberg-Osgood':   `return x/np.maximum(${fit.paramNames[0]},1e-12) + np.sign(x)*(np.abs(x)/np.maximum(${fit.paramNames[1]},1e-12))**(1.0/np.maximum(${fit.paramNames[2]},1e-6))`,
  };
  fnBody = modelDefs[fit.model] || `# Custom model: ${fit.model}\n    raise NotImplementedError("Define your model here")`;

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
    ``,
    `# Fit`,
    `popt, pcov = curve_fit(model, x_data, y_data, p0=p0, maxfev=10000)`,
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
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = `${exportFilename()}-fit.py`; a.click();
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

  const paramStr = fit.paramNames.join(', ');
  const startStr = fit.paramNames.map((n, i) => `${n}=${r.params[i].toPrecision(6)}`).join(', ');
  const xArr = 'c(' + xData.map(v => v.toPrecision(8)).join(', ') + ')';
  const yArr = 'c(' + yData.map(v => v.toPrecision(8)).join(', ') + ')';

  const modelDefs = {
    'Linear':           `${fit.paramNames[0]} * x + ${fit.paramNames[1]}`,
    'Power':            `${fit.paramNames[0]} * abs(x)^${fit.paramNames[1]}`,
    'Exponential':      `${fit.paramNames[0]} * exp(${fit.paramNames[1]} * x)`,
    'Exp-Decay-Offset': `${fit.paramNames[0]} * exp(-${fit.paramNames[1]} * x) + ${fit.paramNames[2]}`,
    'Logistic':         `${fit.paramNames[0]} / (1 + exp(-${fit.paramNames[1]} * (x - ${fit.paramNames[2]})))`,
    'Gaussian':         `${fit.paramNames[0]} * exp(-0.5 * ((x - ${fit.paramNames[1]}) / ${fit.paramNames[2]})^2) + ${fit.paramNames[3]}`,
    'Lorentzian':       `${fit.paramNames[0]} * ${fit.paramNames[2]}^2 / ((x - ${fit.paramNames[1]})^2 + ${fit.paramNames[2]}^2) + ${fit.paramNames[3]}`,
    'Michaelis-Menten': `${fit.paramNames[0]} * x / (${fit.paramNames[1]} + x)`,
    'Hill':             `${fit.paramNames[0]} * x^${fit.paramNames[2]} / (${fit.paramNames[1]}^${fit.paramNames[2]} + x^${fit.paramNames[2]})`,
    'Sine':             `${fit.paramNames[0]} * sin(${fit.paramNames[1]} * x + ${fit.paramNames[2]}) + ${fit.paramNames[3]}`,
    'Damped-Sine':      `${fit.paramNames[0]} * exp(-${fit.paramNames[1]} * x) * sin(${fit.paramNames[2]} * x + ${fit.paramNames[3]}) + ${fit.paramNames[4]}`,
    'Double-Gaussian':  `${fit.paramNames[0]} * exp(-0.5*((x-${fit.paramNames[1]})/${fit.paramNames[2]})^2) + ${fit.paramNames[3]} * exp(-0.5*((x-${fit.paramNames[4]})/${fit.paramNames[5]})^2) + ${fit.paramNames[6]}`,
    'Biexponential':    `${fit.paramNames[0]} * exp(-abs(${fit.paramNames[1]}) * x) + ${fit.paramNames[2]} * exp(-abs(${fit.paramNames[3]}) * x) + ${fit.paramNames[4]}`,
    'Rational':         `(${fit.paramNames[0]} + ${fit.paramNames[1]} * x) / (1 + ${fit.paramNames[2]} * x)`,
    'Power-Offset':     `${fit.paramNames[0]} * abs(x)^${fit.paramNames[1]} + ${fit.paramNames[2]}`,
    'Boltzmann':        `${fit.paramNames[0]} / (1 + exp(-(x - ${fit.paramNames[1]}) / pmax(abs(${fit.paramNames[2]}), 1e-10)))`,
    'Double-Boltzmann': `${fit.paramNames[0]}/(1+exp(-(x-${fit.paramNames[1]})/pmax(abs(${fit.paramNames[2]}),1e-10))) + ${fit.paramNames[3]}/(1+exp(-(x-${fit.paramNames[4]})/pmax(abs(${fit.paramNames[5]}),1e-10)))`,
    'HH-Activation':    `${fit.paramNames[0]} * pmax(1/(1+exp(-(x-${fit.paramNames[1]})/pmax(${fit.paramNames[2]},1e-10))),1e-12)^${fit.paramNames[3]} * (x-${fit.paramNames[4]})`,
    'HH-Na-IV':         `${fit.paramNames[0]} * (1/(1+exp(-(x-${fit.paramNames[1]})/pmax(${fit.paramNames[2]},1e-10))))^3 * (1/(1+exp((x-${fit.paramNames[3]})/pmax(${fit.paramNames[4]},1e-10)))) * (x-${fit.paramNames[5]})`,
    'Kir':              `${fit.paramNames[0]} * (x-${fit.paramNames[1]}) / (1+exp((x-${fit.paramNames[2]})/pmax(abs(${fit.paramNames[3]}),1e-10)))`,
    'GHK':              `ifelse(abs(x)<1e-6, ${fit.paramNames[0]}*${fit.paramNames[2]}*(1-${fit.paramNames[1]}), ${fit.paramNames[0]}*x*(1-${fit.paramNames[1]}*exp(-x/pmax(${fit.paramNames[2]},1e-10)))/pmax(1-exp(-x/pmax(${fit.paramNames[2]},1e-10)),1e-10))`,
    'Tau-Gaussian':     `${fit.paramNames[0]} * exp(-0.5*((x-${fit.paramNames[1]})/pmax(${fit.paramNames[2]},1e-10))^2) + ${fit.paramNames[3]}`,
    '4PL':              `${fit.paramNames[1]} + (${fit.paramNames[0]} - ${fit.paramNames[1]}) / (1 + (pmax(x, 0) / pmax(abs(${fit.paramNames[2]}), 1e-12))^${fit.paramNames[3]})`,
    'Gompertz':         `${fit.paramNames[0]} * exp(-exp(-${fit.paramNames[1]} * (x - ${fit.paramNames[2]})))`,
    'Pseudo-Voigt':     `${fit.paramNames[0]} * (pmin(pmax(${fit.paramNames[4]},0),1)*${fit.paramNames[2]}^2/((x-${fit.paramNames[1]})^2+${fit.paramNames[2]}^2) + (1-pmin(pmax(${fit.paramNames[4]},0),1))*exp(-0.5*((x-${fit.paramNames[1]})/pmax(${fit.paramNames[3]},1e-10))^2)) + ${fit.paramNames[5]}`,
    'Fano':             `${fit.paramNames[0]} * (${fit.paramNames[3]} + (x-${fit.paramNames[1]})/pmax(${fit.paramNames[2]},1e-10))^2 / (1 + ((x-${fit.paramNames[1]})/pmax(${fit.paramNames[2]},1e-10))^2) + ${fit.paramNames[4]}`,
    'Oral-PK':          `ifelse(abs(${fit.paramNames[1]}-${fit.paramNames[2]})<1e-9*(abs(${fit.paramNames[1]})+abs(${fit.paramNames[2]})+1), ${fit.paramNames[0]}*${fit.paramNames[1]}*x*exp(-${fit.paramNames[1]}*x), ${fit.paramNames[0]}*${fit.paramNames[1]}/(${fit.paramNames[1]}-${fit.paramNames[2]})*(exp(-${fit.paramNames[2]}*x)-exp(-${fit.paramNames[1]}*x)))`,
    'KWW':              `${fit.paramNames[0]} * exp(-(pmax(x,0)/pmax(${fit.paramNames[1]},1e-12))^pmax(${fit.paramNames[2]},1e-6)) + ${fit.paramNames[3]}`,
    'Langevin':         `ifelse(abs(${fit.paramNames[1]}*x)<1e-6, ${fit.paramNames[0]}*${fit.paramNames[1]}*x/3, ${fit.paramNames[0]}*(1/tanh(${fit.paramNames[1]}*x) - 1/(${fit.paramNames[1]}*x)))`,
    'Stern-Volmer':     `${fit.paramNames[0]} / (pmax(1+${fit.paramNames[1]}*x,1e-10) * pmax(1+${fit.paramNames[2]}*x,1e-10))`,
    'Van-t-Hoff':       `exp(${fit.paramNames[1]} - ${fit.paramNames[0]} / pmax(x, 1e-6))`,
    'Ramberg-Osgood':   `x/pmax(${fit.paramNames[0]},1e-12)+sign(x)*(abs(x)/pmax(${fit.paramNames[1]},1e-12))^(1/pmax(${fit.paramNames[2]},1e-6))`,
  };
  const formula = modelDefs[fit.model] || `# Define formula for ${fit.model}`;

  const lines = [
    `# Curve Fitting Studio — R export`,
    `# Model: ${fit.model}`,
    ``,
    `# Data`,
    `x_data <- ${xArr}`,
    `y_data <- ${yArr}`,
    `df <- data.frame(x = x_data, y = y_data)`,
    ``,
    `# Fit with nls()`,
    `fit <- nls(y ~ ${formula},`,
    `           data = df,`,
    `           start = list(${startStr}),`,
    `           control = nls.control(maxiter = 500))`,
    ``,
    `# Results`,
    `print(summary(fit))`,
    ``,
    `# Plot`,
    `plot(df$x, df$y, pch = 16, xlab = "x", ylab = "y", main = "${fit.model} fit")`,
    `x_seq <- seq(min(df$x), max(df$x), length.out = 300)`,
    `lines(x_seq, predict(fit, newdata = data.frame(x = x_seq)), col = "red", lwd = 2)`,
  ];

  const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = `${exportFilename()}-fit.R`; a.click();
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
    'Ramberg-Osgood':   `\\varepsilon = \\frac{\\sigma}{${fmtL(p[0])}} + \\left(\\frac{\\sigma}{${fmtL(p[1])}}\\right)^{1/${fmtL(p[2])}}`,
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
  const xArr = xData.map(v => v.toPrecision(8)).join('; ');
  const yArr = yData.map(v => v.toPrecision(8)).join('; ');
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
  };
  const fnExpr = modelDefs[fit.model] || `% Define model for ${fit.model} here`;

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
    ``,
    `% Fit`,
    `opts = optimoptions('lsqcurvefit', 'MaxFunctionEvaluations', 10000, 'Display', 'off');`,
    `[popt, ~, res, ~, ~, ~, J] = lsqcurvefit(model, p0, x_data, y_data, [], [], opts);`,
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
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = `${exportFilename()}-fit.m`; a.click();
  setConsole('MATLAB script downloaded.', '');
}

