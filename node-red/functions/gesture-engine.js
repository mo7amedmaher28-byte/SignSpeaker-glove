// Gesture Engine
// Event-based segmentation of the gyro stream, same idea as the receiver firmware:
//   WAITING -> movement > start -> ACTIVE -> quiet for QUIET ms -> FINISHED -> COOLDOWN
// Also owns the mode (train / recognize) and the recording session.
//
// In:  {topic:'sample'} from Serial Manager, {topic:'cmd', payload:{cmd,...}} from dashboard
// Out 1: finished gesture -> Dataset & Model
// Out 2: dashboard events (engine, settings)
// Out 3: LCD status line -> Serial Manager

const SETTINGS_FILE = path.join(env.get('GLOVE_DIR'), 'data', 'settings.json');
const DEFAULTS = { start: 0.20, end: 0.12, quiet: 250, minTime: 120, maxTime: 1500, cooldown: 700, preRoll: 3 };
const SENTENCE_DEFAULTS = { start: 0.18, end: 0.11, quiet: 420, minTime: 300, maxTime: 4500, cooldown: 800, preRoll: 3 };

let s = context.get('s');
if (!s) {
    let saved = {};
    try { saved = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8')); } catch (e) { }
    s = {
        settings: Object.assign({}, DEFAULTS, saved.settings || {}),
        mode: saved.mode === 'recognize' ? 'recognize' : 'train',
        recording: false, label: saved.label || 'Hello',
        phase: 'waiting', buf: [], pre: [], startT: 0, quietSince: 0, cooldownUntil: 0,
        bias: saved.bias || { x: 0, y: 0, z: 0 }, biasTick: 0
    };
    context.set('s', s);
    publishFlowState();
}

function save() {
    try {
        fs.writeFileSync(SETTINGS_FILE, JSON.stringify({ settings: s.settings, mode: s.mode, label: s.label, bias: s.bias }, null, 2));
    } catch (e) { node.warn('Cannot save settings: ' + e.message); }
}

function publishFlowState() {
    flow.set('mode', s.mode);
    flow.set('recLabel', s.recording ? s.label : '');
    flow.set('phase', s.phase);
}

function uiState() {
    return {
        topic: 'engine',
        payload: { mode: s.mode, recording: s.recording, label: s.label, phase: s.phase, settings: s.settings, bias: s.bias }
    };
}

function lcdStatus() {
    if (s.mode === 'recognize') return { topic: 'write', payload: 'L,SignSpeaker|Waiting...' };
    if (s.recording) {
        const lbl = s.label || '';
        if (lbl.length <= 11) return { topic: 'write', payload: 'L,Recording:|' + lbl };
        const words = lbl.split(' ');
        let line1 = 'Rec:', line2 = '';
        for (const w of words) {
            if (!line2 && (line1 + ' ' + w).length <= 16) {
                line1 += ' ' + w;
            } else {
                line2 = (line2 ? line2 + ' ' : '') + w;
            }
        }
        return { topic: 'write', payload: 'L,' + line1.substring(0, 16) + '|' + line2.substring(0, 16) };
    }
    return { topic: 'write', payload: 'L,Training mode|Paused' };
}

function setPhase(p) {
    if (s.phase === p) return;
    s.phase = p;
    flow.set('phase', p);
    node.send([null, { topic: 'phase', payload: p }, null]);
}

// The MPU6050 gyro doesn't read zero at rest (this one: X ~ -0.09, Z ~ 0.05 rad/s).
// While waiting with the hand roughly still, track that offset slowly and subtract
// it from every sample, so "still" really means ~0 for the start/end thresholds.
const BIAS_ALPHA = 0.03;

function trackBias(sample, correctedMag) {
    if (s.phase !== 'waiting' || correctedMag >= s.settings.start) return;
    const b = s.bias;
    b.x += BIAS_ALPHA * (sample.gx - b.x);
    b.y += BIAS_ALPHA * (sample.gy - b.y);
    b.z += BIAS_ALPHA * (sample.gz - b.z);
}

function step(sample) {
    const cfg = s.settings;
    const now = isNaN(sample.dev) ? sample.t : sample.dev;
    const b = s.bias;
    const gx = sample.gx - b.x, gy = sample.gy - b.y, gz = sample.gz - b.z;
    const mag = Math.sqrt(gx * gx + gy * gy + gz * gz);
    const row = { time: now, gx, gy, gz };

    trackBias(sample, mag);
    if (++s.biasTick % 25 === 0) {
        node.send([null, { topic: 'bias', payload: { x: +b.x.toFixed(4), y: +b.y.toFixed(4), z: +b.z.toFixed(4) } }, null]);
        if (s.biasTick % 750 === 0) save();
    }

    if (s.phase === 'cooldown' && now >= s.cooldownUntil) setPhase('waiting');

    if (s.phase === 'cooldown') return;

    if (s.phase === 'waiting') {
        s.pre.push(row);
        if (s.pre.length > cfg.preRoll) s.pre.shift();
        if (mag > cfg.start) {
            s.buf = s.pre.slice();
            s.pre = [];
            s.startT = now;
            s.quietSince = 0;
            setPhase('active');
        }
        return;
    }

    // active
    s.buf.push(row);
    if (mag < cfg.end) {
        if (!s.quietSince) s.quietSince = now;
    } else {
        s.quietSince = 0;
    }

    const quietDone = s.quietSince && now - s.quietSince >= cfg.quiet;
    if (!quietDone && now - s.startT < cfg.maxTime) return;

    const endT = quietDone ? s.quietSince : now;
    const duration = endT - s.startT;
    const rows = s.buf.filter(r => r.time <= endT);
    s.buf = [];

    if (duration < cfg.minTime || rows.length < 3) {
        setPhase('waiting');
        node.send([null, { topic: 'discarded', payload: { duration } }, null]);
        return;
    }

    s.cooldownUntil = now + cfg.cooldown;
    setPhase('cooldown');

    const t0 = rows[0].time;
    node.send([{
        topic: 'gesture',
        mode: s.mode,
        recording: s.mode === 'train' && s.recording,
        label: s.label,
        payload: {
            at: Date.now(),
            duration,
            samples: rows.map(r => [r.time - t0, +r.gx.toFixed(4), +r.gy.toFixed(4), +r.gz.toFixed(4)])
        }
    }, null, null]);
}

if (msg.topic === 'sample') {
    step(msg.payload);
    return null;
}

// Receiver (re)booted or simulator started: restore the LCD status screen.
if (msg.topic === 'device') return [null, null, lcdStatus()];

if (msg.topic !== 'cmd') return null;

const c = msg.payload || {};
switch (c.cmd) {
    case 'mode':
        s.mode = c.mode === 'recognize' ? 'recognize' : 'train';
        s.recording = false;
        save();
        break;
    case 'record':
        s.mode = 'train';
        s.recording = true;
        if (c.label) {
            s.label = String(c.label).trim();
            if (s.label.includes(' ') && s.settings.maxTime <= 1500) {
                s.settings.maxTime = SENTENCE_DEFAULTS.maxTime;
                s.settings.quiet = Math.max(s.settings.quiet, SENTENCE_DEFAULTS.quiet);
            }
        }
        save();
        break;
    case 'stop':
        s.recording = false;
        break;
    case 'label':
        if (c.label) {
            s.label = String(c.label).trim();
            if (s.label.includes(' ') && s.settings.maxTime <= 1500) {
                s.settings.maxTime = SENTENCE_DEFAULTS.maxTime;
                s.settings.quiet = Math.max(s.settings.quiet, SENTENCE_DEFAULTS.quiet);
            }
        }
        save();
        break;
    case 'preset':
        if (c.preset === 'sentence') {
            s.settings = Object.assign({}, SENTENCE_DEFAULTS);
        } else {
            s.settings = Object.assign({}, DEFAULTS);
        }
        save();
        break;
    case 'settings': {
        const n = {};
        for (const k of Object.keys(DEFAULTS)) {
            const v = parseFloat((c.settings || {})[k]);
            n[k] = isFinite(v) && v >= 0 ? v : s.settings[k];
        }
        if (n.end > n.start) n.end = n.start;
        s.settings = n;
        save();
        break;
    }
    case 'resetSettings':
        s.settings = Object.assign({}, DEFAULTS);
        save();
        break;
    case 'status':
        break;
    default:
        return null;
}

publishFlowState();
return [null, uiState(), lcdStatus()];
