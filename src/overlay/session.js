// RecordingSession — captures real microphone audio and splits it into
// "thoughts" (segments) that can be semantically undone while recording.
//
// Frontend-only prototype: there is no speech model yet.
//  - demoMode: words of a scripted demo message stream in while the mic hears
//    speech, so the transcript stays roughly in sync if you read the script.
//  - live mode: segments come from voice-activity detection (pauses), with no text.

const DEMO_SCRIPT = [
  'Hey Sam, quick update on the launch.',
  "So um, I'll meet you on Monday... wait, that's wrong.",
  "I'll meet you on Wednesday at five.",
  "Me and Priya has finished the deck, so we're basically like ready.",
  'Can you just send me the final numbers tonight?',
  'Thanks, talk soon.',
];

class RecordingSession {
  constructor({ demoMode = true, micId = 'default' } = {}) {
    this.demoMode = demoMode;
    this.micId = micId;
    this.segments = [];
    this.current = null;
    this.listeners = {};
    this.scriptIdx = 0;
    this.wordIdx = 0;
    this.speechAcc = 0;
    this.silence = 0;
    this.gap = 0;
    this.nextDelay = 0.3;
    this.noiseFloor = 0.01;
    this.chunks = [];
    this.noMic = false;
  }

  on(ev, fn) { (this.listeners[ev] ||= []).push(fn); }
  emit(ev, data) { (this.listeners[ev] || []).forEach(fn => fn(data)); }

  get elapsed() { return this.t0 ? (performance.now() - this.t0) / 1000 : 0; }

  async start() {
    const audio = { echoCancellation: true, noiseSuppression: true, autoGainControl: true };
    if (this.micId && this.micId !== 'default') audio.deviceId = { exact: this.micId };
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio });
    } catch (err) {
      console.warn('Mic unavailable, running silent demo', err);
      this.noMic = true;
    }
    this.ctx = new AudioContext();
    if (this.stream) {
      const src = this.ctx.createMediaStreamSource(this.stream);
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 512;
      this.analyser.smoothingTimeConstant = 0.6;
      src.connect(this.analyser);
      this.freq = new Uint8Array(this.analyser.frequencyBinCount);
      this.time = new Float32Array(this.analyser.fftSize);
      this.mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm';
      this.recorder = new MediaRecorder(this.stream, { mimeType: this.mime });
      this.recorder.ondataavailable = (e) => e.data.size && this.chunks.push(e.data);
      this.recorder.start(200);
    }
    this.t0 = performance.now();
    this.last = this.t0;
    this.timer = setInterval(() => this._tick(), 50);
  }

  rms() {
    if (!this.analyser) return this.noMic ? 0.05 + Math.random() * 0.05 : 0;
    this.analyser.getFloatTimeDomainData(this.time);
    let sum = 0;
    for (let i = 0; i < this.time.length; i++) sum += this.time[i] * this.time[i];
    return Math.sqrt(sum / this.time.length);
  }

  /** n bar heights 0..1 for the waveform */
  levels(n = 28) {
    const out = new Array(n).fill(0);
    if (!this.analyser) {
      const t = performance.now() / 180;
      return out.map((_, i) => (this.noMic ? 0.25 + 0.25 * Math.sin(t + i * 0.7) ** 2 : 0.04));
    }
    this.analyser.getByteFrequencyData(this.freq);
    const usable = Math.floor(this.freq.length * 0.55);
    const per = Math.max(1, Math.floor(usable / n));
    for (let i = 0; i < n; i++) {
      let s = 0;
      for (let j = 0; j < per; j++) s += this.freq[i * per + j];
      out[i] = Math.min(1, (s / per / 255) * 1.5);
    }
    // mirror so the loudest bands sit in the middle, like a voice memo bar
    const half = out.slice(0, Math.ceil(n / 2));
    return [...half.slice().reverse(), ...half].slice(0, n);
  }

  _speaking(level) {
    // adaptive noise floor: falls quickly, rises slowly
    this.noiseFloor = level < this.noiseFloor ? level : this.noiseFloor * 0.995 + level * 0.005;
    return this.noMic || level > Math.max(0.012, this.noiseFloor * 2.6);
  }

  _tick() {
    const now = performance.now();
    const dt = (now - this.last) / 1000;
    this.last = now;
    const speaking = this._speaking(this.rms());
    if (speaking) { this.silence = 0; this.speechAcc += dt; }
    else { this.silence += dt; if (this.silence > 0.3) this.speechAcc = Math.min(this.speechAcc, 0.1); }
    this.demoMode ? this._tickDemo(dt, speaking) : this._tickVad(speaking);
  }

  _tickDemo(dt, speaking) {
    if (this.scriptIdx >= DEMO_SCRIPT.length) return;
    if (this.gap > 0) { this.gap -= dt; return; }
    if (!speaking || this.speechAcc < this.nextDelay) return;
    this.speechAcc = 0;
    this.nextDelay = 0.24 + Math.random() * 0.16;
    const words = DEMO_SCRIPT[this.scriptIdx].split(' ');
    if (!this.current) this.current = this._newSegment(Math.max(0, this.elapsed - 0.35));
    this.current.words.push({ w: words[this.wordIdx], t: Math.max(0, this.elapsed - 0.3) });
    this.wordIdx++;
    if (this.wordIdx >= words.length) {
      this._closeCurrent(this.elapsed + 0.1);
      this.scriptIdx++;
      this.wordIdx = 0;
      this.gap = 0.55;
    }
    this.emit('change');
  }

  _tickVad(speaking) {
    if (speaking && !this.current && this.speechAcc > 0.15) {
      this.current = this._newSegment(Math.max(0, this.elapsed - 0.35));
      this.emit('change');
    } else if (this.current && this.silence > 0.8) {
      this._closeCurrent(this.elapsed - this.silence + 0.2);
      this.emit('change');
    }
  }

  _newSegment(start) {
    const seg = { id: `s${this.segments.length + 1}`, start, end: null, words: [], undone: false, complete: false };
    this.segments.push(seg);
    return seg;
  }

  _closeCurrent(end) {
    if (!this.current) return;
    this.current.end = end;
    this.current.complete = true;
    this.current = null;
  }

  /** Semantic undo: drop the most recent thought (even if still being spoken). */
  undo() {
    const seg = [...this.segments].reverse().find(s => !s.undone);
    if (!seg) return null;
    seg.undone = true;
    if (!seg.complete) {
      this._closeCurrent(this.elapsed);
      if (this.demoMode) { this.scriptIdx++; this.wordIdx = 0; this.gap = 0.5; }
    }
    this.emit('undo', seg);
    this.emit('change');
    return seg;
  }

  async stop() {
    clearInterval(this.timer);
    const duration = this.elapsed;
    this._closeCurrent(duration);
    if (this.recorder && this.recorder.state !== 'inactive') {
      await new Promise(res => { this.recorder.onstop = res; this.recorder.stop(); });
    }
    this._release();
    const blob = this.chunks.length ? new Blob(this.chunks, { type: this.mime }) : null;
    return {
      audio: blob ? await blob.arrayBuffer() : null,
      duration,
      segments: this.segments.filter(s => s.words.length || !this.demoMode),
    };
  }

  cancel() {
    clearInterval(this.timer);
    try { this.recorder?.state !== 'inactive' && this.recorder?.stop(); } catch {}
    this._release();
  }

  _release() {
    this.stream?.getTracks().forEach(t => t.stop());
    this.ctx?.close().catch(() => {});
  }
}

window.RecordingSession = RecordingSession;
window.DEMO_SCRIPT = DEMO_SCRIPT;
