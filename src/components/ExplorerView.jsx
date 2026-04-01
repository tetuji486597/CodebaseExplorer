import TopBar from './TopBar';
import GraphCanvas from './GraphCanvas';
import InspectorPanel from './InspectorPanel';
import ChatBar from './ChatBar';
import CodePanel from './CodePanel';
import Onboarding from './Onboarding';
import InsightCard from './InsightCard';
import ExplorationProgress from './ExplorationProgress';
import useUserState from '../hooks/useUserState';
import useProactive from '../hooks/useProactive';
import useStore from '../store/useStore';

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
  // Activate user state tracking and proactive engine
  useUserState();
  useProactive();

  return (
    <div className="w-full h-full relative" style={{ background: '#0a0a1a' }}>
      <TopBar />
      <GraphCanvas />
      <InspectorPanel />
      <ExplorationProgress />
      <InsightCard />
      <ChatBar />
      <CodePanel />
      <Onboarding />
      <Toast />
    </div>
  );
}
