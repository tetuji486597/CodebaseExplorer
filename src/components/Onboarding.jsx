import { useState } from 'react';
import useStore from '../store/useStore';
import { Map, MousePointerClick, MessageSquare } from 'lucide-react';

const STEPS = [
  {
    title: 'This is your concept map',
    description: 'Each bubble represents a part of the app. Colors group related features. Bigger bubbles mean more code is involved.',
    Icon: Map,
    color: '#6366f1',
  },
  {
    title: 'Tap any bubble',
    description: 'Select a concept or file to see what it does, which files it contains, and how it connects to everything else.',
    Icon: MousePointerClick,
    color: '#10b981',
  },
  {
    title: 'Ask anything',
    description: 'Use the chat bar at the bottom to ask questions about the codebase in plain English. No coding knowledge required.',
    Icon: MessageSquare,
    color: '#8b5cf6',
  },
];

export default function Onboarding() {
  const { showOnboarding, onboardingStep, setOnboardingStep, dismissOnboarding } = useStore();

  if (!showOnboarding) return null;

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
      style={{ background: 'rgba(10, 10, 26, 0.88)', backdropFilter: 'blur(8px)' }}
    >
      <div
        className="w-full max-w-sm mx-4 rounded-2xl p-8 text-center"
        style={{
          background: '#14142b',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
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
                background: i === onboardingStep ? '#6366f1' : 'rgba(255,255,255,0.08)',
              }}
            />
          ))}
        </div>

        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
          style={{
            background: `${step.color}15`,
            border: `1px solid ${step.color}25`,
          }}
        >
          <step.Icon size={28} style={{ color: step.color }} />
        </div>

        <h2 className="text-lg font-semibold mb-2 font-heading" style={{ color: '#e2e8f0' }}>{step.title}</h2>
        <p className="text-sm leading-relaxed mb-8" style={{ color: '#94a3b8' }}>{step.description}</p>

        <div className="flex gap-2 justify-center">
          <button
            onClick={dismissOnboarding}
            className="px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 active:scale-95"
            style={{ color: '#64748b' }}
            onMouseEnter={e => e.currentTarget.style.color = '#94a3b8'}
            onMouseLeave={e => e.currentTarget.style.color = '#64748b'}
          >
            Skip
          </button>
          <button
            onClick={next}
            className="px-6 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 active:scale-95"
            style={{
              background: 'rgba(99, 102, 241, 0.2)',
              color: '#a5b4fc',
              border: '1px solid rgba(99, 102, 241, 0.3)',
            }}
          >
            {isLast ? 'Got it!' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}
