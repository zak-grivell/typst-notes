import { existsSync } from "fs";
import { readFile, writeFile } from "fs/promises";
import { openInBrowser } from "../lib/browser.ts";
import { renderPage } from "../lib/html.ts";
import { collectTypFiles, deckNameForFile } from "../lib/project.ts";
import { theme } from "../lib/theme.ts";
import { queryFlashcardsFromFiles, renderMarkupToSvg } from "../lib/typst.ts";

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

type FlashcardSide = "question" | "answer";

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

  const rawCards = await queryFlashcardsFromFiles(files);
  for (const raw of rawCards) {
    const source = raw.source || "";
    const deck = deckNameForFile(source || ".");
    const cards = decks.get(deck) || [];
    cards.push({
      id: raw.id,
      deck,
      source,
      q: raw.q,
      a: raw.a,
    });
    decks.set(deck, cards);
  }

  return decks;
}

function flashcardUrl(card: Flashcard, side: FlashcardSide) {
  return `/flashcard/${card.deck}/${card.id}/${side}`;
}

function srsStyles() {
  return `
    .toolbar {
      display: none;
    }

    .page-body.flush {
      height: 100%;
    }

    .review-panel {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
      overflow: hidden;
      height: 100%;
      border: 0;
      border-radius: 0;
      background: transparent;
      box-shadow: none;
    }

    .srs-controls {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: max(10px, env(safe-area-inset-top)) max(12px, env(safe-area-inset-right)) 10px max(12px, env(safe-area-inset-left));
      flex-wrap: wrap;
      border-bottom: 1px solid ${theme.surface0};
      background: rgba(41, 44, 60, 0.85);
    }

    .srs-controls .toolbar-control {
      min-height: 42px;
      border-radius: 12px;
      padding: 0 14px;
      flex: 1;
      min-width: 180px;
    }

    .srs-meta {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-left: auto;
    }

    .review-stage {
      flex: 1;
      height: 100%;
      min-height: 0;
      display: flex;
      flex-direction: column;
      padding: 0;
      gap: 8px;
    }

    .card-frame {
      flex: 1;
      min-height: 0;
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: auto;
      padding: 8px 10px;
      border-radius: 14px;
      background: rgba(35, 38, 52, 0.72);
      border: 1px solid ${theme.surface0};
      touch-action: manipulation;
      -webkit-overflow-scrolling: touch;
    }

    .card-frame.zoomed {
      align-items: flex-start;
      justify-content: flex-start;
      cursor: grab;
    }

    .card-media-wrap {
      width: 100%;
      min-width: 100%;
      min-height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .card-frame.zoomed .card-media-wrap {
      align-items: flex-start;
      justify-content: flex-start;
    }

    .card-media {
      width: 100%;
      height: 100%;
      display: block;
      object-fit: contain;
      transition: width 0.15s ease;
    }

    .card-frame img {
      width: 100%;
      height: 100%;
      object-fit: contain;
      display: block;
    }

    .card-frame svg {
      width: 100%;
      height: 100%;
      display: block;
    }

    .card-tools {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 0 max(12px, env(safe-area-inset-right)) 2px max(12px, env(safe-area-inset-left));
      flex-wrap: wrap;
    }

    .tool-btn {
      min-height: 40px;
      min-width: 52px;
      border-radius: 10px;
      border: 1px solid ${theme.surface1};
      background: rgba(65, 69, 89, 0.85);
      color: ${theme.text};
      font-size: 14px;
      font-weight: 700;
      padding: 0 12px;
      cursor: pointer;
    }

    .tool-btn:disabled {
      opacity: 0.5;
      cursor: default;
    }

    .tool-status {
      color: ${theme.subtext0};
      min-width: 56px;
      text-align: center;
      font-size: 13px;
      font-weight: 600;
    }

    .action-row {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      flex-shrink: 0;
      gap: 10px;
      padding: 12px max(12px, env(safe-area-inset-right)) calc(12px + env(safe-area-inset-bottom)) max(12px, env(safe-area-inset-left));
    }

    .action-btn {
      min-width: 0;
      min-height: 56px;
      border: none;
      border-radius: 14px;
      cursor: pointer;
      font-weight: 700;
      font-size: 16px;
      padding: 0 12px;
      color: ${theme.crust};
    }

    .action-btn.show {
      grid-column: 1 / -1;
    }

    .action-btn.show { background: ${theme.blue}; }
    .action-btn.again { background: ${theme.red}; }
    .action-btn.hard { background: ${theme.peach}; }
    .action-btn.good { background: ${theme.green}; }
    .action-btn.easy { background: ${theme.sky}; }

    .hint {
      flex-shrink: 0;
      text-align: center;
      color: ${theme.subtext0};
      font-size: 12px;
      padding: 0 max(12px, env(safe-area-inset-right)) 10px max(12px, env(safe-area-inset-left));
    }

    .progress-track {
      flex-shrink: 0;
      height: 10px;
      border-radius: 0;
      background: ${theme.surface0};
      overflow: hidden;
    }

    .progress-fill {
      height: 100%;
      width: 0;
      background: linear-gradient(90deg, ${theme.green}, ${theme.blue});
      transition: width 0.2s ease;
    }

    .srs-empty {
      font-size: 14px;
      color: ${theme.subtext0};
    }

    @media (min-width: 861px) {
      .action-row {
        grid-template-columns: repeat(4, minmax(0, 1fr));
        max-width: 860px;
        width: 100%;
        margin: 0 auto;
      }

      .action-btn.show {
        grid-column: 2 / 4;
      }

      .hint {
        font-size: 13px;
      }
    }

    @media (max-width: 860px) {
      .srs-controls {
        position: sticky;
        top: 0;
        z-index: 20;
      }

      .srs-controls .toolbar-control {
        flex: 1 1 100%;
      }

      .srs-meta {
        margin-left: 0;
      }

      .pill {
        min-height: 38px;
      }

      .hint {
        display: none;
      }
    }
  `;
}

