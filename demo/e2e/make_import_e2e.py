"""e2e/import.js: the e2e harness driving Import a voice note (path/drop, file picker, cancel, bad file, Native accent)."""
import sys

D = r"C:\Users\Antony\AppData\Local\Temp\claude\C--Users-Antony-Desktop-ctrl-voice\5985905e-4572-4f19-a6ec-0c1ce1de5723\scratchpad\e2e"
src = open(D + r"\main.js", encoding="utf-8").read()
edits = [
    ("const { app, BrowserWindow, ipcMain } = require('electron');",
     "const { app, BrowserWindow, ipcMain, dialog } = require('electron');"),
    ("const UD = path.join(DIR, 'userData');", "const UD = path.join(DIR, 'userData_import');"),
    ("    tone: { calm: 0.4 }, // Your sound: every message gets a light calm take\n", ""),
    # other keys than the main harness, so the two never fight over global shortcuts
    ("      toggle: 'Control+Alt+Shift+F9', open: 'Control+Alt+Shift+F10', undo: 'Control+Alt+Shift+F11',\n"
     "      review: 'Control+Alt+Shift+F12', cancel: 'Control+Alt+Shift+F8',",
     "      toggle: 'Control+Alt+Shift+F3', open: 'Control+Alt+Shift+F4', undo: 'Control+Alt+Shift+F5',\n"
     "      review: 'Control+Alt+Shift+F6', cancel: 'Control+Alt+Shift+F7',"),
    ("const LOG = path.join(OUT, `e2e-${runId}.log`);", "const LOG = path.join(OUT, `import-${runId}.log`);"),
    ("    if (STEPS.includes('cancel')) await stepCancel();\n  } catch",
     "    if (STEPS.includes('cancel')) await stepCancel();\n    if (STEPS.includes('import')) await stepImport();\n  } catch"),
]
for old, new in edits:
    if src.count(old) != 1:
        sys.exit(f"expected 1 match: {old[:80]}")
    src = src.replace(old, new)

