# typst-notes

`typst-notes` is a small live Typst preview server. It serves a browsable view of your `.typ` files, compiles them to SVG on demand, and reloads when files change.

It also works well with links between local Typst files. If you write links like `./file.typ`, you can jump between notes in the browser in a way that feels similar to Obsidian-style note navigation.

## Disclaimer

This project was vibe coded.

You should review anything you run or publish from this repository yourself. The repository owner is not responsible for the code in the repo.

## Run without installing

```bash
nix run github:<owner>/typst-notes
```

Open a specific file or directory:

```bash
nix run github:<owner>/typst-notes -- notes/main.typ
nix run github:<owner>/typst-notes -- notes/
```

## Install with Nix

```bash
nix profile install github:<owner>/typst-notes
```

Then run:

```bash
typst-notes
typst-notes notes/main.typ
```

## Install from a flake input

Point another flake at this repository and use the exported package:

```nix
{
  inputs.typst-notes.url = "github:<owner>/typst-notes";

  outputs = { self, nixpkgs, typst-notes, ... }: {
    nixosConfigurations.my-host = nixpkgs.lib.nixosSystem {
      system = "x86_64-linux";
      modules = [
        ({ pkgs, ... }: {
          environment.systemPackages = [
            typst-notes.packages.${pkgs.system}.default
          ];
        })
      ];
    };
  };
}
```

For Home Manager:

```nix
home.packages = [
  inputs.typst-notes.packages.${pkgs.system}.default
];
```

## What the flake exports

- `packages.${system}.default`
- `packages.${system}.typst-notes`
- `apps.${system}.default`
- `apps.${system}.typst-notes`

## Development

Enter the dev shell:

```bash
nix develop
```

Run the script directly while working on it:

```bash
bun view.ts
```

If you do not want the app to try opening a browser automatically:

```bash
TYPST_NOTES_NO_OPEN=1 typst-notes
```
