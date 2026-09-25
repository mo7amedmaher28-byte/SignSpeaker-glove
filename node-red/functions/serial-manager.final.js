const st = context.get('st');
if (st) {
    st.sim = null;
    if (st.mqttClient) { try { st.mqttClient.end(true); } catch (e) { } }
    if (st.port) { try { st.port.close(); } catch (e) { } }
}
clearInterval(context.get('simTimer'));
context.set('st', undefined);
