# Butterchurn — Local Demo (fully offline)

This folder is a self-contained, ready-to-run copy of the Butterchurn
Milkdrop-style visualizer. Everything it needs (the built `butterchurn`
library, presets, jQuery, lodash, normalize.css) is already vendored in
`vendor/` — no internet connection or npm install required, and no CDN calls
at runtime.

## Why you can't just double-click index.html

Butterchurn uses a JavaScript ES module (`import ... from './vendor/butterchurn.js'`)
which browsers refuse to load over the bare `file://` protocol (CORS). You
need to serve the folder over `http://localhost` instead — takes 5 seconds.

## Run it (pick one)

### Easiest (macOS) — double-click

Double-click **`Start Butterchurn.command`** in Finder. It starts a local
server (reachable only from this Mac), opens the app in your default browser,
and keeps a Terminal window open; close that window to stop. Launching again
while it's running just reopens the app. If macOS says it can't be opened
(e.g. the folder was downloaded), right-click the file, choose **Open**, then
confirm once.


### Option A — Python (usually already installed on Mac/Linux)
```bash
cd butterchurn-local-demo
python3 -m http.server 8080
```
Then open: http://localhost:8080

### Option B — Node.js
```bash
cd butterchurn-local-demo
npx serve -l 8080
```
Then open: http://localhost:8080

### Option C — VS Code
Install the "Live Server" extension, right-click `index.html`, choose
"Open with Live Server".

## Requirements

- A browser with **WebGL2** support (any recent Chrome, Firefox, Edge, Safari).
- That's it — no build step, no dependencies to fetch.

## Using it

The demo uses two windows: `index.html` is the **control panel**, and it
opens a separate **display window** (`display.html`) that shows only the
visualizer. If your browser blocks the popup, allow popups for `localhost`
and click **Open display**. Closing the control panel also closes the display.

### Display window

- **Fullscreen:** double-click the display or press **F** (**Esc** or **F**
  exits). Move the window to another monitor or projector first.
- In fullscreen the browser's toolbar is hidden and only slides in if you move
  the mouse to the top edge. A normal (non-fullscreen) window can't hide its
  toolbar — browsers don't allow pages to do that — so use fullscreen for the
  clean look.
- The mouse cursor and the on-screen hint fade out after 2 seconds without
  mouse movement.

### Audio source

Pick one of three sources. The active one is highlighted; click it again (or
**Stop**) to turn it off, or click another source to switch. If you cancel a
file picker or permission prompt, whatever was already playing keeps going.

- **Local files** — pick one or more audio files; they play in order
  (**Next track** skips ahead).
- **Microphone** — visualizes a mic or line-in (grant mic permission when
  prompted). Browser voice processing is turned off so music isn't flattened.
- **Speaker output** — visualizes whatever your computer is playing.
  Browsers can only capture this through screen sharing, so a share dialog
  appears: pick a tab and turn on "Also share tab audio", or pick the entire
  screen and turn on "Also share system audio" (Chrome/Edge/Brave; system audio
  needs Windows or macOS 14.2+). Only the audio is used; the video is
  discarded. Click "Stop sharing" in the browser or **Stop** to end it. Safari
  and Firefox can't capture audio this way; route it through a loopback device
  such as [BlackHole](https://github.com/ExistentialAudio/BlackHole), select it
  as the browser's microphone, and use **Microphone** instead.

### Effects

MilkDrop 3-style post-processing, applied to the finished frame on the GPU.
Settings are remembered between visits. **On** turns all effects off and on
without losing them (shortcut **E**); **Reset** clears them. Double-click a
slider to reset just that one.

- **Mirror & flip** — Off / Horizontal / Vertical / Quad mirroring (**M**
  cycles), plus flip horizontal and vertical.
- **Filters** — Invert (**I**), Solarize, Burn, Brighten, Darken (MilkDrop's
  classic post-effects) and Edges (neon outlines). They can be combined.
- **Distort** — Kaleidoscope (segments), Pixelate, RGB split, Echo (a zoomed
  copy blended over the frame, like MilkDrop's video echo).
- **Color** — Hue shift, Hue cycle (continuous rotation), Saturation,
  Contrast, Brightness, Posterize, Vignette.

When every effect is off, the extra pass is skipped entirely, so there's no
performance cost.

### Presets

- **‹ / ›** and the dropdown switch presets.
- **Auto-advance every N sec** and **Random order** control cycling. The
  timer restarts whenever you change preset by hand.
- **Keyboard** (works in either window): Space / → = next preset,
  Backspace / ← = previous preset, H = next preset with an instant cut,
  M = cycle mirror, I = invert, E = effects on/off.

## Folder contents

```
Start Butterchurn.command  double-click launcher (macOS)
index.html            the control panel (no external/CDN references)
display.html          the display window opened by the control panel
effects.js            the post-processing effects shader
vendor/
  butterchurn.js       the built visualizer library (dev/unminified build)
  butterchurn.js.map
  base.min.js          "base" Milkdrop preset pack
  extra.min.js         "extra" Milkdrop preset pack
  jquery.min.js
  lodash.min.js
  normalize.css
```

## Rebuilding from source (optional)

If you want to modify the visualizer itself, clone the real repo and build it:
```bash
git clone https://github.com/jberg/butterchurn.git
cd butterchurn
pnpm install
pnpm run build       # -> dist/butterchurn.min.js
pnpm run dev-build    # -> dist/butterchurn.js (unminified, used here)
```
Then copy the resulting `dist/butterchurn.js` into this folder's `vendor/`.
