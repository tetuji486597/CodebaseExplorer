import useStore from '../store/useStore';
import { BellOff, Bell } from 'lucide-react';
import { CONCEPT_COLORS } from '../data/sampleData';
import { getTourChapterProgress } from '../lib/tourPath';

export default function ExplorationProgress() {
  const explorationProgress = useStore(s => s.explorationProgress);
  const quizDisabled = useStore(s => s.quizDisabled);
  const setQuizDisabled = useStore(s => s.setQuizDisabled);
  const guidedMode = useStore(s => s.guidedMode);
  const tourPath = useStore(s => s.tourPath);
  const tourPosition = useStore(s => s.tourPosition);
  const jumpToChapter = useStore(s => s.jumpToChapter);
  const exitGuidedMode = useStore(s => s.exitGuidedMode);

  const showQuizToggle = quizDisabled && guidedMode;
  const progress = guidedMode && tourPath ? getTourChapterProgress(tourPath, tourPosition) : null;

  if (!progress && explorationProgress === 0 && !showQuizToggle) return null;

  const progressPct = progress
    ? Math.round(((progress.currentStop + 1) / progress.totalStops) * 100)
    : Math.round(explorationProgress * 100);

  const chapterColor = progress
    ? (CONCEPT_COLORS[progress.chapterColor] || CONCEPT_COLORS.blue).accent
    : '#6366f1';

  return (
    <>
      <div className="exploration-progress-container">
        {progress ? (
          <div className="tour-progress-pill">
            <div className="tour-progress-header">
              <span className="tour-chapter-label" style={{ color: chapterColor }}>
                Chapter {progress.chapterIndex + 1} of {progress.totalChapters}
              </span>
              <span className="tour-chapter-name">{progress.chapterName}</span>
            </div>

            <div className="tour-chapter-dots">
              {tourPath.chapters.map((ch, i) => {
                const isComplete = i < progress.chapterIndex;
                const isCurrent = i === progress.chapterIndex;
                const dotColor = (CONCEPT_COLORS[ch.color] || CONCEPT_COLORS.blue).accent;
                return (
                  <button
                    key={ch.conceptKey}
                    className={`tour-dot ${isComplete ? 'complete' : ''} ${isCurrent ? 'current' : ''}`}
                    style={{
                      background: isComplete || isCurrent ? dotColor : 'var(--color-bg-sunken, rgba(255,255,255,0.08))',
                      opacity: isCurrent ? 1 : isComplete ? 0.7 : 0.3,
                      borderColor: isCurrent ? dotColor : 'transparent',
                    }}
                    onClick={() => jumpToChapter(i)}
                    title={ch.name}
                  />
                );
              })}
            </div>

            {!progress.isChapterIntro && progress.totalSections > 0 && (
              <span className="tour-section-label">
                Section {progress.sectionIndex + 1} of {progress.totalSections}
              </span>
            )}

            <div className="exploration-pill-track" style={{ width: '100%', marginTop: 4 }}>
              <div
                className="exploration-pill-fill"
                style={{ width: `${progressPct}%`, background: `linear-gradient(90deg, ${chapterColor}, ${chapterColor}cc)` }}
              />
            </div>

            <button className="tour-explore-freely" onClick={exitGuidedMode}>
              Explore freely
            </button>
          </div>
        ) : explorationProgress > 0 ? (
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
        ) : null}

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

        .tour-progress-pill {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          padding: 10px 18px;
          border-radius: 12px;
          background: var(--color-bg-elevated);
          border: 1px solid var(--color-border-subtle);
          backdrop-filter: blur(16px);
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25);
          pointer-events: auto;
          animation: ep-slide-in 300ms ease-out 50ms both;
          min-width: 200px;
        }

        .tour-progress-header {
          display: flex;
          align-items: center;
          gap: 8px;
          width: 100%;
        }

        .tour-chapter-label {
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          white-space: nowrap;
        }

        .tour-chapter-name {
          font-size: 12px;
          font-weight: 600;
          color: var(--color-text-primary);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .tour-chapter-dots {
          display: flex;
          gap: 4px;
          align-items: center;
        }

        .tour-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          border: 1.5px solid transparent;
          cursor: pointer;
          padding: 0;
          transition: all 150ms ease-out;
          flex-shrink: 0;
        }
        .tour-dot:hover {
          transform: scale(1.4);
          opacity: 1 !important;
        }
        .tour-dot.current {
          width: 10px;
          height: 10px;
          box-shadow: 0 0 8px currentColor;
        }

        .tour-section-label {
          font-size: 10px;
          font-weight: 500;
          color: var(--color-text-tertiary);
        }

        .tour-explore-freely {
          font-size: 10px;
          font-weight: 500;
          color: var(--color-text-tertiary);
          background: none;
          border: none;
          cursor: pointer;
          padding: 2px 0;
          transition: color 120ms;
        }
        .tour-explore-freely:hover {
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
          height: 4px;
          border-radius: 2px;
          background: var(--color-bg-sunken, var(--color-border-subtle));
          overflow: hidden;
        }

        .exploration-pill-fill {
          height: 100%;
          border-radius: 2px;
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
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
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
          .tour-progress-pill { min-width: 160px; padding: 8px 12px; }
          .exploration-pill-track { width: 80px; }
          .tour-chapter-name { max-width: 120px; }
        }
      `}</style>
    </>
  );
}
