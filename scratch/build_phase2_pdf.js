const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

// 1. Read scratch/mqtt_guide.html to extract STA and AIO logos
const guidePath = path.resolve(__dirname, 'mqtt_guide.html');
let staLogo = '';
let aioLogo = '';

if (fs.existsSync(guidePath)) {
  const guideHtml = fs.readFileSync(guidePath, 'utf8');
  const staMatch = guideHtml.match(/class="logo-sta"\s+src="(data:image\/jpeg;base64,[^"]+)"/);
  if (staMatch) staLogo = staMatch[1];
  const aioMatch = guideHtml.match(/class="logo-aio"\s+src="(data:image\/png;base64,[^"]+)"/);
  if (aioMatch) aioLogo = aioMatch[1];
}

console.log('STA Logo extracted:', staLogo ? `${staLogo.length} chars` : 'none');
console.log('AIO Logo extracted:', aioLogo ? `${aioLogo.length} chars` : 'none');

// 2. Generate comprehensive Phase 2 Plan HTML
const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>SignSpeaker - Phase 2 Engineering Plan: Flex Sensors + Gyroscope Fusion</title>
<style>
  @page {
    size: A4;
    margin: 12mm 14mm 12mm 14mm;
  }
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .page-break { page-break-before: always; }
  }
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    color: #1e293b;
    background: #ffffff;
    font-size: 11.5px;
    line-height: 1.45;
    margin: 0;
    padding: 0;
  }

  /* Header & Branding */
  .doc-header {
    border-bottom: 2.5px solid #2563eb;
    padding-bottom: 10px;
    margin-bottom: 12px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .doc-brand {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .logo-box {
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 7px;
    padding: 3px 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 1px 3px rgba(0,0,0,0.05);
  }
  .logo-sta { height: 32px; width: auto; }
  .logo-aio { height: 32px; width: 32px; object-fit: contain; }
  .partner-x { font-weight: 700; color: #64748b; font-size: 13px; }
  .doc-title-block h1 {
    margin: 0;
    font-size: 17px;
    color: #0b1329;
    font-weight: 800;
    letter-spacing: -0.02em;
  }
  .doc-title-block p {
    margin: 1px 0 0;
    font-size: 10.5px;
    color: #64748b;
    font-weight: 500;
  }
  .doc-badge {
    background: #eff6ff;
    color: #2563eb;
    border: 1px solid #bfdbfe;
    border-radius: 6px;
    padding: 4px 9px;
    font-size: 9.5px;
    font-weight: 700;
    text-align: right;
    line-height: 1.35;
  }

  /* Headings */
  h2 {
    color: #0b1329;
    font-size: 13px;
    border-bottom: 1.5px solid #e2e8f0;
    padding-bottom: 3px;
    margin-top: 13px;
    margin-bottom: 7px;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  h3 {
    color: #1e3a8a;
    font-size: 11.5px;
    margin-top: 9px;
    margin-bottom: 4px;
    font-weight: 700;
  }

  /* Callouts */
  .callout {
    background: #f8fafc;
    border-left: 3.5px solid #2563eb;
    padding: 7px 11px;
    border-radius: 0 6px 6px 0;
    margin: 7px 0;
    font-size: 11px;
    line-height: 1.4;
  }
  .callout.tip {
    border-left-color: #10b981;
    background: #f0fdf4;
  }
  .callout.warn {
    border-left-color: #f59e0b;
    background: #fffbeb;
  }
  .callout.danger {
    border-left-color: #ef4444;
    background: #fef2f2;
  }
  .callout-title {
    font-weight: 700;
    margin-bottom: 2px;
    color: #0f172a;
    display: flex;
    align-items: center;
    gap: 4px;
  }

  /* Tables */
  table {
    width: 100%;
    border-collapse: collapse;
    margin: 7px 0;
    font-size: 10.5px;
  }
  th, td {
    padding: 4.5px 7px;
    border: 1px solid #cbd5e1;
    text-align: left;
    vertical-align: top;
  }
  th {
    background: #f1f5f9;
    color: #0f172a;
    font-weight: 700;
  }
  tr:nth-child(even) { background: #f8fafc; }

  /* Code blocks */
  pre, code {
    font-family: Consolas, Monaco, "Courier New", monospace;
  }
  code {
    background: #f1f5f9;
    padding: 1px 4px;
    border-radius: 4px;
    font-size: 10.5px;
    color: #0f172a;
    border: 1px solid #e2e8f0;
  }
  pre {
    background: #0b1329;
    color: #f8fafc;
    padding: 7px 11px;
    border-radius: 6px;
    overflow-x: auto;
    font-size: 10px;
    line-height: 1.35;
    margin: 5px 0;
  }
  pre code {
    background: transparent;
    border: 0;
    color: inherit;
    padding: 0;
  }

  /* Diagrams & Visual Flow */
  .diagram-box {
    background: #0f172a;
    color: #e2e8f0;
    border-radius: 7px;
    padding: 9px 12px;
    margin: 7px 0;
    font-family: Consolas, monospace;
    font-size: 10px;
    line-height: 1.35;
    text-align: left;
    border: 1px solid #1e293b;
    white-space: pre;
    overflow-x: hidden;
  }
  .flow-row {
    display: flex;
    justify-content: space-between;
    align-items: stretch;
    gap: 8px;
    margin: 8px 0;
  }
  .flow-card {
    background: #f8fafc;
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    padding: 7px 9px;
    flex: 1;
    font-size: 10.5px;
    text-align: center;
  }
  .flow-card.accent {
    border-color: #2563eb;
    background: #eff6ff;
  }
  .flow-card.success {
    border-color: #10b981;
    background: #f0fdf4;
  }
  .flow-card strong {
    display: block;
    margin-bottom: 2px;
    font-size: 11px;
  }

  /* Checklists */
  .checklist {
    list-style: none;
    padding-left: 0;
    margin: 5px 0;
  }
  .checklist li {
    padding: 2.5px 0 2.5px 22px;
    position: relative;
    font-size: 10.5px;
  }
  .checklist li::before {
    content: "☐";
    position: absolute;
    left: 4px;
    top: 2px;
    color: #2563eb;
    font-weight: bold;
    font-size: 12px;
  }

  /* Grid 2-column layout */
  .grid-2 {
    display: flex;
    gap: 12px;
    margin: 6px 0;
  }
  .grid-col {
    flex: 1;
  }

  .footer-note {
    margin-top: 12px;
    border-top: 1px solid #e2e8f0;
    padding-top: 6px;
    font-size: 9.5px;
    color: #94a3b8;
    text-align: center;
    display: flex;
    justify-content: space-between;
  }
</style>
</head>
<body>

  <!-- ==================== PAGE 1: EXECUTIVE SUMMARY & PROBLEM STATEMENT ==================== -->
  <div class="doc-header">
    <div class="doc-brand">
      <div class="logo-box">
        <img class="logo-sta" src="${staLogo}" alt="STA Logo">
      </div>
      <span class="partner-x">×</span>
      <div class="logo-box" style="border-radius: 50%; padding: 2px;">
        <img class="logo-aio" src="${aioLogo}" alt="AIO Logo">
      </div>
      <div class="doc-title-block">
        <h1>SignSpeaker — Phase 2 Engineering Plan</h1>
        <p>Integration of 5 Flex Sensors with Gyroscope Fusion & Full Pipeline Architecture</p>
      </div>
    </div>
    <div class="doc-badge">
      VERSION 2.0 (PLAN)<br>
      STA × AIO ROADMAP<br>
      SEPTEMBER 2026
    </div>
  </div>

  <div class="callout tip">
    <div class="callout-title">📋 Document Scope & Executive Context</div>
    This engineering plan specifies the full hardware, firmware, Node-RED backend, and Dashboard machine learning evolution required to expand the SignSpeaker smart glove from Phase 1 (wrist rotation via MPU6050 gyroscope only) to Phase 2 (5-finger bend articulation fused with 3-axis gyroscope kinematics). <strong>Scope: Architectural plan and technical design only — no modifications are made to active Phase 1 production code.</strong>
  </div>

  <h2>📐 1. The Problem Statement & Physical Principles</h2>
  <div class="grid-2">
    <div class="grid-col">
      <h3>Phase 1 Capabilities (Gyroscope Only)</h3>
      <p>The single MPU6050 IMU captures wrist and forearm rotational angular velocities (<code>gx, gy, gz</code>) at 25 Hz. It excels at measuring macroscopic gesture dynamics:</p>
      <ul style="margin: 4px 0; padding-left: 18px;">
        <li>Directional arm sweeps (left-to-right, up/down arcs)</li>
        <li>Wrist rolls, flicks, and rotation velocity profiles</li>
        <li>Macroscopic spatial energy triggers for gesture boundaries</li>
      </ul>
    </div>
    <div class="grid-col">
      <h3>Phase 1 Fundamental Blind Spots</h3>
      <p>The gyroscope cannot measure hand topology or internal articulation:</p>
      <ul style="margin: 4px 0; padding-left: 18px;">
        <li><strong>Finger curl:</strong> Open palm vs. clenched fist produce 0 rad/s when static.</li>
        <li><strong>Static signs:</strong> Letters "A", "B", "C", "D" have identical zero gyro movement.</li>
        <li><strong>Sign ambiguity:</strong> "Hello" (open wave) and "Thanks" (flat palm push) share similar wrist arcs but have completely distinct finger shapes.</li>
      </ul>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 22%;">Egyptian Sign (ESL)</th>
        <th style="width: 32%;">Phase 1 Gyroscope Ambiguity</th>
        <th style="width: 46%;">Phase 2 Flex Sensor Fusion Resolution</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>"Hello" vs. "Thanks"</strong></td>
        <td>Both execute a forward/lateral wrist movement; angular momentum overlaps significantly.</td>
        <td>"Hello" shows oscillating slight curl across all fingers; "Thanks" features all 5 fingers fully flattened (f0..f4 &lt; 0.10) throughout the push.</td>
      </tr>
      <tr>
        <td><strong>"I am" vs. "Hello Reem"</strong></td>
        <td>Both involve downward wrist deflection towards chest/waist.</td>
        <td>"I am" isolates index finger (f1 &lt; 0.10) with thumb/middle/ring/pinky curled tight (f0, f2, f3, f4 &gt; 0.85); "Hello Reem" presents a distinct open-hand pose.</td>
      </tr>
      <tr>
        <td><strong>Alphabet & Digits</strong></td>
        <td>Completely unrecognizable if held stationary (gyro outputs near-zero noise).</td>
        <td>Static poses are uniquely classified by finger bend configuration vectors alone (100% discriminatory flex features).</td>
      </tr>
    </tbody>
  </table>

  <h2>🔩 2. Hardware Architecture & Pin Allocation</h2>
  <div class="grid-2">
    <div class="grid-col">
      <h3>2.1 Flex Sensor Principle & Voltage Divider</h3>
      <p>Flex sensors are carbon-based variable resistors whose resistance increases monotonically with bend angle:</p>
      <ul style="margin: 4px 0; padding-left: 18px;">
        <li><strong>Flat (0° extension):</strong> Nominal resistance ≈ 10–25 kΩ</li>
        <li><strong>Curled (90°+ flexion):</strong> Resistance increases to 60–110 kΩ</li>
      </ul>
      <p>A passive voltage divider with a fixed 10 kΩ pull-down resistor converts resistance changes to a voltage read by the ESP32 12-bit ADC (0–4095 counts):</p>
      <div style="background: #f1f5f9; padding: 6px 10px; border-radius: 4px; font-family: Consolas, monospace; font-size: 10px; border: 1px solid #e2e8f0; margin: 4px 0;">
        V_out = 3.3V × R_fixed / (R_fixed + R_flex)<br>
        ADC_Raw = (V_out / 3.3V) × 4095
      </div>
    </div>
    <div class="grid-col">
      <h3>2.2 Circuit Diagram per Finger</h3>
      <pre style="margin-top: 2px;">
    3.3V Regulated Power Rail
        │
        ├──[ Flex Sensor (10k-100k) ]
        │
        ├──┬─────────► ESP32 ADC1 Pin (GPIO)
        │  │
        │ [ 10 kΩ 1% Resistor ]
        │  │
       GND GND Ground Plane</pre>
    </div>
  </div>

  <div class="callout danger">
    <div class="callout-title">⚠️ Critical Hardware Constraint: ADC1 Channels Only</div>
    The ESP32 microcontroller features two ADC units. <strong>ADC2 is multiplexed with the internal Wi-Fi peripheral</strong>; invoking Wi-Fi operations (MQTT publishing) immediately corrupts ADC2 readings. Therefore, <strong>all 5 flex sensors must be mapped strictly to ADC1 channels (GPIO 32–39)</strong> to guarantee zero radio interference. Note that GPIO 34, 35, 36, and 39 are input-only pins with no internal pull-ups, perfectly suited for external divider circuits.
  </div>

  <table>
    <thead>
      <tr>
        <th>Anatomical Finger</th>
        <th>Mounting Location</th>
        <th>Assigned ESP32 Pin</th>
        <th>ADC Channel</th>
        <th>Electrical Characteristics & Role</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>Thumb</strong></td>
        <td>Dorsal proximal phalanx</td>
        <td><code>GPIO 34</code></td>
        <td>ADC1_CH6</td>
        <td>Input-only; 12-bit SAR ADC; external 10k reference</td>
      </tr>
      <tr>
        <td><strong>Index</strong></td>
        <td>Dorsal knuckle to PIP joint</td>
        <td><code>GPIO 35</code></td>
        <td>ADC1_CH7</td>
        <td>Input-only; high dynamic range for pointing gestures</td>
      </tr>
      <tr>
        <td><strong>Middle</strong></td>
        <td>Dorsal knuckle to PIP joint</td>
        <td><code>GPIO 32</code></td>
        <td>ADC1_CH4</td>
        <td>ADC1 analog input; general articulation tracking</td>
      </tr>
      <tr>
        <td><strong>Ring</strong></td>
        <td>Dorsal knuckle to PIP joint</td>
        <td><code>GPIO 33</code></td>
        <td>ADC1_CH5</td>
        <td>ADC1 analog input; finger grouping discrimination</td>
      </tr>
      <tr>
        <td><strong>Pinky</strong></td>
        <td>Dorsal knuckle to PIP joint</td>
        <td><code>GPIO 36</code> (Sensor_VP)</td>
        <td>ADC1_CH0</td>
        <td>Input-only; low-noise channel for small finger curl</td>
      </tr>
    </tbody>
  </table>

  <div class="footer-note">
    <span>SignSpeaker Project — Phase 2 Engineering Plan</span>
    <span>STA × AIO Joint Applied Engineering</span>
    <span>Page 1 of 5</span>
  </div>

  <!-- ==================== PAGE 2: PROTOCOLS & FIRMWARE ==================== -->
  <div class="page-break"></div>

  <div class="doc-header">
    <div class="doc-brand">
      <div class="doc-title-block">
        <h1>SignSpeaker — Phase 2 Extended Protocol & Firmware</h1>
        <p>Telemetry Packet Design, On-Device Normalization, and ESP32 Pipeline</p>
      </div>
    </div>
    <div class="doc-badge">SECTION 3 & 4</div>
  </div>

  <h2>📡 3. Extended Telemetry & Packet Protocol</h2>
  <p>To support both Phase 1 (gyro-only) and Phase 2 (gyro + flex) hardware transparently without protocol breakages, telemetry strings transition from a 5-field structure to a 9-field standardized CSV line.</p>

  <div class="grid-2">
    <div class="grid-col">
      <h3>Phase 1 Legacy Packet (5 Fields)</h3>
      <pre><code>D,&lt;ms&gt;,&lt;gx&gt;,&lt;gy&gt;,&lt;gz&gt;</code></pre>
      <p style="font-size: 10px; color: #64748b;">Carries timestamp and 3 floating-point angular velocity axes.</p>
    </div>
    <div class="grid-col">
      <h3>Phase 2 Extended Packet (9 Fields)</h3>
      <pre><code>D,&lt;ms&gt;,&lt;gx&gt;,&lt;gy&gt;,&lt;gz&gt;,&lt;f0&gt;,&lt;f1&gt;,&lt;f2&gt;,&lt;f3&gt;,&lt;f4&gt;</code></pre>
      <p style="font-size: 10px; color: #64748b;">Carries timestamp, 3 gyro axes, and 5 normalized finger bend values.</p>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 8%;">Index</th>
        <th style="width: 14%;">Field Token</th>
        <th style="width: 18%;">Data Type & Range</th>
        <th style="width: 60%;">Description & Engineering Semantics</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><code>0</code></td>
        <td><code>D</code></td>
        <td>Header String</td>
        <td>Packet type discriminator. Identifies telemetry streaming frame.</td>
      </tr>
      <tr>
        <td><code>1</code></td>
        <td><code>&lt;ms&gt;</code></td>
        <td>Unsigned Long</td>
        <td>ESP32 internal timer <code>millis()</code> elapsed since boot.</td>
      </tr>
      <tr>
        <td><code>2..4</code></td>
        <td><code>&lt;gx&gt;,&lt;gy&gt;,&lt;gz&gt;</code></td>
        <td>Float (rad/s)</td>
        <td>MPU6050 angular velocity axes calibrated with moving EWMA zero-bias.</td>
      </tr>
      <tr>
        <td><code>5</code></td>
        <td><code>&lt;f0&gt;</code></td>
        <td>Float (0.00 – 1.00)</td>
        <td><strong>Thumb</strong> bend index (0.00 = completely extended flat, 1.00 = fully bent).</td>
      </tr>
      <tr>
        <td><code>6</code></td>
        <td><code>&lt;f1&gt;</code></td>
        <td>Float (0.00 – 1.00)</td>
        <td><strong>Index</strong> finger bend index.</td>
      </tr>
      <tr>
        <td><code>7</code></td>
        <td><code>&lt;f2&gt;</code></td>
        <td>Float (0.00 – 1.00)</td>
        <td><strong>Middle</strong> finger bend index.</td>
      </tr>
      <tr>
        <td><code>8</code></td>
        <td><code>&lt;f3&gt;</code></td>
        <td>Float (0.00 – 1.00)</td>
        <td><strong>Ring</strong> finger bend index.</td>
      </tr>
      <tr>
        <td><code>9</code></td>
        <td><code>&lt;f4&gt;</code></td>
        <td>Float (0.00 – 1.00)</td>
        <td><strong>Pinky</strong> finger bend index.</td>
      </tr>
    </tbody>
  </table>

  <h3>On-Device Normalization & Flash Storage</h3>
  <p>To prevent floating-point transmission overhead and avoid raw ADC calibration drifts across ambient temperatures, normalization executes on the ESP32 transmitter:</p>
  <div style="background: #f1f5f9; padding: 6px 12px; border-radius: 4px; font-family: Consolas, monospace; font-size: 10px; border: 1px solid #e2e8f0; margin: 4px 0;">
    f_norm[i] = clamp( (ADC_raw[i] - ADC_flat[i]) / (ADC_bent[i] - ADC_flat[i]), 0.0f, 1.0f )
  </div>
  <p>Calibration pairs (<code>ADC_flat[5]</code>, <code>ADC_bent[5]</code>) are stored permanently in ESP32 non-volatile storage (NVS via <code>Preferences.h</code>), persisting across reboots.</p>

  <h3>ESP-NOW Wireless Struct Evolution</h3>
  <div class="grid-2">
    <div class="grid-col">
      <pre><code>// Phase 1 Struct (12 bytes)
typedef struct {
    float gyroX;
    float gyroY;
    float gyroZ;
} GyroData;</code></pre>
    </div>
    <div class="grid-col">
      <pre><code>// Phase 2 Struct (33 bytes)
typedef struct {
    float gyroX, gyroY, gyroZ; // 12 bytes
    float flex[5];             // 20 bytes
    uint8_t version;           // 1 byte (0x02)
} SensorData;</code></pre>
    </div>
  </div>

  <h2>🔧 4. Firmware Architecture Evolution</h2>
  <div class="flow-row">
    <div class="flow-card accent">
      <strong>1. Multi-Sensor Loop (25 Hz)</strong>
      MPU6050 sampled over I2C (400 kHz); 5 ADC channels sampled via <code>analogRead()</code>.
    </div>
    <div class="flow-card">
      <strong>2. Anti-Noise EWMA Filtering</strong>
      ADC jitter dampened with exponential filter (α = 0.15) on each finger channel.
    </div>
    <div class="flow-card">
      <strong>3. Normalization & Clipping</strong>
      Raw readings converted to 0.0–1.0 bounds via calibrated NVS constants.
    </div>
    <div class="flow-card success">
      <strong>4. Transmit (ESP-NOW / MQTT)</strong>
      Packed into 33-byte struct or published as 9-field CSV over Wi-Fi.
    </div>
  </div>

  <div class="grid-2">
    <div class="grid-col">
      <h3>4.1 Sender Firmware (<code>sender_v2.ino</code>)</h3>
      <ul style="margin: 4px 0; padding-left: 18px;">
        <li>Maintains exact 40 ms cycle time (25 Hz) for fixed temporal resolution.</li>
        <li>Implements interactive calibration triggered by button long-press or serial command <code>C</code>.</li>
        <li>Smooths sensor readings with EWMA filter: <code>y[n] = α · x[n] + (1 - α) · y[n-1]</code>.</li>
      </ul>
    </div>
    <div class="grid-col">
      <h3>4.2 MQTT Sender (<code>mqtt_sender_v2.ino</code>)</h3>
      <ul style="margin: 4px 0; padding-left: 18px;">
        <li>Increases PubSubClient buffer from 256 to <strong>512 bytes</strong> to prevent truncation.</li>
        <li>Publishes 9-field CSV string to <code>signspeaker/glove/data</code>.</li>
        <li>Keeps ADC1 isolated from Wi-Fi modem transients using local bulk decoupling capacitor.</li>
      </ul>
    </div>
  </div>

  <div class="callout tip">
    <div class="callout-title">💡 Two-Step Guided Calibration Routine</div>
    <strong>Step 1 (3 seconds):</strong> User holds hand completely flat on a table. Firmware averages 75 samples per finger to determine <code>ADC_flat[0..4]</code>.<br>
    <strong>Step 2 (3 seconds):</strong> User curls fingers firmly into a fist. Firmware averages 75 samples to record <code>ADC_bent[0..4]</code>. Parameters commit to flash and confirm via <code>I,CALIB_OK</code>.
  </div>

  <div class="footer-note">
    <span>SignSpeaker Project — Phase 2 Engineering Plan</span>
    <span>STA × AIO Joint Applied Engineering</span>
    <span>Page 2 of 5</span>
  </div>

  <!-- ==================== PAGE 3: NODE-RED PIPELINE & FEATURE EXTRACTION ==================== -->
  <div class="page-break"></div>

  <div class="doc-header">
    <div class="doc-brand">
      <div class="doc-title-block">
        <h1>SignSpeaker — Node-RED Pipeline & ML Feature Engineering</h1>
        <p>Connection Manager, Segmentation Engine, and 121-Dimensional Vector Architecture</p>
      </div>
    </div>
    <div class="doc-badge">SECTION 5</div>
  </div>

  <h2>🔄 5. Node-RED Processing Pipeline Architecture</h2>
  <div class="grid-2">
    <div class="grid-col">
      <h3>5.1 Connection Manager (<code>serial-manager.js</code>)</h3>
      <p>The parser dynamically checks incoming token counts:</p>
      <ul style="margin: 4px 0; padding-left: 18px;">
        <li><strong>5 tokens:</strong> Emits legacy payload <code>{t, dev, gx, gy, gz, v:1}</code>.</li>
        <li><strong>9 tokens:</strong> Emits Phase 2 payload <code>{t, dev, gx, gy, gz, flex:[f0..f4], v:2}</code>.</li>
      </ul>
      <p>The internal simulator is upgraded to synthesize realistic 5-channel finger trajectories alongside gyro waveforms, enabling testing of the entire stack without hardware.</p>
    </div>
    <div class="grid-col">
      <h3>5.2 Gesture Segmentation Engine (<code>gesture-engine.js</code>)</h3>
      <p><strong>Crucial Architectural Decision:</strong> Motion triggers remain driven strictly by <strong>gyroscope magnitude</strong>:</p>
      <div style="background: #f1f5f9; padding: 5px 8px; border-radius: 4px; font-family: Consolas, monospace; font-size: 10px; border: 1px solid #e2e8f0; margin: 3px 0;">
        mag = sqrt(gx² + gy² + gz²)
      </div>
      <p>Flex sensors are not motion onset triggers — they define topological configuration during motion. The pre-roll buffer and state machine carry 9-element sample rows <code>[t, gx, gy, gz, f0, f1, f2, f3, f4]</code> seamlessly.</p>
    </div>
  </div>

  <h2>🧠 5.3 Feature Vector Architecture: Expansion from 66D to 121D</h2>
  <p>To empower the k-NN classifier to distinguish subtle finger configurations without losing temporal motion trajectory data, the feature vector expands from 66 to <strong>121 dimensions</strong> by appending a dedicated 55-dimensional flex block.</p>

  <table>
    <thead>
      <tr>
        <th style="width: 14%;">Feature Indices</th>
        <th style="width: 14%;">Sub-Block Name</th>
        <th style="width: 8%;">Dims</th>
        <th style="width: 64%;">Mathematical Formulation & Engineering Purpose</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><code>[0]</code></td>
        <td>Duration</td>
        <td>1D</td>
        <td>Total gesture elapsed time in milliseconds: <code>t_end - t_start</code>.</td>
      </tr>
      <tr>
        <td><code>[1..15]</code></td>
        <td>Gyro Per-Axis Stats</td>
        <td>15D</td>
        <td>5 statistical moments (Range, Mean, StdDev, Mean Absolute Value, Peak) across Gyro X, Y, Z.</td>
      </tr>
      <tr>
        <td><code>[16..17]</code></td>
        <td>Gyro Magnitude</td>
        <td>2D</td>
        <td>Mean energy and maximum peak of angular velocity magnitude vector.</td>
      </tr>
      <tr>
        <td><code>[18..65]</code></td>
        <td>Gyro Trajectory</td>
        <td>48D</td>
        <td>Temporal waveform resampled to 16 equidistant time-slices × 3 axes (X, Y, Z).</td>
      </tr>
      <tr style="background: #eff6ff; font-weight: 600;">
        <td colspan="4" style="color: #1e3a8a;">─── NEW PHASE 2 FLEX FEATURE BLOCK (55 DIMENSIONS) ───────────────────────────────────</td>
      </tr>
      <tr>
        <td><code>[66..90]</code></td>
        <td>Flex Statistical Distribution</td>
        <td>25D</td>
        <td>5 statistical metrics per finger (Thumb, Index, Middle, Ring, Pinky):
          <br>• Range: <code>max(f) - min(f)</code> (measures finger dynamic activity)
          <br>• Mean: <code>μ(f)</code> (average bend level during the gesture)
          <br>• StdDev: <code>σ(f)</code> (bend variance/stability)
          <br>• Mean Absolute Value (MAV): Overall finger engagement energy
          <br>• Absolute Peak: Extreme flexion point reached during the sign</td>
      </tr>
      <tr>
        <td><code>[91..95]</code></td>
        <td>Mean Static Pose</td>
        <td>5D</td>
        <td>Time-averaged bend of each finger across the entire gesture. Acts as an invariant "hand posture fingerprint" for static signs.</td>
      </tr>
      <tr>
        <td><code>[96..105]</code></td>
        <td>Onset Posture Snapshot</td>
        <td>10D</td>
        <td>Finger posture at the exact instant the gyro motion trigger tripped (first 2 time-slices × 5 fingers). Discriminates signs that start with identical hand shapes before diverging.</td>
      </tr>
      <tr>
        <td><code>[106..120]</code></td>
        <td>Coarse Flex Trajectory</td>
        <td>15D</td>
        <td>Temporal flex evolution resampled to 3 equidistant stages (Start, Midpoint, Finish) × 5 fingers. Captures opening/closing gestures without bloating dimensionality.</td>
      </tr>
      <tr style="background: #f1f5f9; font-weight: 700;">
        <td colspan="2">TOTAL DIMENSIONALITY</td>
        <td>121D</td>
        <td>66D Gyro Kinematics + 55D Flex Topology = Complete Gesture Representation</td>
      </tr>
    </tbody>
  </table>

  <div class="callout warn">
    <div class="callout-title">⚠️ Dataset Compatibility & Training Segregation Rule</div>
    <strong>Phase 1 and Phase 2 training recordings must never be mixed within the same trained model.</strong> Zero-padding missing flex features on legacy Phase 1 recordings introduces severe artificial geometric bias into the 121D Euclidean distance space. When Phase 2 hardware is deployed, take an archive snapshot of Phase 1 model/dataset, clear the active training set, and collect clean Phase 2 samples.
  </div>

  <div class="grid-2">
    <div class="grid-col">
      <h3>Model Serialization Schema</h3>
      <pre><code>{
  "version": 2,
  "featureCount": 121,
  "channels": ["gx","gy","gz","f0","f1","f2","f3","f4"],
  "flexEnabled": true,
  "k": 5,
  "labels": ["Hello", "I am", "Reem", "Thanks", ...],
  "samplesCount": 140
}</code></pre>
    </div>
    <div class="grid-col">
      <h3>Distance Metric Formulation</h3>
      <p>Standard k-NN calculates Euclidean distance over Z-score standardized features. Optionally, Phase 2 supports a weighted distance metric balancing gyro and flex sub-spaces:</p>
      <div style="background: #f1f5f9; padding: 6px 10px; border-radius: 4px; font-family: Consolas, monospace; font-size: 10px; border: 1px solid #e2e8f0;">
        D = sqrt( W_gyro · Σ(ΔZ_gyro)² + W_flex · Σ(ΔZ_flex)² )
      </div>
      <p style="font-size: 10px; color: #64748b; margin-top: 3px;">Default: <code>W_gyro = 1.0</code>, <code>W_flex = 1.2</code> to emphasize static finger discrimination.</p>
    </div>
  </div>

  <div class="footer-note">
    <span>SignSpeaker Project — Phase 2 Engineering Plan</span>
    <span>STA × AIO Joint Applied Engineering</span>
    <span>Page 3 of 5</span>
  </div>

  <!-- ==================== PAGE 4: DASHBOARD UI & ML IMPLICATIONS ==================== -->
  <div class="page-break"></div>

  <div class="doc-header">
    <div class="doc-brand">
      <div class="doc-title-block">
        <h1>SignSpeaker — Dashboard Evolution & Machine Learning</h1>
        <p>Live Articulation Visualizers, Calibration Wizard, and Classification Benchmarks</p>
      </div>
    </div>
    <div class="doc-badge">SECTION 6 & 7</div>
  </div>

  <h2>📊 6. Dashboard Interface Enhancements</h2>
  <div class="grid-2">
    <div class="grid-col">
      <h3>6.1 Live Sensor Panel: 5-Finger Articulation Bars</h3>
      <p>Below the 60 FPS Gyroscope Canvas chart, a dedicated <strong>Flex Telemetry Gauge</strong> visualizes finger posture in real time (25 Hz):</p>
      <ul style="margin: 4px 0; padding-left: 18px;">
        <li>5 dynamic vertical bar meters with color-coding:
          <br>• <strong>Thumb (T):</strong> Amber (<code>#f59e0b</code>)
          <br>• <strong>Index (I):</strong> Cyan (<code>#06b6d4</code>)
          <br>• <strong>Middle (M):</strong> Emerald (<code>#10b981</code>)
          <br>• <strong>Ring (R):</strong> Purple (<code>#8b5cf6</code>)
          <br>• <strong>Pinky (P):</strong> Orange (<code>#f97316</code>)
        </li>
        <li>Fills proportionally from 0.00 (flat) to 1.00 (flexed). Displays numeric readouts and highlights disconnected sensors.</li>
      </ul>
    </div>
    <div class="grid-col">
      <h3>6.2 Calibration Wizard Modal</h3>
      <p>An interactive modal accessible from the header and Training Studio guides users through glove calibration:</p>
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 7px 10px; margin: 4px 0;">
        <strong>1. "Open Palm Flat":</strong> Visual hand illustration with 3-second progress countdown bar.<br>
        <strong>2. "Clench Tight Fist":</strong> Visual fist illustration with 3-second countdown bar.<br>
        <strong>3. Verification Table:</strong> Displays captured flat/bent ADC delta per finger. Flags weak sensors (delta &lt; 800 counts).
      </div>
    </div>
  </div>

  <div class="grid-2">
    <div class="grid-col">
      <h3>6.3 Last Gesture Trace: Finger Timeline</h3>
      <p>The captured gesture card expands to include a 5-row temporal bend chart beneath the 3-axis gyro waveform, illustrating how fingers flexed or released throughout the active gesture window.</p>
    </div>
    <div class="grid-col">
      <h3>6.4 Feature Inspector: Grouped 121D Vector</h3>
      <p>The inspection modal breaks the 121D feature vector into 3 distinct color-coded bar chart groups: <em>Gyro Kinematics (0..65)</em>, <em>Flex Distribution (66..105)</em>, and <em>Flex Trajectory (106..120)</em>.</p>
    </div>
  </div>

  <h2>🤖 7. Machine Learning & Classification Analysis</h2>
  <div class="grid-2">
    <div class="grid-col">
      <h3>Projected Accuracy & Vocabulary Expansion</h3>
      <p>Phase 1 achieves 75–85% accuracy on 7 dynamic gestures, but fails on static signs. Phase 2 models are projected to reach <strong>92–97% accuracy</strong> across extended vocabulary:</p>
      <ul style="margin: 4px 0; padding-left: 18px;">
        <li>Completely eliminates confusion between outward waves and flat pushes.</li>
        <li>Enables single-handed alphabet signs (ESL / ASL fingerspelling).</li>
        <li>Supports complex two-phase compound words.</li>
      </ul>
    </div>
    <div class="grid-col">
      <h3>Sample Requirements & Hyperparameters</h3>
      <ul style="margin: 4px 0; padding-left: 18px;">
        <li><strong>Sample Density:</strong> Increases from 3–5 to <strong>10–20 samples per sign</strong> to populate the 121-dimensional manifold adequately.</li>
        <li><strong>k-NN Neighbors:</strong> k parameter increases from <code>k = 3</code> to <code>k = 5</code> to average across higher-dimensional variance.</li>
        <li><strong>Inference Latency:</strong> Computation remains under <strong>4.5 ms</strong> in Node-RED, easily satisfying real-time 40 ms cycle budgets.</li>
      </ul>
    </div>
  </div>

  <h2>🔀 8. End-to-End System Pipeline Flow</h2>
  <div class="diagram-box">┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ 🧤 PHASE 2 SMART GLOVE HARDWARE                                                                         │
│  MPU6050 (I2C: GPIO 22/23) ──► 3-Axis Gyro (gx, gy, gz) @ 25 Hz ──┐                                    │
│  5× Flex Sensors (ADC1: 34, 35, 32, 33, 36) ──► EWMA Filter ──────┴──► ESP32 Firmware Normalization    │
│  Outputs Extended 9-Field CSV: D,&lt;ms&gt;,&lt;gx&gt;,&lt;gy&gt;,&lt;gz&gt;,&lt;f0&gt;,&lt;f1&gt;,&lt;f2&gt;,&lt;f3&gt;,&lt;f4&gt;                        │
└───────────────────────────────────────────────────┬────────────────────────────────────────────────────┘
                                                    │ Wireless Transport (ESP-NOW 33B / MQTT Wi-Fi)
                                                    ▼
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ 🖥️ NODE-RED BACKEND PIPELINE (http://127.0.0.1:1880)                                                    │
│  1. serial-manager.js   ──► Auto-detects 9 tokens ──► Schema: {t, dev, gx, gy, gz, flex:[f0..f4], v:2} │
│  2. gesture-engine.js   ──► Motion Trigger: Gyro Mag only ──► Emits 9-channel sample window            │
│  3. dataset-model.js    ──► Computes 121D Feature Vector ──► Z-Score ──► k-NN (k=5) Inference          │
│  4. output.js           ──► Speech Synthesis (Web Audio TTS) + Wireless 16×2 LCD Receiver Relay         │
└───────────────────────────────────────────────────┬────────────────────────────────────────────────────┘
                                                    │ WebSocket Event Stream
                                                    ▼
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ 💻 DASHBOARD INTERFACE (http://127.0.0.1:1880/glove)                                                   │
│  • Live 3-Axis Gyro Chart (60 FPS)                • 5-Channel Real-Time Finger Bend Bars (25 Hz)       │
│  • Last Gesture Waveform + Finger Timeline        • Interactive Calibration Wizard Modal               │
│  • 121D Feature Vector Inspector                  • Model Accuracy & Per-Sign Discriminative Metrics   │
└────────────────────────────────────────────────────────────────────────────────────────────────────────┘</div>

  <div class="footer-note">
    <span>SignSpeaker Project — Phase 2 Engineering Plan</span>
    <span>STA × AIO Joint Applied Engineering</span>
    <span>Page 4 of 5</span>
  </div>

  <!-- ==================== PAGE 5: CHECKLIST, RISKS & DECISIONS ==================== -->
  <div class="page-break"></div>

  <div class="doc-header">
    <div class="doc-brand">
      <div class="doc-title-block">
        <h1>SignSpeaker — Roadmap, Risk Matrix & Architectural Decisions</h1>
        <p>Implementation Checklist, Failure Mode Mitigations, and Final Engineering Summary</p>
      </div>
    </div>
    <div class="doc-badge">SECTION 9, 10, 11, 12</div>
  </div>

  <h2>🧪 9. Simulator Extension Matrix for Phase 2 Testing</h2>
  <table>
    <thead>
      <tr>
        <th style="width: 15%;">Sign Token</th>
        <th style="width: 25%;">Simulated Gyroscope Kinematics</th>
        <th style="width: 35%;">Simulated 5-Channel Flex Patterns</th>
        <th style="width: 25%;">Verification Objective</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><code>Hello</code></td>
        <td>Sinusoidal X/Z oscillation (wave)</td>
        <td>All fingers extended (f0..f4 ≈ 0.10) with mild oscillation</td>
        <td>Verifies dynamic hand + open palm fusion</td>
      </tr>
      <tr>
        <td><code>I am</code></td>
        <td>Downward vertical Y deflection</td>
        <td>Index flat (f1 ≈ 0.05); Thumb, Mid, Ring, Pinky curled (&gt; 0.85)</td>
        <td>Tests isolated single-finger pointing</td>
      </tr>
      <tr>
        <td><code>Reem</code></td>
        <td>Small low-amplitude wrist flourish</td>
        <td>Index & Middle crossed/flat (f1, f2 ≈ 0.10), Ring/Pinky curled</td>
        <td>Validates fine-grained finger separation</td>
      </tr>
      <tr>
        <td><code>Thanks</code></td>
        <td>Forward linear push along Z axis</td>
        <td>All 5 fingers strictly flat and rigid (all f &lt; 0.05)</td>
        <td>Differentiates wave from flat push</td>
      </tr>
      <tr>
        <td><code>Thank you</code></td>
        <td>Forward outward arc</td>
        <td>Starts flat (f ≈ 0.05), curls into partial cup during release</td>
        <td>Tests multi-stage flex trajectory</td>
      </tr>
      <tr>
        <td><code>Hello Reem</code></td>
        <td>Compound dual-peak wrist trajectory</td>
        <td>Transitions from open wave into "R" finger configuration</td>
        <td>Tests compound gesture classification</td>
      </tr>
      <tr>
        <td><code>I am Reem</code></td>
        <td>Compound point then small flourish</td>
        <td>Index point (f1=0) transitions into name finger signature</td>
        <td>Validates compound multi-stage posture</td>
      </tr>
    </tbody>
  </table>

  <h2>📋 10. Phase 2 Implementation Roadmap Checklist</h2>
  <div class="grid-2">
    <div class="grid-col">
      <h3 style="color: #0b1329;">Track A: Hardware & Electronics</h3>
      <ul class="checklist">
        <li>Procure 5× 2.2" or 4.5" bi-directional flex sensors</li>
        <li>Build 5× 10 kΩ 1% metal film divider circuit on wrist protoboard</li>
        <li>Solder wiring loom to ESP32 ADC1 pins (34, 35, 32, 33, 36)</li>
        <li>Mount sensors to dorsal glove fabric with flexible adhesive backing</li>
        <li>Validate ADC delta &gt; 1200 counts between flat and 90° bend</li>
      </ul>

      <h3 style="color: #0b1329; margin-top: 8px;">Track B: Firmware Engineering</h3>
      <ul class="checklist">
        <li>Write <code>sender_v2.ino</code> with 25 Hz ADC1 polling & EWMA filter</li>
        <li>Implement guided serial/button calibration with NVS storage</li>
        <li>Expand ESP-NOW packet to 33-byte <code>SensorData</code> struct</li>
        <li>Write <code>mqtt_sender_v2.ino</code> with 512-byte buffer & 9-field CSV</li>
        <li>Verify zero packet drops across 10,000 continuous transmissions</li>
      </ul>
    </div>
    <div class="grid-col">
      <h3 style="color: #0b1329;">Track C: Node-RED Backend Pipeline</h3>
      <ul class="checklist">
        <li>Upgrade <code>serial-manager.js</code> with 9-field parser & v1/v2 detector</li>
        <li>Implement 5-channel synthetic flex patterns in simulator</li>
        <li>Update <code>gesture-engine.js</code> buffer to store 9-element sample rows</li>
        <li>Expand <code>dataset-model.js</code> feature extraction from 66D to 121D</li>
        <li>Deploy flows via automated script <code>node-red/build-flows.js</code></li>
      </ul>

      <h3 style="color: #0b1329; margin-top: 8px;">Track D: Dashboard UI & Validation</h3>
      <ul class="checklist">
        <li>Build 5-finger color-coded real-time bar gauge on Live panel</li>
        <li>Add finger bend timeline chart to Last Gesture trace card</li>
        <li>Implement Calibration Wizard modal with countdown bars</li>
        <li>Update 121D grouped visualizer in Feature Inspector modal</li>
        <li>Collect 20 samples per sign; evaluate leave-one-out accuracy &gt; 92%</li>
      </ul>
    </div>
  </div>

  <h2>⚠️ 11. Risk Matrix & Engineering Mitigations</h2>
  <table>
    <thead>
      <tr>
        <th style="width: 25%;">Identified Technical Risk</th>
        <th style="width: 10%;">Probability</th>
        <th style="width: 10%;">Impact</th>
        <th style="width: 55%;">Architectural Mitigation Strategy</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>ADC2 Wi-Fi Radio Collision</strong></td>
        <td>Certain</td>
        <td>Critical</td>
        <td>Strictly isolate flex sensors to <strong>ADC1 (GPIO 32–36)</strong>. ADC2 pins are prohibited in firmware.</td>
      </tr>
      <tr>
        <td><strong>ESP32 ADC Non-Linearity</strong></td>
        <td>High</td>
        <td>Medium</td>
        <td>On-device two-point calibration normalizes active travel range; divider tuned for 0.3V–2.8V linear zone.</td>
      </tr>
      <tr>
        <td><strong>Fabric Creep / Sensor Drift</strong></td>
        <td>Medium</td>
        <td>Medium</td>
        <td>Glove calibration takes 6 seconds and can be re-run on demand; dashboard flags uncalibrated offsets.</td>
      </tr>
      <tr>
        <td><strong>Sensor Hardware Failure</strong></td>
        <td>Low</td>
        <td>High</td>
        <td>Dashboard settings provide per-channel software disables; feature extractor imputes zero variance for dead channels.</td>
      </tr>
      <tr>
        <td><strong>Higher Dimensionality Overfitting</strong></td>
        <td>Medium</td>
        <td>Medium</td>
        <td>Increase training density from 3 to 15+ samples per word; adjust k-NN neighbors from k=3 to k=5.</td>
      </tr>
    </tbody>
  </table>

  <h2>📌 12. Summary of Architectural Design Decisions</h2>
  <table>
    <thead>
      <tr>
        <th style="width: 25%;">System Sub-System</th>
        <th style="width: 25%;">Phase 2 Architectural Decision</th>
        <th style="width: 50%;">Engineering Rationale & System Benefit</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>Gesture Triggering</strong></td>
        <td><strong>Gyroscope Magnitude Only</strong></td>
        <td>Flex sensors change slowly and are prone to baseline jitter; gyro magnitude provides crisp motion boundaries.</td>
      </tr>
      <tr>
        <td><strong>Sampling Cadence</strong></td>
        <td><strong>Synchronous 25 Hz (40 ms)</strong></td>
        <td>Samples gyro and all 5 flex sensors simultaneously in a single loop, eliminating temporal phase skew.</td>
      </tr>
      <tr>
        <td><strong>Calibration Domain</strong></td>
        <td><strong>On-Transmitter (Firmware)</strong></td>
        <td>Normalizing to 0.0–1.0 on-device saves transmission bandwidth and keeps backend processing clean.</td>
      </tr>
      <tr>
        <td><strong>Feature Vector Scale</strong></td>
        <td><strong>121 Dimensions (66D + 55D)</strong></td>
        <td>Captures distribution (25D), static pose (5D), onset (10D), and temporal coarse trajectory (15D).</td>
      </tr>
      <tr>
        <td><strong>Dataset Management</strong></td>
        <td><strong>Clean Segregation</strong></td>
        <td>Zero-padding Phase 1 recordings biases the 121D Euclidean manifold; models must use dedicated Phase 2 sets.</td>
      </tr>
    </tbody>
  </table>

  <div class="footer-note">
    <span>SignSpeaker Project — Phase 2 Engineering Plan</span>
    <span>STA × AIO Joint Applied Engineering</span>
    <span>Page 5 of 5</span>
  </div>

</body>
</html>
`;

// 3. Write HTML file to scratch/phase2_plan.html
const htmlPath = path.resolve(__dirname, 'phase2_plan.html');
fs.writeFileSync(htmlPath, htmlContent, 'utf8');
console.log('HTML written to:', htmlPath, `(${fs.statSync(htmlPath).size} bytes)`);

// 4. Render to PDF using Headless Edge in the project folder
const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const projectRoot = path.resolve(__dirname, '..');
const outputPdfPath = path.resolve(projectRoot, 'Phase2_Flex_Sensor_Integration_Plan.pdf');

console.log('Rendering PDF to:', outputPdfPath);

try {
  const result = execFileSync(edgePath, [
    '--headless',
    '--disable-gpu',
    '--run-all-compositor-stages-before-draw',
    `--print-to-pdf=${outputPdfPath}`,
    htmlPath
  ], { timeout: 45000 });
  console.log('Edge output:', result ? result.toString() : 'Success');
} catch (err) {
  console.error('Edge execution error:', err.message);
}

// 5. Verify PDF
if (fs.existsSync(outputPdfPath)) {
  const stat = fs.statSync(outputPdfPath);
  console.log('SUCCESS: PDF generated successfully!');
  console.log('Location:', outputPdfPath);
  console.log('File Size:', stat.size, 'bytes');
} else {
  console.error('FAILED: PDF file was not created.');
  process.exit(1);
}
