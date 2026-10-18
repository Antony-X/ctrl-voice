const { contextBridge, ipcRenderer, webUtils } = require('electron');

const ALLOWED = /^(win|app|rec|overlay|settings|shortcuts|messages|message|nav|engine|edit|send):/;

contextBridge.exposeInMainWorld('respeak', {
  platform: process.platform,
  send: (channel, data) => ALLOWED.test(channel) && ipcRenderer.send(channel, data),
  invoke: (channel, data) => (ALLOWED.test(channel) ? ipcRenderer.invoke(channel, data) : Promise.reject(new Error('blocked'))),
  // The path of a file dropped on the window (File.path is gone since Electron 32).
  pathFor: (file) => webUtils.getPathForFile(file),
  on: (channel, cb) => {
    if (!ALLOWED.test(channel)) return () => {};
    const handler = (_e, payload) => cb(payload);
    ipcRenderer.on(channel, handler);
    return () => ipcRenderer.removeListener(channel, handler);
  },
});
