// Stage 7: Proactive Queue Seeding
import { supabase } from '../db/supabase.js';
import { callClaudeStructured } from '../ai/claude.js';
import { proactiveSeedingSchema } from '../ai/schemas.js';
import type { ConceptSynthesisResult } from './conceptSynthesis.js';

export async function runProactiveSeeding(projectId: string, synthesis: ConceptSynthesisResult) {
  const conceptSummary = synthesis.concepts
    .map((c) => `${c.id}: ${c.name} (${c.importance}) - ${c.one_liner}`)
    .join('\n');

  const edgeSummary = synthesis.edges
    .map((e) => `${e.source} → ${e.target}: ${e.relationship}`)
    .join('\n');

  try {
    const result = await callClaudeStructured<{
      exploration_path: string[];
      reasoning: string;
    }>({
      system: `Generate an optimal exploration path through a codebase's concept map.
The path should start with the most critical/entry-point concept and gradually introduce complexity.
Consider: which concepts depend on understanding others first? What's the natural learning progression?
Respond with ONLY valid JSON, no markdown.`,
      prompt: `Given these concepts and relationships, determine the best order to explore them:

Concepts:
${conceptSummary}

Relationships:
${edgeSummary}

Suggested starting concept: ${synthesis.suggested_starting_concept}

Return JSON with: exploration_path (array of concept ids in order), reasoning (why this order).`,
      schema: proactiveSeedingSchema,
      schemaName: 'proactive_seeding',
      maxTokens: 2048,
      model: 'fast',
    });

    // Create initial user state with exploration path
    await supabase.from('user_state').insert({
      project_id: projectId,
      exploration_path: result.exploration_path,
    });

    console.log(`Seeded exploration path: ${result.exploration_path.join(' → ')}`);
  } catch (err) {
    console.error('Proactive seeding failed:', err);
    // Create user state with basic path
    const basicPath = synthesis.concepts
      .sort((a, b) => {
        const order = { critical: 0, important: 1, supporting: 2 };
        return (order[a.importance as keyof typeof order] || 2) - (order[b.importance as keyof typeof order] || 2);
      })
      .map((c) => c.id);

    await supabase.from('user_state').insert({
      project_id: projectId,
      exploration_path: basicPath,
    });
  }
}
