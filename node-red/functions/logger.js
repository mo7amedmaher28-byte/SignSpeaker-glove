// Raw Logger
// Continuously stores every gyro sample to a daily CSV file:
//   data/raw/gyro-YYYY-MM-DD.csv
// Rows are buffered and appended about once per second.
//
// In:  {topic:'sample'} from Serial Manager, {topic:'tick'}, {topic:'cmd', payload:{cmd:'logging'|'status'}}
// Out 1: dashboard events

const DIR = path.join(env.get('GLOVE_DIR'), 'data', 'raw');
const HEADER = 'time_iso,epoch_ms,device_ms,gyro_x,gyro_y,gyro_z,mode,recording_label,phase\n';

let lg = context.get('lg');
if (!lg) {
    lg = { enabled: true, rows: [], file: '', written: 0, lastFlush: Date.now() };
    try { fs.mkdirSync(DIR, { recursive: true }); } catch (e) { }
    context.set('lg', lg);
}

function fileFor(ts) {
    const d = new Date(ts);
    const p = n => String(n).padStart(2, '0');
    return path.join(DIR, 'gyro-' + d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + '.csv');
}

function flush() {
    lg.lastFlush = Date.now();
    if (!lg.rows.length) return;
    const rows = lg.rows;
    lg.rows = [];
    const file = fileFor(Date.now());
    let text = rows.join('\n') + '\n';
    if (!fs.existsSync(file)) text = HEADER + text;
    lg.file = file;
    fs.appendFile(file, text, err => { if (err) node.warn('Log write failed: ' + err.message); });
    lg.written += rows.length;
}

function statusEvent() {
    return { topic: 'logger', payload: { enabled: lg.enabled, file: lg.file || fileFor(Date.now()), written: lg.written } };
}

if (msg.topic === 'sample') {
    if (!lg.enabled) return null;
    const s = msg.payload;
    lg.rows.push([
        new Date(s.t).toISOString(), s.t, isNaN(s.dev) ? '' : s.dev,
        s.gx, s.gy, s.gz,
        flow.get('mode') || '', '"' + String(flow.get('recLabel') || '').replace(/"/g, '') + '"', flow.get('phase') || ''
    ].join(','));
    if (lg.rows.length >= 50 || Date.now() - lg.lastFlush > 1000) flush();
    return null;
}

if (msg.topic === 'tick') {
    flush();
    return statusEvent();
}

if (msg.topic === 'cmd') {
    const c = msg.payload || {};
    if (c.cmd === 'logging') {
        lg.enabled = !!c.enabled;
        flush();
    }
    return statusEvent();
}
return null;
