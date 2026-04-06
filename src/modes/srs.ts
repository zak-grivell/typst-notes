import { existsSync } from "fs";
import { readFile, writeFile } from "fs/promises";
import { openInBrowser } from "../lib/browser.ts";
import { escapeHtml, renderBrand, renderPage } from "../lib/html.ts";
import { collectTypFiles, deckNameForFile } from "../lib/project.ts";
import { theme } from "../lib/theme.ts";
import { queryFlashcards, renderMarkupToSvg } from "../lib/typst.ts";

type CardProgress = {
  id: string;
  deck: string;
  easeFactor: number;
  interval: number;
  repetitions: number;
  nextReview: number;
  lastReview: number | null;
};

type ProgressData = {
  cards: Record<string, CardProgress>;
};

type Flashcard = {
  id: string;
  deck: string;
  source: string;
  q: string;
  a: string;
};

const PROGRESS_FILE = ".srs-progress.json";

async function loadProgress(): Promise<ProgressData> {
  if (!existsSync(PROGRESS_FILE)) {
    return { cards: {} };
  }

  return JSON.parse(await readFile(PROGRESS_FILE, "utf-8")) as ProgressData;
}

async function saveProgress(progress: ProgressData) {
  await writeFile(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

function sm2(card: CardProgress, quality: number): CardProgress {
  const next = { ...card };

  if (quality < 3) {
    next.repetitions = 0;
    next.interval = 1;
  } else {
    if (next.repetitions === 0) {
      next.interval = 1;
    } else if (next.repetitions === 1) {
      next.interval = 6;
    } else {
      next.interval = Math.round(next.interval * next.easeFactor);
    }
    next.repetitions += 1;
  }

  next.easeFactor = Math.max(
    1.3,
    next.easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)),
  );
  next.lastReview = Date.now();
  next.nextReview = Date.now() + next.interval * 24 * 60 * 60 * 1000;
  return next;
}

async function discoverFlashcards() {
  const files = await collectTypFiles(".");
  const decks = new Map<string, Flashcard[]>();

  for (const file of files) {
    try {
      const rawCards = await queryFlashcards(file);
      if (rawCards.length === 0) {
        continue;
      }

      const deck = deckNameForFile(file);
      const cards = decks.get(deck) || [];
      for (const raw of rawCards) {
        cards.push({
          id: raw.id,
          deck,
          source: file,
          q: raw.q,
          a: raw.a,
        });
      }
      decks.set(deck, cards);
    } catch {
      // Ignore files without flashcards or invalid query output.
    }
  }

  return decks;
}

function srsStyles() {
  return `
    .srs-layout {
      display: grid;
      grid-template-columns: minmax(220px, 280px) minmax(0, 1fr);
      gap: 20px;
      min-height: calc(100vh - 92px);
    }

    .sidebar,
    .review-panel {
      min-height: 0;
    }

    .sidebar {
      padding: 18px;
    }

    .deck-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin-top: 14px;
    }

    .deck-button {
      width: 100%;
      border: 1px solid ${theme.surface0};
      border-radius: 14px;
      background: rgba(65, 69, 89, 0.65);
      color: ${theme.text};
      text-align: left;
      padding: 12px 14px;
      cursor: pointer;
    }

    .deck-button.active {
      border-color: ${theme.blue};
      box-shadow: 0 0 0 3px ${theme.blue}22;
    }

    .review-panel {
      display: flex;
      flex-direction: column;
      min-height: 0;
      overflow: hidden;
    }

    .review-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      padding: 18px 20px 0;
    }

    .review-stage {
      flex: 1;
      min-height: 0;
      display: flex;
      flex-direction: column;
      padding: 20px;
      gap: 16px;
    }

    .card-frame {
      flex: 1;
      min-height: 320px;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 1px solid ${theme.surface0};
      border-radius: 18px;
      background: rgba(35, 38, 52, 0.9);
      overflow: auto;
      padding: 24px;
    }

    .card-frame img {
      max-width: 100%;
      max-height: 100%;
      display: block;
    }

    .action-row {
      display: flex;
      justify-content: center;
      gap: 10px;
      flex-wrap: wrap;
    }

    .action-btn {
      min-width: 116px;
      min-height: 42px;
      border: none;
      border-radius: 14px;
      cursor: pointer;
      font-weight: 700;
      color: ${theme.crust};
    }

    .action-btn.show { background: ${theme.blue}; }
    .action-btn.again { background: ${theme.red}; }
    .action-btn.hard { background: ${theme.peach}; }
    .action-btn.good { background: ${theme.green}; }
    .action-btn.easy { background: ${theme.sky}; }

    .hint {
      text-align: center;
      color: ${theme.subtext0};
      font-size: 13px;
    }

    .progress-track {
      height: 8px;
      border-radius: 999px;
      background: ${theme.surface0};
      overflow: hidden;
    }

    .progress-fill {
      height: 100%;
      width: 0;
      background: linear-gradient(90deg, ${theme.green}, ${theme.blue});
      transition: width 0.2s ease;
    }

    @media (max-width: 980px) {
      .srs-layout {
        grid-template-columns: 1fr;
      }
    }
  `;
}

