import { useEffect, useRef } from 'react';
import useStore from '../store/useStore';
import { fetchAndLoadProject } from '../lib/loadProject';
import { API_BASE } from '../lib/api';

/**
 * Polls for background enrichment completion (depth explanations, insights, quiz questions).
 * After the pipeline marks "complete", enrichment runs in the background.
 * This hook detects when it finishes ("enriched" status) and silently refetches project data,
 * then re-initializes quiz state so quizzes appear even if the user navigated past the
 * originally scheduled positions while enrichment was running.
 */
export default function useEnrichmentPoller() {
  const projectId = useStore((s) => s.projectId);
  const enrichedRef = useRef(false);

  useEffect(() => {
    if (!projectId || enrichedRef.current) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE}/api/pipeline/${projectId}/status`);
        if (!res.ok) return;
        const { status } = await res.json();

        if (status === 'enriched') {
          enrichedRef.current = true;
          clearInterval(interval);
          // Silently refetch all project data to hydrate depth explanations, insights, etc.
          await fetchAndLoadProject(projectId);

          // Re-init quiz state with the user's current position so that any
          // concepts whose scheduled review was already passed get rescheduled.
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
