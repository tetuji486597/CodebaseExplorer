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
      system: `Generate three levels of explanation for each concept, targeting CS students who know basic OOP, data structures, and algorithms:
- Beginner (Conceptual): Uses analogies to CS concepts they already know (classes, interfaces, inheritance, hash maps). Explains the "what" and "why" of this architectural piece.
- Intermediate (Applied): Connects to design patterns and software engineering principles (MVC, observer, factory, separation of concerns). Explains how this concept fits into the overall system architecture.
- Advanced (Under the Hood): Dives into implementation details — specific libraries, framework internals, performance trade-offs, and how an experienced engineer would evaluate this code.
Respond with ONLY valid JSON, no markdown.`,
      prompt: `Generate multi-level explanations for these concepts:

${conceptDescriptions}

Return JSON with a "concepts" array where each item has: id, beginner_explanation, intermediate_explanation, advanced_explanation.`,
      schema: depthMappingSchema,
      schemaName: 'depth_mapping',
      maxTokens: 4096,
    });

    // Update concepts with level explanations (batch via Promise.all)
    const concepts = Array.isArray(result?.concepts) ? result.concepts : [];
    if (concepts.length > 0) {
      await Promise.all(
        concepts.map((concept) =>
          supabase
            .from('concepts')
            .update({
              beginner_explanation: concept.beginner_explanation,
              intermediate_explanation: concept.intermediate_explanation,
              advanced_explanation: concept.advanced_explanation,
            })
            .eq('project_id', projectId)
            .eq('concept_key', concept.id)
        )
      );
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
      system: `For each relationship between concepts, explain how they interact using proper CS terminology. Reference specific files, describe data flow or control flow, and connect to patterns the student may recognize (e.g., dependency injection, event-driven communication, shared state). Respond with ONLY valid JSON, no markdown.`,
      prompt: `Explain these concept relationships:

${edgeDescriptions}

Concept names: ${JSON.stringify(conceptNames)}

Return JSON with an "edges" array where each item has: source, target, explanation.`,
      schema: relationshipDepthSchema,
      schemaName: 'relationship_depth',
      maxTokens: 4096,
    });

    const edges = Array.isArray(result?.edges) ? result.edges : [];
    if (edges.length > 0) {
      await Promise.all(
        edges.map((edge) =>
          supabase
            .from('concept_edges')
            .update({ explanation: edge.explanation })
            .eq('project_id', projectId)
            .eq('source_concept_key', edge.source)
            .eq('target_concept_key', edge.target)
        )
      );
    }
  } catch (err) {
    console.error('Relationship explanations failed:', err);
  }
}
