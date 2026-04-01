// Stage 4: Relationship & Depth Mapping
import { supabase } from '../db/supabase.js';
import { callClaudeStructured } from '../ai/claude.js';
import { depthMappingSchema, relationshipDepthSchema } from '../ai/schemas.js';
import type { ConceptSynthesisResult } from './conceptSynthesis.js';
import type { FileAnalysis } from './fileAnalysis.js';

export async function runDepthMapping(
  projectId: string,
  synthesis: ConceptSynthesisResult,
  fileAnalyses: FileAnalysis[]
) {
  // Run two parallel Claude calls
  await Promise.all([
    generateMultiLevelExplanations(projectId, synthesis, fileAnalyses),
    generateRelationshipExplanations(projectId, synthesis, fileAnalyses),
  ]);
}

async function generateMultiLevelExplanations(
  projectId: string,
  synthesis: ConceptSynthesisResult,
  fileAnalyses: FileAnalysis[]
) {
  const conceptDescriptions = synthesis.concepts
    .map(
      (c) =>
        `Concept: ${c.name} (${c.id})
Description: ${c.explanation}
Files: ${(Array.isArray(c.file_ids) ? c.file_ids : []).join(', ')}
Metaphor: ${c.metaphor}`
    )
    .join('\n\n');

  try {
    const result = await callClaudeStructured<{
      concepts: Array<{
        id: string;
        beginner_explanation: string;
        intermediate_explanation: string;
        advanced_explanation: string;
      }>;
    }>({
      system: `Generate three levels of explanation for each concept:
- Beginner: Only analogies and everyday language. No code terms.
- Intermediate: Mentions technical terms but explains them inline.
- Advanced: Assumes programming familiarity, references specific patterns and libraries.
Respond with ONLY valid JSON, no markdown.`,
      prompt: `Generate multi-level explanations for these concepts:

${conceptDescriptions}

Return JSON with a "concepts" array where each item has: id, beginner_explanation, intermediate_explanation, advanced_explanation.`,
      schema: depthMappingSchema,
      schemaName: 'depth_mapping',
      maxTokens: 4096,
    });

    // Update concepts with level explanations
    for (const concept of result.concepts) {
      await supabase
        .from('concepts')
        .update({
          beginner_explanation: concept.beginner_explanation,
          intermediate_explanation: concept.intermediate_explanation,
          advanced_explanation: concept.advanced_explanation,
        })
        .eq('project_id', projectId)
        .eq('concept_key', concept.id);
    }
  } catch (err) {
    console.error('Multi-level explanations failed:', err);
  }
}

async function generateRelationshipExplanations(
  projectId: string,
  synthesis: ConceptSynthesisResult,
  fileAnalyses: FileAnalysis[]
) {
  const edgeDescriptions = synthesis.edges
    .map((e) => `${e.source} → ${e.target}: ${e.relationship} (${e.strength})`)
    .join('\n');

  const conceptNames = Object.fromEntries(synthesis.concepts.map((c) => [c.id, c.name]));

  try {
    const result = await callClaudeStructured<{
      edges: Array<{ source: string; target: string; explanation: string }>;
    }>({
      system: `For each relationship between concepts, explain in plain English how they interact, with specific file references where possible. Respond with ONLY valid JSON, no markdown.`,
      prompt: `Explain these concept relationships:

${edgeDescriptions}

Concept names: ${JSON.stringify(conceptNames)}

Return JSON with an "edges" array where each item has: source, target, explanation.`,
      schema: relationshipDepthSchema,
      schemaName: 'relationship_depth',
      maxTokens: 4096,
    });

    for (const edge of result.edges) {
      await supabase
        .from('concept_edges')
        .update({ explanation: edge.explanation })
        .eq('project_id', projectId)
        .eq('source_concept_key', edge.source)
        .eq('target_concept_key', edge.target);
    }
  } catch (err) {
    console.error('Relationship explanations failed:', err);
  }
}
