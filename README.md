# blockout.js

[![CI](https://github.com/afwlehmann/blockout.js/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/afwlehmann/blockout.js/actions/workflows/ci.yml)

A browser-based 3D Tetris (Blockout) game with split-screen 2-player mode,
original Blockout (1989) keyboard mapping, SID-style chiptune music
(Giana Sisters / Turrican inspired), and explosion + slide-down animations
on layer clears.

Built with TypeScript, Three.js, and Vite. Game logic is fully unit-tested
with Vitest (51 tests); the Nix flake provides a reproducible dev shell
and production build.

## Features

- **3 piece sets**: Flat, Basic, Extended
- **3 presets**: Flat Fun, 3D Mania, Out of Control, plus Custom pit sizes
- **3 difficulties**: Easy, Normal, Hard
- **2-player split-screen**: shared piece sequence, face-clear raises
  opponent's stack, win by target faces or KO
- **Crazy Mode**: pit view rotates on a sine wave
- **Original Blockout controls**: QWE/ASD rotation, HJKL + arrow keys for
  movement, Space hard drop
- **SID-style audio**: 3-voice WebAudio synth with filter sweeps, original
  3-minute chiptune (130 BPM, A phrygian dominant), Twintris-style
  escalating clear SFX, move/rotate SFX, thud on slide-down impact
- **Explosion + slide-down**: cleared layers explode into particles,
  upper blocks slide down with eased animation
- **Next-piece preview**, **high scores** (localStorage top-10),
  **key remap** (per-player), **camera toggle**, **full shadows**

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
| Pause           | Esc               |
| Camera toggle   | C                 |
| Toggle SFX      | O                 |
| Toggle Music    | B                 |
| Toggle Ghost    | G                 |

### Player 2

| Action         | Keys             |
| -------------- | ---------------- |
| Move           | Arrow keys       |
| Rotate X       | U (CW) / O (CCW) |
| Rotate Y       | 7 (CW) / 9 (CCW) |
| Rotate Z       | M (CW) / . (CCW) |
| Hard drop      | Right Shift      |
| Soft drop      | Right Ctrl       |
| Pause / Camera | Esc / /          |

Keys are remappable via the in-menu Controls panel.

## Verify commands

| Command                | Description                                 |
| ---------------------- | ------------------------------------------- |
| `npm run dev`          | Vite dev server                             |
| `npm run typecheck`    | TypeScript typecheck (strict)               |
| `npm test`             | Run unit tests (Vitest)                     |
| `npm run lint`         | ESLint                                      |
| `npm run format`       | Prettier format                             |
| `npm run format:check` | Prettier check                              |
| `npm run build`        | Typecheck + production build                |
| `nix develop`          | Enter dev shell (Node.js + tooling + hooks) |
| `nix build`            | Build the production package (runs checks)  |
| `nix flake check`      | Sandboxed pre-commit hooks + package build  |
| `nix fmt`              | Format `.nix` files with nixfmt             |

## Versioning

The flake version is read from `package.json` at evaluation time — bump the
version in `package.json` and the Nix package and dev shell pick it up
automatically. No separate version field exists in `flake.nix`.

## License

[MIT](LICENSE) — Copyright (c) 2026 Alexander Lehmann
