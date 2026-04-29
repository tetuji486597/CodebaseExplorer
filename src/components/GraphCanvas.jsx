import { useRef, useEffect, useState, useCallback, useMemo, useLayoutEffect } from 'react';
import useStore from '../store/useStore';
import { CONCEPT_COLORS } from '../data/sampleData';
import { layoutSwimLanes, routeAllEdges, pathFromPoints } from '../utils/graphLayout';
import { graphViewport } from '../lib/graphViewport';

const AUTO_EXPAND_DIAMETER = 120;
const AUTO_COLLAPSE_DIAMETER = 40;
const AUTO_EXPAND_CENTER_TOLERANCE = 96;
const NODE_FOCUS_SCALE = 2.15;

// ---------------------------------------------------------------------------
// useViewport — buttery-smooth pan/zoom with clamping + momentum
// ---------------------------------------------------------------------------
function useViewport({ contentBox, viewportSize, maxScale = 2.5, padding = 60 }) {
  const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 });
  const targetRef = useRef({ x: 0, y: 0, k: 1 });
  const curRef = useRef({ x: 0, y: 0, k: 1 });
  const velRef = useRef({ x: 0, y: 0 });
  const dragRef = useRef(null);
  const rafRef = useRef(null);

  const fitScale = useMemo(() => {
    if (!contentBox || !viewportSize.w || !viewportSize.h) return 1;
    const sx = (viewportSize.w - padding * 2) / contentBox.w;
    const sy = (viewportSize.h - padding * 2) / contentBox.h;
    return Math.min(sx, sy);
  }, [contentBox, viewportSize, padding]);

  const minScale = fitScale;

  const clamp = useCallback((t) => {
    const k = Math.max(minScale, Math.min(maxScale, t.k));
    const cw = contentBox.w * k;
    const ch = contentBox.h * k;
    const vw = viewportSize.w;
    const vh = viewportSize.h;
    let { x, y } = t;
    if (cw <= vw) {
      const centerX = (vw - cw) / 2;
      const slack = (vw - cw) / 2;
      x = Math.max(centerX - slack, Math.min(centerX + slack, x));
    } else {
      x = Math.max(vw - cw - padding, Math.min(padding, x));
    }
    if (ch <= vh) {
      const centerY = (vh - ch) / 2;
      const slack = (vh - ch) / 2;
      y = Math.max(centerY - slack, Math.min(centerY + slack, y));
    } else {
      y = Math.max(vh - ch - padding, Math.min(padding, y));
    }
    return { x, y, k };
  }, [minScale, maxScale, contentBox, viewportSize, padding]);

  const fitToView = useCallback((animate = true) => {
    if (!contentBox || !viewportSize.w) return;
    const k = fitScale;
    const x = (viewportSize.w - contentBox.w * k) / 2;
    const y = (viewportSize.h - contentBox.h * k) / 2;
    if (animate) {
      targetRef.current = { x, y, k };
    } else {
      curRef.current = { x, y, k };
      targetRef.current = { x, y, k };
      setTransform({ x, y, k });
    }
  }, [contentBox, viewportSize, fitScale]);

  useEffect(() => {
    fitToView(false);
  }, [fitScale, viewportSize.w, viewportSize.h]);

  useEffect(() => {
    const tick = () => {
      const cur = curRef.current;
      const tgt = targetRef.current;
      const vel = velRef.current;

      const smooth = 0.22;
      cur.x += (tgt.x - cur.x) * smooth;
      cur.y += (tgt.y - cur.y) * smooth;
      cur.k += (tgt.k - cur.k) * smooth;

      if (!dragRef.current && (Math.abs(vel.x) > 0.02 || Math.abs(vel.y) > 0.02)) {
        tgt.x += vel.x;
        tgt.y += vel.y;
        vel.x *= 0.92;
        vel.y *= 0.92;
        const clamped = clamp(tgt);
        tgt.x = clamped.x;
        tgt.y = clamped.y;
      }

      setTransform({ x: cur.x, y: cur.y, k: cur.k });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [clamp]);

  const panBy = useCallback((dx, dy) => {
    targetRef.current = clamp({
      ...targetRef.current,
      x: targetRef.current.x + dx,
      y: targetRef.current.y + dy,
    });
  }, [clamp]);

  const zoomAt = useCallback((screenX, screenY, deltaK) => {
    const cur = targetRef.current;
    const newK = Math.max(minScale, Math.min(maxScale, cur.k * deltaK));
    if (newK === cur.k) return;
    const worldX = (screenX - cur.x) / cur.k;
    const worldY = (screenY - cur.y) / cur.k;
    const newX = screenX - worldX * newK;
    const newY = screenY - worldY * newK;
    targetRef.current = clamp({ x: newX, y: newY, k: newK });
  }, [minScale, maxScale, clamp]);

  const zoomTo = useCallback((worldX, worldY, k) => {
    const targetK = Math.max(minScale, Math.min(maxScale, k));
    const x = viewportSize.w / 2 - worldX * targetK;
    const y = viewportSize.h / 2 - worldY * targetK;
    targetRef.current = clamp({ x, y, k: targetK });
  }, [minScale, maxScale, clamp, viewportSize]);

  const onWheel = useCallback((e) => {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    if (e.ctrlKey || e.metaKey) {
      zoomAt(sx, sy, Math.exp(-e.deltaY * 0.01));
    } else {
      panBy(-e.deltaX, -e.deltaY);
    }
  }, [zoomAt, panBy]);

  const onPointerDown = useCallback((e) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startTX: targetRef.current.x,
      startTY: targetRef.current.y,
      lastX: e.clientX,
      lastY: e.clientY,
      lastT: performance.now(),
      moved: false,
    };
    velRef.current = { x: 0, y: 0 };
  }, []);

  const onPointerMove = useCallback((e) => {
    if (!dragRef.current) return;
    const d = dragRef.current;
    const now = performance.now();
    const dt = Math.max(1, now - d.lastT);
    velRef.current = {
      x: ((e.clientX - d.lastX) / dt) * 16,
      y: ((e.clientY - d.lastY) / dt) * 16,
    };
    targetRef.current = clamp({
      ...targetRef.current,
      x: d.startTX + (e.clientX - d.startX),
      y: d.startTY + (e.clientY - d.startY),
    });
    if (Math.hypot(e.clientX - d.startX, e.clientY - d.startY) > 4) d.moved = true;
    d.lastX = e.clientX;
    d.lastY = e.clientY;
    d.lastT = now;
  }, [clamp]);

  const onPointerUp = useCallback((e) => {
    if (!dragRef.current) return;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {}
    const moved = dragRef.current.moved;
    dragRef.current = null;
    return { moved };
  }, []);

  return {
    transform,
    fitToView,
    zoomAt,
    zoomTo,
    minScale,
    maxScale,
    handlers: { onWheel, onPointerDown, onPointerMove, onPointerUp },
  };
}

