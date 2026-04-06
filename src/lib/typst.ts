import { mkdtemp, readdir, readFile, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";

export type SvgCompileResult = {
  svgs: string[];
  error: string | null;
};

type RawCard = {
  kind: string;
  id: string;
  q: string;
  a: string;
};

async function readStream(stream: ReadableStream | null): Promise<string> {
  if (!stream) {
    return "";
  }

  return new Response(stream).text();
}

export async function compileFileToSvgPages(filePath: string): Promise<SvgCompileResult> {
  const tempDir = await mkdtemp(join(tmpdir(), "typst-notes-"));
  const outputPattern = join(tempDir, "page-{n}.svg");

  try {
    const proc = Bun.spawn([
      "typst",
      "compile",
      "--root",
      ".",
      filePath,
      outputPattern,
      "--format",
      "svg",
    ], {
      stdout: "pipe",
      stderr: "pipe",
    });

    const stderr = await readStream(proc.stderr);
    const exitCode = await proc.exited;
    if (exitCode !== 0) {
      return { svgs: [], error: stderr };
    }

    const entries = await readdir(tempDir);
    const svgFiles = entries
      .filter((file) => file.endsWith(".svg"))
      .sort((a, b) => {
        const aIndex = parseInt(a.match(/\d+/)?.[0] || "0", 10);
        const bIndex = parseInt(b.match(/\d+/)?.[0] || "0", 10);
        return aIndex - bIndex;
      });

    const svgs = await Promise.all(
      svgFiles.map((file) => readFile(join(tempDir, file), "utf-8")),
    );

    return { svgs, error: null };
  } finally {
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

export async function queryFlashcards(filePath: string): Promise<RawCard[]> {
  const proc = Bun.spawn([
    "typst",
    "query",
    filePath,
    "<flashcard>",
    "--field",
    "value",
    "--format",
    "json",
    "--root",
    ".",
  ], {
    stdout: "pipe",
    stderr: "pipe",
  });

  const [stdout, stderr] = await Promise.all([
    readStream(proc.stdout),
    readStream(proc.stderr),
  ]);
  const exitCode = await proc.exited;

  if (exitCode !== 0) {
    throw new Error(stderr || `typst query failed for ${filePath}`);
  }

  return JSON.parse(stdout) as RawCard[];
}

function renderTypstSource(content: string): string {
  return `
#let fold-fn(a, b) = a + b
#let fake-sequence(..args) = args.pos().fold([], fold-fn)
#set page(width: 160mm, height: 100mm, margin: 10pt)
#set align(center)
#import "setup.typ": *
#show: setup.with()

#eval("${content.replace(/\\/g, "\\\\").replace(/\"/g, '\\\"').replace(/\n/g, "\\n")}", mode: "markup", scope: (diagram: diagram, edge: edge, node: node))
`;
}

export async function renderMarkupToSvg(content: string): Promise<string> {
  const proc = Bun.spawn([
    "typst",
    "compile",
    "--root",
    ".",
    "-",
    "-",
    "--format",
    "svg",
  ], {
    stdin: new Blob([renderTypstSource(content)]),
    stdout: "pipe",
    stderr: "pipe",
  });

  const [stdout, stderr] = await Promise.all([
    readStream(proc.stdout),
    readStream(proc.stderr),
  ]);
  const exitCode = await proc.exited;

  if (exitCode !== 0) {
    throw new Error(stderr || "Typst compilation failed");
  }

  return stdout;
}
