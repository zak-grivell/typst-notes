import { watch } from "fs/promises";
import { dirname } from "path";
import { openInBrowser } from "../lib/browser.ts";
import { renderPage, renderBrand, escapeHtml } from "../lib/html.ts";
import { collectTypFiles, listTypDirectory, normalizeRequestPath } from "../lib/project.ts";
import { theme } from "../lib/theme.ts";
import { compileFileToSvgPages } from "../lib/typst.ts";

const clients = new Set<ReadableStreamDefaultController>();
let currentWatcher: AbortController | null = null;

function searchScript() {
  return `
    let allFiles = [];
    let selectedIndex = 0;
    const searchInput = document.querySelector('[data-search-input]');
    const resultsContainer = document.querySelector('[data-search-results]');

    fetch('/api/files').then((response) => response.json()).then((files) => {
      allFiles = files;
    });

    function fuzzyMatch(pattern, str) {
      pattern = pattern.toLowerCase();
      str = str.toLowerCase();
      let patternIdx = 0;
      let score = 0;
      let lastMatchIdx = -1;

      for (let i = 0; i < str.length && patternIdx < pattern.length; i++) {
        if (str[i] === pattern[patternIdx]) {
          score += lastMatchIdx === i - 1 ? 10 : 1;
          if (i === 0 || str[i - 1] === '/' || str[i - 1] === '_' || str[i - 1] === '-') {
            score += 5;
          }
          lastMatchIdx = i;
          patternIdx++;
        }
      }

      return patternIdx === pattern.length ? score : 0;
    }

    function highlightMatch(str, pattern) {
      pattern = pattern.toLowerCase();
      let result = '';
      let patternIdx = 0;

      for (let i = 0; i < str.length; i++) {
        if (patternIdx < pattern.length && str[i].toLowerCase() === pattern[patternIdx]) {
          result += '<span class="match">' + str[i] + '</span>';
          patternIdx++;
        } else {
          result += str[i];
        }
      }

      return result;
    }

    function updateSelection() {
      const results = resultsContainer.querySelectorAll('.search-result');
      results.forEach((result, index) => {
        result.classList.toggle('selected', index === selectedIndex);
      });
    }

    function navigate(path) {
      window.location.href = '/' + path;
    }

    function updateResults(query) {
      if (!query) {
        resultsContainer.classList.remove('active');
        return;
      }

      const matches = allFiles
        .map((file) => ({ file, score: fuzzyMatch(query, file) }))
        .filter((entry) => entry.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);

      selectedIndex = 0;

      if (matches.length === 0) {
        resultsContainer.innerHTML = '<div class="search-result"><div class="result-name">No matches found</div></div>';
      } else {
        resultsContainer.innerHTML = matches.map((match, index) => {
          const parts = match.file.split('/');
          const name = parts.pop();
          const path = parts.join('/');
          return '<div class="search-result ' + (index === selectedIndex ? 'selected' : '') + '" data-path="' + match.file + '">' +
            '<div class="result-name">' + highlightMatch(name, query) + '</div>' +
            (path ? '<div class="result-path">' + path + '</div>' : '') +
          '</div>';
        }).join('');
      }

      resultsContainer.classList.add('active');
      updateSelection();
    }

    searchInput.addEventListener('input', (event) => {
      updateResults(event.target.value);
    });

    searchInput.addEventListener('keydown', (event) => {
      const results = resultsContainer.querySelectorAll('[data-path]');
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        selectedIndex = Math.min(selectedIndex + 1, results.length - 1);
        updateSelection();
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        selectedIndex = Math.max(selectedIndex - 1, 0);
        updateSelection();
      } else if (event.key === 'Enter') {
        event.preventDefault();
        const selected = results[selectedIndex];
        if (selected) navigate(selected.dataset.path);
      } else if (event.key === 'Escape') {
        searchInput.value = '';
        resultsContainer.classList.remove('active');
      }
    });

    resultsContainer.addEventListener('click', (event) => {
      const result = event.target.closest('[data-path]');
      if (result) navigate(result.dataset.path);
    });

    document.addEventListener('keydown', (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
        event.preventDefault();
        searchInput.focus();
        searchInput.select();
      }
    });

    document.addEventListener('click', (event) => {
      if (!event.target.closest('.search-wrap')) {
        resultsContainer.classList.remove('active');
      }
    });
  `;
}

