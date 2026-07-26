{
  description = "blockout.js — browser-based 3D Tetris (Blockout) with split-screen 2-player mode";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    git-hooks.url = "github:cachix/git-hooks.nix";
  };

  outputs =
    {
      self,
      nixpkgs,
      git-hooks,
    }:
    let
      supportedSystems = [
        "x86_64-linux"
        "aarch64-linux"
        "x86_64-darwin"
        "aarch64-darwin"
      ];
      forEachSystem = nixpkgs.lib.genAttrs supportedSystems;
      pkgVersion = (builtins.fromJSON (builtins.readFile ./package.json)).version;
    in
    {
      checks = forEachSystem (system: {
        pre-commit-check = git-hooks.lib.${system}.run {
          src = ./.;
          hooks = {
            nixfmt.enable = true;
            convco.enable = true;
          };
        };
      });

      packages = forEachSystem (
        system:
        let
          pkgs = nixpkgs.legacyPackages.${system};
        in
        {
          default = pkgs.buildNpmPackage {
            pname = "blockout.js";
            version = pkgVersion;
            src = ./.;
            npmDepsHash = "sha256-V41OM0KfAf4CQeN4P6k6gMcAPmjjkpTjii9QGbNt/kM=";
            dontNpmBuild = true;
            buildPhase = ''
              runHook preBuild
              npm run build
              runHook postBuild
            '';
            installPhase = ''
              runHook preInstall
              mkdir -p $out/share/blockout.js
              cp -r dist/* $out/share/blockout.js/
              runHook postInstall
            '';
            doCheck = true;
            checkPhase = ''
              runHook preCheck
              npm run typecheck
              npm test
              npm run lint
              runHook postCheck
            '';
            meta = {
              description = "Browser-based 3D Tetris (Blockout) with split-screen 2-player mode";
              license = pkgs.lib.licenses.mit;
              homepage = "https://github.com/afwlehmann/blockout.js";
              platforms = pkgs.lib.platforms.unix;
            };
          };
        }
      );

      devShells = forEachSystem (
        system:
        let
          pkgs = nixpkgs.legacyPackages.${system};
          inherit (self.checks.${system}.pre-commit-check) shellHook enabledPackages;
        in
        {
          default = pkgs.mkShell {
            packages = enabledPackages ++ [
              pkgs.nodejs_22
              pkgs.git
              pkgs.nixfmt
            ];
            shellHook = ''
              ${shellHook}
              echo ""
              echo "blockout.js dev shell (v${pkgVersion})"
              echo "  npm run dev      — Vite dev server"
              echo "  npm run typecheck — TypeScript check"
              echo "  npm test         — Vitest unit tests"
              echo "  npm run lint     — ESLint"
              echo "  npm run build    — typecheck + production build"
              echo "  nix flake check  — sandboxed hooks + build"
              echo ""
            '';
          };
        }
      );

      formatter = forEachSystem (system: nixpkgs.legacyPackages.${system}.nixfmt);
    };
}
