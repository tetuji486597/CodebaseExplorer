import { Hono } from 'hono';
import { supabase } from '../db/supabase.js';

const app = new Hono();

// Spacing schedule indexed by streak: how many positions until next review
const SPACING_TABLE = [2, 4, 8];

// GET /api/quiz/:projectId/due?position=N
// Returns questions due for review at the given guided position
app.get('/:projectId/due', async (c) => {
  const projectId = c.req.param('projectId');
  const position = parseInt(c.req.query('position') || '0', 10);

  const isCheckpoint = position > 0 && position % 5 === 0;

  if (isCheckpoint) {
    // Checkpoint: gather interleaved questions from all prior concepts, weighted by lowest streak
    const { data: states } = await supabase
      .from('quiz_state')
      .select('*')
      .eq('project_id', projectId)
      .order('streak', { ascending: true })
      .limit(5);

    if (!states?.length) {
      return c.json({ questions: [], gateType: null });
    }

    const conceptKeys = states.map((s) => s.concept_key);
    const lastQuestionIds = states.map((s) => s.last_question_id).filter(Boolean);

    let query = supabase
      .from('quiz_questions')
      .select('*')
      .eq('project_id', projectId)
      .in('concept_key', conceptKeys);

    if (lastQuestionIds.length > 0) {
      // Supabase doesn't support NOT IN easily, we'll filter in JS
    }

    const { data: allQuestions } = await query;
    if (!allQuestions?.length) {
      return c.json({ questions: [], gateType: null });
    }

    // Filter out last-asked questions and pick one per concept
    const lastIdSet = new Set(lastQuestionIds);
    const questions: typeof allQuestions = [];
    const usedConcepts = new Set<string>();

    for (const q of allQuestions) {
      if (usedConcepts.has(q.concept_key)) continue;
      if (lastIdSet.has(q.id) && allQuestions.filter((aq) => aq.concept_key === q.concept_key).length > 1) continue;
      questions.push(q);
      usedConcepts.add(q.concept_key);
      if (questions.length >= 5) break;
    }

    return c.json({ questions, gateType: 'checkpoint' });
  }

  // Normal review: find concepts due at this position
  const { data: dueStates } = await supabase
    .from('quiz_state')
    .select('*')
    .eq('project_id', projectId)
    .lte('next_review_position', position)
    .not('next_review_position', 'is', null)
    .order('streak', { ascending: true })
    .limit(3);

  if (dueStates?.length) {
    const conceptKeys = dueStates.map((s) => s.concept_key);
    const lastQuestionIds = dueStates.map((s) => s.last_question_id).filter(Boolean);

    const { data: allQuestions } = await supabase
      .from('quiz_questions')
      .select('*')
      .eq('project_id', projectId)
      .in('concept_key', conceptKeys);

    if (allQuestions?.length) {
      // Pick one question per due concept, avoiding last-asked
      const lastIdSet = new Set(lastQuestionIds);
      const questions: typeof allQuestions = [];
      const usedConcepts = new Set<string>();

      for (const q of allQuestions) {
        if (usedConcepts.has(q.concept_key)) continue;
        if (lastIdSet.has(q.id) && allQuestions.filter((aq) => aq.concept_key === q.concept_key).length > 1) continue;
        questions.push(q);
        usedConcepts.add(q.concept_key);
        if (questions.length >= 3) break;
      }

      return c.json({ questions, gateType: 'review' });
    }

    // Questions don't exist yet (quiz generation still running).
    // Reschedule these concepts so they trigger on the next advance.
    for (const s of dueStates) {
      await supabase
        .from('quiz_state')
        .update({ next_review_position: position + 1 })
        .eq('project_id', projectId)
        .eq('concept_key', s.concept_key);
    }
  }

  // Fallback: check if quiz questions exist for unanswered concepts that
  // somehow weren't scheduled (e.g. quiz generation completed after the user
  // navigated past all scheduled positions). If found, return them as a review.
  const { data: unansweredStates } = await supabase
    .from('quiz_state')
    .select('*')
    .eq('project_id', projectId)
    .eq('total_attempts', 0)
    .not('next_review_position', 'is', null)
    .order('next_review_position', { ascending: true })
    .limit(3);

  if (unansweredStates?.length) {
    const conceptKeys = unansweredStates.map((s) => s.concept_key);
    const { data: fallbackQuestions } = await supabase
      .from('quiz_questions')
      .select('*')
      .eq('project_id', projectId)
      .in('concept_key', conceptKeys);

    if (fallbackQuestions?.length) {
      // Reschedule these to current position so the spaced-repetition math works
      for (const s of unansweredStates) {
        await supabase
          .from('quiz_state')
          .update({ next_review_position: position })
          .eq('project_id', projectId)
          .eq('concept_key', s.concept_key);
      }

      const questions: typeof fallbackQuestions = [];
      const usedConcepts = new Set<string>();
      for (const q of fallbackQuestions) {
        if (usedConcepts.has(q.concept_key)) continue;
        questions.push(q);
        usedConcepts.add(q.concept_key);
        if (questions.length >= 3) break;
      }

      return c.json({ questions, gateType: 'review' });
    }
  }

  return c.json({ questions: [], gateType: null });
});

