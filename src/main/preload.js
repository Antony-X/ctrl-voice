const { contextBridge, ipcRenderer } = require('electron');

const ALLOWED = /^(win|app|rec|overlay|settings|shortcuts|messages|message|nav|export|voice|send):/;

contextBridge.exposeInMainWorld('respeak', {
  send: (channel, data) => ALLOWED.test(channel) && ipcRenderer.send(channel, data),
  invoke: (channel, data) => (ALLOWED.test(channel) ? ipcRenderer.invoke(channel, data) : Promise.reject(new Error('blocked'))),
  on: (channel, cb) => {
    if (!ALLOWED.test(channel)) return () => {};
    const handler = (_e, payload) => cb(payload);
    ipcRenderer.on(channel, handler);
    return () => ipcRenderer.removeListener(channel, handler);
  },
});
