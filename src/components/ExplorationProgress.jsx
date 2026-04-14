import useStore from '../store/useStore';

export default function ExplorationProgress() {
  const explorationProgress = useStore(s => s.explorationProgress);
  const suggestionBanner = useStore(s => s.suggestionBanner);
  const setSuggestionBanner = useStore(s => s.setSuggestionBanner);

  if (explorationProgress === 0 && !suggestionBanner) return null;

  return (
    <div className="absolute top-16 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-2">
      {/* Suggestion banner */}
      {suggestionBanner && (
        <div
          className="flex items-center gap-2.5 px-4 py-2 rounded-xl text-xs font-medium"
          style={{
            background: 'var(--color-bg-elevated)',
            border: '1px solid var(--color-border-visible)',
            backdropFilter: 'blur(12px)',
            color: 'var(--color-accent-active)',
            animation: 'fade-in 0.3s ease-out',
            boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
          }}
        >
          <span style={{ color: 'var(--color-warning)' }}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M6 1L7.5 4.5L11 5.5L8.5 8L9 11.5L6 10L3 11.5L3.5 8L1 5.5L4.5 4.5L6 1Z" fill="currentColor"/>
            </svg>
          </span>
          <span>{suggestionBanner}</span>
          <button
            onClick={() => setSuggestionBanner(null)}
            className="ml-1 text-xs transition-colors duration-200"
            style={{ color: 'var(--color-text-tertiary)' }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--color-text-secondary)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--color-text-tertiary)'}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M2 2L8 8M8 2L2 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
      )}

      {/* Progress bar */}
      {explorationProgress > 0 && (
        <div
          className="flex items-center gap-2.5 px-4 py-1.5 rounded-xl text-xs font-medium"
          style={{
            background: 'var(--color-bg-elevated)',
            border: '1px solid var(--color-border-subtle)',
            backdropFilter: 'blur(12px)',
            boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
          }}
        >
          <div className="w-24 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--color-border-subtle)' }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.round(explorationProgress * 100)}%`,
                background: 'linear-gradient(90deg, #6366f1, #8b5cf6)',
              }}
            />
          </div>
          <span style={{ color: 'var(--color-text-secondary)' }}>
            {Math.round(explorationProgress * 100)}% explored
          </span>
        </div>
      )}
    </div>
  );
}
