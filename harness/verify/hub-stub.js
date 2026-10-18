// Stub for the redesigned hub (src/app). Words, cuts and audio come from a real
// engine run on the demo recording (sample/make.js); the replacement, the
// suggestion, the unclear word and the AI region are added for coverage.
const fs = require('fs');
const path = require('path');
const Edits = require('C:/Users/Antony/Desktop/ctrl+voice/src/shared/edits.js');

const SAMPLE = path.join(__dirname, '..', '..', 'sample');
const sample = JSON.parse(fs.readFileSync(path.join(SAMPLE, 'sample.json'), 'utf8'));
const wav = (name) => fs.readFileSync(path.join(SAMPLE, name));

const DEFAULTS = {
  shortcuts: { toggle: 'Alt+`', open: 'Alt+Shift+`', undo: 'CommandOrControl+Z', review: 'CommandOrControl+Alt+Enter', cancel: 'Escape' },
  shortcutsVersion: 3,
  backendUrl: 'https://zaa3ajj8o85hhq-7860.proxy.runpod.net',
  finishAction: 'send', autoSend: true,
  fix: { cleanup: true, grammar: true, pronunciation: true },
  showIdleBar: true, launchAtStartup: false, startHidden: false, micId: 'default',
};
let settings = JSON.parse(JSON.stringify(DEFAULTS));
const shortcutStatus = { toggle: true, open: true, undo: true, review: false, cancel: true };
const payload = () => ({ settings, shortcutStatus, defaults: DEFAULTS });

const W = sample.words;
const ops = sample.ops.map(o => ({ ...o }));
// "bring" re-made as "grab" by the engine
ops.push({ id: 'rep1', type: 'replace', t0: W[23].s - 0.03, t1: W[23].e + 0.03, insert: 'ins_x', i: 23, j: 23, old: 'bring', new: 'grab', engine: 'f5', verified: true, kind: 'replace', on: true });
// a shortening suggestion over the repeated "the,"
ops.push({ ...Edits.cutRange(W, 24, 24, sample.dur), id: 'sug1', kind: 'repetition', on: false, auto: false });

const now = Date.now();
const main = {
  id: 'm1', sid: sample.sid, title: 'Wednesday at the cafe', createdAt: now - 12 * 60e3, from: 'Discord', sentTo: null,
  dur: sample.dur, words: W, removed: sample.removed, ops, fixed: now - 11 * 60e3,
  pron: { items: [{ i: 19, word: 'cafe.', acc: 6.1 }], accent: null },
  output: { dur: sample.render.dur, ai: [[3.15, 3.55]] }, take: null,
};
const messages = [
  main,
  { id: 'm2', sid: null, title: 'Running ten minutes late', createdAt: now - 3 * 3600e3, sentTo: 'WhatsApp', from: 'WhatsApp', dur: 4.2, words: [], ops: [], output: { dur: 3.6, ai: [] }, fixed: 1 },
  { id: 'm3', sid: null, title: 'Notes for the standup', createdAt: now - 26 * 3600e3, sentTo: 'Slack', from: 'Slack', dur: 21.4, words: [], ops: [], output: { dur: 17.9, ai: [] }, fixed: 1 },
  { id: 'm4', sid: null, title: 'Happy birthday, Lena', createdAt: now - 4 * 864e5, sentTo: null, from: 'Telegram', dur: 9.8, words: [], ops: [], output: null, fixed: 1 },
];

module.exports = {
  invoke: {
    'settings:get': () => payload(),
    'settings:set': (patch) => {
      settings = { ...settings, ...patch, shortcuts: { ...settings.shortcuts, ...(patch.shortcuts || {}) }, fix: { ...settings.fix, ...(patch.fix || {}) } };
      return payload();
    },
    'shortcuts:suspend': () => true,
    'messages:list': () => messages,
    'messages:rename': ({ id, title }) => ({ ...messages.find(m => m.id === id), title }),
    'messages:delete': () => true,
    'messages:audio': ({ id, which }) => (id === 'm1' ? wav(which === 'original' ? 'original.wav' : 'output.wav') : null),
    'edit:open': (id) => ({ meta: messages.find(m => m.id === id) }),
    'edit:render': ({ id, ops: next }) => ({ meta: { ...messages.find(m => m.id === id), ops: next }, audio: wav('output.wav') }),
    // a fake engine that takes 0.9 s, so the panel's working state can be shot
    'edit:restyle': ({ id, engine, style, mix, i, j }) => new Promise((resolve) => setTimeout(() => {
      const m = messages.find(x => x.id === id);
      if (i != null) {
        const text = W.slice(i, j + 1).map(w => w.w).join(' ');
        return resolve({ meta: m, op: { t0: W[i].s, t1: W[j].e, insert: 'ins_t', i, j, old: text, new: text, engine: 'praat', verified: true, kind: `natural ${style}` } });
      }
      m.take = { engine, style, ...(mix ? { mix } : {}), dur: sample.render.dur, by: engine === 'tone' ? 'AuK' : 'praat', wordsKept: 1, voiceSim: 0.9 };
      resolve({ meta: { ...m }, audio: wav('output.wav') });
    }, 900)),
    'edit:clear-take': (id) => {
      const m = messages.find(x => x.id === id);
      m.take = null;
      return { meta: { ...m }, audio: wav('output.wav') };
    },
    'engine:health': () => ({ ok: true, ms: 238, url: settings.backendUrl }),
  },
  events: [],
};
