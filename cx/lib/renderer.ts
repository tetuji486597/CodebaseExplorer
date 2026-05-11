import type { AnalysisResult } from './analyzer.js';
import type { ScopeResult } from './queryScoper.js';
import { basename } from 'path';

const COLOR_MAP: Record<string, { bg: string; text: string; glow: string }> = {
  teal:   { bg: '#0d9488', text: '#ccfbf1', glow: 'rgba(13,148,136,0.4)' },
  purple: { bg: '#7c3aed', text: '#ede9fe', glow: 'rgba(124,58,237,0.4)' },
  coral:  { bg: '#f43f5e', text: '#ffe4e6', glow: 'rgba(244,63,94,0.4)' },
  blue:   { bg: '#3b82f6', text: '#dbeafe', glow: 'rgba(59,130,246,0.4)' },
  amber:  { bg: '#f59e0b', text: '#fef3c7', glow: 'rgba(245,158,11,0.4)' },
  pink:   { bg: '#ec4899', text: '#fce7f3', glow: 'rgba(236,72,153,0.4)' },
  green:  { bg: '#10b981', text: '#d1fae5', glow: 'rgba(16,185,129,0.4)' },
  gray:   { bg: '#64748b', text: '#e2e8f0', glow: 'rgba(100,116,139,0.4)' },
};

export function renderHTML(
  query: string,
  analysis: AnalysisResult,
  scope: ScopeResult,
  repoDir: string
): string {
  const repoName = basename(repoDir);
  const data = JSON.stringify({
    query,
    repoName,
    concepts: analysis.concepts,
    edges: analysis.edges,
    files: analysis.files,
    summary: analysis.summary,
    suggestedStart: analysis.suggestedStart,
    keywords: scope.keywords,
    matchReasons: scope.matchReasons,
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>cx — ${escapeHTML(query)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
${getStyles()}
</style>
</head>
<body>
<div id="app">
  <header id="header">
    <div class="header-left">
      <span class="logo">cx</span>
      <span class="repo-name">${escapeHTML(repoName)}</span>
    </div>
    <div class="query-display">"${escapeHTML(query)}"</div>
    <div class="file-count">${analysis.files.length} files &middot; ${analysis.concepts.length} concepts</div>
  </header>
  <div id="main">
    <div id="graph-container">
      <canvas id="graph"></canvas>
    </div>
    <aside id="sidebar" class="sidebar-hidden">
      <button id="sidebar-close" aria-label="Close">&times;</button>
      <div id="sidebar-content"></div>
    </aside>
  </div>
  <div id="summary-bar">
    <p>${escapeHTML(analysis.summary)}</p>
  </div>
</div>
<script>
${getScript(data)}
</script>
</body>
</html>`;
}

function escapeHTML(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function getStyles(): string {
  return `
* { margin: 0; padding: 0; box-sizing: border-box; }

:root {
  --bg-base: #0a0a14;
  --bg-surface: #12131f;
  --bg-elevated: #1a1b2e;
  --bg-accent: #232442;
  --border-subtle: rgba(255,255,255,0.06);
  --border-visible: rgba(255,255,255,0.12);
  --text-primary: #e2e8f0;
  --text-secondary: #94a3b8;
  --text-tertiary: #64748b;
  --shadow-soft: 0 4px 24px rgba(0,0,0,0.25);
}

body {
  font-family: 'DM Sans', system-ui, -apple-system, sans-serif;
  background: var(--bg-base);
  color: var(--text-primary);
  height: 100dvh;
  overflow: hidden;
}

#app {
  display: flex;
  flex-direction: column;
  height: 100dvh;
}

#header {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 24px;
  background: var(--bg-surface);
  border-bottom: 1px solid var(--border-subtle);
  flex-shrink: 0;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.logo {
  font-family: 'JetBrains Mono', monospace;
  font-weight: 700;
  font-size: 18px;
  color: #6366f1;
  background: rgba(99,102,241,0.12);
  padding: 4px 10px;
  border-radius: 6px;
}

.repo-name {
  font-family: 'JetBrains Mono', monospace;
  font-size: 14px;
  color: var(--text-secondary);
}

.query-display {
  flex: 1;
  font-size: 15px;
  font-weight: 500;
  color: var(--text-primary);
  text-align: center;
}

.file-count {
  font-size: 13px;
  color: var(--text-tertiary);
  white-space: nowrap;
}

#main {
  flex: 1;
  display: flex;
  position: relative;
  overflow: hidden;
}

#graph-container {
  flex: 1;
  position: relative;
}

#graph {
  width: 100%;
  height: 100%;
  display: block;
}

