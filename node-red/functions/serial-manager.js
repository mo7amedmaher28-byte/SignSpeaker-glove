// Connection Manager (MQTT + Serial + Simulator)
// Manages the connection to the smart glove:
//   - MQTT wireless over Wi-Fi (Primary / Cable-free)
//   - USB Serial port (receiver ESP32 or sender direct)
//   - Built-in SIMULATOR
//
// In  topic: tick | connectMqtt {broker, port, topic, lcdTopic} | disconnectMqtt | connect {path} | disconnect | write <line> | simAuto <bool> | simGesture <label> | status
// Out 1: {topic:'sample', payload:{t, dev, gx, gy, gz}} | {topic:'device', payload:text}
// Out 2: {topic:'serial', payload:status}  -> dashboard

const { SerialPort, ReadlineParser } = SerialPortLib;
const BAUD = 115200;
const SIM = 'SIMULATOR';
const SENDER_LINE = /X:\s*(-?\d+(?:\.\d+)?)\s*\|\s*Y:\s*(-?\d+(?:\.\d+)?)\s*\|\s*Z:\s*(-?\d+(?:\.\d+)?)/;
const CONF_FILE = path.join(env.get('GLOVE_DIR'), 'data', 'serial.json');

let st = context.get('st');
if (!st) {
    st = {
        mode: 'mqtt', // 'mqtt' | 'serial' | 'sim' | 'disconnected'
        mqttClient: null,
        mqttConnected: false,
        broker: 'broker.hivemq.com',
        brokerPort: 1883,
        topic: 'signspeaker/glove/data',
        lcdTopic: 'signspeaker/glove/lcd',

        port: null, path: null, want: null, sim: null,
        ports: [], count: 0, rate: 0, rateAt: Date.now(), lastData: 0,
        lastList: 0, lastRetry: 0, lcd: ['SignSpeaker', 'Waiting...'], lcdAt: 0,
        simAuto: true
    };
    try {
        const conf = JSON.parse(fs.readFileSync(CONF_FILE, 'utf8'));
        if (conf.mode) st.mode = conf.mode;
        if (conf.broker) st.broker = conf.broker;
        if (conf.brokerPort) st.brokerPort = conf.brokerPort;
        if (conf.topic) st.topic = conf.topic;
        if (conf.lcdTopic) st.lcdTopic = conf.lcdTopic;
        if (conf.path) st.want = conf.path;
    } catch (e) { }
    context.set('st', st);

    if (st.mode === 'mqtt') {
        openMqtt(st.broker, st.brokerPort, st.topic, st.lcdTopic);
    }
}

function saveConfig() {
    try {
        fs.writeFileSync(CONF_FILE, JSON.stringify({
            mode: st.mode,
            broker: st.broker,
            brokerPort: st.brokerPort,
            topic: st.topic,
            lcdTopic: st.lcdTopic,
            path: st.want
        }, null, 2));
    } catch (e) { }
}

function sendStatus() {
    const isConn = st.mode === 'mqtt' ? st.mqttConnected : !!(st.port || st.sim);
    node.send([null, {
        topic: 'serial',
        payload: {
            connected: isConn,
            mode: st.mode,
            mqttConnected: st.mqttConnected,
            broker: st.broker,
            brokerPort: st.brokerPort,
            topic: st.topic,
            lcdTopic: st.lcdTopic,
            path: st.path,
            want: st.want,
            ports: st.ports,
            rate: st.rate,
            lastDataAge: st.lastData ? Date.now() - st.lastData : null,
            lcd: st.lcd,
            simAuto: st.simAuto
        }
    }]);

    if (st.mode === 'mqtt') {
        node.status(st.mqttConnected
            ? { fill: 'green', shape: 'dot', text: 'MQTT: ' + st.broker + ' ' + st.rate + ' Hz' }
            : { fill: 'yellow', shape: 'ring', text: 'MQTT: connecting to ' + st.broker });
    } else if (st.path) {
        node.status({ fill: 'green', shape: 'dot', text: st.path + ' ' + st.rate + ' Hz' });
    } else {
        node.status({ fill: 'grey', shape: 'ring', text: 'disconnected' });
    }
}

