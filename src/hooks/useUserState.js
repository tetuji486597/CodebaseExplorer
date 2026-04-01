import { useEffect, useRef, useCallback } from 'react';
import useStore from '../store/useStore';

const SYNC_INTERVAL = 5000; // 5 seconds

export default function useUserState() {
  const projectId = useStore(s => s.projectId);
  const selectedNode = useStore(s => s.selectedNode);
  const userState = useStore(s => s.userState);
  const setUserState = useStore(s => s.setUserState);

  const timerRef = useRef(null);
  const pendingRef = useRef({});
  const conceptTimerRef = useRef({ concept: null, start: 0 });

  // Track concept view time
  useEffect(() => {
    if (!selectedNode || selectedNode.type !== 'concept') {
      // Stop timing previous concept
      if (conceptTimerRef.current.concept) {
        const elapsed = Math.round((Date.now() - conceptTimerRef.current.start) / 1000);
        if (elapsed > 0) {
          const prev = pendingRef.current.time_per_concept || userState?.time_per_concept || {};
          pendingRef.current.time_per_concept = {
            ...prev,
            [conceptTimerRef.current.concept]: (prev[conceptTimerRef.current.concept] || 0) + elapsed,
          };
        }
        conceptTimerRef.current = { concept: null, start: 0 };
      }
      return;
    }

    // Start timing new concept
    conceptTimerRef.current = { concept: selectedNode.id, start: Date.now() };

    // Track explored concepts
    const explored = new Set([...(userState?.explored_concepts || []), ...(pendingRef.current.explored_concepts || [])]);
    explored.add(selectedNode.id);
    pendingRef.current.explored_concepts = Array.from(explored);
  }, [selectedNode, userState]);

  // Estimate understanding level
  const estimateLevel = useCallback((conceptKey) => {
    if (!userState) return 'unseen';
    const explored = userState.explored_concepts || [];
    if (!explored.includes(conceptKey)) return 'unseen';

    const timeSpent = (userState.time_per_concept || {})[conceptKey] || 0;
    const filesViewed = (userState.explored_files || []).length;

    if (timeSpent < 5) return 'glanced';
    if (timeSpent < 30) return 'beginner';
    if (timeSpent < 120) return 'intermediate';
    return 'advanced';
  }, [userState]);

  // Sync to backend every SYNC_INTERVAL
  useEffect(() => {
    if (!projectId) return;

    const sync = async () => {
      const updates = { ...pendingRef.current };
      if (Object.keys(updates).length === 0) return;
      pendingRef.current = {};

      try {
        await fetch('/api/user-state', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId, ...updates }),
        });
      } catch {}
    };

    const interval = setInterval(sync, SYNC_INTERVAL);
    return () => {
      clearInterval(interval);
      sync(); // Flush on unmount
    };
  }, [projectId]);

  // Track file views
  const trackFileView = useCallback((filePath) => {
    const explored = new Set([...(userState?.explored_files || []), ...(pendingRef.current.explored_files || [])]);
    explored.add(filePath);
    pendingRef.current.explored_files = Array.from(explored);
  }, [userState]);

  // Mark insight as seen
  const markInsightSeen = useCallback((insightId) => {
    const seen = new Set([...(userState?.insights_seen || []), ...(pendingRef.current.insights_seen || [])]);
    seen.add(insightId);
    pendingRef.current.insights_seen = Array.from(seen);
  }, [userState]);

  return { estimateLevel, trackFileView, markInsightSeen };
}
