// Plays the original recording, or an edited "ReSpeak" version built from a
// playlist of original-audio ranges and generated segments.
// Generated segments use a system voice as a stand-in until the
// voice-clone backend exists.
(function () {
  class Player {
    constructor() {
      this.ctx = null;
      this.buffer = null;
      this.token = 0;
      this.src = null;
      this.playing = false;
    }

    async load(arrayBuffer) {
      this.ctx ||= new AudioContext();
      this.buffer = arrayBuffer ? await this.ctx.decodeAudioData(arrayBuffer.slice(0)) : null;
      return this.buffer;
    }

    peaks(n) {
      if (!this.buffer) return null;
      const data = this.buffer.getChannelData(0);
      const per = Math.floor(data.length / n) || 1;
      const out = new Array(n);
      let max = 0;
      for (let i = 0; i < n; i++) {
        let m = 0;
        for (let j = i * per; j < (i + 1) * per && j < data.length; j += 8) m = Math.max(m, Math.abs(data[j]));
        out[i] = m;
        max = Math.max(max, m);
      }
      return out.map(v => (max ? v / max : 0));
    }

    get duration() { return this.buffer?.duration ?? 0; }

    /** items: [{type:'audio', from, to} | {type:'tts', text}] */
    async play(items, { onItem, onTime, onEnd, voiceName } = {}) {
      this.stop();
      const token = ++this.token;
      this.playing = true;
      if (this.ctx?.state === 'suspended') await this.ctx.resume();
      for (let i = 0; i < items.length; i++) {
        if (token !== this.token) return;
        onItem?.(i, items[i]);
        const it = items[i];
        if (it.type === 'audio' && this.buffer) await this._range(it.from, it.to, token, onTime);
        else if (it.type === 'tts') await this._speak(it.text, voiceName);
        else if (it.type === 'gap') await new Promise(r => setTimeout(r, it.ms));
      }
      if (token === this.token) { this.playing = false; onEnd?.(); }
    }

    _range(from, to, token, onTime) {
      return new Promise((resolve) => {
        const src = this.ctx.createBufferSource();
        src.buffer = this.buffer;
        // short fades so cuts don't click
        const g = this.ctx.createGain();
        const now = this.ctx.currentTime;
        const dur = Math.max(0.02, to - from);
        g.gain.setValueAtTime(0, now);
        g.gain.linearRampToValueAtTime(1, now + 0.015);
        g.gain.setValueAtTime(1, now + Math.max(0.016, dur - 0.02));
        g.gain.linearRampToValueAtTime(0, now + dur);
        src.connect(g).connect(this.ctx.destination);
        src.start(now, Math.max(0, from), dur);
        this.src = src;
        let raf = 0;
        const tick = () => {
          if (token !== this.token) return;
          onTime?.(from + (this.ctx.currentTime - now));
          raf = requestAnimationFrame(tick);
        };
        tick();
        src.onended = () => { cancelAnimationFrame(raf); resolve(); };
      });
    }

    _speak(text, voiceName) {
      return new Promise((resolve) => {
        const u = new SpeechSynthesisUtterance(text);
        const voices = speechSynthesis.getVoices();
        u.voice = voices.find(v => v.name === voiceName) || voices.find(v => /en[-_]/i.test(v.lang)) || null;
        u.rate = 1.04;
        u.onend = u.onerror = () => resolve();
        speechSynthesis.speak(u);
      });
    }

    stop() {
      this.token++;
      this.playing = false;
      try { this.src?.stop(); } catch {}
      speechSynthesis.cancel();
    }
  }

  window.Player = Player;
})();
