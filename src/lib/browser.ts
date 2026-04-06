export async function openInBrowser(url: string) {
  if (process.env.TYPST_NOTES_NO_OPEN === "1") {
    return;
  }

  const commands = process.platform === "darwin"
    ? [["open", url]]
    : [["xdg-open", url]];

  for (const command of commands) {
    try {
      const proc = Bun.spawn(command, {
        stdout: "ignore",
        stderr: "ignore",
      });
      const exitCode = await proc.exited;
      if (exitCode === 0) {
        return;
      }
    } catch {
      // Fall back to printing the URL when no opener is available.
    }
  }

  console.log(`Open ${url} in your browser.`);
}