// ---------------------------------------------------------------------------
// SwimLaneBackground
// ---------------------------------------------------------------------------
function SwimLaneBackground({ lanes, contentBox }) {
  if (!lanes) return null;
  return (
    <g>
      {lanes.map((l) => {
        const color = CONCEPT_COLORS[l.color];
        const accent = color?.accent || '#857D6A';
        const labelX = 28;
        const labelCY = l.y + l.height / 2;
        const labelText = l.label.toUpperCase();
        const pillW = labelText.length * 8.5 + 16;
        const pillH = 22;
        return (
          <g key={l.key}>
            <rect
              x={60} y={l.y}
              width={contentBox.w - 100} height={l.height}
              fill={accent} fillOpacity={0.05}
              stroke={accent} strokeOpacity={0.18} strokeWidth={1}
              strokeDasharray="2 4" rx={12}
            />
            {/* Rotated lane label on left margin */}
            <g transform={`translate(${labelX},${labelCY}) rotate(-90)`}>
              <rect
                x={-pillW / 2} y={-pillH / 2}
                width={pillW} height={pillH}
                rx={11} fill={accent} fillOpacity={0.12}
              />
              <text
                x={0} y={1}
                textAnchor="middle" dominantBaseline="central"
                className="sl-lane-label"
                style={{ fill: accent }}
              >
                {labelText}
              </text>
            </g>
          </g>
        );
      })}
    </g>
  );
}

