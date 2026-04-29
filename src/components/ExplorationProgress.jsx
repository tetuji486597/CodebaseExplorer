import useStore from '../store/useStore';
import { BellOff, Bell } from 'lucide-react';

export default function ExplorationProgress() {
  const explorationProgress = useStore(s => s.explorationProgress);
  const quizDisabled = useStore(s => s.quizDisabled);
  const setQuizDisabled = useStore(s => s.setQuizDisabled);
  const guidedMode = useStore(s => s.guidedMode);

  const showQuizToggle = quizDisabled && guidedMode;

  if (explorationProgress === 0 && !showQuizToggle) return null;

  const progressPct = Math.round(explorationProgress * 100);

  return (
    <>
      <div className="exploration-progress-container">
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
          .exploration-pill-track {
            width: 80px;
          }
        }
      `}</style>
    </>
  );
}
