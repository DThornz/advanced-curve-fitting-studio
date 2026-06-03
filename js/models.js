// Models library: MODELS object with all built-in model definitions, MODEL_EQ_JS, MODEL_EQ
/* ═══════════════════════════════════════════════════════════
   MODELS LIBRARY
═══════════════════════════════════════════════════════════ */

// Abramowitz & Stegun 7.1.26 — max |err| < 1.5e-7; used by EMG, Asymmetric-Gaussian, Erf-Diffusion, Erf-Sigmoid
function _erf(z) {
  const t = 1 / (1 + 0.3275911 * Math.abs(z));
  const p = t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
  return Math.sign(z) * (1 - p * Math.exp(-z * z));
}
function _erfc(z) { return 1 - _erf(z); }
// Scaled complementary error function erfcx(x)=exp(x²)·erfc(x) for x≥0 (Numerical
// Recipes rational, |rel err| < 1.1e-7). Used by the numerically-stable EMG so the
// peak tails don't suffer exp(·)·erfc(·) cancellation.
function _erfcx(x) {
  const t = 1 / (1 + 0.5 * x);
  return t * Math.exp(-1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 +
    t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 +
    t * (-0.82215223 + t * 0.17087277)))))))));
}

const MODELS = {
  'Linear': {
    params: ['a', 'b'],
    fn: (x, [a, b]) => a * x + b,
    analytic: false,
    autoInit(x, y) {
      const xm = mean(x), ym = mean(y);
      const a = x.reduce((s, xi, i) => s + (xi - xm) * (y[i] - ym), 0) /
                (x.reduce((s, xi) => s + (xi - xm) ** 2, 0) || 1);
      return [a, ym - a * xm];
    }
  },
  'Power': {
    params: ['a', 'b'],
    fn: (x, [a, b]) => a * Math.pow(Math.abs(x) + 1e-12, b),
    analytic: false,
    autoInit(x, y) {
      // Log-linear regression on positive pairs: ln(y) = ln(a) + b*ln(x)
      const pairs = x.map((xi, i) => [xi, y[i]]).filter(([xi, yi]) => xi > 0 && yi > 0);
      if (pairs.length < 2) return [Math.abs(mean(y)) || 1, 1];
      const lx = pairs.map(([xi]) => Math.log(xi));
      const ly = pairs.map(([, yi]) => Math.log(yi));
      const xlm = mean(lx), ylm = mean(ly);
      const denom = lx.reduce((s, lxi) => s + (lxi - xlm) ** 2, 0) || 1;
      const b = lx.reduce((s, lxi, i) => s + (lxi - xlm) * (ly[i] - ylm), 0) / denom;
      const a = Math.exp(ylm - b * xlm);
      return [isFinite(a) ? a : 1, isFinite(b) ? b : 1];
    }
  },
  'Polynomial-2': { params: ['c₂','c₁','c₀'], analytic: true, degree: 2 },
  'Polynomial-3': { params: ['c₃','c₂','c₁','c₀'], analytic: true, degree: 3 },
  'Polynomial-4': { params: ['c₄','c₃','c₂','c₁','c₀'], analytic: true, degree: 4 },
  'Polynomial-5': { params: ['c₅','c₄','c₃','c₂','c₁','c₀'], analytic: true, degree: 5 },
  'Polynomial-6': { params: ['c₆','c₅','c₄','c₃','c₂','c₁','c₀'], analytic: true, degree: 6 },
  'Exponential': {
    params: ['a', 'b'],
    fn: (x, [a, b]) => a * Math.exp(b * x),
    analytic: false,
    autoInit(x, y) {
      const pos = y.filter(v => v > 0);
      if (pos.length < 2) return [arrMax(y.map(Math.abs)) || 1, -0.1];
      const lny = pos.map(Math.log);
      const posX = x.filter((_, i) => y[i] > 0);
      const xm = mean(posX), lym = mean(lny);
      const b = posX.reduce((s, xi, i) => s + (xi - xm) * (lny[i] - lym), 0) /
                (posX.reduce((s, xi) => s + (xi - xm) ** 2, 0) || 1);
      return [Math.exp(lym - b * xm), b];
    }
  },
  'Exp-Decay-Offset': {
    params: ['a', 'b', 'c'],
    fn: (x, [a, b, c]) => a * Math.exp(-b * x) + c,
    analytic: false,
    autoInit(x, y) {
      const c = arrMin(y);
      const shifted = y.map(v => Math.max(v - c, 1e-10));
      const lny = shifted.map(Math.log);
      const xm = mean(x), lym = mean(lny);
      const b = Math.abs(x.reduce((s, xi, i) => s + (xi - xm) * (lny[i] - lym), 0) /
                (x.reduce((s, xi) => s + (xi - xm) ** 2, 0) || 1)) || 0.1;
      return [Math.exp(mean(lny) + b * xm), b, c];
    }
  },
  'Logistic': {
    params: ['L', 'k', 'x₀'],
    fn: (x, [L, k, x0]) => L / (1 + Math.exp(-k * (x - x0))),
    analytic: false,
    autoInit(x, y) {
      const L = arrMax(y) * 1.05;
      const half = L / 2;
      const idx = y.reduce((b, yi, i) => Math.abs(yi - half) < Math.abs(y[b] - half) ? i : b, 0);
      const x0 = x[idx];
      // Estimate k from local slope at midpoint: dy/dx|x0 ≈ L*k/4
      const i1 = Math.max(idx - 2, 0), i2 = Math.min(idx + 2, x.length - 1);
      const slope = i2 > i1 ? (y[i2] - y[i1]) / (x[i2] - x[i1] || 1) : 1;
      const k = Math.max(4 * slope / L, 0.01);
      return [L, k, x0];
    }
  },
  'Gaussian': {
    params: ['A', 'μ', 'σ', 'C'],
    fn: (x, [A, mu, sig, C]) => A * Math.exp(-0.5 * ((x - mu) / (sig || 1e-10)) ** 2) + C,
    analytic: false,
    autoInit(x, y) {
      // Robust baseline: mean of bottom 25% avoids peak bias
      const sortedY = y.slice().sort((a, b) => a - b);
      const nBase = Math.max(2, Math.ceil(y.length * 0.25));
      const C = sortedY.slice(0, nBase).reduce((s, v) => s + v, 0) / nBase;
      const shifted = y.map(v => v - C);
      const maxI = shifted.indexOf(arrMax(shifted));
      const mu = x[maxI];
      const A = Math.max(shifted[maxI], 1e-6);
      const halfAmp = A / 2;
      let half = -1;
      for (let i = 0; i < maxI; i++) { if (shifted[i] >= halfAmp) { half = i; break; } }
      const xRange = arrMax(x) - arrMin(x);
      const sig = half >= 0 ? Math.max(Math.abs(x[half] - mu) / 1.177, xRange / 10) : xRange / 6;
      return [A, mu, sig, C];
    }
  },
  'Lorentzian': {
    params: ['A', 'x₀', 'γ', 'C'],
    fn: (x, [A, x0, g, C]) => A * g * g / ((x - x0) ** 2 + g * g) + C,
    analytic: false,
    autoInit(x, y) {
      const sortedY = y.slice().sort((a, b) => a - b);
      const nBase = Math.max(2, Math.ceil(y.length * 0.25));
      const C = sortedY.slice(0, nBase).reduce((s, v) => s + v, 0) / nBase;
      const shifted = y.map(v => v - C);
      const maxI = shifted.indexOf(arrMax(shifted));
      const A = Math.max(shifted[maxI], 1e-6);
      const x0 = x[maxI];
      // HWHM estimate from left side of peak
      const halfAmp = A / 2;
      let half = -1;
      for (let i = 0; i < maxI; i++) { if (shifted[i] >= halfAmp) { half = i; break; } }
      const xRange = arrMax(x) - arrMin(x);
      const g = half >= 0 ? Math.max(Math.abs(x[half] - x0), xRange / 10) : xRange / 8;
      return [A, x0, g, C];
    }
  },
  'Michaelis-Menten': {
    params: ['Vmax', 'Km'],
    fn: (x, [Vm, Km]) => Vm * x / ((Km || 1e-10) + x),
    analytic: false,
    autoInit(x, y) {
      const Vmax = arrMax(y) * 1.5;
      const half = arrMax(y) / 2;
      const idx = y.reduce((b, yi, i) => Math.abs(yi - half) < Math.abs(y[b] - half) ? i : b, 0);
      return [Vmax, Math.max(x[idx], 1e-6)];
    }
  },
  'Hill': {
    params: ['Vmax', 'Kd', 'n'],
    fn: (x, [Vmax, Kd, n]) => Vmax * Math.pow(x, n) / (Math.pow(Math.abs(Kd), n) + Math.pow(x, n)),
    analytic: false,
    autoInit(x, y) {
      const Vmax = arrMax(y) * 1.2;
      const half = arrMax(y) / 2;
      const idx = y.reduce((b, yi, i) => Math.abs(yi - half) < Math.abs(y[b] - half) ? i : b, 0);
      return [Vmax, Math.max(x[idx], 1e-6), 1.5];
    }
  },
  'Sine': {
    params: ['A', 'ω', 'φ', 'C'],
    fn: (x, [A, w, phi, C]) => A * Math.sin(w * x + phi) + C,
    analytic: false,
    autoInit(x, y) {
      const C = (arrMax(y) + arrMin(y)) / 2;
      const A = (arrMax(y) - arrMin(y)) / 2;
      const centered = y.map(v => v - C);
      // Count zero crossings to estimate frequency
      let zc = 0;
      for (let i = 1; i < centered.length; i++) { if (centered[i - 1] * centered[i] < 0) zc++; }
      const xRange = arrMax(x) - arrMin(x);
      const omega = zc > 1 ? Math.PI * zc / xRange : 2 * Math.PI / Math.max(xRange, 1e-10);
      return [A, omega, 0, C];
    }
  },
  'Damped-Sine': {
    params: ['A', 'γ', 'ω', 'φ', 'C'],
    fn: (x, [A, g, w, phi, C]) => A * Math.exp(-g * x) * Math.sin(w * x + phi) + C,
    analytic: false,
    autoInit(x, y) {
      const C = mean(y);
      const centered = y.map(v => v - C);
      const A = arrMax(centered.map(Math.abs)) || 1;
      let zc = 0;
      for (let i = 1; i < centered.length; i++) { if (centered[i - 1] * centered[i] < 0) zc++; }
      const xRange = arrMax(x) - arrMin(x);
      const omega = zc > 1 ? Math.PI * zc / xRange : 4 * Math.PI / Math.max(xRange, 1e-10);
      // Estimate damping from ratio of early vs late peak amplitudes
      const q = Math.ceil(y.length / 4);
      const earlyAmp = arrMax(centered.slice(0, q).map(Math.abs)) || A;
      const lateAmp  = arrMax(centered.slice(y.length - q).map(Math.abs)) || 0.01;
      const gamma = earlyAmp > lateAmp ? Math.log(earlyAmp / lateAmp) / (xRange * 0.75) : 0.1;
      return [A, Math.max(gamma, 0.01), omega, 0, C];
    }
  },
  'Weibull': {
    params: ['λ', 'k'],
    fn: (x, [lam, k]) => 1 - Math.exp(-Math.pow(Math.max(x, 1e-12) / (lam || 1e-10), k)),
    analytic: false,
    autoInit(x, y) {
      // λ ≈ x where F ≈ 0.632 (= 1−1/e, the Weibull scale characteristic)
      const idx = y.reduce((b, yi, i) => Math.abs(yi - 0.632) < Math.abs(y[b] - 0.632) ? i : b, 0);
      const lam = Math.max(x[idx], x[0], 1e-6);
      // Log-log linearisation: ln(−ln(1−F)) = k·ln(x) − k·ln(λ) → slope = k
      const valid = x.map((xi, i) => [xi, y[i]]).filter(([xi, yi]) => xi > 0 && yi > 0 && yi < 1);
      let k = 2;
      if (valid.length >= 3) {
        const lx = valid.map(([xi]) => Math.log(xi));
        const ly = valid.map(([, yi]) => Math.log(-Math.log(1 - yi)));
        const xlm = mean(lx), ylm = mean(ly);
        const kEst = lx.reduce((s, lxi, i) => s + (lxi - xlm) * (ly[i] - ylm), 0) /
                     (lx.reduce((s, lxi) => s + (lxi - xlm) ** 2, 0) || 1);
        if (isFinite(kEst) && kEst > 0.1) k = Math.min(kEst, 20);
      }
      return [lam, k];
    }
  },
  'Boltzmann': {
    params: ['A', 'Vh', 'k'],
    fn: (x, [A, Vh, k]) => A / (1 + Math.exp(-(x - Vh) / (k || 1e-10))),
    analytic: false,
    autoInit(x, y) {
      const yf = y.filter(isFinite);
      const A = arrMax(yf);
      const half = A / 2;
      const idx = y.reduce((b, yi, i) => Math.abs(yi - half) < Math.abs(y[b] - half) ? i : b, 0);
      return [isFinite(A) ? A : 1, x[idx], 10];
    }
  },
  'Double-Boltzmann': {
    params: ['A1', 'Vh1', 'k1', 'A2', 'Vh2', 'k2'],
    fn: (x, [A1, Vh1, k1, A2, Vh2, k2]) =>
      A1 / (1 + Math.exp(-(x - Vh1) / (k1 || 1e-10))) +
      A2 / (1 + Math.exp(-(x - Vh2) / (k2 || 1e-10))),
    analytic: false,
    autoInit(x, y) {
      const yf = y.filter(isFinite);
      const A = arrMax(yf);
      const q1 = A * 0.25, q3 = A * 0.75;
      const idx1 = y.reduce((b, yi, i) => Math.abs(yi - q1) < Math.abs(y[b] - q1) ? i : b, 0);
      const idx2 = y.reduce((b, yi, i) => Math.abs(yi - q3) < Math.abs(y[b] - q3) ? i : b, 0);
      return [isFinite(A) ? A * 0.6 : 1, x[idx1], 8, isFinite(A) ? A * 0.4 : 0.5, x[idx2], 8];
    }
  },
  'HH-Activation': {
    params: ['g', 'Vm', 'km', 'p', 'Erev'],
    fn: (x, [g, Vm, km, p, Erev]) => {
      const m = 1 / (1 + Math.exp(-(x - Vm) / (km || 1e-10)));
      return g * Math.pow(Math.max(m, 1e-12), p) * (x - Erev);
    },
    analytic: false,
    autoInit(x, y) {
      let Erev = x[Math.floor(x.length / 2)];
      for (let i = 0; i < x.length - 1; i++) {
        if (y[i] * y[i + 1] <= 0) {
          Erev = x[i] + (x[i + 1] - x[i]) * Math.abs(y[i]) / (Math.abs(y[i]) + Math.abs(y[i + 1]));
          break;
        }
      }
      const maxAbs = arrMax(y.map(Math.abs).filter(isFinite));
      const Vm = x[Math.floor(x.length * 0.3)];
      return [isFinite(maxAbs) ? maxAbs / 50 : 1, Vm, 10, 2, Erev];
    }
  },
  'HH-Na-IV': {
    params: ['g', 'Vm', 'km', 'Vh', 'kh', 'Erev'],
    fn: (x, [g, Vm, km, Vh, kh, Erev]) => {
      const m = 1 / (1 + Math.exp(-(x - Vm) / (km || 1e-10)));
      const h = 1 / (1 + Math.exp((x - Vh) / (kh || 1e-10)));
      return g * m * m * m * h * (x - Erev);
    },
    analytic: false,
    autoInit(x, y) {
      let Erev = x[Math.floor(x.length * 0.75)];
      for (let i = 0; i < x.length - 1; i++) {
        if (y[i] * y[i + 1] <= 0) {
          Erev = x[i] + (x[i + 1] - x[i]) * Math.abs(y[i]) / (Math.abs(y[i]) + Math.abs(y[i + 1]));
          break;
        }
      }
      const xRng = x[x.length - 1] - x[0];
      const Vm = x[0] + xRng * 0.35;
      const Vh = x[0] + xRng * 0.6;
      const maxAbs = arrMax(y.map(Math.abs).filter(isFinite));
      return [isFinite(maxAbs) ? maxAbs / 80 : 0.5, Vm, 7, Vh, 7, Erev];
    }
  },
  'Kir': {
    params: ['g', 'EK', 'Vh', 'k'],
    fn: (x, [g, EK, Vh, k]) => g * (x - EK) / (1 + Math.exp((x - Vh) / (k || 1e-10))),
    analytic: false,
    autoInit(x, y) {
      let EK = x[Math.floor(x.length / 2)];
      for (let i = 0; i < x.length - 1; i++) {
        if (y[i] * y[i + 1] <= 0) {
          EK = x[i] + (x[i + 1] - x[i]) * Math.abs(y[i]) / (Math.abs(y[i]) + Math.abs(y[i + 1]));
          break;
        }
      }
      const maxAbs = arrMax(y.map(Math.abs).filter(isFinite));
      return [isFinite(maxAbs) ? maxAbs / 50 : 0.5, EK, EK - 20, 10];
    }
  },
  'GHK': {
    params: ['A', 'r', 'Vt'],
    fn: (x, [A, r, Vt]) => {
      const vt = Vt || 25.7;
      if (Math.abs(x) < 1e-6) return A * vt * (1 - r);
      return A * x * (1 - r * Math.exp(-x / vt)) / (1 - Math.exp(-x / vt));
    },
    analytic: false,
    autoInit(x, y) {
      const maxAbs = arrMax(y.map(Math.abs).filter(isFinite));
      return [isFinite(maxAbs) ? maxAbs / 80 : 0.5, 0.1, 25.7];
    }
  },
  'Tau-Gaussian': {
    params: ['tau_max', 'Vpeak', 'k', 'tau_min'],
    fn: (x, [tau_max, Vpeak, k, tau_min]) =>
      tau_max * Math.exp(-0.5 * ((x - Vpeak) / (k || 1e-10)) ** 2) + tau_min,
    analytic: false,
    autoInit(x, y) {
      const yf = y.filter(isFinite);
      const tau_min = Math.max(arrMin(yf), 0);
      const tau_max = arrMax(yf) - tau_min;
      const imax = y.indexOf(arrMax(yf));
      const Vpeak = x[imax >= 0 ? imax : Math.floor(x.length / 2)];
      const xRng = (x[x.length - 1] - x[0]) / 4;
      return [isFinite(tau_max) ? tau_max : 1, Vpeak, xRng, tau_min];
    }
  },
  'Double-Gaussian': {
    params: ['A1', 'μ1', 'σ1', 'A2', 'μ2', 'σ2', 'C'],
    fn: (x, [A1, m1, s1, A2, m2, s2, C]) =>
      A1 * Math.exp(-0.5 * ((x - m1) / (s1 || 1e-10)) ** 2) +
      A2 * Math.exp(-0.5 * ((x - m2) / (s2 || 1e-10)) ** 2) + C,
    analytic: false,
    autoInit(x, y) {
      const sortedY = y.slice().sort((a, b) => a - b);
      const nBase = Math.max(2, Math.ceil(y.length * 0.25));
      const C = sortedY.slice(0, nBase).reduce((s, v) => s + v, 0) / nBase;
      const shifted = y.map(v => v - C);
      const peak1 = arrMax(shifted);
      const imax1 = shifted.indexOf(peak1);
      const mu1 = x[imax1] ?? x[Math.floor(x.length / 2)];
      const A1 = Math.max(peak1, 1e-6);
      const xRange = arrMax(x) - arrMin(x);
      const sig = xRange / 8 || 1;
      const masked = shifted.map((v, i) => Math.abs(x[i] - mu1) > sig * 2 ? v : -Infinity);
      const peak2 = arrMax(masked);
      const imax2 = masked.indexOf(peak2);
      const mu2 = imax2 >= 0 && peak2 > -Infinity ? x[imax2] : (mu1 + xRange / 3);
      const A2 = Math.max(peak2 > 0 ? peak2 : A1 * 0.5, 1e-6);
      return [A1 * 0.8, mu1, sig, A2 * 0.8, mu2, sig, C];
    }
  },
  'Biexponential': {
    params: ['A1', 'b1', 'A2', 'b2', 'C'],
    fn: (x, [A1, b1, A2, b2, C]) =>
      A1 * Math.exp(-Math.abs(b1) * x) + A2 * Math.exp(-Math.abs(b2) * x) + C,
    analytic: false,
    autoInit(x, y) {
      const C = arrMin(y);
      const range = arrMax(y) - C;
      const xRange = Math.max(arrMax(x) - arrMin(x), 1e-10);
      return [range * 0.7, 2 / xRange, range * 0.3, 0.3 / xRange, C];
    }
  },
  'Rational': {
    params: ['a', 'b', 'c'],
    fn: (x, [a, b, c]) => (a + b * x) / Math.max(1 + c * x, 1e-10),
    analytic: false,
    autoInit(x, y) {
      const ym = y.reduce((s, v) => s + v, 0) / y.length;
      const xm = x.reduce((s, v) => s + v, 0) / x.length;
      return [ym, 0, 1 / Math.max(Math.abs(xm), 1)];
    }
  },
  'Power-Offset': {
    params: ['a', 'b', 'c'],
    fn: (x, [a, b, c]) => a * Math.pow(Math.abs(x) + 1e-12, b) + c,
    analytic: false,
    autoInit(x, y) {
      const c = arrMin(y);
      const shifted = y.map(v => Math.max(v - c, 1e-10));
      const pairs = x.map((xi, i) => [xi, shifted[i]]).filter(([xi, yi]) => xi > 0 && yi > 0);
      if (pairs.length < 2) return [Math.abs(y.reduce((s, v) => s + v, 0) / y.length) || 1, 1, c];
      const lx = pairs.map(([xi]) => Math.log(xi));
      const ly = pairs.map(([, yi]) => Math.log(yi));
      const xlm = lx.reduce((s, v) => s + v, 0) / lx.length;
      const ylm = ly.reduce((s, v) => s + v, 0) / ly.length;
      const b = lx.reduce((s, lxi, i) => s + (lxi - xlm) * (ly[i] - ylm), 0) /
                (lx.reduce((s, lxi) => s + (lxi - xlm) ** 2, 0) || 1);
      const a = Math.exp(ylm - b * xlm);
      return [isFinite(a) ? a : 1, isFinite(b) ? b : 1, c];
    }
  },
  '4PL': {
    params: ['A', 'D', 'C', 'B'],
    fn: (x, [A, D, C, B]) => D + (A - D) / (1 + Math.pow(Math.max(x, 0) / Math.max(Math.abs(C), 1e-12), B)),
    analytic: false,
    autoInit(x, y) {
      const A = arrMax(y), D = arrMin(y);
      const mid = (A + D) / 2;
      const idx = y.reduce((b, yi, i) => Math.abs(yi - mid) < Math.abs(y[b] - mid) ? i : b, 0);
      const C = Math.max(x[idx], 1e-6);
      const i1 = Math.max(idx - 2, 0), i2 = Math.min(idx + 2, x.length - 1);
      const slope = (x[i2] > x[i1]) ? (y[i2] - y[i1]) / ((x[i2] - x[i1]) || 1) : 1;
      const B = Math.max(Math.abs(slope) * 4 * C / Math.max(Math.abs(A - D), 1e-10), 0.5);
      return [A, D, C, B];
    }
  },
  'Gompertz': {
    params: ['A', 'k', 'x0'],
    fn: (x, [A, k, x0]) => A * Math.exp(-Math.exp(-k * (x - x0))),
    analytic: false,
    autoInit(x, y) {
      const A = arrMax(y) * 1.05;
      const inflY = A * Math.exp(-1);
      const idx = y.reduce((b, yi, i) => Math.abs(yi - inflY) < Math.abs(y[b] - inflY) ? i : b, 0);
      const x0 = x[idx];
      const xRange = arrMax(x) - arrMin(x);
      return [isFinite(A) ? A : 1, 2 / Math.max(xRange, 1), x0];
    }
  },
  'Pseudo-Voigt': {
    params: ['A', 'x0', 'g', 's', 'eta', 'C'],
    fn: (x, [A, x0, g, s, eta, C]) => {
      const etaC = Math.max(0, Math.min(1, eta));
      const L = (g || 1e-10) ** 2 / ((x - x0) ** 2 + (g || 1e-10) ** 2);
      const G = Math.exp(-0.5 * ((x - x0) / (s || 1e-10)) ** 2);
      return A * (etaC * L + (1 - etaC) * G) + C;
    },
    analytic: false,
    autoInit(x, y) {
      const sortedY = y.slice().sort((a, b) => a - b);
      const nBase = Math.max(2, Math.ceil(y.length * 0.25));
      const C = sortedY.slice(0, nBase).reduce((s, v) => s + v, 0) / nBase;
      const shifted = y.map(v => v - C);
      const maxI = shifted.indexOf(arrMax(shifted));
      const A = Math.max(shifted[maxI], 1e-6), x0 = x[maxI];
      const xRange = arrMax(x) - arrMin(x);
      const fwhm = xRange / 6 || 1;
      const g = fwhm / 2;
      const s = fwhm / 2.355;
      return [A, x0, g, s, 0.5, C];
    }
  },
  'Fano': {
    params: ['A', 'x0', 'G', 'q', 'C'],
    fn: (x, [A, x0, G, q, C]) => {
      const eps = (x - x0) / (G || 1e-10);
      return A * (q + eps) ** 2 / (1 + eps ** 2) + C;
    },
    analytic: false,
    autoInit(x, y) {
      const sortedY = y.slice().sort((a, b) => a - b);
      const nBase = Math.max(2, Math.ceil(y.length * 0.25));
      const C = sortedY.slice(0, nBase).reduce((s, v) => s + v, 0) / nBase;
      const shifted = y.map(v => v - C);
      const maxI = shifted.indexOf(arrMax(shifted));
      const A = Math.max(shifted[maxI], 1e-6), x0 = x[maxI];
      const xRange = arrMax(x) - arrMin(x);
      return [A, x0, xRange / 10 || 1, 1, C];
    }
  },
  'Oral-PK': {
    params: ['Amp', 'ka', 'ke'],
    fn: (x, [Amp, ka, ke]) => {
      if (x <= 0) return 0;
      if (Math.abs(ka - ke) < 1e-6 * (Math.abs(ka) + Math.abs(ke) + 1))
        return Amp * ka * x * Math.exp(-ka * x);
      return Amp * ka / (ka - ke) * (Math.exp(-ke * x) - Math.exp(-ka * x));
    },
    analytic: false,
    autoInit(x, y) {
      const peakI = y.indexOf(arrMax(y));
      const tmax = x[peakI] || (x[x.length - 1] - x[0]) * 0.3;
      const ka = 3 / Math.max(tmax, 1e-6), ke = ka / 10;
      const predPeak = ka / (ka - ke) * (Math.exp(-ke * tmax) - Math.exp(-ka * tmax));
      const Amp = arrMax(y) / Math.max(predPeak, 1e-10);
      return [isFinite(Amp) ? Amp : 1, ka, ke];
    }
  },
  'KWW': {
    params: ['A', 'tau', 'beta', 'C'],
    fn: (x, [A, tau, beta, C]) =>
      A * Math.exp(-Math.pow(Math.max(x, 0) / Math.max(tau, 1e-12), Math.max(beta, 1e-6))) + C,
    analytic: false,
    autoInit(x, y) {
      const C = arrMin(y);
      const A = Math.max(arrMax(y) - C, 1e-6);
      const target = A * Math.exp(-1) + C;
      const idx = y.reduce((b, yi, i) => Math.abs(yi - target) < Math.abs(y[b] - target) ? i : b, 0);
      const tau = Math.max(x[idx] - x[0], (x[x.length - 1] - x[0]) / 3, 1e-6);
      return [A, tau, 0.7, C];
    }
  },
  'Langevin': {
    params: ['A', 'B'],
    fn: (x, [A, B]) => {
      const u = B * x;
      if (Math.abs(u) < 1e-6) return A * u / 3;
      return A * (1 / Math.tanh(u) - 1 / u);
    },
    analytic: false,
    autoInit(x, y) {
      const A = arrMax(y.filter(isFinite)) * 1.05;
      const half = A / 2;
      const idx = y.reduce((b, yi, i) => Math.abs(yi - half) < Math.abs(y[b] - half) ? i : b, 0);
      const B = 1.6 / Math.max(Math.abs(x[idx]), 1e-6);
      return [isFinite(A) ? A : 1, isFinite(B) ? B : 1];
    }
  },
  'Stern-Volmer': {
    params: ['F0', 'KD', 'KS'],
    fn: (x, [F0, KD, KS]) =>
      F0 / (Math.max(1 + KD * x, 1e-10) * Math.max(1 + KS * x, 1e-10)),
    analytic: false,
    autoInit(x, y) {
      const F0 = arrMax(y.filter(isFinite));
      const xm = mean(x);
      const ratio = y.map(yi => Math.max(F0 / Math.max(yi, 1e-10) - 1, 0));
      const rm = mean(ratio);
      const Ksv = Math.max(x.reduce((s, xi, i) => s + (xi - xm) * (ratio[i] - rm), 0) /
                  Math.max(x.reduce((s, xi) => s + (xi - xm) ** 2, 0), 1e-10), 0.01);
      return [isFinite(F0) ? F0 : 1, Ksv * 0.6, Ksv * 0.4];
    }
  },
  'Van-t-Hoff': {
    params: ['dHR', 'dSR'],
    fn: (x, [dHR, dSR]) => Math.exp(dSR - dHR / Math.max(x, 1e-6)),
    analytic: false,
    autoInit(x, y) {
      const valid = x.map((xi, i) => [xi, y[i]]).filter(([xi, yi]) => xi > 0 && yi > 0);
      if (valid.length < 2) return [-5000, 10];
      const inv = valid.map(([xi]) => 1 / xi);
      const lny = valid.map(([, yi]) => Math.log(yi));
      const invm = mean(inv), lnym = mean(lny);
      const dHR = -inv.reduce((s, v, i) => s + (v - invm) * (lny[i] - lnym), 0) /
                  Math.max(inv.reduce((s, v) => s + (v - invm) ** 2, 0), 1e-15);
      const dSR = lnym + dHR * invm;
      return [isFinite(dHR) ? dHR : -5000, isFinite(dSR) ? dSR : 10];
    }
  },
  'Ramberg-Osgood': {
    params: ['E', 'K', 'n'],
    fn: (x, [E, K, n]) => {
      const elastic = x / Math.max(E, 1e-12);
      const plastic = Math.sign(x) * Math.pow(Math.abs(x) / Math.max(K, 1e-12), 1 / Math.max(n, 1e-6));
      return elastic + plastic;
    },
    analytic: false,
    autoInit(x, y) {
      const nLin = Math.max(2, Math.ceil(x.length * 0.2));
      const xL = x.slice(0, nLin), yL = y.slice(0, nLin);
      const xmL = mean(xL), ymL = mean(yL);
      const slope = xL.reduce((s, xi, i) => s + (xi - xmL) * (yL[i] - ymL), 0) /
                    Math.max(xL.reduce((s, xi) => s + (xi - xmL) ** 2, 0), 1e-15);
      const E = (slope > 1e-10) ? Math.min(1 / slope, 1e9) : 200000;
      const xMax = arrMax(x.filter(isFinite));
      return [isFinite(E) ? E : 200000, xMax * 0.5 || 250, 5];
    }
  },
  // ── Pharmacokinetics ─────────────────────────────────────
  'Two-Compartment-PK': {
    params: ['A', 'α', 'B', 'β'],
    fn: (x, [A, alpha, B, beta]) =>
      A * Math.exp(-Math.abs(alpha) * x) + B * Math.exp(-Math.abs(beta) * x),
    analytic: false,
    autoInit(x, y) {
      const range = arrMax(y) - arrMin(y);
      const xRange = Math.max(arrMax(x) - arrMin(x), 1e-10);
      return [range * 0.7, 3 / xRange, range * 0.3, 0.3 / xRange];
    }
  },
  'PK-Lag': {
    params: ['Amp', 'ka', 'ke', 'tlag'],
    fn: (x, [Amp, ka, ke, tlag]) => {
      const t = x - tlag;
      if (t <= 0) return 0;
      if (Math.abs(ka - ke) < 1e-6 * (Math.abs(ka) + Math.abs(ke) + 1))
        return Amp * ka * t * Math.exp(-ka * t);
      return Amp * ka / (ka - ke) * (Math.exp(-ke * t) - Math.exp(-ka * t));
    },
    analytic: false,
    autoInit(x, y) {
      const peakI = y.indexOf(arrMax(y));
      const tmax = x[peakI] || (x[x.length - 1] - x[0]) * 0.4;
      const tlag = tmax * 0.15;
      const ka = 3 / Math.max(tmax - tlag, 1e-6);
      const ke = ka / 8;
      const tEff = tmax - tlag;
      const predPeak = ka / (ka - ke) * (Math.exp(-ke * tEff) - Math.exp(-ka * tEff));
      const Amp = arrMax(y) / Math.max(predPeak, 1e-10);
      return [isFinite(Amp) ? Amp : 1, ka, ke, Math.max(tlag, 0)];
    }
  },
  // ── Enzyme Kinetics (extended) ───────────────────────────
  'Substrate-Inhibition': {
    params: ['Vmax', 'Km', 'Ki'],
    fn: (x, [Vmax, Km, Ki]) =>
      Vmax * x / (Km + x + x * x / Math.max(Math.abs(Ki), 1e-10)),
    analytic: false,
    autoInit(x, y) {
      const peakI = y.indexOf(arrMax(y));
      const Sopt = Math.max(x[peakI], 1e-6);
      const vPeak = y[peakI];
      const Km = Sopt / 4;
      const Ki = Sopt * 4;
      const Vmax = vPeak * (Km + Sopt + Sopt * Sopt / Ki) / Sopt;
      return [isFinite(Vmax) ? Vmax : arrMax(y) * 2, Km, Ki];
    }
  },
  // ── Adsorption Isotherms ─────────────────────────────────
  'Langmuir': {
    params: ['qm', 'KL'],
    fn: (x, [qm, KL]) => qm * KL * x / (1 + KL * x),
    analytic: false,
    autoInit(x, y) {
      const qm = arrMax(y) * 1.5;
      const half = arrMax(y) / 2;
      const idx = y.reduce((b, yi, i) => Math.abs(yi - half) < Math.abs(y[b] - half) ? i : b, 0);
      const KL = 1 / Math.max(x[idx], 1e-6);
      return [qm, isFinite(KL) ? KL : 1];
    }
  },
  'Freundlich': {
    params: ['KF', 'n'],
    fn: (x, [KF, n]) => KF * Math.pow(Math.max(x, 1e-12), 1 / Math.max(Math.abs(n), 1e-6)),
    analytic: false,
    autoInit(x, y) {
      const pairs = x.map((xi, i) => [xi, y[i]]).filter(([xi, yi]) => xi > 0 && yi > 0);
      if (pairs.length < 2) return [mean(y.filter(v => v > 0)) || 1, 2];
      const lx = pairs.map(([xi]) => Math.log(xi));
      const ly = pairs.map(([, yi]) => Math.log(yi));
      const xlm = mean(lx), ylm = mean(ly);
      const slope = lx.reduce((s, lxi, i) => s + (lxi - xlm) * (ly[i] - ylm), 0) /
                    (lx.reduce((s, lxi) => s + (lxi - xlm) ** 2, 0) || 1);
      const KF = Math.exp(ylm - slope * xlm);
      const n = Math.max(1 / Math.max(slope, 0.01), 0.1);
      return [isFinite(KF) ? KF : 1, isFinite(n) ? n : 2];
    }
  },
  'Temkin': {
    params: ['AT', 'B'],
    fn: (x, [AT, B]) => B * Math.log(Math.max(Math.abs(AT) * Math.max(x, 1e-300), 1e-300)),
    analytic: false,
    autoInit(x, y) {
      const valid = x.map((xi, i) => [xi, y[i]]).filter(([xi]) => xi > 0);
      if (valid.length < 2) return [1, mean(y.filter(v => v > 0)) || 1];
      const lx = valid.map(([xi]) => Math.log(xi));
      const ly = valid.map(([, yi]) => yi);
      const xlm = mean(lx), ylm = mean(ly);
      const B = lx.reduce((s, lxi, i) => s + (lxi - xlm) * (ly[i] - ylm), 0) /
                (lx.reduce((s, lxi) => s + (lxi - xlm) ** 2, 0) || 1);
      const intercept = ylm - B * xlm;
      const AT = isFinite(B) && Math.abs(B) > 1e-10 ? Math.exp(intercept / B) : 1;
      return [isFinite(AT) && AT > 0 ? AT : 1, isFinite(B) ? B : 1];
    }
  },
  // ── Rheology ─────────────────────────────────────────────
  'Power-Law-Fluid': {
    params: ['K', 'n'],
    fn: (x, [K, n]) => K * Math.pow(Math.abs(x) + 1e-12, n - 1),
    analytic: false,
    autoInit(x, y) {
      const pairs = x.map((xi, i) => [xi, y[i]]).filter(([xi, yi]) => xi > 0 && yi > 0);
      if (pairs.length < 2) return [mean(y.filter(v => v > 0)) || 1, 0.5];
      const lx = pairs.map(([xi]) => Math.log(xi));
      const ly = pairs.map(([, yi]) => Math.log(yi));
      const xlm = mean(lx), ylm = mean(ly);
      const slope = lx.reduce((s, lxi, i) => s + (lxi - xlm) * (ly[i] - ylm), 0) /
                    (lx.reduce((s, lxi) => s + (lxi - xlm) ** 2, 0) || 1);
      const K = Math.exp(ylm - slope * xlm);
      return [isFinite(K) ? K : 1, isFinite(slope + 1) ? Math.max(slope + 1, 0.01) : 0.5];
    }
  },
  'Herschel-Bulkley': {
    params: ['τ₀', 'K', 'n'],
    fn: (x, [tau0, K, n]) => tau0 + K * Math.pow(Math.abs(x) + 1e-12, n),
    analytic: false,
    autoInit(x, y) {
      const yf = y.filter(v => isFinite(v));
      const tau0 = Math.max(arrMin(yf) * 0.5, 0);
      const shifted = y.map(v => Math.max(v - tau0, 1e-10));
      const pairs = x.map((xi, i) => [xi, shifted[i]]).filter(([xi]) => xi > 0);
      if (pairs.length < 2) return [tau0, arrMax(yf) * 0.5 || 1, 1];
      const lx = pairs.map(([xi]) => Math.log(xi));
      const ly = pairs.map(([, yi]) => Math.log(yi));
      const xlm = mean(lx), ylm = mean(ly);
      const n = lx.reduce((s, lxi, i) => s + (lxi - xlm) * (ly[i] - ylm), 0) /
                (lx.reduce((s, lxi) => s + (lxi - xlm) ** 2, 0) || 1);
      const K = Math.exp(ylm - n * xlm);
      return [tau0, isFinite(K) ? K : 1, isFinite(n) ? Math.max(n, 0.01) : 1];
    }
  },
  'Cross-Model': {
    params: ['η₀', 'η∞', 'K', 'm'],
    fn: (x, [eta0, etaInf, K, m]) =>
      etaInf + (eta0 - etaInf) / (1 + Math.pow(Math.abs(K * x), Math.abs(m))),
    analytic: false,
    autoInit(x, y) {
      const yf = y.filter(v => isFinite(v) && v > 0);
      const eta0 = arrMax(yf) || 1;
      const etaInf = arrMin(yf) * 0.5 || 0.001;
      const half = (eta0 + etaInf) / 2;
      const idx = y.reduce((b, yi, i) => Math.abs(yi - half) < Math.abs(y[b] - half) ? i : b, 0);
      const K = 1 / Math.max(x[idx], 1e-6);
      return [eta0, isFinite(etaInf) ? etaInf : 0.001, isFinite(K) ? K : 1, 1];
    }
  },
  // ── Peak / Spectral (extended) ───────────────────────────
  'EMG': {
    params: ['A', 'μ', 'σ', 'τ', 'C'],
    fn: (x, [A, mu, sig, tau, C]) => {
      const sg = Math.abs(sig) || 1e-10;
      const tk = Math.abs(tau) || 1e-10;
      const u = sg / tk;            // σ/τ
      const z = (x - mu) / sg;     // (x-μ)/σ
      const t = (u - z) * 0.7071067811865476; // (u-z)/√2
      // EMG = ½A·e^(−z²/2)·erfcx(t)+C (exact). Split at t=0 so erfcx stays in its
      // overflow-free domain; the t<0 branch is the algebraically-equal form.
      return (t >= 0
        ? 0.5 * A * Math.exp(-0.5 * z * z) * _erfcx(t)
        : A * Math.exp(0.5 * u * u - z * u) - 0.5 * A * Math.exp(-0.5 * z * z) * _erfcx(-t)) + C;
    },
    analytic: false,
    autoInit(x, y) {
      const sortedY = y.slice().sort((a, b) => a - b);
      const nBase = Math.max(2, Math.ceil(y.length * 0.2));
      const C = sortedY.slice(0, nBase).reduce((s, v) => s + v, 0) / nBase;
      const shifted = y.map(v => v - C);
      const peakI = shifted.indexOf(arrMax(shifted));
      const A = Math.max(shifted[peakI], 1e-6);
      const mu = x[peakI];
      const xRange = arrMax(x) - arrMin(x);
      const sig = xRange / (6 * 2.355) || 0.5;
      const tau = Math.max(sig * 0.6, 1e-6);
      return [A, mu, sig, tau, C];
    }
  },
  'Asymmetric-Gaussian': {
    params: ['A', 'μ', 'σ', 'α', 'C'],
    fn: (x, [A, mu, sig, alpha, C]) => {
      const sg = sig || 1e-10;
      const z = (x - mu) / sg;
      return A * Math.exp(-0.5 * z * z) * (1 + _erf(alpha * z * 0.7071067811865476)) + C;
    },
    analytic: false,
    autoInit(x, y) {
      const sortedY = y.slice().sort((a, b) => a - b);
      const nBase = Math.max(2, Math.ceil(y.length * 0.25));
      const C = sortedY.slice(0, nBase).reduce((s, v) => s + v, 0) / nBase;
      const shifted = y.map(v => v - C);
      const peakI = shifted.indexOf(arrMax(shifted));
      const A = Math.max(shifted[peakI], 1e-6);
      const mu = x[peakI];
      const xRange = arrMax(x) - arrMin(x);
      return [A, mu, xRange / 8 || 1, 0, C];
    }
  },
  'Voigt': {
    params: ['A', 'x0', 'fG', 'fL', 'C'],
    fn: (x, [A, x0, fG, fL, C]) => {
      const fGa = Math.abs(fG) || 1e-10, fLa = Math.abs(fL) || 1e-10;
      const fV5 = Math.pow(fGa, 5) + 2.69269 * Math.pow(fGa, 4) * fLa +
                  2.42843 * Math.pow(fGa, 3) * fLa * fLa +
                  4.47163 * fGa * fGa * Math.pow(fLa, 3) +
                  0.07842 * fGa * Math.pow(fLa, 4) + Math.pow(fLa, 5);
      const fV = Math.pow(Math.max(fV5, 1e-50), 0.2);
      const f = fLa / fV;
      const eta = Math.max(0, Math.min(1, 1.36603 * f - 0.47719 * f * f + 0.11116 * f * f * f));
      const dx = x - x0, hw = fV / 2;
      const L = hw * hw / (dx * dx + hw * hw);
      const G = Math.exp(-4 * Math.LN2 * dx * dx / (fV * fV));
      return A * (eta * L + (1 - eta) * G) + C;
    },
    analytic: false,
    autoInit(x, y) {
      const sortedY = y.slice().sort((a, b) => a - b);
      const nBase = Math.max(2, Math.ceil(y.length * 0.25));
      const C = sortedY.slice(0, nBase).reduce((s, v) => s + v, 0) / nBase;
      const shifted = y.map(v => v - C);
      const peakI = shifted.indexOf(arrMax(shifted));
      const A = Math.max(shifted[peakI], 1e-6), x0 = x[peakI];
      const xRange = arrMax(x) - arrMin(x);
      const fwhm = xRange / 6 || 1;
      return [A, x0, fwhm * 0.7, fwhm * 0.3, C];
    }
  },
  // ── Thermal / Kinetics ───────────────────────────────────
  'Arrhenius': {
    params: ['A', 'Ea_R'],
    fn: (x, [A, EaR]) => A * Math.exp(-EaR / Math.max(x, 1e-6)),
    analytic: false,
    autoInit(x, y) {
      const valid = x.map((xi, i) => [xi, y[i]]).filter(([xi, yi]) => xi > 0 && yi > 0);
      if (valid.length < 2) return [1e10, 5000];
      const inv = valid.map(([xi]) => 1 / xi);
      const lny = valid.map(([, yi]) => Math.log(yi));
      const invm = mean(inv), lnym = mean(lny);
      const EaR = -inv.reduce((s, v, i) => s + (v - invm) * (lny[i] - lnym), 0) /
                  Math.max(inv.reduce((s, v) => s + (v - invm) ** 2, 0), 1e-15);
      const lnA = lnym + EaR * invm;
      return [isFinite(lnA) ? Math.exp(lnA) : 1e10, isFinite(EaR) ? EaR : 5000];
    }
  },
  'Extended-Arrhenius': {
    params: ['A', 'n', 'Ea_R'],
    fn: (x, [A, n, EaR]) =>
      A * Math.pow(Math.max(x, 1e-12), n) * Math.exp(-EaR / Math.max(x, 1e-6)),
    analytic: false,
    autoInit(x, y) {
      const valid = x.map((xi, i) => [xi, y[i]]).filter(([xi, yi]) => xi > 0 && yi > 0);
      if (valid.length < 2) return [1, 1, 5000];
      const inv = valid.map(([xi]) => 1 / xi);
      const lny = valid.map(([, yi]) => Math.log(yi));
      const invm = mean(inv), lnym = mean(lny);
      const EaR = -inv.reduce((s, v, i) => s + (v - invm) * (lny[i] - lnym), 0) /
                  Math.max(inv.reduce((s, v) => s + (v - invm) ** 2, 0), 1e-15);
      const lnA = lnym + EaR * invm;
      return [isFinite(lnA) ? Math.exp(lnA) : 1, 1, isFinite(EaR) ? EaR : 5000];
    }
  },
  // ── Diffusion / Transport ────────────────────────────────
  'Erf-Diffusion': {
    params: ['A', 'μ', 'w', 'B'],
    fn: (x, [A, mu, w, B]) => A * _erf((x - mu) / Math.max(Math.abs(w), 1e-10)) + B,
    analytic: false,
    autoInit(x, y) {
      const A = (arrMax(y) - arrMin(y)) / 2;
      const B = (arrMax(y) + arrMin(y)) / 2;
      const xRange = arrMax(x) - arrMin(x);
      return [isFinite(A) ? A : 1, mean(x), xRange / 4 || 1, isFinite(B) ? B : 0];
    }
  },
  // ── Rheology (extended) ──────────────────────────────────
  'Carreau': {
    params: ['η₀', 'η∞', 'λ', 'n'],
    fn: (x, [eta0, etaInf, lam, n]) =>
      etaInf + (eta0 - etaInf) * Math.pow(1 + (lam * x) * (lam * x), (n - 1) / 2),
    analytic: false,
    autoInit(x, y) {
      const yf = y.filter(v => isFinite(v) && v > 0);
      const eta0 = arrMax(yf) || 1;
      const etaInf = arrMin(yf) * 0.5 || 0.001;
      const half = (eta0 + etaInf) / 2;
      const idx = y.reduce((b, yi, i) => Math.abs(yi - half) < Math.abs(y[b] - half) ? i : b, 0);
      return [eta0, isFinite(etaInf) ? etaInf : 0.001, 1 / Math.max(x[idx], 1e-6), 0.5];
    }
  },
  'Quemada': {
    params: ['η₀', 'η∞', 'γ̇c'],
    fn: (x, [eta0, etaInf, gdotc]) => {
      const k = Math.sqrt(Math.max(x, 0) / Math.max(Math.abs(gdotc), 1e-10));
      const num = Math.sqrt(Math.max(eta0, 0)) + Math.sqrt(Math.max(etaInf, 0)) * k;
      return (num / (1 + k)) ** 2;
    },
    analytic: false,
    autoInit(x, y) {
      const yf = y.filter(v => isFinite(v) && v > 0);
      const eta0 = arrMax(yf) || 1;
      const etaInf = arrMin(yf) * 0.5 || 0.001;
      const target = Math.sqrt(eta0 * etaInf);
      const idx = y.reduce((b, yi, i) => Math.abs(yi - target) < Math.abs(y[b] - target) ? i : b, 0);
      return [eta0, isFinite(etaInf) ? etaInf : 0.001, Math.max(x[idx], 1e-6)];
    }
  },
  // ── Activation Functions ─────────────────────────────────
  'Softplus': {
    params: ['A', 'k', 'x₀', 'C'],
    fn: (x, [A, k, x0, C]) => {
      const t = k * (x - x0);
      return A * (t > 20 ? t : Math.log(1 + Math.exp(t))) + C;
    },
    analytic: false,
    autoInit(x, y) {
      const yRange = arrMax(y) - arrMin(y);
      const A = yRange || 1;
      const C = arrMin(y);
      const half = A / 2 + C;
      const idx = y.reduce((b, yi, i) => Math.abs(yi - half) < Math.abs(y[b] - half) ? i : b, 0);
      const x0 = x[idx];
      const i1 = Math.max(idx - 3, 0), i2 = Math.min(idx + 3, x.length - 1);
      const slope = i2 > i1 ? (y[i2] - y[i1]) / ((x[i2] - x[i1]) || 1) : 1;
      const k = Math.max(Math.abs(slope) / Math.max(A, 1e-10), 0.1);
      return [A, k, x0, C];
    }
  },
  'Erf-Sigmoid': {
    params: ['A', 'k', 'x₀', 'C'],
    fn: (x, [A, k, x0, C]) => A * 0.5 * (1 + _erf(k * (x - x0))) + C,
    analytic: false,
    autoInit(x, y) {
      const A = (arrMax(y) - arrMin(y)) || 1;
      const C = arrMin(y);
      const half = A / 2 + C;
      const idx = y.reduce((b, yi, i) => Math.abs(yi - half) < Math.abs(y[b] - half) ? i : b, 0);
      const x0 = x[idx];
      const i1 = Math.max(idx - 3, 0), i2 = Math.min(idx + 3, x.length - 1);
      const slope = i2 > i1 ? (y[i2] - y[i1]) / ((x[i2] - x[i1]) || 1) : 1;
      const k = Math.max(Math.abs(slope) * 0.886 / Math.max(A, 1e-10), 0.1);
      return [A, k, x0, C];
    }
  },
  'Custom': {
    params: [],
    fn: null,
    analytic: false,
    autoInit() { return []; }
  }
};

