// Serialises every dashboard event as {"topic":..., "payload":...} for the websocket.
if (!msg.topic) return null;
return { payload: JSON.stringify({ topic: msg.topic, payload: msg.payload === undefined ? null : msg.payload }) };