// ---------------------------------------------------------------------------
// Edge — orthogonal with rounded corners, animated dash when highlighted
// ---------------------------------------------------------------------------
function Edge({ a, b, points, label, color, highlight, dimmed, showLabel, time, scale }) {
  const d = useMemo(() => {
    return pathFromPoints(points, 14);
  }, [points]);

  const opacity = dimmed ? 0.08 : highlight ? 0.78 : 0.22;
  const strokeW = highlight ? 2 : 1.2;
  // Place label at the middle segment of the routed path
  const midIdx = Math.floor(points.length / 2);
  const midX = (points[Math.max(0, midIdx - 1)].x + points[midIdx].x) / 2;
  const midY = (points[Math.max(0, midIdx - 1)].y + points[midIdx].y) / 2;
  const dashOffset = highlight ? -(time / 40) : 0;

  return (
    <g style={{ pointerEvents: 'none' }}>
      <path
        d={d} fill="none"
        stroke={color} strokeOpacity={opacity} strokeWidth={strokeW}
        strokeLinecap="round" strokeLinejoin="round"
        strokeDasharray={highlight ? '6 4' : 'none'}
        strokeDashoffset={dashOffset}
        markerEnd="url(#sl-arrow)"
        style={{ color }}
      />
      {showLabel && label && (highlight || (!dimmed && scale > 0.7)) && (() => {
        const maxLen = 32;
        const display = label.length > maxLen ? label.slice(0, maxLen - 1) + '…' : label;
        return (
          <g transform={`translate(${midX},${midY})`}>
            <rect
              x={-display.length * 3.1 - 6} y={-8}
              width={display.length * 6.2 + 12} height={16}
              rx={8} fill="var(--sl-bg)" opacity={0.92}
            />
            <text
              x={0} y={3} textAnchor="middle"
              className="sl-edge-label"
              style={{ fill: color, opacity: highlight ? 1 : 0.7 }}
            >
              {display}
            </text>
          </g>
        );
      })()}
    </g>
  );
}

// ---------------------------------------------------------------------------
// Node — circle with badges, label, pulse, selection glow
// ---------------------------------------------------------------------------
function NodeCircle({
  node, selected, dimmed, isNext, time,
  onClick, onDoubleClick, showOrder, showFileCount,
}) {
  const colors = CONCEPT_COLORS[node.color] || CONCEPT_COLORS.gray;
  const r = node.r;
  const drawR = selected ? r * 1.06 : r;

  const pulseOpacity = isNext ? 0.4 + Math.sin(time / 500) * 0.25 : 0;
  const opacity = dimmed ? 0.28 : 1;

  return (
    <g
      className="sl-node"
      data-node-id={node.id}
      transform={`translate(${node.x},${node.y})`}
      style={{ opacity }}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
    >
      {/* Next-up pulse halo */}
      {isNext && (
        <>
          <circle r={drawR + 14} fill={colors.accent} opacity={pulseOpacity * 0.4} />
          <circle
            r={drawR + 6} fill="none"
            stroke={colors.accent} strokeOpacity={0.5} strokeWidth={2}
            strokeDasharray="3 3"
          />
        </>
      )}

      {/* Selected glow */}
      {selected && (
        <circle
          r={drawR + 10} fill="none"
          stroke={colors.accent} strokeOpacity={0.35} strokeWidth={3}
        />
      )}

      {/* Soft drop shadow */}
      <circle
        r={drawR}
        fill="rgba(0,0,0,0.1)"
        transform="translate(0,3)"
        filter="url(#sl-softGlow)"
        opacity={0.4}
      />

      {/* Main body */}
      <circle
        r={drawR}
        fill={colors.fill}
        stroke={colors.accent}
        strokeWidth={selected ? 2.5 : 1.5}
      />

      {/* Reading order badge */}
      {showOrder && node._order != null && (
        <g transform={`translate(${-drawR + 6}, ${-drawR + 6})`}>
          <circle r={13} fill={colors.accent} stroke="var(--sl-bg)" strokeWidth={2} />
          <text y={4} textAnchor="middle" className="sl-order-badge">
            {node._order}
          </text>
        </g>
      )}

      {/* Name label below */}
      <text
        y={drawR + 20} textAnchor="middle"
        className="sl-node-label"
        style={{ fill: colors.text }}
      >
        {node.name}
      </text>

      {/* File count */}
      {showFileCount && (
        <text y={drawR + 36} textAnchor="middle" className="sl-node-sublabel">
          {node.fileCount || 0} files
        </text>
      )}
    </g>
  );
}

