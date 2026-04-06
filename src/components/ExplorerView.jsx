import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import TopBar from './TopBar';
import GraphCanvas from './GraphCanvas';
import InspectorPanel from './InspectorPanel';
import GuidedOverlay from './GuidedOverlay';
import ChatBar from './ChatBar';
import CodePanel from './CodePanel';
import Onboarding from './Onboarding';
import InsightCard from './InsightCard';
import ExplorationProgress from './ExplorationProgress';
import CompletionSummary from './CompletionSummary';
import useUserState from '../hooks/useUserState';
import useProactive from '../hooks/useProactive';
import useStore from '../store/useStore';
import { fetchAndLoadProject } from '../lib/loadProject';

function Toast() {
  const toast = useStore(s => s.toast);
  if (!toast) return null;

  return (
    <div
      className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 pointer-events-none"
      style={{ animation: 'toast-in 0.2s ease-out' }}
    >
      <div
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium"
        style={{
          background: '#1e1e3a',
          color: '#e2e8f0',
          border: '1px solid rgba(255,255,255,0.1)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        }}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M3.5 7L6 9.5L10.5 4.5" stroke="#10b981" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        {toast}
      </div>
    </div>
  );
}

export default function ExplorerView() {
  const navigate = useNavigate();
  const concepts = useStore(s => s.concepts);
  const projectId = useStore(s => s.projectId);
  const [restoring, setRestoring] = useState(false);

  // Restore project data on refresh (store is empty but localStorage has projectId)
  useEffect(() => {
    if (concepts.length > 0) return; // Already loaded
    if (projectId) return; // Store has projectId but no concepts — let it settle

    const savedId = localStorage.getItem('cbe_project_id');
    if (!savedId) {
      navigate('/', { replace: true });
      return;
    }

    setRestoring(true);
    useStore.getState().setProjectId(savedId);
    fetchAndLoadProject(savedId).then(result => {
      setRestoring(false);
      if (!result) {
        localStorage.removeItem('cbe_project_id');
        navigate('/', { replace: true });
      }
    });
  }, [concepts.length, projectId, navigate]);

  // Activate user state tracking and proactive engine
  useUserState();
  useProactive();

  if (restoring) {
    return (
      <div className="w-full h-full flex items-center justify-center" style={{ background: '#0a0a1a' }}>
        <div className="flex items-center gap-3">
          <div
            className="w-2 h-2 rounded-full"
            style={{ background: '#6366f1', animation: 'processing-dot 1.4s infinite' }}
          />
          <span className="text-sm font-medium" style={{ color: '#94a3b8' }}>
            Restoring your codebase...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full relative" style={{ background: '#0a0a1a' }}>
      <TopBar />
      <GraphCanvas />
      <GuidedOverlay />
      <InspectorPanel />
      <ExplorationProgress />
      <InsightCard />
      <ChatBar />
      <CodePanel />
      <Onboarding />
      <CompletionSummary />
      <Toast />
    </div>
  );
}