function previewStyles() {
  return `
    .directory-grid {
      display: grid;
      gap: 14px;
    }

    .directory-list {
      padding: 12px;
    }

    .directory-item {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 14px 16px;
      border-radius: 14px;
      text-decoration: none;
      color: ${theme.text};
    }

    .directory-item:hover {
      background: ${theme.surface0};
    }

    .directory-icon {
      width: 32px;
      height: 32px;
      border-radius: 10px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      font-weight: 700;
      background: ${theme.surface0};
      color: ${theme.subtext1};
      flex-shrink: 0;
    }

    .directory-item.dir .directory-icon {
      color: ${theme.blue};
    }

    .directory-item.file .directory-icon {
      color: ${theme.peach};
    }

    .directory-copy {
      min-width: 0;
    }

    .directory-title {
      font-weight: 600;
    }

    .directory-path {
      margin-top: 4px;
      color: ${theme.subtext0};
      font-size: 13px;
    }

    .doc-stack {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 24px;
    }

    .doc-page {
      position: relative;
      width: min(100%, 1100px);
      padding: 18px;
      background: rgba(41, 44, 60, 0.75);
      border: 1px solid ${theme.surface0};
      border-radius: 18px;
    }

    .doc-page svg {
      display: block;
      width: 100%;
      height: auto;
      border-radius: 10px;
      background: white;
    }

    .doc-page-number {
      position: absolute;
      top: 12px;
      right: 12px;
    }

    .error-panel {
      padding: 20px;
      border: 1px solid ${theme.red};
      color: ${theme.maroon};
    }

    .error-panel pre {
      margin-top: 12px;
      white-space: pre-wrap;
      word-break: break-word;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 13px;
      line-height: 1.6;
    }
  `;
}

function renderToolbar(subtitle: string, right: string) {
  return {
    toolbarLeft: renderBrand("preview", subtitle),
    toolbarCenter: `<div class="search-wrap"><input class="search" placeholder="Search files... (Ctrl+K)" data-search-input><div class="search-results" data-search-results></div></div>`,
    toolbarRight: right,
  };
}

function renderDirectoryPage(urlPath: string, dirPath: string, dirs: string[], files: string[]) {
  const parentPath = urlPath === "/" ? null : urlPath.split("/").slice(0, -1).join("/") || "/";
  const items = [
    ...(parentPath ? [{ kind: "dir", href: parentPath, name: "..", desc: "Parent directory" }] : []),
    ...dirs.map((dir) => ({
      kind: "dir",
      href: `${urlPath === "/" ? "" : urlPath}/${dir}`,
      name: dir,
      desc: `${dirPath === "/" ? "" : dirPath}/`.replace(/^$/, "/"),
    })),
    ...files.map((file) => ({
      kind: "file",
      href: `${urlPath === "/" ? "" : urlPath}/${file}`,
      name: file,
      desc: `${dirPath === "/" ? "" : dirPath}/`.replace(/^$/, "/"),
    })),
  ];

  const toolbar = renderToolbar(dirPath || "/", `<span class="pill active">directory</span>`);
  return renderPage({
    title: `${dirPath || "/"} · typst-notes preview`,
    styles: previewStyles(),
    scripts: searchScript(),
    ...toolbar,
    body: `<main class="page-body">
      <section class="hero">
        <div>
          <h1 class="hero-title">Preview</h1>
          <p class="hero-subtitle">Browse Typst notes, follow local links, and jump into documents fast.</p>
        </div>
        <div class="meta-row">
          <span class="pill">${dirs.length} dirs</span>
          <span class="pill">${files.length} files</span>
          <span class="pill"><span class="kbd">Ctrl</span><span class="kbd">K</span> search</span>
        </div>
      </section>
      <section class="panel directory-list">
        ${items.length === 0 ? `<div class="empty-state">No .typ files found in this directory.</div>` : items.map((item) => `
          <a class="directory-item ${item.kind}" href="${item.href}">
            <span class="directory-icon">${item.kind === "dir" ? "DIR" : "TYP"}</span>
            <span class="directory-copy">
              <div class="directory-title">${escapeHtml(item.name)}</div>
              <div class="directory-path">${escapeHtml(item.desc)}</div>
            </span>
          </a>
        `).join("")}
      </section>
    </main>`,
  });
}

