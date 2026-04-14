import { useEffect, useCallback } from 'react';
import useStore from '../store/useStore';
import QuizGate from './QuizGate';
import useQuizGate from '../hooks/useQuizGate';

/**
 * GuidedOverlay — headless behaviors for guided tour mode.
 *
 * All guided-tour CHROME (progress, concept card, next/back) now lives inside
 * the anchored ConceptPopover (InspectorPanel.jsx). This component only:
 *   1) Handles keyboard navigation (←/→/esc) while in guided mode
 *   2) Auto-opens the inspector on the current concept when entering guided mode
 *   3) Renders the QuizGate overlay when a quiz gate is active
 */
export default function GuidedOverlay() {
  const guidedMode = useStore(s => s.guidedMode);
  const guidedPosition = useStore(s => s.guidedPosition);
  const explorationPath = useStore(s => s.explorationPath);
  const advanceGuided = useStore(s => s.advanceGuided);
  const retreatGuided = useStore(s => s.retreatGuided);
  const exitGuidedMode = useStore(s => s.exitGuidedMode);
  const quizGateActive = useStore(s => s.quizGateActive);
  const setSelectedNode = useStore(s => s.setSelectedNode);
  const setShowInspector = useStore(s => s.setShowInspector);
  const selectedNode = useStore(s => s.selectedNode);
  const { checkForQuizGate } = useQuizGate();

  const currentKey = explorationPath[guidedPosition];

  // When entering guided mode, ensure the inspector is showing the current concept.
  // Also re-sync when position changes (next/back).
  useEffect(() => {
    if (!guidedMode || !currentKey) return;
    setSelectedNode({ type: 'concept', id: currentKey });
    setShowInspector(true);
  }, [guidedMode, currentKey, setSelectedNode, setShowInspector]);

  const handleNext = useCallback(async () => {
    if (guidedPosition >= explorationPath.length - 1) {
      exitGuidedMode();
      return;
    }
    const nextPos = guidedPosition + 1;
    const gateShown = await checkForQuizGate(nextPos);
    if (gateShown) return;
    advanceGuided();
  }, [guidedPosition, explorationPath.length, advanceGuided, exitGuidedMode, checkForQuizGate]);

  const handleBack = useCallback(() => {
    if (guidedPosition <= 0) return;
    retreatGuided();
  }, [guidedPosition, retreatGuided]);

  // Keyboard navigation
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
