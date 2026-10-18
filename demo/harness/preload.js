'use strict';
// Harness preload: exposes the app's bridge (window.respeak by default) backed by a
// stub module instead of real IPC, plus window.__harness for shot scripts.
// Runs with sandbox:false so it can require() the stub file given by the harness.

const { contextBridge, ipcRenderer } = require('electron');

function argValue(name) {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : '';
}

function fmt(v) {
  if (typeof v === 'string') return v;
  if (v === undefined) return 'undefined';
  try {
    const s = JSON.stringify(v);
    return s && s.length > 300 ? `${s.slice(0, 300)}…` : s;
  } catch {
    return String(v);
  }
}

// Lines go to the harness main process, which prints them on stdout.
function log(...parts) {
  ipcRenderer.send('harness:log', parts.map(fmt).join(' '));
}

const errText = (err) => (err && err.stack) || String(err);

// ---------- stub ----------
const stubPath = argValue('harness-stub');
const bridgeName = argValue('harness-bridge') || 'respeak';
let stub = {};
if (stubPath) {
  try {
    stub = require(stubPath) || {};
  } catch (err) {
    // Screenshots with a broken stub would be misleading: make the run fail.
    ipcRenderer.send('harness:fatal', `[stub] FAILED to load ${stubPath}\n${errText(err)}`);
  }
}

// ---------- listeners / events ----------
const listeners = new Map(); // channel -> Set<callback>

function emit(channel, payload) {
  const set = listeners.get(channel);
  if (!set || set.size === 0) {
    log(`[stub] emit ${channel}: no listeners`);
    return 0;
  }
  log(`[stub] emit ${channel}`);
  for (const cb of [...set]) {
    try {
      cb(payload);
    } catch (err) {
      log(`[stub] listener for ${channel} threw:`, errText(err));
    }
  }
  return set.size;
}

// `this` inside stub functions (use regular functions, not arrows).
const stubContext = { emit, log: (...a) => log('[stub]', ...a) };

// ---------- the bridge ----------
const bridge = {
  send(channel, ...args) {
    log(`[stub] send ${channel}`, ...args);
    if (typeof stub.onSend !== 'function') return;
    try {
      stub.onSend.call(stubContext, channel, ...args);
    } catch (err) {
      log(`[stub] onSend(${channel}) threw:`, errText(err));
    }
  },

  invoke(channel, ...args) {
    const handlers = stub.invoke || {};
    if (!Object.prototype.hasOwnProperty.call(handlers, channel)) {
      log(`[stub] unhandled invoke ${channel}`);
      return Promise.resolve(null);
    }
    log(`[stub] invoke ${channel}`);
    const handler = handlers[channel];
    try {
      const value = typeof handler === 'function' ? handler.call(stubContext, ...args) : handler;
      return Promise.resolve(value).then((v) => (v === undefined ? null : v), (err) => {
        log(`[stub] invoke ${channel} rejected:`, errText(err));
        throw err;
      });
    } catch (err) {
      log(`[stub] invoke ${channel} threw:`, errText(err));
      return Promise.reject(err);
    }
  },

  on(channel, cb) {
    if (typeof cb !== 'function') return () => {};
    if (!listeners.has(channel)) listeners.set(channel, new Set());
    listeners.get(channel).add(cb);
    return () => {
      const set = listeners.get(channel);
      if (set) set.delete(cb);
    };
  },
};

contextBridge.exposeInMainWorld(bridgeName, bridge);
contextBridge.exposeInMainWorld('__harness', {
  emit: (channel, payload) => emit(channel, payload),
  channels: () => [...listeners.keys()].filter((k) => listeners.get(k).size > 0),
});

// Scripted events, fired once the page has loaded.
window.addEventListener('load', () => {
  for (const ev of stub.events || []) {
    setTimeout(() => {
      try {
        const payload = typeof ev.payload === 'function' ? ev.payload.call(stubContext) : ev.payload;
        emit(ev.channel, payload);
      } catch (err) {
        log(`[stub] event ${ev.channel} failed:`, errText(err));
      }
    }, ev.delay || 0);
  }
});
