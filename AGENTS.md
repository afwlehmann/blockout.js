# blockout.js

A browser-based 3D Tetris (Blockout) game with split-screen 2-player mode,
original Blockout (1989) keyboard mapping, SID-style chiptune music
(Giana Sisters / Turrican inspired), and explosion + slide-down animations
on layer clears.

## Development environment

If Nix is available on the system, **always run commands inside the Nix dev
shell** so that Node.js, tooling, and git-hooks match CI exactly:

```sh
nix develop -c <command>   # one-off, e.g. nix develop -c npm test
nix develop                 # interactive shell, then run commands directly
```

If Nix is not installed, fall back to `npm ci` and use the local Node.js.

## Verify commands

| Command                               | Description                                 |
| ------------------------------------- | ------------------------------------------- |
| `nix develop -c npm run dev`          | Vite dev server                             |
| `nix develop -c npm run typecheck`    | TypeScript typecheck (strict)               |
| `nix develop -c npm test`             | Run unit tests (Vitest)                     |
| `nix develop -c npm run lint`         | ESLint                                      |
| `nix develop -c npm run format`       | Prettier format                             |
| `nix develop -c npm run format:check` | Prettier check                              |
| `nix develop -c npm run build`        | Typecheck + production build                |
| `nix develop`                         | Enter dev shell (Node.js + tooling + hooks) |
| `nix build`                           | Build the production package (runs checks)  |
| `nix flake check`                     | Sandboxed pre-commit hooks + package build  |
| `nix fmt`                             | Format `.nix` files with nixfmt             |

## Coding conventions

- **No `for`/`while` loops** — use array methods (`.forEach`, `.map`,
  `.filter`, `.reduce`). Exception: hot inner loops in audio/render code
  may use `for (let i = …)` for performance.
- **No `let`** — use `const` exclusively.
- **No type casts (`as`)** — design types so casts are unnecessary.
- **No comments** unless explicitly requested.
- **Strict TypeScript** — `noUncheckedIndexedAccess`,
  `exactOptionalPropertyTypes`, `strict` all enabled.
- **ESLint flat config** (v9) + Prettier enforced via pre-commit hooks.

## Project structure

```
src/
├── audio/          SID synth, music scheduler, SFX, track data
│   ├── sid.ts      WebAudio SID-style synth (3 voices, filter, noise)
│   ├── scheduler.ts  Lookahead scheduler with filter automation
│   ├── track.ts    Original 3-min chiptune (130 BPM, A phrygian dominant)
│   ├── sfx.ts      Twintris-style escalating SFX + move/rotate/thud
│   └── manager.ts  AudioManager with dual SFX/music mutes (localStorage)
├── game/           Game logic (fully unit-tested)
│   ├── types.ts    Core types: PlayerId, PieceDef, MatchConfig, etc.
│   ├── pieces.ts   Polycube definitions + 24-orientation rotation tables
│   ├── registry.ts Piece sets: Flat, Basic, Extended
│   ├── pit.ts      3D pit grid: collision, lock, face clear, raiseStack
│   ├── engine.ts   PlayerEngine: gravity, scoring, ghost, wall kicks, events
│   ├── match.ts    Match: attack routing, win conditions, shared sequence
│   └── rng.ts      Seeded RNG (xorshift32)
├── input/          Keyboard input
│   ├── keyboard.ts KeyBinding (multi-key), layouts, DAS repeat, lookup
│   └── input.ts    InputSource facade
├── render/         Three.js rendering
│   ├── scene.ts    Scene, lights, shadows, resize
│   ├── blockMesh.ts  InstancedMesh for locked cells + slide animation
│   ├── pieceView.ts  Active piece + ghost piece rendering
│   ├── pitView.ts   Pit view: cameras, walls, particles, slide animation
│   └── layout.ts   Split-screen layout (1P centered, 2P side-by-side)
├── ui/             DOM UI (CSS injected, no framework)
│   ├── dom.ts      create(), mount(), injectStyles()
│   ├── menu.ts     Start menu: mode, preset, difficulty, Crazy Mode, remap
│   ├── hud.ts      Per-player HUD: score/level/faces, next-piece preview
│   ├── gameOver.ts Game-over screen: winner, stats, high scores, rematch
│   ├── highScores.ts  localStorage top-10 score persistence
│   └── keyRemap.ts Interactive key rebinding panel (P1/P2 tabs)
└── main.ts         Game lifecycle: menu → game → game-over → rematch
```

## Controls

### Player 1 (original Blockout mapping + HJKL + arrow keys)

| Action          | Keys              |
| --------------- | ----------------- |
| Move            | H/J/K/L or Arrows |
| Rotate X (flip) | Q (CCW) / A (CW)  |
| Rotate Y (turn) | W (CCW) / S (CW)  |
| Rotate Z (spin) | E (CCW) / D (CW)  |
| Hard drop       | Space             |
| Soft drop       | Left Shift        |
| Pause           | Esc               |
| Camera toggle   | R                 |
| Toggle SFX      | O                 |
| Toggle Music    | B                 |
| Toggle Ghost    | G                 |

### Player 2 (arrow keys + right-hand cluster)

| Action         | Keys             |
| -------------- | ---------------- |
| Move           | Arrow keys       |
| Rotate X       | U (CW) / O (CCW) |
| Rotate Y       | 7 (CW) / 9 (CCW) |
| Rotate Z       | M (CW) / . (CCW) |
| Hard drop      | Right Shift      |
| Soft drop      | Right Ctrl       |
| Pause / Camera | Esc / /          |

Keys are remappable via the in-menu Controls panel (P1/P2 tabs).

## Game features

- **3 piece sets**: Flat (7 flat polycubes), Basic (7 Soma shapes),
  Extended (all 1-5 cube polycubes)
- **3 presets**: Flat Fun (5×5×12), 3D Mania (3×3×10), Out of Control
  (5×5×10 extended), plus Custom pit dimensions
- **3 difficulties**: Easy, Normal, Hard (gravity speed)
- **2-player split-screen**: shared seedable piece sequence, face-clear
  raises opponent's stack, win by target faces or KO
- **Crazy Mode**: pit view rotates on a sine wave (z: 0.15 rad @ 0.5 Hz,
  x: 0.08 rad @ 0.3 Hz)
- **Next-piece preview**: 2D canvas in HUD, updated each frame
- **High scores**: localStorage top-10, displayed on game-over screen
- **Key remap**: per-player interactive rebinding with live display
- **Camera toggle**: angled top-down ↔ side view (C or R)
- **Full shadows**: PCFSoftShadowMap on all meshes
- **Audio**: SID-style synth with filter sweeps, original 3-min chiptune
  (130 BPM, A phrygian dominant, 4-section A-B-A'-C structure),
  Twintris-style escalating clear SFX, move/rotate SFX, thud on
  slide-down impact, dual SFX/music mutes
- **Explosion + slide-down**: cleared layers explode into particles,
  upper blocks slide down with eased animation and thud on impact

## Versioning

The flake version is read from `package.json` at evaluation time — bump the
version in `package.json` and the Nix package and dev shell pick it up
automatically. No separate version field exists in `flake.nix`.
