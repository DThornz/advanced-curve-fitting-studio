# Example Datasets

Sample data files demonstrating the import formats accepted by Curve Fitting Studio.

## Formats supported

| Format | Extension | Delimiter |
|--------|-----------|-----------|
| Comma-separated | `.csv` | `,` |
| Tab-separated | `.txt`, `.tsv` | `\t` |
| Space-separated | `.txt` | space |

**Headers are optional.** If the first row contains non-numeric values it is automatically treated as a header row. Column names become the axis labels in the Column Picker.

## What to expect in each folder

| Folder | Contents |
|--------|----------|
| `General/` | Common curve shapes — decay, peaks, growth, oscillation, power law, calibration |
| `Electrophysiology/` | Voltage-clamp I-V curves, G-V activation, gating time constants |
| `Biology_Pharmacology/` | Dose-response, enzyme kinetics, bacterial growth curves |
| `Physics_Materials/` | XRD diffraction peaks, stress-strain, damped oscillation |
| `With_Uncertainty/` | Files with a third σ column for weighted / error-bar fitting |
| `Multi_Series/` | Multi-column, replicate, and grouped files for the Column Picker import modes (below) |

## Column Picker import modes

Files with **three or more columns** open the Column Picker, which offers four import modes. The `Multi_Series/` folder has one file demonstrating each:

| Mode | What it does | Demo file |
|------|--------------|-----------|
| **Single Y (+ optional σ)** | One X, one Y, and an optional uncertainty column. | `With_Uncertainty/enzyme_kinetics_replicated.csv` (X, Y, SD) |
| **Multiple Y → separate datasets** | One shared X; every ticked Y column becomes its own dataset. Then use **Fit All Datasets** to fit one model to all of them. | `Multi_Series/multi_y_enzyme_temperatures.csv` — Michaelis–Menten assay at 10/25/37 °C |
| **Replicates → mean ± σ** | Ticked Y columns are replicate measurements, collapsed to a mean with an auto-computed SD or SEM (σ enables 1/σ² weighting and error bars). | `Multi_Series/replicate_dose_response.csv` — 4 replicate wells per dose (fit 4PL) |
| **Group column → one dataset per group** | Long-format X, Y, and a category column; each label becomes a dataset, with repeated X within a label averaged to mean ± σ. | `Multi_Series/grouped_growth_curves.csv` — 3 strains × 3 replicate OD reads (fit Logistic) |

## Import tips

- **Two-column files** (X, Y only) are imported directly — no Column Picker dialog.
- **Three or more columns** open the Column Picker so you can choose the import mode and map columns.
- The Column Picker shows a **live preview** of the resulting dataset(s) for whichever mode is selected.
- Column headers can include units, spaces, and special characters — they are displayed exactly as written.
- Files with no header row work fine; columns are labelled Col 1, Col 2, … automatically.
- All files here use UTF-8 encoding with Unix or Windows line endings — both are accepted.
