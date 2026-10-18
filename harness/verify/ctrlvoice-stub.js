// Verification stub for the current ctrl+voice pages (app hub + overlay bar).
// App-specific on purpose; the harness itself is generic.

const DEFAULTS = {
  shortcuts: {
    toggle: 'Alt+`',
    open: 'Alt+Shift+`',
    undo: 'CommandOrControl+Z',
    review: 'CommandOrControl+Alt+Enter',
    cancel: 'Escape',
  },
  shortcutsVersion: 3,
  finishAction: 'send',
  autoSend: true,
  cutFillers: true,
  showIdleBar: true,
  launchAtStartup: false,
  startHidden: false,
  demoMode: true,
  micId: 'default',
  ttsVoice: '',
  userName: 'Antony',
};

let settings = JSON.parse(JSON.stringify(DEFAULTS));
const shortcutStatus = { toggle: true, open: true, undo: true, review: true, cancel: true };
const payload = () => ({ settings, shortcutStatus, defaults: DEFAULTS });

const words = (text, t0 = 0) => text.split(' ').map((w, i) => ({ w, t: t0 + i * 0.38 }));
const seg = (id, text, t0, undone = false) => {
  const ws = words(text, t0);
  return { id, start: t0, end: t0 + ws.length * 0.38, words: ws, undone, complete: true };
};

const now = Date.now();
const messages = [
  {
    id: 'mdemo1', type: 'voice', title: 'Quick update on the launch', createdAt: now - 25 * 60e3, duration: 14.6,
    demoMode: true, undoCount: 1, edits: [], tone: null, sentTo: 'Discord', hasAudio: false,
    segments: [
      seg('s1', 'Hey Sam, quick update on the launch.', 0),
      seg('s2', "So um, I'll meet you on Monday... wait, that's wrong.", 2.5, true),
      seg('s3', "I'll meet you on Wednesday at five.", 6),
      seg('s4', 'Can you just send me the final numbers tonight?', 9),
    ],
  },
  {
    id: 'mdemo2', type: 'voice', title: 'Dinner plans', createdAt: now - 26 * 3600e3, duration: 6.1,
    demoMode: true, undoCount: 0, edits: [], tone: null, hasAudio: false,
    segments: [seg('s1', 'Running ten minutes late, order without me.', 0)],
  },
];

let recording = false;

module.exports = {
  invoke: {
    'settings:get': () => payload(),
    'settings:set': (patch) => { settings = { ...settings, ...patch }; return payload(); },
    'shortcuts:suspend': () => true,
    'messages:list': () => messages,
    'messages:save': (m) => m,
    'messages:create': (m) => m,
    'messages:delete': () => true,
    'messages:audio': () => null,
    'voice:synthesize': () => null,
  },

  // `this.emit` pushes an IPC event into the page, like the real main process would.
  onSend(channel) {
    if (channel === 'rec:toggle') {
      recording = !recording;
      this.emit(recording ? 'rec:start' : 'rec:stop');
    }
  },

  events: [
    {
      channel: 'overlay:config',
      delay: 0,
      payload: () => ({
        demoMode: settings.demoMode,
        micId: settings.micId,
        showIdleBar: settings.showIdleBar,
        shortcuts: settings.shortcuts,
        finishAction: settings.finishAction,
      }),
    },
  ],
};
