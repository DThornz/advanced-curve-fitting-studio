# Example Datasets

Sample data files demonstrating the import formats accepted by the Advanced Curve Fitting Studio.

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

## Import tips

- **Two-column files** (X, Y only) are imported directly — no Column Picker dialog.
- **Three or more columns** open the Column Picker so you can choose which columns to use as X, Y, and optionally σ.
- Column headers can include units, spaces, and special characters — they are displayed exactly as written.
- Files with no header row work fine; columns are labelled Col 1, Col 2, … automatically.
- All files here use UTF-8 encoding with Unix or Windows line endings — both are accepted.