function handleLine(line) {
    line = String(line).trim();
    if (line.startsWith('{')) {
        try {
            const j = JSON.parse(line);
            const gx = parseFloat(j.gx !== undefined ? j.gx : j.x);
            const gy = parseFloat(j.gy !== undefined ? j.gy : j.y);
            const gz = parseFloat(j.gz !== undefined ? j.gz : j.z);
            if (![gx, gy, gz].some(isNaN)) {
                st.count++;
                st.lastData = Date.now();
                node.send([{ topic: 'sample', payload: { t: Date.now(), dev: parseInt(j.dev || j.t || 0, 10), gx, gy, gz } }, null]);
                return;
            }
        } catch (e) { }
    }
    if (line.startsWith('D,')) {
        const p = line.split(',');
        if (p.length < 5) return;
        const gx = parseFloat(p[2]), gy = parseFloat(p[3]), gz = parseFloat(p[4]);
        if ([gx, gy, gz].some(isNaN)) return;
        st.count++;
        st.lastData = Date.now();
        node.send([{ topic: 'sample', payload: { t: Date.now(), dev: parseInt(p[1], 10), gx, gy, gz } }, null]);
    } else if (line.startsWith('I,')) {
        node.send([{ topic: 'device', payload: line.substring(2) }, null]);
    } else {
        const m = SENDER_LINE.exec(line);
        if (!m) return;
        st.count++;
        st.lastData = Date.now();
        node.send([{ topic: 'sample', payload: { t: Date.now(), dev: NaN, gx: +m[1], gy: +m[2], gz: +m[3] } }, null]);
    }
}

function trackLcd(line) {
    if (line.startsWith('W,')) {
        const w = line.substring(2);
        st.lcd = w === 'Unknown' ? ['Unknown', 'Gesture'] : ['Detected:', w];
        st.lcdAt = Date.now();
    } else if (line.startsWith('L,')) {
        const rest = line.substring(2).split('|');
        st.statusLcd = [rest[0] || '', rest[1] || ''];
        if (Date.now() - st.lcdAt > 2000) st.lcd = st.statusLcd;
    }
}

function write(line) {
    line = String(line).replace(/[\r\n]/g, ' ');
    if (line !== 'H') trackLcd(line);
    if (st.port && st.port.isOpen) st.port.write(line + '\n');
    if (st.mqttClient && st.mqttConnected && line !== 'H') {
        try {
            st.mqttClient.publish(st.lcdTopic, line, { qos: 0 });
        } catch (e) { }
    }
}

// ---------- MQTT Client ----------

function closeMqtt() {
    if (st.mqttClient) {
        try { st.mqttClient.end(true); } catch (e) { }
        st.mqttClient = null;
    }
    st.mqttConnected = false;
}

function openMqtt(broker, port, topic, lcdTopic) {
    closeAll();
    st.mode = 'mqtt';
    if (broker) st.broker = broker;
    if (port) st.brokerPort = parseInt(port, 10);
    if (topic) st.topic = topic;
    if (lcdTopic) st.lcdTopic = lcdTopic;

    const brokerUrl = 'mqtt://' + st.broker + ':' + st.brokerPort;
    sendStatus();

    try {
        const client = mqtt.connect(brokerUrl, {
            reconnectPeriod: 3000,
            connectTimeout: 8000,
            clientId: 'SignSpeaker_' + Math.random().toString(16).slice(2, 8)
        });

        client.on('connect', () => {
            st.mqttConnected = true;
            client.subscribe([st.topic, 'glove/data'], err => {
                if (err) node.warn('MQTT sub err: ' + err.message);
            });
            node.send([{ topic: 'device', payload: 'MQTT Connected to ' + brokerUrl + ' (topic: ' + st.topic + ')' }, null]);
            sendStatus();
        });

        client.on('message', (t, payload) => {
            handleLine(payload.toString());
        });

        client.on('error', err => {
            node.warn('MQTT ' + st.broker + ': ' + err.message);
            st.mqttConnected = false;
            sendStatus();
        });

        client.on('close', () => {
            if (st.mqttConnected) {
                st.mqttConnected = false;
                sendStatus();
            }
        });

        client.on('offline', () => {
            st.mqttConnected = false;
            sendStatus();
        });

        st.mqttClient = client;
    } catch (e) {
        node.warn('Cannot connect MQTT: ' + e.message);
    }
    sendStatus();
}

