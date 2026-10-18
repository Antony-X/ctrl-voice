// Client for the ReSpeak engine (FastAPI on the GPU server).
// HTTP runs here in the main process: the engine sends no CORS headers, and
// the renderer pages stay sandboxed. Live recording uses the engine's
// WebSocket directly from the overlay.
class EngineError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

class Engine {
  // getCode: the access code the engine asks for (empty when it has none).
  constructor(getBase, getCode = () => '') {
    this.getBase = getBase;
    this.getCode = getCode;
  }

  url(p) {
    if (/^https?:/.test(p)) return p;
    return `${String(this.getBase() || '').replace(/\/+$/, '')}${p}`;
  }

  async request(p, { method = 'POST', json, form, timeout = 60000, raw = false } = {}) {
    const opts = { method, signal: AbortSignal.timeout(timeout), headers: { 'x-access-code': this.getCode() || '' } };
    if (json !== undefined) { opts.body = JSON.stringify(json); opts.headers['content-type'] = 'application/json'; }
    if (form) opts.body = form;
    let res;
    try {
      res = await fetch(this.url(p), opts);
    } catch (err) {
      const timedOut = err.name === 'TimeoutError' || err.name === 'AbortError';
      throw new EngineError(timedOut ? 'The engine took too long to answer' : "Can't reach the engine", 0);
    }
    if (!res.ok) {
      // The engine always answers errors in JSON; anything else is the RunPod
      // proxy saying the pod (or the engine on it) isn't running.
      let body = null;
      try { body = await res.json(); } catch {}
      const detail = res.status === 401 ? 'Wrong access code. Enter it in Settings' : typeof body?.detail === 'string' ? body.detail : '';
      throw new EngineError(detail || (body ? `Engine error ${res.status}` : "The engine isn't running"), res.status);
    }
    return raw ? Buffer.from(await res.arrayBuffer()) : res.json();
  }

  // The engine answers "/" with a redirect to its own web page. A stopped
  // RunPod pod answers with the proxy's error page instead.
  async health() {
    const t = Date.now();
    try {
      const res = await fetch(this.url('/'), { redirect: 'manual', signal: AbortSignal.timeout(8000) });
      const ok = res.status >= 300 && res.status < 400 && /static/.test(res.headers.get('location') || '');
      if (!ok) return { ok, ms: Date.now() - t, message: `The server answered ${res.status}. Is the engine running?` };
      const auth = await this.auth(this.getCode());
      return { ok: auth.ok, locked: auth.locked, ms: Date.now() - t, message: auth.ok ? 'Connected' : auth.message };
    } catch {
      return { ok: false, ms: Date.now() - t, message: "Can't reach the engine" };
    }
  }

  // Whether the engine accepts this access code. An engine from before access codes has no /api/auth (404) and needs none.
  async auth(code) {
    try {
      const res = await fetch(this.url('/api/auth'), { headers: { 'x-access-code': code || '' }, signal: AbortSignal.timeout(8000) });
      if (res.status === 401) return { ok: false, locked: true, message: code ? 'That access code is wrong' : 'The engine needs an access code' };
      return { ok: true, locked: false };
    } catch {
      return { ok: false, locked: false, message: "Can't reach the engine" };
    }
  }

  upload(audio, filename = 'message.wav') {
    const form = new FormData();
    form.append('f', new Blob([audio]), filename);
    return this.request('/api/upload', { form, timeout: 90000 });
  }

  state(sid) { return this.request(`/api/s/${sid}/state`, { method: 'GET' }); }
  clean(sid) { return this.request(`/api/s/${sid}/clean`); }
  tighten(sid) { return this.request(`/api/s/${sid}/tighten`); }
  grammar(sid) { return this.request(`/api/s/${sid}/grammar`); }
  pron(sid) { return this.request(`/api/s/${sid}/pron`); }
  intent(sid) { return this.request(`/api/s/${sid}/intent`, { timeout: 90000 }); }
  // {i, j, new} replaces words i..j; {i, j, same: true} re-says them clearly.
  replace(sid, body) { return this.request(`/api/s/${sid}/replace`, { json: body, timeout: 120000 }); }
  render(sid, ops) { return this.request(`/api/s/${sid}/render`, { json: { ops } }); }
  // Pitch and timing only, the speaker's own voice: confident | calm | warm.
  natural(sid, body) { return this.request(`/api/s/${sid}/natural`, { json: body, timeout: 90000 }); }
  // AI restyle (changes the voice somewhat): confident | calm | friendly | excited.
  tone(sid, body) { return this.request(`/api/s/${sid}/tone`, { json: body, timeout: 180000 }); }
  accent(sid, body) { return this.request(`/api/s/${sid}/accent`, { json: body, timeout: 180000 }); }
  download(p) { return this.request(p, { method: 'GET', raw: true }); }
}

module.exports = { Engine, EngineError };
