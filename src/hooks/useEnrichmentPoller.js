import { useEffect, useRef } from 'react';
import useStore from '../store/useStore';
import { fetchAndLoadProject } from '../lib/loadProject';
import { API_BASE } from '../lib/api';

/**
 * Polls for background enrichment completion (embeddings, concept mapping, sub-concepts).
 * Depth mapping, insights, and quizzes are now lazy (generated on first visit),
 * so this poller only waits for the eager stages to complete.
 */
export default function useEnrichmentPoller() {
  const projectId = useStore((s) => s.projectId);
  const enrichedRef = useRef(false);
  const lastStagesRef = useRef(null);

  useEffect(() => {
    if (!projectId || enrichedRef.current) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE}/api/pipeline/${projectId}/status`);
        if (!res.ok) return;
        const { status, enrichment } = await res.json();

        if (enrichment && JSON.stringify(enrichment) !== JSON.stringify(lastStagesRef.current)) {
          lastStagesRef.current = enrichment;

          const subConceptsDone = enrichment.sub_concepts === 'done';
          if (subConceptsDone) {
            await fetchAndLoadProject(projectId);
          }
        }

        if (status === 'enriched') {
          enrichedRef.current = true;
          clearInterval(interval);
          await fetchAndLoadProject(projectId);

          const store = useStore.getState();
          const { explorationPath, guidedPosition } = store;
          if (explorationPath?.length) {
            try {
              await fetch(`${API_BASE}/api/quiz/${projectId}/init`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  explorationPath,
                  currentPosition: guidedPosition,
                }),
              });
            } catch {
              // Non-fatal
            }
          }
        }
      } catch {
        // Silently ignore polling errors
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [projectId]);
}
