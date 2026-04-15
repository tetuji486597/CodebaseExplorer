import { useMemo } from 'react';
import { Player } from '@remotion/player';
import CodebaseExplainer from '../remotion/CodebaseExplainer';
import { getTotalDuration } from '../remotion/lib/sceneTiming';
import useStore from '../store/useStore';

const FPS = 30;
const WIDTH = 1280;
const HEIGHT = 720;

const IMPORTANCE_RANK = { critical: 4, high: 3, important: 3, medium: 2, supporting: 1, low: 1 };

export default function ExplainerPlayer() {
  const concepts = useStore((s) => s.concepts);
  const conceptEdges = useStore((s) => s.conceptEdges);
  const files = useStore((s) => s.files);
  const projectMeta = useStore((s) => s.projectMeta);
  const insights = useStore((s) => s.insights);
  const explorationPath = useStore((s) => s.explorationPath);

  const inputProps = useMemo(() => {
    const sortedConcepts = [...concepts]
      .sort((a, b) => (IMPORTANCE_RANK[b.importance] || 1) - (IMPORTANCE_RANK[a.importance] || 1))
      .slice(0, 10);

    const visibleIds = new Set(sortedConcepts.map((c) => c.id));

    const sortedFiles = [...(files || [])]
      .sort((a, b) => (b.importance_score || 0) - (a.importance_score || 0))
      .slice(0, 30);

    const filteredEdges = (conceptEdges || []).filter(
      (e) => visibleIds.has(e.source) && visibleIds.has(e.target)
    );

    return {
      projectMeta: projectMeta || {},
      concepts: sortedConcepts,
      conceptEdges: filteredEdges,
      files: sortedFiles,
      insights: (insights || []).slice(0, 3),
      explorationPath: explorationPath || [],
    };
  }, [concepts, conceptEdges, files, projectMeta, insights, explorationPath]);

  const duration = useMemo(() => getTotalDuration(inputProps, FPS), [inputProps]);

  if (!concepts.length) return null;

  return (
    <div
      className="w-full"
      style={{
        borderRadius: 16,
        overflow: 'hidden',
        border: '1px solid var(--color-border-subtle)',
        boxShadow: '0 4px 24px rgba(0, 0, 0, 0.25)',
        animation: 'fade-in 0.8s ease-out 0.3s both',
      }}
    >
      <Player
        component={CodebaseExplainer}
        inputProps={inputProps}
        durationInFrames={Math.max(FPS, duration)}
        fps={FPS}
        compositionWidth={WIDTH}
        compositionHeight={HEIGHT}
        style={{ width: '100%' }}
        controls
        autoPlay
        loop={false}
      />
    </div>
  );
}
