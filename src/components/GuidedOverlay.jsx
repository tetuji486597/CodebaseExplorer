import { useEffect, useCallback, useRef } from 'react';
import useStore from '../store/useStore';
import QuizGate from './QuizGate';
import useQuizGate from '../hooks/useQuizGate';

export default function GuidedOverlay() {
  const guidedMode = useStore(s => s.guidedMode);
  const tourPath = useStore(s => s.tourPath);
  const tourPosition = useStore(s => s.tourPosition);
  const explorationPath = useStore(s => s.explorationPath);
  const guidedPosition = useStore(s => s.guidedPosition);
  const advanceGuided = useStore(s => s.advanceGuided);
  const retreatGuided = useStore(s => s.retreatGuided);
  const exitGuidedMode = useStore(s => s.exitGuidedMode);
  const quizGateActive = useStore(s => s.quizGateActive);
  const setSelectedNode = useStore(s => s.setSelectedNode);
  const setShowInspector = useStore(s => s.setShowInspector);
  const { checkForQuizGate } = useQuizGate();

  const currentStop = tourPath?.stops?.[tourPosition];
  const totalStops = tourPath?.stops?.length || 0;
  const currentKey = currentStop?.id || explorationPath?.[guidedPosition];

  // Only sync selection — drill state is handled by advanceGuided/retreatGuided/enterGuidedMode
  const prevGuidedRef = useRef(false);
  useEffect(() => {
    if (!guidedMode || !currentKey) {
      prevGuidedRef.current = guidedMode;
      return;
    }
    // On initial guided mode activation (from loadProject), enterGuidedMode already handled drill state
    // On subsequent stop changes, advanceGuided/retreatGuided already handled drill state
    // We only need to ensure selection and inspector are synced
    if (!prevGuidedRef.current) {
      prevGuidedRef.current = true;
    }
    setSelectedNode({ type: 'concept', id: currentKey });
    setShowInspector(true);
  }, [guidedMode, currentKey, setSelectedNode, setShowInspector]);

  const handleNext = useCallback(async () => {
    if (tourPath?.stops?.length) {
      if (tourPosition >= totalStops - 1) {
        exitGuidedMode();
        return;
      }
      const nextStop = tourPath.stops[tourPosition + 1];
      if (nextStop?.type === 'chapter_intro') {
        const gateShown = await checkForQuizGate(tourPosition + 1);
        if (gateShown) return;
      }
    } else {
      if (guidedPosition >= explorationPath.length - 1) {
        exitGuidedMode();
        return;
      }
    }
    advanceGuided();
  }, [tourPosition, totalStops, tourPath, guidedPosition, explorationPath, advanceGuided, exitGuidedMode, checkForQuizGate]);

  const handleBack = useCallback(() => {
    if (tourPath?.stops?.length) {
      if (tourPosition <= 0) return;
    } else {
      if (guidedPosition <= 0) return;
    }
    retreatGuided();
  }, [tourPosition, guidedPosition, tourPath, retreatGuided]);

  useEffect(() => {
    if (!guidedMode || quizGateActive) return;
    const handler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        handleNext();
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        handleBack();
      } else if (e.key === 'Escape') {
        exitGuidedMode();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [guidedMode, quizGateActive, handleNext, handleBack, exitGuidedMode]);

  if (quizGateActive) {
    return <QuizGate />;
  }

  return null;
}
