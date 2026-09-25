// Builds the SignSpeaker Node-RED flow from the files in ./functions and deploys it.
//
//   node build-flows.js            build flows.json and deploy to http://127.0.0.1:1880
//   node build-flows.js --no-deploy   only write flows.json (import it manually in the editor)
//
// Function code lives in functions/<name>.js (optional <name>.final.js runs on stop),
// so it can be edited as normal JavaScript instead of inside the Node-RED editor.

const fs = require('fs');
const path = require('path');

const PROJECT_DIR = path.resolve(__dirname, '..');
const FN_DIR = path.join(__dirname, 'functions');
const NODE_RED = process.env.NODE_RED_URL || 'http://127.0.0.1:1880';
const TAB = 'ss_tab';

fs.mkdirSync(path.join(PROJECT_DIR, 'data', 'raw'), { recursive: true });

const read = f => fs.existsSync(path.join(FN_DIR, f)) ? fs.readFileSync(path.join(FN_DIR, f), 'utf8') : '';
const LIB = {
    fs: { var: 'fs', module: 'fs' },
    path: { var: 'path', module: 'path' },
    serialport: { var: 'SerialPortLib', module: 'serialport' },
    cp: { var: 'cp', module: 'child_process' },
    mqtt: { var: 'mqtt', module: 'mqtt' }
};

function fn(id, name, file, outputs, libs, x, y, wires) {
    return {
        id, type: 'function', z: TAB, name,
        func: read(file + '.js'),
        outputs, timeout: 0, noerr: 0,
        initialize: '', finalize: read(file + '.final.js'),
        libs: libs.map(l => LIB[l]),
        x, y, wires
    };
}

function comment(id, name, info, x, y) {
    return { id, type: 'comment', z: TAB, name, info, x, y, wires: [] };
}

