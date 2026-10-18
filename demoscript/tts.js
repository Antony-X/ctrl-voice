// Usage: node tts.js <voice_id> <out.wav> <model> <stability> <text...>
// Reads the ElevenLabs key from file at runtime; never prints it.
const fs = require('fs');
const KEY = fs.readFileSync(String.raw`C:\Users\Antony\AppData\Local\Temp\claude\C--Users-Antony-Desktop-ctrl-voice\5985905e-4572-4f19-a6ec-0c1ce1de5723\scratchpad\deck\.elevenlabs_key`, 'utf8').trim();
const [voice, out, model, stab, ...rest] = process.argv.slice(2);
const text = rest.join(' ');
function wav(pcm, sr) {
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVE', 8); h.write('fmt ', 12);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(sr, 24);
  h.writeUInt32LE(sr * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}
(async () => {
  const t = Date.now();
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=pcm_24000`, {
    method: 'POST', headers: { 'xi-api-key': KEY, 'content-type': 'application/json' },
    body: JSON.stringify({ text, model_id: model, voice_settings: { stability: Number(stab), similarity_boost: 0.75 } }),
  });
  if (!res.ok) { console.log('ERR', res.status, (await res.text()).slice(0, 400)); process.exit(1); }
  const pcm = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(out, wav(pcm, 24000));
  console.log('OK', out, (pcm.length / 48000).toFixed(2) + 's', (Date.now() - t) + 'ms', text.length + ' chars');
})();
