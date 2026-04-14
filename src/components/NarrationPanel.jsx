import { useState, useEffect, useRef, useMemo } from 'react';
import { ArrowRight, Search, ChevronRight } from 'lucide-react';

/**
 * NarrationPanel — timestamped narration steps synchronized to app preview.
 * Each step can have a concept bridge CTA that links to the explorer graph.
 *
 * Props:
 *   steps: NarrationStep[]
 *   currentTimeMs: current playback time (for rrweb sync)
 *   mode: 'rrweb' | 'iframe' (iframe mode uses manual step navigation)
 *   conceptColors: Record<string, { accent, text, fill }> concept color map
 *   onBridgeConcept: (conceptKey, narrationTitle) => void
 *   onStepChange: (stepIndex) => void
 */

const STEP_COLORS = [
  'var(--color-accent)', 'var(--color-success)', 'var(--color-warning)', '#06b6d4',
  '#f43f5e', 'var(--color-accent)', '#f97316', '#ec4899',
];

export default function NarrationPanel({
  steps = [],
  currentTimeMs = 0,
  mode = 'iframe',
  conceptColors = {},
  onBridgeConcept,
  onStepChange,
}) {
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [manualOverride, setManualOverride] = useState(false);
  const stepsContainerRef = useRef(null);
  const stepRefs = useRef([]);

  // Auto-advance based on timeline (rrweb mode)
  useEffect(() => {
    if (mode !== 'rrweb' || manualOverride || !steps.length) return;

    let newIndex = 0;
    for (let i = steps.length - 1; i >= 0; i--) {
      if (currentTimeMs >= steps[i].timestamp_ms) {
        newIndex = i;
        break;
      }
    }

    if (newIndex !== activeStepIndex) {
      setActiveStepIndex(newIndex);
      onStepChange?.(newIndex);
    }
  }, [currentTimeMs, steps, mode, manualOverride, activeStepIndex, onStepChange]);

  // Scroll active step into view
  useEffect(() => {
    const el = stepRefs.current[activeStepIndex];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [activeStepIndex]);

  // Manual step navigation (iframe mode or when user clicks)
  const goToStep = (index) => {
    if (index < 0 || index >= steps.length) return;
    setActiveStepIndex(index);
    setManualOverride(true);
    onStepChange?.(index);
  };

  const isLastStep = activeStepIndex === steps.length - 1;
  const isFirstStep = activeStepIndex === 0;

  if (!steps.length) return null;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div
        className="shrink-0 px-5 py-3.5 flex items-center justify-between"
        style={{
          background: 'var(--color-bg-elevated)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid var(--color-border-subtle)',
        }}
      >
        <div>
          <h3 className="text-sm font-semibold font-heading" style={{ color: 'var(--color-text-primary)' }}>
            What's happening
          </h3>
          <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>
            Step {activeStepIndex + 1} of {steps.length}
          </p>
        </div>

        {/* Step dots */}
        <div className="flex items-center gap-1.5">
          {steps.map((_, i) => (
            <button
              key={i}
              onClick={() => goToStep(i)}
              className="transition-all duration-200"
              style={{
                width: i === activeStepIndex ? 16 : 6,
                height: 6,
                borderRadius: 3,
                background: i === activeStepIndex
                  ? 'var(--color-accent)'
                  : i < activeStepIndex
                    ? 'rgba(99, 102, 241, 0.4)'
                    : 'var(--color-border-visible)',
              }}
            />
          ))}
        </div>
      </div>

      {/* Steps content */}
      <div
        ref={stepsContainerRef}
        className="flex-1 overflow-y-auto px-5 py-4 space-y-3"
        style={{ background: 'var(--color-bg-surface)' }}
      >
        {steps.map((step, i) => {
          const isActive = i === activeStepIndex;
          const isPast = i < activeStepIndex;
          const isFuture = i > activeStepIndex;
          const stepColor = STEP_COLORS[i % STEP_COLORS.length];
          const bridgeColor = step.concept_bridge
            ? (conceptColors[step.concept_bridge.concept_key]?.accent || stepColor)
            : stepColor;

          return (
            <div
              key={i}
              ref={el => { stepRefs.current[i] = el; }}
              className="rounded-xl transition-all duration-300 cursor-pointer"
              onClick={() => goToStep(i)}
              style={{
                background: isActive ? 'var(--color-bg-surface)' : 'transparent',
                border: isActive
                  ? `1px solid ${stepColor}30`
                  : '1px solid transparent',
                padding: isActive ? '16px' : '12px 16px',
                opacity: isFuture ? 0.4 : 1,
                transform: isActive ? 'scale(1)' : 'scale(0.98)',
              }}
            >
              {/* Step header */}
              <div className="flex items-start gap-3">
                {/* Step indicator */}
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                  style={{
                    background: isActive ? `${stepColor}20` : isPast ? `${stepColor}10` : 'var(--color-bg-sunken)',
                    border: `1.5px solid ${isActive ? `${stepColor}50` : isPast ? `${stepColor}25` : 'var(--color-border-subtle)'}`,
                  }}
                >
                  {isPast ? (
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                      <path d="M2 5L4.5 7.5L8 3" stroke={stepColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : (
                    <span className="text-[9px] font-bold" style={{ color: isActive ? stepColor : 'var(--color-text-tertiary)' }}>
                      {i + 1}
                    </span>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  {/* Title */}
                  <h4
                    className="text-[13px] font-semibold leading-snug"
                    style={{ color: isActive ? 'var(--color-text-primary)' : isPast ? 'var(--color-text-secondary)' : 'var(--color-text-tertiary)' }}
                  >
                    {step.title}
                  </h4>

                  {/* Description (expanded for active step) */}
                  {isActive && (
                    <div style={{ animation: 'fade-in 0.3s ease-out' }}>
                      <p
                        className="text-[12px] leading-[1.7] mt-2"
                        style={{ color: 'var(--color-text-secondary)' }}
                      >
                        {step.description}
                      </p>

                      {/* Detective question */}
                      {step.detective_question && (
                        <div
                          className="flex items-start gap-2 mt-3 rounded-lg px-3 py-2.5"
                          style={{
                            background: 'rgba(245, 158, 11, 0.06)',
                            border: '1px solid rgba(245, 158, 11, 0.12)',
                          }}
                        >
                          <Search size={13} className="shrink-0 mt-0.5" style={{ color: 'var(--color-warning)' }} />
                          <p className="text-[11px] leading-relaxed italic" style={{ color: '#fbbf24' }}>
                            {step.detective_question}
                          </p>
                        </div>
                      )}

                      {/* Concept bridge CTA */}
                      {step.concept_bridge && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onBridgeConcept?.(step.concept_bridge.concept_key, step.title);
                          }}
                          className="mt-3 w-full flex items-center justify-between gap-2 px-4 py-3 rounded-xl text-[12px] font-semibold transition-all duration-200 active:scale-[0.98] group"
                          style={{
                            background: `${bridgeColor}12`,
                            color: bridgeColor,
                            border: `1px solid ${bridgeColor}25`,
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.background = `${bridgeColor}20`;
                            e.currentTarget.style.borderColor = `${bridgeColor}40`;
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.background = `${bridgeColor}12`;
                            e.currentTarget.style.borderColor = `${bridgeColor}25`;
                          }}
                        >
                          <span>{step.concept_bridge.label}</span>
                          <ArrowRight size={14} className="transition-transform duration-200 group-hover:translate-x-0.5" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Navigation footer */}
      <div
        className="shrink-0 px-5 py-3 flex items-center justify-between gap-3"
        style={{
          background: 'var(--color-bg-elevated)',
          backdropFilter: 'blur(12px)',
          borderTop: '1px solid var(--color-border-subtle)',
        }}
      >
        <button
          onClick={() => goToStep(activeStepIndex - 1)}
          disabled={isFirstStep}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-medium transition-all duration-200"
          style={{
            color: isFirstStep ? 'var(--color-text-tertiary)' : 'var(--color-text-secondary)',
            background: isFirstStep ? 'transparent' : 'var(--color-bg-sunken)',
            cursor: isFirstStep ? 'default' : 'pointer',
          }}
          onMouseEnter={e => { if (!isFirstStep) e.currentTarget.style.background = 'var(--color-border-visible)'; }}
          onMouseLeave={e => { if (!isFirstStep) e.currentTarget.style.background = 'var(--color-bg-sunken)'; }}
        >
          <ChevronRight size={12} style={{ transform: 'rotate(180deg)' }} />
          Back
        </button>

        <button
          onClick={() => goToStep(activeStepIndex + 1)}
          disabled={isLastStep}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12px] font-semibold transition-all duration-200"
          style={{
            color: isLastStep ? 'var(--color-text-tertiary)' : 'var(--color-text-primary)',
            background: isLastStep ? 'transparent' : 'var(--color-accent-soft)',
            border: isLastStep ? 'none' : '1px solid var(--color-border-strong)',
            cursor: isLastStep ? 'default' : 'pointer',
          }}
          onMouseEnter={e => { if (!isLastStep) e.currentTarget.style.background = 'var(--color-border-strong)'; }}
          onMouseLeave={e => { if (!isLastStep) e.currentTarget.style.background = 'var(--color-accent-soft)'; }}
        >
          Next
          <ChevronRight size={12} />
        </button>
      </div>
    </div>
  );
}
