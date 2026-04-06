#!/usr/bin/env bun

/**
 * Typst SVG Preview Server
 * 
 * Compiles .typ files to SVG and serves them in a polished HTML wrapper.
 * e.g., http://localhost:3001/oose/state.typ previews oose/state.typ
 */

import { readdir, watch, mkdtemp, rm, readFile } from "fs/promises";
import { join, dirname } from "path";
import { tmpdir } from "os";

// Parse optional file/directory argument
const fileArg = process.argv[2];

// Catppuccin Frappe palette
const theme = {
  base: "#303446",
  mantle: "#292c3c",
  crust: "#232634",
  text: "#c6d0f5",
  subtext0: "#a5adce",
  subtext1: "#b5bfe2",
  surface0: "#414559",
  surface1: "#51576d",
  surface2: "#626880",
  overlay0: "#737994",
  overlay1: "#838ba7",
  overlay2: "#949cbb",
  blue: "#8caaee",
  lavender: "#babbf1",
  sapphire: "#85c1dc",
  sky: "#99d1db",
  teal: "#81c8be",
  green: "#a6d189",
  yellow: "#e5c890",
  peach: "#ef9f76",
  maroon: "#ea999c",
  red: "#e78284",
  mauve: "#ca9ee6",
  pink: "#f4b8e4",
  flamingo: "#eebebe",
  rosewater: "#f2d5cf",
};

// Collect all .typ files recursively for search
async function collectAllTypFiles(dir: string, prefix: string = ""): Promise<string[]> {
  const results: string[] = [];
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
      const fullPath = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        const nested = await collectAllTypFiles(join(dir, entry.name), fullPath);
        results.push(...nested);
      } else if (entry.name.endsWith(".typ")) {
        results.push(fullPath);
      }
    }
  } catch {}
  return results;
}

// Track connected clients for live reload
const clients = new Set<ReadableStreamDefaultController>();

