import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router';
import useStore from '../store/useStore';
import { fetchAndLoadProject } from '../lib/loadProject';
import { API_BASE } from '../lib/api';
import { CONCEPT_COLORS } from '../data/sampleData';
import RrwebPlayer from './RrwebPlayer';
import NarrationPanel from './NarrationPanel';
import { ArrowLeft, ArrowRight, Compass } from 'lucide-react';

export default function AppPreviewScreen() {
  const { id } = useParams();
  const navigate = useNavigate();
  const setPreviewBridgeFrom = useStore(s => s.setPreviewBridgeFrom);
  const setAppPreviewData = useStore(s => s.setAppPreviewData);

  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentTimeMs, setCurrentTimeMs] = useState(0);
  const [loadingExplorer, setLoadingExplorer] = useState(false);
  const [rrwebEvents, setRrwebEvents] = useState([]);

  // Fetch preview data
  useEffect(() => {
    if (!id) return;

    const fetchPreview = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/curated/${id}/preview`);
        if (!res.ok) {
          setError('No preview available for this codebase');
          setLoading(false);
          return;
        }
        const data = await res.json();
        setPreview(data);
        setAppPreviewData(data);
        setLoading(false);

        // If rrweb mode, fetch the recording
        if (data.mode === 'rrweb' && data.rrweb_events_url) {
          try {
            const eventsRes = await fetch(data.rrweb_events_url);
            const events = await eventsRes.json();
            setRrwebEvents(events);
          } catch (err) {
            console.error('Failed to load rrweb recording:', err);
          }
        }
      } catch (err) {
        console.error('AppPreviewScreen fetch error:', err);
        setError('Failed to load preview');
        setLoading(false);
      }
    };

    fetchPreview();
  }, [id, setAppPreviewData]);

  // Build concept color map for NarrationPanel
  const conceptColors = {};
  if (preview?.narration_steps) {
    preview.narration_steps.forEach(step => {
      if (step.concept_bridge?.concept_key) {
        const key = step.concept_bridge.concept_key;
        // Try to get color from CONCEPT_COLORS, fall back to indigo
        const colorEntry = CONCEPT_COLORS[step.concept_bridge.color] || CONCEPT_COLORS.indigo || {};
        conceptColors[key] = colorEntry;
      }
    });
  }

  // Handle bridge to explorer
  const handleBridgeConcept = useCallback(async (conceptKey, narrationTitle) => {
    setLoadingExplorer(true);

    // Set bridge context in store
    setPreviewBridgeFrom({ conceptKey, narrationTitle, previewId: id });

    try {
      // Load the curated codebase (creates project if needed)
      const loadRes = await fetch(`${API_BASE}/api/curated/${id}/load`, { method: 'POST' });
      const { projectId } = await loadRes.json();
      localStorage.setItem('cbe_curated_id', id);

      const result = await fetchAndLoadProject(projectId);
      if (result) {
        // Navigate to explorer with concept pre-selected
        const store = useStore.getState();
        store.setSelectedNode({ type: 'concept', id: conceptKey });
        store.setShowInspector(true);
        navigate('/explorer', { replace: true });
      } else {
        setLoadingExplorer(false);
      }
    } catch (err) {
      console.error('Failed to load codebase for bridge:', err);
      setLoadingExplorer(false);
    }
  }, [id, navigate, setPreviewBridgeFrom]);

  // Skip preview and go straight to explorer
  const handleSkipToExplorer = useCallback(async () => {
    setLoadingExplorer(true);
    try {
      const loadRes = await fetch(`${API_BASE}/api/curated/${id}/load`, { method: 'POST' });
      const { projectId } = await loadRes.json();
      localStorage.setItem('cbe_curated_id', id);

      const result = await fetchAndLoadProject(projectId);
      if (result) {
        navigate('/overview', { replace: true });
      } else {
        setLoadingExplorer(false);
      }
    } catch (err) {
      console.error('Failed to load codebase:', err);
      setLoadingExplorer(false);
    }
  }, [id, navigate]);

  // Loading state
  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center" style={{ background: 'var(--color-bg-base)' }}>
        <div className="flex items-center gap-3">
          <div
            className="w-2 h-2 rounded-full"
            style={{ background: 'var(--color-accent)', animation: 'processing-dot 1.4s infinite' }}
          />
          <span className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
            Loading preview...
          </span>
        </div>
      </div>
    );
  }

  // Error / no preview available
  if (error || !preview) {
    return (
      <div className="w-full h-full flex items-center justify-center" style={{ background: 'var(--color-bg-base)' }}>
        <div className="text-center max-w-sm px-4">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: 'var(--color-accent-soft)', border: '1px solid rgba(99, 102, 241, 0.15)' }}
          >
            <Compass size={24} style={{ color: 'var(--color-accent)' }} />
          </div>
          <p className="text-sm font-medium mb-2" style={{ color: 'var(--color-text-primary)' }}>
            {error || 'No preview available'}
          </p>
          <p className="text-xs mb-6" style={{ color: 'var(--color-text-tertiary)' }}>
            You can still explore the codebase architecture directly.
          </p>
          <button
            onClick={handleSkipToExplorer}
            disabled={loadingExplorer}
            className="px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 active:scale-[0.98]"
            style={{
              background: 'var(--color-accent-soft)',
              color: 'var(--color-accent-active)',
              border: '1px solid rgba(99, 102, 241, 0.25)',
            }}
          >
            {loadingExplorer ? 'Loading...' : 'Explore architecture'}
          </button>
        </div>
      </div>
    );
  }

  // Loading explorer overlay
  if (loadingExplorer) {
    return (
      <div className="w-full h-full flex items-center justify-center" style={{ background: 'var(--color-bg-base)' }}>
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center"
              style={{ background: 'var(--color-accent-soft)' }}
            >
              <Compass size={22} style={{ color: 'var(--color-accent)', animation: 'spin 2s linear infinite' }} />
            </div>
          </div>
          <div className="text-center">
            <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
              Loading the architecture graph...
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--color-text-tertiary)' }}>
              Preparing to show you how this works under the hood
            </p>
          </div>
        </div>
      </div>
    );
  }

  const previewMode = preview.mode || (preview.rrweb_events_url ? 'rrweb' : 'iframe');
  const markers = (preview.narration_steps || [])
    .filter(s => s.timestamp_ms != null)
    .map(s => ({ timestamp_ms: s.timestamp_ms, label: s.title }));

  return (
    <div className="w-full h-full flex flex-col" style={{ background: 'var(--color-bg-base)' }}>
      {/* Top bar */}
      <div
        className="shrink-0 flex items-center justify-between px-5 py-3 z-20"
        style={{
          background: 'var(--color-bg-elevated)',
          backdropFilter: 'blur(16px)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/library')}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200"
            style={{ color: 'var(--color-text-tertiary)', background: 'var(--color-bg-sunken)' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-border-subtle)'; e.currentTarget.style.color = 'var(--color-text-secondary)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'var(--color-bg-sunken)'; e.currentTarget.style.color = 'var(--color-text-tertiary)'; }}
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <span className="font-heading text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
              {preview.app_name || 'App Preview'}
            </span>
            <span className="text-[11px] ml-2" style={{ color: 'var(--color-text-tertiary)' }}>
              See it in action, then explore the code
            </span>
          </div>
        </div>

        <button
          onClick={handleSkipToExplorer}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all duration-200"
          style={{
            color: 'var(--color-text-tertiary)',
            background: 'var(--color-bg-sunken)',
            border: '1px solid rgba(255,255,255,0.06)',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-border-subtle)'; e.currentTarget.style.color = 'var(--color-text-secondary)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'var(--color-bg-sunken)'; e.currentTarget.style.color = 'var(--color-text-tertiary)'; }}
        >
          Skip to architecture
          <ArrowRight size={11} />
        </button>
      </div>

      {/* Main content — split layout */}
      <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">
        {/* Left: App preview player */}
        <div
          className="md:flex-[3] flex flex-col min-h-0 p-3 md:p-4"
          style={{ minHeight: '45dvh' }}
        >
          <div
            className="flex-1 rounded-xl overflow-hidden flex flex-col"
            style={{
              border: '1px solid rgba(255,255,255,0.06)',
              boxShadow: '0 4px 24px rgba(0,0,0,0.25)',
            }}
          >
            <RrwebPlayer
              mode={previewMode}
              events={rrwebEvents}
              iframeUrl={preview.iframe_url || ''}
              appName={preview.app_name || 'App'}
              appUrl={preview.app_url || 'localhost:3000'}
              thumbnailUrl={preview.thumbnail_url || ''}
              markers={markers}
              onTimeUpdate={setCurrentTimeMs}
              onSkipToExplorer={handleSkipToExplorer}
              onError={() => { /* fallback UI is rendered inside RrwebPlayer */ }}
            />
          </div>
        </div>

        {/* Right: Narration panel */}
        <div
          className="md:flex-[2] flex flex-col min-h-0"
          style={{
            borderLeft: '1px solid rgba(255,255,255,0.06)',
            maxHeight: 'calc(100dvh - 52px)',
          }}
        >
          <NarrationPanel
            steps={preview.narration_steps || []}
            currentTimeMs={currentTimeMs}
            mode={previewMode}
            conceptColors={conceptColors}
            onBridgeConcept={handleBridgeConcept}
          />
        </div>
      </div>
    </div>
  );
}
