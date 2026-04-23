import { useMemo, useState, useEffect, useCallback } from 'react';
import useStore from '../store/useStore';
import { CONCEPT_COLORS } from '../data/sampleData';
import { API_BASE } from '../lib/api';
import { FileCode2, Copy } from 'lucide-react';
import KeywordHighlighter from './KeywordHighlighter';

const LEVELS = ['beginner', 'intermediate', 'advanced'];
const LEVEL_LABELS = { beginner: 'Conceptual', intermediate: 'Applied', advanced: 'Under the Hood' };

export default function InspectorPanel() {
  const {
    selectedNode, showInspector, setShowInspector, clearSelection,
    concepts, files, conceptEdges, projectId,
    openCodePanel, showToast,
    activeDepthLevel, setActiveDepthLevel,
    guidedMode, guidedPosition, explorationPath,
    advanceGuided, retreatGuided, exitGuidedMode,
    setSelectedNode,
    quizGateActive,
    expansions, fetchSubConcepts, collapseConcept,
    subConceptsReadyKeys,
  } = useStore();

  const [explanation, setExplanation] = useState(null);
  const [streamingExplanation, setStreamingExplanation] = useState('');
  const [loadingExplanation, setLoadingExplanation] = useState(false);

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

  const colors = concept
    ? (CONCEPT_COLORS[concept.color] || CONCEPT_COLORS.gray)
    : CONCEPT_COLORS.gray;

  const conceptFiles = useMemo(() => {
    if (!concept) return [];
    return files.filter(f => f.conceptId === concept.id);
  }, [concept, files]);

  const relatedEdges = useMemo(() => {
    if (!concept || selectedNode?.type !== 'concept') return [];
    return conceptEdges.filter(e => e.source === concept.id || e.target === concept.id);
  }, [concept, selectedNode, conceptEdges]);

  const activeLevel = activeDepthLevel || 'beginner';

  // Derive reading order + index
  const orderedConcepts = useMemo(() => {
    const base = concepts.filter(c => !c._isExpansion);
    if (!base.length) return [];
    const path = explorationPath;
    if (path?.length) {
      const orderMap = {};
      path.forEach((id, i) => { orderMap[id] = i; });
      return [...base].sort((a, b) => (orderMap[a.id] ?? 999) - (orderMap[b.id] ?? 999));
    }
    const importOrder = { critical: 0, important: 1, supporting: 2 };
    return [...base].sort((a, b) => {
      const ld = (a.layer ?? 0) - (b.layer ?? 0);
      if (ld !== 0) return ld;
      return (importOrder[a.importance] ?? 2) - (importOrder[b.importance] ?? 2);
    });
  }, [concepts, explorationPath]);

  const readingIndex = selectedNode?.type === 'concept'
    ? orderedConcepts.findIndex(c => c.id === selectedNode.id)
    : -1;

  const totalConcepts = orderedConcepts.length;
  const isExpanded = selectedNode?.type === 'concept' && !!expansions[selectedNode.id];
  const hasSubs = selectedNode?.type === 'concept'
    && (subConceptsReadyKeys.has(selectedNode.id) || !!expansions[selectedNode.id]);

  // Fetch explanation
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

    const fetchExpl = async () => {
      setLoadingExplanation(true);
      setStreamingExplanation('');
      try {
        const res = await fetch(`${API_BASE}/api/explain`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId, conceptKey: selectedNode.id, userLevel: activeLevel }),
        });
        const ct = res.headers.get('content-type');
        if (ct?.includes('application/json')) {
          const data = await res.json();
          setExplanation(data.explanation);
          setLoadingExplanation(false);
        } else {
          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let acc = '';
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
                  if (d.text) { acc += d.text; setStreamingExplanation(acc); }
                  if (d.done) { setExplanation(acc); setStreamingExplanation(''); }
                } catch {}
              }
            }
          }
          setLoadingExplanation(false);
        }
      } catch { setLoadingExplanation(false); }
    };
    fetchExpl();
  }, [selectedNode, projectId, activeLevel, node]);

  const close = useCallback(() => {
    setShowInspector(false);
    clearSelection();
    if (guidedMode) exitGuidedMode();
  }, [setShowInspector, clearSelection, guidedMode, exitGuidedMode]);

  const handleNext = useCallback(() => {
    if (guidedMode) {
      advanceGuided();
      return;
    }
    const next = orderedConcepts[readingIndex + 1];
    if (next) setSelectedNode({ type: 'concept', id: next.id });
  }, [guidedMode, advanceGuided, orderedConcepts, readingIndex, setSelectedNode]);

  const handlePrev = useCallback(() => {
    if (guidedMode) {
      retreatGuided();
      return;
    }
    const prev = orderedConcepts[readingIndex - 1];
    if (prev) setSelectedNode({ type: 'concept', id: prev.id });
  }, [guidedMode, retreatGuided, orderedConcepts, readingIndex, setSelectedNode]);

  const handleExpand = useCallback(() => {
    if (!selectedNode) return;
    if (isExpanded) {
      collapseConcept(selectedNode.id);
    } else {
      fetchSubConcepts(selectedNode.id);
    }
  }, [selectedNode, isExpanded, collapseConcept, fetchSubConcepts]);

  const handleCopyPrompt = useCallback(() => {
    const name = node?.name || 'this concept';
    const prompt = `Explain the [${name}] concept in this codebase — what does it do, what files are involved, and how does it connect to other parts of the system?`;
    navigator.clipboard.writeText(prompt).then(() => showToast('Copied prompt to clipboard'));
  }, [node, showToast]);

  if (!showInspector || !node || quizGateActive) return null;

  const displayDescription = explanation || streamingExplanation
    || node.description || node.explanation || node.one_liner || node.summary || '';

  const orderNum = readingIndex >= 0 ? readingIndex + 1 : null;

  return (
    <aside className="sl-inspector" role="dialog" aria-label={node.name}>
      {/* Head row */}
      <div className="sl-insp-head">
        <div className="sl-insp-crumb">
          {orderNum != null && (
            <span className="sl-insp-order-chip" style={{ background: colors.accent }}>
              {orderNum}
            </span>
          )}
          <span className="sl-insp-step">
            {orderNum != null ? `Step ${orderNum} of ${totalConcepts}` : selectedNode.type}
          </span>
        </div>
        <button className="sl-insp-close" onClick={close} aria-label="Close">
          <svg width="14" height="14" viewBox="0 0 14 14">
            <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Title */}
      <h2 className="sl-insp-title" style={{ color: colors.text }} data-quote-source={node.name}>{node.name}</h2>

      {/* Meta */}
      <div className="sl-insp-meta">
        {selectedNode.type === 'concept' && node.importance && (
          <span className="sl-insp-chip" style={{ background: colors.fill, color: colors.text }}>
            {node.importance}
          </span>
        )}
        <span className="sl-insp-meta-sep">&middot;</span>
        <span>{(node.fileCount || conceptFiles.length || 0)} files</span>
      </div>

      {/* Depth selector — only when multi-level explanations exist */}
      {selectedNode.type === 'concept' && node.beginner_explanation && node.intermediate_explanation && node.advanced_explanation && (
        <div
          style={{
            display: 'flex',
            gap: 2,
            padding: 2,
            marginTop: 12,
            borderRadius: 6,
            background: 'rgba(41,38,27,0.04)',
            border: '1px solid var(--sl-line)',
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
                padding: '5px 6px',
                borderRadius: 4,
                background: activeLevel === level ? 'var(--sl-card)' : 'transparent',
                color: activeLevel === level ? colors.text : 'var(--sl-ink-3)',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 150ms ease-out',
                boxShadow: activeLevel === level ? 'var(--sl-shadow-sm)' : 'none',
              }}
            >
              {LEVEL_LABELS[level]}
            </button>
          ))}
        </div>
      )}

      {/* Summary / explanation */}
      {loadingExplanation && !streamingExplanation ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--sl-ink-3)', margin: '14px 0' }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: colors.accent, animation: 'processing-dot 1.4s infinite' }} />
          Loading...
        </div>
      ) : (
        <p className="sl-insp-summary" data-quote-source={`${node.name} — explanation`}>
          <KeywordHighlighter text={displayDescription} accentColor={colors.accent} />
          {streamingExplanation && (
            <span style={{ display: 'inline-block', width: 6, height: 12, marginLeft: 2, borderRadius: 2, background: colors.accent, animation: 'processing-dot 1s infinite' }} />
          )}
        </p>
      )}

      {/* Files — compact chip row */}
      {selectedNode.type === 'concept' && conceptFiles.length > 0 && (
        <div className="sl-insp-extra">
          <div className="sl-insp-section-label">Files ({conceptFiles.length})</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {conceptFiles.slice(0, 6).map(f => (
              <button
                key={f.id}
                onClick={() => setSelectedNode({ type: 'file', id: f.id })}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  fontSize: 10.5,
                  fontFamily: "'JetBrains Mono', monospace",
                  padding: '2px 7px',
                  borderRadius: 6,
                  background: colors.fill,
                  color: colors.text,
                  border: `1px solid ${colors.accent}30`,
                  cursor: 'pointer',
                  transition: 'border-color 120ms',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = colors.accent; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = `${colors.accent}30`; }}
              >
                <FileCode2 size={10} strokeWidth={1.75} style={{ opacity: 0.6 }} />
                {f.name}
              </button>
            ))}
            {conceptFiles.length > 6 && (
              <span style={{ fontSize: 10.5, padding: '2px 6px', color: 'var(--sl-ink-3)' }}>
                +{conceptFiles.length - 6} more
              </span>
            )}
          </div>
        </div>
      )}

      {/* Connections */}
      {selectedNode.type === 'concept' && relatedEdges.length > 0 && (
        <div className="sl-insp-extra">
          <div className="sl-insp-section-label">Connections ({relatedEdges.length})</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {relatedEdges.slice(0, 5).map((edge, i) => {
              const isSource = edge.source === concept.id;
              const otherId = isSource ? edge.target : edge.source;
              const other = concepts.find(c => c.id === otherId);
              if (!other) return null;
              const oc = CONCEPT_COLORS[other.color] || CONCEPT_COLORS.gray;
              return (
                <button
                  key={i}
                  onClick={() => setSelectedNode({ type: 'concept', id: otherId })}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '5px 6px',
                    borderRadius: 6,
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontSize: 11,
                    color: 'var(--sl-ink-2)',
                    transition: 'background 120ms',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(41,38,27,0.04)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <svg width="10" height="10" viewBox="0 0 12 12" style={{ flexShrink: 0, opacity: 0.5 }}>
                    {isSource
                      ? <path d="M4 2l5 4-5 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                      : <path d="M8 2L3 6l5 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                    }
                  </svg>
                  <span style={{
                    fontWeight: 500,
                    color: oc.text,
                    background: oc.fill,
                    padding: '1px 6px',
                    borderRadius: 4,
                    border: `1px solid ${oc.accent}30`,
                    flexShrink: 0,
                    fontSize: 10.5,
                  }}>
                    {other.name}
                  </span>
                  <span style={{ color: 'var(--sl-ink-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 10.5 }}>
                    {edge.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Expand button */}
      {hasSubs && selectedNode.type === 'concept' && (
        <button
          className="sl-insp-expand"
          onClick={handleExpand}
          style={{ borderColor: colors.accent, color: colors.accent, marginTop: 4 }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            {isExpanded
              ? <path d="M2 6h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              : <><path d="M2 6h8M6 2v8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></>
            }
          </svg>
          {isExpanded ? 'Collapse sub-concepts' : 'Expand into sub-concepts'}
        </button>
      )}

      {/* Copy prompt */}
      <button
        onClick={handleCopyPrompt}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 10px',
          marginTop: 4,
          fontSize: 11,
          fontWeight: 500,
          color: 'var(--sl-ink-3)',
          background: 'transparent',
          border: '1px solid var(--sl-line)',
          borderRadius: 6,
          cursor: 'pointer',
          transition: 'all 120ms',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(41,38,27,0.04)'; e.currentTarget.style.color = 'var(--sl-ink)'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--sl-ink-3)'; }}
      >
        <Copy size={11} strokeWidth={1.75} />
        Copy prompt
      </button>

      {/* Divider + Nav */}
      <div className="sl-insp-divider" />
      <div className="sl-insp-nav">
        <button
          className="sl-insp-nav-btn"
          onClick={handlePrev}
          disabled={readingIndex <= 0}
        >
          <svg width="12" height="12" viewBox="0 0 12 12">
            <path d="M8 2L3 6l5 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </svg>
          Previous
        </button>
        <button
          className="sl-insp-nav-btn primary"
          onClick={handleNext}
          disabled={readingIndex === totalConcepts - 1}
          style={{ background: colors.accent }}
        >
          Next step
          <svg width="12" height="12" viewBox="0 0 12 12">
            <path d="M4 2l5 4-5 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </svg>
        </button>
      </div>
    </aside>
  );
}
