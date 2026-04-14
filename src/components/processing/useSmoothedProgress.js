import { useState, useEffect, useRef } from 'react';

const STAGE_TARGETS = { 0: 5, 1: 15, 2: 40, 3: 75, 6: 100 };

export default function useSmoothedProgress(pipelineProgress) {
  const [displayPercent, setDisplayPercent] = useState(0);
  const targetRef = useRef(0);
  const rafRef = useRef(null);

  useEffect(() => {
    const stage = pipelineProgress?.stage;
    if (stage != null && STAGE_TARGETS[stage] != null) {
      targetRef.current = STAGE_TARGETS[stage];
    }
  }, [pipelineProgress?.stage]);

  useEffect(() => {
    let lastTime = performance.now();

    const tick = (now) => {
      const dt = (now - lastTime) / 1000;
      lastTime = now;

      setDisplayPercent((prev) => {
        const target = targetRef.current;
        if (target >= 100 && prev >= 100) return 100;

        if (prev >= target) {
          // Drift slowly between stage updates so it never looks frozen
          const ceiling = Math.min(target + 8, 99);
          return Math.min(prev + 0.5 * dt, ceiling);
        }

        // Ease toward target: close ~8% of gap per frame
        const gap = target - prev;
        const step = Math.max(gap * 0.08, 0.3) * dt * 10;
        return Math.min(prev + step, target);
      });

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  return Math.round(displayPercent);
}
