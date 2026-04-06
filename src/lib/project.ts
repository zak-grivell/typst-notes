import { readdir, readFile } from "fs/promises";
import { posix as pathPosix } from "path";

function isVisibleEntry(name: string): boolean {
  return !name.startsWith(".") && name !== "node_modules";
}

export function normalizeRequestPath(pathname: string): string {
  return pathname.replace(/^\/+/, "").replace(/\/+/g, "/");
}

export function normalizeProjectPath(pathname: string): string {
  const normalized = pathPosix.normalize(pathname).replace(/^\.\//, "");
  return normalized === "." ? "" : normalized.replace(/^\/+/, "");
}

export async function collectTypFiles(dir = ".", prefix = ""): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  const results: string[] = [];

  for (const entry of entries) {
    if (!isVisibleEntry(entry.name)) {
      continue;
    }

    const fullPath = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      results.push(...await collectTypFiles(`${dir}/${entry.name}`, fullPath));
    } else if (entry.isFile() && entry.name.endsWith(".typ")) {
      results.push(fullPath);
    }
  }

  return results.sort();
}

export async function listTypDirectory(dirPath: string): Promise<{ dirs: string[]; files: string[] }> {
  const dirs: string[] = [];
  const files: string[] = [];
  const entries = await readdir(dirPath, { withFileTypes: true }).catch(() => []);

  for (const entry of entries) {
    if (!isVisibleEntry(entry.name)) {
      continue;
    }

    if (entry.isDirectory()) {
      dirs.push(entry.name);
    } else if (entry.isFile() && entry.name.endsWith(".typ")) {
      files.push(entry.name);
    }
  }

  return {
    dirs: dirs.sort(),
    files: files.sort(),
  };
}

export function deckNameForFile(filePath: string): string {
  const dir = pathPosix.dirname(filePath);
  return dir === "." ? "root" : dir;
}

export function extractTypstLinks(filePath: string, source: string): string[] {
  const links = new Set<string>();
  const baseDir = pathPosix.dirname(filePath);
  const pattern = /["']((?:\.\.?\/)[^"'\n]+?\.typ)["']/g;

  for (const match of source.matchAll(pattern)) {
    const raw = match[1];
    const resolved = normalizeProjectPath(pathPosix.join(baseDir, raw));
    if (resolved) {
      links.add(resolved);
    }
  }

  return [...links].sort();
}

export async function buildProjectGraph() {
  const files = await collectTypFiles(".");
  const fileSet = new Set(files);
  const inbound = new Map<string, number>();
  const outbound = new Map<string, number>();
  const edges: Array<{ source: string; target: string }> = [];

  for (const file of files) {
    inbound.set(file, 0);
    outbound.set(file, 0);
  }

  for (const file of files) {
    const source = await readFile(file, "utf-8").catch(() => "");
    const links = extractTypstLinks(file, source);

    for (const target of links) {
      if (!fileSet.has(target)) {
        continue;
      }

      edges.push({ source: file, target });
      outbound.set(file, (outbound.get(file) || 0) + 1);
      inbound.set(target, (inbound.get(target) || 0) + 1);
    }
  }

  const nodes = files.map((file) => ({
    id: file,
    path: file,
    label: file.split("/").pop() || file,
    directory: deckNameForFile(file),
    inbound: inbound.get(file) || 0,
    outbound: outbound.get(file) || 0,
    degree: (inbound.get(file) || 0) + (outbound.get(file) || 0),
  }));

  return { nodes, edges };
}
