const url = 'wss://zaa3ajj8o85hhq-7860.proxy.runpod.net/ws/e2eprobe' + Date.now().toString(36);
const ws = new WebSocket(url);
const t = Date.now();
ws.onopen = () => { console.log('open', Date.now() - t, 'ms'); ws.send(JSON.stringify({ type: 'stop' })); };
ws.onmessage = (e) => console.log('msg', String(e.data).slice(0, 200));
ws.onerror = (e) => console.log('error', e.message || e.type);
ws.onclose = (e) => { console.log('close', e.code, e.reason, Date.now() - t, 'ms'); process.exit(0); };
setTimeout(() => { console.log('timeout'); process.exit(1); }, 15000);
