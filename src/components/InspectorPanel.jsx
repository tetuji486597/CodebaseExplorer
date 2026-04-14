import { useMemo, useState, useEffect, useCallback, useRef, useLayoutEffect } from 'react';
import useStore from '../store/useStore';
import useUserState from '../hooks/useUserState';
import useQuizGate from '../hooks/useQuizGate';
import { API_BASE } from '../lib/api';
import { CONCEPT_COLORS } from '../data/sampleData';
import { graphViewport } from '../lib/graphViewport';
import {
  X, ChevronLeft, ChevronRight, FileCode2, ArrowRight, ArrowLeft,
  Copy, Key, Home, Image, User, Bell, FolderOpen, Search, Database, Mail, Box,
  Eye, Compass,
} from 'lucide-react';
import KeywordHighlighter from './KeywordHighlighter';

const LEVELS = ['beginner', 'intermediate', 'advanced'];
const LEVEL_LABELS = { beginner: 'Conceptual', intermediate: 'Applied', advanced: 'Under the Hood' };

// Map concept IDs to Lucide icons
const CONCEPT_ICON_MAP = {
  auth: Key, feed: Home, posts: Image, profiles: User,
  notifications: Bell, media: FolderOpen, search: Search,
  database: Database, email: Mail,
};
function getConceptIcon(id) { return CONCEPT_ICON_MAP[id] || Box; }

// Popover dimensions — fixed so layout math is predictable
const POPOVER_W = 360;
const POPOVER_MAX_H = 520;
const POPOVER_GAP = 20; // distance from node edge
const EDGE_PAD = 16;    // viewport padding

/**
 * ConceptPopover — a floating anchored detail card for the selected concept/file.
 * Reads the selected node's live screen position from graphViewport and updates
 * its own position on every animation frame so it tracks pan/zoom smoothly.
 * Flips left/right and clamps to viewport. Draws an SVG connector to the node.
 */
