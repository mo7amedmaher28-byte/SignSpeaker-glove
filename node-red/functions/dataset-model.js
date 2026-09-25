// Dataset & Model
// Stores labelled gesture recordings, trains a k-nearest-neighbour classifier on
// features extracted from them, and classifies every new gesture.
// Before a model is trained, the original rule-based thresholds are used.
//
// Files: data/dataset.json (raw recordings), data/model.json (trained model)
//
// In:  {topic:'gesture'} from Gesture Engine, {topic:'cmd'} from dashboard
// Out 1: dashboard events   Out 2: prediction -> Output   Out 3: LCD status -> Serial

const DATA = path.join(env.get('GLOVE_DIR'), 'data');
const DATASET_FILE = path.join(DATA, 'dataset.json');
const MODEL_FILE = path.join(DATA, 'model.json');
const DEFAULT_LABELS = ['Hello', 'I am', 'Reem', 'Thanks', 'Hello Reem', 'I am Reem', 'Thank you'];
const TRAJ_POINTS = 16;
const K = 3;

function load(file, def) {
    try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return def; }
}

function saveJson(file, obj) {
    const tmp = file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(obj));
    fs.renameSync(tmp, file);
}

let st = context.get('st');
if (!st) {
    const ds = load(DATASET_FILE, null) || { labels: DEFAULT_LABELS.slice(), samples: [], rev: 0 };
    ds.rev = ds.rev || 0;
    st = { ds, model: load(MODEL_FILE, null) };
    context.set('st', st);
}
const ds = st.ds;

function saveDataset() {
    ds.rev++;
    saveJson(DATASET_FILE, ds);
}

// ---------- saved snapshots (data/saved/<name>.json = dataset + model) ----------

const SAVED_DIR = path.join(DATA, 'saved');

function hasUnsavedChanges() {
    if (!ds.saved) return ds.samples.length > 0 || !!st.model;
    return ds.saved.rev !== ds.rev || ds.saved.modelAt !== (st.model ? st.model.trainedAt : 0);
}

function listSaved() {
    try {
        return fs.readdirSync(SAVED_DIR).filter(f => f.endsWith('.json')).map(f => f.slice(0, -5)).sort().reverse();
    } catch (e) { return []; }
}

function saveSnapshot() {
    fs.mkdirSync(SAVED_DIR, { recursive: true });
    const d = new Date();
    const p = n => String(n).padStart(2, '0');
    const name = 'training-' + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds());
    ds.saved = { name, at: Date.now(), rev: ds.rev, modelAt: st.model ? st.model.trainedAt : 0 };
    saveJson(path.join(SAVED_DIR, name + '.json'), { dataset: ds, model: st.model });
    saveJson(DATASET_FILE, ds);
    return name;
}

// Replace the working dataset in place (ds is shared with context).
function replaceDataset(next) {
    for (const k of Object.keys(ds)) delete ds[k];
    Object.assign(ds, next);
}

function writeModel() {
    if (st.model) saveJson(MODEL_FILE, st.model);
    else { try { fs.unlinkSync(MODEL_FILE); } catch (e) { } }
}

// ---------- features ----------

// samples: [[tMs, gx, gy, gz], ...]
function features(samples) {
    const n = samples.length;
    const t0 = samples[0][0], t1 = samples[n - 1][0];
    const f = [(t1 - t0) / 1000];

    for (let a = 1; a <= 3; a++) {
        let min = Infinity, max = -Infinity, sum = 0, sumAbs = 0, peak = 0;
        for (const r of samples) {
            const v = r[a];
            if (v < min) min = v;
            if (v > max) max = v;
            sum += v;
            sumAbs += Math.abs(v);
            if (Math.abs(v) > Math.abs(peak)) peak = v;
        }
        const mean = sum / n;
        let varSum = 0;
        for (const r of samples) varSum += (r[a] - mean) * (r[a] - mean);
        f.push(max - min, mean, Math.sqrt(varSum / n), sumAbs / n, peak);
    }

    const mags = samples.map(r => Math.sqrt(r[1] * r[1] + r[2] * r[2] + r[3] * r[3]));
    f.push(mags.reduce((x, y) => x + y, 0) / n, Math.max.apply(null, mags));

    // Shape of the movement over time: each axis resampled to TRAJ_POINTS points.
    for (let a = 1; a <= 3; a++) {
        for (let i = 0; i < TRAJ_POINTS; i++) {
            const t = t0 + (t1 - t0) * i / (TRAJ_POINTS - 1);
            let j = 0;
            while (j < n - 2 && samples[j + 1][0] < t) j++;
            const A = samples[j], B = samples[Math.min(j + 1, n - 1)];
            const span = B[0] - A[0];
            const u = span > 0 ? Math.min(1, Math.max(0, (t - A[0]) / span)) : 0;
            f.push(A[a] + (B[a] - A[a]) * u);
        }
    }
    return f;
}

