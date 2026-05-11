import { useRef, useEffect, useMemo, useCallback, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import useStore from '../../store/useStore';
import useCirclePackViewport from './useCirclePackViewport';
import CircleNode from './CircleNode';
import EdgeArcs from './EdgeArcs';
import Breadcrumbs from './Breadcrumbs';
import {
  buildHierarchy,
  computePackLayout,
  computeZoomTarget,
  resolveColor,
} from '../../utils/circlePackLayout';

const CROSSFADE_MS = 600;

export default function CirclePackCanvas() {
  const containerRef = useRef(null);
  const svgRef = useRef(null);
  const [viewSize, setViewSize] = useState({ w: 800, h: 600 });
  const initializedRef = useRef(false);
  const lastDrillRef = useRef(null);
  const [entranceNodes, setEntranceNodes] = useState(null);

  // Crossfade: old nodes rendered in screen space, fading out via RAF-driven progress
  const [crossfade, setCrossfade] = useState(null);
  const [crossfadeProgress, setCrossfadeProgress] = useState(0);
  const crossfadeRafRef = useRef(null);

  const concepts = useStore(s => s.concepts);
  const conceptEdges = useStore(s => s.conceptEdges);
  const subConceptsCache = useStore(s => s.subConceptsCache);
  const focusNodeId = useStore(s => s.focusNodeId);
  const focusStack = useStore(s => s.focusStack);
  const childrenRevealed = useStore(s => s.childrenRevealed);
  const revealChildren = useStore(s => s.revealChildren);
  const drillInto = useStore(s => s.drillInto);
  const drillOut = useStore(s => s.drillOut);
  const drillTransition = useStore(s => s.drillTransition);
  const clearDrillTransition = useStore(s => s.clearDrillTransition);
  const selectedNode = useStore(s => s.selectedNode);
  const setSelectedNode = useStore(s => s.setSelectedNode);
  const setShowInspector = useStore(s => s.setShowInspector);
  const subConceptsLoading = useStore(s => s.subConceptsLoading);
  const projectMeta = useStore(s => s.projectMeta);
  const showOnboarding = useStore(s => s.showOnboarding);
  const dismissOnboarding = useStore(s => s.dismissOnboarding);

  const { transform, animateTo, setImmediate, didDragRef, handlers, wheelHandler, DRILL_DURATION, DRILL_OUT_DURATION } = useCirclePackViewport(containerRef);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      if (width > 0 && height > 0) setViewSize({ w: width, h: height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Drive crossfade progress with RAF
  useEffect(() => {
    if (!crossfade) return;
    const startTime = crossfade.startedAt;
    const tick = () => {
      const elapsed = performance.now() - startTime;
      const p = Math.min(1, elapsed / CROSSFADE_MS);
      setCrossfadeProgress(p);
      if (p < 1) {
        crossfadeRafRef.current = requestAnimationFrame(tick);
      } else {
        setCrossfade(null);
        setCrossfadeProgress(0);
      }
    };
    crossfadeRafRef.current = requestAnimationFrame(tick);
    return () => {
      if (crossfadeRafRef.current) cancelAnimationFrame(crossfadeRafRef.current);
    };
  }, [crossfade]);

  const focusConcept = useMemo(() => {
    if (focusNodeId === '__universe__') {
      return concepts.find(c => c.id === '__universe__');
    }
    let found = concepts.find(c => c.id === focusNodeId);
    if (!found) {
      for (const cached of Object.values(subConceptsCache)) {
        found = cached.subConcepts?.find(sc => sc.id === focusNodeId);
        if (found) break;
      }
    }
    return found;
  }, [focusNodeId, concepts, subConceptsCache]);

  const { layoutNodes, focusCircle, isHeroMode } = useMemo(() => {
    if (!concepts.length) return { layoutNodes: [], focusCircle: null, isHeroMode: false };

    if (!childrenRevealed) {
      const heroR = Math.min(viewSize.w, viewSize.h) * 0.32;
      const heroNode = {
        x: viewSize.w / 2,
        y: viewSize.h / 2,
        r: heroR,
        depth: 0,
        data: {
          id: focusNodeId,
          name: (focusNodeId === '__universe__' ? projectMeta?.name : focusConcept?.name) || 'Project',
          color: focusConcept?.color || 'blue',
          importance: 'critical',
          one_liner: focusConcept?.one_liner || focusConcept?.description || '',
          hasChildren: true,
        },
      };
      return { layoutNodes: [heroNode], focusCircle: heroNode, isHeroMode: true };
    }

    const rootConcepts = concepts.filter(c => c.id !== '__universe__');
    let childrenToShow = [];

    if (focusNodeId === '__universe__') {
      childrenToShow = rootConcepts.map(c => ({
        id: c.id,
        name: c.name,
        color: c.color,
        importance: c.importance || 'supporting',
        one_liner: c.one_liner || c.description || '',
        fileCount: c.fileCount || c.fileIds?.length || 0,
        hasChildren: true,
      }));
    } else {
      const cached = subConceptsCache[focusNodeId];
      if (cached?.ready && cached.subConcepts?.length) {
        childrenToShow = cached.subConcepts.map(sc => ({
          id: sc.id,
          name: sc.name,
          color: sc.color,
          importance: sc.importance || 'supporting',
          one_liner: sc.one_liner || '',
          fileCount: sc.file_ids?.length || sc.fileIds?.length || 0,
          hasChildren: sc.has_further_depth !== false &&
            ((subConceptsCache[sc.id]?.subConcepts?.length > 0) ||
             (sc.file_ids?.length || sc.fileIds?.length || 0) >= 2),
        }));
      }
    }

    if (childrenToShow.length === 0) return { layoutNodes: [], focusCircle: null, isHeroMode: false };

    const root = buildHierarchy(
      { id: '__focus_root__', name: '', color: 'gray', importance: 'critical', _isUniverse: true },
      childrenToShow,
      {},
    );

    const laid = computePackLayout(root, viewSize.w, viewSize.h);
    const children = [];
    laid.each(node => {
      if (node.depth === 1) children.push(node);
    });

    return { layoutNodes: children, focusCircle: laid, isHeroMode: false };
  }, [concepts, subConceptsCache, focusNodeId, childrenRevealed, viewSize.w, viewSize.h, focusConcept]);

  // Animate to focus on drill transitions
  useEffect(() => {
    if (!drillTransition || !focusCircle) return;
    if (lastDrillRef.current === drillTransition.startedAt) return;
    lastDrillRef.current = drillTransition.startedAt;

    const target = computeZoomTarget(focusCircle, viewSize.w, viewSize.h);
    if (drillTransition.type === 'in') {
      setImmediate(target);
      const drillTimer = setTimeout(() => clearDrillTransition(), CROSSFADE_MS + 50);
      return () => clearTimeout(drillTimer);
    } else {
      animateTo(target, DRILL_OUT_DURATION);
      const timer = setTimeout(() => clearDrillTransition(), DRILL_OUT_DURATION + 50);
      return () => clearTimeout(timer);
    }
  }, [drillTransition, focusCircle, viewSize, setImmediate, animateTo, clearDrillTransition, DRILL_DURATION, DRILL_OUT_DURATION]);

  // Initial fit
  useEffect(() => {
    if (!focusCircle || initializedRef.current) return;
    initializedRef.current = true;
    const target = computeZoomTarget(focusCircle, viewSize.w, viewSize.h);
    setImmediate(target);
  }, [focusCircle, viewSize, setImmediate]);

  // Re-fit when layout changes (not during transitions)
  useEffect(() => {
    if (!focusCircle || !initializedRef.current || drillTransition || crossfade) return;
    const target = computeZoomTarget(focusCircle, viewSize.w, viewSize.h);
    animateTo(target, 400);
  }, [focusCircle]);

  const handleNodeClick = useCallback((node, e) => {
    e.stopPropagation();
    if (didDragRef.current) return;
    dismissOnboarding();
    setSelectedNode({ type: 'concept', id: node.data.id });
    setShowInspector(true);
  }, [setSelectedNode, setShowInspector, didDragRef, dismissOnboarding]);

  // Double-click = crossfade drill
  const handleNodeDoubleClick = useCallback((node, e) => {
    e.stopPropagation();
    if (!node.data.hasChildren) return;
    dismissOnboarding();
    if (!childrenRevealed) {
      revealChildren();
      setEntranceNodes(Date.now());
      setTimeout(() => setEntranceNodes(null), 600);
      return;
    }

    // Snapshot old nodes at their current screen positions
    const t = { ...transform };
    const frozenNodes = layoutNodes
      .filter(n => n.r * t.k > 3)
      .map(n => {
        const sx = t.x + n.x * t.k;
        const sy = t.y + n.y * t.k;
        const sr = n.r * t.k;
        return { sx, sy, sr, data: n.data, color: resolveColor(n.data.color) };
      });

    // Compute where the clicked node ends up when zoomed in
    const zoomK = Math.min(viewSize.w, viewSize.h) / (node.r * 2 * 1.1);
    const zoomX = viewSize.w / 2 - node.x * zoomK;
    const zoomY = viewSize.h / 2 - node.y * zoomK;
    const zoomedNodes = layoutNodes
      .filter(n => n.r * zoomK > 3)
      .map(n => ({
        sx: zoomX + n.x * zoomK,
        sy: zoomY + n.y * zoomK,
        sr: n.r * zoomK,
        data: n.data,
      }));

    setCrossfade({
      startNodes: frozenNodes,
      endNodes: zoomedNodes,
      startedAt: performance.now(),
    });
    setCrossfadeProgress(0);

    drillInto(node.data.id);
  }, [childrenRevealed, revealChildren, drillInto, viewSize, layoutNodes, transform]);

  const handleBackgroundClick = useCallback(() => {
    if (didDragRef.current) return;
    if (selectedNode) {
      setSelectedNode(null);
      setShowInspector(false);
    } else if (childrenRevealed || focusStack.length > 1) {
      drillOut();
    }
  }, [selectedNode, childrenRevealed, focusStack, drillOut, setSelectedNode, setShowInspector, didDragRef]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape' || e.key === 'Backspace') {
      e.preventDefault();
      if (selectedNode) {
        setSelectedNode(null);
        setShowInspector(false);
      } else {
        drillOut();
      }
    } else if (e.key === 'Enter' && selectedNode) {
      const node = layoutNodes.find(n => n.data.id === selectedNode.id);
      if (node?.data.hasChildren) {
        if (!childrenRevealed) revealChildren();
        else drillInto(selectedNode.id);
      }
    }
  }, [selectedNode, childrenRevealed, layoutNodes, drillOut, drillInto, revealChildren, setSelectedNode, setShowInspector]);

  const childCounts = useMemo(() => {
    const counts = {};
    for (const node of layoutNodes) {
      const cached = subConceptsCache[node.data.id];
      if (cached?.subConcepts?.length) counts[node.data.id] = cached.subConcepts.length;
    }
    return counts;
  }, [layoutNodes, subConceptsCache]);

  // Resolve edges relevant to the current drill level
  const visibleEdges = useMemo(() => {
    if (isHeroMode || !layoutNodes.length) return [];
    const visibleIds = new Set(layoutNodes.map(n => n.data.id));

    let sourceEdges;
    if (focusNodeId === '__universe__') {
      sourceEdges = conceptEdges.filter(e => e.label !== 'contains');
    } else {
      const cached = subConceptsCache[focusNodeId];
      sourceEdges = cached?.subEdges || [];
    }

    return sourceEdges
      .filter(e => visibleIds.has(e.source) && visibleIds.has(e.target) && e.source !== e.target)
      .map(e => {
        const srcNode = layoutNodes.find(n => n.data.id === e.source);
        const tgtNode = layoutNodes.find(n => n.data.id === e.target);
        return srcNode && tgtNode ? { ...e, srcNode, tgtNode } : null;
      })
      .filter(Boolean);
  }, [layoutNodes, isHeroMode, focusNodeId, conceptEdges, subConceptsCache]);

  useEffect(() => {
    if (!layoutNodes.length || isHeroMode) return;
    const fetchSubConcepts = useStore.getState().fetchSubConcepts;
    const cache = useStore.getState().subConceptsCache;
    const loading = useStore.getState().subConceptsLoading;

    const toFetch = layoutNodes
      .filter(n => n.data.hasChildren && !cache[n.data.id] && !loading.has(n.data.id))
      .sort((a, b) => (b.r || 0) - (a.r || 0))
      .slice(0, 3);

    for (const node of toFetch) {
      fetchSubConcepts(node.data.id);
    }
  }, [layoutNodes, isHeroMode]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    svg.addEventListener('wheel', wheelHandler, { passive: false });
    return () => svg.removeEventListener('wheel', wheelHandler);
  }, [wheelHandler]);

  if (!focusCircle) {
    return (
      <div ref={containerRef} style={{
        width: '100%', height: '100%',
        background: 'var(--color-bg-base, #0a0a14)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{
          width: 8, height: 8, borderRadius: '50%',
          background: 'var(--color-accent, #6366f1)',
          animation: 'processing-dot 1.4s infinite',
        }} />
      </div>
    );
  }

  const renderNodes = layoutNodes
    .filter(node => node.r * transform.k > 3)
    .map(node => ({ node, screenRadius: node.r * transform.k }));

  // Compute crossfade opacities: old fades out fast, new fades in with slight delay
  const oldOpacity = crossfade ? Math.max(0, 1 - crossfadeProgress * 1.8) : 0;
  const newOpacity = crossfade ? Math.max(0, Math.min(1, (crossfadeProgress - 0.25) / 0.75)) : 1;

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%', height: '100%',
        position: 'relative',
        background: 'var(--color-bg-base, #0a0a14)',
        overflow: 'hidden', outline: 'none',
      }}
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      <Breadcrumbs />

      <svg
        ref={svgRef}
        width={viewSize.w}
        height={viewSize.h}
        style={{ position: 'absolute', top: 0, left: 0, touchAction: 'none' }}
        {...handlers}
        onClick={handleBackgroundClick}
      >
        <style>{`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          @keyframes hero-pulse {
            0%, 100% { opacity: 0.15; }
            50% { opacity: 0.3; }
          }
          @keyframes node-entrance {
            from { opacity: 0; transform: scale(0.6); }
            to { opacity: 1; transform: scale(1); }
          }
        `}</style>

        {/* Old nodes fading out — rendered in screen space (no transform group) */}
        {crossfade && oldOpacity > 0.01 && (
          <g opacity={oldOpacity}>
            {crossfade.startNodes.map((sn) => {
              const en = crossfade.endNodes.find(e => e.data.id === sn.data.id);
              // Lerp from start position to zoomed-in position
              const p = crossfadeProgress;
              const eased = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
              const cx = en ? sn.sx + (en.sx - sn.sx) * eased : sn.sx;
              const cy = en ? sn.sy + (en.sy - sn.sy) * eased : sn.sy;
              const cr = en ? sn.sr + (en.sr - sn.sr) * eased : sn.sr;
              return (
                <circle
                  key={`fade-${sn.data.id}`}
                  cx={cx}
                  cy={cy}
                  r={cr}
                  fill={sn.color}
                  fillOpacity={0.15}
                  stroke={sn.color}
                  strokeOpacity={0.4}
                  strokeWidth={1.5}
                />
              );
            })}
          </g>
        )}

        {/* New nodes in the live transform group */}
        <g transform={`translate(${transform.x},${transform.y}) scale(${transform.k})`}
           opacity={newOpacity}>
          {/* Parent container circle */}
          {!isHeroMode && (
            <circle
              cx={focusCircle.x}
              cy={focusCircle.y}
              r={focusCircle.r}
              fill="none"
              stroke="var(--color-border-subtle, rgba(255,255,255,0.06))"
              strokeWidth={1.5 / transform.k}
            />
          )}

          {/* Edge arcs between sibling nodes */}
          {!isHeroMode && visibleEdges.length > 0 && (
            <EdgeArcs
              edges={visibleEdges}
              selectedId={selectedNode?.id || null}
              scale={transform.k}
              entranceActive={!!entranceNodes}
            />
          )}

          {renderNodes
            .sort((a, b) => a.node.r - b.node.r)
            .map(({ node, screenRadius }, i) => (
              <CircleNode
                key={node.data.id}
                node={node}
                screenRadius={screenRadius}
                isSelected={selectedNode?.id === node.data.id}
                isHero={isHeroMode}
                isFocused={false}
                isLoading={subConceptsLoading.has(node.data.id)}
                onClick={(e) => handleNodeClick(node, e)}
                onDoubleClick={(e) => handleNodeDoubleClick(node, e)}
                childCount={childCounts[node.data.id] || 0}
                entranceDelay={entranceNodes ? i * 40 : 0}
              />
            ))}
        </g>
      </svg>

      {/* Non-blocking onboarding hint on hero screen */}
      {isHeroMode && showOnboarding && (
        <div
          style={{
            position: 'absolute',
            bottom: Math.max(40, viewSize.h / 2 - focusCircle.r * 0.32 - 20),
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            pointerEvents: 'none',
            animation: 'fade-in 0.8s ease-out',
            zIndex: 10,
          }}
        >
          <span style={{
            fontSize: 12,
            color: 'var(--color-text-tertiary, #64748b)',
            fontFamily: "'DM Sans', 'Inter', system-ui, sans-serif",
            letterSpacing: '0.03em',
          }}>
            Double-click to explore
          </span>
          <span style={{
            width: 3, height: 3, borderRadius: '50%',
            background: 'var(--color-text-tertiary, #64748b)',
            opacity: 0.4,
            flexShrink: 0,
          }} />
          <span style={{
            fontSize: 12,
            color: 'var(--color-text-tertiary, #64748b)',
            fontFamily: "'DM Sans', 'Inter', system-ui, sans-serif",
            letterSpacing: '0.03em',
            display: 'flex',
            alignItems: 'center',
            gap: 5,
          }}>
            <kbd style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '1px 5px',
              fontSize: 10,
              fontFamily: "'DM Sans', 'Inter', system-ui, sans-serif",
              fontWeight: 500,
              lineHeight: 1,
              color: 'var(--color-text-secondary, #94a3b8)',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 4,
            }}>{navigator.platform?.includes('Mac') ? '⌘' : 'Ctrl'}+K</kbd>
            {' '}to chat
          </span>
        </div>
      )}

      {/* Floating back button */}
      {childrenRevealed && focusStack.length <= 1 && (
        <button
          className="graph-back-fab glass-pill"
          onClick={drillOut}
          aria-label="Back to overview"
          style={{
            position: 'absolute',
            bottom: 20,
            left: 20,
            zIndex: 20,
            width: 44,
            height: 44,
            borderRadius: 'var(--radius-pill)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: 'var(--color-text-primary)',
          }}
        >
          <ArrowLeft size={20} strokeWidth={2} />
        </button>
      )}

      {/* Focus label at bottom */}
      {!isHeroMode && focusConcept && focusNodeId !== '__universe__' && (
        <div
          className="glass-pill"
          style={{
            position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)',
            padding: '8px 16px', borderRadius: 'var(--radius-pill)',
            textAlign: 'center', pointerEvents: 'none', zIndex: 10,
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)' }}>
            {focusConcept.name}
          </div>
          {(focusConcept.one_liner || focusConcept.description) && (
            <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 2, maxWidth: 400 }}>
              {focusConcept.one_liner || focusConcept.description}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
