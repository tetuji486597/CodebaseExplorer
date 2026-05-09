import { supabase } from '../db/supabase.js';
import { generateDepthForConcept } from './depthMapping.js';
import { generateQuizForConcept } from './quizGeneration.js';
import type { PipelineContext } from './pipelineContext.js';

export function prefetchForConcept(
  projectId: string,
  currentConceptKey: string,
  context: PipelineContext,
): void {
  prefetchAhead(projectId, currentConceptKey, context).catch(() => {});
}

async function prefetchAhead(
  projectId: string,
  currentConceptKey: string,
  context: PipelineContext,
): Promise<void> {
  const { data: userState } = await supabase
    .from('user_state')
    .select('exploration_path')
    .eq('project_id', projectId)
    .single();

  const path = userState?.exploration_path || [];
  const currentIdx = path.indexOf(currentConceptKey);
  if (currentIdx < 0) return;

  const prefetchKeys = path.slice(currentIdx + 1, currentIdx + 3);

  for (const key of prefetchKeys) {
    const { data } = await supabase
      .from('concepts')
      .select('beginner_explanation')
      .eq('project_id', projectId)
      .eq('concept_key', key)
      .single();

    if (!data?.beginner_explanation) {
      generateDepthForConcept(projectId, key, context.synthesis, context.fileAnalyses).catch(() => {});
    }

    generateQuizForConcept(projectId, key, context.synthesis, context.fileAnalyses).catch(() => {});
  }
}