function renderSrsHtml(deckFilter: string | null, showAll: boolean) {
  const allDecksLabel = "All decks";
  const allDecksValue = "__all_decks__";

  return renderPage({
    title: "typst-notes srs",
    styles: srsStyles(),
    toolbarLeft: "",
    body: `<main class="page-body flush">
      <section class="panel review-panel">
        <div class="srs-controls">
          <select class="toolbar-control" id="deck-select"><option>Loading decks...</option></select>
          <div class="srs-meta">
            <span class="pill" id="due-pill">0/0</span>
            <span class="pill">${showAll ? "all" : "due"}</span>
          </div>
        </div>
        <div class="review-stage">
          <div class="progress-track"><div class="progress-fill" id="progress-fill"></div></div>
          <div class="card-frame" id="card-frame"><div class="empty-state">Loading...</div></div>
          <div class="card-tools">
            <button class="tool-btn" id="zoom-out" aria-label="Zoom out">A-</button>
            <button class="tool-btn" id="zoom-reset" aria-label="Reset zoom">Fit</button>
            <button class="tool-btn" id="zoom-in" aria-label="Zoom in">A+</button>
            <span class="tool-status" id="zoom-level">100%</span>
          </div>
          <div class="action-row" id="action-row"></div>
          <div class="hint" id="hint">Tap card or <span class="kbd">Space</span> to reveal · <span class="kbd">1</span> again <span class="kbd">2</span> hard <span class="kbd">3</span> good <span class="kbd">4</span> easy</div>
        </div>
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
      let zoomLevel = 1;
      const MIN_ZOOM = 1;
      const MAX_ZOOM = 2.5;
      const ZOOM_STEP = 0.25;
      const deckSelect = document.getElementById('deck-select');
      const frame = document.getElementById('card-frame');
      const zoomOutBtn = document.getElementById('zoom-out');
      const zoomInBtn = document.getElementById('zoom-in');
      const zoomResetBtn = document.getElementById('zoom-reset');
      const zoomLevelLabel = document.getElementById('zoom-level');
      const preloaded = new Set();

      function clampZoom(value) {
        return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, value));
      }

      function renderZoomUi() {
        zoomLevelLabel.textContent = Math.round(zoomLevel * 100) + '%';
        zoomOutBtn.disabled = zoomLevel <= MIN_ZOOM;
        zoomInBtn.disabled = zoomLevel >= MAX_ZOOM;
        zoomResetBtn.disabled = zoomLevel === 1;
      }

      function applyZoom() {
        const media = frame.querySelector('.card-media');
        if (!media) {
          renderZoomUi();
          return;
        }

        if (zoomLevel <= 1) {
          media.style.width = '100%';
          media.style.height = '100%';
          media.style.maxWidth = '';
          frame.classList.remove('zoomed');
          frame.scrollTop = 0;
          frame.scrollLeft = 0;
        } else {
          media.style.width = (zoomLevel * 100) + '%';
          media.style.height = 'auto';
          media.style.maxWidth = 'none';
          frame.classList.add('zoomed');
        }

        renderZoomUi();
      }

      function setZoom(value) {
        zoomLevel = clampZoom(value);
        applyZoom();
      }

      function renderCard(side) {
        if (!currentCard) {
          return;
        }

        frame.innerHTML = '<div class="card-media-wrap"><img class="card-media" src="/flashcard/' + currentCard.deck + '/' + currentCard.id + '/' + side + '" alt="' + (side === 'question' ? 'Question' : 'Answer') + '"></div>';
        applyZoom();
      }

      function preloadUrl(url) {
        if (!url || preloaded.has(url)) {
          return;
        }

        preloaded.add(url);
        const img = new Image();
        img.src = url;
      }

      function preloadCard(card) {
        if (!card) {
          return;
        }

        preloadUrl('/flashcard/' + card.deck + '/' + card.id + '/question');
        preloadUrl('/flashcard/' + card.deck + '/' + card.id + '/answer');
      }

      function warmUpcomingCards() {
        if (currentCard) {
          preloadUrl('/flashcard/' + currentCard.deck + '/' + currentCard.id + '/answer');
        }

        preloadCard(sessionQueue[sessionIndex + 1]);
      }

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

      function currentDeckCards() {
        if (DECK_FILTER) {
          return dueCards(DECK_FILTER);
        }

        if (currentDeck === '${allDecksValue}') {
          return visibleDeckNames().flatMap((name) => dueCards(name));
        }

        return dueCards(currentDeck);
      }

      function deckLabel(deckName) {
        return deckName === '${allDecksValue}' ? '${allDecksLabel}' : deckName;
      }

      function renderDecks() {
        const names = visibleDeckNames();
        if (names.length === 0) {
          deckSelect.innerHTML = '<option>No decks</option>';
          document.getElementById('card-frame').innerHTML = '<div class="empty-state srs-empty">No flashcards found.</div>';
          document.getElementById('action-row').innerHTML = '';
          return;
        }

        if (!currentDeck || !names.includes(currentDeck)) {
          currentDeck = DECK_FILTER ? names[0] : '${allDecksValue}';
        }

        if (DECK_FILTER) {
          deckSelect.innerHTML = names.map((name) => '<option value="' + name + '">' + name + '</option>').join('');
        } else {
          deckSelect.innerHTML = ['<option value="${allDecksValue}">${allDecksLabel}</option>']
            .concat(names.map((name) => '<option value="' + name + '">' + name + '</option>'))
            .join('');
        }

        deckSelect.value = currentDeck;
        startSession();
      }

      function startSession() {
        sessionQueue = [...currentDeckCards()];
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
        document.title = deckLabel(currentDeck || 'srs') + ' · typst-notes srs';
        document.getElementById('due-pill').textContent = done + '/' + total;
        document.getElementById('progress-fill').style.width = (total === 0 ? 0 : (done / total) * 100) + '%';
      }

      function showCurrentCard() {
        const actions = document.getElementById('action-row');
        updateStats();

        if (!currentDeck || sessionQueue.length === 0 || sessionIndex >= sessionQueue.length) {
          currentCard = null;
          showingAnswer = false;
          frame.innerHTML = '<div class="empty-state srs-empty">Done</div>';
          actions.innerHTML = '';
          renderZoomUi();
          return;
        }

        currentCard = sessionQueue[sessionIndex];
        showingAnswer = false;
        setZoom(1);
        renderCard('question');
        actions.innerHTML = '<button class="action-btn show" id="show-answer">Show Answer</button>';
        document.getElementById('show-answer').addEventListener('click', showAnswer);
        warmUpcomingCards();
      }

      function showAnswer() {
        if (!currentCard) return;
        showingAnswer = true;
        renderCard('answer');
        document.getElementById('action-row').innerHTML = [
          ['again', 'Again', 1],
          ['hard', 'Hard', 3],
          ['good', 'Good', 4],
          ['easy', 'Easy', 5],
        ].map(([kind, label, quality]) => '<button class="action-btn ' + kind + '" data-quality="' + quality + '">' + label + '</button>').join('');
        document.querySelectorAll('[data-quality]').forEach((button) => {
          button.addEventListener('click', () => rateCard(Number(button.dataset.quality)));
        });
        warmUpcomingCards();
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
        } else if (event.key === '+' || event.key === '=') {
          setZoom(zoomLevel + ZOOM_STEP);
        } else if (event.key === '-') {
          setZoom(zoomLevel - ZOOM_STEP);
        } else if (event.key === '0') {
          setZoom(1);
        } else if (showingAnswer) {
          if (event.key === '1') rateCard(1);
          if (event.key === '2') rateCard(3);
          if (event.key === '3') rateCard(4);
          if (event.key === '4') rateCard(5);
        }
      });

      deckSelect.addEventListener('change', () => {
        currentDeck = deckSelect.value;
        startSession();
      });

      frame.addEventListener('click', () => {
        if (!showingAnswer && currentCard) {
          showAnswer();
        }
      });

      zoomOutBtn.addEventListener('click', () => setZoom(zoomLevel - ZOOM_STEP));
      zoomInBtn.addEventListener('click', () => setZoom(zoomLevel + ZOOM_STEP));
      zoomResetBtn.addEventListener('click', () => setZoom(1));

      renderZoomUi();

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

  const svgCache = new Map<string, Promise<string>>();

  function getFlashcardSvg(card: Flashcard, side: FlashcardSide) {
    const key = `${card.id}:${side}`;
    const cached = svgCache.get(key);
    if (cached) {
      return cached;
    }

    const promise = renderMarkupToSvg(side === "question" ? card.q : card.a).catch((error) => {
      svgCache.delete(key);
      throw error;
    });
    svgCache.set(key, promise);
    return promise;
  }

  function preloadFlashcard(card: Flashcard | undefined, side: FlashcardSide) {
    if (!card) {
      return;
    }

    void getFlashcardSvg(card, side);
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
          preloadFlashcard(card, side === "question" ? "answer" : "question");
          const svg = await getFlashcardSvg(card, side as FlashcardSide);
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
