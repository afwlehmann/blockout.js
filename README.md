# blockout.js

[![CI](https://github.com/afwlehmann/blockout.js/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/afwlehmann/blockout.js/actions/workflows/ci.yml)

A browser-based 3D Tetris (Blockout) game with split-screen 2-player mode.

Built with TypeScript, Three.js, and Vite. Game logic is fully unit-tested with
Vitest; the Nix flake provides a reproducible dev shell and production build.

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
