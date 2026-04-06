import { sharedCss } from "./theme.ts";

type PageOptions = {
  title: string;
  body: string;
  toolbarLeft: string;
  toolbarCenter?: string;
  toolbarRight?: string;
  styles?: string;
  scripts?: string;
};

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function renderPage({
  title,
  body,
  toolbarLeft,
  toolbarCenter = "",
  toolbarRight = "",
  styles = "",
  scripts = "",
}: PageOptions): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    ${sharedCss}
    ${styles}
  </style>
</head>
<body>
  <div class="app-shell">
    <header class="toolbar">
      <div class="toolbar-section left">${toolbarLeft}</div>
      <div class="toolbar-section center">${toolbarCenter}</div>
      <div class="toolbar-section right">${toolbarRight}</div>
    </header>
    ${body}
  </div>
  ${scripts ? `<script>${scripts}</script>` : ""}
</body>
</html>`;
}

export function renderBrand(mode: string, subtitle: string): string {
  return `<a class="brand" href="/">
    <span class="brand-mark"></span>
    <span class="brand-copy">
      <span class="brand-title">typst-notes</span>
      <span class="brand-subtitle">${escapeHtml(mode)} · ${escapeHtml(subtitle)}</span>
    </span>
  </a>`;
}
