import { useMemo, useState, useEffect, useCallback } from 'react';
import useStore from '../store/useStore';
import useUserState from '../hooks/useUserState';
import { CONCEPT_COLORS } from '../data/sampleData';
import {
  X, ChevronRight, FileCode2, ArrowRight, ArrowLeft,
  Copy, Check, Key, Home, Image, User, Bell, FolderOpen, Search, Database, Mail, Box,
} from 'lucide-react';

const LEVELS = ['beginner', 'intermediate', 'advanced'];

// Map concept IDs to Lucide icons
const CONCEPT_ICON_MAP = {
  auth: Key, feed: Home, posts: Image, profiles: User,
  notifications: Bell, media: FolderOpen, search: Search,
  database: Database, email: Mail,
};

function getConceptIcon(id) {
  return CONCEPT_ICON_MAP[id] || Box;
}

export default function InspectorPanel() {
  const {
    selectedNode, showInspector, setShowInspector, clearSelection,
    concepts, files, conceptEdges, projectId,
    openCodePanel, addChatMessage, setChatLoading, showToast,
  } = useStore();

  const { estimateLevel } = useUserState();

  const [explanation, setExplanation] = useState(null);
  const [streamingExplanation, setStreamingExplanation] = useState('');
  const [loadingExplanation, setLoadingExplanation] = useState(false);
  const [levelOverride, setLevelOverride] = useState(null);
  const [deepExpanded, setDeepExpanded] = useState(false);
  const [expandedEdge, setExpandedEdge] = useState(null);
  const [descExpanded, setDescExpanded] = useState(false);

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

  const currentLevel = useMemo(() => {
    if (!selectedNode || selectedNode.type !== 'concept') return 'beginner';
    const est = estimateLevel(selectedNode.id);
    return est === 'unseen' || est === 'glanced' ? 'beginner' : est;
  }, [selectedNode, estimateLevel]);

  const activeLevel = levelOverride || currentLevel;

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
        const res = await fetch('/api/explain', {
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
                  const data = JSON.parse(line.slice(6));
                  if (data.text) { accumulated += data.text; setStreamingExplanation(accumulated); }
                  if (data.done) { setExplanation(accumulated); setStreamingExplanation(''); }
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

  useEffect(() => {
    setLevelOverride(null);
    setDeepExpanded(false);
    setExpandedEdge(null);
    setDescExpanded(false);
  }, [selectedNode]);

  const handleCopyPrompt = useCallback(() => {
    const name = node?.name || node?.id || 'this concept';
    const prompt = `Explain the [${name}] concept in this codebase \u2014 what does it do, what files are involved, and how does it connect to other parts of the system?`;
    navigator.clipboard.writeText(prompt).then(() => {
      showToast('Copied prompt to clipboard');
    }).catch(() => {
      showToast('Failed to copy');
    });
  }, [node, showToast]);

  if (!showInspector || !node) return null;

  const close = () => { setShowInspector(false); clearSelection(); };

  const displayDescription = explanation || streamingExplanation || node.description || node.explanation || '';
  // Summary: first 1-2 sentences
  const sentences = displayDescription.split(/(?<=[.!?])\s+/);
  const summary = sentences.slice(0, 2).join(' ');
  const hasMore = sentences.length > 2;

  const ConceptIcon = selectedNode.type === 'concept' ? getConceptIcon(node.id) : FileCode2;

  return (
    <div
      className="absolute top-0 right-0 h-full z-30 overflow-y-auto"
      style={{
        width: 'min(400px, 92vw)',
        minWidth: '380px',
        background: '#14142b',
        borderLeft: '1px solid rgba(255,255,255,0.06)',
        boxShadow: '-4px 0 24px rgba(0,0,0,0.5)',
        animation: 'slide-in-right 0.3s ease-out',
      }}
    >
      {/* Header */}
      <div
        className="sticky top-0 z-10 flex items-center justify-between px-6 py-4"
        style={{
          background: 'rgba(20, 20, 43, 0.95)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{
              background: colors.fill,
              border: `1.5px solid ${colors.accent || colors.stroke}40`,
            }}
          >
            <ConceptIcon size={18} style={{ color: colors.accent || colors.stroke }} />
          </div>
          <div>
            <div className="font-medium text-sm" style={{ color: '#e2e8f0' }}>{node.name}</div>
            {selectedNode.type === 'concept' && node.importance && (
              <div
                className="text-[10px] uppercase tracking-wider font-medium mt-0.5"
                style={{
                  color: node.importance === 'critical' ? '#ef4444' :
                         node.importance === 'important' ? '#f59e0b' : '#64748b',
                }}
              >
                {node.importance}
              </div>
            )}
            {selectedNode.type === 'file' && concept && (
              <div className="flex items-center gap-1.5 text-[10px] mt-0.5" style={{ color: colors.text }}>
                {(() => { const CI = getConceptIcon(concept.id); return <CI size={10} />; })()}
                {concept.name}
              </div>
            )}
          </div>
        </div>
        <button
          onClick={close}
          className="w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200"
          style={{ color: '#64748b', background: 'rgba(255,255,255,0.04)' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#94a3b8'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = '#64748b'; }}
        >
          <X size={14} />
        </button>
      </div>

      <div className="px-6 py-5 space-y-5">

        {/* Metaphor callout */}
        {selectedNode.type === 'concept' && node.metaphor && (
          <div
            className="flex gap-3 items-start rounded-xl p-4"
            style={{
              background: `${colors.fill}80`,
              border: `1px solid ${(colors.accent || colors.stroke)}15`,
            }}
          >
            <span className="text-base mt-0.5 shrink-0" style={{ color: colors.accent || colors.stroke, opacity: 0.5 }}>{'\u201C'}</span>
            <p className="text-xs leading-relaxed italic" style={{ color: colors.text, opacity: 0.85 }}>
              {node.metaphor}
            </p>
          </div>
        )}

        {/* Explanation card */}
        <div
          className="rounded-xl p-4"
          style={{
            background: '#1e1e3a',
            border: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          {/* Depth selector - segmented control */}
          {selectedNode.type === 'concept' && (
            <div className="flex items-center gap-2 mb-4 pb-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <span className="text-[10px] uppercase tracking-wider font-medium mr-1" style={{ color: '#64748b' }}>Depth</span>
              <div
                className="flex rounded-lg relative overflow-hidden"
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  padding: '2px',
                }}
              >
                {/* Sliding indicator */}
                <div
                  className="absolute top-[2px] rounded-md transition-all duration-200 ease-out"
                  style={{
                    width: `calc(${100 / LEVELS.length}% - 2px)`,
                    height: 'calc(100% - 4px)',
                    left: `calc(${LEVELS.indexOf(activeLevel) * (100 / LEVELS.length)}% + 1px)`,
                    background: `${colors.accent || colors.stroke}20`,
                    border: `1px solid ${colors.accent || colors.stroke}30`,
                  }}
                />
                {LEVELS.map(level => (
                  <button
                    key={level}
                    onClick={() => setLevelOverride(level === activeLevel && !levelOverride ? null : level)}
                    className="relative z-10 text-[11px] px-3 py-1 font-medium transition-colors duration-200"
                    style={{
                      color: activeLevel === level ? colors.text : '#64748b',
                    }}
                  >
                    {level.charAt(0).toUpperCase() + level.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Explanation text - collapsible */}
          {loadingExplanation && !streamingExplanation ? (
            <div className="flex items-center gap-2 text-xs py-2" style={{ color: '#94a3b8' }}>
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: colors.accent || colors.stroke, animation: 'processing-dot 1.4s infinite' }} />
              Loading explanation...
            </div>
          ) : (
            <div>
              <p className="text-[13px] leading-[1.7]" style={{ color: '#cbd5e1' }}>
                {descExpanded ? displayDescription : summary}
                {streamingExplanation && (
                  <span className="inline-block w-1.5 h-3 ml-0.5 rounded-sm" style={{ background: colors.accent || colors.stroke, animation: 'processing-dot 1s infinite' }} />
                )}
              </p>
              {hasMore && !streamingExplanation && (
                <button
                  onClick={() => setDescExpanded(v => !v)}
                  className="text-[11px] mt-2 font-medium transition-colors duration-200"
                  style={{ color: colors.accent || colors.stroke }}
                  onMouseEnter={e => e.currentTarget.style.opacity = '0.7'}
                  onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                >
                  {descExpanded ? 'Show less' : 'Read more'}
                </button>
              )}
            </div>
          )}

          {/* Go deeper */}
          {selectedNode.type === 'concept' && node.deep_explanation && (
            <div className="mt-4 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              <button
                onClick={() => setDeepExpanded(v => !v)}
                className="flex items-center gap-1.5 text-[11px] font-medium transition-all duration-200 active:scale-95"
                style={{ color: '#64748b' }}
                onMouseEnter={e => e.currentTarget.style.color = colors.text}
                onMouseLeave={e => e.currentTarget.style.color = '#64748b'}
              >
                <ChevronRight
                  size={12}
                  style={{
                    transform: deepExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                    transition: 'transform 0.2s ease-out',
                  }}
                />
                {deepExpanded ? 'Show less' : 'Technical deep-dive'}
              </button>
              {deepExpanded && (
                <div style={{ animation: 'fade-in 0.2s ease-out' }}>
                  <p className="text-[12px] leading-[1.7] mt-3" style={{ color: '#94a3b8' }}>
                    {node.deep_explanation}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Concept-specific content */}
        {selectedNode.type === 'concept' && (
          <>
            {/* Files section */}
            <div
              className="rounded-xl p-4"
              style={{
                background: '#1e1e3a',
                border: '1px solid rgba(255,255,255,0.06)',
              }}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <FileCode2 size={13} style={{ color: '#64748b' }} />
                  <span className="text-[10px] uppercase tracking-wider font-medium" style={{ color: '#64748b' }}>Files</span>
                </div>
                <span className="text-[10px] tabular-nums font-medium" style={{ color: colors.text }}>{conceptFiles.length}</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {conceptFiles.map(f => (
                  <button
                    key={f.id}
                    onClick={() => useStore.getState().setSelectedNode({ type: 'file', id: f.id })}
                    className="mono text-[11px] px-2.5 py-1.5 rounded-lg transition-all duration-200 active:scale-95 flex items-center gap-1.5"
                    style={{
                      background: `${(colors.accent || colors.stroke)}10`,
                      color: `${colors.text}cc`,
                      border: `1px solid ${(colors.accent || colors.stroke)}18`,
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = `${(colors.accent || colors.stroke)}20`;
                      e.currentTarget.style.borderColor = `${(colors.accent || colors.stroke)}35`;
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = `${(colors.accent || colors.stroke)}10`;
                      e.currentTarget.style.borderColor = `${(colors.accent || colors.stroke)}18`;
                    }}
                  >
                    <FileCode2 size={11} style={{ opacity: 0.6 }} />
                    {f.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Connections section */}
            {relatedEdges.length > 0 && (
              <div
                className="rounded-xl p-4"
                style={{
                  background: '#1e1e3a',
                  border: '1px solid rgba(255,255,255,0.06)',
                }}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <ArrowRight size={13} style={{ color: '#64748b' }} />
                    <span className="text-[10px] uppercase tracking-wider font-medium" style={{ color: '#64748b' }}>Connections</span>
                  </div>
                  <span className="text-[10px] tabular-nums font-medium" style={{ color: '#64748b' }}>{relatedEdges.length}</span>
                </div>
                <div className="space-y-1">
                  {relatedEdges.map((edge, i) => {
                    const isSource = edge.source === concept.id;
                    const otherId = isSource ? edge.target : edge.source;
                    const other = concepts.find(c => c.id === otherId);
                    if (!other) return null;
                    const otherColors = CONCEPT_COLORS[other.color] || CONCEPT_COLORS.gray;
                    const isExpanded = expandedEdge === i;
                    const OtherIcon = getConceptIcon(other.id);

                    return (
                      <div key={i}>
                        <button
                          onClick={() => {
                            if (edge.explanation) setExpandedEdge(isExpanded ? null : i);
                            else useStore.getState().setSelectedNode({ type: 'concept', id: otherId });
                          }}
                          className="flex items-center gap-2 text-[11px] w-full text-left transition-all duration-200 rounded-lg px-2.5 py-2 -mx-1"
                          style={{ color: '#94a3b8' }}
                          onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                          {isSource ? <ArrowRight size={11} style={{ color: '#475569' }} /> : <ArrowLeft size={11} style={{ color: '#475569' }} />}
                          <span
                            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg"
                            style={{ background: `${(otherColors.accent || otherColors.stroke)}12`, border: `1px solid ${(otherColors.accent || otherColors.stroke)}18` }}
                          >
                            <OtherIcon size={11} style={{ color: otherColors.accent || otherColors.stroke }} />
                            <span className="text-[11px] font-medium" style={{ color: otherColors.text }}>{other.name}</span>
                          </span>
                          <span className="flex-1 truncate" style={{ color: '#475569' }}>{edge.label}</span>
                          {edge.explanation && (
                            <ChevronRight
                              size={11}
                              style={{
                                transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                                transition: 'transform 0.2s ease-out',
                                color: '#475569',
                              }}
                            />
                          )}
                        </button>
                        {isExpanded && edge.explanation && (
                          <div
                            className="ml-7 mt-1 mb-2 pl-3"
                            style={{
                              borderLeft: `2px solid ${(otherColors.accent || otherColors.stroke)}25`,
                              animation: 'fade-in 0.2s ease-out',
                            }}
                          >
                            <p className="text-[11px] leading-relaxed" style={{ color: '#94a3b8' }}>{edge.explanation}</p>
                            <button
                              onClick={() => useStore.getState().setSelectedNode({ type: 'concept', id: otherId })}
                              className="text-[11px] mt-2 font-medium transition-all duration-200 active:scale-95 flex items-center gap-1"
                              style={{ color: otherColors.accent || otherColors.text }}
                              onMouseEnter={e => e.currentTarget.style.opacity = '0.7'}
                              onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                            >
                              View {other.name} <ArrowRight size={10} />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}

        {/* File-specific content */}
        {selectedNode.type === 'file' && (
          <>
            {node.exports && node.exports.length > 0 && (
              <div
                className="rounded-xl p-4"
                style={{
                  background: '#1e1e3a',
                  border: '1px solid rgba(255,255,255,0.06)',
                }}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Box size={13} style={{ color: '#64748b' }} />
                    <span className="text-[10px] uppercase tracking-wider font-medium" style={{ color: '#64748b' }}>Exports</span>
                  </div>
                  <span className="text-[10px] tabular-nums font-medium" style={{ color: '#64748b' }}>{node.exports.length}</span>
                </div>
                <div className="space-y-2">
                  {node.exports.map((exp, i) => {
                    const name = typeof exp === 'string' ? exp : exp.name;
                    const desc = typeof exp === 'string' ? null : (exp.whatItDoes || null);
                    return (
                      <div
                        key={i}
                        className="rounded-lg px-3 py-2.5"
                        style={{
                          background: 'rgba(255,255,255,0.02)',
                          border: '1px solid rgba(255,255,255,0.04)',
                        }}
                      >
                        <span className="mono text-[11px] font-medium" style={{ color: '#e2e8f0' }}>{name}</span>
                        {desc && <p className="text-[11px] mt-1 leading-relaxed" style={{ color: '#64748b' }}>{desc}</p>}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}

        {/* Action buttons */}
        <div className="space-y-2 pt-1">
          {selectedNode.type === 'file' && (
            <button
              onClick={() => openCodePanel(node.id)}
              className="w-full py-3 rounded-xl text-[13px] font-semibold transition-all duration-200 active:scale-[0.98]"
              style={{
                background: `linear-gradient(135deg, ${colors.fill}, ${(colors.accent || colors.stroke)}15)`,
                color: colors.text,
                border: `1px solid ${(colors.accent || colors.stroke)}30`,
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = `${(colors.accent || colors.stroke)}50`}
              onMouseLeave={e => e.currentTarget.style.borderColor = `${(colors.accent || colors.stroke)}30`}
            >
              Walk me through this file
            </button>
          )}
          <button
            onClick={handleCopyPrompt}
            className="w-full py-3 rounded-xl text-[13px] font-medium transition-all duration-200 active:scale-[0.98] flex items-center justify-center gap-2"
            style={{
              background: 'rgba(255,255,255,0.03)',
              color: '#94a3b8',
              border: '1px solid rgba(255,255,255,0.06)',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
              e.currentTarget.style.color = '#e2e8f0';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
              e.currentTarget.style.color = '#94a3b8';
            }}
          >
            <Copy size={14} />
            Copy prompt for Claude
          </button>
        </div>
      </div>
    </div>
  );
}
