export const theme = {
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
} as const;

export const sharedCss = `
  :root {
    color-scheme: dark;
  }

  * { box-sizing: border-box; margin: 0; padding: 0; }

  html {
    scroll-behavior: smooth;
  }

  body {
    font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    background: linear-gradient(180deg, ${theme.base} 0%, ${theme.crust} 100%);
    color: ${theme.text};
    min-height: 100vh;
  }

  a {
    color: inherit;
  }

  button,
  input,
  select {
    font: inherit;
  }

  button,
  select {
    border: 0;
  }

  .app-shell {
    min-height: 100vh;
  }

  .toolbar {
    position: sticky;
    top: 0;
    z-index: 1000;
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(260px, 560px) minmax(0, 1fr);
    gap: 16px;
    align-items: center;
    padding: 14px 22px;
    border-bottom: 1px solid ${theme.surface0};
    background: rgba(41, 44, 60, 0.92);
    backdrop-filter: blur(14px);
  }

  .toolbar-section {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 0;
  }

  .toolbar-section.center {
    justify-content: center;
  }

  .toolbar-section.right {
    justify-content: flex-end;
  }

  .brand {
    display: flex;
    align-items: center;
    gap: 12px;
    text-decoration: none;
    min-width: 0;
  }

  .brand-mark {
    width: 12px;
    height: 12px;
    border-radius: 999px;
    background: linear-gradient(135deg, ${theme.blue}, ${theme.mauve});
    box-shadow: 0 0 24px ${theme.blue}66;
    flex-shrink: 0;
  }

  .brand-copy {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .brand-title {
    font-size: 14px;
    font-weight: 700;
    letter-spacing: 0.02em;
    color: ${theme.text};
  }

  .brand-subtitle {
    font-size: 12px;
    color: ${theme.subtext0};
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .pill {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-height: 34px;
    padding: 0 12px;
    border: 1px solid ${theme.surface1};
    border-radius: 999px;
    background: rgba(65, 69, 89, 0.85);
    color: ${theme.subtext1};
    text-decoration: none;
    white-space: nowrap;
  }

  .pill.active {
    border-color: ${theme.blue};
    color: ${theme.text};
    box-shadow: 0 0 0 3px ${theme.blue}22;
  }

  .search {
    width: 100%;
    min-height: 40px;
    padding: 0 14px;
    border: 1px solid ${theme.surface1};
    border-radius: 12px;
    background: rgba(65, 69, 89, 0.85);
    color: ${theme.text};
    outline: none;
    transition: border-color 0.15s, box-shadow 0.15s, background 0.15s;
  }

  .search:focus {
    border-color: ${theme.blue};
    box-shadow: 0 0 0 3px ${theme.blue}22;
    background: rgba(81, 87, 109, 0.9);
  }

  .search::placeholder {
    color: ${theme.overlay0};
  }

  .search-wrap {
    position: relative;
    width: 100%;
  }

  .search-results {
    position: absolute;
    top: calc(100% + 8px);
    left: 0;
    right: 0;
    display: none;
    overflow: hidden;
    border: 1px solid ${theme.surface1};
    border-radius: 14px;
    background: rgba(41, 44, 60, 0.98);
    box-shadow: 0 24px 60px rgba(0, 0, 0, 0.35);
  }

  .search-results.active {
    display: block;
  }

  .search-result {
    padding: 12px 14px;
    cursor: pointer;
    border-bottom: 1px solid ${theme.surface0};
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
    font-weight: 600;
  }

  .search-result .result-path {
    color: ${theme.subtext0};
    font-size: 12px;
    margin-top: 3px;
  }

  .search-result .match {
    color: ${theme.yellow};
  }

  .page-body {
    max-width: 1400px;
    margin: 0 auto;
    padding: 26px 24px 40px;
  }

  .page-body.flush {
    max-width: none;
    padding-top: 20px;
  }

  .hero {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 24px;
  }

  .hero-title {
    font-size: clamp(28px, 5vw, 40px);
    font-weight: 800;
    letter-spacing: -0.03em;
    color: ${theme.rosewater};
  }

  .hero-subtitle {
    margin-top: 8px;
    color: ${theme.subtext0};
    font-size: 14px;
  }

  .meta-row {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }

  .panel {
    border: 1px solid ${theme.surface0};
    border-radius: 18px;
    background: rgba(41, 44, 60, 0.82);
    box-shadow: 0 18px 60px rgba(0, 0, 0, 0.18);
  }

  .panel-header {
    padding: 18px 20px 0;
    color: ${theme.subtext0};
    font-size: 13px;
  }

  .toolbar-control {
    min-height: 34px;
    padding: 0 12px;
    border: 1px solid ${theme.surface1};
    border-radius: 999px;
    background: rgba(65, 69, 89, 0.85);
    color: ${theme.text};
  }

  .empty-state {
    padding: 36px 24px;
    text-align: center;
    color: ${theme.overlay0};
  }

  .kbd {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 24px;
    height: 24px;
    padding: 0 8px;
    border-radius: 8px;
    border: 1px solid ${theme.surface1};
    background: ${theme.surface0};
    color: ${theme.subtext1};
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 12px;
  }

  @media (max-width: 980px) {
    .toolbar {
      grid-template-columns: 1fr;
      gap: 12px;
    }

    .toolbar-section.center,
    .toolbar-section.right {
      justify-content: flex-start;
    }

    .hero {
      flex-direction: column;
      align-items: flex-start;
    }
  }
`;