function ranges(samples) {
    const r = [1, 2, 3].map(a => {
        const v = samples.map(s => s[a]);
        return Math.max.apply(null, v) - Math.min.apply(null, v);
    });
    return { x: r[0], y: r[1], z: r[2] };
}

// Original thresholds from the receiver firmware, used until a model exists.
function classifyRules(samples) {
    const { x, y, z } = ranges(samples);
    let label = 'Unknown';
    if (x > 0.70 && y > 0.40 && z > 0.50) label = 'Hello';
    else if (y > 0.65 && y > x * 1.15 && y > z * 1.15) label = 'I am';
    else if (x < 0.30 && y < 0.30 && z < 0.30) label = 'Reem';
    else if (z > 0.70 && x > 0.25 && z > y) label = 'Thanks';
    return { label, known: label !== 'Unknown', confidence: null, source: 'rules', ranges: { x, y, z } };
}

// ---------- k-NN ----------

function dist(a, b) {
    let s = 0;
    for (let i = 0; i < a.length; i++) s += (a[i] - b[i]) * (a[i] - b[i]);
    return Math.sqrt(s / a.length);
}

function knn(z, points, labels, k, exclude) {
    const d = [];
    for (let i = 0; i < points.length; i++) if (i !== exclude) d.push([dist(z, points[i]), labels[i]]);
    d.sort((a, b) => a[0] - b[0]);
    const top = d.slice(0, Math.min(k, d.length));
    const votes = {};
    let total = 0;
    for (const [dd, l] of top) {
        const w = 1 / (dd + 1e-3);
        votes[l] = (votes[l] || 0) + w;
        total += w;
    }
    let best = null;
    for (const l of Object.keys(votes)) if (best === null || votes[l] > votes[best]) best = l;
    const nearest = top.filter(t => t[1] === best).reduce((m, t) => Math.min(m, t[0]), Infinity);
    const share = {};
    for (const l of Object.keys(votes)) share[l] = +(votes[l] / total).toFixed(3);
    return { label: best, confidence: votes[best] / total, nearest, votes: share };
}

function standardize(f, mean, std) {
    return f.map((v, i) => (v - mean[i]) / std[i]);
}

function classify(samples) {
    const m = st.model;
    if (!m) return classifyRules(samples);
    const z = standardize(features(samples), m.mean, m.std);
    const r = knn(z, m.points, m.y, m.k, -1);
    return {
        label: r.label,
        known: r.nearest <= m.rejectDistance,
        confidence: +r.confidence.toFixed(3),
        distance: +r.nearest.toFixed(3),
        rejectDistance: m.rejectDistance,
        votes: r.votes,
        source: 'model',
        ranges: ranges(samples)
    };
}

