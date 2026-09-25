// Speaker
// Speaks text through the laptop speaker using Windows' built-in speech synthesizer.
// A single PowerShell process is kept running so each word is spoken with no startup delay.
//
// In:  {topic:'say', payload:text} | {topic:'cmd', payload:{cmd:'voice'|'rate'|'status'}}
// Out 1: dashboard events

const SCRIPT = [
    '$ProgressPreference = "SilentlyContinue"',
    'Add-Type -AssemblyName System.Speech',
    '$s = New-Object System.Speech.Synthesis.SpeechSynthesizer',
    '$s.SetOutputToDefaultAudioDevice()',
    '[Console]::InputEncoding = [Text.Encoding]::UTF8',
    '[Console]::Out.WriteLine("VOICES:" + (($s.GetInstalledVoices() | ForEach-Object { $_.VoiceInfo.Name }) -join "|"))',
    '[Console]::Out.WriteLine("VOICE:" + $s.Voice.Name)',
    'while ($true) {',
    '  $line = [Console]::In.ReadLine()',
    '  if ($line -eq $null) { break }',
    '  if ($line.StartsWith("VOICE:")) { try { $s.SelectVoice($line.Substring(6)) } catch {}; [Console]::Out.WriteLine("VOICE:" + $s.Voice.Name); continue }',
    '  if ($line.StartsWith("RATE:")) { $s.Rate = [int]$line.Substring(5); continue }',
    '  $s.SpeakAsyncCancelAll()',
    '  [void]$s.SpeakAsync($line)',
    '}'
].join('\n');

let sp = context.get('sp');
if (!sp || !sp.proc || sp.proc.exitCode !== null) {
    const saved = (sp && sp.cfg) || { voice: '', rate: 0 };
    sp = { proc: null, voices: [], voice: '', cfg: saved, last: '' };
    const encoded = Buffer.from(SCRIPT, 'utf16le').toString('base64');
    const proc = cp.spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encoded], { windowsHide: true });
    proc.stdin.setDefaultEncoding('utf8');
    let buf = '';
    proc.stdout.on('data', d => {
        buf += d.toString();
        let i;
        while ((i = buf.indexOf('\n')) >= 0) {
            const line = buf.substring(0, i).trim();
            buf = buf.substring(i + 1);
            if (line.startsWith('VOICES:')) sp.voices = line.substring(7).split('|').filter(Boolean);
            else if (line.startsWith('VOICE:')) sp.voice = line.substring(6);
            node.send(statusEvent());
        }
    });
    proc.on('error', e => node.warn('Cannot start speech: ' + e.message));
    proc.stdin.on('error', () => { });
    proc.stderr.on('data', d => {
        const text = d.toString().trim();
        if (text && !text.startsWith('#< CLIXML') && !text.startsWith('<Objs')) node.warn('Speech: ' + text);
    });
    proc.on('exit', code => { node.status({ fill: 'red', shape: 'ring', text: 'speech stopped (' + code + ')' }); node.send(statusEvent()); });
    sp.proc = proc;
    context.set('sp', sp);
    if (saved.voice) proc.stdin.write('VOICE:' + saved.voice + '\n');
    if (saved.rate) proc.stdin.write('RATE:' + saved.rate + '\n');
    node.status({ fill: 'green', shape: 'dot', text: 'ready' });
}

function statusEvent() {
    return {
        topic: 'speaker',
        payload: { ready: !!(sp.proc && sp.proc.exitCode === null), voices: sp.voices, voice: sp.voice, rate: sp.cfg.rate, last: sp.last }
    };
}

function send(line) {
    if (sp.proc && sp.proc.exitCode === null) sp.proc.stdin.write(line + '\n');
}

if (msg.topic === 'say') {
    const text = String(msg.payload || '').replace(/[\r\n]/g, ' ').trim();
    if (!text || text.startsWith('VOICE:') || text.startsWith('RATE:')) return null;
    sp.last = text;
    send(text);
    node.status({ fill: 'green', shape: 'dot', text: 'said: ' + text });
    return statusEvent();
}

if (msg.topic === 'cmd') {
    const c = msg.payload || {};
    if (c.cmd === 'voice' && c.voice) { sp.cfg.voice = String(c.voice); send('VOICE:' + sp.cfg.voice); }
    if (c.cmd === 'rate') {
        const r = Math.max(-10, Math.min(10, parseInt(c.rate, 10) || 0));
        sp.cfg.rate = r;
        send('RATE:' + r);
    }
    return statusEvent();
}
return null;
