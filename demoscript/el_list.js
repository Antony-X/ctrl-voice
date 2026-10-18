const fs = require('fs');
const KEY = fs.readFileSync(String.raw`C:\Users\Antony\AppData\Local\Temp\claude\C--Users-Antony-Desktop-ctrl-voice\5985905e-4572-4f19-a6ec-0c1ce1de5723\scratchpad\deck\.elevenlabs_key`, 'utf8').trim();
(async () => {
  const h = { 'xi-api-key': KEY };
  const m = await (await fetch('https://api.elevenlabs.io/v1/models', { headers: h })).json();
  console.log('MODELS', Array.isArray(m) ? m.map(x => x.model_id).join(', ') : JSON.stringify(m).slice(0, 300));
  const v = await (await fetch('https://api.elevenlabs.io/v1/voices', { headers: h })).json();
  for (const x of v.voices || []) console.log(x.voice_id, '|', x.name, '|', x.category, '|', JSON.stringify(x.labels));
  const u = await (await fetch('https://api.elevenlabs.io/v1/user/subscription', { headers: h })).json();
  console.log('chars used/limit', u.character_count, u.character_limit, u.tier);
})();
