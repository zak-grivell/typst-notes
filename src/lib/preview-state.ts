import { mkdir, readFile, rm, writeFile } from "fs/promises";
import { dirname } from "path";

export const PREVIEW_SERVER_STATE_PATH = ".typst-notes/preview-server.json";

type PreviewServerState = {
  pid: number;
  url: string;
  followActive: boolean;
  updatedAt: number;
};

export async function writePreviewServerState(state: PreviewServerState) {
  await mkdir(dirname(PREVIEW_SERVER_STATE_PATH), { recursive: true });
  await writeFile(PREVIEW_SERVER_STATE_PATH, JSON.stringify(state, null, 2));
}

export async function readPreviewServerState(): Promise<PreviewServerState | null> {
  try {
    return JSON.parse(await readFile(PREVIEW_SERVER_STATE_PATH, "utf-8")) as PreviewServerState;
  } catch {
    return null;
  }
}

export async function clearPreviewServerState() {
  await rm(PREVIEW_SERVER_STATE_PATH, { force: true }).catch(() => {});
}

export function isPidRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
