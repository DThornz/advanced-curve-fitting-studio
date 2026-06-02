// Example datasets: noise helpers, EXAMPLES object, EXAMPLE_EQ lookup, generateExample function
/* ═══════════════════════════════════════════════════════════
   EXAMPLE DATASETS
═══════════════════════════════════════════════════════════ */
function addNoise(arr, sigma) {
  return arr.map(v => v + (Math.random() - 0.5) * 2 * sigma);
}
function gauss() {
  let u, v;
  do { u = Math.random() * 2 - 1; v = Math.random() * 2 - 1; } while (u * u + v * v > 1);
  return u * Math.sqrt(-2 * Math.log(u * u + v * v) / (u * u + v * v));
}
function noisyGauss(arr, sigma) { return arr.map(v => v + gauss() * sigma); }

function addExtraNoise(y, type, sigma) {
  if (sigma <= 0 || type === 'none') return y;
  if (type === 'gaussian')  return y.map(v => v + gauss() * sigma);
  if (type === 'uniform')   return y.map(v => v + (Math.random() - 0.5) * 2 * 1.7321 * sigma); // √3·σ half-range → same variance
  if (type === 'laplacian') {
    const b = sigma * 0.7071; // b = σ/√2 → variance = 2b² = σ²
    return y.map(v => { const u = Math.random() - 0.5; return v - b * Math.sign(u) * Math.log(1 - 2 * Math.abs(u)); });
  }
  return y;
}

function addFreqNoise(y, x, components) {
  if (!components.length) return y;
  const x0 = x[0], xRange = x[x.length - 1] - x0 || 1;
  return y.map((v, i) => {
    let s = v;
    for (const c of components) {
      if (c.amp > 0) s += c.amp * Math.sin(2 * Math.PI * c.freq * (x[i] - x0) / xRange + c.phase * 2 * Math.PI);
    }
    return s;
  });
}

function injectOutliers(arr, count, scale) {
  if (!count || count <= 0) return arr;
  if (!scale || scale <= 0) scale = 4;
  const result = arr.slice();
  const n = result.length;
  const finite = arr.filter(v => isFinite(v));
  if (!finite.length) return result;
  const lo = Math.min(...finite), hi = Math.max(...finite);
  const range = Math.max(hi - lo, Math.abs(hi + lo) * 0.1, 1e-10);
  const pool = Array.from({ length: n }, (_, i) => i);
  for (let k = 0; k < Math.min(count, n); k++) {
    const j = Math.floor(Math.random() * pool.length);
    const i = pool.splice(j, 1)[0];
    result[i] += (Math.random() < 0.5 ? 1 : -1) * range * scale * (0.8 + Math.random() * 0.4);
  }
  return result;
}

