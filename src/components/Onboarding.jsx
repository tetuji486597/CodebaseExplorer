import { useState } from 'react';
import useStore from '../store/useStore';
import { Map, MousePointerClick, MessageSquare } from 'lucide-react';

const STEPS = [
  {
    title: 'This is the architecture map',
    description: 'Each bubble represents an architectural concept — think controllers, models, services, or UI components. Colors group related modules. Bigger bubbles mean more files are involved.',
    Icon: Map,
    color: 'var(--color-accent)',
  },
  {
    title: 'Click any concept',
    description: 'Select a concept to see what it does, which files implement it, what design patterns are at play, and how it connects to the rest of the system.',
    Icon: MousePointerClick,
    color: 'var(--color-success)',
  },
  {
    title: 'Ask anything',
    description: "Use the chat bar to ask questions — 'What pattern does the auth module use?', 'How does data flow from the API to the UI?', or anything else about the codebase.",
    Icon: MessageSquare,
    color: 'var(--color-accent)',
  },
];

export default function Onboarding() {
  const { showOnboarding, onboardingStep, setOnboardingStep, dismissOnboarding, explorationPath } = useStore();

  // Guided tour replaces onboarding
  if (!showOnboarding || explorationPath.length > 0) return null;

  const step = STEPS[onboardingStep];
  const isLast = onboardingStep === STEPS.length - 1;

  const next = () => {
    if (isLast) {
      dismissOnboarding();
    } else {
      setOnboardingStep(onboardingStep + 1);
    }
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center"
      style={{ background: 'rgba(0, 0, 0, 0.4)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
    >
      <div
        className="w-full max-w-sm mx-4 rounded-2xl p-8 text-center"
        style={{
          background: 'var(--color-bg-elevated)',
          border: '1px solid var(--color-border-visible)',
          boxShadow: 'var(--shadow-lg)',
          animation: 'fade-in 0.3s ease-out',
        }}
      >
        {/* Step indicator */}
        <div className="flex justify-center gap-1.5 mb-6">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className="h-1 rounded-full transition-all duration-300"
              style={{
                width: i === onboardingStep ? 20 : 8,
                background: i === onboardingStep ? 'var(--color-accent)' : 'var(--color-border-visible)',
              }}
            />
          ))}
        </div>

        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
          style={{
            background: `color-mix(in srgb, ${step.color} 10%, transparent)`,
            border: `1px solid color-mix(in srgb, ${step.color} 15%, transparent)`,
          }}
        >
          <step.Icon size={28} style={{ color: step.color }} />
        </div>

        <h2 className="text-lg font-semibold mb-2 font-heading" style={{ color: 'var(--color-text-primary)' }}>{step.title}</h2>
        <p className="text-sm leading-relaxed mb-8" style={{ color: 'var(--color-text-secondary)' }}>{step.description}</p>

        <div className="flex gap-2 justify-center">
          <button
            onClick={dismissOnboarding}
            className="px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 active:scale-95"
            style={{ color: 'var(--color-text-tertiary)' }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--color-text-secondary)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--color-text-tertiary)'}
          >
            Skip
          </button>
          <button
            onClick={next}
            className="px-6 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 active:scale-95"
            style={{
              background: 'var(--color-accent)',
              color: 'var(--color-text-inverse)',
              border: '1px solid var(--color-accent)',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-accent-hover)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'var(--color-accent)'; }}
          >
            {isLast ? 'Got it!' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}
