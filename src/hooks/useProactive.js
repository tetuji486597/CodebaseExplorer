import { useEffect, useRef, useCallback } from 'react';
import useStore from '../store/useStore';
import { API_BASE } from '../lib/api';

const PROACTIVE_INTERVAL = 15000; // Check every 15 seconds

export default function useProactive() {
  const projectId = useStore(s => s.projectId);
  const selectedNode = useStore(s => s.selectedNode);
  const concepts = useStore(s => s.concepts);
  const insights = useStore(s => s.insights);
  const setPulsingNodeId = useStore(s => s.setPulsingNodeId);
  const setInsightCard = useStore(s => s.setInsightCard);
  const setSuggestionBanner = useStore(s => s.setSuggestionBanner);
  const setExplorationProgress = useStore(s => s.setExplorationProgress);
  const setConnectionHighlight = useStore(s => s.setConnectionHighlight);

  const intervalRef = useRef(null);

  const fetchAction = useCallback(async () => {
    if (!projectId) return;

    try {
      const res = await fetch(`${API_BASE}/api/proactive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
      });
      const action = await res.json();

      switch (action.action) {
        case 'highlight_concept':
          setPulsingNodeId(action.target_id);
          if (action.message) setSuggestionBanner(action.message);
          break;
        case 'show_insight': {
          const insight = insights.find(i => i.id === action.target_id);
          if (insight) {
            setInsightCard({
              id: insight.id,
              title: insight.title,
              summary: insight.summary,
              detail: insight.detail,
              category: insight.category,
            });
          }
          break;
        }
        case 'suggest_connection':
          setConnectionHighlight(action.target_id);
          if (action.message) setSuggestionBanner(action.message);
          break;
        case 'deepen_current':
          if (action.message) setSuggestionBanner(action.message);
          break;
        case 'show_summary':
          if (action.message) setSuggestionBanner(action.message);
          break;
        case 'nothing':
        default:
          break;
      }
    } catch {}
  }, [projectId, insights, setPulsingNodeId, setInsightCard, setSuggestionBanner, setConnectionHighlight]);

  // Update exploration progress
  useEffect(() => {
    const userState = useStore.getState().userState;
    if (concepts.length > 0 && userState) {
      const explored = (userState.explored_concepts || []).length;
      setExplorationProgress(explored / concepts.length);
    }
  }, [concepts, selectedNode]);

  // Periodic proactive checks
  useEffect(() => {
    if (!projectId) return;

    // Initial check after a short delay
    const timeout = setTimeout(fetchAction, 3000);
    intervalRef.current = setInterval(fetchAction, PROACTIVE_INTERVAL);

    return () => {
      clearTimeout(timeout);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [projectId, fetchAction]);

  // Re-check on node selection changes
  useEffect(() => {
    if (projectId && selectedNode) {
      const timeout = setTimeout(fetchAction, 1000);
      return () => clearTimeout(timeout);
    }
  }, [selectedNode, projectId, fetchAction]);

  return { fetchAction };
}
