import { useState, useEffect } from 'react';
import useStore from '../store/useStore';
import { FolderOpen, Search, Puzzle, Lightbulb, BookOpen, Map } from 'lucide-react';

const STEPS = [
  { text: 'Reading your files...', Icon: FolderOpen, stage: 0 },
  { text: 'Analyzing code structure...', Icon: Search, stage: 2 },
  { text: 'Synthesizing concepts...', Icon: Puzzle, stage: 3 },
  { text: 'Adding depth & insights...', Icon: Lightbulb, stage: 4 },
  { text: 'Indexing for search...', Icon: BookOpen, stage: 6 },
  { text: 'Building your map...', Icon: Map, stage: 7 },
];

export default function ProcessingScreen() {
  const { processingStatus, pipelineProgress } = useStore();
  const [dots, setDots] = useState([]);
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    if (pipelineProgress?.stage) {
      const stage = pipelineProgress.stage;
      const stepIdx = STEPS.findIndex((s, i) => {
        const nextStage = STEPS[i + 1]?.stage ?? 99;
        return stage >= s.stage && stage < nextStage;
      });
      if (stepIdx >= 0) setActiveStep(stepIdx);
    } else {
      if (processingStatus.includes('Reading') || processingStatus.includes('Loading')) setActiveStep(0);
      else if (processingStatus.includes('Analyzing') || processingStatus.includes('Extract')) setActiveStep(1);
      else if (processingStatus.includes('Synth') || processingStatus.includes('Finding')) setActiveStep(2);
      else if (processingStatus.includes('depth') || processingStatus.includes('insight')) setActiveStep(3);
      else if (processingStatus.includes('Index') || processingStatus.includes('search')) setActiveStep(4);
      else if (processingStatus.includes('Building') || processingStatus.includes('exploration')) setActiveStep(5);
    }
  }, [processingStatus, pipelineProgress]);

  useEffect(() => {
    const colors = ['#6366f1', '#8b5cf6', '#10b981', '#06b6d4', '#f59e0b', '#ec4899'];
    const newDots = Array.from({ length: 30 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: 2 + Math.random() * 4,
      duration: 3 + Math.random() * 4,
      delay: Math.random() * 3,
      color: colors[Math.floor(Math.random() * colors.length)],
    }));
    setDots(newDots);
  }, []);

  const ActiveIcon = STEPS[activeStep]?.Icon || Map;

  return (
    <div
      className="w-full h-full flex flex-col items-center justify-center relative"
      style={{ background: '#0a0a1a' }}
    >
      {/* Floating dots constellation */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {dots.map(dot => (
          <div
            key={dot.id}
            className="absolute rounded-full"
            style={{
              left: `${dot.x}%`,
              top: `${dot.y}%`,
              width: `${dot.size}px`,
              height: `${dot.size}px`,
              background: dot.color,
              opacity: 0.25,
              animation: `float ${dot.duration}s ease-in-out infinite ${dot.delay}s`,
            }}
          />
        ))}
        <svg className="absolute inset-0 w-full h-full" style={{ opacity: 0.06 }}>
          {dots.slice(0, 15).map((dot, i) => {
            const next = dots[(i + 3) % dots.length];
            return (
              <line
                key={i}
                x1={`${dot.x}%`} y1={`${dot.y}%`}
                x2={`${next.x}%`} y2={`${next.y}%`}
                stroke={dot.color}
                strokeWidth="0.5"
              />
            );
          })}
        </svg>
      </div>

      {/* Central processing indicator */}
      <div className="z-10 text-center" style={{ animation: 'fade-in 0.5s ease-out' }}>
        {/* Pulsing rings */}
        <div className="relative w-24 h-24 mx-auto mb-8">
          <div
            className="absolute inset-0 rounded-full border"
            style={{ borderColor: 'rgba(99, 102, 241, 0.2)', animation: 'pulse-scale 2s ease-in-out infinite' }}
          />
          <div
            className="absolute inset-2 rounded-full border"
            style={{ borderColor: 'rgba(139, 92, 246, 0.2)', animation: 'pulse-scale 2s ease-in-out infinite 0.3s' }}
          />
          <div
            className="absolute inset-4 rounded-full border"
            style={{ borderColor: 'rgba(16, 185, 129, 0.2)', animation: 'pulse-scale 2s ease-in-out infinite 0.6s' }}
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <ActiveIcon size={32} style={{ color: '#6366f1' }} />
          </div>
        </div>

        {/* Current status message */}
        <p className="text-sm font-medium mb-6" style={{ color: '#a5b4fc' }}>
          {processingStatus || 'Starting...'}
        </p>

        {/* Steps */}
        <div className="space-y-3">
          {STEPS.map((step, i) => (
            <div
              key={i}
              className="flex items-center justify-center gap-3 transition-all duration-500"
              style={{
                opacity: i <= activeStep ? 1 : 0.3,
                transform: i <= activeStep ? 'translateY(0)' : 'translateY(5px)',
              }}
            >
              <div
                className="w-2 h-2 rounded-full transition-all duration-500"
                style={{
                  background: i <= activeStep ? '#6366f1' : 'rgba(255,255,255,0.08)',
                  boxShadow: i === activeStep ? '0 0 8px rgba(99, 102, 241, 0.5)' : 'none',
                }}
              />
              <span
                className="text-sm"
                style={{
                  color: i <= activeStep ? '#e2e8f0' : '#475569',
                  fontWeight: i === activeStep ? 500 : 400,
                }}
              >
                {step.text}
              </span>
              {i < activeStep && (
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M2.5 6L5 8.5L9.5 3.5" stroke="#10b981" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
