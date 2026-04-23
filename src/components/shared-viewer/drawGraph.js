import { easeOutCubic, parseGlowRGB } from './constants.js';

/**
 * Draw dot-grid background
 */
export function drawBackground(ctx, w, h, panX, panY, zoom) {
  ctx.fillStyle = '#0a0a14';
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = 'rgba(255,255,255,0.04)';
  const gridSize = 40 * zoom;
  if (gridSize < 8) return; // skip at very low zoom
  const offsetX = (panX * zoom) % gridSize;
  const offsetY = (panY * zoom) % gridSize;
  for (let x = offsetX; x < w; x += gridSize) {
    for (let y = offsetY; y < h; y += gridSize) {
      ctx.beginPath();
      ctx.arc(x, y, 0.8, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

/**
 * Draw edges with quadratic curves, entrance animation, and particles
 */
export function drawEdges(ctx, edges, nodes, selectedNode, hoveredNode, entrance, now, particles) {
  const entranceElapsed = entrance.active ? (now - entrance.startTime) : 10000;

  // Build connected set
  const connectedIds = new Set();
  if (selectedNode) {
    connectedIds.add(selectedNode.id);
    edges.forEach(e => {
      if (e.source.id === selectedNode.id) connectedIds.add(e.target.id);
      if (e.target.id === selectedNode.id) connectedIds.add(e.source.id);
    });
  }

  edges.forEach((e, i) => {
    const { source, target } = e;

    // Entrance timing
    const edgeDelay = Math.max(source.entranceDelay || 0, target.entranceDelay || 0) + 200;
    const edgeProgress = entrance.active ? Math.min(1, Math.max(0, (entranceElapsed - edgeDelay) / 400)) : 1;
    if (edgeProgress <= 0) return;

    // Opacity logic
    let opacity = 0.18;
    let useAccentColor = false;
    let accentHex = null;

    if (selectedNode) {
      const isConnected = connectedIds.has(source.id) && connectedIds.has(target.id);
      if (isConnected) {
        opacity = 0.6;
        useAccentColor = true;
        accentHex = source.color.bg;
      } else {
        opacity = 0.04;
      }
    } else if (hoveredNode) {
      if (source.id === hoveredNode.id || target.id === hoveredNode.id) {
        opacity = 0.45;
        useAccentColor = true;
        accentHex = source.color.bg;
      }
    }

    // Quadratic curve control point
    const midX = (source.drawX + target.drawX) / 2;
    const midY = (source.drawY + target.drawY) / 2;
    const dx = target.drawX - source.drawX;
    const dy = target.drawY - source.drawY;
    const cx = midX - dy * 0.1;
    const cy = midY + dx * 0.1;

    // Edge width
    const widthMap = { strong: 2.5, moderate: 1.5, weak: 1 };
    const lw = widthMap[e.strength] || 1.5;

    // Draw edge
    ctx.beginPath();
    if (edgeProgress < 1) {
      const px = source.drawX + (target.drawX - source.drawX) * edgeProgress;
      const py = source.drawY + (target.drawY - source.drawY) * edgeProgress;
      ctx.moveTo(source.drawX, source.drawY);
      if (edgeProgress < 0.5) {
        ctx.lineTo(px, py);
      } else {
        ctx.quadraticCurveTo(cx, cy, px, py);
      }
    } else {
      ctx.moveTo(source.drawX, source.drawY);
      ctx.quadraticCurveTo(cx, cy, target.drawX, target.drawY);
    }

    if (useAccentColor && accentHex) {
      ctx.strokeStyle = accentHex + Math.round(opacity * 255).toString(16).padStart(2, '0');
    } else {
      ctx.strokeStyle = `rgba(148,163,184,${opacity * edgeProgress})`;
    }
    ctx.lineWidth = lw;
    ctx.stroke();

    // Edge label when connected
    if (opacity > 0.3 && edgeProgress >= 1 && e.relationship) {
      ctx.font = '11px "DM Sans", sans-serif';
      if (useAccentColor && accentHex) {
        ctx.fillStyle = accentHex + Math.round(opacity * 0.6 * 255).toString(16).padStart(2, '0');
      } else {
        ctx.fillStyle = `rgba(148,163,184,${opacity * 0.5})`;
      }
      ctx.textAlign = 'center';
      ctx.fillText(e.relationship, cx, cy - 6);
    }

    // Animated particle
    if (opacity > 0.15 && edgeProgress >= 1 && particles[i]) {
      const particle = particles[i];
      particle.offset = (particle.offset + particle.speed * 0.005) % 1;
      const pt = particle.offset;
      // Quadratic bezier interpolation
      const px = (1 - pt) * (1 - pt) * source.drawX + 2 * (1 - pt) * pt * cx + pt * pt * target.drawX;
      const py = (1 - pt) * (1 - pt) * source.drawY + 2 * (1 - pt) * pt * cy + pt * pt * target.drawY;

      ctx.beginPath();
      ctx.arc(px, py, 2.5, 0, Math.PI * 2);
      if (useAccentColor && accentHex) {
        ctx.fillStyle = accentHex + 'cc';
      } else {
        ctx.fillStyle = `rgba(148,163,184,${Math.min(opacity * 0.8, 0.5)})`;
      }
      ctx.fill();
    }
  });
}

/**
 * Draw nodes with entrance animation, radial glows, floating, and selection effects
 */
export function drawNodes(ctx, nodes, edges, selectedNode, hoveredNode, entrance, now, time) {
  const entranceElapsed = entrance.active ? (now - entrance.startTime) : 10000;

  // Build connected set
  const connectedIds = new Set();
  if (selectedNode) {
    connectedIds.add(selectedNode.id);
    edges.forEach(e => {
      if (e.source.id === selectedNode.id) connectedIds.add(e.target.id);
      if (e.target.id === selectedNode.id) connectedIds.add(e.source.id);
    });
  }

  // Hover connected set
  const hoverConnected = new Set();
  if (hoveredNode && !selectedNode) {
    hoverConnected.add(hoveredNode.id);
    edges.forEach(e => {
      if (e.source.id === hoveredNode.id) hoverConnected.add(e.target.id);
      if (e.target.id === hoveredNode.id) hoverConnected.add(e.source.id);
    });
  }

  nodes.forEach(n => {
    const isSelected = selectedNode && n.id === selectedNode.id;
    const isHovered = hoveredNode && n.id === hoveredNode.id;
    const isConnected = selectedNode ? connectedIds.has(n.id) : true;
    const dimmed = selectedNode && !isConnected;

    // Hover dimming
    let hoverDim = 1;
    if (hoveredNode && !selectedNode && !hoverConnected.has(n.id)) {
      hoverDim = 0.35;
    }

    // Entrance scale
    const nodeDelay = n.entranceDelay || 0;
    const nodeProgress = entrance.active ? Math.min(1, Math.max(0, (entranceElapsed - nodeDelay) / 350)) : 1;
    if (nodeProgress <= 0) return;
    const entranceScale = easeOutCubic(nodeProgress);

    const nodeOpacity = dimmed ? 0.15 : 1;
    const r = n.r;
    const displayR = (isSelected ? r * 1.08 : isHovered ? r * 1.05 : r) * entranceScale;

    ctx.save();
    ctx.globalAlpha = nodeOpacity * hoverDim * entranceScale;

    // Radial gradient glow behind node
    const [gr, gg, gb] = parseGlowRGB(n.color.glow);
    const gradient = ctx.createRadialGradient(n.drawX, n.drawY, displayR * 0.5, n.drawX, n.drawY, displayR * 2.2);
    gradient.addColorStop(0, `rgba(${gr},${gg},${gb},0.1)`);
    gradient.addColorStop(1, `rgba(${gr},${gg},${gb},0)`);
    ctx.fillStyle = gradient;
    ctx.fillRect(n.drawX - displayR * 2.2, n.drawY - displayR * 2.2, displayR * 4.4, displayR * 4.4);

    // Selected glow ring + outer glow
    if (isSelected) {
      ctx.beginPath();
      ctx.arc(n.drawX, n.drawY, displayR + 10, 0, Math.PI * 2);
      ctx.strokeStyle = n.color.bg + '40';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      const selGlow = ctx.createRadialGradient(n.drawX, n.drawY, displayR, n.drawX, n.drawY, displayR + 22);
      selGlow.addColorStop(0, n.color.bg + '30');
      selGlow.addColorStop(1, n.color.bg + '00');
      ctx.fillStyle = selGlow;
      ctx.beginPath();
      ctx.arc(n.drawX, n.drawY, displayR + 22, 0, Math.PI * 2);
      ctx.fill();
    }

    // Hover glow ring
    if (isHovered && !isSelected) {
      ctx.beginPath();
      ctx.arc(n.drawX, n.drawY, displayR + 7, 0, Math.PI * 2);
      ctx.strokeStyle = n.color.bg + '35';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Node fill circle
    ctx.beginPath();
    ctx.arc(n.drawX, n.drawY, displayR, 0, Math.PI * 2);
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

    // Label
    ctx.fillStyle = dimmed ? 'rgba(226,232,240,0.2)' : '#e2e8f0';
    ctx.font = (displayR > 35 ? '600 13px' : '600 11px') + ' "DM Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const name = n.concept.name;
    if (name.length > 14 && displayR < 40) {
      const words = name.split(' ');
      const mid = Math.ceil(words.length / 2);
      ctx.fillText(words.slice(0, mid).join(' '), n.drawX, n.drawY - 7);
      ctx.fillText(words.slice(mid).join(' '), n.drawX, n.drawY + 7);
    } else {
      ctx.fillText(name, n.drawX, n.drawY);
    }

    // File count badge
    const fileCount = n.concept.file_ids ? n.concept.file_ids.length : 0;
    if (fileCount > 0 && !dimmed) {
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.fillStyle = `rgba(148,163,184,${dimmed ? 0.15 : 0.6})`;
      ctx.fillText(fileCount + ' files', n.drawX, n.drawY + displayR + 14);
    }

    ctx.restore();
  });
}