// ---------- Simulator ----------

const PATTERNS = {
    'Hello':       { d: 900,  f: u => [0.95 * Math.sin(4 * Math.PI * u), 0.55 * Math.sin(2 * Math.PI * u + 1), 0.75 * Math.sin(4 * Math.PI * u + 0.5)] },
    'I am':        { d: 700,  f: u => [0.10 * Math.sin(2 * Math.PI * u), -0.95 * Math.sin(Math.PI * u), 0.15 * Math.sin(2 * Math.PI * u)] },
    'Reem':        { d: 500,  f: u => [0.28 * Math.sin(2 * Math.PI * u), 0.12 * Math.sin(2 * Math.PI * u), 0.10 * Math.sin(Math.PI * u)] },
    'Thanks':      { d: 800,  f: u => [0.45 * Math.sin(Math.PI * u), 0.20 * Math.sin(2 * Math.PI * u), 1.05 * Math.sin(2 * Math.PI * u)] },
    'Hello Reem':  { d: 2000, f: u => u < 0.45 ? [0.95 * Math.sin(8 * Math.PI * u), 0.55 * Math.sin(4 * Math.PI * u + 1), 0.75 * Math.sin(8 * Math.PI * u + 0.5)] : (u < 0.55 ? [0.05, 0.05, 0.05] : [0.30 * Math.sin(4 * Math.PI * (u - 0.55)), 0.15 * Math.sin(4 * Math.PI * (u - 0.55)), 0.10 * Math.sin(2 * Math.PI * (u - 0.55))]) },
    'I am Reem':   { d: 1900, f: u => u < 0.45 ? [0.10 * Math.sin(4 * Math.PI * u), -0.95 * Math.sin(2 * Math.PI * u), 0.15 * Math.sin(4 * Math.PI * u)] : (u < 0.55 ? [0.05, -0.05, 0.05] : [0.28 * Math.sin(4 * Math.PI * (u - 0.55)), 0.12 * Math.sin(4 * Math.PI * (u - 0.55)), 0.10 * Math.sin(2 * Math.PI * (u - 0.55))]) },
    'Thank you':   { d: 1800, f: u => [0.55 * Math.sin(2 * Math.PI * u), 0.25 * Math.sin(4 * Math.PI * u), 1.15 * Math.sin(3 * Math.PI * u)] }
};

function startSim() {
    st.sim = { gesture: null, nextAuto: Date.now() + 2500, t0: Date.now() };
    st.path = SIM;
    st.mode = 'sim';
    st.lcd = st.statusLcd || st.lcd;
    const timer = setInterval(() => {
        const sim = st.sim;
        if (!sim) { clearInterval(timer); return; }
        const now = Date.now();
        if (st.simAuto && !sim.gesture && now >= sim.nextAuto) {
            const names = Object.keys(PATTERNS);
            simGesture(names[Math.floor(Math.random() * names.length)]);
            sim.nextAuto = now + 3000 + Math.random() * 1500;
        }
        const n = () => (Math.random() - 0.5) * 0.06;
        let v = [n(), n(), n()];
        if (sim.gesture) {
            const g = sim.gesture;
            const u = (now - g.start) / g.d;
            if (u >= 1) sim.gesture = null;
            else v = g.f(u).map((a, i) => a * g.scale[i] + n());
        }
        handleLine('D,' + (now - sim.t0) + ',' + v.map(x => x.toFixed(3)).join(','));
    }, 40);
    context.set('simTimer', timer);
    node.send([{ topic: 'device', payload: 'Simulator started (synthetic gyro data)' }, null]);
}

