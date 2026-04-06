import { useRef, useEffect, useState, useCallback } from 'react';
import useStore from '../store/useStore';
import { CONCEPT_COLORS } from '../data/sampleData';
import { createConceptLayout, createFileLayout } from '../utils/graphLayout';
import { drawIcon, getIconForNode } from '../utils/canvasIcons';

const DPR = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1;

// Edge thickness by relationship type
const EDGE_WEIGHTS = {
  'stores data in': 2.5,
  'sends data to': 2.2,
  'writes to': 2.0,
  'reads from': 2.0,
  'triggers': 1.8,
  'depends on': 1.2,
  'uses': 1.0,
};

function getEdgeWeight(label) {
  if (!label) return 1.2;
  const lower = label.toLowerCase();
  for (const [key, weight] of Object.entries(EDGE_WEIGHTS)) {
    if (lower.includes(key)) return weight;
  }
  return 1.2;
}

export default function GraphCanvas() {
  const canvasRef = useRef(null);
  const animFrameRef = useRef(null);
  const nodesRef = useRef([]);
  const linksRef = useRef([]);
  const transformRef = useRef({ x: 0, y: 0, scale: 1 });
  const targetTransformRef = useRef(null); // For smooth zoom animation
  const dragRef = useRef({ isDragging: false, startX: 0, startY: 0, startTX: 0, startTY: 0 });
  const hoverNodeRef = useRef(null);
  const timeRef = useRef(0);
  const sizeRef = useRef({ w: 0, h: 0 });
  const touchRef = useRef({ lastDist: 0 });
  const entranceRef = useRef({ startTime: 0, active: false });
  const particlesRef = useRef([]); // Edge particles for data flow
  const tooltipRef = useRef(null);

  const [tooltip, setTooltip] = useState(null);

  const {
    concepts, files, conceptEdges, fileImports,
    viewMode, selectedNode, setSelectedNode, clearSelection, setShowInspector,
    getFilesByConcept, pulsingNodeId, connectionHighlight, exploredConcepts,
    markConceptExplored,
  } = useStore();

  const [layoutReady, setLayoutReady] = useState(false);

  // Compute layouts
  useEffect(() => {
    if (!concepts.length) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const w = canvas.parentElement.clientWidth;
    const h = canvas.parentElement.clientHeight;
    sizeRef.current = { w, h };

    const conceptLayout = createConceptLayout(concepts, conceptEdges, w, h);

    if (viewMode === 'concepts') {
      nodesRef.current = conceptLayout.nodes.map((n, i) => ({
        ...n,
        type: 'concept',
        fileCount: files.filter(f => f.conceptId === n.id).length,
        floatOffset: Math.random() * Math.PI * 2,
        floatSpeed: 3 + Math.random() * 2,
        entranceDelay: i * 50, // Staggered entrance
      }));
      linksRef.current = conceptLayout.links;
    } else {
      const conceptsWithPositions = conceptLayout.nodes;
      const fileLayout = createFileLayout(files, conceptsWithPositions, fileImports, w, h);
      nodesRef.current = fileLayout.nodes.map((n, i) => ({
        ...n,
        type: 'file',
        floatOffset: Math.random() * Math.PI * 2,
        floatSpeed: 3 + Math.random() * 2,
        entranceDelay: i * 20,
      }));
      linksRef.current = fileLayout.links;
    }

    // Center the view
    transformRef.current = { x: 0, y: 0, scale: 1 };
    targetTransformRef.current = null;

    // Trigger entrance animation
    entranceRef.current = { startTime: performance.now(), active: true };

    // Initialize edge particles
    particlesRef.current = linksRef.current.map(() => ({
      offset: Math.random(),
      speed: 0.3 + Math.random() * 0.4,
    }));

    setLayoutReady(true);
  }, [concepts, files, conceptEdges, fileImports, viewMode]);

  // Zoom to selected node
  useEffect(() => {
    if (!selectedNode || !nodesRef.current.length) return;
    const node = nodesRef.current.find(n => n.id === selectedNode.id);
    if (!node) return;

    const { w, h } = sizeRef.current;
    const targetScale = viewMode === 'concepts' ? 1.2 : 1.5;
    // Offset to the left to account for sidebar
    const offsetX = 150;
    const targetX = w / 2 - node.x * targetScale - offsetX;
    const targetY = h / 2 - node.y * targetScale;

    targetTransformRef.current = {
      x: targetX,
      y: targetY,
      scale: targetScale,
      startTime: performance.now(),
      duration: 400,
      fromX: transformRef.current.x,
      fromY: transformRef.current.y,
      fromScale: transformRef.current.scale,
    };

    // Mark as explored after 3 seconds
    if (selectedNode.type === 'concept') {
      const timer = setTimeout(() => {
        markConceptExplored(selectedNode.id);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [selectedNode, viewMode, markConceptExplored]);

  // Get color for a node
  const getNodeColor = useCallback((node) => {
    if (node.type === 'concept') {
      return CONCEPT_COLORS[node.color] || CONCEPT_COLORS.gray;
    }
    const concept = concepts.find(c => c.id === node.conceptId);
    return CONCEPT_COLORS[concept?.color] || CONCEPT_COLORS.gray;
  }, [concepts]);

  // Easing function
  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

  // Draw function
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const { w, h } = sizeRef.current;
    const time = timeRef.current;
    const now = performance.now();

    // Smooth zoom animation
    if (targetTransformRef.current) {
      const tt = targetTransformRef.current;
      const elapsed = now - tt.startTime;
      const progress = Math.min(1, elapsed / tt.duration);
      const eased = easeOutCubic(progress);

      transformRef.current.x = tt.fromX + (tt.x - tt.fromX) * eased;
      transformRef.current.y = tt.fromY + (tt.y - tt.fromY) * eased;
      transformRef.current.scale = tt.fromScale + (tt.scale - tt.fromScale) * eased;

      if (progress >= 1) targetTransformRef.current = null;
    }

    const t = transformRef.current;

    ctx.clearRect(0, 0, w * DPR, h * DPR);
    ctx.save();
    ctx.scale(DPR, DPR);

    // Background - deep navy
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, w, h);

    // Subtle grid with navy tones
    ctx.strokeStyle = 'rgba(99, 102, 241, 0.03)';
    ctx.lineWidth = 0.5;
    const gridSize = 40 * t.scale;
    const offsetX = (t.x % gridSize);
    const offsetY = (t.y % gridSize);
    for (let x = offsetX; x < w; x += gridSize) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    for (let y = offsetY; y < h; y += gridSize) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }

    ctx.save();
    ctx.translate(t.x, t.y);
    ctx.scale(t.scale, t.scale);

    const nodes = nodesRef.current;
    const links = linksRef.current;
    const selected = selectedNode;
    const entrance = entranceRef.current;
    const entranceElapsed = entrance.active ? (now - entrance.startTime) : 10000;

    // Determine connected node IDs
    const connectedIds = new Set();
    if (selected) {
      connectedIds.add(selected.id);
      links.forEach(l => {
        const sid = typeof l.source === 'object' ? l.source.id : l.source;
        const tid = typeof l.target === 'object' ? l.target.id : l.target;
        if (sid === selected.id) connectedIds.add(tid);
        if (tid === selected.id) connectedIds.add(sid);
      });
    }

    // Draw concept cluster clouds in files view
    if (viewMode === 'files' && concepts.length) {
      concepts.forEach(concept => {
        const conceptFiles = nodes.filter(n => n.conceptId === concept.id);
        if (conceptFiles.length < 2) return;

        const colors = CONCEPT_COLORS[concept.color] || CONCEPT_COLORS.gray;
        const cx = conceptFiles.reduce((s, f) => s + f.x, 0) / conceptFiles.length;
        const cy = conceptFiles.reduce((s, f) => s + f.y, 0) / conceptFiles.length;
        const maxDist = Math.max(...conceptFiles.map(f => Math.hypot(f.x - cx, f.y - cy))) + 30;

        ctx.beginPath();
        ctx.arc(cx, cy, maxDist, 0, Math.PI * 2);
        ctx.strokeStyle = colors.accent + '18';
        ctx.setLineDash([4, 4]);
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = colors.accent + '06';
        ctx.fill();
      });
    }

    // Draw edges
    links.forEach((link, li) => {
      const source = typeof link.source === 'object' ? link.source : nodes.find(n => n.id === link.source);
      const target = typeof link.target === 'object' ? link.target : nodes.find(n => n.id === link.target);
      if (!source || !target) return;

      // Entrance animation for edges
      const edgeDelay = Math.max(source.entranceDelay || 0, target.entranceDelay || 0) + 200;
      const edgeProgress = entrance.active ? Math.min(1, Math.max(0, (entranceElapsed - edgeDelay) / 400)) : 1;
      if (edgeProgress <= 0) return;

      let opacity = 0.18;
      let edgeColor = 'rgba(148, 163, 184,'; // slate
      const edgeWeight = getEdgeWeight(link.label);

      if (selected) {
        const sid = source.id;
        const tid = target.id;
        if (connectedIds.has(sid) && connectedIds.has(tid)) {
          opacity = 0.7;
          const sourceNode = nodes.find(n => n.id === sid);
          const colors = getNodeColor(sourceNode || source);
          edgeColor = colors.accent ? `${colors.accent}` : 'rgba(148, 163, 184,';
        } else {
          opacity = 0.04;
        }
      }

      // Hovered node edge highlight
      const hovered = hoverNodeRef.current;
      if (hovered && !selected) {
        const sid = source.id;
        const tid = target.id;
        if (sid === hovered || tid === hovered) {
          opacity = 0.5;
          const hoverNode = nodes.find(n => n.id === hovered);
          const colors = getNodeColor(hoverNode || source);
          edgeColor = colors.accent || 'rgba(148, 163, 184,';
        }
      }

      const midX = (source.x + target.x) / 2;
      const midY = (source.y + target.y) / 2;
      const dx = target.x - source.x;
      const dy = target.y - source.y;
      const cx2 = midX - dy * 0.1;
      const cy2 = midY + dx * 0.1;

      ctx.beginPath();
      if (edgeProgress < 1) {
        // Animate edge drawing in
        const px = source.x + (cx2 - source.x) * edgeProgress * 2;
        const py = source.y + (cy2 - source.y) * edgeProgress * 2;
        ctx.moveTo(source.x, source.y);
        if (edgeProgress < 0.5) {
          ctx.lineTo(px, py);
        } else {
          ctx.quadraticCurveTo(cx2, cy2, source.x + (target.x - source.x) * edgeProgress, source.y + (target.y - source.y) * edgeProgress);
        }
      } else {
        ctx.moveTo(source.x, source.y);
        ctx.quadraticCurveTo(cx2, cy2, target.x, target.y);
      }

      // Use accent color for highlighted edges
      if (typeof edgeColor === 'string' && !edgeColor.startsWith('rgba')) {
        ctx.strokeStyle = edgeColor + Math.round(opacity * 255).toString(16).padStart(2, '0');
      } else {
        ctx.strokeStyle = `rgba(148, 163, 184, ${opacity})`;
      }
      ctx.lineWidth = viewMode === 'concepts' ? edgeWeight : 0.8;
      ctx.stroke();

      // Animated particles for data flow on active edges
      if (viewMode === 'concepts' && opacity > 0.3 && edgeProgress >= 1) {
        const particle = particlesRef.current[li];
        if (particle) {
          particle.offset = (particle.offset + particle.speed * 0.005) % 1;
          const pt = particle.offset;
          // Quadratic bezier point
          const px = (1 - pt) * (1 - pt) * source.x + 2 * (1 - pt) * pt * cx2 + pt * pt * target.x;
          const py = (1 - pt) * (1 - pt) * source.y + 2 * (1 - pt) * pt * cy2 + pt * pt * target.y;
          ctx.beginPath();
          ctx.arc(px, py, 2.5, 0, Math.PI * 2);
          if (typeof edgeColor === 'string' && !edgeColor.startsWith('rgba')) {
            ctx.fillStyle = edgeColor + 'cc';
          } else {
            ctx.fillStyle = `rgba(148, 163, 184, ${opacity * 0.8})`;
          }
          ctx.fill();
        }
      }

      // Edge label for concept view
      if (viewMode === 'concepts' && link.label && opacity > 0.1 && t.scale > 0.6 && edgeProgress >= 1) {
        ctx.save();
        if (typeof edgeColor === 'string' && !edgeColor.startsWith('rgba')) {
          ctx.fillStyle = edgeColor + Math.round(opacity * 0.6 * 255).toString(16).padStart(2, '0');
        } else {
          ctx.fillStyle = `rgba(148, 163, 184, ${opacity * 0.5})`;
        }
        ctx.font = `500 ${9 / Math.max(t.scale, 0.5)}px 'Inter', sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(link.label, cx2, cy2 - 6);
        ctx.restore();
      }
    });

    // Draw nodes
    nodes.forEach(node => {
      const colors = getNodeColor(node);
      const isSelected = selected?.id === node.id;
      const isConnected = selected ? connectedIds.has(node.id) : true;
      const isHovered = hoverNodeRef.current === node.id;
      const isPulsing = useStore.getState().pulsingNodeId === node.id;
      const isExplored = node.type === 'concept' && useStore.getState().exploredConcepts.has(node.id);

      // Entrance animation
      const nodeDelay = node.entranceDelay || 0;
      const nodeProgress = entrance.active ? Math.min(1, Math.max(0, (entranceElapsed - nodeDelay) / 350)) : 1;
      if (nodeProgress <= 0) return;
      const entranceScale = easeOutCubic(nodeProgress);

      // Float animation
      const floatY = Math.sin(time / 1000 * (2 * Math.PI / node.floatSpeed) + node.floatOffset) * 3;
      const drawX = node.x;
      const drawY = node.y + floatY;

      const guidedMode = useStore.getState().guidedMode;
      const nodeOpacity = selected && !isConnected ? (guidedMode ? 0.06 : 0.15) : 1;

      // Hover dimming for non-connected when hovering
      const hovered = hoverNodeRef.current;
      let hoverDim = 1;
      if (hovered && !selected) {
        const hoverConnected = new Set([hovered]);
        links.forEach(l => {
          const sid = typeof l.source === 'object' ? l.source.id : l.source;
          const tid = typeof l.target === 'object' ? l.target.id : l.target;
          if (sid === hovered) hoverConnected.add(tid);
          if (tid === hovered) hoverConnected.add(sid);
        });
        if (!hoverConnected.has(node.id)) hoverDim = 0.35;
      }

      ctx.save();
      ctx.globalAlpha = nodeOpacity * hoverDim * entranceScale;

      if (node.type === 'concept') {
        const r = node.radius || 45;
        const displayR = (isSelected ? r * 1.08 : isHovered ? r * 1.05 : r) * entranceScale;

        // Radial gradient glow behind node
        const gradient = ctx.createRadialGradient(drawX, drawY, displayR * 0.5, drawX, drawY, displayR * 2);
        gradient.addColorStop(0, (colors.accent || colors.stroke) + '15');
        gradient.addColorStop(1, (colors.accent || colors.stroke) + '00');
        ctx.fillStyle = gradient;
        ctx.fillRect(drawX - displayR * 2, drawY - displayR * 2, displayR * 4, displayR * 4);

        // Selected glow ring
        if (isSelected) {
          ctx.beginPath();
          ctx.arc(drawX, drawY, displayR + 12, 0, Math.PI * 2);
          ctx.strokeStyle = (colors.accent || colors.stroke) + '40';
          ctx.lineWidth = 3;
          ctx.stroke();

          // Outer glow
          const selGlow = ctx.createRadialGradient(drawX, drawY, displayR, drawX, drawY, displayR + 25);
          selGlow.addColorStop(0, (colors.accent || colors.stroke) + '30');
          selGlow.addColorStop(1, (colors.accent || colors.stroke) + '00');
          ctx.fillStyle = selGlow;
          ctx.beginPath();
          ctx.arc(drawX, drawY, displayR + 25, 0, Math.PI * 2);
          ctx.fill();
        }

        // Hover glow ring
        if (isHovered && !isSelected) {
          ctx.beginPath();
          ctx.arc(drawX, drawY, displayR + 8, 0, Math.PI * 2);
          ctx.strokeStyle = (colors.accent || colors.stroke) + '35';
          ctx.lineWidth = 2;
          ctx.stroke();
        }

        // Pulsing effect
        if (isPulsing && !isSelected) {
          const pulseSize = 6 + Math.sin(time / 500) * 4;
          const pulseAlpha = Math.floor(25 + Math.sin(time / 500) * 15).toString(16).padStart(2, '0');
          ctx.beginPath();
          ctx.arc(drawX, drawY, displayR + pulseSize, 0, Math.PI * 2);
          ctx.fillStyle = (colors.accent || colors.stroke) + pulseAlpha;
          ctx.fill();
        }

        // Node fill
        ctx.beginPath();
        ctx.arc(drawX, drawY, displayR, 0, Math.PI * 2);
        ctx.fillStyle = colors.fill;
        ctx.fill();

        // Colored ring (accent color)
        ctx.strokeStyle = colors.accent || colors.stroke;
        ctx.lineWidth = isSelected ? 3 : isHovered ? 2.5 : 2;
        ctx.stroke();

        // Icon instead of emoji
        const iconName = getIconForNode(node);
        const iconSize = displayR * 0.65;
        drawIcon(ctx, iconName, drawX, drawY - 2, iconSize, colors.text);

        // Label below with better spacing
        ctx.font = `600 ${Math.max(11, Math.round(displayR * 0.28))}px 'Inter', sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillStyle = colors.text;
        ctx.fillText(node.name, drawX, drawY + displayR + 18);

        // File count badge
        if (node.fileCount) {
          const badgeText = `${node.fileCount} files`;
          ctx.font = `400 ${Math.max(9, Math.round(displayR * 0.2))}px 'Inter', sans-serif`;
          ctx.fillStyle = '#94a3b8';
          ctx.fillText(badgeText, drawX, drawY + displayR + 32);
        }

        // Explored checkmark badge
        if (isExplored) {
          const badgeX = drawX + displayR * 0.65;
          const badgeY = drawY - displayR * 0.65;
          const badgeR = 9;
          ctx.beginPath();
          ctx.arc(badgeX, badgeY, badgeR, 0, Math.PI * 2);
          ctx.fillStyle = '#10b981';
          ctx.fill();
          // Checkmark
          ctx.beginPath();
          ctx.moveTo(badgeX - 4, badgeY);
          ctx.lineTo(badgeX - 1, badgeY + 3);
          ctx.lineTo(badgeX + 4, badgeY - 3);
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 1.8;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.stroke();
        }
      } else {
        // File node
        const r = node.radius || 8;
        const displayR = (isSelected ? r * 1.2 : isHovered ? r * 1.1 : r) * entranceScale;

        if (isSelected) {
          ctx.beginPath();
          ctx.arc(drawX, drawY, displayR + 4, 0, Math.PI * 2);
          ctx.fillStyle = (colors.accent || colors.stroke) + '25';
          ctx.fill();
        }

        ctx.beginPath();
        ctx.arc(drawX, drawY, displayR, 0, Math.PI * 2);
        ctx.fillStyle = colors.fill;
        ctx.fill();
        ctx.strokeStyle = colors.accent || colors.stroke;
        ctx.lineWidth = isSelected ? 2 : 1;
        ctx.stroke();

        // File name label
        if (t.scale > 0.7 || isSelected || isHovered) {
          ctx.font = `400 ${Math.max(8, 10 / Math.max(t.scale, 0.5))}px 'JetBrains Mono', monospace`;
          ctx.textAlign = 'center';
          ctx.fillStyle = isSelected || isHovered ? colors.text : '#94a3b8';
          ctx.fillText(node.name, drawX, drawY + displayR + 12);
        }
      }

      ctx.restore();
    });

    ctx.restore();
    ctx.restore();

    // Disable entrance after all nodes have appeared
    if (entrance.active && entranceElapsed > 2000) {
      entranceRef.current.active = false;
    }

    timeRef.current += 16;
    animFrameRef.current = requestAnimationFrame(draw);
  }, [concepts, viewMode, selectedNode, getNodeColor, easeOutCubic]);

  // Start animation loop
  useEffect(() => {
    if (!layoutReady) return;
    animFrameRef.current = requestAnimationFrame(draw);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [draw, layoutReady]);

  // Resize handler
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const parent = canvas.parentElement;
      const w = parent.clientWidth;
      const h = parent.clientHeight;
      canvas.width = w * DPR;
      canvas.height = h * DPR;
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      sizeRef.current = { w, h };
    };

    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  // Hit testing
  const hitTest = useCallback((clientX, clientY) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const t = transformRef.current;

    const canvasX = (clientX - rect.left - t.x) / t.scale;
    const canvasY = (clientY - rect.top - t.y) / t.scale;

    for (let i = nodesRef.current.length - 1; i >= 0; i--) {
      const node = nodesRef.current[i];
      const r = node.radius || (node.type === 'concept' ? 45 : 8);
      const hitR = r + 8;
      if (Math.hypot(canvasX - node.x, canvasY - node.y) < hitR) {
        return node;
      }
    }
    return null;
  }, []);

  // Tooltip management
  const updateTooltip = useCallback((node, clientX, clientY) => {
    if (node && node.type === 'concept') {
      setTooltip({
        x: clientX,
        y: clientY,
        name: node.name,
        summary: node.description ? node.description.split('.')[0] + '.' : '',
        importance: node.importance,
      });
    } else {
      setTooltip(null);
    }
  }, []);

  // Mouse/touch handlers
  const handlePointerDown = useCallback((e) => {
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    if (e.touches && e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      touchRef.current.lastDist = Math.hypot(dx, dy);
      return;
    }

    dragRef.current = {
      isDragging: true,
      startX: clientX,
      startY: clientY,
      startTX: transformRef.current.x,
      startTY: transformRef.current.y,
      moved: false,
    };
  }, []);

  const handlePointerMove = useCallback((e) => {
    if (e.touches && e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      const scale = dist / touchRef.current.lastDist;
      transformRef.current.scale = Math.max(0.2, Math.min(3, transformRef.current.scale * scale));
      touchRef.current.lastDist = dist;
      return;
    }

    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    if (dragRef.current.isDragging) {
      const dx = clientX - dragRef.current.startX;
      const dy = clientY - dragRef.current.startY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) dragRef.current.moved = true;
      transformRef.current.x = dragRef.current.startTX + dx;
      transformRef.current.y = dragRef.current.startTY + dy;
      setTooltip(null);
    } else {
      // Hover detection (mouse only)
      if (!e.touches) {
        const hit = hitTest(clientX, clientY);
        const canvas = canvasRef.current;
        if (hit) {
          canvas.style.cursor = 'pointer';
          hoverNodeRef.current = hit.id;
          updateTooltip(hit, clientX, clientY);
        } else {
          canvas.style.cursor = 'grab';
          hoverNodeRef.current = null;
          setTooltip(null);
        }
      }
    }
  }, [hitTest, updateTooltip]);

  const handlePointerUp = useCallback((e) => {
    if (!dragRef.current.isDragging) return;

    if (!dragRef.current.moved) {
      const clientX = e.changedTouches ? e.changedTouches[0].clientX : e.clientX;
      const clientY = e.changedTouches ? e.changedTouches[0].clientY : e.clientY;
      const hit = hitTest(clientX, clientY);

      if (hit) {
        setSelectedNode({ type: hit.type, id: hit.id });
        setShowInspector(true);
      } else {
        clearSelection();
        setShowInspector(false);
        targetTransformRef.current = null;
      }
    }

    dragRef.current.isDragging = false;
  }, [hitTest, setSelectedNode, clearSelection, setShowInspector]);

  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const zoom = e.deltaY < 0 ? 1.08 : 0.92;
    const newScale = Math.max(0.2, Math.min(3, transformRef.current.scale * zoom));
    const ratio = newScale / transformRef.current.scale;

    transformRef.current.x = mouseX - ratio * (mouseX - transformRef.current.x);
    transformRef.current.y = mouseY - ratio * (mouseY - transformRef.current.y);
    transformRef.current.scale = newScale;
  }, []);

  // Keyboard handler
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') {
        clearSelection();
        setShowInspector(false);
        targetTransformRef.current = null;
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [clearSelection, setShowInspector]);

  return (
    <>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ touchAction: 'none' }}
        onMouseDown={handlePointerDown}
        onMouseMove={handlePointerMove}
        onMouseUp={handlePointerUp}
        onMouseLeave={() => { dragRef.current.isDragging = false; hoverNodeRef.current = null; setTooltip(null); }}
        onTouchStart={handlePointerDown}
        onTouchMove={handlePointerMove}
        onTouchEnd={handlePointerUp}
        onWheel={handleWheel}
      />
      {/* Tooltip overlay */}
      {tooltip && (
        <div
          className="fixed pointer-events-none z-50"
          style={{
            left: tooltip.x + 16,
            top: tooltip.y - 8,
            animation: 'fade-in 0.15s ease-out',
          }}
        >
          <div style={{
            background: '#1e1e3a',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '10px',
            padding: '10px 14px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            maxWidth: '260px',
          }}>
            <div style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '13px',
              fontWeight: 600,
              color: '#e2e8f0',
              marginBottom: '4px',
            }}>
              {tooltip.name}
            </div>
            {tooltip.summary && (
              <div style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '11px',
                color: '#94a3b8',
                lineHeight: 1.5,
              }}>
                {tooltip.summary}
              </div>
            )}
            {tooltip.importance && (
              <div style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '10px',
                color: tooltip.importance === 'critical' ? '#ef4444' : tooltip.importance === 'important' ? '#f59e0b' : '#94a3b8',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginTop: '4px',
              }}>
                {tooltip.importance}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
