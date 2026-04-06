{
  description = "Live Typst notes preview server";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = {
    self,
    nixpkgs,
    flake-utils,
    ...
  }:
    flake-utils.lib.eachDefaultSystem (
      system: let
        pkgs = nixpkgs.legacyPackages.${system};

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
          src = self;

          dontBuild = true;

          nativeBuildInputs = [ pkgs.makeWrapper ];

          installPhase = ''
            runHook preInstall

            mkdir -p "$out/libexec" "$out/bin"
            cp "$src/view.ts" "$out/libexec/view.ts"

            makeWrapper "${pkgs.bun}/bin/bun" "$out/bin/typst-notes" \
              --add-flags "$out/libexec/view.ts" \
              --prefix PATH : "${pkgs.lib.makeBinPath runtimeDeps}"

            runHook postInstall
          '';

          meta = with pkgs.lib; {
            description = "Preview Typst notes in a browser with live reload";
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
