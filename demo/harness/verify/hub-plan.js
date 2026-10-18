// Writes hub-light.json and hub-dark.json.
const fs = require('fs');
const path = require('path');
const pick = (i, j = i) => `{ const a = document.querySelector('.w[data-k="${i}"]'); const b = document.querySelector('.w[data-k="${j}"]') || a;
  a.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); b.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
  document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true })); }`;
const click = (sel) => `document.querySelector('${sel}').click()`;
for (const scheme of ['light', 'dark']) {
  const out = (n) => `../out/hub-${scheme}-${n}.png`;
  const plan = {
    page: 'C:/Users/Antony/Desktop/ctrl+voice/src/app/index.html',
    width: 1180, height: 780, transparent: false,
    backgroundColor: scheme === 'dark' ? '#171716' : '#f3f2ee',
    stub: 'hub-stub.js', colorScheme: scheme, scale: 1, timeout: 60000,
    shots: [
      { wait: 1800, out: out('1-editor') },
      { wait: 0, js: pick(3, 5), settle: 250, out: out('2-select') },
      { wait: 0, js: click('.pop [data-action=tone]'), settle: 250, out: out('3-pop-tone') },
      { wait: 0, js: `clearSelection(); ${pick(6)}`, settle: 250, out: out('4-cut') },
      { wait: 0, js: `clearSelection(); ${pick(23)}`, settle: 250, out: out('5-replaced') },
      { wait: 0, js: `clearSelection(); ${pick(24)}`, settle: 250, out: out('6-suggestion') },
      { wait: 0, js: `clearSelection(); ${pick(19)}`, settle: 250, out: out('7-unclear') },
      { wait: 0, js: `clearSelection(); ${click('[data-action=tone-panel]')}`, settle: 400, out: out('8-tone-panel') },
      { wait: 0, js: `closeTone(); ${click('[data-action=send-menu]')}`, settle: 250, out: out('9-send-menu') },
      { wait: 0, js: `closeMenu(); ${click('[data-action=go-settings]')}`, settle: 600, out: out('10-settings') },
      { wait: 0, js: `document.querySelector('.main').scrollTop = 9999`, settle: 200, out: out('11-settings-bottom') },
      { wait: 0, js: `S.messages = []; goHome()`, settle: 300, out: out('12-empty') },
    ],
  };
  fs.writeFileSync(path.join(__dirname, `hub-${scheme}.json`), JSON.stringify(plan, null, 2));
}
