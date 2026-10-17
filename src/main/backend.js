// Voice backend adapter — the one place the app asks for generated speech.
//
// Today: a local stand-in (Windows SAPI via the helper), so exported messages
// are complete and playable. Later: replace synthesize() with a call to the
// Ctrl+Voice backend (voice clone / speech editing) that returns WAV/OGG bytes
// in the user's own voice. Nothing else in the app needs to change.
const fs = require('fs');
const os = require('os');
const path = require('path');

function createBackend({ helper }) {
  let seq = 0;
  return {
    name: 'local-standin',

    /** @returns {Promise<Buffer>} WAV bytes for `text`. */
    async synthesize(text, { voice } = {}) {
      const file = path.join(os.tmpdir(), `ctrlvoice-tts-${process.pid}-${++seq}.wav`);
      try {
        await helper.request('speak', { text, file, voice: voice || '' }, 30000);
        return fs.readFileSync(file);
      } finally {
        fs.rm(file, { force: true }, () => {});
      }
    },
  };
}

module.exports = { createBackend };
