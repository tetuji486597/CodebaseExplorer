// Proactive decision engine - deterministic rules handle 80% of cases

export interface ProactiveAction {
  action: string;
  target_id?: string;
  reason: string;
  message?: string;
  priority: 'low' | 'medium' | 'high';
}

export async function getNextAction(
  userState: any,
  project: any,
  concepts: any[],
  edges: any[],
  insights: any[]
): Promise<ProactiveAction> {
  const exploredConcepts = userState.explored_concepts || [];
  const insightsSeen = userState.insights_seen || [];
  const currentPosition = userState.current_position || 0;
  const explorationPath = userState.exploration_path || [];
  const timePerConcept = userState.time_per_concept || {};

  // Rule 1: If user just arrived, suggest the best starting concept
  if (exploredConcepts.length === 0) {
    const startingConcept = explorationPath[0] || concepts.find((c) => c.importance === 'critical')?.concept_key || concepts[0]?.concept_key;

    if (startingConcept) {
      const concept = concepts.find((c) => c.concept_key === startingConcept);
      return {
        action: 'highlight_concept',
        target_id: startingConcept,
        message: `Start here — ${concept?.name || startingConcept} is the heart of the app`,
        reason: 'User has not explored any concepts yet',
        priority: 'high',
      };
    }
  }

  // Rule 2: Suggest next concept from the exploration path
  if (currentPosition < explorationPath.length) {
    const nextConcept = explorationPath[currentPosition];
    if (!exploredConcepts.includes(nextConcept)) {
      const concept = concepts.find((c) => c.concept_key === nextConcept);
      return {
        action: 'highlight_concept',
        target_id: nextConcept,
        message: `Next up: ${concept?.name || nextConcept}`,
        reason: 'Following exploration path',
        priority: 'medium',
      };
    }
  }

  // Rule 3: If user has been on one concept briefly, suggest going deeper
  const lastExplored = exploredConcepts[exploredConcepts.length - 1];
  if (lastExplored) {
    const timeSpent = timePerConcept[lastExplored] || 0;
    if (timeSpent > 10 && timeSpent < 30) {
      return {
        action: 'deepen_current',
        target_id: lastExplored,
        message: `Want to see the actual files that make this work?`,
        reason: 'User spent moderate time on current concept',
        priority: 'medium',
      };
    }
  }

  // Rule 4: Suggest a connected concept the user hasn't seen
  if (lastExplored) {
    const connectedKeys = edges
      .filter((e) => e.source_concept_key === lastExplored || e.target_concept_key === lastExplored)
      .map((e) => (e.source_concept_key === lastExplored ? e.target_concept_key : e.source_concept_key))
      .filter((key) => !exploredConcepts.includes(key));

    if (connectedKeys.length > 0) {
      const nextKey = connectedKeys[0];
      const concept = concepts.find((c) => c.concept_key === nextKey);
      const edge = edges.find(
        (e) =>
          (e.source_concept_key === lastExplored && e.target_concept_key === nextKey) ||
          (e.source_concept_key === nextKey && e.target_concept_key === lastExplored)
      );

      return {
        action: 'suggest_connection',
        target_id: nextKey,
        message: `This connects to ${concept?.name || nextKey} — ${edge?.relationship || 'related'}`,
        reason: 'Suggesting connected unseen concept',
        priority: 'medium',
      };
    }
  }

  // Rule 5: Show a high-priority insight whose prerequisites are met
  const readyInsights = insights.filter((insight) => {
    if (insightsSeen.includes(insight.id)) return false;
    const prereqs = insight.requires_understanding || [];
    return prereqs.every((req: string) => exploredConcepts.includes(req));
  });

  if (readyInsights.length > 0) {
    const insight = readyInsights[0];
    return {
      action: 'show_insight',
      target_id: insight.id,
      message: insight.summary,
      reason: 'High-priority insight with prerequisites met',
      priority: insight.priority > 7 ? 'high' : 'medium',
    };
  }

  // Rule 6: Show progress summary
  const explorationPercent = exploredConcepts.length / Math.max(concepts.length, 1);
  if (explorationPercent > 0.7 && !insightsSeen.includes('progress_summary')) {
    return {
      action: 'show_summary',
      message: `You've explored ${Math.round(explorationPercent * 100)}% of the codebase`,
      reason: 'User has explored most concepts',
      priority: 'low',
    };
  }

  return {
    action: 'nothing',
    reason: 'User is engaged, no interruption needed',
    priority: 'low',
  };
}
