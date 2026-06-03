# Numerical Validation

This document records cross-checks of Curve Fitting Studio's nonlinear least-squares
solver against independent references. The goal is to give users confidence that a
fit produced in the browser agrees with established tools (NIST, scipy).

## Method

The shipped solver is Levenberg–Marquardt with Marquardt diagonal scaling
`JᵀJ + λ·diag(|JᵀJ|)`, a forward-difference Jacobian (`h = max(|pⱼ|·1e-7, 1e-7)`),
and scipy-style **relative** convergence (`‖δ‖ < tol·(‖p‖+tol)` **and**
`|ΔSSE| < tol·(SSE+tol)`). The same implementation runs in the Web Worker
(default path) and the main-thread fallback — they are kept byte-identical, so a
fit reproduces regardless of which path executes. Multi-start uses a **seeded**
PRNG, so results are reproducible run-to-run.

The figures below were produced by a faithful Python port of that exact loop
(same damping, Jacobian step, and stopping rule), at the default tolerance.

## NIST StRD certified datasets

The U.S. National Institute of Standards and Technology Statistical Reference
Datasets (StRD) publish certified parameter values for standard nonlinear
regression problems. Lower/average-difficulty cases:

| Dataset | Model | Parameter | CFS solver | NIST certified | Match |
|---------|-------|-----------|-----------|----------------|-------|
| **Misra1a** | `y = b₁(1 − e^(−b₂x))` | b₁ | 238.9420804 | 238.94212918 | 7 sig figs |
| | | b₂ | 0.00055016 | 0.00055015643 | 5 sig figs |
| | | residual SSE | 1.245514e−01 | 1.2455138894e−01 | exact |
| **Rat42** | `y = b₁/(1 + e^(b₂−b₃x))` | b₁ | 72.46224 | 72.462237 | 7 sig figs |
| | | b₂ | 2.61808 | 2.6180768 | 6 sig figs |
| | | b₃ | 0.067359 | 0.0673592 | 5 sig figs |
| | | residual SSE | 8.056523e+00 | 8.0565229e+00 | exact |

The small last-digit differences come from the forward-difference Jacobian and the
relative stopping tolerance; the residual sum of squares matches the certified
value, i.e. the solver reaches the certified minimum.

## Round-trip parameter recovery (in-app models)

Clean data is generated from a known parameter set, then fit from a perturbed
start (1.5× the true values). Maximum relative parameter error:

| Model family | True → recovered | Max rel. error |
|--------------|------------------|----------------|
| Exp Decay + Offset | `[95, 0.18, 2]` → `[95, 0.18, 2]` | 1e−15 |
| Gaussian peak | `[120, 0.5, 1.2, 5]` → same | 2e−16 |
| Logistic | `[1e6, 0.18, 20]` → same | 0 |
| Hill | `[450, 12, 1.0]` → same | 2e−16 |

Recovery is at machine precision, confirming the model evaluators and solver are
internally consistent across amplitude scales spanning ~6 orders of magnitude.

## Special functions

- `erf` (Abramowitz & Stegun 7.1.26): |abs err| < 1.5e−7.
- `erfcx` (scaled complementary error function, Numerical-Recipes rational): verified
  against `scipy.special.erfcx` to |rel err| < 1.1e−7 over x ∈ [−2, 50]. The EMG
  (exponentially-modified Gaussian) peak model uses the `erfcx` form, which matches
  the exact profile to ~6e−8 relative and stays finite in the far tails where a naive
  `exp(·)·erfc(·)` evaluation overflows.

## Reproducing these checks

The validation script lives in the commit history for `VALIDATION.md`; it ports the
solver from `js/solvers.js` / `fitting-worker.js` and fits the datasets above. NIST
StRD data and certified values: <https://www.itl.nist.gov/div898/strd/nls/nls_main.shtml>.
