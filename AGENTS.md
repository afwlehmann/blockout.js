# blockout.js

A browser-based 3D Tetris (Blockout) game with split-screen 2-player mode.

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
