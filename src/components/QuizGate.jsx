import { useState, useEffect, useCallback, useMemo } from 'react';
import { Reorder } from 'framer-motion';
import useStore from '../store/useStore';
import useQuizGate from '../hooks/useQuizGate';
import { CONCEPT_COLORS } from '../data/sampleData';
import {
  Brain, Trophy, CheckCircle2, XCircle, ChevronRight,
  GripVertical, Lightbulb, ArrowUp, ArrowDown, SkipForward,
} from 'lucide-react';

const LETTER_LABELS = ['A', 'B', 'C', 'D', 'E', 'F'];

export default function QuizGate() {
  const {
    quizGateQuestions, quizGateType, quizCurrentIndex, quizAnswers,
    setQuizCurrentIndex, addQuizAnswer, concepts, quizStats,
    advanceGuided, guidedPosition, explorationPath,
  } = useStore();
  const { submitAnswer, skipReview, completeGate } = useQuizGate();

  const [phase, setPhase] = useState('answering'); // 'answering' | 'feedback' | 'summary'
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [feedbackData, setFeedbackData] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [transitioning, setTransitioning] = useState(false);

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

  // Reset state when question changes
  useEffect(() => {
    setSelectedAnswer(null);
    setFeedbackData(null);
    setPhase('answering');
    setTransitioning(false);
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
    // Small delay then advance
    setTimeout(() => {
      advanceGuided();
    }, 50);
  }, [completeGate, advanceGuided]);

  const handleSkip = useCallback(async () => {
    await skipReview();
    setTimeout(() => {
      advanceGuided();
    }, 50);
  }, [skipReview, advanceGuided]);

  if (!question && phase !== 'summary') return null;

  // Summary phase
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
        className="guided-card fixed z-30 transition-all duration-200"
        style={{
          opacity: transitioning ? 0 : 1,
          transform: transitioning ? 'translateY(12px)' : 'translateY(0)',
          bottom: 24,
          left: '50%',
          translate: '-50% 0',
          width: 'min(520px, calc(100% - 32px))',
          maxHeight: 'calc(100dvh - 120px)',
        }}
      >
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            background: 'var(--color-bg-surface)',
            border: '1px solid var(--color-border-subtle)',
            boxShadow: '0 8px 48px rgba(0,0,0,0.6), 0 0 0 1px var(--color-border-subtle)',
          }}
        >
          {/* Header */}
          <div className="px-6 pt-4 pb-3 flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              style={{
                background: isCheckpoint ? 'rgba(245, 158, 11, 0.15)' : 'var(--color-accent-soft)',
                border: `1px solid ${isCheckpoint ? 'rgba(245, 158, 11, 0.3)' : 'var(--color-accent-soft)'}`,
              }}
            >
              {isCheckpoint
                ? <Trophy size={16} style={{ color: '#fbbf24' }} />
                : <Brain size={16} style={{ color: 'var(--color-accent-active)' }} />
              }
            </div>
            <div className="min-w-0 flex-1">
              <h2
                className="text-sm font-semibold font-heading"
                style={{ color: 'var(--color-text-primary)' }}
              >
                {isCheckpoint ? 'Checkpoint Review' : 'Quick Review'}
              </h2>
              {conceptForQuestion && (
                <p className="text-[11px] truncate" style={{ color: 'var(--color-text-tertiary)' }}>
                  Testing: {conceptForQuestion.name}
                </p>
              )}
            </div>
            {/* Question progress dots */}
            <div className="flex items-center gap-1.5">
              {quizGateQuestions.map((_, i) => (
                <div
                  key={i}
                  className="rounded-full transition-all duration-200"
                  style={{
                    width: i === quizCurrentIndex ? 16 : 6,
                    height: 6,
                    background: i < quizCurrentIndex
                      ? (quizAnswers[i]?.correct ? 'var(--color-success)' : 'var(--color-error)')
                      : i === quizCurrentIndex
                        ? (isCheckpoint ? '#fbbf24' : 'var(--color-accent)')
                        : 'var(--color-border-subtle)',
                  }}
                />
              ))}
            </div>
          </div>

          {/* Question body */}
          <div className="px-6 pb-3" style={{ overflow: 'auto', maxHeight: 'calc(100dvh - 280px)' }}>
            {phase === 'answering' && (
              <QuestionRenderer
                question={question}
                selectedAnswer={selectedAnswer}
                onAnswer={setSelectedAnswer}
                colors={colors}
              />
            )}
            {phase === 'feedback' && feedbackData && (
              <FeedbackRenderer
                question={question}
                feedbackData={feedbackData}
                selectedAnswer={selectedAnswer}
                colors={colors}
              />
            )}
          </div>

          {/* Footer */}
          <div
            className="flex items-center justify-between px-5 py-3"
            style={{
              borderTop: '1px solid var(--color-border-subtle)',
              background: 'var(--color-border-subtle)',
            }}
          >
            <button
              onClick={handleSkip}
              className="text-[12px] font-medium transition-colors duration-150"
              style={{ color: 'var(--color-text-tertiary)', cursor: 'pointer' }}
              onMouseEnter={e => e.currentTarget.style.color = 'var(--color-text-secondary)'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--color-text-tertiary)'}
            >
              <span className="flex items-center gap-1">
                <SkipForward size={12} />
                Skip review
              </span>
            </button>

            <div className="flex items-center gap-2">
              {phase === 'answering' && (
                <button
                  onClick={handleSubmitAnswer}
                  disabled={selectedAnswer === null || submitting}
                  className="flex items-center gap-1 text-[12px] font-semibold px-4 py-2 rounded-lg transition-all duration-150 active:scale-95"
                  style={{
                    background: selectedAnswer !== null ? 'var(--color-accent-soft)' : 'var(--color-border-subtle)',
                    color: selectedAnswer !== null ? 'var(--color-accent-active)' : '#2a2b3d',
                    border: `1px solid ${selectedAnswer !== null ? 'var(--color-accent-soft)' : 'transparent'}`,
                    cursor: selectedAnswer !== null ? 'pointer' : 'default',
                  }}
                >
                  Confirm
                  <ChevronRight size={14} />
                </button>
              )}
              {phase === 'feedback' && (
                <button
                  onClick={handleNextQuestion}
                  className="flex items-center gap-1 text-[12px] font-semibold px-4 py-2 rounded-lg transition-all duration-150 active:scale-95"
                  style={{
                    background: 'var(--color-accent-soft)',
                    color: 'var(--color-accent-active)',
                    border: '1px solid var(--color-accent-soft)',
                    cursor: 'pointer',
                  }}
                >
                  {quizCurrentIndex >= totalQuestions - 1 ? 'See Results' : 'Next'}
                  <ChevronRight size={14} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 767px) {
          .guided-card {
            bottom: 0 !important;
            left: 0 !important;
            right: 0 !important;
            translate: none !important;
            width: 100% !important;
            max-height: 65dvh !important;
            overflow-y: auto !important;
            border-radius: 20px 20px 0 0 !important;
          }
          .guided-card > div {
            border-radius: 20px 20px 0 0 !important;
          }
        }
      `}</style>
    </>
  );
}

// --- Question type renderers ---

function QuestionRenderer({ question, selectedAnswer, onAnswer, colors }) {
  switch (question.question_type) {
    case 'multiple_choice':
      return <MultipleChoiceQuestion question={question} selected={selectedAnswer} onSelect={onAnswer} />;
    case 'matching':
      return <MatchingQuestion question={question} selected={selectedAnswer} onSelect={onAnswer} colors={colors} />;
    case 'ordering':
      return <OrderingQuestion question={question} selected={selectedAnswer} onSelect={onAnswer} />;
    case 'fill_blank':
      return <FillBlankQuestion question={question} selected={selectedAnswer} onSelect={onAnswer} />;
    default:
      return <MultipleChoiceQuestion question={question} selected={selectedAnswer} onSelect={onAnswer} />;
  }
}

function MultipleChoiceQuestion({ question, selected, onSelect }) {
  return (
    <div>
      <p className="text-[13px] leading-[1.7] mb-3" style={{ color: 'var(--color-text-primary)' }}>
        {question.question_text}
      </p>

      {question.code_snippet && (
        <pre
          className="text-[12px] leading-[1.6] mb-3 px-4 py-3 rounded-lg overflow-x-auto"
          style={{
            background: 'rgba(0,0,0,0.3)',
            border: '1px solid var(--color-border-subtle)',
            color: 'var(--color-text-secondary)',
            fontFamily: 'JetBrains Mono, monospace',
          }}
        >
          {question.code_snippet}
        </pre>
      )}

      <div className="flex flex-col gap-2">
        {(question.options.choices || []).map((choice, i) => {
          const isSelected = selected === i;
          return (
            <button
              key={i}
              onClick={() => onSelect(i)}
              className="flex items-center gap-3 text-left text-[13px] px-3 py-2.5 rounded-lg transition-all duration-150 active:scale-[0.98]"
              style={{
                background: isSelected ? 'var(--color-accent-soft)' : 'var(--color-border-subtle)',
                border: `1px solid ${isSelected ? 'var(--color-accent-soft)' : 'var(--color-border-subtle)'}`,
                color: isSelected ? '#c7d2fe' : 'var(--color-text-secondary)',
                cursor: 'pointer',
                minHeight: 44,
              }}
            >
              <span
                className="w-6 h-6 rounded-md flex items-center justify-center shrink-0 text-[11px] font-semibold"
                style={{
                  background: isSelected ? 'var(--color-accent-soft)' : 'var(--color-border-subtle)',
                  color: isSelected ? 'var(--color-accent-active)' : 'var(--color-text-tertiary)',
                }}
              >
                {LETTER_LABELS[i]}
              </span>
              <span>{choice}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function MatchingQuestion({ question, selected, onSelect, colors }) {
  const { left = [], right = [] } = question.options;
  const [pairs, setPairs] = useState([]);
  const [activeLeft, setActiveLeft] = useState(null);

  useEffect(() => {
    setPairs([]);
    setActiveLeft(null);
  }, [question]);

  useEffect(() => {
    if (pairs.length === left.length) {
      onSelect(pairs);
    } else {
      onSelect(null);
    }
  }, [pairs, left.length, onSelect]);

  const handleLeftClick = (idx) => {
    // If already paired, unpair it
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
    // If this right is already used, remove that pair
    const updated = pairs.filter(p => p[1] !== idx && p[0] !== activeLeft);
    updated.push([activeLeft, idx]);
    setPairs(updated);
    setActiveLeft(null);
  };

  const getPairForLeft = (idx) => pairs.find(p => p[0] === idx);
  const getPairForRight = (idx) => pairs.find(p => p[1] === idx);

  return (
    <div>
      <p className="text-[13px] leading-[1.7] mb-3" style={{ color: 'var(--color-text-primary)' }}>
        {question.question_text}
      </p>

      <div className="flex gap-3">
        {/* Left column */}
        <div className="flex-1 flex flex-col gap-2">
          {left.map((item, i) => {
            const pair = getPairForLeft(i);
            const isActive = activeLeft === i;
            return (
              <button
                key={i}
                onClick={() => handleLeftClick(i)}
                className="text-left text-[12px] px-3 py-2.5 rounded-lg transition-all duration-150"
                style={{
                  background: isActive ? 'var(--color-accent-soft)' : pair ? 'var(--color-accent-soft)' : 'var(--color-border-subtle)',
                  border: `1px solid ${isActive ? 'var(--color-accent-soft)' : pair ? 'var(--color-accent-soft)' : 'var(--color-border-subtle)'}`,
                  color: isActive || pair ? '#c7d2fe' : 'var(--color-text-secondary)',
                  cursor: 'pointer',
                  minHeight: 44,
                }}
              >
                {item}
                {pair && (
                  <span className="block text-[10px] mt-1" style={{ color: 'var(--color-accent)' }}>
                    Paired {String.fromCharCode(65 + pair[1])}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Right column */}
        <div className="flex-1 flex flex-col gap-2">
          {right.map((item, i) => {
            const pair = getPairForRight(i);
            return (
              <button
                key={i}
                onClick={() => handleRightClick(i)}
                className="text-left text-[12px] px-3 py-2.5 rounded-lg transition-all duration-150"
                style={{
                  background: pair ? 'var(--color-accent-soft)' : activeLeft !== null ? 'var(--color-border-subtle)' : 'var(--color-border-subtle)',
                  border: `1px solid ${pair ? 'var(--color-accent-soft)' : activeLeft !== null ? 'var(--color-accent-soft)' : 'var(--color-border-subtle)'}`,
                  color: pair ? '#c7d2fe' : 'var(--color-text-secondary)',
                  cursor: activeLeft !== null ? 'pointer' : 'default',
                  minHeight: 44,
                }}
              >
                <span className="text-[10px] font-semibold mr-1.5" style={{ color: 'var(--color-text-tertiary)' }}>
                  {LETTER_LABELS[i]}
                </span>
                {item}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function OrderingQuestion({ question, selected, onSelect }) {
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
      <p className="text-[13px] leading-[1.7] mb-3" style={{ color: 'var(--color-text-primary)' }}>
        {question.question_text}
      </p>

      <Reorder.Group
        axis="y"
        values={items}
        onReorder={setItems}
        className="flex flex-col gap-2"
      >
        {items.map((item, i) => (
          <Reorder.Item
            key={item.id}
            value={item}
            className="flex items-center gap-2 text-[13px] px-3 py-2.5 rounded-lg cursor-grab active:cursor-grabbing"
            style={{
              background: 'var(--color-border-subtle)',
              border: '1px solid var(--color-border-subtle)',
              color: 'var(--color-text-secondary)',
              minHeight: 44,
              listStyle: 'none',
            }}
            whileDrag={{
              scale: 1.02,
              boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
              border: '1px solid var(--color-accent-soft)',
            }}
          >
            <GripVertical size={14} style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }} />
            <span
              className="w-6 h-6 rounded-md flex items-center justify-center shrink-0 text-[11px] font-semibold"
              style={{ background: 'var(--color-accent-soft)', color: 'var(--color-accent-active)' }}
            >
              {i + 1}
            </span>
            <span className="flex-1">{item.text}</span>
            {/* Mobile up/down buttons */}
            <div className="flex flex-col gap-0.5 md:hidden">
              <button
                onClick={(e) => { e.stopPropagation(); moveItem(i, -1); }}
                disabled={i === 0}
                className="p-0.5 rounded"
                style={{ color: i === 0 ? 'var(--color-bg-elevated)' : 'var(--color-text-tertiary)', cursor: i === 0 ? 'default' : 'pointer' }}
              >
                <ArrowUp size={12} />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); moveItem(i, 1); }}
                disabled={i === items.length - 1}
                className="p-0.5 rounded"
                style={{ color: i === items.length - 1 ? 'var(--color-bg-elevated)' : 'var(--color-text-tertiary)', cursor: i === items.length - 1 ? 'default' : 'pointer' }}
              >
                <ArrowDown size={12} />
              </button>
            </div>
          </Reorder.Item>
        ))}
      </Reorder.Group>
    </div>
  );
}

function FillBlankQuestion({ question, selected, onSelect }) {
  const [showHint, setShowHint] = useState(false);
  const { sentence = '', hints = [] } = question.options;

  const handleChange = (e) => {
    onSelect(e.target.value);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.stopPropagation();
    }
  };

  // Split sentence at ___ to render inline input
  const parts = sentence.split('___');

  return (
    <div>
      <p className="text-[13px] leading-[1.7] mb-3" style={{ color: 'var(--color-text-primary)' }}>
        {question.question_text}
      </p>

      {question.code_snippet && (
        <pre
          className="text-[12px] leading-[1.6] mb-3 px-4 py-3 rounded-lg overflow-x-auto"
          style={{
            background: 'rgba(0,0,0,0.3)',
            border: '1px solid var(--color-border-subtle)',
            color: 'var(--color-text-secondary)',
            fontFamily: 'JetBrains Mono, monospace',
          }}
        >
          {question.code_snippet}
        </pre>
      )}

      <div
        className="text-[13px] leading-[2] px-4 py-3 rounded-lg"
        style={{
          background: 'var(--color-border-subtle)',
          border: '1px solid var(--color-border-subtle)',
          color: 'var(--color-text-secondary)',
        }}
      >
        {parts[0]}
        <input
          type="text"
          value={selected || ''}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="..."
          className="inline-block text-[13px] font-semibold px-2 py-0.5 mx-1 rounded outline-none"
          style={{
            background: 'var(--color-border-subtle)',
            borderBottom: '2px solid var(--color-accent-soft)',
            color: '#c7d2fe',
            width: Math.max(60, (selected?.length || 3) * 10 + 20),
            fontFamily: 'JetBrains Mono, monospace',
          }}
          autoFocus
        />
        {parts[1]}
      </div>

      {hints.length > 0 && (
        <button
          onClick={() => setShowHint(!showHint)}
          className="flex items-center gap-1 text-[11px] font-medium mt-2 transition-colors duration-150"
          style={{ color: 'var(--color-accent)', cursor: 'pointer' }}
        >
          <Lightbulb size={12} />
          {showHint ? 'Hide hint' : 'Show hint'}
        </button>
      )}
      {showHint && hints[0] && (
        <p className="text-[11px] mt-1 px-3 py-1.5 rounded-lg"
          style={{ background: 'rgba(245, 158, 11, 0.08)', color: '#fcd34d' }}>
          {hints[0]}
        </p>
      )}
    </div>
  );
}

// --- Feedback renderer ---

function FeedbackRenderer({ question, feedbackData, selectedAnswer, colors }) {
  const { correct, explanation, newStreak } = feedbackData;

  return (
    <div>
      {/* Correct/Wrong header */}
      <div className="flex items-center gap-2 mb-3">
        {correct ? (
          <>
            <CheckCircle2 size={20} style={{ color: 'var(--color-success)' }} />
            <span className="text-[14px] font-semibold" style={{ color: 'var(--color-success)' }}>Correct!</span>
          </>
        ) : (
          <>
            <XCircle size={20} style={{ color: 'var(--color-error)' }} />
            <span className="text-[14px] font-semibold" style={{ color: 'var(--color-error)' }}>Not quite</span>
          </>
        )}
      </div>

      {/* Show correct answer for MC when wrong */}
      {!correct && question.question_type === 'multiple_choice' && (
        <div className="flex flex-col gap-1.5 mb-3">
          {(question.options.choices || []).map((choice, i) => {
            const isCorrect = i === question.correct_answer.index;
            const isUserAnswer = i === selectedAnswer;
            if (!isCorrect && !isUserAnswer) return null;
            return (
              <div
                key={i}
                className="flex items-center gap-2 text-[12px] px-3 py-2 rounded-lg"
                style={{
                  background: isCorrect ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                  border: `1px solid ${isCorrect ? 'rgba(16, 185, 129, 0.25)' : 'rgba(239, 68, 68, 0.25)'}`,
                  color: isCorrect ? 'var(--color-success)' : 'var(--color-error)',
                }}
              >
                {isCorrect ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                <span className="font-medium mr-1">{LETTER_LABELS[i]}</span>
                <span>{choice}</span>
                <span className="ml-auto text-[10px]" style={{ color: 'var(--color-text-tertiary)' }}>
                  {isCorrect ? 'correct' : 'your answer'}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Explanation */}
      <p className="text-[13px] leading-[1.7] mb-3" style={{ color: 'var(--color-text-secondary)' }}>
        {explanation}
      </p>

      {/* Streak indicator */}
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-medium" style={{ color: 'var(--color-text-tertiary)' }}>
          {correct ? 'Streak:' : 'Streak reset:'}
        </span>
        <div className="flex items-center gap-1">
          {[0, 1, 2].map(i => (
            <div
              key={i}
              className="w-2 h-2 rounded-full transition-all duration-300"
              style={{
                background: i < newStreak ? 'var(--color-success)' : 'var(--color-border-subtle)',
                transform: i < newStreak ? 'scale(1)' : 'scale(0.8)',
                transitionDelay: `${i * 50}ms`,
              }}
            />
          ))}
          {newStreak >= 3 && (
            <span className="text-[10px] font-medium ml-1" style={{ color: 'var(--color-success)' }}>
              Mastered
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// --- Summary ---

function QuizSummary({ answers, questions, concepts, quizStats, isCheckpoint, onContinue }) {
  const correctCount = answers.filter(a => a.correct).length;
  const totalCount = answers.length;

  // Get unique concepts tested
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
      className="guided-card fixed z-30"
      style={{
        bottom: 24,
        left: '50%',
        translate: '-50% 0',
        width: 'min(520px, calc(100% - 32px))',
      }}
    >
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          background: 'var(--color-bg-surface)',
          border: '1px solid var(--color-border-subtle)',
          boxShadow: '0 8px 48px rgba(0,0,0,0.6), 0 0 0 1px var(--color-border-subtle)',
          animation: 'fade-in 0.25s ease-out',
        }}
      >
        <div className="px-6 pt-5 pb-4">
          {/* Title */}
          <div className="flex items-center gap-2 mb-4">
            {isCheckpoint
              ? <Trophy size={18} style={{ color: '#fbbf24' }} />
              : <CheckCircle2 size={18} style={{ color: 'var(--color-success)' }} />
            }
            <h2 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
              {isCheckpoint ? 'Checkpoint Complete' : 'Review Complete'}
            </h2>
          </div>

          {/* Score */}
          <div className="text-center mb-4">
            <span
              className="text-3xl font-bold"
              style={{ color: correctCount === totalCount ? 'var(--color-success)' : 'var(--color-text-primary)' }}
            >
              {correctCount}
            </span>
            <span className="text-lg" style={{ color: 'var(--color-text-tertiary)' }}>
              {' / '}{totalCount} correct
            </span>
          </div>

          {/* Per-concept streak bars */}
          <div className="flex flex-col gap-2 mb-4">
            {testedConcepts.map(key => {
              const concept = concepts.find(c => c.id === key);
              const stats = quizStats[key] || { streak: 0 };
              const cColors = concept ? (CONCEPT_COLORS[concept.color] || CONCEPT_COLORS.gray) : CONCEPT_COLORS.gray;
              return (
                <div key={key} className="flex items-center gap-2">
                  <span
                    className="text-[11px] font-medium truncate"
                    style={{ color: cColors.accent, width: 100 }}
                  >
                    {concept?.name || key}
                  </span>
                  <div className="flex items-center gap-1 flex-1">
                    {[0, 1, 2].map(i => (
                      <div
                        key={i}
                        className="w-2.5 h-2.5 rounded-full"
                        style={{
                          background: i < stats.streak ? 'var(--color-success)' : 'var(--color-border-subtle)',
                          transitionDelay: `${i * 50}ms`,
                          transition: 'all 0.3s ease',
                        }}
                      />
                    ))}
                    {stats.streak >= 3 && (
                      <span className="text-[10px] font-medium ml-1" style={{ color: 'var(--color-success)' }}>
                        Mastered
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Encouraging message */}
          <p className="text-[12px] text-center leading-relaxed" style={{ color: 'var(--color-text-tertiary)' }}>
            {message}
          </p>
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-end px-5 py-3"
          style={{
            borderTop: '1px solid var(--color-border-subtle)',
            background: 'var(--color-border-subtle)',
          }}
        >
          <button
            onClick={onContinue}
            className="flex items-center gap-1 text-[12px] font-semibold px-4 py-2 rounded-lg transition-all duration-150 active:scale-95"
            style={{
              background: 'rgba(16, 185, 129, 0.2)',
              color: 'var(--color-success)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              cursor: 'pointer',
            }}
          >
            Continue
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