const MODEL_EQ_JS = {
  'Linear':           'a * x + b',
  'Power':            'a * x^b',
  'Power-Offset':     'a * x^b + c',
  'Polynomial-2':     'c2 * x^2 + c1 * x + c0',
  'Polynomial-3':     'c3 * x^3 + c2 * x^2 + c1 * x + c0',
  'Polynomial-4':     'c4 * x^4 + c3 * x^3 + c2 * x^2 + c1 * x + c0',
  'Polynomial-5':     'c5 * x^5 + c4 * x^4 + c3 * x^3 + c2 * x^2 + c1 * x + c0',
  'Polynomial-6':     'c6 * x^6 + c5 * x^5 + c4 * x^4 + c3 * x^3 + c2 * x^2 + c1 * x + c0',
  'Exponential':      'a * exp(b * x)',
  'Exp-Decay-Offset': 'a * exp(-b * x) + c',
  'Biexponential':    'A1 * exp(-b1 * x) + A2 * exp(-b2 * x) + C',
  'Logistic':         'L / (1 + exp(-k * (x - x0)))',
  'Gompertz':         'A * exp(-exp(-k * (x - x0)))',
  'KWW':              'A * exp(-(x / tau)^beta) + C',
  'Gaussian':         'A * exp(-0.5 * ((x - mu) / sig)^2) + C',
  'Lorentzian':       'A * g^2 / ((x - x0)^2 + g^2) + C',
  'Double-Gaussian':  'A1 * exp(-0.5 * ((x - mu1) / s1)^2) + A2 * exp(-0.5 * ((x - mu2) / s2)^2) + C',
  'Pseudo-Voigt':     'A * (eta * g^2 / ((x - x0)^2 + g^2) + (1 - eta) * exp(-0.5 * ((x - x0) / s)^2)) + C',
  'Fano':             'A * (q + (x - x0) / G)^2 / (1 + ((x - x0) / G)^2) + C',
  'Michaelis-Menten': 'Vmax * x / (Km + x)',
  'Hill':             'Vmax * x^n / (Kd^n + x^n)',
  '4PL':              'D + (A - D) / (1 + (x / C)^B)',
  'Oral-PK':          'Amp * ka / (ka - ke) * (exp(-ke * x) - exp(-ka * x))',
  'Stern-Volmer':     'F0 / ((1 + KD * x) * (1 + KS * x))',
  'Rational':         '(a + b * x) / (1 + c * x)',
  'Sine':             'A * sin(omega * x + phi) + C',
  'Damped-Sine':      'A * exp(-gamma * x) * sin(omega * x + phi) + C',
  'Weibull':          '1 - exp(-(x / lambda)^k)',
  'Langevin':         'A * (1 / tanh(B * x) - 1 / (B * x))',
  'Van-t-Hoff':       'exp(dSR - dHR / x)',
  'Ramberg-Osgood':   'x / E + (x / K)^(1 / n)',
  'Boltzmann':        'A / (1 + exp(-(x - Vh) / k))',
  'Double-Boltzmann': 'A1 / (1 + exp(-(x - Vh1) / k1)) + A2 / (1 + exp(-(x - Vh2) / k2))',
  'HH-Activation':    'g * (1 / (1 + exp(-(x - Vm) / km)))^p * (x - Erev)',
  'HH-Na-IV':         'g * (1/(1+exp(-(x-Vm)/km)))^3 * (1/(1+exp((x-Vh)/kh))) * (x - Erev)',
  'Kir':              'g * (x - EK) / (1 + exp((x - Vh) / k))',
  'GHK':              'A * x * (1 - r * exp(-x / Vt)) / (1 - exp(-x / Vt))',
  'Tau-Gaussian':         'taumax * exp(-0.5 * ((x - Vpeak) / k)^2) + taumin',
  // Pharmacokinetics
  'Two-Compartment-PK':  'A * exp(-alpha * x) + B * exp(-beta * x)',
  'PK-Lag':              '(x > tlag) ? (Amp * ka / (ka - ke) * (exp(-ke * (x - tlag)) - exp(-ka * (x - tlag)))) : 0',
  // Enzyme kinetics
  'Substrate-Inhibition':'Vmax * x / (Km + x + x^2 / Ki)',
  // Adsorption
  'Langmuir':            'qm * KL * x / (1 + KL * x)',
  'Freundlich':          'KF * x^(1/n)',
  'Temkin':              'B * log(AT * x)',
  // Rheology  (x = shear rate γ̇)
  'Power-Law-Fluid':     'K * abs(x)^(n - 1)',
  'Herschel-Bulkley':    'tau0 + K * abs(x)^n',
  'Cross-Model':         'eta_inf + (eta0 - eta_inf) / (1 + (K * x)^m)',
  'Carreau':             'eta_inf + (eta0 - eta_inf) * (1 + (lambda * x)^2)^((n - 1) / 2)',
  'Quemada':             '((sqrt(eta0) + sqrt(eta_inf) * sqrt(x / gdotc)) / (1 + sqrt(x / gdotc)))^2',
  // Peak / spectral
  'EMG':                 '(A/2) * exp(sigma^2/(2*tau^2) - (x-mu)/tau) * erfc((sigma/tau - (x-mu)/sigma)/sqrt(2)) + C',
  'Asymmetric-Gaussian': 'A * exp(-0.5*((x-mu)/sigma)^2) * (1 + erf(alpha*(x-mu)/(sigma*sqrt(2)))) + C',
  // Voigt: fV and eta derived from fG, fL via Thompson-Cox-Hastings (fV repeated inline)
  'Voigt':               'A * (max(0, min(1, 1.36603*(fL/(fG^5 + 2.69269*fG^4*fL + 2.42843*fG^3*fL^2 + 4.47163*fG^2*fL^3 + 0.07842*fG*fL^4 + fL^5)^(1/5)) - 0.47719*(fL/(fG^5 + 2.69269*fG^4*fL + 2.42843*fG^3*fL^2 + 4.47163*fG^2*fL^3 + 0.07842*fG*fL^4 + fL^5)^(1/5))^2 + 0.11116*(fL/(fG^5 + 2.69269*fG^4*fL + 2.42843*fG^3*fL^2 + 4.47163*fG^2*fL^3 + 0.07842*fG*fL^4 + fL^5)^(1/5))^3)) * ((fG^5 + 2.69269*fG^4*fL + 2.42843*fG^3*fL^2 + 4.47163*fG^2*fL^3 + 0.07842*fG*fL^4 + fL^5)^(1/5)/2)^2 / ((x-x0)^2 + ((fG^5 + 2.69269*fG^4*fL + 2.42843*fG^3*fL^2 + 4.47163*fG^2*fL^3 + 0.07842*fG*fL^4 + fL^5)^(1/5)/2)^2) + (1 - max(0, min(1, 1.36603*(fL/(fG^5 + 2.69269*fG^4*fL + 2.42843*fG^3*fL^2 + 4.47163*fG^2*fL^3 + 0.07842*fG*fL^4 + fL^5)^(1/5)) - 0.47719*(fL/(fG^5 + 2.69269*fG^4*fL + 2.42843*fG^3*fL^2 + 4.47163*fG^2*fL^3 + 0.07842*fG*fL^4 + fL^5)^(1/5))^2 + 0.11116*(fL/(fG^5 + 2.69269*fG^4*fL + 2.42843*fG^3*fL^2 + 4.47163*fG^2*fL^3 + 0.07842*fG*fL^4 + fL^5)^(1/5))^3))) * exp(-4*log(2)*(x-x0)^2 / (fG^5 + 2.69269*fG^4*fL + 2.42843*fG^3*fL^2 + 4.47163*fG^2*fL^3 + 0.07842*fG*fL^4 + fL^5)^(2/5))) + C',
  // Thermal / kinetics
  'Arrhenius':           'A * exp(-Ea_R / x)',
  'Extended-Arrhenius':  'A * x^n * exp(-Ea_R / x)',
  // Diffusion
  'Erf-Diffusion':       'A * erf((x - mu) / w) + B',
  // Activation functions
  'Softplus':            'A * log(1 + exp(k * (x - x0))) + C',
  'Erf-Sigmoid':         'A * (1 + erf(k * (x - x0))) / 2 + C',
};