src += r"""
// ---------- import a voice note ----------
const IMP = path.join(DIR, 'import_in');
const VIEW = `({ id: S.id, route: S.route, imported: S.meta && S.meta.imported, sid: S.meta && S.meta.sid, words: S.meta ? S.meta.words.length : 0,
  dur: S.meta && S.meta.dur, title: S.meta && S.meta.title, take: S.meta && S.meta.take, out: S.meta && S.meta.output && S.meta.output.dur,
  fixing: S.fixing, importing: !!S.importing, btn: document.getElementById('importLabel').textContent, btnDisabled: document.getElementById('importBtn').disabled,
  head: (document.querySelector('.head') || {}).textContent?.replace(/\s+/g, ' ').trim().slice(0, 160),
  summary: (document.querySelector('.summary') || {}).textContent?.replace(/\s+/g, ' ').trim(), url: location.href })`;

function wavSeconds(file) {
  const b = fs.readFileSync(file);
  const sr = b.readUInt32LE(24), ch = b.readUInt16LE(22), bits = b.readUInt16LE(34);
  return (b.length - 44) / (sr * ch * bits / 8);
}

async function importOne(step, name, how, check) {
  const file = path.join(IMP, name);
  const since = await R('Date.now()');
  const before = listMsgs().length;
  const t0 = Date.now();
  if (how === 'picker') {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] });
    await R(`document.getElementById('importBtn').click(); true`);
  } else {
    await R(`importNote(${JSON.stringify(file)}); true`);
  }
  const busy = await R(VIEW);
  const id = await waitFor(() => R(`(S.route === 'editor' && S.meta && S.meta.imported === ${JSON.stringify(name)}) ? S.id : null`), 120000, 200);
  const openedMs = Date.now() - t0;
  const fixed = id && await waitFor(() => R(`(!S.fixing && !S.importing && !S.job) ? true : null`), 240000, 250);
  const st = await R(VIEW);
  const orig = id && path.join(UD, 'messages', `${id}.wav`);
  const origSec = orig && fs.existsSync(orig) ? +wavSeconds(orig).toFixed(2) : null;
  const toasts = await newToasts(since);
  const kept = id ? require(`${CV}/src/shared/edits.js`).keptText(readMsg(id).words, readMsg(id).ops) : '';
  const ok = !!id && !!fixed && listMsgs().length === before + 1 && st.words > 5 && st.sid && origSec && Math.abs(origSec - st.dur) < 0.15
    && /imported/.test(st.head || '') && !toasts.some(t => t.bad) && !st.btnDisabled && (!check || check(st));
  record(step, ok, { openedMs, fixedMs: Date.now() - t0, busyWhileImporting: { btn: busy.btn, disabled: busy.btnDisabled }, origSec, ...st, kept, toasts });
  await screenshot(step.replace(/\W+/g, '-'));
  return st;
}

const readMsg = (id) => JSON.parse(fs.readFileSync(path.join(UD, 'messages', `${id}.json`), 'utf8'));

async function stepImport() {
  log('== import');
  await R(`player.muted = true; true`);
  await importOne('import m4a by path (as a drop does)', 'Voice memo 12.m4a', 'path');
  await importOne('import opus via the file picker', 'WhatsApp Audio 2026-10-18.opus', 'picker');

  {
    const since = await R('Date.now()'), before = listMsgs().length;
    dialog.showOpenDialog = async () => ({ canceled: true, filePaths: [] });
    await R(`document.getElementById('importBtn').click(); true`);
    await sleep(1500);
    const st = await R(VIEW), toasts = await newToasts(since);
    record('picker cancelled: nothing happens', listMsgs().length === before && !toasts.length && !st.btnDisabled, { st, toasts });
  }
  {
    const since = await R('Date.now()'), before = listMsgs().length;
    await R(`importNote('C:/Windows/win.ini'); true`);
    await sleep(1500);
    const toasts = await newToasts(since);
    record('not an audio file: clear error', listMsgs().length === before && toasts.some(t => t.bad && /Couldn't import/.test(t.text)), { toasts });
  }
  {
    const since = await R('Date.now()'), url = await R('location.href');
    await R(`(() => { const dt = new DataTransfer(); dt.items.add(new File(['x'], 'note.wav', { type: 'audio/wav' }));
      document.dispatchEvent(new DragEvent('dragover', { dataTransfer: dt, bubbles: true, cancelable: true }));
      document.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true })); return true; })()`);
    await sleep(800);
    const toasts = await newToasts(since), after = await R('location.href'), dropping = await R(`document.body.classList.contains('dropping')`);
    record('drop of a file that is not on disk: explained, no navigation', after === url && !dropping && toasts.some(t => t.bad && /Save the voice note/.test(t.text)), { toasts, url: after });
  }

  // The demo script (synthetic take): both misspoken words are fixed and labelled Misspoken, not Grammar.
  {
    const st = await importOne('import the demo script take (TTS)', 'TEST_SYNTH_scriptA_grumpy_chris.wav', 'path');
    const reps = readMsg(st.id).ops.filter(o => o.type === 'replace').map(o => ({ old: o.old, new: o.new, kind: o.kind }));
    const kind = (w) => reps.find(r => (r.new || '').toLowerCase().includes(w))?.kind;
    record('demo script: specific and moot fixed as Misspoken', kind('specific') === 'misspoken' && kind('moot') === 'misspoken',
      { reps, kept: require(`${CV}/src/shared/edits.js`).keptText(readMsg(st.id).words, readMsg(st.id).ops) });
  }

  await R(`api.invoke('settings:set', { accent: true })`);
  await importOne('import wav with Settings > Native accent on', 'russian_C24A_original.wav', 'path',
    (st) => st.take && st.take.engine === 'accent' && /native accent/i.test(st.summary || ''));
}
"""
open(D + r"\import.js", "w", encoding="utf-8").write(src)
print("wrote import.js")