#sidebar {
  width: 400px;
  background: var(--bg-surface);
  border-left: 1px solid var(--border-subtle);
  box-shadow: -4px 0 24px rgba(0,0,0,0.25);
  overflow-y: auto;
  transition: transform 300ms ease-out;
  position: relative;
  flex-shrink: 0;
}

.sidebar-hidden {
  transform: translateX(100%);
  position: absolute !important;
  right: 0;
  top: 0;
  bottom: 0;
}

#sidebar-close {
  position: absolute;
  top: 12px;
  right: 12px;
  background: none;
  border: none;
  color: var(--text-secondary);
  font-size: 24px;
  cursor: pointer;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  z-index: 1;
}

#sidebar-close:hover {
  background: var(--bg-elevated);
  color: var(--text-primary);
}

#sidebar-content {
  padding: 20px;
}

.concept-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.concept-dot {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  flex-shrink: 0;
}

.concept-title {
  font-size: 18px;
  font-weight: 600;
  line-height: 1.3;
}

.concept-importance {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 2px 8px;
  border-radius: 4px;
  margin-bottom: 12px;
  display: inline-block;
}

.concept-metaphor {
  font-size: 14px;
  color: var(--text-secondary);
  font-style: italic;
  margin-bottom: 16px;
  line-height: 1.6;
  padding: 12px;
  background: var(--bg-elevated);
  border-radius: 8px;
  border-left: 3px solid;
}

.concept-explanation {
  font-size: 14px;
  color: var(--text-primary);
  line-height: 1.7;
  margin-bottom: 20px;
}

.section-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-tertiary);
  margin-bottom: 8px;
}

.file-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 20px;
}

.file-item {
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  color: var(--text-secondary);
  padding: 6px 10px;
  background: var(--bg-elevated);
  border-radius: 6px;
  cursor: default;
  transition: background 150ms;
}

.file-item:hover {
  background: var(--bg-accent);
  color: var(--text-primary);
}

.file-role {
  font-size: 10px;
  color: var(--text-tertiary);
  margin-left: 8px;
}

.edge-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.edge-item {
  font-size: 13px;
  color: var(--text-secondary);
  padding: 8px 12px;
  background: var(--bg-elevated);
  border-radius: 6px;
  line-height: 1.5;
}

.edge-target {
  font-weight: 600;
  color: var(--text-primary);
}

#summary-bar {
  padding: 10px 24px;
  background: var(--bg-surface);
  border-top: 1px solid var(--border-subtle);
  flex-shrink: 0;
}

#summary-bar p {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.5;
  max-height: 40px;
  overflow: hidden;
}

@media (max-width: 768px) {
  #header {
    flex-wrap: wrap;
    padding: 10px 16px;
    gap: 8px;
  }
  .query-display { order: 3; flex-basis: 100%; text-align: left; font-size: 14px; }
  .file-count { font-size: 12px; }
  #sidebar {
    width: 100%;
    position: absolute;
    right: 0; top: 0; bottom: 0;
  }
  .sidebar-hidden { transform: translateX(100%); }
  #summary-bar p { font-size: 12px; }
}
`;
}

function getScript(dataJson: string): string {
  return `
