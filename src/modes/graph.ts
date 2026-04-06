import { openInBrowser } from "../lib/browser.ts";
import { renderBrand, renderPage } from "../lib/html.ts";
import { buildProjectGraph } from "../lib/project.ts";
import { theme } from "../lib/theme.ts";

function graphStyles() {
  return `
    .graph-panel {
      position: relative;
      min-height: calc(100vh - 126px);
      overflow: hidden;
    }

    #graph-canvas {
      width: 100%;
      height: 100%;
      display: block;
      cursor: grab;
      background:
        radial-gradient(circle at 20% 20%, ${theme.blue}14 0, transparent 30%),
        radial-gradient(circle at 80% 10%, ${theme.mauve}12 0, transparent 34%),
        linear-gradient(180deg, rgba(35, 38, 52, 0.96), rgba(30, 32, 48, 0.96));
    }

    .graph-search-wrap {
      width: 100%;
    }

    .graph-selection {
      max-width: 320px;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    @media (max-width: 1100px) {
      .graph-panel {
        min-height: 60vh;
      }
    }
  `;
}

function renderGraphHtml() {
  return renderPage({
    title: "typst-notes graph",
    styles: graphStyles(),
    toolbarLeft: renderBrand("graph", "project links"),
    toolbarCenter: `<div class="graph-search-wrap"><input class="search" id="graph-search" placeholder="Focus a note..."></div>`,
    toolbarRight: `<span class="pill" id="node-count">0</span><span class="pill" id="edge-count">0</span><span class="pill graph-selection" id="selection-label">none</span>`,
    body: `<main class="page-body flush">
      <section class="panel graph-panel"><canvas id="graph-canvas"></canvas></section>
    </main>`,
    scripts: `
      const canvas = document.getElementById('graph-canvas');
      const context = canvas.getContext('2d');
      const searchInput = document.getElementById('graph-search');
      const selectionLabel = document.getElementById('selection-label');
      let graph = { nodes: [], edges: [] };
      let state = {
        scale: 1,
        offsetX: 0,
        offsetY: 0,
        dragging: false,
        dragNode: null,
        pointerNode: null,
        selected: null,
        dragStartX: 0,
        dragStartY: 0,
        startOffsetX: 0,
        startOffsetY: 0,
      };

      function resizeCanvas() {
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * devicePixelRatio;
        canvas.height = rect.height * devicePixelRatio;
        context.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
      }

      function worldToScreen(node) {
        return {
          x: node.x * state.scale + state.offsetX,
          y: node.y * state.scale + state.offsetY,
        };
      }

      function screenToWorld(x, y) {
        return {
          x: (x - state.offsetX) / state.scale,
          y: (y - state.offsetY) / state.scale,
        };
      }

      function hitTest(x, y) {
        for (const node of graph.nodes) {
          const point = worldToScreen(node);
          const radius = node.radius * state.scale;
          if (Math.hypot(point.x - x, point.y - y) <= radius + 4) {
            return node;
          }
        }
        return null;
      }

      function updateSelection(node) {
        state.selected = node;
        if (!node) {
          selectionLabel.textContent = 'none';
          return;
        }

        selectionLabel.textContent = node.path + ' · ' + node.degree;
      }

      function draw() {
        const width = canvas.clientWidth;
        const height = canvas.clientHeight;
        context.clearRect(0, 0, width, height);

        context.lineWidth = 1;
        for (const edge of graph.edges) {
          const source = graph.nodes.find((node) => node.id === edge.source);
          const target = graph.nodes.find((node) => node.id === edge.target);
          if (!source || !target) continue;
          const a = worldToScreen(source);
          const b = worldToScreen(target);
          const highlighted = state.selected && (state.selected.id === edge.source || state.selected.id === edge.target);
          context.strokeStyle = highlighted ? '${theme.blue}' : 'rgba(165, 173, 206, 0.18)';
          context.beginPath();
          context.moveTo(a.x, a.y);
          context.lineTo(b.x, b.y);
          context.stroke();
        }

        for (const node of graph.nodes) {
          const point = worldToScreen(node);
          const selected = state.selected && state.selected.id === node.id;
          const hovered = state.pointerNode && state.pointerNode.id === node.id;
          context.fillStyle = selected ? '${theme.peach}' : hovered ? '${theme.blue}' : '${theme.lavender}';
          context.beginPath();
          context.arc(point.x, point.y, node.radius * state.scale, 0, Math.PI * 2);
          context.fill();

          if (state.scale > 0.7 || selected || hovered) {
            context.fillStyle = '${theme.text}';
            context.font = '12px Inter, sans-serif';
            context.fillText(node.label, point.x + 10, point.y - 10);
          }
        }
      }

      function tick() {
        for (const node of graph.nodes) {
          node.vx *= 0.92;
          node.vy *= 0.92;
        }

        for (const edge of graph.edges) {
          const source = graph.nodes.find((node) => node.id === edge.source);
          const target = graph.nodes.find((node) => node.id === edge.target);
          if (!source || !target) continue;
          const dx = target.x - source.x;
          const dy = target.y - source.y;
          const distance = Math.max(1, Math.hypot(dx, dy));
          const force = (distance - 140) * 0.0008;
          const fx = dx * force;
          const fy = dy * force;
          source.vx += fx;
          source.vy += fy;
          target.vx -= fx;
          target.vy -= fy;
        }

        for (let i = 0; i < graph.nodes.length; i++) {
          for (let j = i + 1; j < graph.nodes.length; j++) {
            const a = graph.nodes[i];
            const b = graph.nodes[j];
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const distance = Math.max(1, Math.hypot(dx, dy));
            const repel = 2200 / (distance * distance);
            const fx = dx * repel * 0.01;
            const fy = dy * repel * 0.01;
            a.vx -= fx;
            a.vy -= fy;
            b.vx += fx;
            b.vy += fy;
          }
        }

        for (const node of graph.nodes) {
          if (state.dragging && state.dragNode && state.dragNode.id === node.id) {
            continue;
          }
          node.x += node.vx;
          node.y += node.vy;
        }

        draw();
        requestAnimationFrame(tick);
      }

      async function loadGraph() {
        graph = await (await fetch('/api/graph')).json();
        graph.nodes = graph.nodes.map((node, index) => ({
          ...node,
          x: Math.cos(index) * 180 + (Math.random() - 0.5) * 60,
          y: Math.sin(index) * 180 + (Math.random() - 0.5) * 60,
          vx: 0,
          vy: 0,
          radius: 8 + Math.min(node.degree, 10),
        }));
        document.getElementById('node-count').textContent = graph.nodes.length + ' notes';
        document.getElementById('edge-count').textContent = graph.edges.length + ' links';
        draw();
      }

      canvas.addEventListener('mousemove', (event) => {
        const rect = canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        if (state.dragging && state.dragNode) {
          const world = screenToWorld(x, y);
          state.dragNode.x = world.x;
          state.dragNode.y = world.y;
          state.dragNode.vx = 0;
          state.dragNode.vy = 0;
          return;
        }
        if (state.dragging) {
          state.offsetX = state.startOffsetX + (x - state.dragStartX);
          state.offsetY = state.startOffsetY + (y - state.dragStartY);
          return;
        }
        state.pointerNode = hitTest(x, y);
      });

      canvas.addEventListener('mousedown', (event) => {
        const rect = canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        const node = hitTest(x, y);
        state.dragNode = node;
        updateSelection(node);
        state.dragging = true;
        state.dragStartX = x;
        state.dragStartY = y;
        state.startOffsetX = state.offsetX;
        state.startOffsetY = state.offsetY;
      });

      window.addEventListener('mouseup', () => {
        state.dragging = false;
        state.dragNode = null;
      });

      canvas.addEventListener('mouseleave', () => {
        state.pointerNode = null;
      });

      canvas.addEventListener('wheel', (event) => {
        event.preventDefault();
        const rect = canvas.getBoundingClientRect();
        const mouseX = event.clientX - rect.left;
        const mouseY = event.clientY - rect.top;
        const before = screenToWorld(mouseX, mouseY);
        state.scale = Math.max(0.35, Math.min(2.4, state.scale * (event.deltaY < 0 ? 1.08 : 0.92)));
        const after = screenToWorld(mouseX, mouseY);
        state.offsetX += (after.x - before.x) * state.scale;
        state.offsetY += (after.y - before.y) * state.scale;
      }, { passive: false });

      canvas.addEventListener('click', (event) => {
        const rect = canvas.getBoundingClientRect();
        updateSelection(hitTest(event.clientX - rect.left, event.clientY - rect.top));
      });

      searchInput.addEventListener('input', () => {
        const value = searchInput.value.toLowerCase().trim();
        if (!value) {
          return;
        }
        const match = graph.nodes.find((node) => node.path.toLowerCase().includes(value) || node.label.toLowerCase().includes(value));
        if (match) {
          updateSelection(match);
          state.offsetX = canvas.clientWidth / 2 - match.x * state.scale;
          state.offsetY = canvas.clientHeight / 2 - match.y * state.scale;
        }
      });

      resizeCanvas();
      window.addEventListener('resize', resizeCanvas);
      loadGraph().then(() => requestAnimationFrame(tick));
    `,
  });
}

export function printGraphHelp() {
  console.log(`
typst-notes graph

Usage:
  typst-notes graph [--port=3002]

Examples:
  typst-notes graph
  typst-notes graph --port=4000
`);
}

function getArg(args: string[], prefix: string): string | undefined {
  return args.find((arg) => arg.startsWith(prefix))?.split("=")[1];
}

export async function startGraphServer(args: string[]) {
  if (args.includes("--help") || args.includes("-h")) {
    printGraphHelp();
    return;
  }

  const port = parseInt(getArg(args, "--port=") || "3002", 10);
  const graph = await buildProjectGraph();
  const server = Bun.serve({
    port,
    fetch(req) {
      const url = new URL(req.url);
      if (url.pathname === "/" || url.pathname === "/index.html") {
        return new Response(renderGraphHtml(), {
          headers: { "Content-Type": "text/html" },
        });
      }

      if (url.pathname === "/api/graph") {
        return Response.json(graph);
      }

      return new Response("Not found", { status: 404 });
    },
  });

  const url = `http://localhost:${server.port}`;
  console.log(`\nTypst Notes Graph\n=================\nServer running at: ${url}\n\nPress Ctrl+C to stop\n`);
  void openInBrowser(url);
}
