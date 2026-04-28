# typst-notes

`typst-notes` is a Typst notes toolkit with three modes: preview, spaced repetition, and graph view. It browses `.typ` files, compiles them to SVG on demand, reviews flashcards extracted from your notes, and visualizes links across the project.

The preview and graph modes work well with links between local Typst files. If you write links like `./file.typ` or `../file.typ`, you can jump between notes in the browser and see their relationships in an Obsidian-like graph.

For spaced repetition, your notes must use the `flashcard(q, a)` helper from `setup.typ`. The SRS mode discovers cards by querying the `<flashcard>` metadata emitted by that function, so that setup is required.

## Disclaimer

This project was vibe coded.

You should review anything you run or publish from this repository yourself. The repository owner is not responsible for the code in the repo.

## Run without installing

```bash
nix run github:zak-grivell/typst-notes -- preview
nix run github:zak-grivell/typst-notes -- preview notes/main.typ
nix run github:zak-grivell/typst-notes -- preview notes/
nix run github:zak-grivell/typst-notes -- srs
nix run github:zak-grivell/typst-notes -- srs --deck=oose --all
nix run github:zak-grivell/typst-notes -- srs --cram
nix run github:zak-grivell/typst-notes -- graph
```

## Install with Nix

```bash
nix profile install github:zak-grivell/typst-notes
```

Then run:

```bash
typst-notes preview
typst-notes preview notes/main.typ
typst-notes srs
typst-notes graph
```

## CLI

```bash
typst-notes preview [path]
typst-notes preview --follow
typst-notes srs [--deck=NAME] [--all] [--cram] [--port=3000]
typst-notes graph [--port=3002]
typst-notes lsp
```

- `typst-notes preview` starts the live Typst preview UI
- `typst-notes preview --follow` follows the file most recently reported by `typst-notes lsp`
- `typst-notes srs` starts the spaced repetition UI
- `typst-notes srs --cram` reviews all cards, saves SRS scheduling changes, and hides cards you already rated while that cram server process is still running
- `typst-notes graph` starts the project graph UI
- `typst-notes lsp` runs a tiny language server that tracks the active Typst file
- SRS progress is stored in `.srs-progress.json` in the current working directory

## Editor Tracking

To make preview follow the file you are actively editing:

1. Run `typst-notes lsp` as a language server in your editor for Typst files.
2. The language server will start `typst-notes preview --follow` automatically.

The preview will switch to the most recently opened, changed, or saved Typst file reported through that LSP connection.

## Flashcards

To use spaced repetition, import and use the `flashcard(q, a)` helper from `setup.typ`.

Example:

```typst
#import "setup.typ": *
#show: setup.with()

#flashcard(
  [What is a monoid?],
  [A set with an associative binary operation and an identity element.],
)
```

Without that helper, `typst-notes srs` will not discover any cards.

## Example Project

An example linked note set lives in `examples/design-patterns/`.

Try it with:

```bash
typst-notes preview examples/design-patterns/index.typ
typst-notes srs --deck=examples/design-patterns
typst-notes graph
```

## Graph View

`typst-notes graph` builds a note graph by scanning local Typst files and extracting relative links like `./file.typ` and `../topic/file.typ`.

It is intended to feel similar to an Obsidian graph for a Typst project:

- linked notes appear as connected nodes
- denser notes appear larger
- you can pan, zoom, search, and inspect connections

## Install from a flake input

Point another flake at this repository and use the exported package:

```nix
{
  inputs.typst-notes.url = "github:zak-grivell/typst-notes";

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
bun src/cli.ts help
bun src/cli.ts preview
bun src/cli.ts srs
bun src/cli.ts graph
```

If you do not want the app to try opening a browser automatically:

```bash
TYPST_NOTES_NO_OPEN=1 typst-notes preview
```