(function() {
  const DATA = ${dataJson};
  const COLORS = ${JSON.stringify(COLOR_MAP)};

  const canvas = document.getElementById('graph');
  const ctx = canvas.getContext('2d');
  const container = document.getElementById('graph-container');
  const sidebar = document.getElementById('sidebar');
  const sidebarContent = document.getElementById('sidebar-content');
  const sidebarClose = document.getElementById('sidebar-close');

  let width, height, dpr;
  let nodes = [];
  let edges = [];
  let selectedNode = null;
  let hoveredNode = null;
  let isDragging = false;
  let dragNode = null;
  let panX = 0, panY = 0;
  let zoom = 1;
  let lastMouse = { x: 0, y: 0 };

  function resize() {
    const rect = container.getBoundingClientRect();
    dpr = window.devicePixelRatio || 1;
    width = rect.width;
    height = rect.height;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function init() {
    resize();

    const conceptMap = {};
    DATA.concepts.forEach((c, i) => {
      const angle = (2 * Math.PI * i) / DATA.concepts.length;
      const radius = Math.min(width, height) * 0.28;
      const fileCount = c.file_ids ? c.file_ids.length : 0;
      const sizeScale = { critical: 1.3, important: 1.0, supporting: 0.75 };
      const baseR = 30 + fileCount * 4;
      const r = baseR * (sizeScale[c.importance] || 1.0);

      const node = {
        id: c.id,
        x: width / 2 + Math.cos(angle) * radius,
        y: height / 2 + Math.sin(angle) * radius,
        vx: 0, vy: 0,
        r: Math.min(56, Math.max(24, r)),
        concept: c,
        color: COLORS[c.color] || COLORS.gray,
      };
      nodes.push(node);
      conceptMap[c.id] = node;
    });

    DATA.edges.forEach(e => {
      const source = conceptMap[e.source];
      const target = conceptMap[e.target];
      if (source && target) {
        edges.push({ source, target, relationship: e.relationship, strength: e.strength });
      }
    });

    // Simple force simulation
    simulate();

    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('dblclick', onDblClick);
    sidebarClose.addEventListener('click', closeSidebar);
    window.addEventListener('resize', () => { resize(); draw(); });

    // Touch support
    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd);

    draw();
  }

  function simulate() {
    const iterations = 120;
    const centerX = width / 2;
    const centerY = height / 2;

    for (let iter = 0; iter < iterations; iter++) {
      const alpha = 1 - iter / iterations;

      // Repulsion between nodes
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i], b = nodes[j];
          let dx = b.x - a.x;
          let dy = b.y - a.y;
          let dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const minDist = (a.r + b.r) * 2.5;
          const force = (alpha * 800) / (dist * dist);
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          a.x -= fx; a.y -= fy;
          b.x += fx; b.y += fy;

          // Prevent overlap
          if (dist < minDist) {
            const overlap = (minDist - dist) / 2;
            a.x -= (dx / dist) * overlap;
            a.y -= (dy / dist) * overlap;
            b.x += (dx / dist) * overlap;
            b.y += (dy / dist) * overlap;
          }
        }
      }

      // Attraction along edges
      edges.forEach(e => {
        const strengthMult = { strong: 0.08, moderate: 0.04, weak: 0.02 };
        const k = (strengthMult[e.strength] || 0.04) * alpha;
        let dx = e.target.x - e.source.x;
        let dy = e.target.y - e.source.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const idealDist = (e.source.r + e.target.r) * 3;
        const force = (dist - idealDist) * k;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        e.source.x += fx; e.source.y += fy;
        e.target.x -= fx; e.target.y -= fy;
      });

      // Center gravity
      nodes.forEach(n => {
        n.x += (centerX - n.x) * 0.01 * alpha;
        n.y += (centerY - n.y) * 0.01 * alpha;
      });
    }
  }

  function draw() {
    ctx.save();
    ctx.clearRect(0, 0, width, height);

    // Background
    ctx.fillStyle = '#0a0a14';
    ctx.fillRect(0, 0, width, height);

    // Subtle grid
    ctx.strokeStyle = 'rgba(255,255,255,0.015)';
    ctx.lineWidth = 1;
    const gridSize = 40 * zoom;
    const offsetX = (panX * zoom) % gridSize;
    const offsetY = (panY * zoom) % gridSize;
    for (let x = offsetX; x < width; x += gridSize) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
    }
    for (let y = offsetY; y < height; y += gridSize) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
    }

    ctx.translate(panX, panY);
    ctx.scale(zoom, zoom);

    // Draw edges
    edges.forEach(e => {
      const isConnected = selectedNode && (e.source === selectedNode || e.target === selectedNode);
      const alpha = selectedNode ? (isConnected ? 0.6 : 0.08) : 0.2;
      const widthMap = { strong: 2.5, moderate: 1.5, weak: 1 };

      ctx.strokeStyle = 'rgba(148,163,184,' + alpha + ')';
      ctx.lineWidth = widthMap[e.strength] || 1.5;

      ctx.beginPath();
      ctx.moveTo(e.source.x, e.source.y);
      ctx.lineTo(e.target.x, e.target.y);
      ctx.stroke();

      // Edge label on hover
      if (isConnected) {
        const mx = (e.source.x + e.target.x) / 2;
        const my = (e.source.y + e.target.y) / 2;
        ctx.font = '11px "DM Sans", sans-serif';
        ctx.fillStyle = 'rgba(148,163,184,0.7)';
        ctx.textAlign = 'center';
        ctx.fillText(e.relationship, mx, my - 6);
      }
    });

    // Draw nodes
    nodes.forEach(n => {
      const isSelected = n === selectedNode;
      const isHovered = n === hoveredNode;
      const isConnected = selectedNode && edges.some(e =>
        (e.source === selectedNode && e.target === n) ||
        (e.target === selectedNode && e.source === n)
      );
      const dimmed = selectedNode && !isSelected && !isConnected;

      const alpha = dimmed ? 0.15 : 1;

      // Glow
      if (isSelected || isHovered) {
        ctx.shadowColor = n.color.glow;
        ctx.shadowBlur = isSelected ? 30 : 20;
      }

      // Circle
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r, 0, 2 * Math.PI);
      ctx.fillStyle = n.color.bg;
      ctx.fill();

      // Border
      if (isSelected) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2.5;
        ctx.stroke();
      } else if (isHovered) {
        ctx.strokeStyle = 'rgba(255,255,255,0.4)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;

      // Label
      ctx.fillStyle = dimmed ? 'rgba(226,232,240,0.2)' : '#e2e8f0';
      ctx.font = (n.r > 35 ? '600 13px' : '600 11px') + ' "DM Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const name = n.concept.name;
      if (name.length > 14 && n.r < 40) {
        const words = name.split(' ');
        const mid = Math.ceil(words.length / 2);
        ctx.fillText(words.slice(0, mid).join(' '), n.x, n.y - 7);
        ctx.fillText(words.slice(mid).join(' '), n.x, n.y + 7);
      } else {
        ctx.fillText(name, n.x, n.y);
      }

      // File count
      const fileCount = n.concept.file_ids ? n.concept.file_ids.length : 0;
      if (fileCount > 0 && !dimmed) {
        ctx.font = '10px "JetBrains Mono", monospace';
        ctx.fillStyle = 'rgba(148,163,184,' + (dimmed ? 0.15 : 0.6) + ')';
        ctx.fillText(fileCount + ' files', n.x, n.y + n.r + 14);
      }

      ctx.globalAlpha = 1;
    });

    ctx.restore();
  }

  function screenToWorld(sx, sy) {
    return { x: (sx - panX) / zoom, y: (sy - panY) / zoom };
  }

  function hitTest(sx, sy) {
    const { x, y } = screenToWorld(sx, sy);
    for (let i = nodes.length - 1; i >= 0; i--) {
      const n = nodes[i];
      const dx = x - n.x, dy = y - n.y;
      if (dx * dx + dy * dy <= (n.r + 6) * (n.r + 6)) return n;
    }
    return null;
  }

  function onMouseMove(e) {
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    if (isDragging && dragNode) {
      const { x, y } = screenToWorld(mx, my);
      dragNode.x = x;
      dragNode.y = y;
      draw();
      return;
    }

    if (isDragging && !dragNode) {
      panX += e.clientX - lastMouse.x;
      panY += e.clientY - lastMouse.y;
      lastMouse = { x: e.clientX, y: e.clientY };
      draw();
      return;
    }

    const hit = hitTest(mx, my);
    if (hit !== hoveredNode) {
      hoveredNode = hit;
      canvas.style.cursor = hit ? 'pointer' : 'grab';
      draw();
    }
  }

  function onMouseDown(e) {
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const hit = hitTest(mx, my);

    isDragging = true;
    lastMouse = { x: e.clientX, y: e.clientY };

    if (hit) {
      dragNode = hit;
      canvas.style.cursor = 'grabbing';
    } else {
      dragNode = null;
      canvas.style.cursor = 'grabbing';
    }
  }

  function onMouseUp(e) {
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    if (dragNode) {
      const hit = hitTest(mx, my);
      if (hit && hit === dragNode) {
        selectNode(hit);
      }
    }

    isDragging = false;
    dragNode = null;
    canvas.style.cursor = hoveredNode ? 'pointer' : 'grab';
  }

  function onWheel(e) {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const oldZoom = zoom;
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    zoom = Math.max(0.2, Math.min(5, zoom * delta));

    panX = mx - (mx - panX) * (zoom / oldZoom);
    panY = my - (my - panY) * (zoom / oldZoom);

    draw();
  }

  function onDblClick(e) {
    // Reset view
    panX = 0; panY = 0; zoom = 1;
    draw();
  }

  // Touch handling
  let touchStartDist = 0;
  let touchStartZoom = 1;

  function onTouchStart(e) {
    e.preventDefault();
    if (e.touches.length === 1) {
      const t = e.touches[0];
      const rect = canvas.getBoundingClientRect();
      const mx = t.clientX - rect.left;
      const my = t.clientY - rect.top;
      const hit = hitTest(mx, my);
      if (hit) {
        selectNode(hit);
      }
      isDragging = true;
      lastMouse = { x: t.clientX, y: t.clientY };
    } else if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      touchStartDist = Math.sqrt(dx * dx + dy * dy);
      touchStartZoom = zoom;
    }
  }

  function onTouchMove(e) {
    e.preventDefault();
    if (e.touches.length === 1 && isDragging) {
      const t = e.touches[0];
      panX += t.clientX - lastMouse.x;
      panY += t.clientY - lastMouse.y;
      lastMouse = { x: t.clientX, y: t.clientY };
      draw();
    } else if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      zoom = Math.max(0.2, Math.min(5, touchStartZoom * (dist / touchStartDist)));
      draw();
    }
  }

  function onTouchEnd() {
    isDragging = false;
  }

  function selectNode(node) {
    if (selectedNode === node) {
      selectedNode = null;
      closeSidebar();
    } else {
      selectedNode = node;
      showSidebar(node);
    }
    draw();
  }

  function showSidebar(node) {
    const c = node.concept;
    const color = node.color;
    const connectedEdges = edges.filter(e => e.source === node || e.target === node);
    const fileAnalyses = DATA.files.filter(f => c.file_ids && c.file_ids.includes(f.path));

    const importanceColors = { critical: '#f43f5e', important: '#f59e0b', supporting: '#64748b' };

    let html = '';
    html += '<div class="concept-header">';
    html += '<div class="concept-dot" style="background:' + color.bg + ';box-shadow:0 0 12px ' + color.glow + '"></div>';
    html += '<div class="concept-title">' + esc(c.name) + '</div>';
    html += '</div>';

    html += '<div class="concept-importance" style="background:' + (importanceColors[c.importance] || '#64748b') + '22;color:' + (importanceColors[c.importance] || '#64748b') + '">' + esc(c.importance) + '</div>';

    if (c.metaphor) {
      html += '<div class="concept-metaphor" style="border-color:' + color.bg + '">' + esc(c.metaphor) + '</div>';
    }

    html += '<div class="concept-explanation">' + esc(c.explanation) + '</div>';

    // Files
    if (fileAnalyses.length > 0) {
      html += '<div class="section-label">Files (' + fileAnalyses.length + ')</div>';
      html += '<div class="file-list">';
      fileAnalyses.forEach(f => {
        html += '<div class="file-item">' + esc(f.path);
        if (f.role && f.role !== 'source') {
          html += '<span class="file-role">' + esc(f.role) + '</span>';
        }
        html += '</div>';
      });
      html += '</div>';
    }

    // Connected concepts
    if (connectedEdges.length > 0) {
      html += '<div class="section-label">Connections</div>';
      html += '<div class="edge-list">';
      connectedEdges.forEach(e => {
        const other = e.source === node ? e.target : e.source;
        const direction = e.source === node ? '→' : '←';
        html += '<div class="edge-item">' + direction + ' <span class="edge-target">' + esc(other.concept.name) + '</span><br>' + esc(e.relationship) + '</div>';
      });
      html += '</div>';
    }

    sidebarContent.innerHTML = html;
    sidebar.classList.remove('sidebar-hidden');
  }

  function closeSidebar() {
    sidebar.classList.add('sidebar-hidden');
    selectedNode = null;
    draw();
  }

  function esc(s) {
    if (!s) return '';
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  init();
})();
`;
}