const MODEL_EQ = {
  'Linear':           'y = ax + b',
  'Power':            'y = ax^{b}',
  'Power-Offset':     'y = ax^{b} + c',
  'Polynomial-2':     'y = c_{2}x^2 + c_{1}x + c_{0}',
  'Polynomial-3':     'y = c_{3}x^3 + c_{2}x^2 + c_{1}x + c_{0}',
  'Polynomial-4':     'y = c_{4}x^4 + c_{3}x^3 + c_{2}x^2 + c_{1}x + c_{0}',
  'Polynomial-5':     'y = c_{5}x^5 + c_{4}x^4 + c_{3}x^3 + c_{2}x^2 + c_{1}x + c_{0}',
  'Polynomial-6':     'y = c_{6}x^6 + c_{5}x^5 + c_{4}x^4 + c_{3}x^3 + c_{2}x^2 + c_{1}x + c_{0}',
  'Exponential':      'y = a\\,e^{bx}',
  'Exp-Decay-Offset': 'y = a\\,e^{-bx} + c',
  'Biexponential':    'y = A_{1}e^{-b_{1}x} + A_{2}e^{-b_{2}x} + C',
  'Logistic':         'y = \\dfrac{L}{1+e^{-k(x-x_{0})}}',
  'Gompertz':         'y = A\\exp\\!\\left(-e^{-k(x-x_{0})}\\right)',
  'KWW':              'y = A\\exp\\!\\left(-\\left(\\tfrac{x}{\\tau}\\right)^{\\!\\beta}\\right)+C',
  'Gaussian':         'y = A\\exp\\!\\left(-\\dfrac{(x-\\mu)^{2}}{2\\sigma^{2}}\\right)+C',
  'Lorentzian':       'y = \\dfrac{A\\gamma^{2}}{(x-x_{0})^{2}+\\gamma^{2}}+C',
  'Double-Gaussian':  'y = A_{1}e^{-(x-\\mu_{1})^{2}\\!/2\\sigma_{1}^{2}}+A_{2}e^{-(x-\\mu_{2})^{2}\\!/2\\sigma_{2}^{2}}+C',
  'Pseudo-Voigt':     'y = A[\\eta L+(1-\\eta)G]+C,\\quad L=\\dfrac{\\gamma^{2}}{(x-x_{0})^{2}+\\gamma^{2}},\\;G=e^{-(x-x_{0})^{2}\\!/2\\sigma^{2}}',
  'Fano':             'y = A\\dfrac{(q+\\varepsilon)^{2}}{1+\\varepsilon^{2}}+C,\\quad\\varepsilon=\\dfrac{x-x_{0}}{\\Gamma}',
  'Michaelis-Menten': 'y = \\dfrac{V_{\\!\\max}x}{K_{m}+x}',
  'Hill':             'y = \\dfrac{V_{\\!\\max}x^{n}}{K_{d}^{n}+x^{n}}',
  '4PL':              'y = D+\\dfrac{A-D}{1+(x/C)^{B}}',
  'Oral-PK':          'y = \\dfrac{A_{\\!mp}\\,k_{a}}{k_{a}-k_{e}}\\!\\left(e^{-k_{e}x}-e^{-k_{a}x}\\right)',
  'Stern-Volmer':     'y = \\dfrac{F_{0}}{(1+K_{D}x)(1+K_{S}x)}',
  'Rational':         'y = \\dfrac{a+bx}{1+cx}',
  'Sine':             'y = A\\sin(\\omega x+\\varphi)+C',
  'Damped-Sine':      'y = A\\,e^{-\\gamma x}\\sin(\\omega x+\\varphi)+C',
  'Weibull':          'y = 1-\\exp\\!\\left(-(x/\\lambda)^{k}\\right)',
  'Langevin':         'y = A\\!\\left(\\coth(Bx)-\\dfrac{1}{Bx}\\right)',
  'Van-t-Hoff':       'y = \\exp\\!\\left(\\dfrac{\\Delta S}{R}-\\dfrac{\\Delta H}{Rx}\\right)',
  'Ramberg-Osgood':   'y = \\dfrac{x}{E}+\\left(\\dfrac{x}{K}\\right)^{\\!1/n}',
  'Boltzmann':        'y = \\dfrac{A}{1+e^{-(x-V_{h})/k}}',
  'Double-Boltzmann': 'y = \\dfrac{A_{1}}{1+e^{-(x-V_{h1})/k_{1}}}+\\dfrac{A_{2}}{1+e^{-(x-V_{h2})/k_{2}}}',
  'HH-Activation':    'm=\\dfrac{1}{1+e^{-(x-V_{m})/k_{m}}},\\quad y=g\\,m^{p}(x-E_{\\mathrm{rev}})',
  'HH-Na-IV':         'm=\\dfrac{1}{1+e^{-(x-V_{m})/k_{m}}},\\;h=\\dfrac{1}{1+e^{(x-V_{h})/k_{h}}},\\;y=g\\,m^{3}h\\,(x-E_{\\mathrm{rev}})',
  'Kir':              'y=\\dfrac{g(x-E_{K})}{1+e^{(x-V_{h})/k}}',
  'GHK':              'y=\\dfrac{Ax\\left(1-r\\,e^{-x/V_{t}}\\right)}{1-e^{-x/V_{t}}}',
  'Tau-Gaussian':         'y=\\tau_{\\max}\\exp\\!\\left(-\\dfrac{(x-V_{\\mathrm{peak}})^{2}}{2k^{2}}\\right)+\\tau_{\\min}',
  // Pharmacokinetics
  'Two-Compartment-PK':  'C=A\\,e^{-\\alpha t}+B\\,e^{-\\beta t}',
  'PK-Lag':              'C=\\dfrac{A_{mp}\\,k_{a}}{k_{a}-k_{e}}\\!\\left(e^{-k_{e}(t-t_{lag})}-e^{-k_{a}(t-t_{lag})}\\right),\\;t>t_{lag}',
  // Enzyme kinetics
  'Substrate-Inhibition':'v=\\dfrac{V_{\\!\\max}[S]}{K_{m}+[S]+[S]^{2}/K_{i}}',
  // Adsorption
  'Langmuir':            'q=\\dfrac{q_{m}K_{L}C}{1+K_{L}C}',
  'Freundlich':          'q=K_{F}\\,C^{1/n}',
  'Temkin':              'q=B\\ln(A_{T}\\,C)',
  // Rheology
  'Power-Law-Fluid':     '\\eta=K\\,|\\dot{\\gamma}|^{n-1}',
  'Herschel-Bulkley':    '\\tau=\\tau_{0}+K\\,|\\dot{\\gamma}|^{n}',
  'Cross-Model':         '\\eta=\\eta_{\\infty}+\\dfrac{\\eta_{0}-\\eta_{\\infty}}{1+(K\\dot{\\gamma})^{m}}',
  'Carreau':             '\\eta=\\eta_{\\infty}+(\\eta_{0}-\\eta_{\\infty})\\left[1+(\\lambda\\dot{\\gamma})^{2}\\right]^{(n-1)/2}',
  'Quemada':             '\\eta=\\left(\\dfrac{\\sqrt{\\eta_{0}}+\\sqrt{\\eta_{\\infty}}\\,\\sqrt{\\dot{\\gamma}/\\dot{\\gamma}_{c}}}{1+\\sqrt{\\dot{\\gamma}/\\dot{\\gamma}_{c}}}\\right)^{\\!2}',
  // Peak / spectral
  'EMG':                 'y=\\dfrac{A}{2}\\exp\\!\\left(\\dfrac{\\sigma^{2}}{2\\tau^{2}}-\\dfrac{x-\\mu}{\\tau}\\right)\\mathrm{erfc}\\!\\left(\\dfrac{\\sigma/\\tau-(x-\\mu)/\\sigma}{\\sqrt{2}}\\right)+C',
  'Asymmetric-Gaussian': 'y=A\\,e^{-(x-\\mu)^{2}/2\\sigma^{2}}\\!\\left[1+\\mathrm{erf}\\!\\left(\\dfrac{\\alpha(x-\\mu)}{\\sigma\\sqrt{2}}\\right)\\right]+C',
  'Voigt':               'y=A\\!\\left[\\eta\\dfrac{(f_V/2)^{2}}{(x-x_0)^{2}+(f_V/2)^{2}}+(1-\\eta)\\,e^{-4\\ln2\\,(x-x_0)^{2}/f_V^{2}}\\right]+C',
  // Thermal / kinetics
  'Arrhenius':           'y=A\\,\\exp\\!\\left(-\\dfrac{E_{a}/R}{x}\\right)',
  'Extended-Arrhenius':  'y=A\\,x^{n}\\,\\exp\\!\\left(-\\dfrac{E_{a}/R}{x}\\right)',
  // Diffusion
  'Erf-Diffusion':       'y=A\\,\\mathrm{erf}\\!\\left(\\dfrac{x-\\mu}{w}\\right)+B',
  // Activation functions
  'Softplus':            'y=A\\ln\\!\\left(1+e^{k(x-x_{0})}\\right)+C',
  'Erf-Sigmoid':         'y=\\dfrac{A}{2}\\!\\left[1+\\mathrm{erf}\\!\\left(k(x-x_{0})\\right)\\right]+C',
  'Custom':              '',
};
