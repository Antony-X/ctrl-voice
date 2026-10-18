// Writes overlay-light.json and overlay-dark.json: idle, hover, recording, undo, working and sent.
const fs = require('fs');
const path = require('path');
const REC = `
  session = { elapsed: 7.4, levels: (n) => Array.from({ length: n }, (_, i) => {
    const x = i / n; return x < .12 ? .05 : .1 + .85 * Math.abs(Math.sin(i * 1.7) * Math.sin(i * .37 + 1)); }) };
  const text = "Hey Maya, so about this weekend, I'll meet you on Monday, no wait, Wednesday at five";
  let t = 0; words = text.split(' ').map((w) => { const o = { w, s: t, e: t + .3 }; t += .35; return o; });
  for (const k of [10, 11, 12]) words[k].x = true;
  recentCut = { t0: words[10].s, t1: words[12].e };
  setState('rec'); $('capTarget').textContent = 'To Discord'; $('capNote').textContent = noteText();
  renderCaption(); setTimeout(drawWave, 600); $('time').textContent = '0:07';`;
for (const scheme of ['light', 'dark']) {
  const bg = scheme === 'dark' ? 'wallpaper-dark' : 'wallpaper-light';
  const out = (n) => `../out/overlay-${scheme}-${n}.png`;
  const plan = {
    page: 'C:/Users/Antony/Desktop/ctrl+voice/src/overlay/overlay.html',
    width: 680, height: 240, transparent: true, backdrop: bg, stub: 'ctrlvoice-stub.js', colorScheme: scheme, scale: 2,
    shots: [
      { wait: 800, out: out('1-idle') },
      { wait: 0, js: `pill.classList.add('force-hover'); document.querySelector('.pill').style.cssText = 'width:214px;height:34px;opacity:1'; document.querySelector('.idle-line').style.opacity = 0; document.querySelector('.idle-hint').style.opacity = 1`, settle: 500, out: out('2-hover') },
      { wait: 0, js: `document.querySelector('.pill').style.cssText = ''; document.querySelector('.idle-line').style.opacity = ''; document.querySelector('.idle-hint').style.opacity = ''; ${REC}`, settle: 900, out: out('3-rec') },
      { wait: 0, js: `showRestore(true); $('capNote').textContent = 'Scratched that'`, settle: 300, out: out('4-restore') },
      { wait: 0, js: `showRestore(false); setState('proc'); $('procText').textContent = 'Cleaning up…'`, settle: 700, out: out('5-proc') },
      { wait: 0, js: `pill.classList.add('ok'); $('procText').textContent = 'Sent to Discord'`, settle: 400, out: out('6-sent') },
    ],
  };
  fs.writeFileSync(path.join(__dirname, `overlay-${scheme}.json`), JSON.stringify(plan, null, 2));
}