function renderDocumentPage(filePath: string, svgs: string[], error: string | null) {
  const parentPath = "/" + filePath.split("/").slice(0, -1).join("/");
  const toolbar = renderToolbar(filePath, `<a class="pill" href="${parentPath || "/"}">back</a><span class="pill active">${error ? "error" : `${svgs.length} page${svgs.length === 1 ? "" : "s"}`}</span>`);
  return renderPage({
    title: `${filePath} · typst-notes preview`,
    styles: previewStyles(),
    scripts: `${searchScript()}
      const es = new EventSource('/events/reload');
      es.onmessage = (event) => { if (event.data === 'reload') location.reload(); };
      es.onerror = () => setTimeout(() => location.reload(), 1000);
    `,
    ...toolbar,
    body: `<main class="page-body">
      <section class="hero">
        <div>
          <h1 class="hero-title">${escapeHtml(filePath.split("/").pop() || filePath)}</h1>
          <p class="hero-subtitle">Compiled from ${escapeHtml(filePath)} with live reload enabled.</p>
        </div>
        <div class="meta-row">
          <span class="pill">link with <code>./file.typ</code></span>
          <span class="pill">reload on save</span>
        </div>
      </section>
      ${error ? `<section class="panel error-panel"><strong>Compile error</strong><pre>${escapeHtml(error)}</pre></section>` : `<section class="doc-stack">${svgs.map((svg, index) => `
        <div class="doc-page">
          <span class="pill doc-page-number">page ${index + 1}</span>
          ${svg}
        </div>
      `).join("")}</section>`}
    </main>`,
  });
}

async function watchFile(filePath: string) {
  if (currentWatcher) {
    currentWatcher.abort();
  }

  currentWatcher = new AbortController();
  const dir = dirname(filePath) || ".";

  try {
    const watcher = watch(dir, { signal: currentWatcher.signal });
    for await (const event of watcher) {
      if (event.filename?.endsWith(".typ")) {
        for (const controller of clients) {
          try {
            controller.enqueue("data: reload\n\n");
          } catch {
            clients.delete(controller);
          }
        }
      }
    }
  } catch (error: any) {
    if (error.name !== "AbortError") {
      console.error("Watch error:", error);
    }
  }
}

export function printPreviewHelp() {
  console.log(`
typst-notes preview

Usage:
  typst-notes preview [path]

Examples:
  typst-notes preview
  typst-notes preview notes/main.typ
  typst-notes preview notes/
`);
}

export function startPreviewServer(initialTarget?: string) {
  const server = Bun.serve({
    port: 0,
    async fetch(req) {
      const url = new URL(req.url);
      let pathname = url.pathname;

      if (pathname !== "/" && pathname.endsWith("/")) {
        pathname = pathname.slice(0, -1);
      }

      if (pathname === "/api/files") {
        return Response.json(await collectTypFiles("."));
      }

      if (pathname === "/events/reload") {
        const stream = new ReadableStream({
          start(controller) {
            clients.add(controller);
          },
          cancel(controller) {
            clients.delete(controller);
          },
        });

        return new Response(stream, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
          },
        });
      }

      if (pathname === "/" || pathname === "") {
        const { dirs, files } = await listTypDirectory(".");
        return new Response(renderDirectoryPage("/", "/", dirs, files), {
          headers: { "Content-Type": "text/html" },
        });
      }

      const relativePath = normalizeRequestPath(pathname);
      if (relativePath.endsWith(".typ")) {
        const file = Bun.file(relativePath);
        if (await file.exists()) {
          const { svgs, error } = await compileFileToSvgPages(relativePath);
          watchFile(relativePath);
          return new Response(renderDocumentPage(relativePath, svgs, error), {
            headers: { "Content-Type": "text/html" },
          });
        }
      }

      const { dirs, files } = await listTypDirectory(relativePath);
      if (dirs.length > 0 || files.length > 0) {
        return new Response(renderDirectoryPage(pathname, relativePath, dirs, files), {
          headers: { "Content-Type": "text/html" },
        });
      }

      const withExtension = `${relativePath}.typ`;
      if (await Bun.file(withExtension).exists()) {
        const { svgs, error } = await compileFileToSvgPages(withExtension);
        watchFile(withExtension);
        return new Response(renderDocumentPage(withExtension, svgs, error), {
          headers: { "Content-Type": "text/html" },
        });
      }

      const root = await listTypDirectory(".");
      return new Response(renderDirectoryPage("/", "/", root.dirs, root.files), {
        status: 404,
        headers: { "Content-Type": "text/html" },
      });
    },
  });

  const initialPath = initialTarget ? `/${initialTarget}` : "/";
  const url = `http://localhost:${server.port}${initialPath}`;

  console.log(`\nTypst Notes Preview\n===================\nServer running at: http://localhost:${server.port}\nOpening: ${url}\n\nPress Ctrl+C to stop\n`);
  void openInBrowser(url);
  return server;
}
