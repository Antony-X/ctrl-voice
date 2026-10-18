/* Small interface sounds, synthesised with Web Audio (no files, works from file://).
   Sfx.unlock() runs on the first click; until then every call is silent. Sfx.muted toggles them all off. */
(function () {
  let ac = null, out = null;
  const Sfx = { muted: false };

  Sfx.unlock = function () {
    if (ac) return ac.resume();
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ac = new AC(); out = ac.createGain(); out.gain.value = 0.32; out.connect(ac.destination);
  };
  const ready = () => ac && !Sfx.muted;

  function tone(freq, t0, dur, o = {}) {
    const osc = ac.createOscillator(), g = ac.createGain();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(o.gain || 0.5, t0 + (o.attack || 0.006));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(out); osc.start(t0); osc.stop(t0 + dur + 0.02);
  }
  function noise(t0, dur, o = {}) {
    const n = Math.floor(ac.sampleRate * dur), buf = ac.createBuffer(1, n, ac.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const src = ac.createBufferSource(), bp = ac.createBiquadFilter(), g = ac.createGain();
    src.buffer = buf; bp.type = 'bandpass'; bp.Q.value = o.q || 1.2;
    bp.frequency.setValueAtTime(o.f0 || 600, t0); bp.frequency.exponentialRampToValueAtTime(o.f1 || 4000, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(o.gain || 0.35, t0 + dur * 0.35); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(bp).connect(g).connect(out); src.start(t0); src.stop(t0 + dur);
  }

  /** A message arrives. */
  Sfx.pop = () => { if (!ready()) return; const t = ac.currentTime; tone(880, t, 0.09, { to: 520, gain: 0.55 }); tone(1320, t + 0.05, 0.08, { gain: 0.25 }); };
  /** Sent, or swiped away. */
  Sfx.swoosh = (up = true) => { if (!ready()) return; noise(ac.currentTime, 0.32, up ? { f0: 500, f1: 5200 } : { f0: 4200, f1: 400 }); };
  /** Fixed: a short bright arpeggio. */
  Sfx.sparkle = () => {
    if (!ready()) return; const t = ac.currentTime;
    [1046.5, 1318.5, 1568, 2093].forEach((f, i) => tone(f, t + i * 0.055, 0.32, { gain: 0.22, type: 'triangle' }));
  };
  /** Rewind: a falling sweep. */
  Sfx.rewind = () => { if (!ready()) return; const t = ac.currentTime; tone(1400, t, 0.42, { to: 180, gain: 0.18, type: 'sawtooth' }); noise(t, 0.42, { f0: 3000, f1: 300, gain: 0.18 }); };
  /** The camera lands on a part of the map. */
  Sfx.tick = (f = 660) => { if (!ready()) return; const t = ac.currentTime; tone(f, t, 0.06, { gain: 0.2, type: 'triangle' }); };   // f: the map's build cascade climbs a scale
  /** A big reveal (the number counter, the whole map). */
  Sfx.whoom = () => { if (!ready()) return; const t = ac.currentTime; tone(110, t, 0.9, { to: 55, gain: 0.5 }); noise(t, 0.7, { f0: 200, f1: 1800, gain: 0.12 }); };
  /** Sound check: two clear notes, then the same at the other ear's pitch, about 1.2 s. */
  Sfx.check = () => {
    Sfx.unlock(); if (!ac) return; const t = ac.currentTime + 0.05;
    tone(523.25, t, 0.5, { gain: 0.6 }); tone(659.25, t + 0.35, 0.5, { gain: 0.6 }); tone(783.99, t + 0.7, 0.6, { gain: 0.6 });
  };

  window.Sfx = Sfx;
})();
