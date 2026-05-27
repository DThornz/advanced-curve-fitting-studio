// First-run tutorial: TUT_KEY, TUT_SLIDES, tutShow, tutClose, tutThemeIllus, tutRender, tutInit

/* ═══════════════════════════════════════════════════════════
   FIRST-RUN TUTORIAL
═══════════════════════════════════════════════════════════ */
const TUT_KEY = 'cfs_tutorial_done';
let _tutStep = 0;

const TUT_SLIDES = [
  {
    title: 'Welcome to Curve Fitting Studio',
    body: 'A fully offline, browser-native platform for scientific curve fitting and nonlinear regression. Load data, choose from <strong>38 built-in models</strong>, and fit with Levenberg-Marquardt, Gauss-Newton, Nelder-Mead, or BFGS — no installation or internet required.',
    illus: `<svg viewBox="0 0 500 160" fill="none" xmlns="http://www.w3.org/2000/svg">
      <!-- full app shell overview -->
      <rect width="500" height="160" fill="#060e1c"/>
      <!-- tab bar -->
      <rect width="500" height="18" fill="#060e1c"/>
      <rect x="5" y="2" width="82" height="15" rx="3" fill="#0d2040" stroke="#0b9e8a" stroke-width="1"/>
      <text x="40" y="13" font-size="7.5" fill="#0b9e8a" text-anchor="middle" font-family="sans-serif">Workspace 1</text>
      <text x="80" y="13" font-size="7" fill="#2a4060" font-family="sans-serif">×</text>
      <rect x="93" y="2" width="58" height="15" rx="3" fill="#07111e" stroke="#1c3050"/>
      <text x="116" y="13" font-size="7.5" fill="#3d5470" text-anchor="middle" font-family="sans-serif">Tab 2</text>
      <text x="144" y="13" font-size="7" fill="#1e2e40" font-family="sans-serif">×</text>
      <rect x="158" y="4" width="16" height="11" rx="3" fill="#07111e" stroke="#1c3050"/>
      <text x="166" y="13" font-size="10" fill="#2a4060" text-anchor="middle" font-family="sans-serif">+</text>
      <line x1="0" y1="18" x2="500" y2="18" stroke="#1c3050"/>
      <!-- toolbar -->
      <rect x="0" y="18" width="500" height="18" fill="#07111e"/>
      <rect x="3" y="21" width="50" height="12" rx="3" fill="#0d2040" stroke="#1c3050"/>
      <text x="28" y="30" font-size="6.5" fill="#7a90ae" text-anchor="middle" font-family="sans-serif">Examples ▾</text>
      <rect x="56" y="21" width="48" height="12" rx="3" fill="#0d2040" stroke="#1c3050"/>
      <text x="80" y="30" font-size="6.5" fill="#7a90ae" text-anchor="middle" font-family="sans-serif">Import Data</text>
      <rect x="107" y="21" width="44" height="12" rx="3" fill="#0d2040" stroke="#1c3050"/>
      <text x="129" y="30" font-size="6.5" fill="#7a90ae" text-anchor="middle" font-family="sans-serif">Paste Data</text>
      <line x1="155" y1="22" x2="155" y2="34" stroke="#1c3050"/>
      <rect x="159" y="21" width="34" height="12" rx="3" fill="#0b2c44" stroke="#0b9e8a" stroke-width="0.8"/>
      <text x="176" y="30" font-size="6.5" fill="#0b9e8a" text-anchor="middle" font-family="sans-serif">▶ Fit</text>
      <rect x="196" y="21" width="32" height="12" rx="3" fill="#0d2040" stroke="#1c3050"/>
      <text x="212" y="30" font-size="6.5" fill="#7a90ae" text-anchor="middle" font-family="sans-serif">Try All</text>
      <line x1="232" y1="22" x2="232" y2="34" stroke="#1c3050"/>
      <rect x="348" y="21" width="38" height="12" rx="3" fill="#0d2040" stroke="#1c3050"/>
      <text x="367" y="30" font-size="6.5" fill="#7a90ae" text-anchor="middle" font-family="sans-serif">Export ▾</text>
      <rect x="389" y="21" width="48" height="12" rx="3" fill="#0d2040" stroke="#1c3050"/>
      <text x="413" y="30" font-size="6.5" fill="#7a90ae" text-anchor="middle" font-family="sans-serif">Save Session</text>
      <rect x="440" y="21" width="56" height="12" rx="3" fill="#0d2040" stroke="#1c3050"/>
      <text x="468" y="30" font-size="6.5" fill="#7a90ae" text-anchor="middle" font-family="sans-serif">Load Session</text>
      <line x1="0" y1="36" x2="500" y2="36" stroke="#1c3050"/>
      <!-- left panel -->
      <rect x="0" y="36" width="78" height="108" fill="#07111e"/>
      <line x1="78" y1="36" x2="78" y2="144" stroke="#1c3050"/>
      <text x="6" y="47" font-size="6.5" fill="#4a6080" font-family="sans-serif" font-weight="600" letter-spacing=".04em">DATASETS</text>
      <rect x="3" y="50" width="72" height="13" rx="2" fill="#0d2040" stroke="#1c3050"/>
      <circle cx="11" cy="56.5" r="3" fill="#3b82f6"/>
      <text x="17" y="60" font-size="6.5" fill="#94a3b8" font-family="sans-serif">Dataset 1</text>
      <text x="6" y="78" font-size="6.5" fill="#4a6080" font-family="sans-serif" font-weight="600" letter-spacing=".04em">ACTIVE FITS</text>
      <rect x="3" y="81" width="72" height="13" rx="2" fill="#0d2040" stroke="#1c3050"/>
      <circle cx="11" cy="87.5" r="3" fill="#0b9e8a"/>
      <text x="17" y="91" font-size="6.5" fill="#7a90ae" font-family="sans-serif">Exp-Decay</text>
      <!-- center panel -->
      <rect x="78" y="36" width="270" height="108" fill="#060e1c"/>
      <rect x="81" y="38" width="264" height="68" rx="2" fill="#07111e" stroke="#1c3050" stroke-width="0.5"/>
      <line x1="91" y1="41" x2="91" y2="101" stroke="#1c3050" stroke-width="0.7"/>
      <line x1="91" y1="101" x2="339" y2="101" stroke="#1c3050" stroke-width="0.7"/>
      <circle cx="101" cy="47" r="2.5" fill="#3b82f6"/><circle cx="122" cy="56" r="2.5" fill="#3b82f6"/>
      <circle cx="148" cy="66" r="2.5" fill="#3b82f6"/><circle cx="178" cy="76" r="2.5" fill="#3b82f6"/>
      <circle cx="212" cy="84" r="2.5" fill="#3b82f6"/><circle cx="252" cy="91" r="2.5" fill="#3b82f6"/>
      <circle cx="296" cy="96" r="2.5" fill="#3b82f6"/><circle cx="332" cy="99" r="2.5" fill="#3b82f6"/>
      <path d="M94,46 C116,54 146,65 178,76 C210,86 252,92 296,96 C314,97.5 326,98.5 340,99" stroke="#0b9e8a" stroke-width="1.8" stroke-linecap="round"/>
      <rect x="81" y="108" width="264" height="9" fill="#07111e" stroke="#1c3050" stroke-width="0.5"/>
      <text x="89" y="115.5" font-size="6" fill="#0b9e8a" font-family="sans-serif">Residuals</text>
      <text x="128" y="115.5" font-size="6" fill="#3d5470" font-family="sans-serif">Q-Q Plot</text>
      <text x="161" y="115.5" font-size="6" fill="#3d5470" font-family="sans-serif">Histogram</text>
      <text x="200" y="115.5" font-size="6" fill="#3d5470" font-family="sans-serif">Convergence</text>
      <rect x="81" y="117" width="264" height="26" fill="#07111e" stroke="#1c3050" stroke-width="0.5"/>
      <line x1="81" y1="130" x2="345" y2="130" stroke="#1c3050" stroke-width="0.5" stroke-dasharray="3 2"/>
      <circle cx="101" cy="129" r="1.8" fill="#3b82f6"/><circle cx="122" cy="132" r="1.8" fill="#3b82f6"/>
      <circle cx="148" cy="128" r="1.8" fill="#3b82f6"/><circle cx="178" cy="132" r="1.8" fill="#3b82f6"/>
      <circle cx="212" cy="129" r="1.8" fill="#3b82f6"/><circle cx="252" cy="131" r="1.8" fill="#3b82f6"/>
      <circle cx="296" cy="129" r="1.8" fill="#3b82f6"/><circle cx="332" cy="132" r="1.8" fill="#3b82f6"/>
      <!-- right panel -->
      <rect x="348" y="36" width="152" height="108" fill="#07111e"/>
      <line x1="348" y1="36" x2="348" y2="144" stroke="#1c3050"/>
      <text x="355" y="47" font-size="6.5" fill="#4a6080" font-family="sans-serif" font-weight="600">TARGET DATASET</text>
      <rect x="351" y="50" width="144" height="10" rx="2" fill="#0d2040" stroke="#1c3050"/>
      <text x="356" y="58" font-size="6" fill="#7a90ae" font-family="sans-serif">Dataset 1</text>
      <text x="355" y="71" font-size="6.5" fill="#4a6080" font-family="sans-serif" font-weight="600">FIT MODEL</text>
      <rect x="351" y="74" width="144" height="10" rx="2" fill="#0d2040" stroke="#0b9e8a" stroke-width="0.8"/>
      <text x="356" y="82" font-size="6" fill="#e2e8f0" font-family="sans-serif">Exponential  y = a·eᵇˣ</text>
      <text x="355" y="95" font-size="6.5" fill="#4a6080" font-family="sans-serif" font-weight="600">PARAMETERS</text>
      <rect x="351" y="98" width="144" height="34" rx="2" fill="#0d2040" stroke="#1c3050"/>
      <text x="356" y="108" font-size="6" fill="#7a90ae" font-family="monospace">a   95.0  →  94.82 ±0.91</text>
      <text x="356" y="118" font-size="6" fill="#7a90ae" font-family="monospace">b   0.18  →  0.179 ±0.003</text>
      <text x="356" y="128" font-size="6" fill="#7a90ae" font-family="monospace">c   2.00  →  2.11  ±0.29</text>
      <!-- stats bar -->
      <rect x="0" y="144" width="500" height="16" fill="#07111e"/>
      <line x1="0" y1="144" x2="500" y2="144" stroke="#1c3050"/>
      <text x="6" y="155" font-size="7" fill="#0b9e8a" font-family="monospace" font-weight="600">R² 0.9984</text>
      <text x="68" y="155" font-size="7" fill="#7a90ae" font-family="monospace">Adj-R² 0.998</text>
      <text x="148" y="155" font-size="7" fill="#7a90ae" font-family="monospace">RMSE 1.23</text>
      <text x="216" y="155" font-size="7" fill="#7a90ae" font-family="monospace">AIC −32.4</text>
      <text x="276" y="155" font-size="7" fill="#7a90ae" font-family="monospace">BIC −28.1</text>
      <text x="336" y="155" font-size="7" fill="#7a90ae" font-family="monospace">N 24</text>
    </svg>`
  },
  {
    title: 'Load Your Data',
    body: 'Click <strong>Examples</strong> for built-in synthetic datasets, <strong>Import Data</strong> to upload a CSV/TSV/TXT file, or <strong>Paste Data</strong> to paste from a spreadsheet. Drag-and-drop onto the plot also works. Three-column files (X, Y, σ) unlock error-weighted fitting.',
    illus: `<svg viewBox="0 0 500 160" fill="none" xmlns="http://www.w3.org/2000/svg">
      <!-- toolbar focused on load buttons + open examples dropdown -->
      <rect width="500" height="160" fill="#060e1c"/>
      <!-- toolbar strip -->
      <rect width="500" height="22" fill="#07111e"/>
      <line x1="0" y1="22" x2="500" y2="22" stroke="#1c3050"/>
      <!-- Examples active/highlighted -->
      <rect x="4" y="3" width="66" height="16" rx="4" fill="#0b2c44" stroke="#0b9e8a" stroke-width="1.2"/>
      <text x="37" y="14.5" font-size="8.5" fill="#0b9e8a" text-anchor="middle" font-family="sans-serif" font-weight="600">Examples ▾</text>
      <!-- Import Data highlighted -->
      <rect x="74" y="3" width="68" height="16" rx="4" fill="#0d2040" stroke="#0b9e8a" stroke-width="1.2"/>
      <text x="108" y="14.5" font-size="8.5" fill="#0b9e8a" text-anchor="middle" font-family="sans-serif" font-weight="600">Import Data</text>
      <!-- Paste Data highlighted -->
      <rect x="146" y="3" width="62" height="16" rx="4" fill="#0d2040" stroke="#0b9e8a" stroke-width="1.2"/>
      <text x="177" y="14.5" font-size="8.5" fill="#0b9e8a" text-anchor="middle" font-family="sans-serif" font-weight="600">Paste Data</text>
      <!-- separator and dimmed remaining toolbar -->
      <line x1="213" y1="4" x2="213" y2="18" stroke="#1c3050"/>
      <rect x="217" y="3" width="34" height="16" rx="4" fill="#0d2040" stroke="#1c3050"/>
      <text x="234" y="14.5" font-size="7.5" fill="#3d5470" text-anchor="middle" font-family="sans-serif">▶ Fit</text>
      <rect x="254" y="3" width="34" height="16" rx="4" fill="#0d2040" stroke="#1c3050"/>
      <text x="271" y="14.5" font-size="7.5" fill="#3d5470" text-anchor="middle" font-family="sans-serif">Try All</text>
      <!-- 2-column examples dropdown open below Examples button -->
      <rect x="4" y="24" width="298" height="132" rx="5" fill="#07111e" stroke="#1c3050" stroke-width="1"/>
      <line x1="153" y1="24" x2="153" y2="156" stroke="#1c3050" stroke-width="0.8"/>
      <!-- left column: General -->
      <text x="12" y="38" font-size="7" fill="#3d5470" font-family="sans-serif" letter-spacing=".06em" font-weight="600">GENERAL</text>
      <rect x="8" y="41" width="138" height="12" rx="2" fill="#0b2640" stroke="#0b9e8a" stroke-width="0.6"/>
      <text x="13" y="50.5" font-size="7.5" fill="#0b9e8a" font-family="sans-serif">Exponential Decay</text>
      <text x="13" y="63" font-size="7.5" fill="#7a90ae" font-family="sans-serif">Gaussian Peak</text>
      <text x="13" y="75" font-size="7.5" fill="#7a90ae" font-family="sans-serif">Logistic Growth</text>
      <text x="13" y="87" font-size="7.5" fill="#7a90ae" font-family="sans-serif">Sinusoidal</text>
      <text x="13" y="99" font-size="7.5" fill="#7a90ae" font-family="sans-serif">Power Law</text>
      <text x="13" y="111" font-size="7.5" fill="#7a90ae" font-family="sans-serif">Dose-Response</text>
      <text x="13" y="123" font-size="7.5" fill="#7a90ae" font-family="sans-serif">Biexponential</text>
      <!-- right column: Calibration + Electrophysiology -->
      <text x="161" y="38" font-size="7" fill="#3d5470" font-family="sans-serif" letter-spacing=".06em" font-weight="600">CALIBRATION &amp; DIST.</text>
      <text x="161" y="51" font-size="7.5" fill="#7a90ae" font-family="sans-serif">Thermistor (B-param)</text>
      <text x="161" y="63" font-size="7.5" fill="#7a90ae" font-family="sans-serif">Linear Calibration</text>
      <text x="161" y="75" font-size="7.5" fill="#7a90ae" font-family="sans-serif">Log-Normal</text>
      <text x="161" y="87" font-size="7.5" fill="#7a90ae" font-family="sans-serif">Weibull Survival</text>
      <line x1="161" y1="93" x2="296" y2="93" stroke="#1c3050" stroke-width="0.5"/>
      <text x="161" y="103" font-size="7" fill="#3d5470" font-family="sans-serif" letter-spacing=".06em" font-weight="600">ELECTROPHYSIOLOGY</text>
      <text x="161" y="115" font-size="7.5" fill="#7a90ae" font-family="sans-serif">G-V Curve (Boltzmann)</text>
      <text x="161" y="127" font-size="7.5" fill="#7a90ae" font-family="sans-serif">Kir Channel I-V</text>
      <text x="161" y="139" font-size="7.5" fill="#7a90ae" font-family="sans-serif">HH Na Channel I-V</text>
      <text x="161" y="151" font-size="7.5" fill="#7a90ae" font-family="sans-serif">Voltage-Dep. τ</text>
      <!-- drag-and-drop zone (right side of illustration) -->
      <rect x="312" y="24" width="184" height="132" rx="5" fill="#07111e" stroke="#1c3050" stroke-dasharray="4 3"/>
      <path d="M404,66 L404,98 M388,82 L420,82 M388,82 L395,75 M420,82 L413,75" stroke="#1c3050" stroke-width="2" stroke-linecap="round"/>
      <text x="404" y="116" font-size="8.5" fill="#3d5470" text-anchor="middle" font-family="sans-serif">drag &amp; drop</text>
      <text x="404" y="129" font-size="7.5" fill="#253448" text-anchor="middle" font-family="sans-serif">.csv  ·  .tsv  ·  .txt</text>
      <text x="404" y="142" font-size="7" fill="#1e2e3c" text-anchor="middle" font-family="sans-serif">3-col: X · Y · σ for weighted fit</text>
    </svg>`
  },
  {
    title: 'Select a Model and Fit',
    body: 'Choose from <strong>38 built-in models</strong> across 10 groups — or write a <strong>Custom Equation</strong> in x. Click <strong>Auto Init</strong> for data-driven starting guesses, then press <strong>▶ Fit</strong> (or Ctrl+Enter). Set optional Min/Max bounds on any parameter. Drag the sweep slider for a live preview without fitting.',
    illus: `<svg viewBox="0 0 500 160" fill="none" xmlns="http://www.w3.org/2000/svg">
      <!-- left: plot with data + fit; right: fit model panel + toolbar Fit button -->
      <rect width="500" height="160" fill="#060e1c"/>
      <!-- partial plot (left half) -->
      <rect x="4" y="4" width="226" height="152" rx="4" fill="#07111e" stroke="#1c3050" stroke-width="0.8"/>
      <line x1="18" y1="12" x2="18" y2="146" stroke="#1c3050" stroke-width="0.8"/>
      <line x1="18" y1="146" x2="222" y2="146" stroke="#1c3050" stroke-width="0.8"/>
      <circle cx="28" cy="20" r="2.8" fill="#3b82f6"/><circle cx="50" cy="36" r="2.8" fill="#3b82f6"/>
      <circle cx="76" cy="56" r="2.8" fill="#3b82f6"/><circle cx="104" cy="78" r="2.8" fill="#3b82f6"/>
      <circle cx="134" cy="98" r="2.8" fill="#3b82f6"/><circle cx="166" cy="116" r="2.8" fill="#3b82f6"/>
      <circle cx="196" cy="130" r="2.8" fill="#3b82f6"/><circle cx="218" cy="138" r="2.8" fill="#3b82f6"/>
      <path d="M22,19 C42,30 70,54 100,76 C128,96 160,115 196,130 C206,134 214,137 222,139" stroke="#0b9e8a" stroke-width="2" stroke-linecap="round"/>
      <!-- right panel (fit model + params) -->
      <!-- toolbar strip showing Auto Init + Fit button -->
      <rect x="238" y="4" width="258" height="18" rx="3" fill="#07111e" stroke="#1c3050" stroke-width="0.5"/>
      <rect x="244" y="7" width="54" height="12" rx="3" fill="#0d2040" stroke="#1c3050"/>
      <text x="271" y="16.5" font-size="7" fill="#7a90ae" text-anchor="middle" font-family="sans-serif">Auto Init</text>
      <rect x="302" y="7" width="52" height="12" rx="3" fill="#0b2c44" stroke="#0b9e8a" stroke-width="1"/>
      <text x="328" y="16.5" font-size="8.5" fill="#0b9e8a" text-anchor="middle" font-family="sans-serif" font-weight="600">▶ Fit</text>
      <rect x="358" y="7" width="50" height="12" rx="3" fill="#0d2040" stroke="#1c3050"/>
      <text x="383" y="16.5" font-size="7" fill="#5a7090" text-anchor="middle" font-family="sans-serif">Try All</text>
      <rect x="412" y="7" width="78" height="12" rx="3" fill="#0d2040" stroke="#1c3050"/>
      <text x="451" y="16.5" font-size="7" fill="#5a7090" text-anchor="middle" font-family="sans-serif">✕ Remove Fit</text>
      <!-- right panel body -->
      <rect x="238" y="26" width="258" height="130" rx="3" fill="#07111e" stroke="#1c3050" stroke-width="0.5"/>
      <!-- FIT MODEL -->
      <text x="246" y="40" font-size="7" fill="#4a6080" font-family="sans-serif" letter-spacing=".05em" font-weight="600">FIT MODEL</text>
      <rect x="242" y="43" width="250" height="14" rx="3" fill="#0d2040" stroke="#0b9e8a" stroke-width="1"/>
      <text x="249" y="53.5" font-size="8.5" fill="#e2e8f0" font-family="sans-serif">Exponential  y = a·eᵇˣ + c</text>
      <text x="482" y="53.5" font-size="8" fill="#4a6080" font-family="sans-serif">▾</text>
      <!-- PARAMETERS header + Auto Init / Copy buttons -->
      <text x="246" y="69" font-size="7" fill="#4a6080" font-family="sans-serif" letter-spacing=".05em" font-weight="600">PARAMETERS</text>
      <rect x="346" y="62" width="64" height="11" rx="3" fill="#0d2040" stroke="#1c3050"/>
      <text x="378" y="70.5" font-size="6.5" fill="#7a90ae" text-anchor="middle" font-family="sans-serif">Auto Init</text>
      <rect x="414" y="62" width="70" height="11" rx="3" fill="#0d2040" stroke="#1c3050"/>
      <text x="449" y="70.5" font-size="6.5" fill="#7a90ae" text-anchor="middle" font-family="sans-serif">Copy Params</text>
      <!-- param table -->
      <rect x="242" y="73" width="250" height="72" rx="3" fill="#0d2040" stroke="#1c3050"/>
      <text x="249" y="83" font-size="6.5" fill="#3d5470" font-family="monospace">PARAM</text>
      <text x="304" y="83" font-size="6.5" fill="#3d5470" font-family="monospace">INITIAL</text>
      <text x="368" y="83" font-size="6.5" fill="#3d5470" font-family="monospace">FITTED ± SE</text>
      <line x1="242" y1="86" x2="492" y2="86" stroke="#1c3050"/>
      <text x="249" y="97" font-size="7.5" fill="#94a3b8" font-family="monospace">a</text>
      <text x="304" y="97" font-size="7.5" fill="#7a90ae" font-family="monospace">95.00</text>
      <text x="368" y="97" font-size="7.5" fill="#0b9e8a" font-family="monospace">94.82 ±0.91</text>
      <text x="249" y="111" font-size="7.5" fill="#94a3b8" font-family="monospace">b</text>
      <text x="304" y="111" font-size="7.5" fill="#7a90ae" font-family="monospace">0.180</text>
      <text x="368" y="111" font-size="7.5" fill="#0b9e8a" font-family="monospace">0.179 ±0.003</text>
      <text x="249" y="125" font-size="7.5" fill="#94a3b8" font-family="monospace">c</text>
      <text x="304" y="125" font-size="7.5" fill="#7a90ae" font-family="monospace">2.000</text>
      <text x="368" y="125" font-size="7.5" fill="#0b9e8a" font-family="monospace">2.11 ±0.29</text>
      <!-- sweep slider -->
      <rect x="249" y="131" width="116" height="8" rx="3" fill="#1c3050"/>
      <rect x="249" y="131" width="68" height="8" rx="3" fill="#0b9e8a" opacity=".4"/>
      <circle cx="317" cy="135" r="4" fill="#0b9e8a"/>
      <text x="374" y="139" font-size="6.5" fill="#3d5470" font-family="sans-serif">param sweep</text>
      <!-- algorithm label -->
      <text x="246" y="152" font-size="6.5" fill="#3d5070" font-family="sans-serif" letter-spacing=".04em">ALGORITHM  Levenberg-Marquardt</text>
    </svg>`
  },
  {
    title: 'Analyse Results',
    body: 'Converged parameters appear with <strong>± standard errors</strong>. The stats bar shows <strong>R², Adj-R², RMSE, SSE, AIC, BIC, and N</strong>. Four diagnostic tabs — Residuals, Q-Q Plot, Histogram, and Convergence — help assess fit quality. Click <strong>Try All</strong> to rank every model by R² in one shot.',
    illus: `<svg viewBox="0 0 500 160" fill="none" xmlns="http://www.w3.org/2000/svg">
      <!-- stats bar at top + plot + residual tabs + residual plot + Try All panel -->
      <rect width="500" height="160" fill="#060e1c"/>
      <!-- stats bar (prominent at top) -->
      <rect x="0" y="0" width="500" height="20" fill="#07111e"/>
      <line x1="0" y1="20" x2="500" y2="20" stroke="#1c3050"/>
      <text x="7" y="14" font-size="9.5" fill="#0b9e8a" font-family="monospace" font-weight="600">R² 0.9984</text>
      <text x="88" y="14" font-size="9.5" fill="#7a90ae" font-family="monospace">Adj-R² 0.998</text>
      <text x="194" y="14" font-size="9.5" fill="#7a90ae" font-family="monospace">RMSE 1.23</text>
      <text x="278" y="14" font-size="9.5" fill="#7a90ae" font-family="monospace">AIC −32.4</text>
      <text x="354" y="14" font-size="9.5" fill="#7a90ae" font-family="monospace">BIC −28.1</text>
      <text x="430" y="14" font-size="9.5" fill="#7a90ae" font-family="monospace">N 24</text>
      <!-- main plot -->
      <rect x="4" y="24" width="296" height="64" rx="3" fill="#07111e" stroke="#1c3050"/>
      <line x1="16" y1="28" x2="16" y2="82" stroke="#1c3050" stroke-width="0.8"/>
      <line x1="16" y1="82" x2="292" y2="82" stroke="#1c3050" stroke-width="0.8"/>
      <circle cx="26" cy="32" r="2.5" fill="#3b82f6"/><circle cx="56" cy="44" r="2.5" fill="#3b82f6"/>
      <circle cx="90" cy="57" r="2.5" fill="#3b82f6"/><circle cx="128" cy="68" r="2.5" fill="#3b82f6"/>
      <circle cx="170" cy="75" r="2.5" fill="#3b82f6"/><circle cx="216" cy="79" r="2.5" fill="#3b82f6"/>
      <circle cx="258" cy="81" r="2.5" fill="#3b82f6"/><circle cx="288" cy="82" r="2.5" fill="#3b82f6"/>
      <path d="M20,32 C46,41 84,56 124,67 C162,77 208,80 258,81.5 C272,81.8 282,82 292,82" stroke="#0b9e8a" stroke-width="2" stroke-linecap="round"/>
      <!-- residual tab bar -->
      <rect x="4" y="90" width="296" height="12" fill="#07111e" stroke="#1c3050" stroke-width="0.5"/>
      <text x="12" y="99.5" font-size="7.5" fill="#0b9e8a" font-family="sans-serif" font-weight="600">Residuals</text>
      <line x1="4" y1="102" x2="66" y2="102" stroke="#0b9e8a" stroke-width="1.2"/>
      <text x="70" y="99.5" font-size="7.5" fill="#3d5470" font-family="sans-serif">Q-Q Plot</text>
      <text x="116" y="99.5" font-size="7.5" fill="#3d5470" font-family="sans-serif">Histogram</text>
      <text x="176" y="99.5" font-size="7.5" fill="#3d5470" font-family="sans-serif">Convergence</text>
      <!-- residual plot -->
      <rect x="4" y="102" width="296" height="54" rx="0" fill="#07111e" stroke="#1c3050" stroke-width="0.5"/>
      <line x1="4" y1="129" x2="300" y2="129" stroke="#1c3050" stroke-width="0.6" stroke-dasharray="3 2"/>
      <circle cx="26" cy="126" r="2.2" fill="#3b82f6"/><circle cx="56" cy="133" r="2.2" fill="#3b82f6"/>
      <circle cx="90" cy="125" r="2.2" fill="#3b82f6"/><circle cx="128" cy="133" r="2.2" fill="#3b82f6"/>
      <circle cx="170" cy="127" r="2.2" fill="#3b82f6"/><circle cx="216" cy="131" r="2.2" fill="#3b82f6"/>
      <circle cx="258" cy="126" r="2.2" fill="#3b82f6"/><circle cx="288" cy="132" r="2.2" fill="#3b82f6"/>
      <text x="10" y="149" font-size="7" fill="#3b4f6b" font-family="monospace">SSE 33.5  ·  df 21  ·  converged</text>
      <!-- Try All ranking panel (right side) -->
      <rect x="308" y="24" width="188" height="132" rx="4" fill="#07111e" stroke="#1c3050"/>
      <text x="316" y="38" font-size="8" fill="#4a6080" font-family="sans-serif" font-weight="600">TRY ALL — RANKED BY R²</text>
      <line x1="308" y1="42" x2="496" y2="42" stroke="#1c3050"/>
      <rect x="314" y="46" width="176" height="14" rx="3" fill="#0b2640" stroke="#0b9e8a" stroke-width="0.7"/>
      <text x="320" y="56.5" font-size="7.5" fill="#0b9e8a" font-family="monospace">Exp-Decay-Offset  0.9984</text>
      <text x="468" y="56.5" font-size="7.5" fill="#0b9e8a" font-family="sans-serif">↵</text>
      <text x="320" y="72" font-size="7.5" fill="#5a7090" font-family="monospace">Exponential       0.9921</text>
      <text x="320" y="87" font-size="7.5" fill="#3d5070" font-family="monospace">Gaussian          0.9401</text>
      <text x="320" y="102" font-size="7.5" fill="#2a3e58" font-family="monospace">Logistic          0.8873</text>
      <text x="320" y="117" font-size="7.5" fill="#1e2e40" font-family="monospace">Power Law         0.7120</text>
      <line x1="308" y1="125" x2="496" y2="125" stroke="#1c3050" stroke-width="0.5"/>
      <text x="316" y="138" font-size="7" fill="#4a6080" font-family="sans-serif" font-weight="600">FITTED PARAMETERS</text>
      <text x="316" y="149" font-size="7" fill="#94a3b8" font-family="monospace">a 94.82 ±0.91  b 0.179 ±0.003</text>
    </svg>`
  },
  {
    title: 'Multiple Independent Workspaces',
    body: 'Click <strong>+</strong> in the tab bar to open a new workspace. Every tab is completely independent — its own datasets, fits, annotations, graph style, and settings. Double-click a tab name to rename it. Use <strong>Save Session</strong> to export all tabs to JSON, and reload them anytime.',
    illus: `<svg viewBox="0 0 500 160" fill="none" xmlns="http://www.w3.org/2000/svg">
      <!-- tab bar + left panel datasets/fits + plot showing active tab -->
      <rect width="500" height="160" fill="#060e1c"/>
      <!-- tab bar -->
      <rect width="500" height="26" fill="#060e1c"/>
      <line x1="0" y1="26" x2="500" y2="26" stroke="#1c3050"/>
      <!-- active tab -->
      <rect x="6" y="3" width="106" height="21" rx="4" fill="#0d2040" stroke="#0b9e8a" stroke-width="1.2"/>
      <text x="50" y="17.5" font-size="9.5" fill="#0b9e8a" text-anchor="middle" font-family="sans-serif" font-weight="600">Exp Decay</text>
      <text x="104" y="17.5" font-size="9" fill="#2a4060" font-family="sans-serif">×</text>
      <!-- inactive tab 2 -->
      <rect x="118" y="3" width="94" height="21" rx="4" fill="#07111e" stroke="#1c3050"/>
      <text x="157" y="17.5" font-size="9.5" fill="#3d5470" text-anchor="middle" font-family="sans-serif">G-V Curve</text>
      <text x="204" y="17.5" font-size="9" fill="#1e2e40" font-family="sans-serif">×</text>
      <!-- inactive tab 3 -->
      <rect x="218" y="3" width="78" height="21" rx="4" fill="#07111e" stroke="#1c3050"/>
      <text x="251" y="17.5" font-size="9.5" fill="#3d5470" text-anchor="middle" font-family="sans-serif">Kir I-V</text>
      <text x="289" y="17.5" font-size="9" fill="#1e2e40" font-family="sans-serif">×</text>
      <!-- + button -->
      <rect x="304" y="6" width="22" height="15" rx="4" fill="#07111e" stroke="#1c3050"/>
      <text x="315" y="18" font-size="13" fill="#2a4060" text-anchor="middle" font-family="sans-serif">+</text>
      <!-- double-click hint -->
      <text x="340" y="18" font-size="7.5" fill="#253448" font-family="sans-serif">double-click tab to rename</text>
      <!-- left panel -->
      <rect x="0" y="26" width="154" height="134" fill="#07111e"/>
      <line x1="154" y1="26" x2="154" y2="160" stroke="#1c3050"/>
      <text x="8" y="40" font-size="7.5" fill="#4a6080" font-family="sans-serif" letter-spacing=".05em" font-weight="600">DATASETS</text>
      <rect x="4" y="43" width="144" height="17" rx="3" fill="#0d2040" stroke="#0b9e8a" stroke-width="0.8"/>
      <circle cx="14" cy="51.5" r="3.5" fill="#3b82f6"/>
      <text x="22" y="55" font-size="8.5" fill="#e2e8f0" font-family="sans-serif">Dataset 1  (24 pts)</text>
      <rect x="4" y="63" width="144" height="17" rx="3" fill="#0d2040" stroke="#1c3050"/>
      <circle cx="14" cy="71.5" r="3.5" fill="#f59e0b"/>
      <text x="22" y="75" font-size="8.5" fill="#7a90ae" font-family="sans-serif">Dataset 2  (18 pts)</text>
      <line x1="4" y1="87" x2="148" y2="87" stroke="#1c3050" stroke-width="0.5"/>
      <text x="8" y="100" font-size="7.5" fill="#4a6080" font-family="sans-serif" letter-spacing=".05em" font-weight="600">ACTIVE FITS</text>
      <rect x="4" y="103" width="144" height="17" rx="3" fill="#0d2040" stroke="#1c3050"/>
      <circle cx="14" cy="111.5" r="3.5" fill="#0b9e8a"/>
      <text x="22" y="115" font-size="8.5" fill="#7a90ae" font-family="sans-serif">Exp-Decay  R²=0.998</text>
      <rect x="4" y="123" width="144" height="17" rx="3" fill="#0d2040" stroke="#1c3050"/>
      <circle cx="14" cy="131.5" r="3.5" fill="#8b5cf6"/>
      <text x="22" y="135" font-size="8.5" fill="#7a90ae" font-family="sans-serif">Gaussian   R²=0.941</text>
      <!-- save/load session buttons at bottom -->
      <rect x="4" y="144" width="66" height="14" rx="3" fill="#0d2040" stroke="#1c3050"/>
      <text x="37" y="154" font-size="7" fill="#5a7090" text-anchor="middle" font-family="sans-serif">Save Session</text>
      <rect x="74" y="144" width="76" height="14" rx="3" fill="#0d2040" stroke="#1c3050"/>
      <text x="112" y="154" font-size="7" fill="#5a7090" text-anchor="middle" font-family="sans-serif">Load Session</text>
      <!-- center plot showing active tab workspace -->
      <rect x="154" y="26" width="346" height="134" fill="#060e1c"/>
      <line x1="168" y1="34" x2="168" y2="150" stroke="#1c3050" stroke-width="0.8"/>
      <line x1="168" y1="150" x2="492" y2="150" stroke="#1c3050" stroke-width="0.8"/>
      <circle cx="180" cy="40" r="3" fill="#3b82f6"/><circle cx="212" cy="55" r="3" fill="#3b82f6"/>
      <circle cx="250" cy="73" r="3" fill="#3b82f6"/><circle cx="292" cy="93" r="3" fill="#3b82f6"/>
      <circle cx="338" cy="111" r="3" fill="#3b82f6"/><circle cx="388" cy="126" r="3" fill="#3b82f6"/>
      <circle cx="438" cy="136" r="3" fill="#3b82f6"/><circle cx="480" cy="142" r="3" fill="#3b82f6"/>
      <path d="M172,39 C198,50 234,71 274,91 C312,111 362,127 414,136 C440,140 462,142 492,143" stroke="#0b9e8a" stroke-width="2.2" stroke-linecap="round"/>
      <rect x="162" y="32" width="158" height="38" rx="4" fill="#0d2040" stroke="#1c3050" opacity=".95"/>
      <text x="170" y="46" font-size="8" fill="#0b9e8a" font-family="sans-serif" font-weight="600">Independent Workspaces</text>
      <text x="170" y="58" font-size="7" fill="#5a7090" font-family="sans-serif">Each tab has its own data, fits,</text>
      <text x="170" y="68" font-size="7" fill="#5a7090" font-family="sans-serif">style &amp; annotations — no shared state</text>
    </svg>`
  },
  {
    title: 'Annotate, Style, and Export',
    body: 'Add <strong>reference lines, text callouts, and auto-peak markers</strong> from the Annotations panel. Click <strong>⚙ Style</strong> to adjust fonts, colours, grid, axis range, and log scale. <strong>Export</strong> saves the plot as PNG or SVG. <strong>Copy Params</strong> copies all fit results to the clipboard.',
    illus: `<svg viewBox="0 0 500 160" fill="none" xmlns="http://www.w3.org/2000/svg">
      <!-- annotated plot (left) + right panel: Plot Labels/Style + Annotations + Export -->
      <rect width="500" height="160" fill="#060e1c"/>
      <!-- plot with annotations -->
      <rect x="4" y="4" width="238" height="152" rx="4" fill="#07111e" stroke="#1c3050" stroke-width="0.8"/>
      <line x1="18" y1="12" x2="18" y2="146" stroke="#1c3050" stroke-width="0.8"/>
      <line x1="18" y1="146" x2="234" y2="146" stroke="#1c3050" stroke-width="0.8"/>
      <!-- gaussian-ish curve data -->
      <circle cx="28" cy="136" r="2.5" fill="#3b82f6"/><circle cx="52" cy="120" r="2.5" fill="#3b82f6"/>
      <circle cx="80" cy="92" r="2.5" fill="#3b82f6"/><circle cx="104" cy="60" r="2.5" fill="#3b82f6"/>
      <circle cx="124" cy="36" r="2.5" fill="#3b82f6"/><circle cx="148" cy="60" r="2.5" fill="#3b82f6"/>
      <circle cx="172" cy="92" r="2.5" fill="#3b82f6"/><circle cx="200" cy="120" r="2.5" fill="#3b82f6"/>
      <circle cx="226" cy="136" r="2.5" fill="#3b82f6"/>
      <path d="M22,138 C42,130 68,102 96,64 C108,50 116,39 124,33 C132,27 140,27 148,33 C160,42 172,58 200,94 C214,112 224,128 234,138" stroke="#0b9e8a" stroke-width="2.2" stroke-linecap="round"/>
      <!-- horizontal reference line (EC50) -->
      <line x1="18" y1="90" x2="234" y2="90" stroke="#dc2626" stroke-width="1.2" stroke-dasharray="4 3" opacity=".9"/>
      <rect x="168" y="82" width="62" height="12" rx="3" fill="#1a0808" opacity=".9"/>
      <text x="199" y="91.5" font-size="8" fill="#dc2626" text-anchor="middle" font-family="sans-serif">EC₅₀ = 2.4</text>
      <!-- peak annotation -->
      <circle cx="124" cy="33" r="4" fill="#f59e0b" stroke="#07111e" stroke-width="1.5"/>
      <line x1="124" y1="28" x2="124" y2="18" stroke="#f59e0b" stroke-width="1.2"/>
      <polygon points="120,18 128,18 124,12" fill="#f59e0b"/>
      <rect x="82" y="8" width="88" height="12" rx="3" fill="#1c1200" opacity=".9"/>
      <text x="126" y="17.5" font-size="7.5" fill="#f59e0b" text-anchor="middle" font-family="sans-serif">peak  x = −39 mV</text>
      <!-- text callout -->
      <rect x="22" y="54" width="56" height="12" rx="3" fill="#0a1628" stroke="#1c3050" opacity=".9"/>
      <text x="50" y="63" font-size="7.5" fill="#7a90ae" text-anchor="middle" font-family="sans-serif">Gaussian fit</text>
      <!-- right panel -->
      <rect x="250" y="4" width="246" height="152" rx="4" fill="#07111e" stroke="#1c3050" stroke-width="0.8"/>
      <!-- PLOT LABELS section -->
      <text x="258" y="18" font-size="7.5" fill="#4a6080" font-family="sans-serif" letter-spacing=".05em" font-weight="600">PLOT LABELS</text>
      <rect x="398" y="10" width="92" height="13" rx="3" fill="#0d2040" stroke="#1c3050"/>
      <text x="444" y="19.5" font-size="7.5" fill="#7a90ae" text-anchor="middle" font-family="sans-serif">⚙ Style</text>
      <rect x="254" y="21" width="230" height="10" rx="2" fill="#0d2040" stroke="#1c3050"/>
      <text x="258" y="29" font-size="6.5" fill="#7a90ae" font-family="sans-serif">Title · X-axis label · Y-axis label</text>
      <!-- style options -->
      <rect x="254" y="35" width="230" height="28" rx="3" fill="#0d2040" stroke="#1c3050"/>
      <text x="260" y="46" font-size="7" fill="#3d5470" font-family="sans-serif">Fonts · Background · Grid · Zero lines</text>
      <text x="260" y="57" font-size="7" fill="#3d5470" font-family="sans-serif">Axis range · Log scale · Tick spacing</text>
      <!-- ANNOTATIONS section -->
      <text x="258" y="76" font-size="7.5" fill="#4a6080" font-family="sans-serif" letter-spacing=".05em" font-weight="600">ANNOTATIONS</text>
      <rect x="330" y="68" width="72" height="12" rx="3" fill="#0d2040" stroke="#1c3050"/>
      <text x="366" y="77" font-size="6.5" fill="#7a90ae" text-anchor="middle" font-family="sans-serif">Find Peaks</text>
      <rect x="406" y="68" width="72" height="12" rx="3" fill="#0d2040" stroke="#1c3050"/>
      <text x="442" y="77" font-size="6.5" fill="#7a90ae" text-anchor="middle" font-family="sans-serif">+ Add Annotation</text>
      <rect x="254" y="82" width="230" height="12" rx="2" fill="#0d2040" stroke="#1c3050"/>
      <text x="258" y="91" font-size="7" fill="#f59e0b" font-family="sans-serif">▲ peak  x = −39 mV  (auto-peak)</text>
      <rect x="254" y="97" width="230" height="12" rx="2" fill="#0d2040" stroke="#1c3050"/>
      <text x="258" y="106" font-size="7" fill="#dc2626" font-family="sans-serif">— EC₅₀ = 2.4  (h-line)</text>
      <rect x="254" y="112" width="230" height="12" rx="2" fill="#0d2040" stroke="#1c3050"/>
      <text x="258" y="121" font-size="7" fill="#7a90ae" font-family="sans-serif">T Gaussian fit  (text callout)</text>
      <!-- EXPORT section -->
      <text x="258" y="137" font-size="7.5" fill="#4a6080" font-family="sans-serif" letter-spacing=".05em" font-weight="600">SAVE &amp; EXPORT</text>
      <rect x="254" y="140" width="64" height="16" rx="3" fill="#0d2040" stroke="#1c3050"/>
      <text x="286" y="151" font-size="7.5" fill="#7a90ae" text-anchor="middle" font-family="sans-serif">Export PNG</text>
      <rect x="322" y="140" width="64" height="16" rx="3" fill="#0d2040" stroke="#1c3050"/>
      <text x="354" y="151" font-size="7.5" fill="#7a90ae" text-anchor="middle" font-family="sans-serif">Export SVG</text>
      <rect x="390" y="140" width="94" height="16" rx="3" fill="#0b2c44" stroke="#0b9e8a" stroke-width="1"/>
      <text x="437" y="151" font-size="7.5" fill="#0b9e8a" text-anchor="middle" font-family="sans-serif">Save Session</text>
    </svg>`
  }
];

