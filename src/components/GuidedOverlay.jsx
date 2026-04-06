import { useState, useEffect, useMemo, useCallback } from 'react';
import useStore from '../store/useStore';
import { CONCEPT_COLORS } from '../data/sampleData';
import {
  ChevronLeft, ChevronRight, Compass, Eye,
  Key, Home, Image, User, Bell, FolderOpen, Search, Database, Mail, Box,
  FileCode2, ArrowRight,
} from 'lucide-react';
import KeywordHighlighter from './KeywordHighlighter';

const CONCEPT_ICON_MAP = {
  auth: Key, feed: Home, posts: Image, profiles: User,
  notifications: Bell, media: FolderOpen, search: Search,
  database: Database, email: Mail,
};

function getConceptIcon(id) {
  return CONCEPT_ICON_MAP[id] || Box;
}

const LEVEL_LABELS = { beginner: 'Conceptual', intermediate: 'Applied', advanced: 'Under the Hood' };
const LEVELS = ['beginner', 'intermediate', 'advanced'];

export default function GuidedOverlay() {
  const {
    guidedMode, guidedPosition, explorationPath,
    advanceGuided, retreatGuided, exitGuidedMode, enterGuidedMode,
    concepts, conceptEdges, files, selectedNode, exploredConcepts,
    setSelectedNode,
  } = useStore();

  const [transitioning, setTransitioning] = useState(false);
  const [activeLevel, setActiveLevel] = useState('beginner');
  const [detailExpanded, setDetailExpanded] = useState(false);

  // Current guided concept
  const currentKey = explorationPath[guidedPosition];
  const concept = useMemo(
    () => concepts.find(c => c.id === currentKey),
    [concepts, currentKey]
  );

  // Detect if user clicked away from the guided concept
  const isOffPath = guidedMode && selectedNode && selectedNode.id !== currentKey;

  // Related edges for current concept
  const relatedEdges = useMemo(() => {
    if (!concept) return [];
    return conceptEdges.filter(e => e.source === concept.id || e.target === concept.id);
  }, [concept, conceptEdges]);

  // Files for current concept
  const conceptFiles = useMemo(() => {
    if (!concept) return [];
    return files.filter(f => f.conceptId === concept.id);
  }, [concept, files]);

  // Previously visited concepts that connect to this one
  const connectedVisited = useMemo(() => {
    if (!concept) return [];
    return relatedEdges
      .map(e => {
        const otherId = e.source === concept.id ? e.target : e.source;
        const visited = exploredConcepts.has(otherId);
        const otherConcept = concepts.find(c => c.id === otherId);
        if (!visited || !otherConcept) return null;
        return { ...e, otherConcept, otherId };
      })
      .filter(Boolean);
  }, [relatedEdges, concept, exploredConcepts, concepts]);

  // Reset level when concept changes
  useEffect(() => {
    setActiveLevel('beginner');
    setDetailExpanded(false);
  }, [currentKey]);

  const handleNext = useCallback(() => {
    if (guidedPosition >= explorationPath.length - 1) {
      exitGuidedMode();
      return;
    }
    setTransitioning(true);
    setTimeout(() => {
      advanceGuided();
      setTimeout(() => setTransitioning(false), 250);
    }, 150);
  }, [guidedPosition, explorationPath.length, advanceGuided, exitGuidedMode]);

  const handleBack = useCallback(() => {
    if (guidedPosition <= 0) return;
    setTransitioning(true);
    setTimeout(() => {
      retreatGuided();
      setTimeout(() => setTransitioning(false), 250);
    }, 150);
  }, [guidedPosition, retreatGuided]);

  // Keyboard navigation
  useEffect(() => {
    if (!guidedMode) return;
    const handler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        handleNext();
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        handleBack();
      } else if (e.key === 'Escape') {
        exitGuidedMode();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [guidedMode, handleNext, handleBack, exitGuidedMode]);

  const handleReturnToTour = useCallback(() => {
    setSelectedNode({ type: 'concept', id: currentKey });
    useStore.getState().setShowInspector(false);
  }, [currentKey, setSelectedNode]);

  const handleJumpTo = useCallback((index) => {
    if (index === guidedPosition) return;
    setTransitioning(true);
    setTimeout(() => {
      useStore.getState().setGuidedPosition(index);
      useStore.getState().setSelectedNode({ type: 'concept', id: explorationPath[index] });
      useStore.getState().setShowInspector(false);
      setTimeout(() => setTransitioning(false), 250);
    }, 150);
  }, [guidedPosition, explorationPath]);

  if (!guidedMode || !concept) return null;

  const colors = CONCEPT_COLORS[concept.color] || CONCEPT_COLORS.gray;
  const Icon = getConceptIcon(concept.id);
  const isFirst = guidedPosition === 0;
  const isLast = guidedPosition === explorationPath.length - 1;
  const explanation = concept[`${activeLevel}_explanation`] || concept.description || '';

  // Off-path: show minimal "return to tour" button
  if (isOffPath) {
    return (
      <button
        onClick={handleReturnToTour}
        className="fixed top-16 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 active:scale-95"
        style={{
          background: 'rgba(99, 102, 241, 0.15)',
          color: '#a5b4fc',
          border: '1px solid rgba(99, 102, 241, 0.25)',
          backdropFilter: 'blur(12px)',
          boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
        }}
      >
        <Compass size={14} />
        Return to tour ({guidedPosition + 1}/{explorationPath.length})
      </button>
    );
  }

  return (
    <>
      {/* Progress stepper - top center */}
      <div
        className="fixed top-14 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 px-4 py-2"
        style={{
          background: 'rgba(18, 19, 31, 0.92)',
          backdropFilter: 'blur(16px)',
          borderRadius: 14,
          border: '1px solid rgba(255,255,255,0.06)',
          boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
        }}
      >
        <span className="text-[11px] font-medium mr-1" style={{ color: '#64748b' }}>
          {guidedPosition + 1} / {explorationPath.length}
        </span>
        <div className="flex items-center gap-1">
          {explorationPath.map((key, i) => {
            const isVisited = exploredConcepts.has(key) || i < guidedPosition;
            const isCurrent = i === guidedPosition;
            const c = concepts.find(c => c.id === key);
            const segColor = c ? (CONCEPT_COLORS[c.color] || CONCEPT_COLORS.gray).accent : '#6366f1';
            return (
              <button
                key={key}
                onClick={() => handleJumpTo(i)}
                className="transition-all duration-200 rounded-full"
                style={{
                  width: isCurrent ? 20 : 8,
                  height: 8,
                  background: isCurrent ? segColor : isVisited ? `${segColor}60` : 'rgba(255,255,255,0.08)',
                  border: isCurrent ? `1px solid ${segColor}` : 'none',
                  cursor: 'pointer',
                }}
                title={c?.name}
              />
            );
          })}
        </div>
      </div>

      {/* Concept card - bottom center (desktop) / bottom sheet (mobile) */}
      <div
        className="guided-card fixed z-30 transition-all duration-200"
        style={{
          opacity: transitioning ? 0 : 1,
          transform: transitioning ? 'translateY(12px)' : 'translateY(0)',
          // Desktop: bottom center
          bottom: 24,
          left: '50%',
          translate: '-50% 0',
          width: 'min(520px, calc(100% - 32px))',
          maxHeight: 'calc(100dvh - 120px)',
        }}
      >
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            background: '#12131f',
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 8px 48px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.02)',
          }}
        >
          {/* Card header */}
          <div className="px-6 pt-5 pb-3">
            <div className="flex items-center gap-3 mb-2">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{
                  background: `${colors.accent}15`,
                  border: `1px solid ${colors.accent}30`,
                }}
              >
                <Icon size={20} style={{ color: colors.accent }} />
              </div>
              <div className="min-w-0">
                <h2
                  className="text-lg font-semibold font-heading truncate"
                  style={{ color: '#e2e8f0', lineHeight: 1.3 }}
                >
                  {concept.name}
                </h2>
                <p className="text-xs truncate" style={{ color: '#64748b' }}>
                  {concept.one_liner || concept.description?.split('.')[0]}
                </p>
              </div>
              <span
                className="text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0 ml-auto"
                style={{
                  background: concept.importance === 'critical' ? 'rgba(239,68,68,0.12)' : concept.importance === 'important' ? 'rgba(245,158,11,0.12)' : 'rgba(148,163,184,0.1)',
                  color: concept.importance === 'critical' ? '#fca5a5' : concept.importance === 'important' ? '#fcd34d' : '#94a3b8',
                  border: `1px solid ${concept.importance === 'critical' ? 'rgba(239,68,68,0.2)' : concept.importance === 'important' ? 'rgba(245,158,11,0.2)' : 'rgba(148,163,184,0.1)'}`,
                }}
              >
                {concept.importance}
              </span>
            </div>

            {/* Metaphor callout */}
            {concept.metaphor && (
              <div
                className="rounded-lg px-3.5 py-2.5 mb-3 text-[13px] leading-relaxed"
                style={{
                  background: `${colors.accent}08`,
                  borderLeft: `2px solid ${colors.accent}40`,
                  color: '#cbd5e1',
                }}
              >
                <KeywordHighlighter text={concept.metaphor} accentColor={colors.accent} />
              </div>
            )}

            {/* Level toggle */}
            <div className="flex gap-1 mb-3">
              {LEVELS.map(level => (
                <button
                  key={level}
                  onClick={() => setActiveLevel(level)}
                  className="text-[11px] font-medium px-2.5 py-1 rounded-lg transition-all duration-150"
                  style={{
                    background: activeLevel === level ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                    color: activeLevel === level ? '#a5b4fc' : '#64748b',
                    border: activeLevel === level ? '1px solid rgba(99, 102, 241, 0.2)' : '1px solid transparent',
                  }}
                >
                  {LEVEL_LABELS[level]}
                </button>
              ))}
            </div>

            {/* Explanation */}
            <div
              className="text-[13px] leading-[1.7] mb-3 overflow-hidden"
              style={{
                color: '#94a3b8',
                maxHeight: detailExpanded ? 'none' : 80,
                maskImage: !detailExpanded && explanation.length > 200 ? 'linear-gradient(to bottom, black 60%, transparent)' : 'none',
                WebkitMaskImage: !detailExpanded && explanation.length > 200 ? 'linear-gradient(to bottom, black 60%, transparent)' : 'none',
              }}
            >
              <KeywordHighlighter text={explanation} accentColor={colors.accent} />
            </div>
            {explanation.length > 200 && (
              <button
                onClick={() => setDetailExpanded(!detailExpanded)}
                className="text-[11px] font-medium mb-3 transition-colors duration-150"
                style={{ color: '#6366f1' }}
              >
                {detailExpanded ? 'Show less' : 'Read more'}
              </button>
            )}

            {/* Connected visited concepts */}
            {connectedVisited.length > 0 && (
              <div className="mb-3">
                <p className="text-[11px] font-medium mb-1.5" style={{ color: '#64748b' }}>
                  Connects to concepts you've seen
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {connectedVisited.map(({ otherId, otherConcept, label }) => {
                    const oc = CONCEPT_COLORS[otherConcept.color] || CONCEPT_COLORS.gray;
                    return (
                      <span
                        key={otherId}
                        className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg"
                        style={{
                          background: `${oc.accent}10`,
                          color: oc.text,
                          border: `1px solid ${oc.accent}20`,
                        }}
                      >
                        <ArrowRight size={10} style={{ color: '#64748b' }} />
                        {otherConcept.name}
                        {label && <span style={{ color: '#4a5568' }}> ({label})</span>}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Files */}
            {conceptFiles.length > 0 && (
              <div className="mb-2">
                <p className="text-[11px] font-medium mb-1.5" style={{ color: '#64748b' }}>
                  {conceptFiles.length} file{conceptFiles.length !== 1 ? 's' : ''}
                </p>
                <div className="flex flex-wrap gap-1">
                  {conceptFiles.slice(0, 6).map(f => (
                    <span
                      key={f.id}
                      className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md"
                      style={{ background: 'rgba(255,255,255,0.04)', color: '#94a3b8' }}
                    >
                      <FileCode2 size={10} style={{ color: '#64748b' }} />
                      {f.name}
                    </span>
                  ))}
                  {conceptFiles.length > 6 && (
                    <span className="text-[11px] px-2 py-0.5" style={{ color: '#64748b' }}>
                      +{conceptFiles.length - 6} more
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Navigation footer */}
          <div
            className="flex items-center justify-between px-5 py-3"
            style={{
              borderTop: '1px solid rgba(255,255,255,0.06)',
              background: 'rgba(255,255,255,0.02)',
            }}
          >
            <button
              onClick={exitGuidedMode}
              className="text-[12px] font-medium transition-colors duration-150"
              style={{ color: '#4a5568', cursor: 'pointer' }}
              onMouseEnter={e => e.currentTarget.style.color = '#94a3b8'}
              onMouseLeave={e => e.currentTarget.style.color = '#4a5568'}
            >
              Explore on your own
            </button>

            <div className="flex items-center gap-2">
              <button
                onClick={handleBack}
                disabled={isFirst}
                className="flex items-center gap-1 text-[12px] font-medium px-3 py-2 rounded-lg transition-all duration-150 active:scale-95"
                style={{
                  color: isFirst ? '#2a2b3d' : '#94a3b8',
                  cursor: isFirst ? 'default' : 'pointer',
                  background: isFirst ? 'transparent' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${isFirst ? 'transparent' : 'rgba(255,255,255,0.06)'}`,
                }}
              >
                <ChevronLeft size={14} />
                Back
              </button>
              <button
                onClick={handleNext}
                className="flex items-center gap-1 text-[12px] font-semibold px-4 py-2 rounded-lg transition-all duration-150 active:scale-95"
                style={{
                  background: isLast ? 'rgba(16, 185, 129, 0.2)' : 'rgba(99, 102, 241, 0.2)',
                  color: isLast ? '#6ee7b7' : '#a5b4fc',
                  border: `1px solid ${isLast ? 'rgba(16, 185, 129, 0.3)' : 'rgba(99, 102, 241, 0.3)'}`,
                  cursor: 'pointer',
                }}
              >
                {isLast ? 'Explore Freely' : 'Next'}
                {!isLast && <ChevronRight size={14} />}
                {isLast && <Eye size={14} />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile styles */}
      <style>{`
        @media (max-width: 767px) {
          .guided-card {
            bottom: 0 !important;
            left: 0 !important;
            right: 0 !important;
            translate: none !important;
            width: 100% !important;
            max-height: 55dvh !important;
            overflow-y: auto !important;
            border-radius: 20px 20px 0 0 !important;
          }
          .guided-card > div {
            border-radius: 20px 20px 0 0 !important;
          }
        }
      `}</style>
    </>
  );
}
