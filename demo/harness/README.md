# Electron screenshot harness

Renders one renderer page (e.g. ctrl+voice's `src/app/index.html` or
`src/overlay/overlay.html`) in a never-shown window, with a stubbed preload
bridge, and writes PNG screenshots. It is its own Electron main script: no
single-instance lock, its own `userData` (`harness/harness-data`) and an
in-memory session, so it never collides with a running copy of the app or reads
or writes `%APPDATA%/Ctrl+Voice`. Nothing appears on screen.

## Run

```bash
E="/c/Users/Antony/Desktop/ctrl+voice/node_modules/electron/dist/electron.exe"
"$E" path/to/harness/main.js --plan path/to/plan.json
# or: /c/Users/Antony/Desktop/ctrl+voice/node_modules/.bin/electron path/to/harness/main.js --plan plan.json
```

Verification plans live in `verify/` (`app.json`, `overlay.json`, plus `ctrlvoice-stub.js`).

Output: `[harness]` progress lines (one per shot, with size and alpha stats, and a
WARNING if the capture is one flat colour), `[page]` console messages (all levels),
uncaught errors and promise rejections, `preload-error`, `render-process-gone`,
`did-fail-load`, and `[stub]` lines for bridge traffic.

Exit codes: `0` all shots written · `1` load failure, renderer crash, stub failed to
load, or other error · `2` overall timeout · `64` bad or missing plan.
If a shot's `js` throws, the harness prints `ERROR shot N js threw`, still takes
the shot and still exits 0. The real exception appears just above it as a `[page]` line.

## Plan format

Relative paths are resolved against the plan file's folder.

```jsonc
{
  "page": "C:/Users/Antony/Desktop/ctrl+voice/src/app/index.html", // file path or http(s)/file URL
  "width": 1180, "height": 780,          // content size in CSS px (default 1280x800)
  "transparent": false,                  // transparent window; captures keep alpha
  "backdrop": null,                      // see below; composited under every shot
  "stub": "C:/.../stub.js",              // CommonJS stub module (optional)
  "colorScheme": "dark",                 // nativeTheme.themeSource: dark | light | system (default)
  "shots": [
    { "wait": 800, "js": "optional code to eval in page first", "out": "C:/.../home.png" },
    { "wait": 400, "js": "document.querySelector('[data-route=settings]')?.click()",
      "settle": 300, "out": "C:/.../settings.png" }
  ],

  // optional
  "mode": "offscreen",       // offscreen (default) | hidden, see Limitations
  "scale": 2,                // force device pixel ratio (default: the display's)
  "backgroundColor": "#08080a", // window bg for opaque windows (default #ffffff)
  "bridge": "respeak",       // global name of the stubbed bridge
  "timeout": 30000,          // overall ms before exiting with code 2
  "permissions": [],         // permissions to grant, e.g. ["media"] (default: deny all)
  "keepRaw": false,          // with a backdrop, also write <out>.raw.png (the alpha capture)
  "userData": "harness-data" // default: <harness>/harness-data
}
```

Each shot runs in order: wait `wait` ms → `executeJavaScript(js)` (awaited if
it returns a Promise; runs with a user gesture) → wait `settle` ms (default 0) →
two animation frames → `capturePage()` → PNG. Note that `wait` comes *before*
`js`. To see the result of a click, either give it a `settle`, or put the click in
one shot and rely on the next shot's `wait`. Shot code runs in the page's main
world, so top-level `const`/`let` persist across shots. Wrap code in `{ ... }` to
reuse names.

A shot may set its own `backdrop` (or `null`) to override the plan's.

**backdrop** (useful for transparent windows): the captured transparent PNG is
alpha-composited over:
- `"wallpaper-dark"` / `"wallpaper-light"`: built-in, procedurally generated, colourful
  Windows-11-style wallpapers with soft blobs, sharp petals, ribbons and dots (deterministic).
- `"checker"`: a grey/white checkerboard, to inspect alpha directly.
- an image path (png/jpg/webp/gif/bmp/svg), drawn with cover scaling.
- any CSS `background` value: `"#1e1e1e"`, `"linear-gradient(135deg,#f06,#48f)"`, …

## Stub format

```js
// stub.js (CommonJS, required by the harness preload)
module.exports = {
  invoke: {
    'settings:get': () => ({}),                    // value or Promise
    'messages:list': async () => [],
    'app:version': '1.2.3',                        // a plain value works too
  },
  onSend(channel, ...args) {                       // every bridge.send()
    if (channel === 'rec:toggle') this.emit('rec:start');   // `this` = { emit, log }
  },
  events: [                                        // fired after window 'load'
    { channel: 'overlay:config', payload: { demoMode: true }, delay: 0 },
    { channel: 'nav:go', payload: () => 'library', delay: 500 }, // payload may be a function
  ],
};
```

The page gets `window.respeak = { send(ch, ...args), invoke(ch, ...args) -> Promise, on(ch, cb) -> unsubscribe }`.
`on` callbacks receive the single payload, like the real preload. An `invoke` on an
unknown channel resolves `null` and logs `[stub] unhandled invoke <ch>`. Unlike the
real preload, there is no channel allow-list. Shot `js` can push IPC events with
`window.__harness.emit(channel, payload)` (returns the number of listeners
called). `window.__harness.channels()` lists the channels that have listeners.
Use regular functions (not arrow functions) in the stub when you need `this.emit`.

`example-stub.js` is the minimal stub.

## Limitations (measured on this machine, Electron 33.4.11, Windows 11)

- **mode.** `offscreen` (default) runs the page at 60 fps, so rAF loops and CSS
  transitions advance between shots. In `hidden` mode an opaque never-shown window
  fired rAF about once per 500 ms, and a CSS transition had not started 500 ms after
  being set. A capture after a click can then show pre-transition state. Both modes
  render `backdrop-filter` and keep alpha.
- **backdrop-filter.** It works for content inside the window. In a transparent
  window it cannot blur what is behind the window, because Chromium never sees the
  desktop, and the composite shows that honestly: the wallpaper stays sharp behind
  translucent glass. A real transparent Electron window behaves the same way; desktop
  blur would need OS materials (`setBackgroundMaterial('acrylic')`), which this harness
  cannot capture.
- **alpha.** Transparent-window captures keep exact per-pixel alpha. Use `keepRaw` or the
  `checker` backdrop to inspect it.
- Window chrome drawn by the OS (shadows, Mica/acrylic, rounded corners) is not
  part of `capturePage` and is not shown.
- Page `localStorage` etc. starts empty every run (in-memory session).
- The microphone and other permissions are denied unless listed in `permissions`.
  Granting `media` would use the real mic.
- When `executeJavaScript` throws, Electron only reports a generic message.
  The real exception is in the preceding `[page] error:` line.