function train() {
    const counts = countByLabel();
    const used = ds.labels.filter(l => (counts[l] || 0) >= 3);
    if (used.length < 1) {
        return { error: 'Record at least 3 samples of a word before training (10+ per word recommended).' };
    }
    const items = ds.samples.filter(s => used.includes(s.label) && s.samples.length >= 3);
    const X = items.map(s => features(s.samples));
    const y = items.map(s => s.label);
    const dim = X[0].length;

    const mean = new Array(dim).fill(0), std = new Array(dim).fill(0);
    for (const f of X) f.forEach((v, i) => { mean[i] += v / X.length; });
    for (const f of X) f.forEach((v, i) => { std[i] += (v - mean[i]) * (v - mean[i]) / X.length; });
    for (let i = 0; i < dim; i++) { std[i] = Math.sqrt(std[i]); if (std[i] < 1e-6) std[i] = 1; }
    const Z = X.map(f => standardize(f, mean, std));
    const k = Math.min(K, Z.length - 1);

    // Leave-one-out evaluation.
    const idx = {};
    used.forEach((l, i) => { idx[l] = i; });
    const matrix = used.map(() => used.map(() => 0));
    let correct = 0;
    const sameClassNearest = [];
    for (let i = 0; i < Z.length; i++) {
        const r = knn(Z[i], Z, y, k, i);
        matrix[idx[y[i]]][idx[r.label]]++;
        if (r.label === y[i]) correct++;
        let best = Infinity;
        for (let j = 0; j < Z.length; j++) if (j !== i && y[j] === y[i]) best = Math.min(best, dist(Z[i], Z[j]));
        if (isFinite(best)) sameClassNearest.push(best);
    }
    sameClassNearest.sort((a, b) => a - b);
    const p95 = sameClassNearest[Math.min(sameClassNearest.length - 1, Math.floor(sameClassNearest.length * 0.95))] || 1;

    const perLabel = {};
    used.forEach((l, i) => { perLabel[l] = { n: counts[l], correct: matrix[i][i] }; });

    st.model = {
        version: 1,
        trainedAt: Date.now(),
        datasetRev: ds.rev,
        k,
        labels: used,
        mean, std,
        points: Z.map(z => z.map(v => +v.toFixed(4))),
        y,
        rejectDistance: +(p95 * 1.5).toFixed(4),
        accuracy: correct / Z.length,
        perLabel,
        confusion: { labels: used, matrix },
        featureCount: dim
    };
    saveJson(MODEL_FILE, st.model);
    return { ok: true };
}

// ---------- dashboard events ----------

function countByLabel() {
    const c = {};
    for (const s of ds.samples) c[s.label] = (c[s.label] || 0) + 1;
    return c;
}

function datasetEvent() {
    return {
        topic: 'dataset',
        payload: {
            labels: ds.labels,
            counts: countByLabel(),
            total: ds.samples.length,
            file: DATASET_FILE,
            saved: ds.saved || null,
            unsaved: hasUnsavedChanges(),
            savedList: listSaved(),
            samples: ds.samples.map(s => ({ id: s.id, label: s.label, at: s.at, duration: s.duration })).reverse()
        }
    };
}

function modelEvent() {
    const m = st.model;
    if (!m) return { topic: 'model', payload: null };
    return {
        topic: 'model',
        payload: {
            trainedAt: m.trainedAt, k: m.k, labels: m.labels, accuracy: m.accuracy,
            perLabel: m.perLabel, confusion: m.confusion, n: m.y.length,
            rejectDistance: m.rejectDistance, stale: m.datasetRev !== ds.rev, file: MODEL_FILE
        }
    };
}

function toast(text, level) {
    return { topic: 'toast', payload: { text, level: level || 'info' } };
}

function cleanLabel(l) {
    return String(l || '').replace(/[\r\n|,]/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 48);
}

// ---------- message handling ----------

if (msg.topic === 'gesture') {
    const g = msg.payload;
    const pred = classify(g.samples);
    const out1 = [];
    let lcd = null;

    if (msg.recording) {
        const sample = {
            id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
            label: msg.label, at: g.at, duration: g.duration, samples: g.samples
        };
        if (!ds.labels.includes(sample.label)) ds.labels.push(sample.label);
        ds.samples.push(sample);
        saveDataset();
        const n = countByLabel()[sample.label];
        out1.push(datasetEvent(), modelEvent());
        let l1 = 'Rec: ' + sample.label;
        let l2 = 'Samples: ' + n;
        if (l1.length > 16) {
            const words = sample.label.split(' ');
            l1 = 'Rec:';
            l2 = '';
            for (const w of words) {
                if (!l2 && (l1 + ' ' + w).length <= 16) l1 += ' ' + w;
                else l2 = (l2 ? l2 + ' ' : '') + w;
            }
            if (!l2) l2 = 'Samples: ' + n;
            else l2 = (l2 + ' #' + n).substring(0, 16);
        }
        lcd = { topic: 'write', payload: 'L,' + l1.substring(0, 16) + '|' + l2.substring(0, 16) };
    }

    out1.push({
        topic: 'gesture',
        payload: { at: g.at, duration: g.duration, samples: g.samples, prediction: pred, recorded: !!msg.recording, label: msg.label, mode: msg.mode }
    });

    const out2 = msg.mode === 'recognize' ? { topic: 'prediction', payload: Object.assign({ at: g.at, duration: g.duration }, pred) } : null;
    return [out1, out2, lcd];
}

if (msg.topic !== 'cmd') return null;

