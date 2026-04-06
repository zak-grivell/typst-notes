{
  description = "Typst notes preview, SRS, and project graph";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = {
    nixpkgs,
    flake-utils,
    ...
  }:
    flake-utils.lib.eachDefaultSystem (
      system: let
        pkgs = nixpkgs.legacyPackages.${system};
        source = pkgs.lib.cleanSourceWith {
          src = ./.;
          filter = path: type: let
            baseName = builtins.baseNameOf path;
          in
            !(baseName == ".git" || baseName == ".direnv" || baseName == "result" || baseName == ".srs-progress.json");
        };

        runtimeDeps = with pkgs; [
          bun
          typst
        ];

        devTools = with pkgs; [
          tinymist
          typstyle
          typescript-language-server
        ];

        typst-notes = pkgs.stdenvNoCC.mkDerivation {
          pname = "typst-notes";
          version = "0.1.0";
          src = source;

          dontBuild = true;

          nativeBuildInputs = [ pkgs.makeWrapper ];

          installPhase = ''
            runHook preInstall

            mkdir -p "$out/libexec" "$out/bin"
            cp -R "$src/src" "$out/libexec/src"

            makeWrapper "${pkgs.bun}/bin/bun" "$out/bin/typst-notes" \
              --add-flags "$out/libexec/src/cli.ts" \
              --prefix PATH : "${pkgs.lib.makeBinPath runtimeDeps}"

            runHook postInstall
          '';

          meta = with pkgs.lib; {
            description = "Preview Typst notes, review flashcards, and explore note graphs";
            mainProgram = "typst-notes";
            license = licenses.mit;
            platforms = platforms.unix;
          };
        };
      in {
        packages = {
          default = typst-notes;
          typst-notes = typst-notes;
        };

        apps = {
          default = {
            type = "app";
            program = "${typst-notes}/bin/typst-notes";
          };
          typst-notes = {
            type = "app";
            program = "${typst-notes}/bin/typst-notes";
          };
        };

        devShells.default = pkgs.mkShell {
          packages = runtimeDeps ++ devTools;
        };
      }
    );
}