// ---------------------------------------------------------------------------
// FileNode — small circle for file view
// ---------------------------------------------------------------------------
function FileNode({ file, x, y, r, color, selected, dimmed, onClick }) {
  const colors = CONCEPT_COLORS[color] || CONCEPT_COLORS.gray;
  const opacity = dimmed ? 0.25 : 1;
  const ext = file.name?.split('.').pop() || '';
  return (
    <g
      data-file-id={file.id}
      transform={`translate(${x},${y})`}
      style={{ opacity, cursor: 'pointer' }}
      onClick={onClick}
    >
      {selected && (
        <circle r={r + 4} fill="none" stroke={colors.accent} strokeOpacity={0.4} strokeWidth={2} />
      )}
      <circle r={r} fill={colors.fill} stroke={colors.accent} strokeWidth={selected ? 2 : 1} />
      <text y={r + 12} textAnchor="middle" className="sl-edge-label" style={{ fill: colors.text, fontSize: 9 }}>
        {file.name?.length > 18 ? file.name.slice(0, 16) + '…' : file.name}
      </text>
      <text y={1} textAnchor="middle" style={{ fill: colors.accent, fontSize: 7, fontFamily: 'monospace', fontWeight: 600, pointerEvents: 'none' }}>
        {ext}
      </text>
    </g>
  );
}