const EXAMPLES = {
  'exponential-decay': {
    title: 'Exp Decay (Radioactive)',
    params: [
      { key: 'A',    label: 'Amplitude (A)',  value: 95,   min: 1,    max: 500,  step: 1    },
      { key: 'b',    label: 'Decay rate (b)', value: 0.18, min: 0.01, max: 5,    step: 0.01 },
      { key: 'C',    label: 'Offset (C)',      value: 2,    min: -100, max: 200,  step: 0.5  },
      { key: 'noise',   label: 'Noise (σ)',       value: 1.5,  min: 0,    max: 30,   step: 0.1  },
      { key: 'N',       label: 'Points (N)',      value: 24,   min: 5,    max: 200,  step: 1    },
      { key: 'xmax',    label: 'x max',           value: 20,   min: 1,    max: 200,  step: 1    },
      { key: 'outliers',label: 'Outliers',         value: 0,    min: 0,    max: 8,    step: 1    },
    ],
    generate(p) {
      const t = linspace(0, p.xmax, p.N);
      return { name: 'Exp Decay (Radioactive)', x: t, y: noisyGauss(t.map(x => p.A * Math.exp(-p.b * x) + p.C), p.noise), xlabel: 'Time (s)', ylabel: 'Activity (Bq)', suggestModel: 'Exp-Decay-Offset' };
    }
  },
  'gaussian-peak': {
    title: 'Gaussian Peak (Spectroscopy)',
    params: [
      { key: 'A',    label: 'Amplitude (A)', value: 120,  min: 1,    max: 1000, step: 1    },
      { key: 'mu',   label: 'Center (μ)',     value: 0.5,  min: -20,  max: 20,   step: 0.1  },
      { key: 'sig',  label: 'Width (σ)',      value: 1.2,  min: 0.05, max: 20,   step: 0.05 },
      { key: 'C',    label: 'Baseline (C)',   value: 5,    min: -50,  max: 200,  step: 1    },
      { key: 'noise',   label: 'Noise (σ)',      value: 3,    min: 0,    max: 50,   step: 0.5  },
      { key: 'N',       label: 'Points (N)',     value: 40,   min: 5,    max: 200,  step: 1    },
      { key: 'xmin',    label: 'x min',          value: -6,   min: -50,  max: 0,    step: 0.5  },
      { key: 'xmax',    label: 'x max',          value: 6,    min: 0,    max: 50,   step: 0.5  },
      { key: 'outliers',label: 'Outliers',        value: 0,    min: 0,    max: 8,    step: 1    },
    ],
    generate(p) {
      const x = linspace(p.xmin, p.xmax, p.N);
      return { name: 'Gaussian Peak (Spectroscopy)', x, y: noisyGauss(x.map(xi => p.A * Math.exp(-0.5 * ((xi - p.mu) / p.sig) ** 2) + p.C), p.noise), xlabel: 'Wavenumber (cm⁻¹)', ylabel: 'Absorbance', suggestModel: 'Gaussian' };
    }
  },
  'logistic-growth': {
    title: 'Logistic Growth (Cell Culture)',
    params: [
      { key: 'L',    label: 'Capacity (L)',    value: 1e6,  min: 100,  max: 1e9,  step: 1e4  },
      { key: 'k',    label: 'Growth rate (k)', value: 0.18, min: 0.01, max: 2,    step: 0.01 },
      { key: 'x0',   label: 'Midpoint (x₀)',   value: 20,   min: 1,    max: 100,  step: 0.5  },
      { key: 'noise',   label: 'Noise (σ)',        value: 1.5e4,min: 0,    max: 5e5,  step: 1e3  },
      { key: 'N',       label: 'Points (N)',       value: 32,   min: 5,    max: 200,  step: 1    },
      { key: 'xmax',    label: 'x max',            value: 48,   min: 5,    max: 200,  step: 1    },
      { key: 'outliers',label: 'Outliers',          value: 0,    min: 0,    max: 8,    step: 1    },
    ],
    generate(p) {
      const t = linspace(0, p.xmax, p.N);
      return { name: 'Logistic Growth (Cell Culture)', x: t, y: noisyGauss(t.map(x => p.L / (1 + Math.exp(-p.k * (x - p.x0)))), p.noise), xlabel: 'Time (h)', ylabel: 'Cell Count', suggestModel: 'Logistic' };
    }
  },
  'michaelis-menten': {
    title: 'Michaelis-Menten (Enzyme Kinetics)',
    params: [
      { key: 'Vmax', label: 'Vmax',          value: 450,  min: 1,    max: 5000, step: 10   },
      { key: 'Km',      label: 'Km',            value: 12,   min: 0.01, max: 500,  step: 0.5  },
      { key: 'noise',   label: 'Noise (σ)',      value: 8,    min: 0,    max: 100,  step: 0.5  },
      { key: 'outliers',label: 'Outliers',        value: 0,    min: 0,    max: 6,    step: 1    },
    ],
    generate(p) {
      const S = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 40, 80, 150, 250];
      return { name: 'Michaelis-Menten (Enzyme Kinetics)', x: S, y: noisyGauss(S.map(s => p.Vmax * s / (p.Km + s)), p.noise), xlabel: '[S] (mM)', ylabel: 'v (μmol·min⁻¹)', suggestModel: 'Michaelis-Menten' };
    }
  },
  'damped-oscillation': {
    title: 'Damped Oscillation (Vibration)',
    params: [
      { key: 'A',     label: 'Amplitude (A)', value: 8,    min: 0.1,   max: 100,  step: 0.5  },
      { key: 'gamma', label: 'Damping (γ)',    value: 0.3,  min: 0,     max: 5,    step: 0.05 },
      { key: 'omega', label: 'Frequency (ω)', value: 3.2,  min: 0.1,   max: 20,   step: 0.1  },
      { key: 'phi',   label: 'Phase (φ)',      value: 0.5,  min: -3.14, max: 3.14, step: 0.1  },
      { key: 'noise',   label: 'Noise (σ)',      value: 0.3,  min: 0,     max: 10,   step: 0.05 },
      { key: 'N',       label: 'Points (N)',     value: 60,   min: 5,     max: 300,  step: 1    },
      { key: 'xmax',    label: 'x max',          value: 10,   min: 1,     max: 100,  step: 1    },
      { key: 'outliers',label: 'Outliers',        value: 0,    min: 0,     max: 8,    step: 1    },
    ],
    generate(p) {
      const t = linspace(0, p.xmax, p.N);
      return { name: 'Damped Oscillation (Vibration)', x: t, y: noisyGauss(t.map(x => p.A * Math.exp(-p.gamma * x) * Math.sin(p.omega * x + p.phi)), p.noise), xlabel: 'Time (s)', ylabel: 'Displacement (mm)', suggestModel: 'Damped-Sine' };
    }
  },
  'linear-calibration': {
    title: 'Linear Calibration',
    params: [
      { key: 'm',    label: 'Slope (m)',      value: 2.45, min: -100, max: 100,  step: 0.05 },
      { key: 'b',    label: 'Intercept (b)',  value: 0.12, min: -100, max: 100,  step: 0.05 },
      { key: 'noise',   label: 'Noise (σ)',       value: 0.15, min: 0,    max: 20,   step: 0.05 },
      { key: 'N',       label: 'Points (N)',      value: 18,   min: 3,    max: 200,  step: 1    },
      { key: 'xmax',    label: 'x max',           value: 10,   min: 1,    max: 100,  step: 1    },
      { key: 'outliers',label: 'Outliers',         value: 0,    min: 0,    max: 8,    step: 1    },
    ],
    generate(p) {
      const c = linspace(0, p.xmax, p.N);
      return { name: 'Linear Calibration', x: c, y: noisyGauss(c.map(x => p.m * x + p.b), p.noise), xlabel: 'Concentration (mM)', ylabel: 'Absorbance', suggestModel: 'Linear' };
    }
  },
  'hill-equation': {
    title: 'Hill Equation (Dose-Response)',
    params: [
      { key: 'Vmax', label: 'Vmax',            value: 300,  min: 1,    max: 5000, step: 10   },
      { key: 'Kd',   label: 'Kd (EC50)',       value: 4,    min: 0.01, max: 200,  step: 0.1  },
      { key: 'n',       label: 'Hill coeff. (n)', value: 2.5,  min: 0.1,  max: 10,   step: 0.1  },
      { key: 'noise',   label: 'Noise (σ)',        value: 6,    min: 0,    max: 100,  step: 1    },
      { key: 'outliers',label: 'Outliers',          value: 0,    min: 0,    max: 6,    step: 1    },
    ],
    generate(p) {
      const S = [0.1,0.25,0.5,1,1.5,2,3,4,6,8,12,18,25,35,50,75,100];
      return { name: 'Hill Equation (Dose-Response)', x: S, y: noisyGauss(S.map(x => p.Vmax * Math.pow(x, p.n) / (Math.pow(p.Kd, p.n) + Math.pow(x, p.n))), p.noise), xlabel: '[Ligand] (μM)', ylabel: 'Response (%)', suggestModel: 'Hill' };
    }
  },
  'power-law': {
    title: 'Power Law (Allometric Scaling)',
    params: [
      { key: 'a',    label: 'Scale (a)',   value: 0.014, min: 0.001, max: 100,  step: 0.001 },
      { key: 'b',    label: 'Exponent (b)',value: 0.75,  min: 0.1,   max: 3,    step: 0.05  },
      { key: 'noise',   label: 'Noise (σ%)',  value: 8,     min: 0,     max: 50,   step: 1     },
      { key: 'N',       label: 'Points (N)',  value: 24,    min: 4,     max: 100,  step: 1     },
      { key: 'outliers',label: 'Outliers',     value: 0,     min: 0,     max: 8,    step: 1     },
    ],
    generate(p) {
      const masses = [0.01,0.03,0.07,0.15,0.3,0.5,1,2,5,10,20,50,100,200,500,1000,2000,5000,10000,30000,60000,100000,300000,700000];
      const x = masses.slice(0, p.N);
      const yClean = x.map(m => p.a * Math.pow(m, p.b));
      const y = yClean.map(v => v * (1 + (p.noise / 100) * gauss()));
      return { name: 'Allometric Scaling (Power Law)', x, y, xlabel: 'Body Mass (g)', ylabel: 'Metabolic Rate (W)', suggestModel: 'Power' };
    }
  },
  'lorentzian-peak': {
    title: 'Lorentzian Peak (NMR)',
    params: [
      { key: 'A',    label: 'Amplitude (A)', value: 200,  min: 1,    max: 2000, step: 5    },
      { key: 'x0',   label: 'Center (x₀)',   value: 3.6,  min: -50,  max: 50,   step: 0.1  },
      { key: 'g',    label: 'Half-width (γ)', value: 0.4,  min: 0.01, max: 10,   step: 0.05 },
      { key: 'C',    label: 'Baseline (C)',   value: 4,    min: -50,  max: 200,  step: 1    },
      { key: 'noise',   label: 'Noise (σ)',      value: 4,    min: 0,    max: 50,   step: 0.5  },
      { key: 'N',       label: 'Points (N)',     value: 50,   min: 5,    max: 200,  step: 1    },
      { key: 'outliers',label: 'Outliers',        value: 0,    min: 0,    max: 8,    step: 1    },
    ],
    generate(p) {
      const x = linspace(p.x0 - 6 * p.g, p.x0 + 6 * p.g, p.N);
      return { name: 'Lorentzian Peak (NMR)', x, y: noisyGauss(x.map(xi => p.A * p.g * p.g / ((xi - p.x0) ** 2 + p.g * p.g) + p.C), p.noise), xlabel: 'Chemical Shift (ppm)', ylabel: 'Intensity (a.u.)', suggestModel: 'Lorentzian' };
    }
  },
  'weibull-survival': {
    title: 'Weibull CDF (Reliability)',
    params: [
      { key: 'lam',  label: 'Scale (λ)',      value: 500,  min: 10,   max: 10000, step: 10  },
      { key: 'k',    label: 'Shape (k)',       value: 2.2,  min: 0.5,  max: 10,    step: 0.1 },
      { key: 'noise',   label: 'Noise (σ)',       value: 0.02, min: 0,    max: 0.2,   step: 0.005},
      { key: 'N',       label: 'Points (N)',      value: 30,   min: 5,    max: 100,   step: 1   },
      { key: 'outliers',label: 'Outliers',         value: 0,    min: 0,    max: 8,     step: 1   },
    ],
    generate(p) {
      const t = linspace(10, p.lam * 2, p.N);
      return { name: 'Weibull CDF (Reliability)', x: t, y: noisyGauss(t.map(x => 1 - Math.exp(-Math.pow(x / p.lam, p.k))), p.noise).map(v => Math.max(0, Math.min(1, v))), xlabel: 'Time to Failure (h)', ylabel: 'Failure Probability', suggestModel: 'Weibull' };
    }
  },
  'polynomial-calibration': {
    title: 'Polynomial Calibration Curve',
    params: [
      { key: 'a3',   label: 'a₃ (cubic)',     value: -0.008, min: -1,   max: 1,    step: 0.001 },
      { key: 'a2',   label: 'a₂ (quadratic)', value: 0.22,   min: -5,   max: 5,    step: 0.01  },
      { key: 'a1',   label: 'a₁ (linear)',    value: 1.85,   min: -20,  max: 20,   step: 0.05  },
      { key: 'a0',   label: 'a₀ (offset)',    value: 0.05,   min: -10,  max: 10,   step: 0.01  },
      { key: 'noise',   label: 'Noise (σ)',       value: 0.4,    min: 0,    max: 5,    step: 0.05  },
      { key: 'N',       label: 'Points (N)',      value: 22,     min: 5,    max: 100,  step: 1     },
      { key: 'xmax',    label: 'x max',           value: 20,     min: 1,    max: 100,  step: 1     },
      { key: 'outliers',label: 'Outliers',         value: 0,      min: 0,    max: 8,    step: 1     },
    ],
    generate(p) {
      const x = linspace(0, p.xmax, p.N);
      return { name: 'Polynomial Calibration (Cubic)', x, y: noisyGauss(x.map(xi => p.a3*xi**3 + p.a2*xi**2 + p.a1*xi + p.a0), p.noise), xlabel: 'Concentration (mM)', ylabel: 'Signal (mV)', suggestModel: 'Polynomial-3' };
    }
  },
  'sinusoidal': {
    title: 'Sinusoidal Signal',
    params: [
      { key: 'A',    label: 'Amplitude (A)', value: 5,    min: 0.1,   max: 100,  step: 0.1  },
      { key: 'omega',label: 'Frequency (ω)', value: 1.4,  min: 0.05,  max: 20,   step: 0.05 },
      { key: 'phi',  label: 'Phase (φ)',      value: 0.8,  min: -3.14, max: 3.14, step: 0.05 },
      { key: 'C',    label: 'Offset (C)',     value: 1.2,  min: -50,   max: 50,   step: 0.1  },
      { key: 'noise',   label: 'Noise (σ)',      value: 0.4,  min: 0,     max: 10,   step: 0.05 },
      { key: 'N',       label: 'Points (N)',     value: 60,   min: 10,    max: 300,  step: 1    },
      { key: 'xmax',    label: 'x max (periods)',value: 8,    min: 1,     max: 50,   step: 0.5  },
      { key: 'outliers',label: 'Outliers',        value: 0,    min: 0,     max: 8,    step: 1    },
    ],
    generate(p) {
      const xmax = p.xmax * (2 * Math.PI / p.omega);
      const t = linspace(0, xmax, p.N);
      return { name: 'Sinusoidal Signal', x: t, y: noisyGauss(t.map(x => p.A * Math.sin(p.omega * x + p.phi) + p.C), p.noise), xlabel: 'Time (s)', ylabel: 'Amplitude', suggestModel: 'Sine' };
    }
  },
  'gv-boltzmann': {
    title: 'G-V Curve (Boltzmann)',
    params: [
      { key: 'A',    label: 'G max (nS)',            value: 1.0,  min: 0.01, max: 20,   step: 0.01  },
      { key: 'Vh',   label: 'Half-activation (mV)',  value: -30,  min: -120, max: 60,   step: 1     },
      { key: 'k',    label: 'Slope factor (mV)',     value: 8,    min: 1,    max: 30,   step: 0.5   },
      { key: 'noise',label: 'Noise (σ)',              value: 0.02, min: 0,    max: 0.5,  step: 0.005 },
      { key: 'N',    label: 'Points (N)',             value: 33,   min: 5,    max: 100,  step: 1     },
    ],
    generate(p) {
      const V = linspace(-100, 60, p.N);
      const G = V.map(v => p.A / (1 + Math.exp(-(v - p.Vh) / p.k)));
      return { name: 'G-V Curve (Boltzmann)', x: V, y: noisyGauss(G, p.noise), xlabel: 'Voltage (mV)', ylabel: 'Conductance (nS)', suggestModel: 'Boltzmann' };
    }
  },
  'kir-iv': {
    title: 'Kir Channel I-V',
    params: [
      { key: 'g',    label: 'Conductance (nS)',   value: 2.0,  min: 0.1,  max: 20,   step: 0.1  },
      { key: 'EK',   label: 'Reversal E_K (mV)',  value: -80,  min: -120, max: 0,    step: 1    },
      { key: 'Vh',   label: 'Half-block V (mV)',  value: -60,  min: -120, max: 0,    step: 1    },
      { key: 'k',    label: 'Slope factor (mV)',  value: 12,   min: 1,    max: 30,   step: 0.5  },
      { key: 'noise',label: 'Noise (σ, pA)',      value: 2,    min: 0,    max: 30,   step: 0.5  },
      { key: 'N',    label: 'Points (N)',          value: 29,   min: 5,    max: 100,  step: 1    },
    ],
    generate(p) {
      const V = linspace(-120, 20, p.N);
      const I = V.map(v => p.g * (v - p.EK) / (1 + Math.exp((v - p.Vh) / p.k)));
      return { name: 'Kir Channel I-V', x: V, y: noisyGauss(I, p.noise), xlabel: 'Voltage (mV)', ylabel: 'Current (pA)', suggestModel: 'Kir' };
    }
  },
  'hhna-iv': {
    title: 'HH Na Channel I-V',
    params: [
      { key: 'g',    label: 'Max conductance (nS)', value: 50,   min: 1,    max: 500,  step: 1    },
      { key: 'Vm',   label: 'Act. V½ (mV)',         value: -30,  min: -80,  max: 0,    step: 1    },
      { key: 'km',   label: 'Act. slope (mV)',      value: 7,    min: 1,    max: 20,   step: 0.5  },
      { key: 'Vh',   label: 'Inact. V½ (mV)',       value: -55,  min: -100, max: 0,    step: 1    },
      { key: 'kh',   label: 'Inact. slope (mV)',    value: 7,    min: 1,    max: 20,   step: 0.5  },
      { key: 'Erev', label: 'Na reversal (mV)',      value: 50,   min: 0,    max: 120,  step: 1    },
      { key: 'noise',label: 'Noise (σ, pA)',         value: 5,    min: 0,    max: 100,  step: 1    },
      { key: 'N',    label: 'Points (N)',            value: 35,   min: 5,    max: 100,  step: 1    },
    ],
    generate(p) {
      const V = linspace(-80, 60, p.N);
      const I = V.map(v => {
        const m = 1 / (1 + Math.exp(-(v - p.Vm) / p.km));
        const h = 1 / (1 + Math.exp((v - p.Vh) / p.kh));
        return p.g * m * m * m * h * (v - p.Erev);
      });
      return { name: 'HH Na Channel I-V', x: V, y: noisyGauss(I, p.noise), xlabel: 'Voltage (mV)', ylabel: 'Current (pA)', suggestModel: 'HH-Na-IV' };
    }
  },
  'tau-voltage': {
    title: 'Voltage-Dependent τ',
    params: [
      { key: 'tau_max', label: 'τ max (ms)',        value: 5,    min: 0.1,  max: 50,   step: 0.1  },
      { key: 'Vpeak',   label: 'Peak voltage (mV)', value: -40,  min: -100, max: 60,   step: 1    },
      { key: 'k',       label: 'Width σ (mV)',       value: 15,   min: 2,    max: 60,   step: 0.5  },
      { key: 'tau_min', label: 'τ min (ms)',         value: 0.5,  min: 0,    max: 10,   step: 0.1  },
      { key: 'noise',   label: 'Noise (σ, ms)',      value: 0.1,  min: 0,    max: 2,    step: 0.05 },
      { key: 'N',       label: 'Points (N)',          value: 33,   min: 5,    max: 100,  step: 1    },
    ],
    generate(p) {
      const V = linspace(-100, 60, p.N);
      const tau = V.map(v => p.tau_max * Math.exp(-0.5 * ((v - p.Vpeak) / p.k) ** 2) + p.tau_min);
      return { name: 'Voltage-Dependent τ', x: V, y: noisyGauss(tau, p.noise), xlabel: 'Voltage (mV)', ylabel: 'τ (ms)', suggestModel: 'Tau-Gaussian' };
    }
  },
  'elisa-4pl': {
    title: 'ELISA Dose-Response (4PL)',
    params: [
      { key: 'A',    label: 'Top (A)',         value: 2.8,  min: 0.1,  max: 10,   step: 0.05 },
      { key: 'D',    label: 'Bottom (D)',       value: 0.05, min: 0,    max: 1,    step: 0.01 },
      { key: 'C',    label: 'EC50 (ng/mL)',     value: 5,    min: 0.1,  max: 100,  step: 0.1  },
      { key: 'B',    label: 'Hill slope (B)',   value: 1.8,  min: 0.5,  max: 5,    step: 0.1  },
      { key: 'noise',   label: 'Noise (σ)',        value: 0.04, min: 0,    max: 0.5,  step: 0.005},
      { key: 'outliers',label: 'Outliers',          value: 0,    min: 0,    max: 4,    step: 1    },
    ],
    generate(p) {
      const conc = [0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200];
      const y = noisyGauss(conc.map(x => p.D + (p.A - p.D) / (1 + Math.pow(x / p.C, p.B))), p.noise);
      return { name: 'ELISA Dose-Response', x: conc, y: injectOutliers(y, p.outliers, 3), xlabel: 'Concentration (ng/mL)', ylabel: 'Absorbance (450 nm)', suggestModel: '4PL' };
    }
  },
  'gompertz-growth': {
    title: 'Gompertz Tumor Growth',
    params: [
      { key: 'A',    label: 'Carrying cap. (mm³)', value: 2500, min: 100,  max: 10000,step: 100  },
      { key: 'k',    label: 'Growth rate (k)',      value: 0.12, min: 0.01, max: 1,    step: 0.01 },
      { key: 'x0',   label: 'Inflection (x₀, d)',  value: 18,   min: 1,    max: 100,  step: 1    },
      { key: 'noise',   label: 'Noise (σ, mm³)',      value: 50,   min: 0,    max: 500,  step: 5    },
      { key: 'N',       label: 'Points (N)',           value: 28,   min: 5,    max: 100,  step: 1    },
      { key: 'outliers',label: 'Outliers',              value: 0,    min: 0,    max: 4,    step: 1    },
    ],
    generate(p) {
      const t = linspace(0, 50, p.N);
      const y = noisyGauss(t.map(ti => p.A * Math.exp(-Math.exp(-p.k * (ti - p.x0)))), p.noise);
      return { name: 'Gompertz Tumor Growth', x: t, y: injectOutliers(y.map(v => Math.max(v, 0)), p.outliers, 3), xlabel: 'Time (days)', ylabel: 'Tumor Volume (mm³)', suggestModel: 'Gompertz' };
    }
  },
  'xrd-peak': {
    title: 'XRD Diffraction Peak (Pseudo-Voigt)',
    params: [
      { key: 'A',    label: 'Intensity (A)',    value: 5000, min: 100,  max: 50000,step: 100  },
      { key: 'x0',   label: '2θ center (°)',    value: 28.4, min: 5,    max: 80,   step: 0.1  },
      { key: 'g',    label: 'Lorentz HWHM (°)', value: 0.12, min: 0.01, max: 2,    step: 0.01 },
      { key: 's',    label: 'Gauss σ (°)',       value: 0.14, min: 0.01, max: 2,    step: 0.01 },
      { key: 'eta',  label: 'Mixing η (0–1)',    value: 0.55, min: 0,    max: 1,    step: 0.05 },
      { key: 'C',    label: 'Background (C)',    value: 120,  min: 0,    max: 2000, step: 10   },
      { key: 'noise',   label: 'Noise (σ)',         value: 30,   min: 0,    max: 500,  step: 5    },
      { key: 'N',       label: 'Points (N)',         value: 60,   min: 10,   max: 200,  step: 1    },
    ],
    generate(p) {
      const x = linspace(p.x0 - 1.5, p.x0 + 1.5, p.N);
      const y = x.map(xi => {
        const etaC = Math.max(0, Math.min(1, p.eta));
        const L = p.g ** 2 / ((xi - p.x0) ** 2 + p.g ** 2);
        const G = Math.exp(-0.5 * ((xi - p.x0) / p.s) ** 2);
        return p.A * (etaC * L + (1 - etaC) * G) + p.C;
      });
      return { name: 'XRD Diffraction Peak', x, y: noisyGauss(y, p.noise), xlabel: '2θ (°)', ylabel: 'Intensity (counts)', suggestModel: 'Pseudo-Voigt' };
    }
  },
  'fano-resonance': {
    title: 'Fano Resonance (Nanophotonics)',
    params: [
      { key: 'A',    label: 'Amplitude (A)',    value: 1.0,  min: 0.01, max: 10,   step: 0.05 },
      { key: 'x0',   label: 'Resonance (x₀)',   value: 800,  min: 400,  max: 1200, step: 5    },
      { key: 'G',    label: 'Linewidth Γ (nm)', value: 30,   min: 1,    max: 200,  step: 1    },
      { key: 'q',    label: 'Asymmetry (q)',     value: 2.5,  min: -10,  max: 10,   step: 0.1  },
      { key: 'C',    label: 'Background (C)',    value: 0.3,  min: 0,    max: 2,    step: 0.05 },
      { key: 'noise',   label: 'Noise (σ)',         value: 0.02, min: 0,    max: 0.2,  step: 0.005},
      { key: 'N',       label: 'Points (N)',         value: 80,   min: 10,   max: 300,  step: 1    },
    ],
    generate(p) {
      const x = linspace(p.x0 - 4 * p.G, p.x0 + 4 * p.G, p.N);
      const y = x.map(xi => {
        const eps = (xi - p.x0) / p.G;
        return p.A * (p.q + eps) ** 2 / (1 + eps ** 2) + p.C;
      });
      return { name: 'Fano Resonance', x, y: noisyGauss(y, p.noise), xlabel: 'Wavelength (nm)', ylabel: 'Scattering Cross-section (a.u.)', suggestModel: 'Fano' };
    }
  },
  'oral-pk': {
    title: 'Oral Drug PK (1-Compartment)',
    params: [
      { key: 'Amp',  label: 'Dose factor (Amp)', value: 12,   min: 0.1,  max: 500,  step: 0.5  },
      { key: 'ka',   label: 'Absorption ka (1/h)',value: 1.5,  min: 0.05, max: 10,   step: 0.05 },
      { key: 'ke',   label: 'Elimination ke (1/h)',value:0.18, min: 0.01, max: 5,    step: 0.01 },
      { key: 'noise',   label: 'Noise (σ, ng/mL)', value: 0.4,  min: 0,    max: 10,   step: 0.1  },
      { key: 'N',       label: 'Points (N)',          value: 24,   min: 5,    max: 100,  step: 1    },
      { key: 'outliers',label: 'Outliers',              value: 0,    min: 0,    max: 4,    step: 1    },
    ],
    generate(p) {
      const t = [0, 0.25, 0.5, 0.75, 1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10, 12, 14, 18, 24, 30, 36, 48, 60, 72, 96].slice(0, p.N);
      const y = t.map(ti => {
        if (ti <= 0) return 0;
        if (Math.abs(p.ka - p.ke) < 1e-6) return p.Amp * p.ka * ti * Math.exp(-p.ka * ti);
        return p.Amp * p.ka / (p.ka - p.ke) * (Math.exp(-p.ke * ti) - Math.exp(-p.ka * ti));
      });
      return { name: 'Oral Drug PK', x: t, y: injectOutliers(noisyGauss(y, p.noise).map(v => Math.max(v, 0)), p.outliers, 3), xlabel: 'Time (h)', ylabel: 'Concentration (ng/mL)', suggestModel: 'Oral-PK' };
    }
  },
  'polymer-kww': {
    title: 'Polymer Relaxation (KWW)',
    params: [
      { key: 'A',    label: 'Amplitude (A)',   value: 1.0,   min: 0.01, max: 10,   step: 0.05 },
      { key: 'tau',  label: 'Relaxation τ (s)',value: 500,   min: 1,    max: 50000, step: 10  },
      { key: 'beta', label: 'Stretch β',        value: 0.55,  min: 0.1,  max: 1,    step: 0.05 },
      { key: 'C',    label: 'Baseline (C)',     value: 0,     min: -1,   max: 1,    step: 0.01 },
      { key: 'noise',   label: 'Noise (σ)',        value: 0.01,  min: 0,    max: 0.1,  step: 0.005},
      { key: 'N',       label: 'Points (N)',        value: 30,    min: 5,    max: 100,  step: 1    },
    ],
    generate(p) {
      const t = Array.from({ length: p.N }, (_, i) => Math.pow(10, -1 + i * 5 / (p.N - 1)));
      const y = t.map(ti => p.A * Math.exp(-Math.pow(ti / p.tau, p.beta)) + p.C);
      return { name: 'Polymer Relaxation (KWW)', x: t, y: noisyGauss(y, p.noise), xlabel: 'Time (s)', ylabel: 'Modulus G(t) / G₀', suggestModel: 'KWW' };
    }
  },
  'langevin-mh': {
    title: 'Superparamagnetic M-H (Langevin)',
    params: [
      { key: 'A',    label: 'Saturation Ms (A/m)', value: 400000, min: 1000, max: 2e6,  step: 1000 },
      { key: 'B',    label: 'Langevin B (m/A)',    value: 2e-5,   min: 1e-7, max: 1e-3, step: 1e-7 },
      { key: 'noise',   label: 'Noise (σ)',             value: 3000,   min: 0,    max: 50000,step: 500  },
      { key: 'N',       label: 'Points (N)',             value: 30,     min: 5,    max: 100,  step: 1    },
    ],
    generate(p) {
      const H = linspace(-1.5e5, 1.5e5, p.N);
      const y = H.map(h => {
        const u = p.B * h;
        if (Math.abs(u) < 1e-6) return p.A * u / 3;
        return p.A * (1 / Math.tanh(u) - 1 / u);
      });
      return { name: 'Superparamagnetic M-H', x: H, y: noisyGauss(y, p.noise), xlabel: 'Applied Field H (A/m)', ylabel: 'Magnetization M (A/m)', suggestModel: 'Langevin' };
    }
  },
  'stern-volmer': {
    title: 'Fluorescence Quenching (Stern-Volmer)',
    params: [
      { key: 'F0',   label: 'F₀ (unquenched)',  value: 1000, min: 10,   max: 10000,step: 10   },
      { key: 'KD',   label: 'K_D (dynamic, M⁻¹)',value: 8,   min: 0,    max: 200,  step: 0.5  },
      { key: 'KS',   label: 'K_S (static, M⁻¹)', value: 3,   min: 0,    max: 100,  step: 0.5  },
      { key: 'noise',   label: 'Noise (σ)',          value: 8,    min: 0,    max: 100,  step: 1    },
      { key: 'outliers',label: 'Outliers',             value: 0,    min: 0,    max: 4,    step: 1    },
    ],
    generate(p) {
      const Q = [0, 0.01, 0.02, 0.05, 0.08, 0.1, 0.15, 0.2, 0.3, 0.4, 0.5, 0.6, 0.8, 1.0];
      const y = Q.map(q => p.F0 / ((1 + p.KD * q) * (1 + p.KS * q)));
      return { name: 'Fluorescence Quenching', x: Q, y: injectOutliers(noisyGauss(y, p.noise), p.outliers, 3), xlabel: '[Quencher] (M)', ylabel: 'Fluorescence Intensity (a.u.)', suggestModel: 'Stern-Volmer' };
    }
  },
  'vant-hoff': {
    title: "Van't Hoff Equilibrium",
    params: [
      { key: 'dH',   label: 'ΔH (kJ/mol)',      value: -45,  min: -300, max: 300,  step: 1    },
      { key: 'dS',   label: 'ΔS (J/mol/K)',      value: -120, min: -500, max: 500,  step: 5    },
      { key: 'noise',   label: 'Noise (σ, ln K)',   value: 0.05, min: 0,    max: 1,    step: 0.01 },
      { key: 'N',       label: 'Points (N)',          value: 14,   min: 4,    max: 40,   step: 1    },
    ],
    generate(p) {
      const R = 8.314;
      const T = linspace(278, 340, p.N);
      const K = T.map(t => Math.exp(-p.dH * 1000 / (R * t) + p.dS / R));
      const dHR = p.dH * 1000 / R, dSR = p.dS / R;
      return { name: "Van't Hoff Equilibrium", x: T, y: noisyGauss(K, p.noise * mean(K)), xlabel: 'Temperature (K)', ylabel: 'Equilibrium Constant K', suggestModel: 'Van-t-Hoff', _note: `dHR=${dHR.toFixed(0)}, dSR=${dSR.toFixed(2)}` };
    }
  },
  'two-compartment-pk': {
    title: 'Two-Compartment PK (IV Bolus)',
    params: [
      { key: 'A',     label: 'Fast amplitude (A)',   value: 80,   min: 1,    max: 500,  step: 1    },
      { key: 'alpha', label: 'Fast rate α (h⁻¹)',    value: 1.2,  min: 0.01, max: 10,   step: 0.05 },
      { key: 'B',     label: 'Slow amplitude (B)',   value: 40,   min: 1,    max: 500,  step: 1    },
      { key: 'beta',  label: 'Slow rate β (h⁻¹)',    value: 0.12, min: 0.005,max: 2,    step: 0.005},
      { key: 'noise', label: 'Noise (σ, ng/mL)',     value: 1.5,  min: 0,    max: 20,   step: 0.5  },
      { key: 'N',     label: 'Points (N)',            value: 20,   min: 5,    max: 60,   step: 1    },
    ],
    generate(p) {
      const t = [0.083,0.25,0.5,0.75,1,1.5,2,3,4,6,8,12,16,20,24,30,36,48,60,72].slice(0, p.N);
      const y = t.map(ti => p.A * Math.exp(-p.alpha * ti) + p.B * Math.exp(-p.beta * ti));
      return { name: 'Two-Compartment PK (IV Bolus)', x: t, y: noisyGauss(y, p.noise).map(v => Math.max(v, 0)), xlabel: 'Time (h)', ylabel: 'Concentration (ng/mL)', suggestModel: 'Two-Compartment-PK' };
    }
  },
  'pk-lag': {
    title: 'Oral PK with Lag Time',
    params: [
      { key: 'Amp',   label: 'Dose factor (Amp)',    value: 10,   min: 0.1,  max: 200,  step: 0.5  },
      { key: 'ka',    label: 'Absorption ka (h⁻¹)',  value: 1.2,  min: 0.05, max: 10,   step: 0.05 },
      { key: 'ke',    label: 'Elimination ke (h⁻¹)', value: 0.15, min: 0.01, max: 5,    step: 0.01 },
      { key: 'tlag',  label: 'Lag time tlag (h)',    value: 0.75, min: 0,    max: 5,    step: 0.05 },
      { key: 'noise', label: 'Noise (σ, ng/mL)',     value: 0.3,  min: 0,    max: 10,   step: 0.1  },
      { key: 'N',     label: 'Points (N)',            value: 22,   min: 5,    max: 60,   step: 1    },
    ],
    generate(p) {
      const t = [0,0.5,0.75,1,1.25,1.5,2,2.5,3,4,5,6,8,10,12,14,18,24,36,48,60,72].slice(0, p.N);
      const y = t.map(ti => {
        const dt = ti - p.tlag;
        if (dt <= 0) return 0;
        if (Math.abs(p.ka - p.ke) < 1e-6) return p.Amp * p.ka * dt * Math.exp(-p.ka * dt);
        return p.Amp * p.ka / (p.ka - p.ke) * (Math.exp(-p.ke * dt) - Math.exp(-p.ka * dt));
      });
      return { name: 'Oral PK with Lag Time', x: t, y: noisyGauss(y, p.noise).map(v => Math.max(v, 0)), xlabel: 'Time (h)', ylabel: 'Concentration (ng/mL)', suggestModel: 'PK-Lag' };
    }
  },
  'substrate-inhibition': {
    title: 'Substrate Inhibition (Enzyme Kinetics)',
    params: [
      { key: 'Vmax', label: 'Vmax',            value: 120,  min: 1,    max: 2000, step: 5    },
      { key: 'Km',   label: 'Km (mM)',          value: 2,    min: 0.01, max: 100,  step: 0.1  },
      { key: 'Ki',   label: 'Ki (mM)',           value: 50,   min: 0.1,  max: 500,  step: 1    },
      { key: 'noise',label: 'Noise (σ)',         value: 3,    min: 0,    max: 30,   step: 0.5  },
      { key: 'outliers',label: 'Outliers',       value: 0,    min: 0,    max: 4,    step: 1    },
    ],
    generate(p) {
      const S = [0.1,0.3,0.5,1,2,5,10,20,40,80,120,200,350,500];
      const y = S.map(s => p.Vmax * s / (p.Km + s + s * s / p.Ki));
      return { name: 'Substrate Inhibition', x: S, y: injectOutliers(noisyGauss(y, p.noise), p.outliers, 3), xlabel: '[S] (mM)', ylabel: 'v (nmol·min⁻¹)', suggestModel: 'Substrate-Inhibition' };
    }
  },
  // ── Preset-based grouped examples ────────────────────────
  'adsorption-isotherm': {
    title: 'Adsorption Isotherm',
    tags: 'adsorption isotherm langmuir freundlich temkin surface water treatment heavy metal dye',
    presets: [
      {
        label: 'Langmuir — monolayer (activated carbon, heavy metals)',
        suggestModel: 'Langmuir',
        eq: 'q=\\dfrac{q_{m}K_{L}C}{1+K_{L}C}',
        params: [
          { key: 'qm',   label: 'Max capacity qm (mg/g)', value: 45,   min: 1,    max: 500,  step: 1    },
          { key: 'KL',   label: 'Langmuir KL (L/mg)',      value: 0.08, min: 0.001,max: 5,    step: 0.005},
          { key: 'noise',label: 'Noise (σ)',                value: 1.0,  min: 0,    max: 10,   step: 0.1  },
          { key: 'outliers',label: 'Outliers',              value: 0,    min: 0,    max: 4,    step: 1    },
        ],
        generate(p) {
          const C = [0.5, 1, 2, 5, 10, 20, 40, 80, 120, 200, 300, 500];
          const y = C.map(c => p.qm * p.KL * c / (1 + p.KL * c));
          return { name: 'Langmuir Adsorption Isotherm', x: C, y: injectOutliers(noisyGauss(y, p.noise), p.outliers, 3).map(v => Math.max(v, 0)), xlabel: 'Ce (mg/L)', ylabel: 'qe (mg/g)', suggestModel: 'Langmuir' };
        }
      },
      {
        label: 'Freundlich — heterogeneous surface (dye, organic pollutants)',
        suggestModel: 'Freundlich',
        eq: 'q=K_{F}\\,C^{1/n}',
        params: [
          { key: 'KF',   label: 'Freundlich KF',         value: 8,    min: 0.1,  max: 200,  step: 0.5  },
          { key: 'n',    label: 'Freundlich n (>1 favourable)',value: 2.5, min: 0.5, max: 10, step: 0.1 },
          { key: 'noise',label: 'Noise (σ%)',             value: 5,    min: 0,    max: 30,   step: 1    },
          { key: 'outliers',label: 'Outliers',            value: 0,    min: 0,    max: 4,    step: 1    },
        ],
        generate(p) {
          const C = [0.1, 0.3, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500];
          const y = C.map(c => p.KF * Math.pow(c, 1 / p.n));
          return { name: 'Freundlich Adsorption Isotherm', x: C, y: injectOutliers(y.map(v => v * (1 + (p.noise / 100) * gauss())).map(v => Math.max(v, 0)), p.outliers, 3), xlabel: 'Ce (mg/L)', ylabel: 'qe (mg/g)', suggestModel: 'Freundlich' };
        }
      },
      {
        label: 'Temkin — antibiotic / linear-heat adsorption',
        suggestModel: 'Temkin',
        eq: 'q=B\\ln(A_{T}\\,C)',
        params: [
          { key: 'AT',   label: 'Binding constant AT (L/mg)', value: 0.5,  min: 0.001,max: 100,  step: 0.01 },
          { key: 'B',    label: 'Heat factor B (mg/g)',        value: 8.5,  min: 0.1,  max: 100,  step: 0.1  },
          { key: 'noise',label: 'Noise (σ)',                   value: 0.8,  min: 0,    max: 10,   step: 0.1  },
          { key: 'outliers',label: 'Outliers',                 value: 0,    min: 0,    max: 4,    step: 1    },
        ],
        generate(p) {
          const C = [0.5, 1, 2, 5, 10, 20, 40, 80, 120, 200, 300, 500];
          const y = C.map(c => p.B * Math.log(Math.max(p.AT * c, 1e-300)));
          return { name: 'Temkin Adsorption Isotherm', x: C, y: injectOutliers(noisyGauss(y, p.noise), p.outliers, 3), xlabel: 'Ce (mg/L)', ylabel: 'qe (mg/g)', suggestModel: 'Temkin' };
        }
      },
    ],
  },
  'viscosity-flow': {
    title: 'Viscosity vs Shear Rate (Rheology)',
    tags: 'viscosity rheology blood carreau non-newtonian shear thinning thickening polymer cornstarch ketchup honey quemada cross herschel yield stress flow fluid',
    presets: [
      {
        label: 'Blood — shear-thinning (Carreau model)',
        suggestModel: 'Carreau',
        eq: '\\eta=\\eta_{\\infty}+(\\eta_{0}-\\eta_{\\infty})\\left[1+(\\lambda\\dot{\\gamma})^{2}\\right]^{(n-1)/2}',
        params: [
          { key: 'eta0', label: 'Zero-shear η₀ (Pa·s)',  value: 0.16,  min: 0.001,max: 10,   step: 0.005},
          { key: 'etaI', label: 'High-shear η∞ (Pa·s)',  value: 0.0035,min: 0.0001,max:0.1,  step: 0.0005},
          { key: 'lam',  label: 'Relaxation time λ (s)', value: 1.5,   min: 0.01, max: 20,   step: 0.05 },
          { key: 'n',    label: 'Power index n',          value: 0.36,  min: 0.05, max: 0.99, step: 0.01 },
          { key: 'noise',label: 'Noise (σ%)',             value: 3,     min: 0,    max: 20,   step: 0.5  },
          { key: 'N',    label: 'Points (N)',             value: 22,    min: 5,    max: 60,   step: 1    },
        ],
        generate(p) {
          const g = Array.from({length: p.N}, (_, i) => Math.pow(10, -2 + i * 4 / (p.N - 1)));
          const y = g.map(gd => p.etaI + (p.eta0 - p.etaI) * Math.pow(1 + (p.lam * gd) ** 2, (p.n - 1) / 2));
          return { name: 'Blood Viscosity (Carreau)', x: g, y: y.map(v => v * (1 + (p.noise / 100) * gauss())).map(v => Math.max(v, 0)), xlabel: 'Shear rate γ̇ (s⁻¹)', ylabel: 'Viscosity η (Pa·s)', suggestModel: 'Carreau' };
        }
      },
      {
        label: 'Dense suspension — blood-like (Quemada model)',
        suggestModel: 'Quemada',
        eq: '\\eta=\\left(\\dfrac{\\sqrt{\\eta_{0}}+\\sqrt{\\eta_{\\infty}}\\,\\sqrt{\\dot{\\gamma}/\\dot{\\gamma}_{c}}}{1+\\sqrt{\\dot{\\gamma}/\\dot{\\gamma}_{c}}}\\right)^{\\!2}',
        params: [
          { key: 'eta0', label: 'Zero-shear η₀ (Pa·s)',   value: 0.18,  min: 0.001,max: 10,   step: 0.005},
          { key: 'etaI', label: 'High-shear η∞ (Pa·s)',   value: 0.004, min: 0.0001,max:0.1,  step: 0.0005},
          { key: 'gdotc',label: 'Critical γ̇c (s⁻¹)',       value: 0.8,   min: 0.01, max: 100,  step: 0.05 },
          { key: 'noise',label: 'Noise (σ%)',              value: 4,     min: 0,    max: 20,   step: 0.5  },
          { key: 'N',    label: 'Points (N)',              value: 20,    min: 5,    max: 60,   step: 1    },
        ],
        generate(p) {
          const g = Array.from({length: p.N}, (_, i) => Math.pow(10, -2 + i * 4 / (p.N - 1)));
          const y = g.map(gd => {
            const k = Math.sqrt(gd / Math.max(p.gdotc, 1e-10));
            return Math.pow((Math.sqrt(p.eta0) + Math.sqrt(p.etaI) * k) / (1 + k), 2);
          });
          return { name: 'Dense Suspension Viscosity (Quemada)', x: g, y: y.map(v => v * (1 + (p.noise / 100) * gauss())).map(v => Math.max(v, 0)), xlabel: 'Shear rate γ̇ (s⁻¹)', ylabel: 'Viscosity η (Pa·s)', suggestModel: 'Quemada' };
        }
      },
      {
        label: 'Polymer solution — two plateaus (Cross model)',
        suggestModel: 'Cross-Model',
        eq: '\\eta=\\eta_{\\infty}+\\dfrac{\\eta_{0}-\\eta_{\\infty}}{1+(K\\dot{\\gamma})^{m}}',
        params: [
          { key: 'eta0', label: 'Zero-shear η₀ (Pa·s)',  value: 12,   min: 0.01, max: 1000, step: 0.1  },
          { key: 'etaI', label: 'High-shear η∞ (Pa·s)',  value: 0.01, min: 0,    max: 10,   step: 0.001},
          { key: 'K',    label: 'Relax. time K (s)',      value: 0.5,  min: 0.001,max: 100,  step: 0.01 },
          { key: 'm',    label: 'Power index m',          value: 0.7,  min: 0.1,  max: 2,    step: 0.05 },
          { key: 'noise',label: 'Noise (σ%)',             value: 3,    min: 0,    max: 20,   step: 0.5  },
          { key: 'N',    label: 'Points (N)',             value: 25,   min: 5,    max: 60,   step: 1    },
        ],
        generate(p) {
          const g = Array.from({length: p.N}, (_, i) => Math.pow(10, -2 + i * 4 / (p.N - 1)));
          const y = g.map(gd => p.etaI + (p.eta0 - p.etaI) / (1 + Math.pow(p.K * gd, p.m)));
          return { name: 'Polymer Solution Viscosity (Cross)', x: g, y: y.map(v => v * (1 + (p.noise / 100) * gauss())).map(v => Math.max(v, 0)), xlabel: 'Shear rate γ̇ (s⁻¹)', ylabel: 'Viscosity η (Pa·s)', suggestModel: 'Cross-Model' };
        }
      },
      {
        label: 'Cornstarch slurry — shear-thickening (Power-Law)',
        suggestModel: 'Power-Law-Fluid',
        eq: '\\eta=K\\,|\\dot{\\gamma}|^{n-1}',
        params: [
          { key: 'K',    label: 'Consistency K (Pa·sⁿ)',  value: 0.04, min: 0.001,max: 10,   step: 0.001},
          { key: 'n',    label: 'Flow index n (>1)',        value: 1.7,  min: 1.0,  max: 3,    step: 0.05 },
          { key: 'noise',label: 'Noise (σ%)',              value: 5,    min: 0,    max: 20,   step: 0.5  },
          { key: 'N',    label: 'Points (N)',              value: 20,   min: 5,    max: 60,   step: 1    },
        ],
        generate(p) {
          const g = Array.from({length: p.N}, (_, i) => Math.pow(10, -1 + i * 3 / (p.N - 1)));
          const y = g.map(gd => p.K * Math.pow(gd, p.n - 1));
          return { name: 'Cornstarch Slurry (Shear-Thickening)', x: g, y: y.map(v => v * (1 + (p.noise / 100) * gauss())).map(v => Math.max(v, 0)), xlabel: 'Shear rate γ̇ (s⁻¹)', ylabel: 'Viscosity η (Pa·s)', suggestModel: 'Power-Law-Fluid' };
        }
      },
      {
        label: 'Ketchup / Toothpaste — yield stress (Herschel-Bulkley)',
        suggestModel: 'Herschel-Bulkley',
        eq: '\\tau=\\tau_{0}+K\\,|\\dot{\\gamma}|^{n}',
        params: [
          { key: 'tau0', label: 'Yield stress τ₀ (Pa)',   value: 18,   min: 0,    max: 200,  step: 0.5  },
          { key: 'K',    label: 'Consistency K (Pa·sⁿ)',  value: 4,    min: 0.01, max: 100,  step: 0.1  },
          { key: 'n',    label: 'Flow index n',            value: 0.45, min: 0.05, max: 2,    step: 0.05 },
          { key: 'noise',label: 'Noise (σ, Pa)',           value: 1.5,  min: 0,    max: 20,   step: 0.2  },
          { key: 'N',    label: 'Points (N)',              value: 20,   min: 5,    max: 60,   step: 1    },
        ],
        generate(p) {
          const g = linspace(0.1, 500, p.N);
          const y = g.map(gd => p.tau0 + p.K * Math.pow(gd, p.n));
          return { name: 'Ketchup / Yield-Stress Fluid (HB)', x: g, y: noisyGauss(y, p.noise).map(v => Math.max(v, 0)), xlabel: 'Shear rate γ̇ (s⁻¹)', ylabel: 'Shear stress τ (Pa)', suggestModel: 'Herschel-Bulkley' };
        }
      },
    ],
  },
  'spectral-peak': {
    title: 'Spectral / Chromatographic Peak',
    tags: 'chromatography peak spectroscopy nmr raman xrd emg asymmetric voigt gaussian tailing lineshape',
    presets: [
      {
        label: 'EMG — tailing HPLC peak (chromatography)',
        suggestModel: 'EMG',
        eq: 'y=\\tfrac{A}{2}\\exp\\!\\left(\\tfrac{\\sigma^{2}}{2\\tau^{2}}-\\tfrac{x-\\mu}{\\tau}\\right)\\mathrm{erfc}\\!\\left(\\tfrac{\\sigma/\\tau-(x-\\mu)/\\sigma}{\\sqrt{2}}\\right)+C',
        params: [
          { key: 'A',    label: 'Amplitude (A)',     value: 150,  min: 1,    max: 2000, step: 5    },
          { key: 'mu',   label: 'Gaussian μ',         value: 5,    min: -20,  max: 50,   step: 0.1  },
          { key: 'sig',  label: 'Gaussian σ',         value: 0.5,  min: 0.05, max: 5,    step: 0.05 },
          { key: 'tau',  label: 'Tail constant τ',    value: 0.8,  min: 0.05, max: 10,   step: 0.05 },
          { key: 'C',    label: 'Baseline (C)',        value: 3,    min: 0,    max: 100,  step: 1    },
          { key: 'noise',label: 'Noise (σ)',           value: 3,    min: 0,    max: 30,   step: 0.5  },
          { key: 'N',    label: 'Points (N)',          value: 50,   min: 10,   max: 200,  step: 1    },
        ],
        generate(p) {
          const x = linspace(p.mu - 3 * p.sig, p.mu + 6 * p.tau + 4 * p.sig, p.N);
          const y = x.map(xi => MODELS['EMG'].fn(xi, [p.A, p.mu, p.sig, p.tau, p.C]));
          return { name: 'HPLC Tailing Peak (EMG)', x, y: noisyGauss(y, p.noise).map(v => Math.max(v, 0)), xlabel: 'Retention time (min)', ylabel: 'Signal (mAU)', suggestModel: 'EMG' };
        }
      },
      {
        label: 'Asymmetric Gaussian — skewed spectral peak',
        suggestModel: 'Asymmetric-Gaussian',
        eq: 'y=A\\,e^{-(x-\\mu)^{2}/2\\sigma^{2}}\\!\\left[1+\\mathrm{erf}\\!\\left(\\tfrac{\\alpha(x-\\mu)}{\\sigma\\sqrt{2}}\\right)\\right]+C',
        params: [
          { key: 'A',    label: 'Amplitude (A)',     value: 100,  min: 1,    max: 2000, step: 5    },
          { key: 'mu',   label: 'Center μ',           value: 0,    min: -50,  max: 50,   step: 0.1  },
          { key: 'sig',  label: 'Width σ',            value: 2,    min: 0.1,  max: 20,   step: 0.1  },
          { key: 'alpha',label: 'Skewness α',         value: 3,    min: -10,  max: 10,   step: 0.5  },
          { key: 'C',    label: 'Baseline (C)',        value: 2,    min: 0,    max: 50,   step: 1    },
          { key: 'noise',label: 'Noise (σ)',           value: 3,    min: 0,    max: 30,   step: 0.5  },
          { key: 'N',    label: 'Points (N)',          value: 50,   min: 10,   max: 200,  step: 1    },
        ],
        generate(p) {
          const x = linspace(p.mu - 4 * p.sig, p.mu + 4 * p.sig, p.N);
          const y = x.map(xi => MODELS['Asymmetric-Gaussian'].fn(xi, [p.A, p.mu, p.sig, p.alpha, p.C]));
          return { name: 'Asymmetric Gaussian Peak', x, y: noisyGauss(y, p.noise).map(v => Math.max(v, 0)), xlabel: 'Wavenumber (cm⁻¹)', ylabel: 'Intensity (a.u.)', suggestModel: 'Asymmetric-Gaussian' };
        }
      },
      {
        label: 'Voigt — XRD / Raman peak (Thompson-Cox-Hastings)',
        suggestModel: 'Voigt',
        eq: 'y=A\\!\\left[\\eta\\dfrac{(f_V/2)^{2}}{(x-x_0)^{2}+(f_V/2)^{2}}+(1-\\eta)\\,e^{-4\\ln2(x-x_0)^{2}/f_V^{2}}\\right]+C',
        params: [
          { key: 'A',    label: 'Amplitude (A)',      value: 5000, min: 100,  max: 50000,step: 100  },
          { key: 'x0',   label: '2θ center (°)',       value: 28.4, min: 5,    max: 80,   step: 0.1  },
          { key: 'fG',   label: 'Gaussian FWHM (°)',   value: 0.28, min: 0.01, max: 2,    step: 0.01 },
          { key: 'fL',   label: 'Lorentzian FWHM (°)', value: 0.18, min: 0.01, max: 2,    step: 0.01 },
          { key: 'C',    label: 'Background (C)',       value: 100,  min: 0,    max: 2000, step: 10   },
          { key: 'noise',label: 'Noise (σ)',            value: 25,   min: 0,    max: 500,  step: 5    },
          { key: 'N',    label: 'Points (N)',           value: 60,   min: 10,   max: 200,  step: 1    },
        ],
        generate(p) {
          const x = linspace(p.x0 - 1.5, p.x0 + 1.5, p.N);
          const y = x.map(xi => MODELS['Voigt'].fn(xi, [p.A, p.x0, p.fG, p.fL, p.C]));
          return { name: 'XRD Voigt Peak', x, y: noisyGauss(y, p.noise).map(v => Math.max(v, 0)), xlabel: '2θ (°)', ylabel: 'Intensity (counts)', suggestModel: 'Voigt' };
        }
      },
    ],
  },
  'thermal-kinetics': {
    title: 'Thermal Kinetics (Rate vs Temperature)',
    tags: 'arrhenius kinetics rate temperature activation energy eyring extended combustion atmosphere chemical reaction thermal',
    presets: [
      {
        label: 'Arrhenius — standard rate constant',
        suggestModel: 'Arrhenius',
        eq: 'k=A\\,\\exp\\!\\left(-E_{a}/R\\,T\\right)',
        params: [
          { key: 'A',    label: 'Pre-factor A (s⁻¹)',  value: 1e12, min: 1,    max: 1e16, step: 1e11 },
          { key: 'EaR',  label: 'Ea/R (K)',             value: 8000, min: 1000, max: 30000,step: 100  },
          { key: 'noise',label: 'Noise (σ%)',            value: 5,    min: 0,    max: 30,   step: 1    },
          { key: 'N',    label: 'Points (N)',            value: 14,   min: 4,    max: 30,   step: 1    },
        ],
        generate(p) {
          const T = linspace(280, 380, p.N);
          const y = T.map(t => p.A * Math.exp(-p.EaR / t));
          return { name: 'Arrhenius Rate Constant', x: T, y: y.map(v => v * (1 + (p.noise / 100) * gauss())).map(v => Math.max(v, 0)), xlabel: 'Temperature T (K)', ylabel: 'Rate constant k (s⁻¹)', suggestModel: 'Arrhenius' };
        }
      },
      {
        label: 'Extended Arrhenius — non-Arrhenius (T^n pre-factor)',
        suggestModel: 'Extended-Arrhenius',
        eq: 'k=A\\,T^{n}\\,\\exp\\!\\left(-E_{a}/R\\,T\\right)',
        params: [
          { key: 'A',    label: 'Pre-factor A',        value: 100,  min: 1e-5, max: 1e8,  step: 1    },
          { key: 'n',    label: 'T exponent n',         value: 1.5,  min: -3,   max: 5,    step: 0.1  },
          { key: 'EaR',  label: 'Ea/R (K)',             value: 5000, min: 100,  max: 30000,step: 100  },
          { key: 'noise',label: 'Noise (σ%)',            value: 5,    min: 0,    max: 30,   step: 1    },
          { key: 'N',    label: 'Points (N)',            value: 16,   min: 4,    max: 40,   step: 1    },
        ],
        generate(p) {
          const T = linspace(250, 1500, p.N);
          const y = T.map(t => p.A * Math.pow(t, p.n) * Math.exp(-p.EaR / t));
          return { name: 'Extended Arrhenius Rate', x: T, y: y.map(v => v * (1 + (p.noise / 100) * gauss())).map(v => Math.max(v, 0)), xlabel: 'Temperature T (K)', ylabel: 'Rate constant k (s⁻¹)', suggestModel: 'Extended-Arrhenius' };
        }
      },
    ],
  },
  'sigmoid-activation': {
    title: 'Sigmoid / Activation Function',
    tags: 'sigmoid activation probit erf logistic softplus neural threshold dose response psychophysics cumulative',
    presets: [
      {
        label: 'Erf-Sigmoid / Probit — threshold detection',
        suggestModel: 'Erf-Sigmoid',
        eq: 'y=\\dfrac{A}{2}\\!\\left[1+\\mathrm{erf}\\!\\left(k(x-x_{0})\\right)\\right]+C',
        params: [
          { key: 'A',    label: 'Amplitude (A)',     value: 1,    min: 0.01, max: 10,   step: 0.01 },
          { key: 'k',    label: 'Steepness (k)',      value: 1.2,  min: 0.01, max: 20,   step: 0.05 },
          { key: 'x0',   label: 'Midpoint (x₀)',      value: 0,    min: -50,  max: 50,   step: 0.5  },
          { key: 'C',    label: 'Baseline (C)',        value: 0,    min: -1,   max: 1,    step: 0.01 },
          { key: 'noise',label: 'Noise (σ)',           value: 0.02, min: 0,    max: 0.2,  step: 0.005},
          { key: 'N',    label: 'Points (N)',          value: 30,   min: 5,    max: 100,  step: 1    },
        ],
        generate(p) {
          const x = linspace(p.x0 - 3 / Math.max(p.k, 0.01), p.x0 + 3 / Math.max(p.k, 0.01), p.N);
          const y = x.map(xi => MODELS['Erf-Sigmoid'].fn(xi, [p.A, p.k, p.x0, p.C]));
          return { name: 'Erf-Sigmoid (Probit)', x, y: noisyGauss(y, p.noise), xlabel: 'Stimulus level', ylabel: 'Response fraction', suggestModel: 'Erf-Sigmoid' };
        }
      },
      {
        label: 'Softplus — smooth ReLU activation',
        suggestModel: 'Softplus',
        eq: 'y=A\\ln\\!\\left(1+e^{k(x-x_{0})}\\right)+C',
        params: [
          { key: 'A',    label: 'Scale (A)',          value: 1,    min: 0.01, max: 20,   step: 0.05 },
          { key: 'k',    label: 'Steepness (k)',       value: 1,    min: 0.01, max: 10,   step: 0.05 },
          { key: 'x0',   label: 'Threshold (x₀)',      value: 0,    min: -20,  max: 20,   step: 0.5  },
          { key: 'C',    label: 'Baseline (C)',         value: 0,    min: -5,   max: 5,    step: 0.05 },
          { key: 'noise',label: 'Noise (σ)',            value: 0.05, min: 0,    max: 0.5,  step: 0.01 },
          { key: 'N',    label: 'Points (N)',           value: 30,   min: 5,    max: 100,  step: 1    },
        ],
        generate(p) {
          const x = linspace(p.x0 - 4 / Math.max(p.k, 0.01), p.x0 + 8 / Math.max(p.k, 0.01), p.N);
          const y = x.map(xi => MODELS['Softplus'].fn(xi, [p.A, p.k, p.x0, p.C]));
          return { name: 'Softplus Activation', x, y: noisyGauss(y, p.noise), xlabel: 'Input', ylabel: 'Output', suggestModel: 'Softplus' };
        }
      },
    ],
  },
  'erf-diffusion': {
    title: 'Erf Diffusion Profile',
    params: [
      { key: 'A',    label: 'Amplitude (A)',   value: 0.45, min: 0.01, max: 5,    step: 0.01 },
      { key: 'mu',   label: 'Interface μ',      value: 0.5,  min: -5,   max: 10,   step: 0.1  },
      { key: 'w',    label: 'Diff. width w',    value: 0.6,  min: 0.05, max: 5,    step: 0.05 },
      { key: 'B',    label: 'Baseline B',       value: 0.5,  min: -2,   max: 2,    step: 0.05 },
      { key: 'noise',label: 'Noise (σ)',         value: 0.01, min: 0,    max: 0.1,  step: 0.005},
      { key: 'N',    label: 'Points (N)',        value: 30,   min: 5,    max: 100,  step: 1    },
    ],
    generate(p) {
      const x = linspace(-2, 4, p.N);
      const erf = z => { const t = 1/(1+0.3275911*Math.abs(z)), pp = t*(0.254829592+t*(-0.284496736+t*(1.421413741+t*(-1.453152027+t*1.061405429)))); return Math.sign(z)*(1-pp*Math.exp(-z*z)); };
      const y = x.map(xi => p.A * erf((xi - p.mu) / p.w) + p.B);
      return { name: 'Erf Diffusion Profile', x, y: noisyGauss(y, p.noise), xlabel: 'Depth x (mm)', ylabel: 'Concentration C/C₀', suggestModel: 'Erf-Diffusion' };
    }
  },
  'stress-strain': {
    title: 'Stress-Strain (Ramberg-Osgood)',
    params: [
      { key: 'E',    label: "Young's mod. E (MPa)",value: 200000, min: 10000, max: 500000, step: 1000},
      { key: 'K',    label: 'Strength coeff. K (MPa)',value: 700, min: 10,   max: 5000,  step: 10  },
      { key: 'n',    label: 'Hardening exp. n',    value: 8,      min: 1,    max: 30,    step: 0.5 },
      { key: 'noise',   label: 'Noise (σ, strain)',   value: 5e-5,   min: 0,    max: 2e-3,  step: 1e-5},
      { key: 'N',       label: 'Points (N)',            value: 25,     min: 5,    max: 100,   step: 1   },
    ],
    generate(p) {
      const sigma = linspace(0, p.K * 1.3, p.N);
      const eps = sigma.map(s => s / p.E + Math.pow(s / p.K, 1 / p.n));
      return { name: 'Stress-Strain Curve', x: sigma, y: noisyGauss(eps, p.noise), xlabel: 'Stress σ (MPa)', ylabel: 'Strain ε', suggestModel: 'Ramberg-Osgood' };
    }
  },
  // Demonstrates replicate-derived uncertainty: each dose is measured `reps`
  // times; the dataset carries per-point σ so 1/σ² weighting + reduced χ² apply.
  'dose-response-replicates': {
    title: 'Dose–Response + σ (replicates)',
    tags: 'replicate replicates error bars sigma uncertainty sd sem weighted chi-square dose response 4pl ec50 elisa',
    params: [
      { key: 'A',    label: 'Top plateau (A)',   value: 100, min: 0,    max: 1000, step: 1   },
      { key: 'D',    label: 'Bottom plateau (D)',value: 5,   min: -50,  max: 500,  step: 1   },
      { key: 'C',    label: 'EC₅₀ (C)',          value: 8,   min: 0.01, max: 1000, step: 0.1 },
      { key: 'B',    label: 'Hill slope (B)',    value: 1.3, min: 0.1,  max: 8,    step: 0.1 },
      { key: 'reps', label: 'Replicates / dose', value: 4,   min: 2,    max: 12,   step: 1   },
      { key: 'noise',label: 'Replicate σ',       value: 6,   min: 0,    max: 100,  step: 0.5 },
      { key: 'N',    label: 'Doses (N)',         value: 10,  min: 4,    max: 30,   step: 1   },
    ],
    generate(p) {
      const reps = Math.max(2, Math.round(p.reps));
      const lo = Math.log10(Math.max(p.C / 30, 1e-3)), hi = Math.log10(Math.max(p.C * 30, p.C / 30 * 10 + 1e-3));
      const x = Array.from({ length: p.N }, (_, i) => Math.pow(10, lo + (hi - lo) * i / Math.max(p.N - 1, 1)));
      const f = xi => p.D + (p.A - p.D) / (1 + Math.pow(xi / Math.max(p.C, 1e-9), p.B));
      const y = [], sigY = [];
      for (const xi of x) {
        const samples = Array.from({ length: reps }, () => f(xi) + gauss() * p.noise);
        const m = samples.reduce((s, v) => s + v, 0) / reps;
        const sd = Math.sqrt(samples.reduce((s, v) => s + (v - m) ** 2, 0) / (reps - 1));
        y.push(m); sigY.push(sd > 0 ? sd : NaN);
      }
      return { name: 'Dose–Response + σ (replicates)', x, y, sigY, xlabel: 'Dose', ylabel: 'Response', suggestModel: '4PL' };
    }
  }
};