function renderSrsHtml(deckFilter: string | null, showAll: boolean) {
  return renderPage({
    title: "typst-notes srs",
    styles: srsStyles(),
    toolbarLeft: renderBrand("srs", deckFilter || "all decks"),
    toolbarCenter: `<span class="pill active">spaced repetition</span>`,
    toolbarRight: `<span class="pill">progress in ${escapeHtml(PROGRESS_FILE)}</span>`,
    body: `<main class="page-body">
      <section class="hero">
        <div>
          <h1 class="hero-title">Spaced Repetition</h1>
          <p class="hero-subtitle">Requires the <code>flashcard(q, a)</code> helper from <code>setup.typ</code>.</p>
        </div>
        <div class="meta-row">
          <span class="pill">${showAll ? "all cards" : "due cards only"}</span>
          ${deckFilter ? `<span class="pill">deck ${escapeHtml(deckFilter)}</span>` : ""}
        </div>
      </section>
      <section class="srs-layout">
        <aside class="panel sidebar">
          <div class="panel-header">Decks</div>
          <div class="deck-list" id="deck-list"></div>
        </aside>
        <section class="panel review-panel">
          <div class="review-header">
            <div>
              <div class="brand-title" id="session-title">Loading decks...</div>
              <div class="brand-subtitle" id="session-meta">Discovering flashcards</div>
            </div>
            <span class="pill" id="due-pill">0 due</span>
          </div>
          <div class="review-stage">
            <div class="progress-track"><div class="progress-fill" id="progress-fill"></div></div>
            <div class="card-frame" id="card-frame"><div class="empty-state">Loading...</div></div>
            <div class="action-row" id="action-row"></div>
            <div class="hint" id="hint">Use <span class="kbd">Space</span> to reveal and <span class="kbd">1</span> <span class="kbd">2</span> <span class="kbd">3</span> <span class="kbd">4</span> to rate.</div>
          </div>
        </section>
      </section>
    </main>`,
    scripts: `
      const DECK_FILTER = ${deckFilter ? JSON.stringify(deckFilter) : "null"};
      const SHOW_ALL = ${showAll ? "true" : "false"};
      let decks = {};
      let progress = { cards: {} };
      let currentDeck = null;
      let currentCard = null;
      let showingAnswer = false;
      let sessionQueue = [];
      let sessionIndex = 0;

      async function loadData() {
        const [decksResponse, progressResponse] = await Promise.all([
          fetch('/api/decks'),
          fetch('/api/progress'),
        ]);
        decks = await decksResponse.json();
        progress = await progressResponse.json();
        renderDecks();
      }

      function visibleDeckNames() {
        const names = Object.keys(decks).sort();
        if (DECK_FILTER && names.includes(DECK_FILTER)) {
          return [DECK_FILTER];
        }
        return names;
      }

      function dueCards(deckName) {
        const cards = decks[deckName] || [];
        const now = Date.now();
        return SHOW_ALL ? cards : cards.filter((card) => {
          const state = progress.cards?.[card.id];
          return !state || state.nextReview <= now;
        });
      }

      function renderDecks() {
        const names = visibleDeckNames();
        const list = document.getElementById('deck-list');
        if (names.length === 0) {
          list.innerHTML = '<div class="empty-state">No flashcards found.</div>';
          document.getElementById('card-frame').innerHTML = '<div class="empty-state">No flashcards were discovered. Make sure your notes use <code>flashcard(q, a)</code> from <code>setup.typ</code>.</div>';
          document.getElementById('action-row').innerHTML = '';
          return;
        }

        list.innerHTML = names.map((name) => {
          const count = dueCards(name).length;
          return '<button class="deck-button ' + (name === currentDeck ? 'active' : '') + '" data-deck="' + name + '">' +
            '<div class="brand-title">' + name + '</div>' +
            '<div class="brand-subtitle">' + count + ' cards ready</div>' +
          '</button>';
        }).join('');

        if (!currentDeck || !names.includes(currentDeck)) {
          currentDeck = names[0];
        }
        bindDeckButtons();
        startSession();
      }

      function bindDeckButtons() {
        document.querySelectorAll('[data-deck]').forEach((button) => {
          button.addEventListener('click', () => {
            currentDeck = button.dataset.deck;
            document.querySelectorAll('[data-deck]').forEach((entry) => entry.classList.toggle('active', entry.dataset.deck === currentDeck));
            startSession();
          });
        });
      }

      function startSession() {
        sessionQueue = [...dueCards(currentDeck)];
        for (let i = sessionQueue.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [sessionQueue[i], sessionQueue[j]] = [sessionQueue[j], sessionQueue[i]];
        }
        sessionIndex = 0;
        showCurrentCard();
        updateStats();
      }

      function updateStats() {
        const total = sessionQueue.length;
        const done = Math.min(sessionIndex, total);
        document.getElementById('session-title').textContent = currentDeck || 'No deck';
        document.getElementById('session-meta').textContent = total === 0 ? 'Nothing due right now' : done + ' of ' + total + ' reviewed this session';
        document.getElementById('due-pill').textContent = dueCards(currentDeck).length + ' due';
        document.getElementById('progress-fill').style.width = (total === 0 ? 0 : (done / total) * 100) + '%';
      }

      function showCurrentCard() {
        const frame = document.getElementById('card-frame');
        const actions = document.getElementById('action-row');
        updateStats();

        if (!currentDeck || sessionQueue.length === 0 || sessionIndex >= sessionQueue.length) {
          currentCard = null;
          showingAnswer = false;
          frame.innerHTML = '<div class="empty-state"><div class="hero-title" style="font-size:28px">Done</div><div class="hero-subtitle">No more cards to review in this deck.</div></div>';
          actions.innerHTML = '';
          return;
        }

        currentCard = sessionQueue[sessionIndex];
        showingAnswer = false;
        frame.innerHTML = '<img src="/flashcard/' + currentCard.deck + '/' + currentCard.id + '/question" alt="Question">';
        actions.innerHTML = '<button class="action-btn show" id="show-answer">Show Answer</button>';
        document.getElementById('show-answer').addEventListener('click', showAnswer);
      }

      function showAnswer() {
        if (!currentCard) return;
        showingAnswer = true;
        document.getElementById('card-frame').innerHTML = '<img src="/flashcard/' + currentCard.deck + '/' + currentCard.id + '/answer" alt="Answer">';
        document.getElementById('action-row').innerHTML = [
          ['again', 'Again', 1],
          ['hard', 'Hard', 3],
          ['good', 'Good', 4],
          ['easy', 'Easy', 5],
        ].map(([kind, label, quality]) => '<button class="action-btn ' + kind + '" data-quality="' + quality + '">' + label + '</button>').join('');
        document.querySelectorAll('[data-quality]').forEach((button) => {
          button.addEventListener('click', () => rateCard(Number(button.dataset.quality)));
        });
      }

      async function rateCard(quality) {
        if (!currentCard) return;
        await fetch('/api/review', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: currentCard.id, deck: currentCard.deck, quality }),
        });
        progress = await (await fetch('/api/progress')).json();
        sessionIndex += 1;
        showCurrentCard();
      }

      document.addEventListener('keydown', (event) => {
        if (event.key === ' ' && !showingAnswer && currentCard) {
          event.preventDefault();
          showAnswer();
        } else if (showingAnswer) {
          if (event.key === '1') rateCard(1);
          if (event.key === '2') rateCard(3);
          if (event.key === '3') rateCard(4);
          if (event.key === '4') rateCard(5);
        }
      });

      loadData();
    `,
  });
}

