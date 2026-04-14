import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { usePostHog } from '@posthog/react';
import TopBar from './TopBar';
import GraphCanvas from './GraphCanvas';
import InspectorPanel from './InspectorPanel';
import GuidedOverlay from './GuidedOverlay';
import ChatPanel from './ChatPanel';
import CommandPalette from './CommandPalette';
import CodePanel from './CodePanel';
import Onboarding from './Onboarding';
import InsightCard from './InsightCard';
import ExplorationProgress from './ExplorationProgress';
import CompletionSummary from './CompletionSummary';
import useUserState from '../hooks/useUserState';
import useProactive from '../hooks/useProactive';
import useEnrichmentPoller from '../hooks/useEnrichmentPoller';
import useStore from '../store/useStore';
import { fetchAndLoadProject } from '../lib/loadProject';
import { MessageSquare } from 'lucide-react';

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
          background: 'var(--color-bg-elevated)',
          color: 'var(--color-text-primary)',
          border: '1px solid var(--color-border-visible)',
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M3.5 7L6 9.5L10.5 4.5" stroke="var(--color-success)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        {toast}
      </div>
    </div>
  );
}

export default function ExplorerView() {
  const navigate = useNavigate();
  const posthog = usePostHog();
  const concepts = useStore(s => s.concepts);
  const projectId = useStore(s => s.projectId);
  const showInspector = useStore(s => s.showInspector);
  const guidedMode = useStore(s => s.guidedMode);
  const chatPanelOpen = useStore(s => s.chatPanelOpen);
  const setChatPanelOpen = useStore(s => s.setChatPanelOpen);
  const setCommandPaletteOpen = useStore(s => s.setCommandPaletteOpen);
  const chatMessages = useStore(s => s.chatMessages);
  const [restoring, setRestoring] = useState(false);

  // Global Cmd+K / Ctrl+K shortcut
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setCommandPaletteOpen]);

  useEffect(() => { posthog.capture('explorer_entered'); }, []);

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

  // Activate user state tracking, proactive engine, and enrichment polling
  useUserState();
  useProactive();
  useEnrichmentPoller();

  if (restoring) {
    return (
      <div className="w-full h-full flex items-center justify-center" style={{ background: 'var(--color-bg-base)' }}>
        <div className="flex items-center gap-3">
          <div
            className="w-2 h-2 rounded-full"
            style={{ background: 'var(--color-accent)', animation: 'processing-dot 1.4s infinite' }}
          />
          <span className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
            Restoring your codebase...
          </span>
        </div>
      </div>
    );
  }

  const gridClasses = [
    'explorer-grid',
    showInspector ? 'inspector-open' : 'no-inspector',
    guidedMode ? 'guided-on' : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={gridClasses}>
      <TopBar />
      <GraphCanvas />
      <InspectorPanel />
      <GuidedOverlay />

      {/* Chat system */}
      <ChatPanel />
      <CommandPalette />

      {/* Chat FAB */}
      <button
        className={`chat-fab ${chatMessages.length > 0 && !chatPanelOpen ? 'chat-fab--unread' : ''}`}
        onClick={() => {
          if (chatPanelOpen) {
            setChatPanelOpen(false);
          } else if (chatMessages.length > 0) {
            setChatPanelOpen(true);
          } else {
            setCommandPaletteOpen(true);
          }
        }}
        aria-label="Open chat"
      >
        <MessageSquare size={18} strokeWidth={1.75} />
      </button>

      {/* Floating / overlay elements (above the grid) */}
      <ExplorationProgress />
      <InsightCard />
      <CodePanel />
      <Onboarding />
      <CompletionSummary />
      <Toast />

    </div>
  );
}
