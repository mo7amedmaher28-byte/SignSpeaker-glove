// Output
// Turns one prediction into the final word and sends that same text to the LCD and
// the laptop speaker, so what is shown and what is spoken always match.
//
// In:  {topic:'prediction'} from Dataset & Model, {topic:'cmd'} from dashboard
// Out 1: LCD line -> Serial Manager   Out 2: text -> Speaker   Out 3: dashboard events

const FILE = path.join(env.get('GLOVE_DIR'), 'data', 'output.json');
const DEFAULTS = { speak: true, lcd: true, minConfidence: 0.55, speakUnknown: false };

let cfg = context.get('cfg');
if (!cfg) {
    let saved = {};
    try { saved = JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch (e) { }
    cfg = Object.assign({}, DEFAULTS, saved);
    context.set('cfg', cfg);
}

function settingsEvent() {
    return { topic: 'outputSettings', payload: cfg };
}

function formatLcd(text) {
    if (text === 'Unknown') return 'W,Unknown';
    if (text.length <= 16) return 'W,' + text;
    const words = text.split(' ');
    let l1 = '', l2 = '';
    for (const w of words) {
        if (!l2 && (l1 ? l1 + ' ' + w : w).length <= 16) {
            l1 = l1 ? l1 + ' ' + w : w;
        } else {
            l2 = l2 ? l2 + ' ' + w : w;
        }
    }
    return 'L,' + l1.substring(0, 16) + '|' + l2.substring(0, 16);
}

if (msg.topic === 'prediction') {
    const p = msg.payload;
    const confident = p.confidence === null || p.confidence >= cfg.minConfidence;
    const text = p.known && confident ? p.label : 'Unknown';
    const isUnknown = text === 'Unknown';

    const lcd = cfg.lcd ? { topic: 'write', payload: formatLcd(text) } : null;
    const speak = cfg.speak && (!isUnknown || cfg.speakUnknown)
        ? { topic: 'say', payload: isUnknown ? 'Unknown gesture' : text } : null;

    const ui = {
        topic: 'output',
        payload: Object.assign({}, p, { text, spoken: !!speak, lcdSent: !!lcd, at: Date.now() })
    };
    return [lcd, speak, ui];
}

if (msg.topic === 'cmd') {
    const c = msg.payload || {};
    if (c.cmd === 'outputSettings') {
        const n = c.settings || {};
        if ('speak' in n) cfg.speak = !!n.speak;
        if ('lcd' in n) cfg.lcd = !!n.lcd;
        if ('speakUnknown' in n) cfg.speakUnknown = !!n.speakUnknown;
        if ('minConfidence' in n) {
            const v = parseFloat(n.minConfidence);
            if (isFinite(v)) cfg.minConfidence = Math.min(1, Math.max(0, v));
        }
        try { fs.writeFileSync(FILE, JSON.stringify(cfg, null, 2)); } catch (e) { }
        return [null, null, settingsEvent()];
    }
    if (c.cmd === 'testOutput') {
        const text = String(c.text || 'Hello').substring(0, 48);
        return [
            cfg.lcd ? { topic: 'write', payload: formatLcd(text) } : null,
            cfg.speak ? { topic: 'say', payload: text } : null,
            { topic: 'output', payload: { text, label: text, known: true, confidence: null, source: 'test', spoken: cfg.speak, lcdSent: cfg.lcd, at: Date.now() } }
        ];
    }
    if (c.cmd === 'status') return [null, null, settingsEvent()];
}
return null;
