// The tone characters: one per tone, drawn on a 96×96 grid. Their props react
// to --a (0 = off, 1 = strongest) set on a parent: the hero's cape billows,
// the calm one floats higher, the cozy one's mug steams. Colours come from the
// k-<tone> class on the parent (see styles.css).
const CHARACTERS = (() => {
  // a four-point sparkle
  const star = (x, y, r) => {
    const k = r * 0.28;
    return `M${x} ${y - r}L${x + k} ${y - k}L${x + r} ${y}L${x + k} ${y + k}L${x} ${y + r}L${x - k} ${y + k}L${x - r} ${y}L${x - k} ${y - k}Z`;
  };
  const shadow = (rx = 19) => `<ellipse class="c-shadow" cx="48" cy="89" rx="${rx}" ry="3"/>`;
  const legs = (cls = 'c-1d') => `<path class="${cls}" d="M38 73h8v12a3 3 0 0 1-3 3h-2a3 3 0 0 1-3-3zM50 73h8v12a3 3 0 0 1-3 3h-2a3 3 0 0 1-3-3z"/>`;
  const torso = '<rect class="c-1" x="35" y="45" width="26" height="31" rx="11"/>';
  const head = (cy = 32) => `<circle class="c-face" cx="48" cy="${cy}" r="12"/>`;

  return {
    // a superhero: cape, mask, a bolt on the chest, hands on hips
    confident: `
      ${shadow()}
      <g class="c-rays"><path d="M48 5v7M24 12l4 6M72 12l-4 6M10 33l7 3M86 33l-7 3"/></g>
      <g class="c-fig">
        <g class="c-cape"><path class="c-flap c-2" d="M37 46h22l10 37q-21 6-42 0z"/></g>
        ${legs()}
        <path class="c-arm" d="M38 52l-7.5 8.5 6.5 6.5M58 52l7.5 8.5-6.5 6.5"/>
        ${torso}
        <rect class="c-3" x="36.5" y="67" width="23" height="3.5"/>
        <g class="c-badge"><circle class="c-3" cx="48" cy="57" r="7"/><path class="c-1d" d="M49.6 51.6 44.8 58h3.1l-1.5 5.4 4.9-6.5h-3.2z"/></g>
        ${head()}
        <path class="c-hair" d="M36 31.5a12 12 0 0 1 24-1.5c-3.5-3-8.5-3.8-12.5-2.2-3.6 1.4-7.6 1.6-11.5 3.7z"/>
        <rect class="c-2" x="37.5" y="29.5" width="21" height="6.5" rx="3.25"/>
        <circle class="c-eye" cx="43.5" cy="32.7" r="1.5"/><circle class="c-eye" cx="52.5" cy="32.7" r="1.5"/>
        <path class="c-line" d="M44 39.6q3.8 2.6 8.4-.9"/>
      </g>`,

    // meditating, eyes closed, floating higher as it gets calmer
    calm: `
      <g class="c-aura"><circle cx="48" cy="54" r="40"/><circle cx="48" cy="54" r="31"/></g>
      ${shadow(22)}
      <g class="c-fig">
        <path class="c-1d" d="M25 81q0-9 11-9.5h24q11 .5 11 9.5 0 6-6.5 6h-33Q25 87 25 81z"/>
        <path class="c-1" d="M36 76V57q0-12 12-12t12 12v19z"/>
        <path class="c-arm" d="M38.5 54q-6.5 9-5.5 21M57.5 54q6.5 9 5.5 21"/>
        <circle class="c-face" cx="33.2" cy="76" r="3.4"/><circle class="c-face" cx="62.8" cy="76" r="3.4"/>
        ${head(33)}
        <circle class="c-hair" cx="48" cy="19.6" r="4.8"/>
        <path class="c-hair" d="M36.2 31a11.9 11.9 0 0 1 23.6 0q-11.8-4.6-23.6 0z"/>
        <path class="c-line" d="M41 34.4q2.5 2.3 5 0M50 34.4q2.5 2.3 5 0"/>
        <path class="c-line" d="M45.6 39.6q2.4 1.5 4.8 0"/>
      </g>`,

    // beanie, scarf and a steaming mug
    warm: `
      ${shadow()}
      <g class="c-fig">
        ${legs('c-4')}
        ${torso}
        <path class="c-arm" d="M37.5 52q-4 12 7.5 13.5M58.5 52q4 12-2 13.5"/>
        <rect class="c-3" x="44.5" y="60" width="12.5" height="11.5" rx="2.6"/>
        <path class="c-mugh" d="M57 62.8h1.4a3.2 3.2 0 0 1 0 6.4H57"/>
        <rect class="c-2" x="37" y="42" width="22" height="6" rx="3"/>
        <rect class="c-2" x="39.5" y="45" width="5.5" height="13" rx="2.75"/>
        <g class="c-steam"><path d="M48 58q-2-2.5 0-5t0-5"/><path d="M53.5 58q-2-2.5 0-5t0-5"/></g>
        ${head()}
        <path class="c-2" d="M36 31a12 12 0 0 1 24 0z"/>
        <rect class="c-2d" x="35" y="28.5" width="26" height="5" rx="2.5"/>
        <circle class="c-3" cx="48" cy="17.6" r="3.6"/>
        <circle class="c-blush" cx="40.6" cy="39" r="2.4"/><circle class="c-blush" cx="55.4" cy="39" r="2.4"/>
        <path class="c-line" d="M41.6 36.2q2-2.2 4 0M50.4 36.2q2-2.2 4 0"/>
        <path class="c-line" d="M45 40.2q3 2.6 6 0"/>
      </g>`,

    // waving hello
    friendly: `
      ${shadow()}
      <g class="c-fig">
        ${legs()}
        <path class="c-arm" d="M37.5 52q-5 8-4.5 16"/><circle class="c-face" cx="33" cy="68.5" r="3.6"/>
        ${torso}
        <g class="c-wave"><path class="c-arm" d="M58.5 52q8-3 10-14.5"/><circle class="c-face" cx="69" cy="35.5" r="3.8"/></g>
        ${head()}
        <path class="c-hair" d="M35.8 33.5a12.2 12.2 0 0 1 24.4 0c-2.2-3.6-6-5.6-10.8-5.9-1.4 2.4-5.6 4.6-13.6 5.9z"/>
        <circle class="c-dot" cx="43.5" cy="33.5" r="1.6"/><circle class="c-dot" cx="52.5" cy="33.5" r="1.6"/>
        <path class="c-mouth" d="M43.5 38.2h9q-.9 5-4.5 5t-4.5-5z"/>
      </g>`,

    // arms up, sparkles everywhere
    excited: `
      ${shadow()}
      <g class="c-sparks"><path d="${star(18, 24, 6)}"/><path d="${star(78, 19, 4.5)}"/><path d="${star(82, 50, 5)}"/><path d="${star(13, 55, 3.6)}"/></g>
      <g class="c-fig">
        ${legs()}
        <path class="c-arm" d="M38 51q-7-5-9.5-15M58 51q7-5 9.5-15"/>
        <circle class="c-face" cx="28.5" cy="34.5" r="3.6"/><circle class="c-face" cx="67.5" cy="34.5" r="3.6"/>
        ${torso}
        ${head()}
        <path class="c-hair" d="M36 31a12 12 0 0 1 24 0q-3-2.6-6-1.4-3-3-6-1-3-2-6 1-3-1.2-6 1.4z"/>
        <circle class="c-dot" cx="43.5" cy="33" r="2.1"/><circle class="c-dot" cx="52.5" cy="33" r="2.1"/>
        <circle class="c-eye" cx="44.2" cy="32.3" r=".7"/><circle class="c-eye" cx="53.2" cy="32.3" r=".7"/>
        <path class="c-mouth" d="M43.5 37.8h9q-.6 6.4-4.5 6.4t-4.5-6.4z"/>
      </g>`,
  };
})();

// The full character, or just its head (for avatars in buttons and the bar).
function character(tone, head = false) {
  return `<svg class="char" viewBox="${head ? '28 12 40 40' : '0 0 96 96'}" aria-hidden="true">${CHARACTERS[tone] || ''}</svg>`;
}
