# blockout.js

[![CI](https://github.com/afwlehmann/blockout.js/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/afwlehmann/blockout.js/actions/workflows/ci.yml)
[![Play](https://img.shields.io/badge/play-online-brightgreen)](https://afwlehmann.github.io/blockout.js/)

A browser-based 3D Tetris (Blockout) game with split-screen 2-player mode,
original Blockout (1989) keyboard mapping, MP3 chiptune-style music
(Giana Sisters / Turrican inspired), and explosion + slide-down animations
on layer clears.

Built with TypeScript, Three.js, and Vite.

## Play online

A live build is deployed to GitHub Pages from every push to `main`:

**→ https://afwlehmann.github.io/blockout.js/**

Click the link, press any key to enable audio, then `Enter` to start.

## Play locally

Build a single self-contained `dist/index.html` (no server required —
open it via `file://`):

```sh
npm install
npm run build
```

For live development with hot reload:

```sh
npm run dev
```

## Features

- **3 piece sets**: Flat, Basic, Extended
- **3 presets**: Flat Fun, 3D Mania, Out of Control, plus Custom pit sizes
- **3 difficulties**: Easy, Normal, Hard
- **2-player split-screen**: shared piece sequence, face-clear raises
  opponent's stack, win by target faces or KO
- **Crazy Mode (1P only)**: camera-based quaternion spline on the upper
  hemisphere, sliding window of 7 CatmullRom waypoints, speed ramps
  4s → 1.5s over 30s
- **Original Blockout controls**: QWE/ASD rotation, HJKL + arrow keys for
  movement, Space hard drop
- **SID-style audio**: 3-voice WebAudio synth with filter sweeps (used for
  SFX), MP3 chiptune-style music (menu + game tracks), Twintris-style
  escalating clear SFX, move/rotate SFX, thud on slide-down impact,
  dual SFX/music mutes
- **Explosion + slide-down**: cleared layers explode into particles,
  upper blocks slide down with eased animation and thud on impact
- **Screen shake** on hard drop (scales with drop distance) plus low-rumble SFX
- **Spacey 3D environment**: rotating starfield and cube planets around the pit
- **10,000-point all-clear bonus** ("blockout") when a layer clear empties the pit
- **Menu fade-out / game fade-in** transitions on Start
- **HUD level progress bar**
- **Exit-to-menu confirmation** dialog (Esc)
- **Next-piece preview**, **high scores** (localStorage top-10),
  **key remap** (per-player), **camera toggle**, **side views** (4-way
  orthogonal grid), **full shadows** (VSMShadowMap)

## Controls

### Player 1 (original Blockout + HJKL + arrows)

| Action          | Keys              |
| --------------- | ----------------- |
| Move            | H/J/K/L or Arrows |
| Rotate X (flip) | Q (CCW) / A (CW)  |
| Rotate Y (turn) | W (CCW) / S (CW)  |
| Rotate Z (spin) | E (CCW) / D (CW)  |
| Hard drop       | Space             |
| Soft drop       | Left Shift        |
| Pause           | P                 |
| Exit to Menu    | Esc (confirms)    |
| Camera toggle   | C                 |
| Toggle SFX      | O                 |
| Toggle Music    | M                 |
| Toggle Ghost    | G                 |

### Player 2 (numpad)

| Action       | Keys           |
| ------------ | -------------- |
| Move         | Arrow keys     |
| Rotate X     | Numpad 4 / 7   |
| Rotate Y     | Numpad 5 / 8   |
| Rotate Z     | Numpad 6 / 9   |
| Hard drop    | Numpad 0       |
| Soft drop    | Numpad Enter   |
| Pause        | P              |
| Exit to Menu | Esc (confirms) |
| Camera       | Numpad .       |

Keys are remappable via the in-menu Controls panel (side-by-side P1/P2
columns + shared Global Controls section).

## License

[MIT](LICENSE) — Copyright (c) 2026 Alexander Lehmann