const nodes = [
    {
        id: TAB, type: 'tab', label: 'SignSpeaker', disabled: false,
        info: 'Smart glove training + recognition. Dashboard: http://127.0.0.1:1880/glove\nFunction code is generated from node-red/functions/*.js by build-flows.js.',
        env: [{ name: 'GLOVE_DIR', value: PROJECT_DIR, type: 'str' }]
    },
    { id: 'ss_ws', type: 'websocket-listener', path: '/ws/glove', wholemsg: 'false' },

    comment('ss_c1', 'Glove data: receiver ESP32 (USB serial) -> segmentation -> dataset / model -> LCD + speaker',
        'Dashboard: http://127.0.0.1:1880/glove', 330, 40),

    {
        id: 'ss_tick', type: 'inject', z: TAB, name: 'every 1 s',
        props: [{ p: 'topic', vt: 'str' }], topic: 'tick',
        repeat: '1', crontab: '', once: true, onceDelay: '0.5',
        x: 130, y: 120, wires: [['ss_serial', 'ss_logger']]
    },
    {
        id: 'ss_boot', type: 'inject', z: TAB, name: 'start speech',
        props: [{ p: 'topic', vt: 'str' }, { p: 'payload' }], topic: 'cmd', payload: '{"cmd":"status"}', payloadType: 'json',
        repeat: '', crontab: '', once: true, onceDelay: '1',
        x: 140, y: 420, wires: [['ss_speaker']]
    },

    fn('ss_serial', 'Connection Manager', 'serial-manager', 2, ['serialport', 'fs', 'path', 'mqtt'], 340, 160,
        [['ss_engine', 'ss_logger', 'ss_toui'], ['ss_toui']]),
    fn('ss_engine', 'Gesture Engine', 'gesture-engine', 3, ['fs', 'path'], 580, 160,
        [['ss_dataset'], ['ss_toui'], ['ss_serial']]),
    fn('ss_dataset', 'Dataset & Model', 'dataset-model', 3, ['fs', 'path'], 820, 160,
        [['ss_toui'], ['ss_output'], ['ss_serial']]),
    fn('ss_output', 'Output (LCD + speech)', 'output', 3, ['fs', 'path'], 1080, 160,
        [['ss_serial'], ['ss_speaker'], ['ss_toui']]),
    fn('ss_speaker', 'Speaker', 'speaker', 1, ['cp'], 1080, 280, [['ss_toui']]),
    fn('ss_logger', 'Raw Logger (CSV)', 'logger', 1, ['fs', 'path'], 580, 280, [['ss_toui']]),

    { id: 'ss_wsin', type: 'websocket in', z: TAB, name: 'dashboard commands', server: 'ss_ws', client: '', x: 150, y: 360, wires: [['ss_router']] },
    fn('ss_router', 'Command Router', 'ui-router', 6, [], 370, 360,
        [['ss_serial'], ['ss_engine'], ['ss_dataset'], ['ss_output'], ['ss_speaker'], ['ss_logger']]),
    fn('ss_toui', 'to dashboard', 'to-ui', 1, [], 1300, 220, [['ss_wsout']]),
    { id: 'ss_wsout', type: 'websocket out', z: TAB, name: 'dashboard events', server: 'ss_ws', client: '', x: 1490, y: 220, wires: [] },

    comment('ss_c2', 'Dashboard page, landing, and data downloads', '', 190, 500),
    { id: 'ss_http_root', type: 'http in', z: TAB, name: 'Root URL', url: '/', method: 'get', upload: false, swaggerDoc: '', x: 130, y: 500, wires: [['ss_serve']] },
    { id: 'ss_http', type: 'http in', z: TAB, name: 'Glove Landing', url: '/glove', method: 'get', upload: false, swaggerDoc: '', x: 130, y: 540, wires: [['ss_serve']] },
    { id: 'ss_http_dash', type: 'http in', z: TAB, name: 'Glove Dashboard', url: '/glove/dashboard', method: 'get', upload: false, swaggerDoc: '', x: 130, y: 580, wires: [['ss_serve']] },
    { id: 'ss_http_land', type: 'http in', z: TAB, name: 'Glove Landing Route', url: '/glove/landing', method: 'get', upload: false, swaggerDoc: '', x: 130, y: 620, wires: [['ss_serve']] },
    { id: 'ss_http2', type: 'http in', z: TAB, name: 'Data', url: '/glove/data/:file', method: 'get', upload: false, swaggerDoc: '', x: 160, y: 660, wires: [['ss_serve']] },
    { id: 'ss_http3', type: 'http in', z: TAB, name: 'Images', url: '/glove/images/:file', method: 'get', upload: false, swaggerDoc: '', x: 160, y: 700, wires: [['ss_serve']] },
    fn('ss_serve', 'Serve landing / dashboard / data', 'serve-dashboard', 1, ['fs', 'path'], 420, 580, [['ss_resp']]),
    { id: 'ss_resp', type: 'http response', z: TAB, name: '', statusCode: '', headers: {}, x: 650, y: 580, wires: [] }
];

const outFile = path.join(__dirname, 'flows.json');
fs.writeFileSync(outFile, JSON.stringify(nodes, null, 2));
console.log('Wrote ' + outFile + ' (' + nodes.length + ' nodes)');

if (process.argv.includes('--no-deploy')) process.exit(0);

(async () => {
    const ours = new Set(nodes.map(n => n.id));
    const res = await fetch(NODE_RED + '/flows', { headers: { 'Node-RED-API-Version': 'v1' } });
    if (!res.ok) throw new Error('GET /flows failed: ' + res.status);
    const existing = await res.json();
    // Keep everything that isn't part of this flow, replace our nodes.
    const merged = existing.filter(n => !ours.has(n.id) && n.z !== TAB).concat(nodes);
    const post = await fetch(NODE_RED + '/flows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Node-RED-API-Version': 'v1', 'Node-RED-Deployment-Type': 'full' },
        body: JSON.stringify(merged)
    });
    if (!post.ok) throw new Error('Deploy failed: ' + post.status + ' ' + await post.text());
    console.log('Deployed to ' + NODE_RED + '  ->  dashboard: ' + NODE_RED + '/glove');
})().catch(e => { console.error(e.message); process.exit(1); });