const EXAMPLE_EQ = {
  'exponential-decay':      'y = A\\,e^{-bx}+C',
  'gaussian-peak':          'y = A\\exp\\!\\left(-\\dfrac{(x-\\mu)^{2}}{2\\sigma^{2}}\\right)+C',
  'logistic-growth':        'y = \\dfrac{L}{1+e^{-k(x-x_{0})}}',
  'michaelis-menten':       'y = \\dfrac{V_{\\!\\max}x}{K_{m}+x}',
  'damped-oscillation':     'y = A\\,e^{-\\gamma x}\\sin(\\omega x+\\varphi)',
  'linear-calibration':     'y = mx+b',
  'hill-equation':          'y = \\dfrac{V_{\\!\\max}x^{n}}{K_{d}^{n}+x^{n}}',
  'power-law':              'y = ax^{b}',
  'lorentzian-peak':        'y = \\dfrac{A\\gamma^{2}}{(x-x_{0})^{2}+\\gamma^{2}}+C',
  'weibull-survival':       'y = 1-\\exp\\!\\left(-(x/\\lambda)^{k}\\right)',
  'polynomial-calibration': 'y = a_{3}x^{3}+a_{2}x^{2}+a_{1}x+a_{0}',
  'sinusoidal':             'y = A\\sin(\\omega x+\\varphi)+C',
  'gv-boltzmann':           'y = \\dfrac{A}{1+e^{-(V-V_{h})/k}}',
  'kir-iv':                 'y = \\dfrac{g(V-E_{K})}{1+e^{(V-V_{h})/k}}',
  'hhna-iv':                'm=\\dfrac{1}{1+e^{-(V-V_{m})/k_{m}}},\\;h=\\dfrac{1}{1+e^{(V-V_{h})/k_{h}}},\\;y=g\\,m^{3}h\\,(V-E_{\\mathrm{rev}})',
  'tau-voltage':            'y=\\tau_{\\max}\\exp\\!\\left(-\\dfrac{(V-V_{\\mathrm{peak}})^{2}}{2k^{2}}\\right)+\\tau_{\\min}',
  'elisa-4pl':              'y = D+\\dfrac{A-D}{1+(x/C)^{B}}',
  'gompertz-growth':        'y = A\\exp\\!\\left(-e^{-k(x-x_{0})}\\right)',
  'xrd-peak':               'L=\\dfrac{\\gamma^{2}}{(x-x_{0})^{2}+\\gamma^{2}},\\;G=e^{-(x-x_{0})^{2}\\!/2\\sigma^{2}},\\;y=A(\\eta L+(1-\\eta)G)+C',
  'fano-resonance':         'y=A\\dfrac{(q+\\varepsilon)^{2}}{1+\\varepsilon^{2}}+C,\\quad\\varepsilon=\\dfrac{x-x_{0}}{\\Gamma}',
  'oral-pk':                'y=\\dfrac{A_{\\!mp}\\,k_{a}}{k_{a}-k_{e}}\\!\\left(e^{-k_{e}t}-e^{-k_{a}t}\\right)',
  'polymer-kww':            'y=A\\exp\\!\\left(-(t/\\tau)^{\\beta}\\right)+C',
  'langevin-mh':            'y=A\\!\\left(\\coth(BH)-\\dfrac{1}{BH}\\right)',
  'stern-volmer':           'y=\\dfrac{F_{0}}{(1+K_{D}[Q])(1+K_{S}[Q])}',
  'vant-hoff':              'y=\\exp\\!\\left(\\dfrac{\\Delta S}{R}-\\dfrac{\\Delta H}{RT}\\right)',
  'stress-strain':          '\\varepsilon=\\dfrac{\\sigma}{E}+\\left(\\dfrac{\\sigma}{K}\\right)^{\\!1/n}',
  'two-compartment-pk':     'C=A\\,e^{-\\alpha t}+B\\,e^{-\\beta t}',
  'pk-lag':                 'C=\\dfrac{A_{mp}\\,k_{a}}{k_{a}-k_{e}}\\!\\left(e^{-k_{e}(t-t_{lag})}-e^{-k_{a}(t-t_{lag})}\\right)',
  'substrate-inhibition':   'v=\\dfrac{V_{\\!\\max}[S]}{K_{m}+[S]+[S]^{2}/K_{i}}',
  'adsorption-isotherm':    'q=\\dfrac{q_{m}K_{L}C}{1+K_{L}C}\\;\\text{(Langmuir preset)}',
  'viscosity-flow':         '\\eta=\\eta_{\\infty}+(\\eta_{0}-\\eta_{\\infty})\\left[1+(\\lambda\\dot{\\gamma})^{2}\\right]^{(n-1)/2}\\;\\text{(Carreau preset)}',
  'spectral-peak':          'y=\\tfrac{A}{2}\\exp\\!\\left(\\tfrac{\\sigma^{2}}{2\\tau^{2}}-\\tfrac{x-\\mu}{\\tau}\\right)\\mathrm{erfc}\\!\\left(\\tfrac{\\sigma/\\tau-(x-\\mu)/\\sigma}{\\sqrt{2}}\\right)+C\\;\\text{(EMG preset)}',
  'thermal-kinetics':       'k=A\\,\\exp\\!\\left(-E_{a}/(R\\,T)\\right)\\;\\text{(Arrhenius preset)}',
  'sigmoid-activation':     'y=\\tfrac{A}{2}\\!\\left[1+\\mathrm{erf}\\!\\left(k(x-x_{0})\\right)\\right]+C\\;\\text{(Erf-Sigmoid preset)}',
  'erf-diffusion':          'C=A\\,\\mathrm{erf}\\!\\left(\\dfrac{x-\\mu}{w}\\right)+B',
  'dose-response-replicates': 'y = D+\\dfrac{A-D}{1+(x/C)^{B}}\\quad(\\pm\\,\\sigma\\text{ from replicates})',
};

function generateExample(key, overrides) {
  const ex = EXAMPLES[key];
  if (!ex) return null;
  const p = {};
  ex.params.forEach(d => { p[d.key] = d.value; });
  if (overrides) Object.assign(p, overrides);
  // Round integer params
  ex.params.forEach(d => { if (d.step === 1) p[d.key] = Math.round(p[d.key]); });
  return ex.generate(p);
}
