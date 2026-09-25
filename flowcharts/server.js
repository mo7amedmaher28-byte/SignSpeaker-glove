// SignSpeaker Flowchart Studio — Localhost HTTP Server
// Serves index.html, style.css, app.js and project images from /Images
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = parseInt(process.env.PORT || '3000', 10);
const DIR = __dirname;
const PROJECT_DIR = path.resolve(__dirname, '..');
const IMAGES_DIR = path.join(PROJECT_DIR, 'Images');

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
    try {
        let reqPath = decodeURIComponent(req.url.split('?')[0]);
        if (reqPath === '/' || reqPath === '') reqPath = '/index.html';

        let filePath;
        // Route image requests from /images/... to the project's Images directory
        if (reqPath.startsWith('/images/')) {
            const imgName = reqPath.substring(8);
            filePath = path.join(IMAGES_DIR, imgName);
        } else {
            filePath = path.join(DIR, reqPath);
        }

        if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
            const ext = path.extname(filePath).toLowerCase();
            const mime = MIME_TYPES[ext] || 'application/octet-stream';
            res.writeHead(200, {
                'Content-Type': mime,
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Access-Control-Allow-Origin': '*'
            });
            fs.createReadStream(filePath).pipe(res);
        } else {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('404 Not Found: ' + reqPath);
        }
    } catch (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('500 Server Error: ' + err.message);
    }
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`\n======================================================`);
    console.log(`🖐️ SignSpeaker Flowchart Studio is LIVE!`);
    console.log(`🌐 Local Host:  http://localhost:${PORT}`);
    console.log(`🌐 Localhost IP: http://127.0.0.1:${PORT}`);
    console.log(`======================================================\n`);
});

server.on('error', (e) => {
    if (e.code === 'EADDRINUSE') {
        const nextPort = PORT + 1;
        console.warn(`Port ${PORT} in use, trying port ${nextPort}...`);
        server.listen(nextPort, '0.0.0.0');
    } else {
        console.error('Server error:', e);
    }
});