// POST /api/quiz/:projectId/answer
// Validates answer and updates spaced repetition state
app.post('/:projectId/answer', async (c) => {
  const projectId = c.req.param('projectId');
  const { questionId, conceptKey, answer, position } = await c.req.json();

  // Fetch the question
  const { data: question } = await supabase
    .from('quiz_questions')
    .select('correct_answer, explanation, question_type')
    .eq('id', questionId)
    .single();

  if (!question) {
    return c.json({ error: 'Question not found' }, 404);
  }

  // Validate answer based on question type
  const correct = validateAnswer(question.question_type, answer, question.correct_answer);

  // Fetch current quiz state
  const { data: state } = await supabase
    .from('quiz_state')
    .select('*')
    .eq('project_id', projectId)
    .eq('concept_key', conceptKey)
    .single();

  let newStreak: number;
  let nextReviewPosition: number | null;

  if (correct) {
    newStreak = (state?.streak || 0) + 1;
    if (newStreak >= 3) {
      nextReviewPosition = null; // Mastered
    } else {
      nextReviewPosition = position + SPACING_TABLE[newStreak];
    }
  } else {
    newStreak = 0;
    nextReviewPosition = position + 1; // Immediate retry
  }

  // Upsert quiz state
  await supabase
    .from('quiz_state')
    .upsert(
      {
        project_id: projectId,
        concept_key: conceptKey,
        streak: newStreak,
        next_review_position: nextReviewPosition,
        last_answered_at: new Date().toISOString(),
        total_attempts: (state?.total_attempts || 0) + 1,
        total_correct: (state?.total_correct || 0) + (correct ? 1 : 0),
        last_question_id: questionId,
      },
      { onConflict: 'project_id,concept_key' }
    );

  return c.json({
    correct,
    explanation: question.explanation,
    newStreak,
    mastered: newStreak >= 3,
  });
});

// GET /api/quiz/:projectId/stats
// Returns mastery overview per concept
app.get('/:projectId/stats', async (c) => {
  const projectId = c.req.param('projectId');

  const { data: states } = await supabase
    .from('quiz_state')
    .select('concept_key, streak, total_attempts, total_correct, next_review_position')
    .eq('project_id', projectId);

  const concepts = (states || []).map((s) => ({
    conceptKey: s.concept_key,
    streak: s.streak,
    totalAttempts: s.total_attempts,
    totalCorrect: s.total_correct,
    mastered: s.streak >= 3,
  }));

  return c.json({ concepts });
});

// POST /api/quiz/:projectId/skip
// Reschedules skipped questions at next position
app.post('/:projectId/skip', async (c) => {
  const projectId = c.req.param('projectId');
  const { conceptKeys, position } = await c.req.json();

  for (const conceptKey of conceptKeys) {
    await supabase
      .from('quiz_state')
      .upsert(
        {
          project_id: projectId,
          concept_key: conceptKey,
          next_review_position: position + 1,
        },
        { onConflict: 'project_id,concept_key' }
      );
  }

  return c.json({ ok: true });
});

// POST /api/quiz/:projectId/init
// Initialize quiz state for concepts in the exploration path.
// If currentPosition is provided, also reschedule any unanswered concepts
// whose review position has already been passed (handles the race condition
// where quiz questions are generated after the user has already navigated past
// the originally scheduled positions).
app.post('/:projectId/init', async (c) => {
  const projectId = c.req.param('projectId');
  const { explorationPath, currentPosition } = await c.req.json();

  if (!explorationPath?.length) {
    return c.json({ ok: true });
  }

  // Check if quiz state already exists
  const { data: existing } = await supabase
    .from('quiz_state')
    .select('concept_key, total_attempts, next_review_position')
    .eq('project_id', projectId);

  const existingKeys = new Set((existing || []).map((e) => e.concept_key));

  const newStates = explorationPath
    .map((conceptKey: string, index: number) => ({
      project_id: projectId,
      concept_key: conceptKey,
      streak: 0,
      next_review_position: index + 2, // First review 2 steps after seeing concept
      total_attempts: 0,
      total_correct: 0,
    }))
    .filter((s: { concept_key: string }) => !existingKeys.has(s.concept_key));

  if (newStates.length > 0) {
    await supabase.from('quiz_state').insert(newStates);
  }

  // Reschedule stale entries: concepts the user has already passed
  // but never answered (total_attempts = 0). This happens when quiz questions
  // were generated after the user navigated past the scheduled positions.
  if (typeof currentPosition === 'number' && currentPosition > 0 && existing?.length) {
    const staleEntries = existing.filter(
      (e) =>
        e.total_attempts === 0 &&
        e.next_review_position !== null &&
        e.next_review_position <= currentPosition
    );

    for (const entry of staleEntries) {
      await supabase
        .from('quiz_state')
        .update({ next_review_position: currentPosition + 1 })
        .eq('project_id', projectId)
        .eq('concept_key', entry.concept_key);
    }
  }

  return c.json({ ok: true });
});

function validateAnswer(
  questionType: string,
  userAnswer: unknown,
  correctAnswer: Record<string, unknown>
): boolean {
  switch (questionType) {
    case 'multiple_choice': {
      return (userAnswer as number) === (correctAnswer.index as number);
    }
    case 'matching': {
      const userPairs = userAnswer as number[][];
      const correctPairs = correctAnswer.pairs as number[][];
      if (!userPairs || userPairs.length !== correctPairs.length) return false;
      // Check each pair matches
      const correctMap = new Map(correctPairs.map(([l, r]) => [l, r]));
      return userPairs.every(([l, r]) => correctMap.get(l) === r);
    }
    case 'ordering': {
      const userOrder = userAnswer as number[];
      const correctOrder = correctAnswer.order as number[];
      if (!userOrder || userOrder.length !== correctOrder.length) return false;
      return userOrder.every((val, idx) => val === correctOrder[idx]);
    }
    case 'fill_blank': {
      const userText = (userAnswer as string || '').trim().toLowerCase();
      const correctText = (correctAnswer.answer as string || '').toLowerCase();
      const alternatives = ((correctAnswer.alternatives as string[]) || []).map((a) => a.toLowerCase());
      return userText === correctText || alternatives.includes(userText);
    }
    default:
      return false;
  }
}

export default app;