function tutShow() {
  _tutStep = 0;
  const el = document.getElementById('tut-overlay');
  if (!el) return;
  el.style.display = 'flex';
  tutRender();
  document.getElementById('tut-next').focus();
}

function tutClose() {
  const el = document.getElementById('tut-overlay');
  if (el) el.style.display = 'none';
}

function tutThemeIllus(svg) {
  if (document.body.classList.contains('dark-mode')) return svg;
  // Swap every dark-mode hex colour for its light-mode equivalent.
  // Order matters: longer/more-specific strings before shorter ones.
  return svg
    .replace(/#0b2640/gi, '#c8f0ea')   // teal-highlighted row bg
    .replace(/#0b2c44/gi, '#c0ebe4')   // teal button bg
    .replace(/#0a1628/gi, '#f8fafc')   // callout/overlay bg
    .replace(/#1a0808/gi, '#fff0f0')   // red annotation bg
    .replace(/#1c1200/gi, '#fffbeb')   // amber annotation bg
    .replace(/#060e1c/gi, '#f0f4f8')   // deepest bg
    .replace(/#07111e/gi, '#e8eef5')   // panel bg
    .replace(/#0d2040/gi, '#dde5f0')   // button / element bg
    .replace(/#1c3050/gi, '#b8c8de')   // borders
    .replace(/#1e2e3c/gi, '#b0bec5')   // very dim variant
    .replace(/#1e2e40/gi, '#b0bec5')   // very dim
    .replace(/#2a3e58/gi, '#94a3b8')   // dim blue
    .replace(/#2a4060/gi, '#94a3b8')   // dim text
    .replace(/#253448/gi, '#94a3b8')   // very dim 2
    .replace(/#3b4f6b/gi, '#64748b')   // dim blue 2
    .replace(/#3d5070/gi, '#64748b')   // dimmer variant
    .replace(/#3d5470/gi, '#64748b')   // dimmer text
    .replace(/#4a6080/gi, '#475569')   // section headers
    .replace(/#5a7090/gi, '#475569')   // medium dim
    .replace(/#7a90ae/gi, '#475569')   // muted text
    .replace(/#94a3b8/gi, '#64748b')   // muted text 2
    .replace(/#e2e8f0/gi, '#1e293b');  // primary text
}

function tutRender() {
  const n = TUT_SLIDES.length;
  const s = TUT_SLIDES[_tutStep];
  document.getElementById('tut-illus').innerHTML = tutThemeIllus(s.illus);
  document.getElementById('tut-title').textContent = s.title;
  document.getElementById('tut-body').innerHTML = s.body;
  document.getElementById('tut-count').textContent = `${_tutStep + 1} / ${n}`;
  document.getElementById('tut-prev').disabled = _tutStep === 0;
  document.getElementById('tut-next').textContent = _tutStep === n - 1 ? 'Get Started!' : 'Next →';
  const dots = document.getElementById('tut-dots');
  dots.innerHTML = '';
  for (let i = 0; i < n; i++) {
    const d = document.createElement('div');
    d.className = 'tut-dot' + (i === _tutStep ? ' active' : '');
    dots.appendChild(d);
  }
}

function tutInit() {
  document.getElementById('tut-prev').addEventListener('click', () => {
    if (_tutStep > 0) { _tutStep--; tutRender(); }
  });
  document.getElementById('tut-next').addEventListener('click', () => {
    if (_tutStep < TUT_SLIDES.length - 1) { _tutStep++; tutRender(); }
    else tutClose();
  });
  document.getElementById('tut-skip').addEventListener('click', tutClose);
  document.getElementById('tut-no-show').addEventListener('click', () => {
    localStorage.setItem(TUT_KEY, '1');
    tutClose();
  });
  document.getElementById('tut-overlay').addEventListener('keydown', e => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      if (_tutStep < TUT_SLIDES.length - 1) { _tutStep++; tutRender(); } else tutClose();
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (_tutStep > 0) { _tutStep--; tutRender(); }
    } else if (e.key === 'Escape') {
      e.preventDefault(); tutClose();
    }
  });
}