export function printSrsHelp() {
  console.log(`
typst-notes srs

Usage:
  typst-notes srs [--deck=NAME] [--all] [--port=3000]

Examples:
  typst-notes srs
  typst-notes srs --deck=oose
  typst-notes srs --all
`);
}

function getArg(args: string[], prefix: string): string | undefined {
  return args.find((arg) => arg.startsWith(prefix))?.split("=")[1];
}

export async function startSrsServer(args: string[]) {
  if (args.includes("--help") || args.includes("-h")) {
    printSrsHelp();
    return;
  }

  const port = parseInt(getArg(args, "--port=") || "3000", 10);
  const deckFilter = getArg(args, "--deck=") || null;
  const showAll = args.includes("--all");
  const decks = await discoverFlashcards();
  const progress = await loadProgress();

  if (deckFilter && !decks.has(deckFilter)) {
    console.error(`Deck \"${deckFilter}\" not found.`);
    process.exit(1);
  }

  const cardLookup = new Map<string, Flashcard>();
  for (const [, cards] of decks) {
    for (const card of cards) {
      cardLookup.set(card.id, card);
    }
  }

  const server = Bun.serve({
    port,
    async fetch(req) {
      const url = new URL(req.url);

      if (url.pathname === "/" || url.pathname === "/index.html") {
        return new Response(renderSrsHtml(deckFilter, showAll), {
          headers: { "Content-Type": "text/html" },
        });
      }

      if (url.pathname === "/api/decks") {
        const payload: Record<string, Array<{ id: string; deck: string; source: string }>> = {};
        for (const [deck, cards] of decks) {
          payload[deck] = cards.map((card) => ({ id: card.id, deck: card.deck, source: card.source }));
        }
        return Response.json(payload);
      }

      if (url.pathname === "/api/progress") {
        return Response.json(progress);
      }

      if (url.pathname === "/api/review" && req.method === "POST") {
        const body = await req.json() as { id: string; deck: string; quality: number };
        const current = progress.cards[body.id] || {
          id: body.id,
          deck: body.deck,
          easeFactor: 2.5,
          interval: 0,
          repetitions: 0,
          nextReview: 0,
          lastReview: null,
        };

        progress.cards[body.id] = sm2(current, body.quality);
        await saveProgress(progress);
        return Response.json({ ok: true });
      }

      const match = url.pathname.match(/^\/flashcard\/([^/]+)\/([a-f0-9]+)\/(question|answer)$/);
      if (match) {
        const [, deckName, cardId, side] = match;
        const card = cardLookup.get(cardId);
        if (!card || card.deck !== deckName) {
          return new Response("Not found", { status: 404 });
        }

        try {
          const svg = await renderMarkupToSvg(side === "question" ? card.q : card.a);
          return new Response(svg, {
            headers: { "Content-Type": "image/svg+xml" },
          });
        } catch (error) {
          return new Response(String(error), { status: 500 });
        }
      }

      return new Response("Not found", { status: 404 });
    },
  });

  const url = `http://localhost:${server.port}`;
  console.log(`\nTypst Notes SRS\n===============\nServer running at: ${url}\n\nPress Ctrl+C to stop\n`);
  void openInBrowser(url);
}