function simGesture(label) {
    if (!st.sim) return;
    const p = PATTERNS[label];
    if (!p) return;
    const r = () => 0.85 + Math.random() * 0.3;
    st.sim.gesture = { f: p.f, d: p.d * r(), start: Date.now(), scale: [r(), r(), r()] };
}

// ---------- Serial connect / disconnect ----------

function closeAll() {
    closeMqtt();
    if (st.sim) { st.sim = null; clearInterval(context.get('simTimer')); }
    if (st.port) { const p = st.port; st.port = null; try { p.close(); } catch (e) { } }
    st.path = null;
}

function openSerial(p) {
    closeAll();
    if (p === SIM) { startSim(); sendStatus(); return; }
    st.mode = 'serial';
    const port = new SerialPort({ path: p, baudRate: BAUD, autoOpen: false });
    port.on('error', e => node.warn('Serial ' + p + ': ' + e.message));
    port.on('close', () => {
        if (st.port === port) { st.port = null; st.path = null; sendStatus(); }
    });
    port.pipe(new ReadlineParser({ delimiter: '\n' })).on('data', handleLine);
    port.open(err => {
        if (err) { node.warn('Cannot open ' + p + ': ' + err.message); sendStatus(); return; }
        port.set({ dtr: false, rts: false }, () => { });
        st.port = port;
        st.path = p;
        sendStatus();
    });
}

function refreshPorts() {
    st.lastList = Date.now();
    SerialPort.list().then(list => {
        st.ports = list.map(p => ({ path: p.path, name: p.friendlyName || p.manufacturer || p.path }))
            .concat([{ path: SIM, name: 'Simulator (no hardware)' }]);
    }).catch(e => node.warn('Port list failed: ' + e.message));
}

// ---------- Message Handling ----------

switch (msg.topic) {
    case 'tick': {
        const now = Date.now();
        const dt = (now - st.rateAt) / 1000;
        st.rate = Math.round(st.count / (dt || 1));
        st.count = 0;
        st.rateAt = now;
        if (st.port) write('H');
        if (now - st.lcdAt > 2000 && st.statusLcd) st.lcd = st.statusLcd;
        if (now - st.lastList > 3000) refreshPorts();
        if (st.mode === 'serial' && st.want && !st.path && now - st.lastRetry > 3000) {
            st.lastRetry = now;
            if (st.want === SIM || st.ports.some(p => p.path === st.want)) openSerial(st.want);
        }
        sendStatus();
        break;
    }
    case 'connectMqtt': {
        const p = msg.payload || {};
        st.mode = 'mqtt';
        st.want = null;
        if (p.broker) st.broker = p.broker;
        if (p.port) st.brokerPort = parseInt(p.port, 10);
        if (p.topic) st.topic = p.topic;
        if (p.lcdTopic) st.lcdTopic = p.lcdTopic;
        saveConfig();
        openMqtt(st.broker, st.brokerPort, st.topic, st.lcdTopic);
        break;
    }
    case 'disconnectMqtt':
        closeMqtt();
        st.mode = 'disconnected';
        saveConfig();
        sendStatus();
        break;
    case 'connect':
        st.mode = 'serial';
        st.want = msg.payload && msg.payload.path;
        saveConfig();
        if (st.want) openSerial(st.want);
        break;
    case 'disconnect':
        st.want = null;
        st.mode = 'disconnected';
        saveConfig();
        closeAll();
        sendStatus();
        break;
    case 'write':
        write(msg.payload);
        break;
    case 'simAuto':
        st.simAuto = !!msg.payload;
        sendStatus();
        break;
    case 'simGesture':
        simGesture(msg.payload);
        break;
    case 'status':
        refreshPorts();
        sendStatus();
        break;
}
return null;
