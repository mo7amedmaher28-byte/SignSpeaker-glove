// Dashboard Command Router
// Parses JSON commands arriving from the dashboard websocket and sends each one
// to the node that owns it. {cmd:'hello'} asks every node for its current state.
//
// Out: 1 Serial Manager  2 Gesture Engine  3 Dataset & Model  4 Output  5 Speaker  6 Logger

let c;
try { c = typeof msg.payload === 'string' ? JSON.parse(msg.payload) : msg.payload; } catch (e) { return null; }
if (!c || !c.cmd) return null;

const cmd = m => ({ topic: 'cmd', payload: m });
const out = [null, null, null, null, null, null];

switch (c.cmd) {
    case 'hello':
        return [
            { topic: 'status' }, cmd({ cmd: 'status' }), cmd({ cmd: 'status' }),
            cmd({ cmd: 'status' }), cmd({ cmd: 'status' }), cmd({ cmd: 'status' })
        ];

    case 'connect': out[0] = { topic: 'connect', payload: { path: c.path } }; break;
    case 'disconnect': out[0] = { topic: 'disconnect' }; break;
    case 'connectMqtt': out[0] = { topic: 'connectMqtt', payload: c }; break;
    case 'disconnectMqtt': out[0] = { topic: 'disconnectMqtt' }; break;
    case 'simAuto': out[0] = { topic: 'simAuto', payload: !!c.enabled }; break;
    case 'simGesture': out[0] = { topic: 'simGesture', payload: c.label }; break;

    case 'mode':
    case 'record':
    case 'stop':
    case 'label':
    case 'preset':
    case 'settings':
    case 'resetSettings':
        out[1] = cmd(c); break;

    case 'train':
    case 'deleteModel':
    case 'deleteSample':
    case 'clearLabel':
    case 'addLabel':
    case 'removeLabel':
    case 'deleteWords':
    case 'sampleData':
    case 'saveTraining':
    case 'deleteAll':
    case 'restoreSaved':
        out[2] = cmd(c); break;

    case 'outputSettings':
    case 'testOutput':
        out[3] = cmd(c); break;

    case 'voice':
    case 'rate':
        out[4] = cmd(c); break;

    case 'logging': out[5] = cmd(c); break;

    default: return null;
}
return out;
