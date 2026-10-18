// Writes tone-light.json and tone-dark.json: the tone panel.
const fs = require('fs');
const path = require('path');
const slide = (tone, v, release) => `{ const r = document.querySelector('.tc-range[data-tone=${tone}]'); r.value = ${v};
  r.dispatchEvent(new Event('input', { bubbles: true }));${release ? " r.dispatchEvent(new Event('change', { bubbles: true }));" : ''} }`;
const click = (sel) => `document.querySelector('${sel}').click()`;
const mute = 'HTMLMediaElement.prototype.play = function () { return Promise.resolve(); };';
for (const scheme of ['light', 'dark']) {
  const out = (n) => `../out/tone-${scheme}-${n}.png`;
  const plan = {
    page: 'C:/Users/Antony/Desktop/ctrl+voice/src/app/index.html',
    width: 1180, height: 780, transparent: false,
    backgroundColor: scheme === 'dark' ? '#171716' : '#f3f2ee',
    stub: 'hub-stub.js', colorScheme: scheme, scale: 1, timeout: 60000,
    shots: [
      { wait: 1800, js: `${mute} ${click('[data-action=tone-panel]')}`, settle: 400, out: out('1-open') },
      { wait: 0, js: slide('confident', 67, true), settle: 450, out: out('2-working') },
      { wait: 0, js: '0', settle: 1100, out: out('3-confident') },
      { wait: 0, js: `${slide('calm', 30, false)} ${slide('warm', 100, false)} ${slide('confident', 100, false)}`, settle: 600, out: out('4-mix-dragging') },
      { wait: 0, js: `${slide('warm', 100, true)}`, settle: 1600, out: out('5-mix-applied') },
      { wait: 0, js: click('[data-action=tone-tab][data-tab=ai]'), settle: 400, out: out('6-ai') },
      { wait: 0, js: click('[data-action=tone-ai][data-tone=excited]'), settle: 1500, out: out('7-ai-excited') },
      { wait: 0, js: 'closeTone()', settle: 300, out: out('8-closed') },
    ],
  };
  fs.writeFileSync(path.join(__dirname, `tone-${scheme}.json`), JSON.stringify(plan, null, 2));
}
