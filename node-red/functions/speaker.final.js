const sp = context.get('sp');
if (sp && sp.proc) {
    try { sp.proc.stdin.end(); } catch (e) { }
    try { sp.proc.kill(); } catch (e) { }
}
context.set('sp', undefined);
