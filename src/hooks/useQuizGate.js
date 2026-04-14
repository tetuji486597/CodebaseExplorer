import { useCallback } from 'react';
import useStore from '../store/useStore';
import { API_BASE } from '../lib/api';

export default function useQuizGate() {
  const projectId = useStore(s => s.projectId);

  const checkForQuizGate = useCallback(async (nextPosition) => {
    if (!projectId) return false;

    const store = useStore.getState();
    store.setQuizLoading(true);

    try {
      const res = await fetch(
        `${API_BASE}/api/quiz/${projectId}/due?position=${nextPosition}`
      );
      const data = await res.json();

      if (data.questions && data.questions.length > 0) {
        store.setQuizGateQuestions(data.questions);
        store.setQuizGateType(data.gateType);
        store.setQuizCurrentIndex(0);
        store.setQuizGateActive(true);
        store.setQuizLoading(false);
        return true;
      }
    } catch (err) {
      console.error('Quiz gate check failed:', err);
    }

    store.setQuizLoading(false);
    return false;
  }, [projectId]);

  const submitAnswer = useCallback(async (questionId, conceptKey, answer) => {
    if (!projectId) return { correct: false, explanation: '' };

    const position = useStore.getState().guidedPosition;
    try {
      const res = await fetch(`${API_BASE}/api/quiz/${projectId}/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId, conceptKey, answer, position }),
      });
      const result = await res.json();

      // Update local quiz stats
      const store = useStore.getState();
      const stats = { ...store.quizStats };
      stats[conceptKey] = {
        streak: result.newStreak,
        mastered: result.mastered,
        totalAttempts: (stats[conceptKey]?.totalAttempts || 0) + 1,
        totalCorrect: (stats[conceptKey]?.totalCorrect || 0) + (result.correct ? 1 : 0),
      };
      store.setQuizStats(stats);

      return result;
    } catch (err) {
      console.error('Failed to submit quiz answer:', err);
      return { correct: false, explanation: 'Failed to check answer.' };
    }
  }, [projectId]);

  const skipReview = useCallback(async () => {
    if (!projectId) return;

    const store = useStore.getState();
    const conceptKeys = store.quizGateQuestions.map(q => q.concept_key);
    const position = store.guidedPosition;

    try {
      await fetch(`${API_BASE}/api/quiz/${projectId}/skip`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conceptKeys, position }),
      });
    } catch (err) {
      console.error('Failed to skip review:', err);
    }

    store.resetQuizGate();
  }, [projectId]);

  const completeGate = useCallback(() => {
    useStore.getState().resetQuizGate();
  }, []);

  const initQuizState = useCallback(async (explorationPath) => {
    if (!projectId || !explorationPath?.length) return;

    try {
      await fetch(`${API_BASE}/api/quiz/${projectId}/init`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ explorationPath }),
      });
    } catch (err) {
      console.error('Failed to init quiz state:', err);
    }
  }, [projectId]);

  return { checkForQuizGate, submitAnswer, skipReview, completeGate, initQuizState };
}
