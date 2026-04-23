import { useRef, useState, useCallback, useEffect } from 'react';
import { COLOR_MAP, easeOutCubic } from './constants.js';
import { drawBackground, drawEdges, drawNodes } from './drawGraph.js';

const DPR = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1;

/**
 * Custom hook for the shared viewer's canvas graph.
 * Manages the RAF loop, physics layout, interactions, and animation state.
 */
export default function useSharedGraph(data) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const nodesRef = useRef([]);
  const edgesRef = useRef([]);
  const transformRef = useRef({ x: 0, y: 0, scale: 1 });
  const targetTransformRef = useRef(null);
  const dragRef = useRef({ isDragging: false, startX: 0, startY: 0, startTX: 0, startTY: 0, moved: false });
  const hoverNodeRef = useRef(null);
  const timeRef = useRef(0);
  const sizeRef = useRef({ w: 0, h: 0 });
  const touchRef = useRef({ lastDist: 0 });
  const entranceRef = useRef({ startTime: 0, active: false });
  const particlesRef = useRef([]);
  const animFrameRef = useRef(null);

  const [selectedNode, setSelectedNode] = useState(null);
  const [tooltip, setTooltip] = useState(null);

  // --- Layout & Initialization ---

  const initLayout = useCallback(() => {
    if (!data || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    sizeRef.current = { w, h };

    // Resize canvas
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.width = w * DPR;
      canvas.height = h * DPR;
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
    }

    // Build nodes
    const nodes = [];
    const conceptMap = {};
    data.concepts.forEach((c, i) => {
      const angle = (2 * Math.PI * i) / data.concepts.length;
      const radius = Math.min(w, h) * 0.28;
      const fileCount = c.file_ids ? c.file_ids.length : 0;
      const sizeScale = { critical: 1.3, important: 1.0, supporting: 0.75 };
      const baseR = 30 + fileCount * 4;
      const r = baseR * (sizeScale[c.importance] || 1.0);

      const node = {
        id: c.id,
        x: w / 2 + Math.cos(angle) * radius,
        y: h / 2 + Math.sin(angle) * radius,
        drawX: 0, drawY: 0, // set each frame
        r: Math.min(56, Math.max(24, r)),
        concept: c,
        color: COLOR_MAP[c.color] || COLOR_MAP.gray,
        floatOffset: Math.random() * Math.PI * 2,
        floatSpeed: 3 + Math.random() * 2,
        entranceDelay: i * 50,
      };
      nodes.push(node);
      conceptMap[c.id] = node;
    });

    // Build edges
    const edges = [];
    data.edges.forEach(e => {
      const source = conceptMap[e.source];
      const target = conceptMap[e.target];
      if (source && target) {
        edges.push({ source, target, relationship: e.relationship, strength: e.strength });
      }
    });

    // Force simulation
    simulate(nodes, edges, w, h);

    nodesRef.current = nodes;
    edgesRef.current = edges;

    // Init particles
    particlesRef.current = edges.map(() => ({
      offset: Math.random(),
      speed: 0.3 + Math.random() * 0.4,
    }));

    // Reset transform
    transformRef.current = { x: 0, y: 0, scale: 1 };
    targetTransformRef.current = null;

    // Trigger entrance
    entranceRef.current = { startTime: performance.now(), active: true };
  }, [data]);

  // --- Force Simulation ---

  function simulate(nodes, edges, w, h) {
    const iterations = 120;
    const centerX = w / 2;
    const centerY = h / 2;

    for (let iter = 0; iter < iterations; iter++) {
      const alpha = 1 - iter / iterations;

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

          if (dist < minDist) {
            const overlap = (minDist - dist) / 2;
            a.x -= (dx / dist) * overlap;
            a.y -= (dy / dist) * overlap;
            b.x += (dx / dist) * overlap;
            b.y += (dy / dist) * overlap;
          }
        }
      }

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

      nodes.forEach(n => {
        n.x += (centerX - n.x) * 0.01 * alpha;
        n.y += (centerY - n.y) * 0.01 * alpha;
      });
    }
  }

  // --- Draw Loop ---

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const { w, h } = sizeRef.current;
    const now = performance.now();
    const time = timeRef.current;

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

    // Background
    drawBackground(ctx, w, h, t.x, t.y, t.scale);

    // Transform for graph space
    ctx.save();
    ctx.translate(t.x, t.y);
    ctx.scale(t.scale, t.scale);

    // Update draw positions (with float)
    const nodes = nodesRef.current;
    nodes.forEach(n => {
      const floatY = Math.sin(time / 1000 * (2 * Math.PI / n.floatSpeed) + n.floatOffset) * 3;
      n.drawX = n.x;
      n.drawY = n.y + floatY;
    });

    const edges = edgesRef.current;
    const entrance = entranceRef.current;
    const sel = selectedNode ? nodes.find(n => n.id === selectedNode.id) : null;
    const hov = hoverNodeRef.current ? nodes.find(n => n.id === hoverNodeRef.current) : null;

    drawEdges(ctx, edges, nodes, sel, hov, entrance, now, particlesRef.current);
    drawNodes(ctx, nodes, edges, sel, hov, entrance, now, time);

    ctx.restore();
    ctx.restore();

    // Disable entrance after all nodes appeared
    if (entrance.active && (now - entrance.startTime) > 2500) {
      entranceRef.current.active = false;
    }

    timeRef.current += 16;
    animFrameRef.current = requestAnimationFrame(draw);
  }, [selectedNode]);

  // --- Interaction Handlers ---

  function screenToWorld(sx, sy) {
    const t = transformRef.current;
    return { x: (sx - t.x) / t.scale, y: (sy - t.y) / t.scale };
  }

  function hitTest(clientX, clientY) {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const { x, y } = screenToWorld(clientX - rect.left, clientY - rect.top);

    for (let i = nodesRef.current.length - 1; i >= 0; i--) {
      const n = nodesRef.current[i];
      const dx = x - n.x, dy = y - n.y;
      if (dx * dx + dy * dy <= (n.r + 8) * (n.r + 8)) return n;
    }
    return null;
  }

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
    e.preventDefault?.();
  }, []);

  const handlePointerMove = useCallback((e) => {
    if (e.touches && e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      const scale = dist / touchRef.current.lastDist;
      transformRef.current.scale = Math.max(0.2, Math.min(5, transformRef.current.scale * scale));
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
    } else if (!e.touches) {
      // Hover
      const hit = hitTest(clientX, clientY);
      const canvas = canvasRef.current;
      if (hit) {
        canvas.style.cursor = 'pointer';
        hoverNodeRef.current = hit.id;
        setTooltip({
          x: clientX,
          y: clientY,
          name: hit.concept.name,
          oneLiner: hit.concept.one_liner,
          importance: hit.concept.importance,
        });
      } else {
        canvas.style.cursor = 'grab';
        hoverNodeRef.current = null;
        setTooltip(null);
      }
    }
  }, []);

  const handlePointerUp = useCallback((e) => {
    if (!dragRef.current.isDragging) return;

    if (!dragRef.current.moved) {
      const clientX = e.changedTouches ? e.changedTouches[0].clientX : e.clientX;
      const clientY = e.changedTouches ? e.changedTouches[0].clientY : e.clientY;
      const hit = hitTest(clientX, clientY);

      if (hit) {
        setSelectedNode(prev => {
          if (prev && prev.id === hit.id) return null;

          // Zoom to node
          const { w, h } = sizeRef.current;
          const targetScale = 1.2;
          const offsetX = 200; // offset for detail card
          const targetX = w / 2 - hit.x * targetScale - offsetX;
          const targetY = h / 2 - hit.y * targetScale;

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

          return hit;
        });
      } else {
        setSelectedNode(null);
        targetTransformRef.current = null;
      }
    }

    dragRef.current.isDragging = false;
  }, []);

  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const zoom = e.deltaY < 0 ? 1.08 : 0.92;
    const newScale = Math.max(0.2, Math.min(5, transformRef.current.scale * zoom));
    const ratio = newScale / transformRef.current.scale;

    transformRef.current.x = mouseX - ratio * (mouseX - transformRef.current.x);
    transformRef.current.y = mouseY - ratio * (mouseY - transformRef.current.y);
    transformRef.current.scale = newScale;
  }, []);

  // --- Zoom Controls ---

  const zoomIn = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const newScale = Math.min(5, transformRef.current.scale * 1.25);
    const ratio = newScale / transformRef.current.scale;
    transformRef.current.x = cx - ratio * (cx - transformRef.current.x);
    transformRef.current.y = cy - ratio * (cy - transformRef.current.y);
    transformRef.current.scale = newScale;
  }, []);

  const zoomOut = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const newScale = Math.max(0.2, transformRef.current.scale * 0.8);
    const ratio = newScale / transformRef.current.scale;
    transformRef.current.x = cx - ratio * (cx - transformRef.current.x);
    transformRef.current.y = cy - ratio * (cy - transformRef.current.y);
    transformRef.current.scale = newScale;
  }, []);

  const fitToView = useCallback(() => {
    const nodes = nodesRef.current;
    if (!nodes.length) return;
    const { w, h } = sizeRef.current;

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    nodes.forEach(n => {
      minX = Math.min(minX, n.x - n.r);
      maxX = Math.max(maxX, n.x + n.r);
      minY = Math.min(minY, n.y - n.r);
      maxY = Math.max(maxY, n.y + n.r);
    });

    const graphW = maxX - minX + 80;
    const graphH = maxY - minY + 80;
    const scale = Math.min(w / graphW, h / graphH, 1.5);
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;

    targetTransformRef.current = {
      x: w / 2 - cx * scale,
      y: h / 2 - cy * scale,
      scale,
      startTime: performance.now(),
      duration: 400,
      fromX: transformRef.current.x,
      fromY: transformRef.current.y,
      fromScale: transformRef.current.scale,
    };
  }, []);

  const closeSelection = useCallback(() => {
    setSelectedNode(null);
  }, []);

  // --- Get node screen position (for detail card) ---
  const getNodeScreenPos = useCallback((nodeId) => {
    const node = nodesRef.current.find(n => n.id === nodeId);
    if (!node) return null;
    const t = transformRef.current;
    return {
      x: node.drawX * t.scale + t.x,
      y: node.drawY * t.scale + t.y,
      radius: node.r * t.scale,
    };
  }, []);

  // --- Lifecycle ---

  useEffect(() => {
    if (!data) return;
    initLayout();
  }, [data, initLayout]);

  // Start RAF loop
  useEffect(() => {
    if (!data || !nodesRef.current.length) return;
    animFrameRef.current = requestAnimationFrame(draw);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [draw, data]);

  // Resize
  useEffect(() => {
    const handleResize = () => {
      if (!containerRef.current || !canvasRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      canvasRef.current.width = w * DPR;
      canvasRef.current.height = h * DPR;
      canvasRef.current.style.width = w + 'px';
      canvasRef.current.style.height = h + 'px';
      sizeRef.current = { w, h };
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Wheel listener (passive: false)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  // Keyboard
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') {
        setSelectedNode(null);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  return {
    canvasRef,
    containerRef,
    selectedNode,
    tooltip,
    setTooltip,
    closeSelection,
    zoomIn,
    zoomOut,
    fitToView,
    getNodeScreenPos,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    nodesRef,
    edgesRef,
    dataRef: { current: data },
  };
}
