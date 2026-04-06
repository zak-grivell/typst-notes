import { mkdir, readFile, writeFile } from "fs/promises";
import { fileURLToPath } from "url";
import { dirname, relative } from "path";

export const ACTIVE_FILE_STATE_PATH = ".typst-notes/active-file.json";

type ActiveFileState = {
  path: string | null;
  updatedAt: number;
};

function normalizeTrackedPath(filePath: string): string | null {
  if (!filePath.endsWith(".typ")) {
    return null;
  }

  const relativePath = relative(process.cwd(), filePath).replaceAll("\\", "/");
  if (relativePath.startsWith("../") || relativePath === "..") {
    return null;
  }

  return relativePath;
}

export function pathFromDocumentUri(uri: string): string | null {
  try {
    if (!uri.startsWith("file:")) {
      return null;
    }

    return normalizeTrackedPath(fileURLToPath(uri));
  } catch {
    return null;
  }
}

export async function writeActiveFileState(path: string | null) {
  await mkdir(dirname(ACTIVE_FILE_STATE_PATH), { recursive: true });
  const state: ActiveFileState = {
    path,
    updatedAt: Date.now(),
  };
  await writeFile(ACTIVE_FILE_STATE_PATH, JSON.stringify(state, null, 2));
}

export async function readActiveFileState(): Promise<ActiveFileState> {
  try {
    return JSON.parse(await readFile(ACTIVE_FILE_STATE_PATH, "utf-8")) as ActiveFileState;
  } catch {
    return {
      path: null,
      updatedAt: 0,
    };
  }
}
