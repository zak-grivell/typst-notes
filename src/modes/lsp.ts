import { pathFromDocumentUri, writeActiveFileState } from "../lib/active-file.ts";
import { openInBrowser } from "../lib/browser.ts";
import { isPidRunning, readPreviewServerState } from "../lib/preview-state.ts";

type JsonRpcRequest = {
  id?: string | number;
  method?: string;
  params?: any;
};

function sendMessage(message: unknown) {
  const body = JSON.stringify(message);
  process.stdout.write(`Content-Length: ${Buffer.byteLength(body, "utf8")}\r\n\r\n${body}`);
}

function sendResponse(id: string | number | null | undefined, result: unknown) {
  if (id === undefined) {
    return;
  }

  sendMessage({
    jsonrpc: "2.0",
    id,
    result,
  });
}

async function updateActivePathFromParams(params: any) {
  const uri = params?.textDocument?.uri;
  const path = typeof uri === "string" ? pathFromDocumentUri(uri) : null;
  if (path) {
    await writeActiveFileState(path);
  }
}

export function printLspHelp() {
  console.log(`
typst-notes lsp

Usage:
  typst-notes lsp

Run this as an editor language server to track the active Typst file.
Use it together with:
  typst-notes preview --follow
`);
}

export async function startLspServer(args: string[]) {
  if (args.includes("--help") || args.includes("-h")) {
    printLspHelp();
    return;
  }

  let shutdownRequested = false;
  let buffer = Buffer.alloc(0);
  let previewStarted = false;

  async function ensurePreviewRunning() {
    if (previewStarted || process.env.TYPST_NOTES_NO_OPEN === "1") {
      return;
    }

    const current = await readPreviewServerState();
    if (current && current.followActive && isPidRunning(current.pid)) {
      void openInBrowser(`${current.url}/follow`);
      previewStarted = true;
      return;
    }

    const command = [process.argv[0], process.argv[1], "preview", "--follow"];
    const proc = Bun.spawn(command, {
      stdin: "ignore",
      stdout: "ignore",
      stderr: "ignore",
      detached: true,
    });
    proc.unref();
    previewStarted = true;
  }

  process.stdin.on("data", (chunk: Buffer) => {
    buffer = Buffer.concat([buffer, chunk]);

    while (true) {
      const headerEnd = buffer.indexOf("\r\n\r\n");
      if (headerEnd === -1) {
        return;
      }

      const headerText = buffer.subarray(0, headerEnd).toString("utf8");
      const lengthHeader = headerText
        .split("\r\n")
        .find((line) => line.toLowerCase().startsWith("content-length:"));

      if (!lengthHeader) {
        buffer = buffer.subarray(headerEnd + 4);
        continue;
      }

      const contentLength = parseInt(lengthHeader.split(":")[1].trim(), 10);
      const messageStart = headerEnd + 4;
      const messageEnd = messageStart + contentLength;
      if (buffer.length < messageEnd) {
        return;
      }

      const messageText = buffer.subarray(messageStart, messageEnd).toString("utf8");
      buffer = buffer.subarray(messageEnd);

      void handleMessage(JSON.parse(messageText) as JsonRpcRequest);
    }
  });

  process.stdin.on("end", () => {
    process.exit(0);
  });

  async function handleMessage(message: JsonRpcRequest) {
    switch (message.method) {
      case "initialize":
        await ensurePreviewRunning();
        sendResponse(message.id, {
          capabilities: {
            textDocumentSync: 1,
          },
          serverInfo: {
            name: "typst-notes",
          },
        });
        break;
      case "initialized":
        break;
      case "shutdown":
        shutdownRequested = true;
        sendResponse(message.id, null);
        break;
      case "exit":
        process.exit(shutdownRequested ? 0 : 1);
        break;
      case "textDocument/didOpen":
      case "textDocument/didChange":
      case "textDocument/didSave":
        await updateActivePathFromParams(message.params);
        break;
      default:
        if (message.id !== undefined) {
          sendResponse(message.id, null);
        }
        break;
    }
  }
}
