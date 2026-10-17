// Mock "AI" layer. Everything here is rule-based so the frontend can be
// demoed without a backend. Swap these functions for real LLM / speech-editing
// calls later — the editor only depends on the shapes they return.
//
// Edit shape:        { segId, start, end, text }   (word indices, end inclusive; text null = delete)
// Suggestion shape:  { id, kind, title, detail, edits[], group? }

(function () {
  const norm = (w) => w.toLowerCase().replace(/[^a-z0-9']/g, '');
  const WEEKDAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const FILLERS = new Set(['um', 'uh', 'umm', 'uhh', 'er', 'erm', 'basically', 'like', 'literally']);
  const LIKE_OK_BEFORE = new Set(['i', 'you', 'we', 'they', "i'd", "you'd", "we'd", 'would', 'looks', 'look', 'feel', 'feels', 'seems', 'just']);
  const CORRECTION_CUES = ['wait thats wrong', 'scratch that', 'no wait', 'sorry i mean', 'let me rephrase', 'actually no', 'thats not right'];

  function segText(seg) { return seg.words.map(w => w.w).join(' '); }

  function suggest(msg) {
    const out = [];
    const segs = msg.segments.filter(s => !s.undone && s.words.length);

    // 1. Filler words — one grouped suggestion for the whole message
    const fillerEdits = [];
    segs.forEach((seg) => {
      seg.words.forEach((w, i) => {
        const n = norm(w.w);
        if (!FILLERS.has(n)) return;
        if (n === 'like' && i > 0 && LIKE_OK_BEFORE.has(norm(seg.words[i - 1].w))) return;
        if (/[.?!]$/.test(w.w)) return; // removing would drop sentence punctuation
        fillerEdits.push({ segId: seg.id, start: i, end: i, text: null, word: n });
      });
    });
    if (fillerEdits.length) {
      out.push({
        id: 'filler:all',
        kind: 'filler',
        title: `Remove ${fillerEdits.length} filler word${fillerEdits.length > 1 ? 's' : ''}`,
        detail: [...new Set(fillerEdits.map(e => `“${e.word}”`))].join(' · ') + ' — cut cleanly, timing preserved',
        edits: fillerEdits.map(({ word, ...e }) => e),
      });
    }

    // 2. Grammar
    segs.forEach((seg) => {
      const n = seg.words.map(w => norm(w.w));
      for (let i = 0; i < n.length - 2; i++) {
        if (n[i] === 'me' && n[i + 1] === 'and' && /^[A-Z]/.test(seg.words[i + 2].w)) {
          const name = seg.words[i + 2].w.replace(/[^A-Za-z'-]/g, '');
          const verbs = { has: 'have', is: 'are', was: 'were', have: 'have', are: 'are', were: 'were' };
          const v = verbs[n[i + 3]];
          const end = v ? i + 3 : i + 2;
          const text = `${name} and I${v ? ' ' + v : ''}`;
          out.push({
            id: `grammar:${seg.id}:${i}`,
            kind: 'grammar',
            title: `“${seg.words.slice(i, end + 1).map(w => w.w).join(' ')}” → “${text}”`,
            detail: v ? 'Subject pronoun and verb agreement' : 'Subject pronoun',
            edits: [{ segId: seg.id, start: i, end, text }],
          });
        }
        if ((n[i] === 'could' || n[i] === 'should' || n[i] === 'would') && n[i + 1] === 'of') {
          out.push({
            id: `grammar:${seg.id}:${i}`,
            kind: 'grammar',
            title: `“${n[i]} of” → “${n[i]} have”`,
            detail: 'Common spoken grammar slip',
            edits: [{ segId: seg.id, start: i, end: i + 1, text: `${seg.words[i].w} have` }],
          });
        }
      }
    });

    // 3. Self-corrections the speaker didn't undo, with an in-place alternative
    segs.forEach((seg, si) => {
      const flat = seg.words.map(w => norm(w.w)).join(' ');
      if (!CORRECTION_CUES.some(c => flat.includes(c))) return;
      const next = segs[si + 1];
      const group = `alt:${seg.id}`;
      out.push({
        id: `correction:${seg.id}`,
        kind: 'correction',
        group,
        title: 'Drop the self-correction',
        detail: `“${segText(seg)}” — you corrected yourself right after`,
        edits: [{ segId: seg.id, start: 0, end: seg.words.length - 1, text: null }],
      });

      if (!next) return;
      const a = seg.words.findIndex(w => WEEKDAYS.includes(norm(w.w)));
      const b = next.words.findIndex(w => WEEKDAYS.includes(norm(w.w)));
      if (a < 0 || b < 0 || norm(seg.words[a].w) === norm(next.words[b].w)) return;
      const replacement = next.words.slice(b).map(w => w.w).join(' ');
      const before = seg.words[a].w.replace(/[^A-Za-z]/g, '');
      const after = next.words[b].w.replace(/[^A-Za-z]/g, '');
      out.push({
        id: `replace:${seg.id}`,
        kind: 'replace',
        group,
        title: `Fix in place: “${before}” → “${after}”`,
        detail: `Regenerates “${replacement}” in your voice and removes the repeated sentence`,
        edits: [
          { segId: seg.id, start: a, end: seg.words.length - 1, text: replacement },
          { segId: next.id, start: 0, end: next.words.length - 1, text: null },
        ],
      });
    });

    return out;
  }

  // Guess what the user might want when they select words to replace.
  function guessReplacement(words) {
    const text = words.join(' ');
    const n = words.map(norm);
    const day = n.findIndex(w => WEEKDAYS.includes(w));
    if (day >= 0) {
      const next = WEEKDAYS[(WEEKDAYS.indexOf(n[day]) + 2) % 7];
      const copy = [...words];
      copy[day] = words[day].replace(/[A-Za-z]+/, next[0].toUpperCase() + next.slice(1));
      return copy.join(' ');
    }
    if (n.includes('tonight')) return text.replace(/tonight/i, 'by tomorrow morning');
    if (n.includes('five')) return text.replace(/five/i, 'six thirty');
    if (n.includes('soon')) return text.replace(/soon/i, 'tomorrow');
    return text;
  }

  // ---------- tone ----------
  const TONES = {
    original: { label: 'Original', emoji: '○', rules: [] },
    confident: {
      label: 'Confident', emoji: '◆',
      rules: [
        [/\b(just|basically|kind of|sort of|I think|maybe|like|um|uh),?\s/gi, ''],
        [/^So,?\s+/i, ''],
        [/\b[Cc]an you\b/g, 'please'],
        [/(\b[Pp]lease[^?]*)\?/g, '$1.'],
        [/\bwe're ready\b/gi, "we're ready to go"],
      ],
    },
    friendly: {
      label: 'Friendly', emoji: '☺',
      rules: [
        [/\b(um|uh),?\s/gi, ''],
        [/\bquick update\b/gi, 'fun little update'],
        [/^Hey (\w+),/i, 'Hey $1!'],
        [/\bThanks, talk soon\./i, 'Thanks a ton, talk soon!'],
        [/\b[Cc]an you just\b/g, 'could you'],
        [/\bat five\./i, 'at five, can’t wait!'],
      ],
    },
    polite: {
      label: 'Polite', emoji: '❀',
      rules: [
        [/\b(um|uh|basically|like),?\s/gi, ''],
        [/^Hey\b/i, 'Hi'],
        [/\b[Cc]an you( just)?\b/g, 'could you please'],
        [/\bThanks,/g, 'Thank you so much,'],
        [/\bI'll meet you\b/g, "I'd love to meet you"],
      ],
    },
    calm: {
      label: 'Calm', emoji: '≈',
      rules: [
        [/\b(um|uh|basically|like|just),?\s/gi, ''],
        [/!/g, '.'],
        [/\b[Cc]an you send me\b/g, 'whenever you get a chance, could you send me'],
        [/\btonight\?/i, 'tonight? No rush.'],
        [/\bquick update\b/gi, 'small update'],
      ],
    },
    professional: {
      label: 'Professional', emoji: '▣',
      rules: [
        [/\b(um|uh|basically|like|just),?\s/gi, ''],
        [/^So,?\s+/i, ''],
        [/^Hey\b/i, 'Hi'],
        [/\bquick update\b/gi, 'a brief update'],
        [/\bI'll\b/g, 'I will'],
        [/\bwe're\b/g, 'we are'],
        [/\bthat's\b/g, 'that is'],
        [/\b[Cc]an you\b/g, 'could you please'],
        [/\bThanks, talk soon\./i, 'Thank you, speak soon.'],
        [/\bfinished the deck\b/i, 'completed the presentation'],
      ],
    },
  };

  function toneRewrite(text, tone) {
    const t = TONES[tone];
    if (!t) return text;
    let out = text;
    for (const [re, rep] of t.rules) out = out.replace(re, rep);
    out = out.replace(/\s{2,}/g, ' ').replace(/\s+([,.!?])/g, '$1').trim();
    out = out.replace(/([.!?]\s+)([a-z])/g, (_, p, c) => p + c.toUpperCase()); // re-capitalize sentences
    return out.charAt(0).toUpperCase() + out.slice(1);
  }

  window.MockAI = { suggest, guessReplacement, toneRewrite, TONES, norm };
})();
