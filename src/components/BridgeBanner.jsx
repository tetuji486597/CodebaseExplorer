import { useCallback } from 'react';
import { useNavigate } from 'react-router';
import useStore from '../store/useStore';
import { ArrowLeft, Zap } from 'lucide-react';

/**
 * BridgeBanner — contextual banner shown in InspectorPanel when the user
 * arrived from the AppPreviewScreen via a concept bridge CTA.
 * Explains "you just saw this in action" and provides a "Back to preview" link.
 */
export default function BridgeBanner() {
  const navigate = useNavigate();
  const previewBridgeFrom = useStore(s => s.previewBridgeFrom);
  const clearPreviewBridge = useStore(s => s.clearPreviewBridge);

  const handleReturnToPreview = useCallback(() => {
    const previewId = previewBridgeFrom?.previewId;
    clearPreviewBridge();
    if (previewId) {
      navigate(`/library/${previewId}/preview`);
    }
  }, [previewBridgeFrom, clearPreviewBridge, navigate]);

  const handleDismiss = useCallback(() => {
    clearPreviewBridge();
  }, [clearPreviewBridge]);

  if (!previewBridgeFrom) return null;

  return (
    <div
      className="rounded-xl p-4 mb-1"
      style={{
        background: 'linear-gradient(135deg, var(--color-accent-soft), rgba(16, 185, 129, 0.06))',
        border: '1px solid var(--color-accent-soft)',
        animation: 'fade-in 0.3s ease-out',
      }}
    >
      <div className="flex items-start gap-3">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: 'var(--color-accent-soft)' }}
        >
          <Zap size={14} style={{ color: 'var(--color-accent-active)' }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-semibold" style={{ color: '#c7d2fe' }}>
            You just saw this in action
          </p>
          {previewBridgeFrom.narrationTitle && (
            <p className="text-[11px] mt-1 leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
              When the user performed "{previewBridgeFrom.narrationTitle}", this is
              the system that made it happen.
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 mt-3">
        <button
          onClick={handleReturnToPreview}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all duration-200 active:scale-95"
          style={{
            background: 'var(--color-accent-soft)',
            color: 'var(--color-accent-active)',
            border: '1px solid var(--color-border-strong)',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-border-strong)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'var(--color-accent-soft)'; }}
        >
          <ArrowLeft size={11} />
          Back to preview
        </button>
        <button
          onClick={handleDismiss}
          className="px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all duration-200"
          style={{ color: 'var(--color-text-tertiary)' }}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--color-text-secondary)'; }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--color-text-tertiary)'; }}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
