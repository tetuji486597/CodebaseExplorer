import { useCallback } from 'react';
import { useNavigate } from 'react-router';
import useStore from '../store/useStore';
import { fetchAndLoadProject } from '../lib/loadProject';
import { API_BASE } from '../lib/api';

/**
 * Shared hook that listens to pipeline SSE progress and navigates on completion.
 * Call `startListening(projectId)` after kicking off an analysis.
 */
export function usePipelineListener() {
  const navigate = useNavigate();
  const setProcessingStatus = useStore(s => s.setProcessingStatus);

  const startListening = useCallback((projectId, retryCount = 0) => {
    const maxRetries = 10;
    const es = new EventSource(`${API_BASE}/api/pipeline/${projectId}/stream`);

    es.addEventListener('progress', (e) => {
      const { status, progress } = JSON.parse(e.data);
      useStore.getState().setPipelineStatus(status);
      useStore.getState().setPipelineProgress(progress);
      if (progress?.message) setProcessingStatus(progress.message);

      if (status === 'complete') {
        localStorage.removeItem('cbe_active_project');
        es.close();
        fetchAndLoadProject(projectId).then((ok) => {
          if (ok) navigate('/overview', { replace: true });
          else console.error('Failed to load project data');
        });
      }

      if (status === 'failed') {
        localStorage.removeItem('cbe_active_project');
        setProcessingStatus('Pipeline failed. Please try again.');
        es.close();
      }
    });

    es.onerror = () => {
      es.close();
      if (retryCount < maxRetries) {
        const delay = Math.min(2000 * Math.pow(1.5, retryCount), 15000);
        setProcessingStatus('Connection lost, reconnecting...');
        setTimeout(() => startListening(projectId, retryCount + 1), delay);
      } else {
        fetchAndLoadProject(projectId).then((ok) => {
          if (ok) navigate('/overview', { replace: true });
        });
      }
    };
  }, [navigate, setProcessingStatus]);

  return { startListening };
}
