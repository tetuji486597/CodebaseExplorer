import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Reorder } from 'framer-motion';
import useStore from '../store/useStore';
import useQuizGate from '../hooks/useQuizGate';
import { CONCEPT_COLORS } from '../data/sampleData';
import {
  Brain, Trophy, CheckCircle2, XCircle, ChevronRight,
  GripVertical, Lightbulb, ArrowUp, ArrowDown, SkipForward,
  X, BellOff,
} from 'lucide-react';

const LETTER_LABELS = ['A', 'B', 'C', 'D', 'E', 'F'];

/* ── Linkify concept/file references ─────────────────────────────── */
function ConceptLinkedText({ text, concepts, files, onSelectConcept, onSelectFile }) {
  if (!text) return null;

  const conceptNames = concepts.map(c => c.name).filter(Boolean);
  const filePaths = files.map(f => f.path || f.name).filter(Boolean);

  // Build a combined regex matching concept names and file paths
  const allPatterns = [...conceptNames, ...filePaths]
    .sort((a, b) => b.length - a.length) // match longest first
    .map(p => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

  if (allPatterns.length === 0) return <>{text}</>;

  const regex = new RegExp(`(${allPatterns.join('|')})`, 'g');
  const parts = text.split(regex);

  return (
    <>
      {parts.map((part, i) => {
        const concept = concepts.find(c => c.name === part);
        if (concept) {
          return (
            <button
              key={i}
              onClick={(e) => { e.stopPropagation(); onSelectConcept(concept.id); }}
              className="quiz-concept-link"
            >
              {part}
            </button>
          );
        }
        const file = files.find(f => (f.path || f.name) === part);
        if (file) {
          return (
            <button
              key={i}
              onClick={(e) => { e.stopPropagation(); onSelectFile(file.id); }}
              className="quiz-file-link"
            >
              {part}
            </button>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

export default function QuizGate() {
  const {
    quizGateQuestions, quizGateType, quizCurrentIndex, quizAnswers,
    setQuizCurrentIndex, addQuizAnswer, concepts, files, quizStats,
    advanceGuided, guidedPosition, explorationPath,
    setSelectedNode, setShowInspector, setViewMode,
    quizDisabled, setQuizDisabled, resetQuizGate,
  } = useStore();
  const { submitAnswer, skipReview, completeGate } = useQuizGate();

  const [phase, setPhase] = useState('answering');
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [feedbackData, setFeedbackData] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [transitioning, setTransitioning] = useState(false);

  // Drag state
  const cardRef = useRef(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const draggingRef = useRef(false);
  const [isDragged, setIsDragged] = useState(false);

  const question = quizGateQuestions[quizCurrentIndex];
  const isCheckpoint = quizGateType === 'checkpoint';
  const totalQuestions = quizGateQuestions.length;

  const conceptForQuestion = useMemo(() => {
    if (!question) return null;
    return concepts.find(c => c.id === question.concept_key);
  }, [question, concepts]);

  const colors = useMemo(() => {
    if (!conceptForQuestion) return CONCEPT_COLORS.gray;
    return CONCEPT_COLORS[conceptForQuestion.color] || CONCEPT_COLORS.gray;
  }, [conceptForQuestion]);

  useEffect(() => {
    setSelectedAnswer(null);
    setFeedbackData(null);
    setPhase('answering');
    setTransitioning(false);
    setIsDragged(false);
  }, [quizCurrentIndex]);

  // Keyboard support
  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      if (phase === 'answering' && question?.question_type === 'multiple_choice') {
        const num = parseInt(e.key);
        if (num >= 1 && num <= (question.options.choices?.length || 4)) {
          e.preventDefault();
          setSelectedAnswer(num - 1);
        }
      }
      if (e.key === 'Enter' && phase === 'answering' && selectedAnswer !== null) {
        e.preventDefault();
        handleSubmitAnswer();
      }
      if (e.key === 'Enter' && phase === 'feedback') {
        e.preventDefault();
        handleNextQuestion();
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        handleSkip();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [phase, selectedAnswer, question]);

  const handleDragStart = useCallback((e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const card = cardRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    dragOffsetRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    draggingRef.current = true;
    document.body.style.cursor = 'grabbing';
    document.body.style.userSelect = 'none';

    const onMove = (ev) => {
      if (!draggingRef.current || !cardRef.current) return;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const cw = cardRef.current.offsetWidth;
      let nx = Math.max(0, Math.min(ev.clientX - dragOffsetRef.current.x, vw - cw));
      let ny = Math.max(0, Math.min(ev.clientY - dragOffsetRef.current.y, vh - 60));
      cardRef.current.style.left = nx + 'px';
      cardRef.current.style.top = ny + 'px';
      cardRef.current.style.bottom = 'auto';
      cardRef.current.style.translate = 'none';
      if (!isDragged) setIsDragged(true);
    };

    const onUp = () => {
      draggingRef.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }, [isDragged]);

  const handleSubmitAnswer = useCallback(async () => {
    if (submitting || selectedAnswer === null || !question) return;
    setSubmitting(true);

    const result = await submitAnswer(question.id, question.concept_key, selectedAnswer);
    addQuizAnswer({ questionId: question.id, correct: result.correct, conceptKey: question.concept_key });
    setFeedbackData(result);
    setPhase('feedback');
    setSubmitting(false);
  }, [submitting, selectedAnswer, question, submitAnswer, addQuizAnswer]);

  const handleNextQuestion = useCallback(() => {
    if (quizCurrentIndex >= totalQuestions - 1) {
      setPhase('summary');
      return;
    }
    setTransitioning(true);
    setTimeout(() => {
      setQuizCurrentIndex(quizCurrentIndex + 1);
      setTimeout(() => setTransitioning(false), 150);
    }, 100);
  }, [quizCurrentIndex, totalQuestions, setQuizCurrentIndex]);

  const handleContinue = useCallback(() => {
    completeGate();
    setTimeout(() => advanceGuided(), 50);
  }, [completeGate, advanceGuided]);

  const handleSkip = useCallback(async () => {
    await skipReview();
    setTimeout(() => advanceGuided(), 50);
  }, [skipReview, advanceGuided]);

  const handleDisableQuiz = useCallback(() => {
    setQuizDisabled(true);
    resetQuizGate();
    setTimeout(() => advanceGuided(), 50);
  }, [setQuizDisabled, resetQuizGate, advanceGuided]);

  const handleSelectConcept = useCallback((id) => {
    setSelectedNode({ type: 'concept', id });
    setShowInspector(true);
  }, [setSelectedNode, setShowInspector]);

  const handleSelectFile = useCallback((id) => {
    setViewMode('files');
    setSelectedNode({ type: 'file', id });
    setShowInspector(true);
  }, [setViewMode, setSelectedNode, setShowInspector]);

  if (!question && phase !== 'summary') return null;

  if (phase === 'summary') {
    return <QuizSummary
      answers={[...quizAnswers]}
      questions={quizGateQuestions}
      concepts={concepts}
      quizStats={quizStats}
      isCheckpoint={isCheckpoint}
      onContinue={handleContinue}
    />;
  }

  return (
    <>
      <div
        ref={cardRef}
        className="quiz-card"
        style={{
          opacity: transitioning ? 0 : 1,
          transform: transitioning ? 'translateY(12px)' : 'translateY(0)',
        }}
      >
        {/* Drag handle */}
        <div className="quiz-drag-handle" onPointerDown={handleDragStart}>
          <div className="quiz-drag-handle-grip" />
        </div>

        {/* Header */}
        <div className="quiz-header">
          <div className="quiz-header-icon" data-checkpoint={isCheckpoint || undefined}>
            {isCheckpoint
              ? <Trophy size={16} style={{ color: 'var(--color-warning)' }} />
              : <Brain size={16} style={{ color: 'var(--color-accent-active)' }} />
            }
          </div>
          <div className="quiz-header-text">
            <h2 className="quiz-title">
              {isCheckpoint ? 'Checkpoint Review' : 'Quick Review'}
            </h2>
            {conceptForQuestion && (
              <p className="quiz-subtitle">Testing: {conceptForQuestion.name}</p>
            )}
          </div>

          {/* Progress dots */}
          <div className="quiz-progress-dots">
            {quizGateQuestions.map((_, i) => (
              <div
                key={i}
                className="quiz-dot"
                style={{
                  width: i === quizCurrentIndex ? 18 : 7,
                  height: 7,
                  background: i < quizCurrentIndex
                    ? (quizAnswers[i]?.correct ? 'var(--color-success)' : 'var(--color-error)')
                    : i === quizCurrentIndex
                      ? (isCheckpoint ? 'var(--color-warning)' : 'var(--color-accent)')
                      : 'var(--color-border-subtle)',
                }}
              />
            ))}
          </div>
        </div>

        {/* Question body */}
        <div className="quiz-body">
          {phase === 'answering' && (
            <QuestionRenderer
              question={question}
              selectedAnswer={selectedAnswer}
              onAnswer={setSelectedAnswer}
              colors={colors}
              concepts={concepts}
              files={files}
              onSelectConcept={handleSelectConcept}
              onSelectFile={handleSelectFile}
            />
          )}
          {phase === 'feedback' && feedbackData && (
            <FeedbackRenderer
              question={question}
              feedbackData={feedbackData}
              selectedAnswer={selectedAnswer}
              colors={colors}
              concepts={concepts}
              files={files}
              onSelectConcept={handleSelectConcept}
              onSelectFile={handleSelectFile}
            />
          )}
        </div>

        {/* Footer */}
        <div className="quiz-footer">
          <div className="quiz-footer-left">
            <button onClick={handleSkip} className="quiz-btn-skip">
              <SkipForward size={12} />
              Skip
            </button>
            <button onClick={handleDisableQuiz} className="quiz-btn-disable" title="Turn off quizzes">
              <BellOff size={12} />
            </button>
          </div>

          <div className="quiz-footer-right">
            {phase === 'answering' && (
              <button
                onClick={handleSubmitAnswer}
                disabled={selectedAnswer === null || submitting}
                className="quiz-btn-confirm"
                data-active={selectedAnswer !== null || undefined}
              >
                Confirm
                <ChevronRight size={14} />
              </button>
            )}
            {phase === 'feedback' && (
              <button onClick={handleNextQuestion} className="quiz-btn-next">
                {quizCurrentIndex >= totalQuestions - 1 ? 'See Results' : 'Next'}
                <ChevronRight size={14} />
              </button>
            )}
          </div>
        </div>
      </div>

      <style>{`
        .quiz-card {
          position: fixed;
          z-index: 30;
          bottom: 24px;
          left: 50%;
          translate: -50% 0;
          width: min(540px, calc(100% - 32px));
          max-height: calc(100dvh - 120px);
          border-radius: 16px;
          overflow: hidden;
          background: var(--color-bg-surface);
          border: 1px solid var(--color-border-visible);
          box-shadow: 0 12px 48px rgba(0, 0, 0, 0.5), 0 0 0 1px var(--color-border-subtle);
          transition: opacity 200ms ease-out, transform 200ms ease-out;
          display: flex;
          flex-direction: column;
        }

        .quiz-drag-handle {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 8px 0 2px;
          cursor: grab;
          flex-shrink: 0;
        }
        .quiz-drag-handle:active { cursor: grabbing; }
        .quiz-drag-handle-grip {
          width: 36px;
          height: 4px;
          border-radius: 2px;
          background: var(--color-border-visible);
          transition: background 150ms;
        }
        .quiz-drag-handle:hover .quiz-drag-handle-grip {
          background: var(--color-text-tertiary);
        }

        .quiz-header {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 20px 10px;
        }

        .quiz-header-icon {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          background: var(--color-accent-soft);
          border: 1px solid var(--color-accent-soft);
        }
        .quiz-header-icon[data-checkpoint] {
          background: var(--color-warning-soft);
          border-color: color-mix(in srgb, var(--color-warning) 25%, transparent);
        }

        .quiz-header-text {
          min-width: 0;
          flex: 1;
        }

        .quiz-title {
          font-size: 14px;
          font-weight: 600;
          color: var(--color-text-primary);
          line-height: 1.3;
          margin: 0;
        }

        .quiz-subtitle {
          font-size: 11px;
          color: var(--color-text-tertiary);
          margin: 2px 0 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .quiz-progress-dots {
          display: flex;
          align-items: center;
          gap: 4px;
          flex-shrink: 0;
        }

        .quiz-dot {
          border-radius: 4px;
          transition: all 200ms ease-out;
        }

        .quiz-body {
          padding: 4px 20px 16px;
          overflow-y: auto;
          flex: 1;
          min-height: 0;
          max-height: calc(100dvh - 280px);
        }

        .quiz-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 16px;
          border-top: 1px solid var(--color-border-subtle);
          background: var(--color-bg-elevated);
          flex-shrink: 0;
        }

        .quiz-footer-left {
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .quiz-footer-right {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .quiz-btn-skip {
          display: flex;
          align-items: center;
          gap: 5px;
          padding: 6px 10px;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 500;
          background: transparent;
          border: none;
          color: var(--color-text-tertiary);
          cursor: pointer;
          transition: all 150ms ease-out;
        }
        .quiz-btn-skip:hover {
          color: var(--color-text-secondary);
          background: var(--color-bg-accent);
        }

        .quiz-btn-disable {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
          border-radius: 7px;
          background: transparent;
          border: none;
          color: var(--color-text-tertiary);
          cursor: pointer;
          transition: all 150ms ease-out;
        }
        .quiz-btn-disable:hover {
          color: var(--color-error);
          background: var(--color-error-soft);
        }

        .quiz-btn-confirm {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 7px 16px;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 600;
          background: var(--color-border-subtle);
          border: 1px solid transparent;
          color: var(--color-text-tertiary);
          cursor: default;
          transition: all 150ms ease-out;
        }
        .quiz-btn-confirm[data-active] {
          background: var(--color-accent-soft);
          color: var(--color-accent-active);
          border-color: var(--color-accent-soft);
          cursor: pointer;
        }
        .quiz-btn-confirm[data-active]:hover {
          background: var(--color-accent);
          color: var(--color-text-inverse);
        }
        .quiz-btn-confirm[data-active]:active { transform: scale(0.97); }

        .quiz-btn-next {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 7px 16px;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 600;
          background: var(--color-accent-soft);
          border: 1px solid var(--color-accent-soft);
          color: var(--color-accent-active);
          cursor: pointer;
          transition: all 150ms ease-out;
        }
        .quiz-btn-next:hover {
          background: var(--color-accent);
          color: var(--color-text-inverse);
        }
        .quiz-btn-next:active { transform: scale(0.97); }

        /* Question styling */
        .quiz-question-text {
          font-size: 14px;
          line-height: 1.7;
          color: var(--color-text-primary);
          margin-bottom: 14px;
        }

        .quiz-code-snippet {
          font-size: 12px;
          line-height: 1.6;
          margin-bottom: 14px;
          padding: 14px 16px;
          border-radius: 10px;
          overflow-x: auto;
          background: var(--color-bg-sunken);
          border: 1px solid var(--color-border-subtle);
          color: var(--color-text-secondary);
          font-family: 'JetBrains Mono', monospace;
        }

        .quiz-choices {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .quiz-choice {
          display: flex;
          align-items: center;
          gap: 12px;
          text-align: left;
          font-size: 13px;
          padding: 12px 14px;
          border-radius: 10px;
          transition: all 150ms ease-out;
          cursor: pointer;
          min-height: 48px;
          background: var(--color-bg-elevated);
          border: 1px solid var(--color-border-subtle);
          color: var(--color-text-secondary);
        }
        .quiz-choice:hover {
          border-color: var(--color-border-visible);
          background: var(--color-bg-accent);
        }
        .quiz-choice[data-selected] {
          background: var(--color-accent-soft);
          border-color: var(--color-accent);
          color: var(--color-accent-active);
        }

        .quiz-choice-label {
          width: 28px;
          height: 28px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          font-size: 12px;
          font-weight: 600;
          background: var(--color-bg-surface);
          color: var(--color-text-tertiary);
          transition: all 150ms ease-out;
        }
        .quiz-choice[data-selected] .quiz-choice-label {
          background: color-mix(in srgb, var(--color-accent) 30%, transparent);
          color: var(--color-accent-active);
        }

        /* Concept/file links in quiz text */
        .quiz-concept-link,
        .quiz-file-link {
          display: inline;
          padding: 1px 6px;
          border-radius: 4px;
          font-size: inherit;
          font-weight: 500;
          border: none;
          cursor: pointer;
          transition: all 150ms ease-out;
          line-height: inherit;
        }
        .quiz-concept-link {
          background: color-mix(in srgb, var(--color-accent) 12%, transparent);
          color: var(--color-accent-active);
        }
        .quiz-concept-link:hover {
          background: color-mix(in srgb, var(--color-accent) 25%, transparent);
          text-decoration: underline;
        }
        .quiz-file-link {
          background: color-mix(in srgb, var(--color-success) 12%, transparent);
          color: var(--color-success);
          font-family: 'JetBrains Mono', monospace;
          font-size: 0.9em;
        }
        .quiz-file-link:hover {
          background: color-mix(in srgb, var(--color-success) 25%, transparent);
          text-decoration: underline;
        }

        /* Feedback styling */
        .quiz-feedback-result {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 14px;
        }
        .quiz-feedback-result-text {
          font-size: 15px;
          font-weight: 600;
        }

        .quiz-feedback-answer {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          padding: 10px 14px;
          border-radius: 10px;
          margin-bottom: 6px;
        }

        .quiz-feedback-explanation {
          font-size: 13px;
          line-height: 1.7;
          color: var(--color-text-secondary);
          margin: 14px 0;
        }

        .quiz-streak {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .quiz-streak-label {
          font-size: 11px;
          font-weight: 500;
          color: var(--color-text-tertiary);
        }

        .quiz-streak-dots {
          display: flex;
          align-items: center;
          gap: 4px;
        }

        /* Matching question */
        .quiz-matching-columns {
          display: flex;
          gap: 12px;
        }
        .quiz-matching-column {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .quiz-matching-item {
          text-align: left;
          font-size: 13px;
          padding: 12px 14px;
          border-radius: 10px;
          transition: all 150ms ease-out;
          min-height: 48px;
          background: var(--color-bg-elevated);
          border: 1px solid var(--color-border-subtle);
          color: var(--color-text-secondary);
          cursor: pointer;
        }
        .quiz-matching-item:hover {
          border-color: var(--color-border-visible);
        }
        .quiz-matching-item[data-active],
        .quiz-matching-item[data-paired] {
          background: var(--color-accent-soft);
          border-color: var(--color-accent);
          color: var(--color-accent-active);
        }
        .quiz-matching-pair-tag {
          display: block;
          font-size: 10px;
          margin-top: 4px;
          color: var(--color-accent);
        }
        .quiz-matching-right-label {
          font-size: 11px;
          font-weight: 600;
          margin-right: 6px;
          color: var(--color-text-tertiary);
        }

        /* Ordering question */
        .quiz-ordering-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .quiz-ordering-item {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 13px;
          padding: 12px 14px;
          border-radius: 10px;
          cursor: grab;
          min-height: 48px;
          list-style: none;
          background: var(--color-bg-elevated);
          border: 1px solid var(--color-border-subtle);
          color: var(--color-text-secondary);
        }
        .quiz-ordering-item:active { cursor: grabbing; }
        .quiz-ordering-number {
          width: 28px;
          height: 28px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          font-size: 12px;
          font-weight: 600;
          background: var(--color-accent-soft);
          color: var(--color-accent-active);
        }
        .quiz-ordering-arrows {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        /* Fill-in-the-blank */
        .quiz-fill-blank-sentence {
          font-size: 13px;
          line-height: 2;
          padding: 14px 16px;
          border-radius: 10px;
          background: var(--color-bg-elevated);
          border: 1px solid var(--color-border-subtle);
          color: var(--color-text-secondary);
        }
        .quiz-fill-blank-input {
          display: inline-block;
          font-size: 13px;
          font-weight: 600;
          padding: 2px 8px;
          margin: 0 4px;
          border-radius: 6px;
          outline: none;
          background: var(--color-bg-surface);
          border: none;
          border-bottom: 2px solid var(--color-accent);
          color: var(--color-accent-active);
          font-family: 'JetBrains Mono', monospace;
        }
        .quiz-fill-blank-input:focus {
          box-shadow: var(--shadow-focus);
        }

        .quiz-hint-toggle {
          display: flex;
          align-items: center;
          gap: 5px;
          font-size: 12px;
          font-weight: 500;
          margin-top: 10px;
          color: var(--color-accent);
          cursor: pointer;
          background: none;
          border: none;
          transition: opacity 150ms;
        }
        .quiz-hint-toggle:hover { opacity: 0.8; }

        .quiz-hint-text {
          font-size: 12px;
          margin-top: 6px;
          padding: 8px 12px;
          border-radius: 8px;
          background: var(--color-warning-soft);
          color: var(--color-warning);
        }

        @media (max-width: 767px) {
          .quiz-card {
            bottom: 0 !important;
            left: 0 !important;
            right: 0 !important;
            translate: none !important;
            width: 100% !important;
            max-height: 65dvh !important;
            border-radius: 20px 20px 0 0 !important;
          }
        }
      `}</style>
    </>
  );
}

/* ── Question type renderers ──────────────────────────────────────── */

function QuestionRenderer({ question, selectedAnswer, onAnswer, colors, concepts, files, onSelectConcept, onSelectFile }) {
  switch (question.question_type) {
    case 'multiple_choice':
      return <MultipleChoiceQuestion question={question} selected={selectedAnswer} onSelect={onAnswer} concepts={concepts} files={files} onSelectConcept={onSelectConcept} onSelectFile={onSelectFile} />;
    case 'matching':
      return <MatchingQuestion question={question} selected={selectedAnswer} onSelect={onAnswer} colors={colors} concepts={concepts} files={files} onSelectConcept={onSelectConcept} onSelectFile={onSelectFile} />;
    case 'ordering':
      return <OrderingQuestion question={question} selected={selectedAnswer} onSelect={onAnswer} concepts={concepts} files={files} onSelectConcept={onSelectConcept} onSelectFile={onSelectFile} />;
    case 'fill_blank':
      return <FillBlankQuestion question={question} selected={selectedAnswer} onSelect={onAnswer} concepts={concepts} files={files} onSelectConcept={onSelectConcept} onSelectFile={onSelectFile} />;
    default:
      return <MultipleChoiceQuestion question={question} selected={selectedAnswer} onSelect={onAnswer} concepts={concepts} files={files} onSelectConcept={onSelectConcept} onSelectFile={onSelectFile} />;
  }
}

function MultipleChoiceQuestion({ question, selected, onSelect, concepts, files, onSelectConcept, onSelectFile }) {
  return (
    <div>
      <p className="quiz-question-text">
        <ConceptLinkedText text={question.question_text} concepts={concepts} files={files} onSelectConcept={onSelectConcept} onSelectFile={onSelectFile} />
      </p>

      {question.code_snippet && (
        <pre className="quiz-code-snippet">{question.code_snippet}</pre>
      )}

      <div className="quiz-choices">
        {(question.options.choices || []).map((choice, i) => {
          const isSelected = selected === i;
          return (
            <button
              key={i}
              onClick={() => onSelect(i)}
              className="quiz-choice"
              data-selected={isSelected || undefined}
            >
              <span className="quiz-choice-label">{LETTER_LABELS[i]}</span>
              <span>
                <ConceptLinkedText text={choice} concepts={concepts} files={files} onSelectConcept={onSelectConcept} onSelectFile={onSelectFile} />
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function MatchingQuestion({ question, selected, onSelect, colors, concepts, files, onSelectConcept, onSelectFile }) {
  const { left = [], right = [] } = question.options;
  const [pairs, setPairs] = useState([]);
  const [activeLeft, setActiveLeft] = useState(null);

  useEffect(() => { setPairs([]); setActiveLeft(null); }, [question]);

  useEffect(() => {
    if (pairs.length === left.length) {
      onSelect(pairs);
    } else {
      onSelect(null);
    }
  }, [pairs, left.length, onSelect]);

  const handleLeftClick = (idx) => {
    const existing = pairs.findIndex(p => p[0] === idx);
    if (existing >= 0) {
      setPairs(pairs.filter((_, i) => i !== existing));
      setActiveLeft(idx);
      return;
    }
    setActiveLeft(idx);
  };

  const handleRightClick = (idx) => {
    if (activeLeft === null) return;
    const updated = pairs.filter(p => p[1] !== idx && p[0] !== activeLeft);
    updated.push([activeLeft, idx]);
    setPairs(updated);
    setActiveLeft(null);
  };

  const getPairForLeft = (idx) => pairs.find(p => p[0] === idx);
  const getPairForRight = (idx) => pairs.find(p => p[1] === idx);

  return (
    <div>
      <p className="quiz-question-text">
        <ConceptLinkedText text={question.question_text} concepts={concepts} files={files} onSelectConcept={onSelectConcept} onSelectFile={onSelectFile} />
      </p>

      <div className="quiz-matching-columns">
        <div className="quiz-matching-column">
          {left.map((item, i) => {
            const pair = getPairForLeft(i);
            const isActive = activeLeft === i;
            return (
              <button
                key={i}
                onClick={() => handleLeftClick(i)}
                className="quiz-matching-item"
                data-active={isActive || undefined}
                data-paired={pair ? true : undefined}
              >
                {item}
                {pair && <span className="quiz-matching-pair-tag">Paired {String.fromCharCode(65 + pair[1])}</span>}
              </button>
            );
          })}
        </div>

        <div className="quiz-matching-column">
          {right.map((item, i) => {
            const pair = getPairForRight(i);
            return (
              <button
                key={i}
                onClick={() => handleRightClick(i)}
                className="quiz-matching-item"
                data-paired={pair ? true : undefined}
                style={{ cursor: activeLeft !== null ? 'pointer' : 'default' }}
              >
                <span className="quiz-matching-right-label">{LETTER_LABELS[i]}</span>
                {item}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function OrderingQuestion({ question, selected, onSelect, concepts, files, onSelectConcept, onSelectFile }) {
  const [items, setItems] = useState(() =>
    (question.options.items || []).map((text, i) => ({ id: `item-${i}`, text, originalIndex: i }))
  );

  useEffect(() => {
    setItems((question.options.items || []).map((text, i) => ({ id: `item-${i}`, text, originalIndex: i })));
  }, [question]);

  useEffect(() => {
    const order = items.map(item => item.originalIndex);
    onSelect(order);
  }, [items, onSelect]);

  const moveItem = (fromIndex, direction) => {
    const toIndex = fromIndex + direction;
    if (toIndex < 0 || toIndex >= items.length) return;
    const updated = [...items];
    [updated[fromIndex], updated[toIndex]] = [updated[toIndex], updated[fromIndex]];
    setItems(updated);
  };

  return (
    <div>
      <p className="quiz-question-text">
        <ConceptLinkedText text={question.question_text} concepts={concepts} files={files} onSelectConcept={onSelectConcept} onSelectFile={onSelectFile} />
      </p>

      <Reorder.Group axis="y" values={items} onReorder={setItems} className="quiz-ordering-list">
        {items.map((item, i) => (
          <Reorder.Item
            key={item.id}
            value={item}
            className="quiz-ordering-item"
            whileDrag={{
              scale: 1.02,
              boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
              border: '1px solid var(--color-accent)',
            }}
          >
            <GripVertical size={14} style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }} />
            <span className="quiz-ordering-number">{i + 1}</span>
            <span style={{ flex: 1 }}>{item.text}</span>
            <div className="quiz-ordering-arrows" style={{ display: 'none' }}>
              <button
                onClick={(e) => { e.stopPropagation(); moveItem(i, -1); }}
                disabled={i === 0}
                className="p-0.5 rounded"
                style={{ color: i === 0 ? 'var(--color-bg-elevated)' : 'var(--color-text-tertiary)', cursor: i === 0 ? 'default' : 'pointer', background: 'none', border: 'none' }}
              >
                <ArrowUp size={12} />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); moveItem(i, 1); }}
                disabled={i === items.length - 1}
                className="p-0.5 rounded"
                style={{ color: i === items.length - 1 ? 'var(--color-bg-elevated)' : 'var(--color-text-tertiary)', cursor: i === items.length - 1 ? 'default' : 'pointer', background: 'none', border: 'none' }}
              >
                <ArrowDown size={12} />
              </button>
            </div>
          </Reorder.Item>
        ))}
      </Reorder.Group>
      <style>{`
        @media (max-width: 767px) {
          .quiz-ordering-arrows { display: flex !important; }
        }
      `}</style>
    </div>
  );
}

function FillBlankQuestion({ question, selected, onSelect, concepts, files, onSelectConcept, onSelectFile }) {
  const [showHint, setShowHint] = useState(false);
  const { sentence = '', hints = [] } = question.options;

  const handleChange = (e) => onSelect(e.target.value);
  const handleKeyDown = (e) => { if (e.key === 'Enter') e.stopPropagation(); };

  const parts = sentence.split('___');

  return (
    <div>
      <p className="quiz-question-text">
        <ConceptLinkedText text={question.question_text} concepts={concepts} files={files} onSelectConcept={onSelectConcept} onSelectFile={onSelectFile} />
      </p>

      {question.code_snippet && (
        <pre className="quiz-code-snippet">{question.code_snippet}</pre>
      )}

      <div className="quiz-fill-blank-sentence">
        {parts[0]}
        <input
          type="text"
          value={selected || ''}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="..."
          className="quiz-fill-blank-input"
          style={{ width: Math.max(60, (selected?.length || 3) * 10 + 20) }}
          autoFocus
        />
        {parts[1]}
      </div>

      {hints.length > 0 && (
        <button onClick={() => setShowHint(!showHint)} className="quiz-hint-toggle">
          <Lightbulb size={12} />
          {showHint ? 'Hide hint' : 'Show hint'}
        </button>
      )}
      {showHint && hints[0] && <p className="quiz-hint-text">{hints[0]}</p>}
    </div>
  );
}

/* ── Feedback renderer ────────────────────────────────────────────── */

function FeedbackRenderer({ question, feedbackData, selectedAnswer, colors, concepts, files, onSelectConcept, onSelectFile }) {
  const { correct, explanation, newStreak } = feedbackData;

  return (
    <div>
      <div className="quiz-feedback-result">
        {correct ? (
          <>
            <CheckCircle2 size={20} style={{ color: 'var(--color-success)' }} />
            <span className="quiz-feedback-result-text" style={{ color: 'var(--color-success)' }}>Correct!</span>
          </>
        ) : (
          <>
            <XCircle size={20} style={{ color: 'var(--color-error)' }} />
            <span className="quiz-feedback-result-text" style={{ color: 'var(--color-error)' }}>Not quite</span>
          </>
        )}
      </div>

      {!correct && question.question_type === 'multiple_choice' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
          {(question.options.choices || []).map((choice, i) => {
            const isCorrect = i === question.correct_answer.index;
            const isUserAnswer = i === selectedAnswer;
            if (!isCorrect && !isUserAnswer) return null;
            return (
              <div
                key={i}
                className="quiz-feedback-answer"
                style={{
                  background: isCorrect ? 'var(--color-success-soft)' : 'var(--color-error-soft)',
                  border: `1px solid color-mix(in srgb, ${isCorrect ? 'var(--color-success)' : 'var(--color-error)'} 25%, transparent)`,
                  color: isCorrect ? 'var(--color-success)' : 'var(--color-error)',
                }}
              >
                {isCorrect ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                <span style={{ fontWeight: 500, marginRight: 4 }}>{LETTER_LABELS[i]}</span>
                <span>{choice}</span>
                <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--color-text-tertiary)' }}>
                  {isCorrect ? 'correct' : 'your answer'}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <p className="quiz-feedback-explanation">
        <ConceptLinkedText text={explanation} concepts={concepts} files={files} onSelectConcept={onSelectConcept} onSelectFile={onSelectFile} />
      </p>

      <div className="quiz-streak">
        <span className="quiz-streak-label">{correct ? 'Streak:' : 'Streak reset:'}</span>
        <div className="quiz-streak-dots">
          {[0, 1, 2].map(i => (
            <div
              key={i}
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: i < newStreak ? 'var(--color-success)' : 'var(--color-border-subtle)',
                transform: i < newStreak ? 'scale(1)' : 'scale(0.8)',
                transition: 'all 300ms ease-out',
                transitionDelay: `${i * 50}ms`,
              }}
            />
          ))}
          {newStreak >= 3 && (
            <span style={{ fontSize: 10, fontWeight: 500, marginLeft: 4, color: 'var(--color-success)' }}>
              Mastered
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Summary ──────────────────────────────────────────────────────── */

function QuizSummary({ answers, questions, concepts, quizStats, isCheckpoint, onContinue }) {
  const correctCount = answers.filter(a => a.correct).length;
  const totalCount = answers.length;
  const testedConcepts = [...new Set(answers.map(a => a.conceptKey))];

  const messages = [
    "Keep going! You're building solid understanding.",
    "Great recall! The spaced review is working.",
    "Nice work! Each review strengthens your mental model.",
    "You're making strong connections across the codebase.",
  ];
  const message = messages[Math.floor(Math.random() * messages.length)];

  return (
    <div
      className="quiz-card"
      style={{ animation: 'fade-in 0.25s ease-out' }}
    >
      <div style={{ padding: '24px 24px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          {isCheckpoint
            ? <Trophy size={20} style={{ color: 'var(--color-warning)' }} />
            : <CheckCircle2 size={20} style={{ color: 'var(--color-success)' }} />
          }
          <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text-primary)', margin: 0 }}>
            {isCheckpoint ? 'Checkpoint Complete' : 'Review Complete'}
          </h2>
        </div>

        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <span
            style={{
              fontSize: 36,
              fontWeight: 700,
              color: correctCount === totalCount ? 'var(--color-success)' : 'var(--color-text-primary)',
            }}
          >
            {correctCount}
          </span>
          <span style={{ fontSize: 18, color: 'var(--color-text-tertiary)' }}>
            {' / '}{totalCount} correct
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
          {testedConcepts.map(key => {
            const concept = concepts.find(c => c.id === key);
            const stats = quizStats[key] || { streak: 0 };
            const cColors = concept ? (CONCEPT_COLORS[concept.color] || CONCEPT_COLORS.gray) : CONCEPT_COLORS.gray;
            return (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 500, color: cColors.accent, width: 110, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {concept?.name || key}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, flex: 1 }}>
                  {[0, 1, 2].map(i => (
                    <div
                      key={i}
                      style={{
                        width: 9,
                        height: 9,
                        borderRadius: '50%',
                        background: i < stats.streak ? 'var(--color-success)' : 'var(--color-border-subtle)',
                        transition: 'all 300ms ease-out',
                        transitionDelay: `${i * 50}ms`,
                      }}
                    />
                  ))}
                  {stats.streak >= 3 && (
                    <span style={{ fontSize: 10, fontWeight: 500, marginLeft: 4, color: 'var(--color-success)' }}>
                      Mastered
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <p style={{ fontSize: 12, textAlign: 'center', lineHeight: 1.6, color: 'var(--color-text-tertiary)' }}>
          {message}
        </p>
      </div>

      <div className="quiz-footer" style={{ justifyContent: 'flex-end' }}>
        <button
          onClick={onContinue}
          className="quiz-btn-next"
          style={{
            background: 'var(--color-success-soft)',
            color: 'var(--color-success)',
            borderColor: 'color-mix(in srgb, var(--color-success) 30%, transparent)',
          }}
        >
          Continue
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}
