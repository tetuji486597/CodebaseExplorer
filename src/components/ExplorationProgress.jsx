import useStore from '../store/useStore';
import { Sparkles, X, ArrowRight, BellOff, Bell } from 'lucide-react';

export default function ExplorationProgress() {
  const explorationProgress = useStore(s => s.explorationProgress);
  const suggestionBanner = useStore(s => s.suggestionBanner);
  const suggestionBannerAction = useStore(s => s.suggestionBannerAction);
  const setSuggestionBanner = useStore(s => s.setSuggestionBanner);
  const setSelectedNode = useStore(s => s.setSelectedNode);
  const setShowInspector = useStore(s => s.setShowInspector);
  const setViewMode = useStore(s => s.setViewMode);
  const quizDisabled = useStore(s => s.quizDisabled);
  const setQuizDisabled = useStore(s => s.setQuizDisabled);
  const guidedMode = useStore(s => s.guidedMode);

  const showQuizToggle = quizDisabled && guidedMode;

  if (explorationProgress === 0 && !suggestionBanner && !showQuizToggle) return null;

  const progressPct = Math.round(explorationProgress * 100);

  const handleBannerClick = () => {
    if (!suggestionBannerAction?.target_id) return;
    const { action, target_id } = suggestionBannerAction;

    if (action === 'highlight_concept' || action === 'suggest_connection') {
      setSelectedNode({ type: 'concept', id: target_id });
      setShowInspector(true);
    } else if (action === 'deepen_current') {
      setViewMode('files');
      if (target_id) {
        setSelectedNode({ type: 'concept', id: target_id });
        setShowInspector(true);
      }
    }
    setSuggestionBanner(null);
  };

  const isClickable = suggestionBannerAction?.target_id;

  return (
    <>
      <div className="exploration-progress-container">
        {/* Suggestion banner */}
        {suggestionBanner && (
          <div
            className={`suggestion-banner ${isClickable ? 'suggestion-banner--clickable' : ''}`}
            onClick={isClickable ? handleBannerClick : undefined}
            role={isClickable ? 'button' : undefined}
            tabIndex={isClickable ? 0 : undefined}
          >
            <Sparkles size={14} strokeWidth={1.75} className="suggestion-banner-icon" />
            <span className="suggestion-banner-text">{suggestionBanner}</span>
            {isClickable && (
              <ArrowRight size={14} strokeWidth={1.75} className="suggestion-banner-arrow" />
            )}
            <button
              onClick={(e) => { e.stopPropagation(); setSuggestionBanner(null); }}
              className="suggestion-banner-dismiss"
              aria-label="Dismiss suggestion"
            >
              <X size={12} strokeWidth={2} />
            </button>
          </div>
        )}

        {/* Progress pill */}
        {explorationProgress > 0 && (
          <div className="exploration-pill">
            <div className="exploration-pill-track">
              <div
                className="exploration-pill-fill"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <span className="exploration-pill-label">
              {progressPct}% explored
            </span>
          </div>
        )}

        {/* Quiz paused indicator */}
        {showQuizToggle && (
          <button
            className="quiz-paused-pill"
            onClick={() => setQuizDisabled(false)}
            title="Click to re-enable quizzes"
          >
            <BellOff size={12} strokeWidth={1.75} />
            <span>Quizzes paused</span>
            <span className="quiz-paused-reenable">
              <Bell size={11} strokeWidth={1.75} />
              Enable
            </span>
          </button>
        )}
      </div>

      <style>{`
        .exploration-progress-container {
          position: absolute;
          top: 60px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 20;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          pointer-events: none;
        }

        .suggestion-banner {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 12px 8px 14px;
          border-radius: 12px;
          font-size: 13px;
          font-weight: 500;
          line-height: 1.4;
          color: var(--color-text-primary);
          background: var(--color-bg-elevated);
          border: 1px solid var(--color-border-visible);
          backdrop-filter: blur(16px);
          box-shadow:
            0 4px 24px rgba(0, 0, 0, 0.3),
            0 0 0 1px rgba(99, 102, 241, 0.06);
          pointer-events: auto;
          animation: ep-slide-in 300ms ease-out;
          max-width: min(420px, 90vw);
        }

        .suggestion-banner--clickable {
          cursor: pointer;
          transition: all 150ms ease-out;
        }
        .suggestion-banner--clickable:hover {
          border-color: var(--color-accent);
          box-shadow:
            0 4px 24px rgba(0, 0, 0, 0.3),
            0 0 12px rgba(99, 102, 241, 0.2);
        }
        .suggestion-banner--clickable:hover .suggestion-banner-arrow {
          transform: translateX(2px);
        }

        .suggestion-banner-icon {
          color: var(--color-warning);
          flex-shrink: 0;
        }

        .suggestion-banner-text {
          flex: 1;
          min-width: 0;
        }

        .suggestion-banner-arrow {
          color: var(--color-accent);
          flex-shrink: 0;
          transition: transform 150ms ease-out;
        }

        .suggestion-banner-dismiss {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 24px;
          height: 24px;
          border-radius: 6px;
          border: none;
          background: transparent;
          color: var(--color-text-tertiary);
          cursor: pointer;
          flex-shrink: 0;
          transition: all 150ms ease-out;
        }
        .suggestion-banner-dismiss:hover {
          background: var(--color-bg-accent);
          color: var(--color-text-secondary);
        }

        .exploration-pill {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 6px 14px;
          border-radius: 10px;
          background: var(--color-bg-elevated);
          border: 1px solid var(--color-border-subtle);
          backdrop-filter: blur(16px);
          box-shadow: 0 2px 12px rgba(0, 0, 0, 0.2);
          pointer-events: auto;
          animation: ep-slide-in 300ms ease-out 50ms both;
        }

        .exploration-pill-track {
          width: 112px;
          height: 6px;
          border-radius: 3px;
          background: var(--color-bg-sunken, var(--color-border-subtle));
          overflow: hidden;
        }

        .exploration-pill-fill {
          height: 100%;
          border-radius: 3px;
          background: linear-gradient(90deg, #6366f1, #8b5cf6);
          box-shadow: 0 0 8px rgba(99, 102, 241, 0.4);
          transition: width 500ms ease-out;
        }

        .exploration-pill-label {
          font-size: 12px;
          font-weight: 500;
          color: var(--color-text-secondary);
          white-space: nowrap;
        }

        @keyframes ep-slide-in {
          from {
            opacity: 0;
            transform: translateY(-8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .quiz-paused-pill {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 5px 10px;
          border-radius: 8px;
          font-size: 11px;
          font-weight: 500;
          background: var(--color-bg-elevated);
          border: 1px solid var(--color-border-subtle);
          color: var(--color-text-tertiary);
          cursor: pointer;
          pointer-events: auto;
          transition: all 150ms ease-out;
          animation: ep-slide-in 300ms ease-out 100ms both;
        }
        .quiz-paused-pill:hover {
          border-color: var(--color-border-visible);
          color: var(--color-text-secondary);
        }
        .quiz-paused-reenable {
          display: none;
          align-items: center;
          gap: 3px;
          color: var(--color-accent-active);
          font-weight: 600;
        }
        .quiz-paused-pill:hover .quiz-paused-reenable {
          display: inline-flex;
        }

        @media (max-width: 480px) {
          .suggestion-banner {
            font-size: 12px;
            padding: 7px 10px 7px 12px;
            gap: 8px;
          }
          .exploration-pill-track {
            width: 80px;
          }
        }
      `}</style>
    </>
  );
}