const c = msg.payload || {};
switch (c.cmd) {
    case 'train': {
        const r = train();
        if (r.error) return [[toast(r.error, 'error')], null, null];
        const m = st.model;
        const skipped = ds.labels.filter(l => !m.labels.includes(l) && countByLabel()[l]);
        const msgs = [modelEvent(), datasetEvent()];
        if (m.labels.length === 1) {
            msgs.push(toast('Trained on one word ("' + m.labels[0] + '"): the model can only answer "' + m.labels[0] + '" or "Unknown". Record a second word to tell words apart.', 'ok'));
        } else {
            msgs.push(toast('Model trained on ' + m.labels.length + ' words: ' + Math.round(m.accuracy * 100) + '% leave-one-out accuracy on ' + m.y.length + ' samples', 'ok'));
        }
        if (skipped.length) msgs.push(toast('Not included (fewer than 3 samples): ' + skipped.join(', ')));
        return [msgs, null, null];
    }
    case 'deleteModel':
        st.model = null;
        try { fs.unlinkSync(MODEL_FILE); } catch (e) { }
        return [[modelEvent(), datasetEvent(), toast('Model deleted - using the built-in rules again')], null, null];
    case 'deleteSample':
        ds.samples = ds.samples.filter(s => s.id !== c.id);
        saveDataset();
        return [[datasetEvent(), modelEvent()], null, null];
    case 'clearLabel':
        ds.samples = ds.samples.filter(s => s.label !== c.label);
        saveDataset();
        return [[datasetEvent(), modelEvent(), toast('Deleted all samples for ' + c.label)], null, null];
    case 'addLabel': {
        const l = cleanLabel(c.label);
        if (!l) return null;
        if (!ds.labels.includes(l)) ds.labels.push(l);
        saveDataset();
        return [[datasetEvent()], null, null];
    }
    case 'removeLabel':
        ds.labels = ds.labels.filter(l => l !== c.label);
        ds.samples = ds.samples.filter(s => s.label !== c.label);
        saveDataset();
        return [[datasetEvent(), modelEvent(), toast('Removed label ' + c.label)], null, null];
    case 'sampleData': {
        const s = ds.samples.find(x => x.id === c.id);
        if (!s) return null;
        return [[{ topic: 'sampleData', payload: { id: s.id, label: s.label, at: s.at, duration: s.duration, samples: s.samples, prediction: classify(s.samples) } }], null, null];
    }
    case 'saveTraining': {
        const name = saveSnapshot();
        return [[datasetEvent(), toast('Saved ' + ds.samples.length + ' samples' + (st.model ? ' and the trained model' : '') + ' as "' + name + '"', 'ok')], null, null];
    }
    case 'deleteWords': {
        const toDelete = Array.isArray(c.labels) ? c.labels : (c.label ? [c.label] : []);
        const keepLabels = !!c.keepLabels;
        if (!toDelete.length) return null;
        ds.samples = ds.samples.filter(s => !toDelete.includes(s.label));
        if (!keepLabels) {
            ds.labels = ds.labels.filter(l => !toDelete.includes(l));
        }
        saveDataset();
        return [[datasetEvent(), modelEvent(), toast('Deleted ' + toDelete.length + ' word(s)' + (keepLabels ? ' samples' : ''), 'ok')], null, null];
    }
    case 'deleteAll':
        replaceDataset({ labels: DEFAULT_LABELS.slice(), samples: [], rev: ds.rev });
        st.model = null;
        writeModel();
        saveDataset();
        return [[datasetEvent(), modelEvent(), toast('Deleted all recorded words and the trained model')],
            null, { topic: 'write', payload: 'L,Training data|deleted' }];
    case 'restoreSaved': {
        const name = String(c.name || '');
        if (!listSaved().includes(name)) return [[toast('Saved training not found: ' + name, 'error')], null, null];
        const snap = load(path.join(SAVED_DIR, name + '.json'), null);
        if (!snap || !snap.dataset) return [[toast('Could not read ' + name, 'error')], null, null];
        replaceDataset(snap.dataset);
        ds.saved = { name, at: Date.now(), rev: ds.rev, modelAt: snap.model ? snap.model.trainedAt : 0 };
        st.model = snap.model || null;
        writeModel();
        saveJson(DATASET_FILE, ds);
        return [[datasetEvent(), modelEvent(), toast('Restored "' + name + '": ' + ds.samples.length + ' samples' + (st.model ? ' + model' : ''), 'ok')], null, null];
    }
    case 'status':
        return [[datasetEvent(), modelEvent()], null, null];
}
return null;
