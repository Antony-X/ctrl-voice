// LiveSession: records the microphone and streams it to the ReSpeak backend,
// which sends back a live transcript with semantic undo ("scratch that").
//
// Audio path: mic (or test audio) -> AudioContext at 24 kHz -> AudioWorklet
// (pcm-worklet.js) -> 128-sample Float32 frames on this thread. Every frame is
// kept locally as Int16 PCM (for the WAV, and to send anything captured before
// the socket opened) and is sent to the server in ~100 ms chunks.
//
// The socket never blocks recording: if it can't connect, or drops, the session
// goes 'offline' and keeps recording locally. stop() always returns a WAV.
//
//   const s = new LiveSession({ server, micId, testAudio });
//   s.on('words',  ({ words, removed, dur }) => …)  live transcript state
//   s.on('undone', ({ r, ms }) => …)                r is null if nothing to undo
//   s.on('status', ({ state, message }) => …)       'connecting' | 'live' | 'offline' | 'error'
//   s.on('end', () => …)                            test audio finished playing
//   await s.start(); s.undo(); s.redo(); s.elapsed; s.levels(n); s.speaking
//   const { sid, words, removed, dur, wav } = await s.stop();   // sid is null when offline
//   s.cancel();
//
// Everything sits inside an IIFE: the overlay's scripts share one global scope,
// so only window.LiveSession is exported.
(() => {
  const SR = 24000;
  const CHUNK_SAMPLES = 2400; // ~100 ms per WebSocket frame
  const LEVEL_SAMPLES = 1200; // one level value per ~50 ms
  const LEVEL_KEEP = 1200; // ~60 s of level history
  const CONNECT_TIMEOUT_MS = 4000;
  const FINAL_TIMEOUT_MS = 30000;
  const FIRST_FRAME_TIMEOUT_MS = 3000;

  // Level meter: dB above an adaptive noise floor, mapped to 0..1.
  const FLOOR_MIN_DB = -62; // anything quieter counts as silence
  const FLOOR_WINDOW = 60; // the floor follows the quietest level of the last ~3 s
  const LEVEL_OFFSET_DB = 6; // dB above the floor where the meter starts
  const LEVEL_CEIL_DB = -12; // loud speech (dBFS) reads as full scale…
  const LEVEL_MIN_SPAN_DB = 20; // …but keep at least this much range above the start
  const VAD_ON = 0.15; // level that counts as speech (~10 dB above the floor)
  const VAD_HANGOVER = 6; // keep "speaking" for ~300 ms after the level drops

  // The worklet sits next to this file; resolve it now, while currentScript is set.
  const WORKLET_URL = new URL('pcm-worklet.js', document.currentScript?.src || document.baseURI).href;

  class Emitter {
    constructor() { this._handlers = {}; }
    on(ev, fn) {
      (this._handlers[ev] ||= []).push(fn);
      return () => this.off(ev, fn);
    }
    off(ev, fn) { this._handlers[ev] = (this._handlers[ev] || []).filter(h => h !== fn); }
    emit(ev, data) {
      for (const fn of this._handlers[ev] || []) {
        try { fn(data); } catch (err) { console.error(`LiveSession "${ev}" handler failed`, err); }
      }
    }
  }

  class LiveSession extends Emitter {
    constructor({ server, micId = 'default', testAudio = null } = {}) {
      super();
      this.server = server;
      this.micId = micId;
      this.testAudio = testAudio;
      this.sid = makeSid();
      this.status = { state: 'idle', message: '' };
      this.live = false; // socket open and usable
      // latest server state
      this.words = [];
      this.removed = [];
      this.dur = 0;

      this._chunks = []; // Int16Array chunks, everything captured so far
      this._sent = 0; // how many of them went to the server
      this._cur = new Int16Array(CHUNK_SAMPLES);
      this._fill = 0;
      this._samples = 0;

      this._levels = [];
      this._sq = 0;
      this._lvlN = 0;
      this._recentDb = [];
      this._floorDb = null;
      this._hang = 0;

      this._timers = new Set();
      this._resolveOpened = () => {};
      this._opened = new Promise(res => { this._resolveOpened = res; });
    }

    /** Seconds of audio captured so far. */
    get elapsed() { return this._samples / SR; }

    /** True while the level is above the noise floor (with a short hangover). */
    get speaking() { return this._capturing === true && this._hang > 0; }

    /** The last n level values (0..1, one per ~50 ms), oldest first, zero-padded. */
    levels(n = 36) {
      const out = this._levels.slice(-n);
      while (out.length < n) out.unshift(0);
      return out;
    }

    async start() {
      if (this._started) throw new Error('LiveSession already started');
      this._started = true;
      this._openSocket(); // in parallel with the mic; frames are buffered until it opens
      try {
        await this._openAudio();
      } catch (err) {
        this._teardownAudio();
        if (this._aborted()) return; // stop()/cancel() came in while starting; they do the rest
        this._closeSocket();
        this._clearTimers();
        this._setStatus('error', `Couldn't start recording: ${err.message || err}`);
        throw err;
      }
    }

    /** Semantic undo of the last thought. Returns false (no-op) when offline. */
    undo() {
      if (!this._canSend()) return false;
      // send the partial chunk too, so the cut ends exactly where undo was pressed
      if (this._fill) this._pushChunk(this._cur.slice(0, this._fill));
      this.ws.send(JSON.stringify({ type: 'undo' }));
      return true;
    }

    /** Restores the last removed range. Returns false (no-op) when offline. */
    redo() {
      if (!this._canSend()) return false;
      this.ws.send(JSON.stringify({ type: 'redo' }));
      return true;
    }

    stop() {
      this._stopping ||= this._stop();
      return this._stopping;
    }

    /** Stops everything and discards the recording; the server never gets 'stop'. */
    cancel() {
      this._cancelled = true;
      this._teardownAudio();
      this._closeSocket();
      this._clearTimers();
      this._resolveOpened(false);
      this._resolveFinal?.(null);
      this._chunks = [];
      this._cur = new Int16Array(CHUNK_SAMPLES);
      this._fill = 0;
    }

    // ---------- audio ----------
    async _openAudio() {
      const ctx = this._ctx = new AudioContext({ sampleRate: SR });
      let source;
      if (this.testAudio) {
        // tests: play a file through the graph in real time instead of the mic (not audible)
        const a = this.testAudio; // decodeAudioData detaches its input, so decode a copy
        const bytes = ArrayBuffer.isView(a) ? a.buffer.slice(a.byteOffset, a.byteOffset + a.byteLength) : a.slice(0);
        const buffer = await ctx.decodeAudioData(bytes);
        this._checkNotAborted();
        source = this._testSource = ctx.createBufferSource();
        source.buffer = buffer;
        source.onended = () => this.emit('end');
      } else {
        this._stream = await this._getMic();
        this._checkNotAborted();
        source = ctx.createMediaStreamSource(this._stream);
      }
      this._source = source;

      await ctx.audioWorklet.addModule(WORKLET_URL);
      this._checkNotAborted();
      const node = this._node = new AudioWorkletNode(ctx, 'pcm-tap', {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        channelCount: 1, // stereo input is downmixed
        channelCountMode: 'explicit',
        channelInterpretation: 'speakers',
      });
      const firstFrame = new Promise(res => { this._onFirstFrame = res; });
      node.port.onmessage = (e) => this._onWorkletMessage(e.data);
      source.connect(node);
      node.connect(ctx.destination); // the node outputs silence; this just keeps it pulled
      this._capturing = true;
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      if (this._testSource) this._testSource.start();

      const ok = await Promise.race([firstFrame, this._sleep(FIRST_FRAME_TIMEOUT_MS).then(() => false)]);
      if (!ok) throw new Error(`audio engine did not start (${ctx.state})`);
    }

    async _getMic() {
      const audio = { echoCancellation: true, noiseSuppression: true, channelCount: 1 };
      if (this.micId && this.micId !== 'default') {
        try {
          return await navigator.mediaDevices.getUserMedia({ audio: { ...audio, deviceId: { exact: this.micId } } });
        } catch (err) {
          // a saved mic that was unplugged: fall back to the default one
          if (err.name !== 'OverconstrainedError' && err.name !== 'NotFoundError') throw err;
          console.warn('Selected mic unavailable, using the default mic', err);
        }
      }
      return navigator.mediaDevices.getUserMedia({ audio });
    }

    _onWorkletMessage(data) {
      if (data === 'stopped') { this._onStopped?.(); return; }
      if (!this._capturing) return;
      this._onFirstFrame?.(true);
      this._onFirstFrame = null;
      this._onFrame(data);
    }

    _onFrame(frame) {
      for (let i = 0; i < frame.length; i++) {
        let v = frame[i] || 0;
        v = v > 1 ? 1 : v < -1 ? -1 : v;
        const s = v * 0x8000; // same scale as the server (int16 / 32768), so round trips are exact
        this._cur[this._fill++] = s > 0x7fff ? 0x7fff : s;
        if (this._fill === CHUNK_SAMPLES) this._pushChunk(this._cur);
        this._sq += v * v;
        if (++this._lvlN === LEVEL_SAMPLES) this._pushLevel();
      }
      this._samples += frame.length;
    }

    _pushChunk(chunk) {
      this._chunks.push(chunk);
      this._cur = new Int16Array(CHUNK_SAMPLES);
      this._fill = 0;
      this._flush();
    }

    _pushLevel() {
      const db = 10 * Math.log10(this._sq / this._lvlN + 1e-12);
      this._sq = 0;
      this._lvlN = 0;

      // noise floor: drops at once to the quietest recent window, rises slowly
      this._recentDb.push(db);
      if (this._recentDb.length > FLOOR_WINDOW) this._recentDb.shift();
      const low = Math.max(FLOOR_MIN_DB, Math.min(...this._recentDb));
      this._floorDb = this._floorDb === null || low < this._floorDb ? low : this._floorDb + (low - this._floorDb) * 0.03;

      const start = this._floorDb + LEVEL_OFFSET_DB;
      const span = Math.max(LEVEL_MIN_SPAN_DB, LEVEL_CEIL_DB - start);
      const level = Math.min(1, Math.max(0, (db - start) / span));
      this._levels.push(level);
      if (this._levels.length > LEVEL_KEEP * 2) this._levels.splice(0, LEVEL_KEEP);
      this._hang = level > VAD_ON ? VAD_HANGOVER : Math.max(0, this._hang - 1);
    }

    // Ask the worklet to stop and wait for its last frames, then release the graph.
    async _stopCapture() {
      if (this._node) {
        await new Promise((res) => {
          this._onStopped = res;
          this._node.port.postMessage('stop');
          this._sleep(250).then(res); // a stalled audio thread must not hang stop()
        });
      }
      this._teardownAudio();
      if (this._fill) this._pushChunk(this._cur.slice(0, this._fill));
    }

    _teardownAudio() {
      this._capturing = false;
      // release anyone still waiting on the audio thread (start() or stop())
      this._onFirstFrame?.(false);
      this._onStopped?.();
      this._hang = 0;
      if (this._node) {
        this._node.port.onmessage = null;
        this._node.disconnect();
      }
      if (this._testSource) {
        this._testSource.onended = null;
        try { this._testSource.stop(); } catch {}
      }
      this._source?.disconnect();
      this._stream?.getTracks().forEach(t => t.stop());
      this._ctx?.close().catch(() => {});
      this._node = this._source = this._testSource = this._stream = this._ctx = null;
      this._onStopped = this._onFirstFrame = null;
    }

    // ---------- socket ----------
    _openSocket() {
      this._setStatus('connecting', 'Connecting…');
      let ws;
      try {
        const url = new URL(this.server);
        url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
        url.pathname = `${url.pathname.replace(/\/+$/, '')}/ws/${this.sid}`;
        url.search = url.hash = '';
        ws = new WebSocket(url.href);
      } catch (err) {
        this._goOffline(`Can't connect (${err.message}). Recording locally`);
        return;
      }
      ws.binaryType = 'arraybuffer';
      this.ws = ws;
      this._connectTimer = this._later(CONNECT_TIMEOUT_MS, () => this._goOffline("Couldn't reach the server. Recording locally"));
      ws.onopen = () => {
        this._clearTimer(this._connectTimer);
        this.live = true;
        this._setStatus('live', 'Live transcript on');
        this._flush(); // everything captured while connecting
        this._resolveOpened(true);
      };
      ws.onmessage = (e) => this._onMessage(e.data);
      ws.onclose = () => this._goOffline(this.live ? 'Connection lost. Recording locally' : "Couldn't reach the server. Recording locally");
    }

    _onMessage(data) {
      let m;
      try { m = JSON.parse(data); } catch { return; }
      if (m.type === 'words' || m.type === 'final') {
        this.words = m.words || [];
        this.removed = m.removed || [];
        this.dur = m.dur || 0;
        if (m.type === 'final') this._resolveFinal?.(m);
        else this.emit('words', { words: this.words, removed: this.removed, dur: this.dur });
      } else if (m.type === 'undone') {
        this.emit('undone', { r: m.r || null, ms: m.ms ?? null });
      }
    }

    _flush() {
      if (!this.live || this.ws?.readyState !== WebSocket.OPEN) return;
      while (this._sent < this._chunks.length) this.ws.send(this._chunks[this._sent++]);
    }

    _canSend() {
      return this.live && !this._stopping && !this._cancelled && this.ws?.readyState === WebSocket.OPEN;
    }

    _goOffline(message) {
      if (this._offline || this._cancelled) return;
      this._offline = true;
      this.live = false;
      this._clearTimer(this._connectTimer);
      this._closeSocket();
      this._resolveOpened(false);
      this._resolveFinal?.(null);
      this._setStatus('offline', message);
    }

    _closeSocket() {
      const ws = this.ws;
      this.ws = null;
      this.live = false;
      if (!ws) return;
      ws.onopen = ws.onmessage = ws.onclose = ws.onerror = null;
      if (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN) ws.close(1000);
    }

    // ---------- stop ----------
    async _stop() {
      await this._stopCapture();
      if (this._cancelled) return this._result(null);

      let final = null;
      if (this.ws && !this._offline) {
        if (!this.live) await this._opened; // still connecting: wait out the connect timeout
        if (this.live) {
          this._flush();
          this.ws.send(JSON.stringify({ type: 'stop' }));
          final = await new Promise((res) => {
            this._resolveFinal = res;
            this._finalTimer = this._later(FINAL_TIMEOUT_MS, () => res(null));
          });
          this._resolveFinal = null;
          this._clearTimer(this._finalTimer);
          if (!final) this._goOffline("The server didn't finish in time. Saved locally");
        }
      }
      this._closeSocket();
      this._clearTimers();
      return this._result(final);
    }

    _result(final) {
      const wav = buildWav(this._chunks, SR);
      if (final) return { sid: this.sid, words: final.words || [], removed: final.removed || [], dur: final.dur, wav };
      // offline: whatever live transcript arrived before the connection was lost
      return { sid: null, words: this.words, removed: this.removed, dur: this.elapsed, wav };
    }

    // ---------- helpers ----------
    _aborted() { return this._cancelled === true || this._stopping !== undefined; }
    _checkNotAborted() { if (this._aborted()) throw new Error('stopped while starting'); }

    _setStatus(state, message = '') {
      if (this.status.state === state && this.status.message === message) return;
      this.status = { state, message };
      this.emit('status', this.status);
    }

    _later(ms, fn) {
      const id = setTimeout(() => { this._timers.delete(id); fn(); }, ms);
      this._timers.add(id);
      return id;
    }
    _sleep(ms) { return new Promise(res => this._later(ms, res)); }
    _clearTimer(id) { clearTimeout(id); this._timers.delete(id); }
    _clearTimers() {
      this._timers.forEach(clearTimeout);
      this._timers.clear();
    }
  }

  // 8 random [a-z0-9] characters, like the reference client
  function makeSid() {
    const abc = 'abcdefghijklmnopqrstuvwxyz0123456789';
    return Array.from(crypto.getRandomValues(new Uint8Array(8)), b => abc[b % abc.length]).join('');
  }

  // 16-bit mono PCM WAV from Int16Array chunks.
  function buildWav(chunks, sampleRate) {
    const samples = chunks.reduce((n, c) => n + c.length, 0);
    const buf = new ArrayBuffer(44 + samples * 2);
    const v = new DataView(buf);
    const tag = (at, s) => { for (let i = 0; i < 4; i++) v.setUint8(at + i, s.charCodeAt(i)); };
    tag(0, 'RIFF'); v.setUint32(4, 36 + samples * 2, true); tag(8, 'WAVE');
    tag(12, 'fmt '); v.setUint32(16, 16, true);
    v.setUint16(20, 1, true); // PCM
    v.setUint16(22, 1, true); // mono
    v.setUint32(24, sampleRate, true);
    v.setUint32(28, sampleRate * 2, true); // byte rate
    v.setUint16(32, 2, true); // block align
    v.setUint16(34, 16, true); // bits per sample
    tag(36, 'data'); v.setUint32(40, samples * 2, true);
    const pcm = new Int16Array(buf, 44, samples);
    let k = 0;
    for (const c of chunks) { pcm.set(c, k); k += c.length; }
    return buf;
  }

  window.LiveSession = LiveSession;
})();
