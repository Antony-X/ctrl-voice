// Harness stub for the editor and tone clips. Everything comes from media/: the message
// (words + the engine's cuts), its audio, and the engine's real /replace result. Nothing is
// invented: no extra history, no fake replacement, no fake unclear word.
// Engine calls resolve only when the clip says so (a data-release-* attribute on <html>),
// so the clip controls timing in its own virtual time instead of wall-clock time.
const fs = require('fs');
const path = require('path');
const Edits = require('C:/Users/Antony/Desktop/ctrl+voice/src/shared/edits.js');

const MEDIA = path.join(__dirname, '..', 'media');
const read = (f) => fs.readFileSync(path.join(MEDIA, f));
const src = fs.existsSync(path.join(MEDIA, 'message.json')) ? 'message.json' : 'sample.json';
const msg = JSON.parse(read(src).toString('utf8'));
const data = JSON.parse(read('deck_data.json').toString('utf8'));
const rep = fs.existsSync(path.join(MEDIA, 'replace.json')) ? JSON.parse(read('replace.json').toString('utf8')) : null;

const W = msg.words.map(({ w, s, e, p }) => ({ w, s, e, p }));
const ops = data.cuts.map((c, k) => ({ id: `c${k}`, type: 'cut', t0: c.t0, t1: c.t1, i: c.i, j: c.j, kind: c.kind, text: c.text, on: true, auto: true }));
const title = data.title;
const now = Date.now();
const main = {
  id: 'm1', sid: msg.sid || 'demo', title, createdAt: now - 60e3, from: 'Discord', sentTo: null,
  dur: data.duration, words: W, removed: msg.removed || [], ops, fixed: now - 50e3,
  pron: { items: [], accent: null }, output: { dur: data.fixed_duration, ai: [] }, take: null,
};

const DEFAULTS = {
  shortcuts: { toggle: 'Alt+`', open: 'Alt+Shift+`', undo: 'CommandOrControl+Z', review: 'CommandOrControl+Alt+Enter', cancel: 'Escape' },
  shortcutsVersion: 3, backendUrl: 'http://engine.local', finishAction: 'send', autoSend: true,
  fix: { cleanup: true, grammar: true, pronunciation: true },
  showIdleBar: true, launchAtStartup: false, startHidden: false, micId: 'default',
};
let settings = JSON.parse(JSON.stringify(DEFAULTS));
const payload = () => ({ settings, shortcutStatus: { toggle: true, open: true, undo: true, review: true, cancel: true }, defaults: DEFAULTS });

// Resolve when the page sets <html data-release-NAME>.
const released = (name) => new Promise((resolve) => {
  const t = setInterval(() => {
    if (document.documentElement.hasAttribute(`data-release-${name}`)) {
      document.documentElement.removeAttribute(`data-release-${name}`);
      clearInterval(t);
      resolve();
    }
  }, 10);
});

module.exports = {
  invoke: {
    'settings:get': () => payload(),
    'settings:set': (patch) => { settings = { ...settings, ...patch }; return payload(); },
    'shortcuts:suspend': () => true,
    'messages:list': () => [main],
    'messages:rename': ({ title: t }) => ({ ...main, title: t }),
    'messages:audio': ({ which }) => read(which === 'original' ? 'messy.wav' : 'fixed.wav'),
    'edit:open': () => ({ meta: main }),
    'edit:render': async ({ ops: next }) => ({ meta: { ...main, ops: next }, audio: read('fixed.wav') }),
    'edit:replace': async () => {
      await released('replace');
      if (!rep) throw new Error('no replace.json in media/');
      return { meta: { ...main }, op: { ...rep.op } };
    },
    'edit:restyle': async ({ engine, style, mix, i, j }) => {
      await released('restyle');
      if (i != null) {
        const text = W.slice(i, j + 1).map(w => w.w).join(' ');
        return { meta: main, op: { t0: W[i].s, t1: W[j].e, insert: 'ins_t', i, j, old: text, new: text, engine: 'praat', verified: true, kind: `natural ${style}` } };
      }
      main.take = { engine, style, ...(mix ? { mix } : {}), dur: data.fixed_duration, by: 'praat', wordsKept: 1 };
      return { meta: { ...main }, audio: read('fixed.wav') };
    },
    'edit:clear-take': () => { main.take = null; return { meta: { ...main }, audio: read('fixed.wav') }; },
    'engine:health': () => ({ ok: true, ms: 200, url: settings.backendUrl }),
  },
  events: [],
};
