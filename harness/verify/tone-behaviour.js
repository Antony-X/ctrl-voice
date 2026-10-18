// Writes tone-behaviour.json: checks the tone panel's logic against the stub.
const fs = require('fs');
const path = require('path');
const slide = (tone, v) => `{ const r = document.querySelector('.tc-range[data-tone=${tone}]'); r.value = ${v};
  r.dispatchEvent(new Event('input', { bubbles: true })); r.dispatchEvent(new Event('change', { bubbles: true })); }`;
const state = `JSON.stringify({ take: S.meta.take && { engine: S.meta.take.engine, style: S.meta.take.style, mix: S.meta.take.mix },
  levels: TONE.levels, open: !toneEl.hidden, plays: window.__plays, calls: window.__calls, pill: document.querySelector('[data-action=tone-panel]').textContent.trim(),
  summary: document.querySelector('.summary .what')?.textContent })`;
const setup = `window.__plays = 0; HTMLMediaElement.prototype.play = function () { window.__plays++; return Promise.resolve(); };
  window.__calls = []; const inv = api.invoke; api.invoke = (ch, a) => { if (ch.startsWith('edit:restyle') || ch === 'edit:clear-take') window.__calls.push(ch === 'edit:clear-take' ? 'clear' : JSON.stringify(a.mix || a.style)); return inv(ch, a); };
  document.querySelector('[data-action=tone-panel]').click(); 'opened'`;
const plan = {
  page: 'C:/Users/Antony/Desktop/ctrl+voice/src/app/index.html', width: 1180, height: 780, transparent: false,
  backgroundColor: '#e9edf1', stub: 'hub-stub.js', colorScheme: 'light', scale: 1, timeout: 60000,
  shots: [
    { wait: 1800, js: setup, settle: 200, out: '../out/beh-0.png' },
    // confident lets go, then warm moves while that take is being made: two calls, the second with both
    { wait: 0, js: `${slide('confident', 67)} setTimeout(() => { ${slide('warm', 40)} }, 500); 'sliding'`, settle: 3200, out: '../out/beh-1.png' },
    { wait: 0, js: state, settle: 0, out: '../out/beh-2.png' },
    // clicking the calm character steps it to Medium
    { wait: 0, js: `document.querySelector('[data-action=tone-bump][data-tone=calm]').click(); 'bump'`, settle: 2000, out: '../out/beh-3.png' },
    { wait: 0, js: state, settle: 0, out: '../out/beh-4.png' },
    // the player bar stays usable with the panel open
    { wait: 0, js: `document.querySelector('[data-action=view][data-view=original]').dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); document.querySelector('[data-action=view][data-view=original]').click(); JSON.stringify({ open: !toneEl.hidden, view: S.view })`, settle: 200, out: '../out/beh-5.png' },
    // No tone change clears the take and the sliders
    { wait: 0, js: `document.querySelector('[data-action=tone-reset]').click(); 'reset'`, settle: 600, out: '../out/beh-6.png' },
    { wait: 0, js: state, settle: 0, out: '../out/beh-7.png' },
    // Esc closes it; reopening shows no tone
    { wait: 0, js: `document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); const closed = toneEl.hidden; document.querySelector('[data-action=tone-panel]').click(); JSON.stringify({ closedByEsc: closed, reopened: !toneEl.hidden, read: document.querySelector('.tone-read').textContent })`, settle: 200, out: '../out/beh-8.png' },
    // a click in the transcript closes it
    { wait: 0, js: `document.querySelector('.transcript').dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); JSON.stringify({ closedByOutside: toneEl.hidden })`, settle: 200, out: '../out/beh-9.png' },
  ],
};
fs.writeFileSync(path.join(__dirname, 'tone-behaviour.json'), JSON.stringify(plan, null, 2));
