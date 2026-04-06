#!/usr/bin/env bun

import { printGraphHelp, startGraphServer } from "./modes/graph.ts";
import { printPreviewHelp, startPreviewServer } from "./modes/preview.ts";
import { printSrsHelp, startSrsServer } from "./modes/srs.ts";

function printHelp() {
  console.log(`
typst-notes

Usage:
  typst-notes <command> [options]

Commands:
  preview [path]           Browse and live-preview Typst notes
  srs [options]            Review flashcards with spaced repetition
  graph [options]          Explore project links as a graph
  help                     Show this help message

Examples:
  typst-notes preview
  typst-notes preview oose/state.typ
  typst-notes srs --deck=oose --all
  typst-notes graph
`);
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === "help" || command === "--help" || command === "-h") {
    printHelp();
    return;
  }

  if (command === "--version" || command === "-v") {
    console.log("typst-notes 0.1.0");
    return;
  }

  if (command === "preview") {
    if (args[1] === "--help" || args[1] === "-h") {
      printPreviewHelp();
      return;
    }
    const pathArg = args[1] && !args[1].startsWith("-") ? args[1] : undefined;
    startPreviewServer(pathArg);
    return;
  }

  if (command === "srs") {
    await startSrsServer(args.slice(1));
    return;
  }

  if (command === "graph") {
    if (args[1] === "--help" || args[1] === "-h") {
      printGraphHelp();
      return;
    }
    await startGraphServer(args.slice(1));
    return;
  }

  console.error(`Unknown command: ${command}`);
  printHelp();
  process.exit(1);
}

void main();
