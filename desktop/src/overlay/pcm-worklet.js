// AudioWorklet processor for LiveSession: forwards every 128-sample mono input
// frame to the main thread as a Float32Array.
//
// When nothing is connected (e.g. test audio finished) it sends silence, so the
// session keeps counting time like a real mic would.
// On a 'stop' message it replies 'stopped' and goes quiet. Port messages are
// ordered, so every frame captured before the stop arrives before that reply.

class PcmTap extends AudioWorkletProcessor {
  constructor() {
    super();
    this.running = true;
    this.port.onmessage = (e) => {
      if (e.data !== 'stop') return;
      this.running = false;
      this.port.postMessage('stopped');
    };
  }

  process(inputs, outputs) {
    if (!this.running) return false;
    const input = inputs[0] && inputs[0][0];
    const frame = input ? input.slice(0) : new Float32Array((outputs[0] && outputs[0][0]?.length) || 128);
    this.port.postMessage(frame, [frame.buffer]);
    return true; // outputs stay silent
  }
}

registerProcessor('pcm-tap', PcmTap);