// ---------------------------------------------------------------------------
// ViewportControls
// ---------------------------------------------------------------------------
function ViewportControls({ scale, minScale, maxScale, onFit, onZoomIn, onZoomOut }) {
  const pct = Math.round(((scale - minScale) / (maxScale - minScale)) * 100);
  return (
    <div className="sl-viewport-controls" onPointerDown={e => e.stopPropagation()}>
      <button onClick={onZoomIn} aria-label="Zoom in" title="Zoom in">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M7 3v8M3 7h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>
      <div className="sl-zoom-track">
        <div
          className="sl-zoom-fill"
          style={{ height: `${Math.max(4, Math.min(100, pct))}%` }}
        />
      </div>
      <button onClick={onZoomOut} aria-label="Zoom out" title="Zoom out">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M3 7h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>
      <div className="sl-vc-divider" />
      <button onClick={onFit} aria-label="Fit to view" title="Fit to view">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path
            d="M1 5V1h4M13 5V1H9M1 9v4h4M13 9v4H9"
            stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
          />
        </svg>
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// GraphCanvas — main export
// ---------------------------------------------------------------------------
export default function GraphCanvas() {
  const containerRef = useRef(null);
  const svgRef = useRef(null);
  const [viewSize, setViewSize] = useState({ w: 0, h: 0 });

  const {
    concepts, conceptEdges, files,
    viewMode,
    selectedNode, setSelectedNode, clearSelection, setShowInspector,
    exploredConcepts, markConceptExplored,
    expansions, fetchSubConcepts, collapseConcept,
    universeMode, setUniverseMode,
    subConceptsReadyKeys,
  } = useStore();

  // Immediately exit universe mode — swim lanes don't use it
  useEffect(() => {
    if (universeMode) setUniverseMode(false);
  }, [universeMode, setUniverseMode]);

  // Measure stage
  useLayoutEffect(() => {
    if (!containerRef.current) return;
    const measure = () => {
      const r = containerRef.current.getBoundingClientRect();
      setViewSize({ w: r.width, h: r.height });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // Auto-assign layers from edge topology when concepts don't have them
  const layeredConcepts = useMemo(() => {
    const base = concepts.filter(c => !c._isExpansion).map(c => ({
      ...c,
      fileCount: c.fileCount ?? (c.fileIds?.length || 0),
    }));
    if (!base.length) return base;
    if (base.some(c => c.layer != null)) return base;

    const ids = new Set(base.map(c => c.id));
    const inbound = {};
    const outbound = {};
    ids.forEach(id => { inbound[id] = new Set(); outbound[id] = new Set(); });
    conceptEdges.forEach(e => {
      if (ids.has(e.source) && ids.has(e.target)) {
        outbound[e.source].add(e.target);
        inbound[e.target].add(e.source);
      }
    });

    const layerMap = {};
    const visited = new Set();
    const queue = [];
    base.forEach(c => {
      if (inbound[c.id].size === 0) {
        layerMap[c.id] = 0;
        visited.add(c.id);
        queue.push(c.id);
      }
    });
    if (!queue.length) {
      const crit = base.find(c => c.importance === 'critical');
      const start = crit || base[0];
      layerMap[start.id] = 0;
      visited.add(start.id);
      queue.push(start.id);
    }
    while (queue.length) {
      const cur = queue.shift();
      const nextLayer = Math.min(3, (layerMap[cur] ?? 0) + 1);
      for (const nb of outbound[cur]) {
        if (!visited.has(nb)) {
          layerMap[nb] = nextLayer;
          visited.add(nb);
          queue.push(nb);
        }
      }
    }
    base.forEach(c => {
      if (!visited.has(c.id)) {
        const impLayer = { critical: 0, important: 1, supporting: 2 };
        layerMap[c.id] = impLayer[c.importance] ?? 2;
        visited.add(c.id);
      }
    });
    return base.map(c => ({ ...c, layer: layerMap[c.id] ?? 0 }));
  }, [concepts, conceptEdges]);

  // Derive reading order: explorationPath > layer + importance sorting
  const orderedConcepts = useMemo(() => {
    const base = layeredConcepts;
    if (!base.length) return [];
    const { explorationPath } = useStore.getState();
    if (explorationPath?.length) {
      const orderMap = {};
      explorationPath.forEach((id, i) => { orderMap[id] = i + 1; });
      return [...base].sort((a, b) => (orderMap[a.id] ?? 999) - (orderMap[b.id] ?? 999))
        .map((c, i) => ({ ...c, _order: orderMap[c.id] ?? i + 1 }));
    }
    const importOrder = { critical: 0, important: 1, supporting: 2 };
    return [...base]
      .sort((a, b) => {
        const ld = (a.layer ?? 0) - (b.layer ?? 0);
        if (ld !== 0) return ld;
        const id = (importOrder[a.importance] ?? 2) - (importOrder[b.importance] ?? 2);
        if (id !== 0) return id;
        return (a.name || '').localeCompare(b.name || '');
      })
      .map((c, i) => ({ ...c, _order: i + 1 }));
  }, [layeredConcepts]);

  const selectedId = selectedNode?.id || null;

  // Current reading index
  const readingIndex = useMemo(
    () => (selectedId ? orderedConcepts.findIndex(c => c.id === selectedId) : -1),
    [selectedId, orderedConcepts],
  );

  // Next node (for pulse)
  const nextId = useMemo(() => {
    if (selectedId) {
      const next = orderedConcepts[readingIndex + 1];
      return next?.id || null;
    }
    return orderedConcepts[0]?.id || null;
  }, [selectedId, readingIndex, orderedConcepts]);

  // Build expansion concepts
  const allConcepts = useMemo(() => {
    const expansionConcepts = concepts.filter(c => c._isExpansion);
    const withOrder = orderedConcepts.map(c => ({ ...c }));
    if (expansionConcepts.length) {
      expansionConcepts.forEach(ec => {
        const parent = withOrder.find(p => p.id === ec._parentId);
        withOrder.push({
          ...ec,
          _order: parent ? parent._order * 100 + 1 : 999,
          layer: (parent?.layer ?? 0) + 0.5,
        });
      });
    }
    return withOrder;
  }, [orderedConcepts, concepts]);

  // Build layout
  const layout = useMemo(() => {
    if (!viewSize.w || !viewSize.h || !allConcepts.length) {
      return { nodes: [], edges: [], lanes: [], contentBox: { x: 0, y: 0, w: 1, h: 1 } };
    }
    const edges = conceptEdges.filter(e => !e._temporary);
    return layoutSwimLanes(allConcepts, edges, viewSize.w, viewSize.h);
  }, [allConcepts, conceptEdges, viewSize]);

  // File node positions — small circles arrayed around their parent concept
  const fileNodes = useMemo(() => {
    if (viewMode !== 'files' || !layout.nodes.length || !files.length) return [];
    const result = [];
    layout.nodes.forEach(parent => {
      const pFiles = files.filter(f => f.conceptId === parent.id);
      if (!pFiles.length) return;
      const fileR = 10;
      const orbitR = parent.r + fileR + 8;
      const arcStart = -Math.PI / 2;
      const arcSpan = Math.min(Math.PI * 1.5, pFiles.length * 0.5);
      pFiles.forEach((f, i) => {
        const angle = arcStart + (pFiles.length === 1 ? 0 : (arcSpan * i) / (pFiles.length - 1) - arcSpan / 2);
        result.push({
          ...f,
          _x: parent.x + Math.cos(angle) * orbitR,
          _y: parent.y + Math.sin(angle) * orbitR,
          _r: fileR,
          _color: parent.color,
          _parentId: parent.id,
        });
      });
    });
    return result;
  }, [viewMode, layout.nodes, files]);

  // Viewport hook
  const { transform, fitToView, zoomAt, zoomTo, minScale, maxScale, handlers } =
    useViewport({
      contentBox: layout.contentBox,
      viewportSize: viewSize,
      maxScale: 2.5,
      padding: 60,
    });

  // Focus on selected node
  const prevSelectedRef = useRef(null);
  useEffect(() => {
    if (selectedId && selectedId !== prevSelectedRef.current) {
      const node = layout.nodes.find(n => n.id === selectedId);
      if (node) {
        const targetK = Math.min(1.4, Math.max(minScale * 1.3, 1.1));
        zoomTo(node.x, node.y, targetK);
      }
    } else if (!selectedId && prevSelectedRef.current) {
      fitToView(true);
    }
    prevSelectedRef.current = selectedId;
  }, [selectedId, layout.nodes, zoomTo, fitToView, minScale]);

  // Mark explored after 3s
  useEffect(() => {
    if (!selectedId) return;
    const timer = setTimeout(() => markConceptExplored(selectedId), 3000);
    return () => clearTimeout(timer);
  }, [selectedId, markConceptExplored]);

  // Adjacency
  const adj = useMemo(() => {
    const m = new Map();
    layout.edges.forEach(e => {
      if (!m.has(e.source)) m.set(e.source, new Set());
      if (!m.has(e.target)) m.set(e.target, new Set());
      m.get(e.source).add(e.target);
      m.get(e.target).add(e.source);
    });
    return m;
  }, [layout.edges]);

  const connectedIds = useMemo(() => {
    if (!selectedId) return null;
    const set = new Set([selectedId]);
    (adj.get(selectedId) || new Set()).forEach(id => set.add(id));
    return set;
  }, [selectedId, adj]);

  const nodeById = useMemo(() => {
    const m = new Map();
    layout.nodes.forEach(n => m.set(n.id, n));
    return m;
  }, [layout.nodes]);

  const routedEdges = useMemo(() => {
    if (!layout.edges.length || !nodeById.size) return [];
    return routeAllEdges(layout.edges, nodeById);
  }, [layout.edges, nodeById]);

  // Animation time
  const [time, setTime] = useState(0);
  useEffect(() => {
    let raf;
    const start = performance.now();
    const loop = () => {
      setTime(performance.now() - start);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Selection handlers
  const handleSelect = useCallback((id) => {
    if (id) {
      setSelectedNode({ type: 'concept', id });
      setShowInspector(true);
    } else {
      clearSelection();
      setShowInspector(false);
    }
  }, [setSelectedNode, clearSelection, setShowInspector]);

  // Zoom-driven detail: when a ready concept becomes large and centered,
  // replace the old plus-badge affordance by expanding it automatically.
  useEffect(() => {
    if (!layout.nodes.length || !subConceptsReadyKeys.size || !viewSize.w || !viewSize.h) return;

    const center = { x: viewSize.w / 2, y: viewSize.h / 2 };
    let candidate = null;
    let closestDistance = Infinity;

    layout.nodes.forEach(node => {
      if (node._isExpansion || expansions[node.id] || !subConceptsReadyKeys.has(node.id)) return;

      const screenRadius = node.r * transform.k;
      const screenDiameter = screenRadius * 2;
      if (screenDiameter < AUTO_EXPAND_DIAMETER) return;

      const screenX = transform.x + node.x * transform.k;
      const screenY = transform.y + node.y * transform.k;
      const distance = Math.hypot(screenX - center.x, screenY - center.y);
      const focusWindow = screenRadius + AUTO_EXPAND_CENTER_TOLERANCE;

      if (distance <= focusWindow && distance < closestDistance) {
        candidate = node;
        closestDistance = distance;
      }
    });

    if (candidate) {
      fetchSubConcepts(candidate.id);
    }

    Object.keys(expansions).forEach(id => {
      const node = nodeById.get(id);
      if (!node) return;
      const screenDiameter = node.r * transform.k * 2;
      if (screenDiameter <= AUTO_COLLAPSE_DIAMETER) {
        collapseConcept(id);
      }
    });
  }, [
    layout.nodes,
    nodeById,
    transform.x,
    transform.y,
    transform.k,
    viewSize.w,
    viewSize.h,
    subConceptsReadyKeys,
    expansions,
    fetchSubConcepts,
    collapseConcept,
  ]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        handleSelect(null);
        return;
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (selectedId) {
          const next = orderedConcepts[readingIndex + 1];
          if (next) handleSelect(next.id);
        } else if (orderedConcepts.length) {
          handleSelect(orderedConcepts[0].id);
        }
        return;
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (selectedId) {
          const prev = orderedConcepts[readingIndex - 1];
          if (prev) handleSelect(prev.id);
        }
        return;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedId, readingIndex, orderedConcepts, handleSelect]);

  // Wheel handler — attached imperatively for { passive: false }
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handler = handlers.onWheel;
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, [handlers.onWheel]);

  // Update graphViewport for any consumers (InspectorPanel, etc.)
  useEffect(() => {
    graphViewport.transform = { x: transform.x, y: transform.y, scale: transform.k };
    graphViewport.nodes = layout.nodes.map(n => ({
      id: n.id,
      x: n.x,
      y: n.y,
      radius: n.r,
    }));
    if (containerRef.current) {
      graphViewport.canvasRect = containerRef.current.getBoundingClientRect();
    }
  });

  // Double-click: zoom into a node, or zoom/fit the background.
  const onBgDoubleClick = useCallback((e) => {
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const nodeG = el?.closest('[data-node-id]');
    if (nodeG) {
      const node = nodeById.get(nodeG.getAttribute('data-node-id'));
      if (node) zoomTo(node.x, node.y, NODE_FOCUS_SCALE);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    if (transform.k < 1.2) zoomAt(sx, sy, 1.6);
    else fitToView(true);
  }, [transform.k, zoomAt, zoomTo, fitToView, nodeById]);

  const handleBgPointerUp = useCallback((e) => {
    const r = handlers.onPointerUp(e);
    if (!r || r.moved) return;

    const el = document.elementFromPoint(e.clientX, e.clientY);
    const nodeG = el?.closest('[data-node-id]');
    const fileG = el?.closest('[data-file-id]');

    if (nodeG) {
      handleSelect(nodeG.getAttribute('data-node-id'));
    } else if (fileG) {
      setSelectedNode({ type: 'file', id: fileG.getAttribute('data-file-id') });
      setShowInspector(true);
    } else {
      handleSelect(null);
    }
  }, [handlers, handleSelect, setSelectedNode, setShowInspector]);

  if (!concepts.length) return <div className="eg-center" />;

  return (
    <div className="eg-center sl-stage" style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div
        ref={containerRef}
        className="sl-graph-root"
        onDoubleClick={onBgDoubleClick}
        onPointerDown={handlers.onPointerDown}
        onPointerMove={handlers.onPointerMove}
        onPointerUp={handleBgPointerUp}
      >
        <svg ref={svgRef} width={viewSize.w} height={viewSize.h}>
          <defs>
            <marker
              id="sl-arrow" viewBox="0 0 10 10"
              refX="8" refY="5" markerWidth="6" markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M0,0 L10,5 L0,10 z" fill="currentColor" opacity="0.6" />
            </marker>
            <filter id="sl-softGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <g transform={`translate(${transform.x},${transform.y}) scale(${transform.k})`}>
            <SwimLaneBackground lanes={layout.lanes} contentBox={layout.contentBox} />

            {/* Edges */}
            <g>
              {routedEdges.map(({ edge: e, points, a, b }, i) => {
                const isHighlighted = connectedIds
                  ? connectedIds.has(e.source) && connectedIds.has(e.target)
                  : false;
                const isDimmed = !!selectedId && !isHighlighted;
                const color = CONCEPT_COLORS[a.color]?.accent || '#857D6A';
                return (
                  <Edge
                    key={`${e.source}-${e.target}-${i}`}
                    a={a} b={b} points={points} label={e.label}
                    color={color}
                    highlight={isHighlighted}
                    dimmed={isDimmed}
                    showLabel={isHighlighted}
                    time={time}
                    scale={transform.k}
                  />
                );
              })}
            </g>

            {/* Nodes */}
            <g>
              {layout.nodes.map(n => {
                const isSelected = selectedId === n.id;
                const isConnected = connectedIds ? connectedIds.has(n.id) : true;
                const isDimmed = !!selectedId && !isConnected;
                const isNext = nextId === n.id && !selectedId;
                return (
                  <NodeCircle
                    key={n.id}
                    node={n}
                    selected={isSelected}
                    dimmed={isDimmed}
                    isNext={isNext}
                    time={time}
                    showOrder={true}
                    showFileCount={true}
                    onClick={(e) => { e.stopPropagation(); handleSelect(n.id); }}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      zoomTo(n.x, n.y, NODE_FOCUS_SCALE);
                    }}
                  />
                );
              })}
            </g>

            {/* File nodes (visible in files mode) */}
            {viewMode === 'files' && fileNodes.length > 0 && (
              <g>
                {fileNodes.map(f => {
                  const isFileSelected = selectedNode?.type === 'file' && selectedNode?.id === f.id;
                  const parentSelected = selectedId === f._parentId;
                  const isDimmed = !!selectedId && !parentSelected && !isFileSelected;
                  return (
                    <FileNode
                      key={f.id}
                      file={f}
                      x={f._x}
                      y={f._y}
                      r={f._r}
                      color={f._color}
                      selected={isFileSelected}
                      dimmed={isDimmed}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedNode({ type: 'file', id: f.id });
                        setShowInspector(true);
                      }}
                    />
                  );
                })}
              </g>
            )}
          </g>
        </svg>

        <ViewportControls
          scale={transform.k}
          minScale={minScale}
          maxScale={maxScale}
          onFit={() => { handleSelect(null); fitToView(true); }}
          onZoomIn={() => zoomAt(viewSize.w / 2, viewSize.h / 2, 1.3)}
          onZoomOut={() => zoomAt(viewSize.w / 2, viewSize.h / 2, 1 / 1.3)}
        />
      </div>

      {/* Next-up hint pill */}
      {!selectedId && orderedConcepts.length > 0 && (
        <div className="sl-next-hint">
          <div className="sl-next-hint-dot" />
          <span>
            Tap the pulsing node to start, or press <kbd>→</kbd>
          </span>
        </div>
      )}
    </div>
  );
}
