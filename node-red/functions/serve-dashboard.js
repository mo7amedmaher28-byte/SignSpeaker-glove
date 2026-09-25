// Serves the landing page, dashboard cockpit, and data/image downloads.
//   GET /glove                    -> dashboard/landing.html (Landing page explaining STA x AIO & SignSpeaker)
//   GET /glove/dashboard          -> dashboard/index.html (Live operational cockpit)
//   GET /glove?view=dashboard     -> dashboard/index.html
//   GET /glove/landing            -> dashboard/landing.html
//   GET /glove/data/dataset.json  -> raw training recordings
//   GET /glove/data/dataset.csv   -> same recordings, one row per gyro sample
//   GET /glove/data/model.json    -> trained model
//   GET /glove/images/:file       -> Images/:file (MIME detected via binary magic bytes)

const dir = env.get('GLOVE_DIR');
const file = msg.req.params && msg.req.params.file;
msg.headers = { 'Cache-Control': 'no-store' };

function send(status, type, body) {
    msg.statusCode = status;
    msg.headers['Content-Type'] = type;
    msg.payload = body;
    return msg;
}

try {
    const reqUrl = (msg.req && (msg.req.path || msg.req.url)) || '';
    const query = (msg.req && msg.req.query) || {};

    // Route explicit requests for dashboard or landing
    if (file === 'dashboard' || file === 'cockpit' || file === 'index.html') {
        return send(200, 'text/html; charset=utf-8', fs.readFileSync(path.join(dir, 'dashboard', 'index.html'), 'utf8'));
    }
    if (file === 'landing' || file === 'about' || file === 'landing.html') {
        return send(200, 'text/html; charset=utf-8', fs.readFileSync(path.join(dir, 'dashboard', 'landing.html'), 'utf8'));
    }
    if (file === 'flowcharts' || file === 'flowcharts.html' || file === 'flowchart' || reqUrl.includes('/flowchart')) {
        return send(200, 'text/html; charset=utf-8', fs.readFileSync(path.join(dir, 'flowcharts', 'index.html'), 'utf8'));
    }

    if (!file) {
        const isDashboard = query.view === 'dashboard' || query.app === 'cockpit' ||
                            reqUrl.endsWith('/dashboard') || reqUrl.endsWith('/cockpit');
        const targetHtml = isDashboard ? 'index.html' : 'landing.html';
        return send(200, 'text/html; charset=utf-8', fs.readFileSync(path.join(dir, 'dashboard', targetHtml), 'utf8'));
    }

    if (file === 'dataset.json' || file === 'model.json') {
        msg.headers['Content-Disposition'] = 'attachment; filename="' + file + '"';
        return send(200, 'application/json', fs.readFileSync(path.join(dir, 'data', file), 'utf8'));
    }
    if (file === 'dataset.csv') {
        const ds = JSON.parse(fs.readFileSync(path.join(dir, 'data', 'dataset.json'), 'utf8'));
        const rows = ['sample_id,label,recorded_at,t_ms,gyro_x,gyro_y,gyro_z'];
        for (const s of ds.samples) {
            const at = new Date(s.at).toISOString();
            for (const r of s.samples) rows.push([s.id, '"' + s.label + '"', at, r[0], r[1], r[2], r[3]].join(','));
        }
        msg.headers['Content-Disposition'] = 'attachment; filename="dataset.csv"';
        return send(200, 'text/csv', rows.join('\n') + '\n');
    }

    const decodedFile = decodeURIComponent(file);
    const imgPath = path.join(dir, 'Images', decodedFile);
    if (fs.existsSync(imgPath) && fs.statSync(imgPath).isFile()) {
        const buf = fs.readFileSync(imgPath);
        let mime = 'application/octet-stream';
        if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) {
            mime = 'image/png';
        } else if (buf.length >= 2 && buf[0] === 0xFF && buf[1] === 0xD8) {
            mime = 'image/jpeg';
        } else if (decodedFile.toLowerCase().endsWith('.svg')) {
            mime = 'image/svg+xml';
        }
        msg.headers['Cache-Control'] = 'no-cache, must-revalidate';
        return send(200, mime, buf);
    }
    return send(404, 'text/plain', 'Not found');
} catch (e) {
    return send(404, 'text/plain', 'Not available yet: ' + e.message);
}