async function openInBrowser(url: string) {
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

async function compileToSvg(filePath: string): Promise<{ svgs: string[]; error: string | null }> {
  // Create temp directory for output
  const tempDir = await mkdtemp(join(tmpdir(), "typst-preview-"));
  const outputPattern = join(tempDir, "page-{n}.svg");
  
  try {
    const proc = Bun.spawn(["typst", "compile", "--root", ".", filePath, outputPattern, "--format", "svg"], {
      stdout: "pipe",
      stderr: "pipe",
    });

    const stderr = await new Response(proc.stderr).text();
    const exitCode = await proc.exited;

    if (exitCode !== 0) {
      return { svgs: [], error: stderr };
    }

    // Read all generated SVG files
    const entries = await readdir(tempDir);
    const svgFiles = entries
      .filter(f => f.endsWith(".svg"))
      .sort((a, b) => {
        const numA = parseInt(a.match(/\d+/)?.[0] || "0");
        const numB = parseInt(b.match(/\d+/)?.[0] || "0");
        return numA - numB;
      });
    
    const svgs: string[] = [];
    for (const file of svgFiles) {
      const content = await readFile(join(tempDir, file), "utf-8");
      svgs.push(content);
    }
    
    return { svgs, error: null };
  } finally {
    // Cleanup temp directory
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function generateDocumentPage(filePath: string, svgs: string[], error: string | null): string {
  const parentDir = "/" + filePath.split("/").slice(0, -1).join("/");
  const fileName = filePath.split("/").pop() || filePath;
  
  const pagesHtml = error 
    ? `<div class="error">
        <h2>Compile Error</h2>
        <pre>${escapeHtml(error)}</pre>
      </div>`
    : svgs.map((svg, i) => `
        <div class="page" id="page-${i + 1}">
          <div class="page-number">Page ${i + 1}</div>
          ${svg}
        </div>
      `).join("\n");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${fileName} - Typst Preview</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    
    html {
      scroll-behavior: smooth;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: ${theme.crust};
      color: ${theme.text};
      min-height: 100vh;
    }
    
    /* Toolbar */
    .toolbar {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      height: 52px;
      background: ${theme.mantle};
      border-bottom: 1px solid ${theme.surface0};
      display: flex;
      align-items: center;
      padding: 0 20px;
      gap: 16px;
      z-index: 1000;
      backdrop-filter: blur(10px);
    }
    
    .toolbar-left {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    
    .back-btn {
      display: flex;
      align-items: center;
      gap: 6px;
      color: ${theme.text};
      text-decoration: none;
      padding: 8px 14px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      transition: background 0.15s;
    }
    
    .back-btn:hover {
      background: ${theme.surface0};
    }
    
    .file-name {
      color: ${theme.lavender};
      font-size: 15px;
      font-weight: 600;
    }
    
    .search-container {
      flex: 1;
      max-width: 400px;
      position: relative;
      margin: 0 auto;
    }
    
    .search {
      width: 100%;
      padding: 10px 14px;
      border: 1px solid ${theme.surface1};
      border-radius: 8px;
      background: ${theme.surface0};
      color: ${theme.text};
      font-size: 14px;
      outline: none;
      transition: border-color 0.15s, box-shadow 0.15s;
    }
    
    .search:focus {
      border-color: ${theme.blue};
      box-shadow: 0 0 0 3px ${theme.blue}33;
    }
    
    .search::placeholder {
      color: ${theme.overlay0};
    }
    
    .search-results {
      position: absolute;
      top: calc(100% + 6px);
      left: 0;
      right: 0;
      background: ${theme.mantle};
      border: 1px solid ${theme.surface1};
      border-radius: 10px;
      max-height: 350px;
      overflow-y: auto;
      display: none;
      box-shadow: 0 12px 40px rgba(0,0,0,0.4);
    }
    
    .search-results.active {
      display: block;
    }
    
    .search-result {
      padding: 12px 14px;
      cursor: pointer;
      border-bottom: 1px solid ${theme.surface0};
      transition: background 0.1s;
    }
    
    .search-result:last-child {
      border-bottom: none;
    }
    
    .search-result:hover,
    .search-result.selected {
      background: ${theme.surface0};
    }
    
    .search-result .result-name {
      color: ${theme.text};
      font-weight: 500;
    }
    
    .search-result .result-path {
      color: ${theme.subtext0};
      font-size: 12px;
      margin-top: 2px;
    }
    
    .search-result .match {
      color: ${theme.yellow};
      font-weight: 700;
    }
    
    .page-info {
      color: ${theme.subtext0};
      font-size: 13px;
      font-family: monospace;
    }
    
    /* Content */
    .content {
      padding: 72px 24px 40px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 24px;
    }
    
    .page {
      background: white;
      border-radius: 4px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.3), 0 2px 8px rgba(0,0,0,0.2);
      position: relative;
    }
    
    .page svg {
      display: block;
      width: 100%;
      max-width: 1200px;
      height: auto;
      border-radius: 4px;
    }
    
    .page-number {
      position: absolute;
      top: 12px;
      right: 12px;
      background: ${theme.surface0}ee;
      color: ${theme.text};
      font-size: 11px;
      padding: 4px 10px;
      border-radius: 20px;
      font-weight: 500;
      opacity: 0;
      transition: opacity 0.2s;
    }
    
    .page:hover .page-number {
      opacity: 1;
    }
    
    .error {
      background: ${theme.surface0};
      border: 1px solid ${theme.red};
      border-radius: 12px;
      padding: 24px;
      max-width: 800px;
      width: 100%;
    }
    
    .error h2 {
      color: ${theme.red};
      margin-bottom: 16px;
      font-size: 18px;
    }
    
    .error pre {
      color: ${theme.maroon};
      font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
      font-size: 13px;
      line-height: 1.6;
      white-space: pre-wrap;
      word-break: break-word;
    }
    
    /* Keyboard hint */
    .kbd {
      display: inline-block;
      padding: 2px 6px;
      background: ${theme.surface1};
      border-radius: 4px;
      font-family: monospace;
      font-size: 11px;
      color: ${theme.subtext1};
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <div class="toolbar-left">
      <a href="${parentDir || '/'}" class="back-btn">&larr; Back</a>
      <span class="file-name">${fileName}</span>
    </div>
    <div class="search-container">
      <input type="text" class="search" placeholder="Search files... (Ctrl+K)" autocomplete="off">
      <div class="search-results"></div>
    </div>
    <span class="page-info">${error ? 'Error' : `${svgs.length} page${svgs.length !== 1 ? 's' : ''}`}</span>
  </div>
  
  <div class="content">
    ${pagesHtml}
  </div>
  
  <script>
  (function() {
    // Live reload
    const es = new EventSource('/__reload');
    es.onmessage = function(e) {
      if (e.data === 'reload') location.reload();
    };
    es.onerror = function() {
      setTimeout(() => location.reload(), 1000);
    };

    // Fuzzy search
    let allFiles = [];
    let selectedIndex = 0;
    
    fetch('/__files').then(r => r.json()).then(files => {
      allFiles = files;
    });
    
    const searchInput = document.querySelector('.search');
    const resultsContainer = document.querySelector('.search-results');
    
    function fuzzyMatch(pattern, str) {
      pattern = pattern.toLowerCase();
      str = str.toLowerCase();
      let patternIdx = 0;
      let score = 0;
      let lastMatchIdx = -1;
      
      for (let i = 0; i < str.length && patternIdx < pattern.length; i++) {
        if (str[i] === pattern[patternIdx]) {
          score += (lastMatchIdx === i - 1) ? 10 : 1;
          if (i === 0 || str[i-1] === '/' || str[i-1] === '_' || str[i-1] === '-') {
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
    
    function updateResults(query) {
      if (!query) {
        resultsContainer.classList.remove('active');
        return;
      }
      
      const matches = allFiles
        .map(file => ({ file, score: fuzzyMatch(query, file) }))
        .filter(m => m.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);
      
      if (matches.length === 0) {
        resultsContainer.innerHTML = '<div class="search-result"><span class="result-path">No matches found</span></div>';
      } else {
        resultsContainer.innerHTML = matches.map((m, i) => {
          const parts = m.file.split('/');
          const name = parts.pop();
          const path = parts.join('/');
          return \`<div class="search-result\${i === selectedIndex ? ' selected' : ''}" data-path="\${m.file}">
            <div class="result-name">\${highlightMatch(name, query)}</div>
            \${path ? \`<div class="result-path">\${path}</div>\` : ''}
          </div>\`;
        }).join('');
      }
      
      resultsContainer.classList.add('active');
      selectedIndex = 0;
      updateSelection();
    }
    
    function updateSelection() {
      const results = resultsContainer.querySelectorAll('.search-result');
      results.forEach((r, i) => {
        r.classList.toggle('selected', i === selectedIndex);
      });
    }
    
    function navigate(path) {
      window.location.href = '/' + path;
    }
    
    searchInput.addEventListener('input', (e) => {
      updateResults(e.target.value);
    });
    
    searchInput.addEventListener('keydown', (e) => {
      const results = resultsContainer.querySelectorAll('.search-result[data-path]');
      
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        selectedIndex = Math.min(selectedIndex + 1, results.length - 1);
        updateSelection();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        selectedIndex = Math.max(selectedIndex - 1, 0);
        updateSelection();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const selected = results[selectedIndex];
        if (selected) navigate(selected.dataset.path);
      } else if (e.key === 'Escape') {
        searchInput.value = '';
        resultsContainer.classList.remove('active');
        searchInput.blur();
      }
    });
    
    resultsContainer.addEventListener('click', (e) => {
      const result = e.target.closest('.search-result[data-path]');
      if (result) navigate(result.dataset.path);
    });
    
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.search-container')) {
        resultsContainer.classList.remove('active');
      }
    });
    
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        searchInput.focus();
        searchInput.select();
      }
    });
  })();
  </script>
</body>
</html>`;
}

async function listDirectory(dirPath: string): Promise<{ dirs: string[]; files: string[] }> {
  const dirs: string[] = [];
  const files: string[] = [];

  try {
    const entries = await readdir(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;
      if (entry.isDirectory() && entry.name !== "node_modules") {
        dirs.push(entry.name);
      } else if (entry.name.endsWith(".typ")) {
        files.push(entry.name);
      }
    }
  } catch {
    // Directory doesn't exist
  }

  return { dirs: dirs.sort(), files: files.sort() };
}

function generateDirectoryPage(urlPath: string, dirPath: string, dirs: string[], files: string[]): string {
  const parentPath = urlPath === "/" ? null : urlPath.split("/").slice(0, -1).join("/") || "/";

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${dirPath || "/"} - Typst Preview</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: ${theme.base};
      color: ${theme.text};
      min-height: 100vh;
    }
    
    .toolbar {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      height: 52px;
      background: ${theme.mantle};
      border-bottom: 1px solid ${theme.surface0};
      display: flex;
      align-items: center;
      padding: 0 20px;
      gap: 16px;
      z-index: 1000;
    }
    
    .back-btn {
      display: flex;
      align-items: center;
      gap: 6px;
      color: ${theme.text};
      text-decoration: none;
      padding: 8px 14px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      transition: background 0.15s;
    }
    
    .back-btn:hover {
      background: ${theme.surface0};
    }
    
    .search-container {
      flex: 1;
      max-width: 400px;
      position: relative;
      margin: 0 auto;
    }
    
    .search {
      width: 100%;
      padding: 10px 14px;
      border: 1px solid ${theme.surface1};
      border-radius: 8px;
      background: ${theme.surface0};
      color: ${theme.text};
      font-size: 14px;
      outline: none;
      transition: border-color 0.15s, box-shadow 0.15s;
    }
    
    .search:focus {
      border-color: ${theme.blue};
      box-shadow: 0 0 0 3px ${theme.blue}33;
    }
    
    .search::placeholder {
      color: ${theme.overlay0};
    }
    
    .search-results {
      position: absolute;
      top: calc(100% + 6px);
      left: 0;
      right: 0;
      background: ${theme.mantle};
      border: 1px solid ${theme.surface1};
      border-radius: 10px;
      max-height: 350px;
      overflow-y: auto;
      display: none;
      box-shadow: 0 12px 40px rgba(0,0,0,0.4);
    }
    
    .search-results.active {
      display: block;
    }
    
    .search-result {
      padding: 12px 14px;
      cursor: pointer;
      border-bottom: 1px solid ${theme.surface0};
      transition: background 0.1s;
    }
    
    .search-result:last-child {
      border-bottom: none;
    }
    
    .search-result:hover,
    .search-result.selected {
      background: ${theme.surface0};
    }
    
    .search-result .result-name {
      color: ${theme.text};
      font-weight: 500;
    }
    
    .search-result .result-path {
      color: ${theme.subtext0};
      font-size: 12px;
      margin-top: 2px;
    }
    
    .search-result .match {
      color: ${theme.yellow};
      font-weight: 700;
    }
    
    .current-path {
      color: ${theme.subtext0};
      font-size: 13px;
      font-family: monospace;
    }
    
    .content {
      max-width: 700px;
      margin: 0 auto;
      padding: 80px 24px 40px;
    }
    
    h1 { 
      color: ${theme.lavender}; 
      margin-bottom: 8px;
      font-size: 28px;
      font-weight: 600;
    }
    
    .path-display { 
      color: ${theme.subtext0}; 
      margin-bottom: 32px; 
      font-family: 'SF Mono', Monaco, monospace;
      font-size: 14px;
    }
    
    .list { 
      list-style: none;
    }
    
    .list li { 
      border-radius: 10px;
      margin: 6px 0;
      transition: background 0.15s, transform 0.1s;
    }
    
    .list li:hover { 
      background: ${theme.surface0};
      transform: translateX(4px);
    }
    
    .list li a {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 14px 16px;
      color: ${theme.text};
      text-decoration: none;
      font-size: 15px;
    }
    
    .list li a:hover {
      color: ${theme.text};
    }
    
    .icon {
      width: 20px;
      text-align: center;
      font-weight: 600;
    }
    
    .dir .icon { color: ${theme.blue}; }
    .file .icon { color: ${theme.peach}; }
    .parent .icon { color: ${theme.overlay1}; }
    
    .empty { 
      color: ${theme.overlay0}; 
      font-style: italic;
      padding: 20px;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="toolbar">
    ${parentPath !== null ? `<a href="${parentPath}" class="back-btn">&larr; Back</a>` : '<span></span>'}
    <div class="search-container">
      <input type="text" class="search" placeholder="Search files... (Ctrl+K)" autocomplete="off">
      <div class="search-results"></div>
    </div>
    <span class="current-path">${dirPath || "/"}</span>
  </div>

  <div class="content">
    <h1>Typst Preview</h1>
    <div class="path-display">${dirPath || "/"}</div>
    
    <ul class="list">
      ${parentPath !== null ? `<li class="parent"><a href="${parentPath}"><span class="icon">..</span> Parent Directory</a></li>` : ""}
      ${dirs.map(d => `<li class="dir"><a href="${urlPath === "/" ? "" : urlPath}/${d}"><span class="icon">D</span> ${d}</a></li>`).join("\n      ")}
      ${files.map(f => `<li class="file"><a href="${urlPath === "/" ? "" : urlPath}/${f}"><span class="icon">T</span> ${f}</a></li>`).join("\n      ")}
      ${dirs.length === 0 && files.length === 0 ? '<li class="empty">No .typ files found in this directory</li>' : ""}
    </ul>
  </div>
  
  <script>
  (function() {
    let allFiles = [];
    let selectedIndex = 0;
    
    fetch('/__files').then(r => r.json()).then(files => {
      allFiles = files;
    });
    
    const searchInput = document.querySelector('.search');
    const resultsContainer = document.querySelector('.search-results');
    
    function fuzzyMatch(pattern, str) {
      pattern = pattern.toLowerCase();
      str = str.toLowerCase();
      let patternIdx = 0;
      let score = 0;
      let lastMatchIdx = -1;
      
      for (let i = 0; i < str.length && patternIdx < pattern.length; i++) {
        if (str[i] === pattern[patternIdx]) {
          score += (lastMatchIdx === i - 1) ? 10 : 1;
          if (i === 0 || str[i-1] === '/' || str[i-1] === '_' || str[i-1] === '-') {
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
    
    function updateResults(query) {
      if (!query) {
        resultsContainer.classList.remove('active');
        return;
      }
      
      const matches = allFiles
        .map(file => ({ file, score: fuzzyMatch(query, file) }))
        .filter(m => m.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);
      
      if (matches.length === 0) {
        resultsContainer.innerHTML = '<div class="search-result"><span class="result-path">No matches found</span></div>';
      } else {
        resultsContainer.innerHTML = matches.map((m, i) => {
          const parts = m.file.split('/');
          const name = parts.pop();
          const path = parts.join('/');
          return \`<div class="search-result\${i === selectedIndex ? ' selected' : ''}" data-path="\${m.file}">
            <div class="result-name">\${highlightMatch(name, query)}</div>
            \${path ? \`<div class="result-path">\${path}</div>\` : ''}
          </div>\`;
        }).join('');
      }
      
      resultsContainer.classList.add('active');
      selectedIndex = 0;
      updateSelection();
    }
    
    function updateSelection() {
      const results = resultsContainer.querySelectorAll('.search-result');
      results.forEach((r, i) => {
        r.classList.toggle('selected', i === selectedIndex);
      });
    }
    
    function navigate(path) {
      window.location.href = '/' + path;
    }
    
    searchInput.addEventListener('input', (e) => {
      updateResults(e.target.value);
    });
    
    searchInput.addEventListener('keydown', (e) => {
      const results = resultsContainer.querySelectorAll('.search-result[data-path]');
      
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        selectedIndex = Math.min(selectedIndex + 1, results.length - 1);
        updateSelection();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        selectedIndex = Math.max(selectedIndex - 1, 0);
        updateSelection();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const selected = results[selectedIndex];
        if (selected) navigate(selected.dataset.path);
      } else if (e.key === 'Escape') {
        searchInput.value = '';
        resultsContainer.classList.remove('active');
        searchInput.blur();
      }
    });
    
    resultsContainer.addEventListener('click', (e) => {
      const result = e.target.closest('.search-result[data-path]');
      if (result) navigate(result.dataset.path);
    });
    
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.search-container')) {
        resultsContainer.classList.remove('active');
      }
    });
    
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        searchInput.focus();
        searchInput.select();
      }
    });
  })();
  </script>
</body>
</html>`;
}

function normalizePath(pathname: string): string {
  return pathname.replace(/^\/+/, "").replace(/\/+/g, "/");
}

// File watcher for live reload
let currentWatcher: AbortController | null = null;

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
            controller.enqueue(`data: reload\n\n`);
          } catch {
            clients.delete(controller);
          }
        }
      }
    }
  } catch (e: any) {
    if (e.name !== "AbortError") {
      console.error("Watch error:", e);
    }
  }
}

const server = Bun.serve({
  port: 0,
  async fetch(req) {
    const url = new URL(req.url);
    let pathname = url.pathname;

    if (pathname !== "/" && pathname.endsWith("/")) {
      pathname = pathname.slice(0, -1);
    }

    // API: Get all .typ files for search
    if (pathname === "/__files") {
      const files = await collectAllTypFiles(".");
      return Response.json(files);
    }

    // Server-Sent Events for live reload
    if (pathname === "/__reload") {
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
          "Connection": "keep-alive",
        },
      });
    }

    // Root path - show directory listing
    if (pathname === "/" || pathname === "") {
      const { dirs, files } = await listDirectory(".");
      return new Response(generateDirectoryPage("/", "/", dirs, files), {
        headers: { "Content-Type": "text/html" },
      });
    }

    const relativePath = normalizePath(pathname);

    // Check if it's a .typ file
    if (relativePath.endsWith(".typ")) {
      const file = Bun.file(relativePath);
      const exists = await file.exists();

      if (!exists) {
        const parentDir = relativePath.split("/").slice(0, -1).join("/") || ".";
        const parentUrlPath = "/" + parentDir.replace(/^\.$/, "");
        const { dirs, files } = await listDirectory(parentDir);
        return new Response(
          generateDirectoryPage(parentUrlPath, parentDir, dirs, files),
          { headers: { "Content-Type": "text/html" }, status: 404 }
        );
      }

      console.log(`Compiling: ${relativePath}`);
      const { svgs, error } = await compileToSvg(relativePath);
      const html = generateDocumentPage(relativePath, svgs, error);

      watchFile(relativePath);

      return new Response(html, {
        headers: { "Content-Type": "text/html" },
      });
    }

    // Check if it's a directory
    const dirPath = relativePath;
    const { dirs, files } = await listDirectory(dirPath);

    if (dirs.length > 0 || files.length > 0) {
      return new Response(generateDirectoryPage(pathname, dirPath, dirs, files), {
        headers: { "Content-Type": "text/html" },
      });
    }

    // Maybe it's a .typ file without extension?
    const typPath = relativePath + ".typ";
    const typFile = Bun.file(typPath);
    if (await typFile.exists()) {
      console.log(`Compiling: ${typPath}`);
      const { svgs, error } = await compileToSvg(typPath);
      const html = generateDocumentPage(typPath, svgs, error);
      watchFile(typPath);
      return new Response(html, {
        headers: { "Content-Type": "text/html" },
      });
    }

    // Nothing found - show root directory
    const rootListing = await listDirectory(".");
    return new Response(
      generateDirectoryPage("/", "/", rootListing.dirs, rootListing.files),
      { headers: { "Content-Type": "text/html" }, status: 404 }
    );
  },
});

// Build URL with optional file argument
const initialPath = fileArg ? `/${fileArg}` : "/";
const url = `http://localhost:${server.port}${initialPath}`;

console.log(`
Typst SVG Preview Server
========================
Server running at: http://localhost:${server.port}
Opening: ${url}

Press Ctrl+K to search files.
Press Ctrl+C to stop
`);

void openInBrowser(url);