export default function InspectorPanel() {
  const {
    selectedNode, showInspector, setShowInspector, clearSelection,
    concepts, files, conceptEdges, projectId,
    openCodePanel, showToast,
    activeDepthLevel, setActiveDepthLevel,
    guidedMode, guidedPosition, explorationPath, exploredConcepts,
    advanceGuided, retreatGuided, exitGuidedMode,
    setSelectedNode,
    quizGateActive,
  } = useStore();

  const { fireEngagement } = useUserState();
  const { checkForQuizGate } = useQuizGate();

  const [explanation, setExplanation] = useState(null);
  const [streamingExplanation, setStreamingExplanation] = useState('');
  const [loadingExplanation, setLoadingExplanation] = useState(false);
  const [deepExpanded, setDeepExpanded] = useState(false);
  const [expandedEdge, setExpandedEdge] = useState(null);

  // Position & side ('left' or 'right' of the node)
  const [anchor, setAnchor] = useState({ x: 0, y: 0, side: 'right', visible: false, nodeX: 0, nodeY: 0 });
  const cardRef = useRef(null);
  const rafRef = useRef(null);

  // Drag state — refs to avoid re-render storms during pointer move
  const [isDragged, setIsDragged] = useState(false);
  const isDraggedRef = useRef(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const draggingRef = useRef(false);

  const node = useMemo(() => {
    if (!selectedNode) return null;
    if (selectedNode.type === 'concept') return concepts.find(c => c.id === selectedNode.id);
    return files.find(f => f.id === selectedNode.id);
  }, [selectedNode, concepts, files]);

  const concept = useMemo(() => {
    if (!node) return null;
    if (selectedNode?.type === 'concept') return node;
    return concepts.find(c => c.id === node.conceptId);
  }, [node, selectedNode, concepts]);

  const colors = concept ? (CONCEPT_COLORS[concept.color] || CONCEPT_COLORS.gray) : CONCEPT_COLORS.gray;

  const conceptFiles = useMemo(() => {
    if (!concept) return [];
    return files.filter(f => f.conceptId === concept.id);
  }, [concept, files]);

  const relatedEdges = useMemo(() => {
    if (!concept || selectedNode?.type !== 'concept') return [];
    return conceptEdges.filter(e => e.source === concept.id || e.target === concept.id);
  }, [concept, selectedNode, conceptEdges]);

  const activeLevel = activeDepthLevel || 'beginner';

  // Guided-tour state relative to the current selection
  const currentTourKey = explorationPath[guidedPosition];
  const isOnTourPath = guidedMode && selectedNode?.type === 'concept' && selectedNode.id === currentTourKey;
  const isOffTourPath = guidedMode && selectedNode?.type === 'concept' && !isOnTourPath;
  const isFirstStep = guidedPosition === 0;
  const isLastStep = guidedPosition === explorationPath.length - 1;

  const handleNext = useCallback(async () => {
    if (isLastStep) {
      exitGuidedMode();
      return;
    }
    const nextPos = guidedPosition + 1;
    const gateShown = await checkForQuizGate(nextPos);
    if (gateShown) return;
    advanceGuided();
  }, [isLastStep, guidedPosition, advanceGuided, exitGuidedMode, checkForQuizGate]);

  const handleBack = useCallback(() => {
    if (isFirstStep) return;
    retreatGuided();
  }, [isFirstStep, retreatGuided]);

  const handleJumpTo = useCallback((index) => {
    if (index === guidedPosition) return;
    useStore.getState().setGuidedPosition(index);
    useStore.getState().setSelectedNode({ type: 'concept', id: explorationPath[index] });
  }, [guidedPosition, explorationPath]);

  const handleReturnToTour = useCallback(() => {
    if (!currentTourKey) return;
    setSelectedNode({ type: 'concept', id: currentTourKey });
  }, [currentTourKey, setSelectedNode]);

  // Fetch or read explanation text for the active depth level
  useEffect(() => {
    if (!selectedNode || selectedNode.type !== 'concept') {
      setExplanation(null);
      return;
    }
    if (node) {
      const levelKey = `${activeLevel}_explanation`;
      if (node[levelKey]) {
        setExplanation(node[levelKey]);
        setLoadingExplanation(false);
        return;
      }
    }
    if (!projectId) { setExplanation(null); return; }

    const fetchExplanation = async () => {
      setLoadingExplanation(true);
      setStreamingExplanation('');
      try {
        const res = await fetch(`${API_BASE}/api/explain`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId, conceptKey: selectedNode.id, userLevel: activeLevel }),
        });
        const contentType = res.headers.get('content-type');
        if (contentType?.includes('application/json')) {
          const data = await res.json();
          setExplanation(data.explanation);
          setLoadingExplanation(false);
        } else {
          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let accumulated = '';
          let buffer = '';
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const d = JSON.parse(line.slice(6));
                  if (d.text) { accumulated += d.text; setStreamingExplanation(accumulated); }
                  if (d.done) { setExplanation(accumulated); setStreamingExplanation(''); }
                } catch {}
              }
            }
          }
          setLoadingExplanation(false);
        }
      } catch { setLoadingExplanation(false); }
    };
    fetchExplanation();
  }, [selectedNode, projectId, activeLevel, node]);

  // Reset transient UI state when selection changes
  useEffect(() => {
    setDeepExpanded(false);
    setExpandedEdge(null);
    setIsDragged(false);
    isDraggedRef.current = false;
  }, [selectedNode]);

  // Position tracking loop: read graphViewport.getScreenPos on every frame
  // and compute smart anchor position that flips and clamps to viewport.
  useLayoutEffect(() => {
    if (!showInspector || !selectedNode) {
      setAnchor(a => ({ ...a, visible: false }));
      return;
    }

    const update = () => {
      const pos = graphViewport.getScreenPos(selectedNode.id);
      if (!pos) {
        rafRef.current = requestAnimationFrame(update);
        return;
      }

      const cardH = cardRef.current?.offsetHeight || POPOVER_MAX_H;
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      // Prefer right side
      let side = 'right';
      let x = pos.x + pos.radius + POPOVER_GAP;
      if (x + POPOVER_W + EDGE_PAD > vw) {
        // Flip to left
        side = 'left';
        x = pos.x - pos.radius - POPOVER_GAP - POPOVER_W;
      }

      // Center vertically on node, clamp to viewport
      let y = pos.y - cardH / 2;
      if (y < EDGE_PAD + 56) y = EDGE_PAD + 56; // account for top bar
      if (y + cardH + EDGE_PAD > vh) y = vh - cardH - EDGE_PAD;

      // When the user has dragged the popover, skip auto-positioning
      if (!isDraggedRef.current) {
        setAnchor({
          x: Math.round(x),
          y: Math.round(y),
          side,
          visible: true,
          nodeX: Math.round(pos.x),
          nodeY: Math.round(pos.y),
          nodeRadius: Math.round(pos.radius),
        });
      }

      rafRef.current = requestAnimationFrame(update);
    };

    rafRef.current = requestAnimationFrame(update);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [selectedNode, showInspector]);

  const handleCopyPrompt = useCallback(() => {
    const name = node?.name || node?.id || 'this concept';
    const prompt = `Explain the [${name}] concept in this codebase — what does it do, what files are involved, and how does it connect to other parts of the system?`;
    navigator.clipboard.writeText(prompt).then(() => {
      showToast('Copied prompt to clipboard');
    }).catch(() => {
      showToast('Failed to copy');
    });
  }, [node, showToast]);

  const handleDragStart = useCallback((e) => {
    // Only drag from primary button
    if (e.button !== 0) return;
    e.preventDefault();
    const card = cardRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    dragOffsetRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    draggingRef.current = true;
    document.body.style.cursor = 'grabbing';
    document.body.style.userSelect = 'none';

    const onMove = (ev) => {
      if (!draggingRef.current || !cardRef.current) return;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      let nx = ev.clientX - dragOffsetRef.current.x;
      let ny = ev.clientY - dragOffsetRef.current.y;
      // Clamp to viewport
      nx = Math.max(0, Math.min(nx, vw - POPOVER_W));
      ny = Math.max(0, Math.min(ny, vh - 60));
      cardRef.current.style.left = nx + 'px';
      cardRef.current.style.top = ny + 'px';
      if (!isDraggedRef.current) {
        isDraggedRef.current = true;
        setIsDragged(true);
      }
    };

    const onUp = () => {
      draggingRef.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }, []);

  if (!showInspector || !node || quizGateActive) return null;

  const close = () => {
    setShowInspector(false);
    clearSelection();
    // If in guided mode, exit so the "Resume tour" button appears in the TopBar
    if (guidedMode) exitGuidedMode();
  };

  const displayDescription = explanation || streamingExplanation || node.description || node.explanation || '';

  const ConceptIcon = selectedNode.type === 'concept' ? getConceptIcon(node.id) : FileCode2;

  // Connector line: from node edge on the chosen side to the card's near edge
  const connectorStart = {
    x: anchor.side === 'right' ? anchor.nodeX + anchor.nodeRadius : anchor.nodeX - anchor.nodeRadius,
    y: anchor.nodeY,
  };
  const connectorEnd = {
    x: anchor.side === 'right' ? anchor.x : anchor.x + POPOVER_W,
    y: anchor.nodeY, // stay horizontal so it reads as anchored to the node
  };

  return (
    <>
      {/* SVG connector — rendered above the graph, below the card (hidden when dragged) */}
      {anchor.visible && !isDragged && (
        <svg
          style={{
            position: 'fixed',
            inset: 0,
            width: '100vw',
            height: '100vh',
            pointerEvents: 'none',
            zIndex: 49,
          }}
        >
          <line
            x1={connectorStart.x}
            y1={connectorStart.y}
            x2={connectorEnd.x}
            y2={connectorEnd.y}
            stroke={colors.stroke || 'var(--color-border-strong)'}
            strokeWidth={1.5}
            strokeDasharray="3 4"
            opacity={0.6}
          />
          <circle
            cx={connectorStart.x}
            cy={connectorStart.y}
            r={3}
            fill={colors.stroke || 'var(--color-accent)'}
          />
        </svg>
      )}

      {/* Popover card */}
      <div
        ref={cardRef}
        data-test="inspector"
        style={{
          position: 'fixed',
          left: anchor.x,
          top: anchor.y,
          width: POPOVER_W,
          maxHeight: POPOVER_MAX_H,
          zIndex: 50,
          background: 'var(--color-bg-elevated)',
          border: '1px solid var(--color-border-visible)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-lg)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          opacity: anchor.visible ? 1 : 0,
          transform: anchor.visible ? 'translateX(0) scale(1)' : `translateX(${anchor.side === 'right' ? -8 : 8}px) scale(0.98)`,
          transition: 'opacity 0.2s var(--ease-out), transform 0.2s var(--ease-out)',
          pointerEvents: anchor.visible ? 'auto' : 'none',
        }}
      >
        {/* Header — drag handle */}
        <div
          onPointerDown={handleDragStart}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 14px',
            borderBottom: '1px solid var(--color-border-subtle)',
            gap: 10,
            flexShrink: 0,
            cursor: 'grab',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 'var(--radius-sm)',
                background: colors.fill,
                border: `1px solid ${colors.stroke}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <ConceptIcon size={14} strokeWidth={1.75} color={colors.stroke} />
            </div>
            <div style={{ minWidth: 0, lineHeight: 1.2 }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: 'var(--color-text-primary)',
                  letterSpacing: '-0.01em',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {node.name}
              </div>
              {selectedNode.type === 'concept' && node.importance && (
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 500,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    marginTop: 2,
                    color:
                      node.importance === 'critical' ? 'var(--color-error)'
                      : node.importance === 'important' ? 'var(--color-warning)'
                      : 'var(--color-text-tertiary)',
                  }}
                >
                  {node.importance}
                </div>
              )}
              {selectedNode.type === 'file' && concept && (
                <div style={{ fontSize: 10, marginTop: 2, color: colors.stroke, display: 'flex', alignItems: 'center', gap: 4 }}>
                  {(() => { const CI = getConceptIcon(concept.id); return <CI size={10} strokeWidth={1.75} />; })()}
                  {concept.name}
                </div>
              )}
            </div>
          </div>
          <button
            onClick={close}
            aria-label="Close"
            style={{
              width: 24,
              height: 24,
              borderRadius: 'var(--radius-sm)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'transparent',
              border: 'none',
              color: 'var(--color-text-tertiary)',
              cursor: 'pointer',
              flexShrink: 0,
              transition: `all var(--duration-base) var(--ease-out)`,
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-bg-sunken)'; e.currentTarget.style.color = 'var(--color-text-secondary)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--color-text-tertiary)'; }}
          >
            <X size={14} strokeWidth={1.75} />
          </button>
        </div>

        {/* Scrollable body */}
        <div
          style={{
            overflowY: 'auto',
            padding: '12px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            flex: 1,
            minHeight: 0,
          }}
        >
          {/* Guided tour stepper (when on-path) */}
          {isOnTourPath && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 12px',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--color-accent-soft)',
                border: '1px solid var(--color-border-strong)',
              }}
            >
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: 'var(--color-accent-active)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  flexShrink: 0,
                }}
              >
                {guidedPosition + 1} / {explorationPath.length}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1 }}>
                {explorationPath.map((key, i) => {
                  const isVisited = exploredConcepts.has(key) || i < guidedPosition;
                  const isCurrent = i === guidedPosition;
                  const c = concepts.find(cc => cc.id === key);
                  const segColor = c ? (CONCEPT_COLORS[c.color] || CONCEPT_COLORS.gray).stroke : 'var(--color-accent)';
                  return (
                    <button
                      key={key}
                      onClick={() => handleJumpTo(i)}
                      aria-label={c?.name}
                      style={{
                        width: isCurrent ? 18 : 6,
                        height: 6,
                        borderRadius: 999,
                        background: isCurrent ? segColor : isVisited ? `${segColor}90` : 'var(--color-border-visible)',
                        border: 'none',
                        cursor: 'pointer',
                        padding: 0,
                        transition: 'all var(--duration-base) var(--ease-out)',
                      }}
                      title={c?.name}
                    />
                  );
                })}
              </div>
              <button
                onClick={exitGuidedMode}
                style={{
                  fontSize: 10,
                  fontWeight: 500,
                  color: 'var(--color-text-tertiary)',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                  flexShrink: 0,
                }}
                title="Exit tour"
              >
                Exit
              </button>
            </div>
          )}

          {/* Off-path banner (user clicked away from the tour) */}
          {isOffTourPath && (
            <button
              onClick={handleReturnToTour}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 12px',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--color-accent-soft)',
                border: '1px solid var(--color-border-strong)',
                color: 'var(--color-accent-active)',
                fontSize: 11,
                fontWeight: 500,
                cursor: 'pointer',
                width: '100%',
                textAlign: 'left',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-border-strong)'; e.currentTarget.style.color = 'var(--color-text-inverse)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'var(--color-accent-soft)'; e.currentTarget.style.color = 'var(--color-accent-active)'; }}
            >
              <Compass size={12} strokeWidth={1.75} />
              Return to tour ({guidedPosition + 1}/{explorationPath.length})
            </button>
          )}

          {/* Metaphor — compact pull quote */}
          {selectedNode.type === 'concept' && node.metaphor && (
            <div
              style={{
                fontSize: 12,
                fontStyle: 'italic',
                lineHeight: 1.55,
                color: colors.text,
                padding: '8px 12px',
                background: colors.fill,
                borderLeft: `2px solid ${colors.stroke}`,
                borderRadius: '0 var(--radius-sm) var(--radius-sm) 0',
              }}
            >
              <KeywordHighlighter text={node.metaphor} accentColor={colors.stroke} />
            </div>
          )}

          {/* Depth selector — only show when distinct depth explanations exist */}
          {selectedNode.type === 'concept' && node.beginner_explanation && node.intermediate_explanation && node.advanced_explanation && (
            <div
              style={{
                display: 'flex',
                gap: 2,
                padding: 2,
                borderRadius: 'var(--radius-sm)',
                background: 'var(--color-bg-sunken)',
                border: '1px solid var(--color-border-subtle)',
              }}
            >
              {LEVELS.map(level => (
                <button
                  key={level}
                  onClick={() => setActiveDepthLevel(level)}
                  style={{
                    flex: 1,
                    fontSize: 11,
                    fontWeight: 500,
                    padding: '6px 8px',
                    borderRadius: 4,
                    background: activeLevel === level ? 'var(--color-bg-elevated)' : 'transparent',
                    color: activeLevel === level ? 'var(--color-accent-active)' : 'var(--color-text-tertiary)',
                    border: 'none',
                    cursor: 'pointer',
                    transition: `all var(--duration-base) var(--ease-out)`,
                    boxShadow: activeLevel === level ? 'var(--shadow-xs)' : 'none',
                  }}
                >
                  {LEVEL_LABELS[level]}
                </button>
              ))}
            </div>
          )}

          {/* Explanation */}
          {loadingExplanation && !streamingExplanation ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--color-text-secondary)' }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: colors.stroke, animation: 'processing-dot 1.4s infinite' }} />
              Loading...
            </div>
          ) : (
            <p style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--color-text-primary)' }}>
              <KeywordHighlighter text={displayDescription} accentColor={colors.stroke} />
              {streamingExplanation && (
                <span style={{ display: 'inline-block', width: 6, height: 12, marginLeft: 2, borderRadius: 2, background: colors.stroke, animation: 'processing-dot 1s infinite' }} />
              )}
            </p>
          )}

          {/* Files — compact chip grid */}
          {selectedNode.type === 'concept' && conceptFiles.length > 0 && (
            <div>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 500,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: 'var(--color-text-tertiary)',
                  marginBottom: 6,
                }}
              >
                Files ({conceptFiles.length})
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {conceptFiles.slice(0, 8).map(f => (
                  <button
                    key={f.id}
                    onClick={() => useStore.getState().setSelectedNode({ type: 'file', id: f.id })}
                    className="mono"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      fontSize: 11,
                      padding: '3px 8px',
                      borderRadius: 'var(--radius-sm)',
                      background: colors.fill,
                      color: colors.text,
                      border: `1px solid ${colors.stroke}40`,
                      cursor: 'pointer',
                      transition: `all var(--duration-base) var(--ease-out)`,
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = colors.stroke; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = `${colors.stroke}40`; }}
                  >
                    <FileCode2 size={10} strokeWidth={1.75} style={{ opacity: 0.6 }} />
                    {f.name}
                  </button>
                ))}
                {conceptFiles.length > 8 && (
                  <span style={{ fontSize: 11, padding: '3px 8px', color: 'var(--color-text-tertiary)' }}>
                    +{conceptFiles.length - 8} more
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Connections — compact list */}
          {selectedNode.type === 'concept' && relatedEdges.length > 0 && (
            <div>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 500,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: 'var(--color-text-tertiary)',
                  marginBottom: 6,
                }}
              >
                Connections ({relatedEdges.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {relatedEdges.slice(0, 6).map((edge, i) => {
                  const isSource = edge.source === concept.id;
                  const otherId = isSource ? edge.target : edge.source;
                  const other = concepts.find(c => c.id === otherId);
                  if (!other) return null;
                  const otherColors = CONCEPT_COLORS[other.color] || CONCEPT_COLORS.gray;
                  return (
                    <button
                      key={i}
                      onClick={() => {
                        if (guidedMode) {
                          const idx = explorationPath.indexOf(otherId);
                          if (idx !== -1) useStore.getState().setGuidedPosition(idx);
                        }
                        useStore.getState().setSelectedNode({ type: 'concept', id: otherId });
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '6px 8px',
                        borderRadius: 'var(--radius-sm)',
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        textAlign: 'left',
                        fontSize: 11,
                        color: 'var(--color-text-secondary)',
                        transition: `background var(--duration-base) var(--ease-out)`,
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-bg-sunken)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                    >
                      {isSource
                        ? <ArrowRight size={11} strokeWidth={1.75} style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }} />
                        : <ArrowLeft size={11} strokeWidth={1.75} style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }} />
                      }
                      <span
                        style={{
                          fontWeight: 500,
                          color: otherColors.text,
                          background: otherColors.fill,
                          padding: '1px 6px',
                          borderRadius: 4,
                          flexShrink: 0,
                          border: `1px solid ${otherColors.stroke}40`,
                        }}
                      >
                        {other.name}
                      </span>
                      <span style={{ color: 'var(--color-text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
                        {edge.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* File exports */}
          {selectedNode.type === 'file' && node.exports && node.exports.length > 0 && (
            <div>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 500,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: 'var(--color-text-tertiary)',
                  marginBottom: 6,
                }}
              >
                Exports ({node.exports.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {node.exports.slice(0, 5).map((exp, i) => {
                  const name = typeof exp === 'string' ? exp : exp.name;
                  const desc = typeof exp === 'string' ? null : (exp.whatItDoes || null);
                  return (
                    <div
                      key={i}
                      style={{
                        padding: '6px 10px',
                        borderRadius: 'var(--radius-sm)',
                        background: 'var(--color-bg-sunken)',
                        border: '1px solid var(--color-border-subtle)',
                      }}
                    >
                      <span className="mono" style={{ fontSize: 11, fontWeight: 500, color: 'var(--color-text-primary)' }}>{name}</span>
                      {desc && (
                        <p style={{ fontSize: 11, marginTop: 2, lineHeight: 1.5, color: 'var(--color-text-tertiary)' }}>
                          {desc}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 14px',
            borderTop: '1px solid var(--color-border-subtle)',
            background: 'var(--color-bg-surface)',
            flexShrink: 0,
          }}
        >
          {isOnTourPath ? (
            <>
              <button
                onClick={handleBack}
                disabled={isFirstStep}
                aria-label="Previous concept"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 4,
                  fontSize: 11,
                  fontWeight: 500,
                  padding: '8px 10px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'transparent',
                  color: isFirstStep ? 'var(--color-text-tertiary)' : 'var(--color-text-secondary)',
                  border: '1px solid var(--color-border-visible)',
                  cursor: isFirstStep ? 'default' : 'pointer',
                  opacity: isFirstStep ? 0.5 : 1,
                }}
              >
                <ChevronLeft size={12} strokeWidth={1.75} />
                Back
              </button>
              <button
                onClick={handleCopyPrompt}
                aria-label="Copy prompt for Claude"
                style={{
                  width: 32,
                  height: 32,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 'var(--radius-sm)',
                  background: 'transparent',
                  color: 'var(--color-text-tertiary)',
                  border: '1px solid var(--color-border-visible)',
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
                onMouseEnter={e => { e.currentTarget.style.color = 'var(--color-text-primary)'; e.currentTarget.style.background = 'var(--color-bg-sunken)'; }}
                onMouseLeave={e => { e.currentTarget.style.color = 'var(--color-text-tertiary)'; e.currentTarget.style.background = 'transparent'; }}
                title="Copy prompt for Claude"
              >
                <Copy size={12} strokeWidth={1.75} />
              </button>
              <button
                onClick={handleNext}
                aria-label={isLastStep ? 'Finish tour' : 'Next concept'}
                style={{
                  flex: 1,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  fontSize: 11,
                  fontWeight: 600,
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-sm)',
                  background: isLastStep ? 'var(--color-success)' : 'var(--color-accent)',
                  color: 'var(--color-text-inverse)',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                {isLastStep ? (
                  <>
                    <Eye size={12} strokeWidth={1.75} />
                    Explore freely
                  </>
                ) : (
                  <>
                    Next
                    <ChevronRight size={12} strokeWidth={1.75} />
                  </>
                )}
              </button>
            </>
          ) : (
            <>
              {selectedNode.type === 'file' && (
                <button
                  onClick={() => openCodePanel(node.id)}
                  style={{
                    flex: 1,
                    fontSize: 11,
                    fontWeight: 600,
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-sm)',
                    background: colors.stroke,
                    color: 'var(--color-text-inverse)',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  Walk me through this file
                </button>
              )}
              <button
                onClick={handleCopyPrompt}
                style={{
                  flex: 1,
                  fontSize: 11,
                  fontWeight: 500,
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'transparent',
                  color: 'var(--color-text-secondary)',
                  border: '1px solid var(--color-border-visible)',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  transition: `all var(--duration-base) var(--ease-out)`,
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-bg-sunken)'; e.currentTarget.style.color = 'var(--color-text-primary)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--color-text-secondary)'; }}
              >
                <Copy size={11} strokeWidth={1.75} />
                Copy prompt
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}
