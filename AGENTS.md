# blockout.js

A browser-based 3D Tetris (Blockout) game with split-screen 2-player mode.

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

## Versioning

The flake version is read from `package.json` at evaluation time — bump the
version in `package.json` and the Nix package and dev shell pick it up
automatically. No separate version field exists in `flake.nix`.
