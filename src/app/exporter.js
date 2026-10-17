// Renders the edited message to a single audio file (WAV, 24 kHz mono) —
// what actually gets pasted into Discord.
//
// Original audio ranges are cut and crossfaded; generated words come from the
// voice backend (main process `voice:synthesize`, a Windows-voice stand-in for
// now) and are loudness-matched to the speaker so they sit in the mix.
(function () {
  const OUT_RATE = 24000;
  const FADE = 0.012;
  let decodeCtx = null;

  const toArrayBuffer = (u8) => (u8 instanceof ArrayBuffer ? u8 : u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength));

  async function decode(bytes) {
    decodeCtx ||= new AudioContext({ sampleRate: 48000 });
    return decodeCtx.decodeAudioData(toArrayBuffer(bytes).slice(0));
  }

  // Loudness of the speech parts only (ignores silence between words).
  function speechRms(buf, from = 0, to = buf.duration) {
    const d = buf.getChannelData(0);
    const frame = Math.floor(buf.sampleRate * 0.02);
    const frames = [];
    for (let i = Math.floor(from * buf.sampleRate); i + frame < Math.min(d.length, to * buf.sampleRate); i += frame) {
      let s = 0;
      for (let j = i; j < i + frame; j++) s += d[j] * d[j];
      frames.push(Math.sqrt(s / frame));
    }
    if (!frames.length) return 0;
    frames.sort((a, b) => b - a);
    const top = frames.slice(0, Math.max(1, Math.floor(frames.length / 2)));
    return top.reduce((a, b) => a + b, 0) / top.length;
  }

  function trimSilence(buf, threshold = 0.008) {
    const d = buf.getChannelData(0);
    let a = 0, b = d.length - 1;
    while (a < b && Math.abs(d[a]) < threshold) a++;
    while (b > a && Math.abs(d[b]) < threshold) b--;
    const pad = Math.floor(buf.sampleRate * 0.03);
    a = Math.max(0, a - pad); b = Math.min(d.length - 1, b + pad);
    return { from: a / buf.sampleRate, dur: Math.max(0.05, (b - a) / buf.sampleRate) };
  }

  function encodeWav(buf) {
    const data = buf.getChannelData(0);
    const out = new DataView(new ArrayBuffer(44 + data.length * 2));
    const str = (o, s) => { for (let i = 0; i < s.length; i++) out.setUint8(o + i, s.charCodeAt(i)); };
    str(0, 'RIFF'); out.setUint32(4, 36 + data.length * 2, true); str(8, 'WAVE');
    str(12, 'fmt '); out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, 1, true);
    out.setUint32(24, buf.sampleRate, true); out.setUint32(28, buf.sampleRate * 2, true);
    out.setUint16(32, 2, true); out.setUint16(34, 16, true);
    str(36, 'data'); out.setUint32(40, data.length * 2, true);
    for (let i = 0; i < data.length; i++) {
      const s = Math.max(-1, Math.min(1, data[i]));
      out.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }
    return out.buffer;
  }

  /** 256 bytes 0–255, the shape Discord uses for voice-message waveforms. */
  function waveform(buf, n = 256) {
    const d = buf.getChannelData(0);
    const per = Math.max(1, Math.floor(d.length / n));
    const peaks = Array.from({ length: n }, (_, i) => {
      let m = 0;
      for (let j = i * per; j < (i + 1) * per && j < d.length; j += 4) m = Math.max(m, Math.abs(d[j]));
      return m;
    });
    const max = Math.max(...peaks, 1e-6);
    return peaks.map(p => Math.round((p / max) * 255));
  }

  /**
   * @param msg   message model (segments, edits, tone)
   * @param audio original recording bytes (Uint8Array/ArrayBuffer) or null
   * @returns {Promise<{wav: ArrayBuffer, duration: number, waveform: number[]}>}
   */
  async function renderMessage(msg, audio) {
    const src = audio ? await decode(audio) : null;
    const items = buildPlaylist(msg, !!src);
    const voiceLevel = src ? speechRms(src) : 0;

    const chunks = [];
    for (const it of items) {
      if (it.type === 'audio' && src) {
        const to = Math.min(it.to, src.duration);
        if (to - it.from > 0.02) chunks.push({ buf: src, from: it.from, dur: to - it.from, gain: 1 });
      } else if (it.type === 'tts' && it.text.trim()) {
        const bytes = await api.invoke('voice:synthesize', { text: it.text });
        const buf = await decode(bytes);
        const { from, dur } = trimSilence(buf);
        const level = speechRms(buf, from, from + dur);
        const gain = voiceLevel && level ? Math.min(3, Math.max(0.25, voiceLevel / level)) : 0.8;
        chunks.push({ buf, from, dur, gain });
      } else if (it.type === 'gap') {
        chunks.push({ gap: it.ms / 1000 });
      }
    }
    while (chunks.length && chunks[chunks.length - 1].gap) chunks.pop();
    if (!chunks.length) throw new Error('Nothing left to send');

    const total = chunks.reduce((a, c) => a + (c.gap || c.dur), 0) + 0.15;
    const off = new OfflineAudioContext(1, Math.ceil(total * OUT_RATE), OUT_RATE);
    let t = 0.05;
    for (const c of chunks) {
      if (c.gap) { t += c.gap; continue; }
      const s = off.createBufferSource();
      s.buffer = c.buf;
      const g = off.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(c.gain, t + FADE);
      g.gain.setValueAtTime(c.gain, t + Math.max(FADE, c.dur - FADE));
      g.gain.linearRampToValueAtTime(0, t + c.dur);
      s.connect(g).connect(off.destination);
      s.start(t, c.from, c.dur);
      t += c.dur;
    }
    const out = await off.startRendering();
    return { wav: encodeWav(out), duration: out.duration, waveform: waveform(out) };
  }

  window.Exporter = { renderMessage, toArrayBuffer };
})();
