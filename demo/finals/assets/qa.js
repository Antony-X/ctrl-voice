/* Ctrl+Voice Q&A backup deck: a small navigator (index + one answer per question) and the hand-drawn answers.
   Keys: 1-9 answer n, D the deepfake answer, Esc / 0 / Home the index, arrows prev/next, N notes overlay,
   S notes window, F fullscreen. No audio, no clipboard. Works from file://. */
(function () {
  const W = 1920, H = 1080;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const stage = $('#stage');
  const slides = $$('.slide');
  let cur = 0;

  function fit() { stage.style.transform = `translate(-50%, -50%) scale(${Math.min(innerWidth / W, innerHeight / H)})`; }
  addEventListener('resize', fit); fit();

  // ------------------------------------------------------------------ drawings
  const S = window.Sketch, C = S.C, A = S.alpha;
  const pen = (id) => S.P(S.el('g', {}, document.getElementById(id)));
  const sans = (o) => ({ font: 'sans', ...o });

  const draw = {
    v1(p) {   // privacy
      p.text(110, 30, 'today: a thin client', sans({ fs: 28, anchor: 'start', color: C.ink3 }));
      // your computer
      p.block(150, 110, 400, 270, null, C.ink2, { fa: 0.08 });
      p.rect(110, 388, 480, 26, { color: C.ink2, r: 6 });
      p.text(350, 180, 'your computer', { fs: 38 });
      p.text(350, 262, 'messages saved here', { fs: 28, color: C.ink2 });
      p.text(350, 312, 'original never changed', { fs: 28, color: C.made });
      // audio to the engine
      p.arrow([[600, 245], [830, 245]], { color: C.ink, sw: 3, hl: 18 });
      p.text(715, 205, 'audio', { fs: 30 });
      // our engine
      p.block(850, 70, 560, 400, null, C.model, { fa: 0.08 });
      p.rect(885, 104, 44, 36, { color: C.check, r: 5, sw: 2.4 });
      p.path('M894 104 L894 92 A13 13 0 0 1 920 92 L920 104', { color: C.check, sw: 2.4 });
      p.text(1160, 112, 'our hosted engine', { fs: 38 });
      p.text(1160, 165, 'protected by an access code', sans({ fs: 24, color: C.check }));
      p.block(900, 220, 460, 110, 'LLM on our own GPU', C.model, { fs: 34, fa: 0.2 });
      p.text(1130, 400, 'session files also kept here', { fs: 28, color: C.ink2 });
      // no third-party AI
      p.ellipse(1650, 250, 320, 170, { color: C.ink3, dash: [8, 8] });
      p.text(1650, 130, 'third-party AI API', { fs: 30, color: C.ink2 });
      p.line(1560, 200, 1740, 300, { color: C.cut, sw: 5 });
      p.line(1740, 200, 1560, 300, { color: C.cut, sw: 5 });
      p.text(1650, 395, 'not used by default', { fs: 28, color: C.cut });
      // roadmap
      p.line(110, 520, 1810, 520, { color: C.line, sw: 1.5 });
      p.rect(170, 570, 84, 150, { color: C.made, r: 16, sw: 2.6 });
      p.line(196, 700, 228, 700, { color: C.made, sw: 2.6 });
      p.text(300, 625, 'roadmap: on-device', sans({ fs: 30, anchor: 'start', color: C.made, weight: 600 }));
      p.text(300, 680, 'messages never leave your phone', { fs: 44, anchor: 'start' });
    },

    v2(p) {   // speed
      p.text(370, 230, '≈ 1 s', { font: 'serif', fs: 230, weight: 300 });
      p.text(370, 430, 'record → clean → send', sans({ fs: 38 }));
      p.text(370, 490, 'the everyday path', sans({ fs: 28, color: C.ink3 }));
      p.line(730, 40, 730, 640, { color: C.line, sw: 1.5 });
      const rows = [
        ['live transcript lag', 0.35, '350 ms', C.made], ['upload + transcribe', 0.4, '0.4 s', C.made],
        ['clean-up', 0.5, '0.5 s', C.made], ['tone', 0.6, '0.6 s', C.made],
        ['native accent', 2.8, '2.8 s', C.model], ['re-say a word', 3.0, '≈ 3 s', C.model],
      ];
      S.hbars(p.g, { x: 780, y: 30, w: 1090, rowH: 98, labelW: 440, max: 3.1, fs: 27, vfs: 32,
        bars: rows.map(([label, value, text, color]) => ({ label, value, text, color })) });
      p.text(1325, 650, 're-say: two models in parallel, plus verification', { fs: 28, color: C.ink2 });
      p.text(960, 735, 'measured warm on 10–15 s messages', sans({ fs: 24, color: C.ink3 }));
    },

    v3(p) {   // languages
      const cx = [170, 830, 1470];
      p.text(cx[0], 20, 'part', sans({ fs: 26, anchor: 'start', color: C.ink3 }));
      p.text(cx[1], 20, 'today: English only', sans({ fs: 26, anchor: 'start', color: C.ink3 }));
      p.text(cx[2], 20, 'for Georgian', sans({ fs: 26, anchor: 'start', color: C.ink3 }));
      const rows = [
        ['Whisper (speech to text)', 'multilingual, pinned to English', 1],
        ['LLM', 'multilingual', 1],
        ['aligner', 'knows English letters only', 0],
        ['pronunciation model', 'trained on English (speechocean762)', 0],
        ['rules', 'written for English', 0],
      ];
      rows.forEach(([name, today, reuse], i) => {
        const y = 105 + i * 104;
        p.rect(140, y - 44, 1640, 88, { color: C.line, fill: C.sheet, r: 12, sw: 1.5 });
        p.text(cx[0], y, name, { fs: 32, anchor: 'start' });
        p.text(cx[1], y, today, sans({ fs: 27, anchor: 'start', color: C.ink2 }));
        p.block(cx[2], y - 30, 280, 60, reuse ? 'reuse' : 'build new', reuse ? C.made : C.check, { fs: 28, fa: 0.2 });
      });
      p.text(170, 600, 'rules = fillers · "scratch that" · negations · numbers · days', sans({ fs: 24, anchor: 'start', color: C.ink3 }));
      p.text(960, 700, 'Georgian (ქართული) is the one we want most', { font: 'serif', fs: 50, italic: true });
    },

    v4(p) {   // AI vs original
      const x0 = 160, Wd = 1600, pxs = Wd / 9.2, ai = pxs * 1.0;
      p.text(x0, 60, "Sarah's message: 9.2 s", sans({ fs: 30, anchor: 'start', color: C.ink2 }));
      p.text(x0 + Wd - ai / 2, 60, '≈ 1 s AI', sans({ fs: 32, color: C.made, weight: 600 }));
      p.rect(x0, 110, Wd - ai - 6, 90, { color: C.ink2, fill: A(C.ink2, 0.22), r: 6 });
      p.rect(x0 + Wd - ai, 110, ai, 90, { color: C.made, fill: A(C.made, 0.55), r: 6 });
      p.text(x0 + (Wd - ai) / 2, 155, 'your real recording', { fs: 34 });
      p.text(x0, 240, 'lengths to scale; position illustrative', sans({ fs: 22, anchor: 'start', color: C.ink3 }));
      const cards = [
        ['cuts', 'YOUR AUDIO', 'kept exactly\nas recorded', C.ink2, 34],
        ['re-said words', 'AI', 'shown in green\nin the editor', C.made, 34],
        ['Confident · Calm · Warm', 'YOUR AUDIO', 'signal processing\n(Praat PSOLA)', C.check, 28],
        ['native accent', 'AI', 'off by default,\nlabelled', C.model, 34],
      ];
      cards.forEach(([t, tag, d, col, fs], i) => {
        const x = 160 + i * 410;
        p.block(x, 300, 370, 300, null, col, { fa: 0.1 });
        p.text(x + 185, 360, t, { fs });
        p.text(x + 185, 440, tag, sans({ fs: 34, color: col, weight: 600 }));
        p.text(x + 185, 530, d, sans({ fs: 25, color: C.ink2, lh: 32 }));
      });
      p.text(960, 670, 'the original file is never changed', { fs: 32, color: C.made });
      p.text(960, 725, 'Sarah and Eric are ElevenLabs voices reading our script · the fixed audio is real engine output', sans({ fs: 24, color: C.ink3 }));
    },

    v5(p) {   // safety
      p.text(430, 130, '0 / 10', { font: 'serif', fs: 200, weight: 300 });
      p.text(430, 275, 'meaning-changing edits', { fs: 36 });
      p.text(430, 325, 'on 10 trick sentences', sans({ fs: 27, color: C.ink2 }));
      p.text(430, 378, 'first version: 2', sans({ fs: 29, color: C.cut, weight: 600 }));
      p.line(960, 20, 960, 390, { color: C.line, sw: 1.5 });
      p.text(1440, 130, '24 / 28', { font: 'serif', fs: 200, weight: 300 });
      p.text(1440, 275, 'exact clean-ups', { fs: 36 });
      p.text(1440, 325, 'on 28 hand-written messages', sans({ fs: 27, color: C.ink2 }));
      const chips = [
        ['the LLM can\nonly delete', '', C.cut],
        ['not · numbers ·\ndates · times', 'kept unless a same-type\nrepair replaces them', C.check],
        ['unsure?', 'it becomes\na suggestion', C.model],
        ['fails both checks\nafter 3 rounds', 'a re-said word is never\napplied automatically', C.made],
      ];
      chips.forEach(([t, d, col], i) => {
        const x = 110 + i * 440;
        p.block(x, 460, 380, 220, null, col, { fa: 0.12 });
        p.text(x + 190, 528, t, { fs: 32, lh: 40 });
        if (d) p.text(x + 190, 622, d, sans({ fs: 23, color: C.ink2, lh: 30 }));
        if (i < 3) p.arrow([[x + 392, 570], [x + 430, 570]], { color: C.ink3, sw: 2.4 });
      });
    },

    v6(p) {   // where it fails
      const cx = [360, 960, 1560];
      // 1. pronunciation detector
      p.circle(cx[0], 200, 300, { color: C.line, sw: 12, rough: 0.4 });
      const a = 2 * Math.PI * 0.19, ex = cx[0] + 150 * Math.sin(a), ey = 200 - 150 * Math.cos(a);
      p.path(`M${cx[0]} 50 A150 150 0 0 1 ${ex.toFixed(1)} ${ey.toFixed(1)}`, { color: C.cut, sw: 14, rough: 0.4 });
      p.text(cx[0], 205, '19%', { font: 'serif', fs: 96 });
      // 2. seams
      const wv = (n, f, ph) => Array.from({ length: n }, (_, i) => Math.sin(i * f + ph) * (0.35 + 0.65 * Math.abs(Math.sin(i * 0.21 + ph))));
      p.wave(cx[1] - 210, 150, 200, 110, wv(90, 0.9, 0.3), { color: C.ink2, sw: 2 });
      p.wave(cx[1] + 10, 150, 200, 110, wv(90, 0.9, 1.7), { color: C.made, sw: 2 });
      p.line(cx[1], 90, cx[1], 320, { color: C.check, sw: 3, dash: [9, 8] });
      p.text(cx[1], 70, 'seam', sans({ fs: 24, color: C.check }));
      // 3. Discord
      p.block(cx[2] - 170, 90, 340, 90, 'audio attachment', C.ink2, { fs: 30, fa: 0.18 });
      p.block(cx[2] - 170, 230, 340, 90, 'native voice bubble', C.ink3, { fs: 30, fa: 0.04, dash: [8, 8], tcolor: C.ink3 });
      p.line(cx[2] - 185, 275, cx[2] + 185, 275, { color: C.cut, sw: 4 });
      const caps = [
        ['pronunciation detector\nin free speech', 'flagged 19% of expert-labelled errors:\nthe recognizer often writes\nwhat you actually said'],
        ['seams', 'can still be audible sometimes;\nroadmap: "seams nobody can hear",\nwith a blind listening test'],
        ['Discord', 'arrives as an audio attachment,\nnot a native voice bubble:\nthat needs official bots'],
      ];
      caps.forEach(([t, d], i) => {
        p.text(cx[i], 435, t, { fs: 34, lh: 42 });
        p.text(cx[i], 580, d, sans({ fs: 25, color: C.ink2, lh: 34 }));
      });
    },

    v7(p) {   // cost
      p.block(110, 20, 780, 640, null, C.model, { fa: 0.06 });
      p.text(500, 80, '1 GPU runs everything', { fs: 44 });
      ['Whisper', 'aligner', 'PlayDiffusion', 'F5-TTS', 'pronunciation model', 'native accent'].forEach((t, i) => {
        p.block(150 + (i % 2) * 360, 140 + Math.floor(i / 2) * 105, 340, 80, t, C.ink2, { fs: 28, fa: 0.12 });
      });
      p.block(150, 470, 700, 150, null, C.model, { fa: 0.22 });
      p.text(180, 515, 'the LLM: mixture-of-experts', { fs: 32, anchor: 'start' });
      p.text(180, 572, '3B parameters active per token', sans({ fs: 27, anchor: 'start', color: C.ink2 }));
      p.tokens(612, 560, 6, 30, { gap: 7, color: (i) => (i === 1 || i === 4 ? C.model : C.ink3), fa: 0.35 });
      const rows = [
        ['heavy steps run only when used', C.made],
        ['the LLM can be swapped for any\nOpenAI-compatible hosted model', C.model],
        ['on-device: the server cost goes away', C.made],
        ['per-message price: not measured yet', C.check],
        ['licences: F5-TTS weights are CC BY-NC;\na product needs commercial terms', C.cut],
      ];
      rows.forEach(([t, col], i) => {
        const y = 60 + i * 128;
        p.circle(985, y, 22, { color: col, fill: col, rough: 0.5 });
        p.text(1020, y, t, { fs: 34, anchor: 'start', lh: 42 });
      });
    },

    v8(p) {   // on-device roadmap
      const cx = [360, 960, 1560];
      ['first', 'then', 'stays hosted'].forEach((t, i) => p.text(cx[i], 20, t, sans({ fs: 28, color: C.ink3, weight: 600 })));
      [0, 1].forEach((i) => {
        p.rect(cx[i] - 120, 70, 240, 380, { color: C.made, r: 32, sw: 2.6 });
        p.line(cx[i] - 22, 425, cx[i] + 22, 425, { color: C.made, sw: 2.6 });
      });
      p.block(cx[0] - 95, 130, 190, 100, 'small\nrecognizer', C.made, { fs: 27, fa: 0.2, lh: 32 });
      p.block(cx[0] - 95, 260, 190, 100, 'compact\nLLM', C.made, { fs: 27, fa: 0.2, lh: 32 });
      p.block(cx[1] - 95, 180, 190, 130, 'distilled\nvoice\neditor', C.made, { fs: 27, fa: 0.2, lh: 32 });
      p.arrow([[505, 260], [815, 260]], { color: C.ink, sw: 3, hl: 18 });
      // hosted engine as a cloud
      p.ellipse(cx[2], 260, 400, 230, { color: C.model, sw: 2.4 });
      p.text(cx[2], 240, 'hosted engine', { fs: 36 });
      p.text(cx[2], 290, 'optional boost', sans({ fs: 26, color: C.model }));
      p.arrow([[1105, 260], [1345, 260]], { color: C.ink3, sw: 2.4, dash: [10, 9] });
      const caps = [
        ['live transcript · undo · clean-up', 'all most messages need', C.made],
        ['for the few re-said words', '', C.made],
        ['for heavy extras', 'like the accent', C.model],
      ];
      caps.forEach(([t, d, col], i) => {
        p.text(cx[i], 530, t, { fs: 32 });
        if (d) p.text(cx[i], 585, d, { fs: 30, color: col });
      });
    },

    v9(p) {   // splice vs regenerate; two models
      p.text(450, 10, 'voice similarity', { fs: 34 });
      const base = 600, k = 470;
      [[0.73, 'regenerate\nthe whole clip', C.cut, 240], [0.98, 'splice only\nthe new words', C.made, 500]].forEach(([v, t, col, x]) => {
        const h = v * k;
        p.rect(x, base - h, 170, h, { color: col, fill: A(col, 0.55), fillStyle: 'hachure', gap: 8, r: 0 });
        p.text(x + 85, base - h - 42, v.toFixed(2), { font: 'serif', fs: 66, color: col });
        p.text(x + 85, base + 52, t, { fs: 28, lh: 34 });
      });
      p.line(200, base, 710, base, { color: C.ink3, sw: 2 });
      p.line(830, 20, 830, 660, { color: C.line, sw: 1.5 });
      // right: right-of-10 against seconds
      const ox = 1040, oy = 560, sx = 52, sy = 40;
      const X = (s) => ox + s * sx, Y = (n) => oy - n * sy;
      p.text(1420, 10, 're-saying a word: right of 10, against seconds', { fs: 30 });
      p.arrow([[ox, oy], [X(14.4), oy]], { color: C.ink3, sw: 2 });
      p.arrow([[ox, oy], [ox, Y(11.2)]], { color: C.ink3, sw: 2 });
      [0, 5, 10].forEach((n) => p.text(ox - 18, Y(n), String(n), sans({ fs: 22, anchor: 'end', color: C.ink3 })));
      [0, 5, 10].forEach((s) => p.text(X(s), oy + 30, `${s} s`, sans({ fs: 22, color: C.ink3 })));
      const pts = [
        [1.5, 9, 'PlayDiffusion: 9/10 in 1.5 s', C.made, 34, 6, 'start'],
        [1.0, 7, 'F5-TTS: 7/10 in 1.0 s', C.made, 34, 6, 'start'],
        [12.7, 10, 'dots.tts: 10/10 in 12.7 s', C.cut, -30, -4, 'end'],
      ];
      pts.forEach(([s, n, t, col, dx, dy, anchor]) => {
        p.circle(X(s), Y(n), 26, { color: col, fill: col, rough: 0.5 });
        p.text(X(s) + dx, Y(n) + dy, t, sans({ fs: 26, anchor, color: C.ink }));
      });
      p.text(X(12.7) + 20, Y(10) + 56, 'too slow for a chat', sans({ fs: 24, anchor: 'end', color: C.cut }));
      p.text(1420, 680, 'PlayDiffusion and F5-TTS run in parallel;\nboth are verified, the closest voice is kept', { fs: 28, color: C.ink2, lh: 38 });
      p.text(450, 735, 'and your real recording stays', sans({ fs: 26, color: C.made }));
    },

    v10(p) {  // deepfake?
      const cx = [360, 960, 1560];
      // your own voice: a microphone
      p.rect(cx[0] - 34, 40, 68, 130, { color: C.ink, r: 34, sw: 2.6 });
      p.path(`M${cx[0] - 62} 120 Q${cx[0] - 62} 210 ${cx[0]} 210 Q${cx[0] + 62} 210 ${cx[0] + 62} 120`, { color: C.ink, sw: 2.6 });
      p.line(cx[0], 210, cx[0], 250, { color: C.ink, sw: 2.6 });
      // the words you meant / AI words in green: word tiles
      p.tokens(cx[1] - 175, 110, 5, 62, { gap: 16, color: C.ink2 });
      p.tokens(cx[2] - 175, 110, 5, 62, { gap: 16, color: (i) => (i === 2 ? C.made : C.ink2), fa: 0.3 });
      ['only your own voice', 'only the words you meant', 'every AI word in green'].forEach((t, i) => p.text(cx[i], 320, t, { fs: 38, color: i === 2 ? C.made : C.ink }));
      p.text(110, 430, 'roadmap', sans({ fs: 26, anchor: 'start', color: C.ink3, weight: 600 }));
      p.block(110, 465, 820, 110, 'an AudioSeal watermark on every generated word', C.model, { fs: 31, fa: 0.14 });
      p.block(990, 465, 820, 110, 'a "words changed" note the listener can see', C.model, { fs: 31, fa: 0.14 });
      p.text(960, 665, 'Discord · WhatsApp · Telegram · Slack · Signal · Teams', sans({ fs: 30, color: C.ink2 }));
      p.text(960, 715, 'Windows and macOS (the Mac version is newer and less tested)', sans({ fs: 24, color: C.ink3 }));
    },
  };
  for (const id in draw) {
    try { draw[id](pen(id)); } catch (e) { console.error(`draw ${id}`, e); }
  }

  // ------------------------------------------------------------------ navigation
  const total = slides.filter((s) => s.dataset.n).length;
  const indexOfN = (n) => slides.findIndex((s) => +s.dataset.n === n);
  const foot = $('#qa-foot');
  function paintFoot() {
    const s = slides[cur], n = s.dataset.n;
    const left = n ? `Q&amp;A · ${n === '10' ? 'D' : n} of ${total} · ${s.dataset.title}` : 'Q&amp;A · index';
    foot.innerHTML = `<span>${left}</span><span><kbd>Esc</kbd> index · <kbd>1</kbd>–<kbd>9</kbd> <kbd>D</kbd> answers · <kbd>N</kbd> notes</span>`;
  }
  function go(i) {
    if (i < 0 || i >= slides.length) return;
    slides[cur].classList.remove('active');
    cur = i;
    slides[cur].classList.add('active');
    try { history.replaceState(null, '', `#${slides[cur].dataset.id}`); } catch (e) { /* file:// may refuse */ }
    paintFoot();
    renderNotes();
  }

  // ------------------------------------------------------------------ speaker notes (N overlay, S window)
  let notesWin = null;
  const notesHTML = () => {
    const s = slides[cur], n = $('.notes', s);
    return `<div class="hd"><b>${s.dataset.n ? `${s.dataset.n === '10' ? 'D' : s.dataset.n}. ` : ''}${s.dataset.title}</b></div><div class="body">${n ? n.innerHTML : ''}</div>`;
  };
  function renderNotes() {
    const ov = $('#notes-overlay');
    if (ov.style.display === 'block') ov.innerHTML = notesHTML();
    if (notesWin && !notesWin.closed) $('#n', notesWin.document).innerHTML = notesHTML();
  }
  function openNotes() {
    notesWin = open('', 'cv-qa-notes', 'width=900,height=700');
    if (!notesWin) return;
    notesWin.document.title = 'Q&A notes';
    notesWin.document.body.innerHTML = `<style>body{background:#171716;color:#f3f2ee;font:23px/1.55 'Segoe UI','Noto Sans Georgian',Sylfaen,system-ui,sans-serif;margin:26px}
      .hd{border-bottom:1px solid #3a3836;padding-bottom:10px;margin-bottom:14px}em{color:#a8a49c}b{color:#fff}.en{color:#75716a;font-size:18px}
      p{margin:0 0 12px}.sec{color:#a8a49c;font-size:19px}.say{border-left:4px solid #4cc89b;padding-left:14px}</style><div id="n"></div>`;
    notesWin.addEventListener('keydown', onKey);
    renderNotes();
  }

  // ------------------------------------------------------------------ input
  function onKey(e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;      // leave Ctrl+Tab, Ctrl+1..9 etc. to the browser
    const k = e.key;
    if (/^[1-9]$/.test(k)) go(indexOfN(+k));
    else if (k === 'd' || k === 'D') go(indexOfN(10));
    else if (k === 'Escape' || k === '0' || k === 'Home') go(0);
    else if (['ArrowRight', 'PageDown', ' '].includes(k)) { e.preventDefault(); go(Math.min(slides.length - 1, cur + 1)); }
    else if (['ArrowLeft', 'PageUp', 'Backspace'].includes(k)) { e.preventDefault(); go(Math.max(0, cur - 1)); }
    else if (k === 'End') go(slides.length - 1);
    else if (k === 'n' || k === 'N') { const ov = $('#notes-overlay'); ov.style.display = ov.style.display === 'block' ? 'none' : 'block'; renderNotes(); }
    else if (k === 's' || k === 'S') openNotes();
    else if (k === 'f' || k === 'F') { document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen().catch(() => {}); }
  }
  addEventListener('keydown', onKey);
  $$('.ix-card').forEach((c) => c.addEventListener('click', () => go(indexOfN(+c.dataset.go))));

  const m = /^#(\w+)/.exec(location.hash);
  const start = m ? slides.findIndex((s) => s.dataset.id === m[1]) : -1;
  cur = start >= 0 ? start : 0;
  slides[cur].classList.add('active');
  paintFoot();
  window.QA = { go, count: slides.length };
})();
