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
  if (!synthesis.concepts.length) return;

  const tasks: Promise<void>[] = [
    generateMultiLevelExplanations(projectId, synthesis, fileAnalyses),
  ];
  // Only generate relationship explanations if there are edges to explain
  if (synthesis.edges.length > 0) {
    tasks.push(generateRelationshipExplanations(projectId, synthesis, fileAnalyses));
  }
  await Promise.all(tasks);
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
      system: `Generate three levels of explanation for each architectural concept, targeting developers joining a new codebase (new hires, open-source contributors, technical reviewers):
- Beginner (Conceptual): Plain-language overview using real-world analogies. Explains "what this does" and "why it exists" without assuming familiarity with the codebase.
- Intermediate (Applied): Connects to design patterns and engineering principles (MVC, observer, dependency injection, separation of concerns). Explains how this concept fits into the system architecture, referencing specific functions and data flows.
- Advanced (Under the Hood): Implementation details — specific libraries, framework internals, performance trade-offs, security considerations, and what an experienced engineer would want to know before modifying this code.
Each level MUST be meaningfully different from the others — not the same idea reworded. Respond with ONLY valid JSON, no markdown.`,
      prompt: `Generate multi-level explanations for these concepts:

${conceptDescriptions}

Return JSON with a "concepts" array where each item has: id, beginner_explanation, intermediate_explanation, advanced_explanation.`,
      schema: depthMappingSchema,
      schemaName: 'depth_mapping',
      maxTokens: synthesis.concepts.length <= 3 ? 2048 : 4096,
      model: 'fast',
      operation: 'depth_mapping',
      projectId,
    });

    // Update concepts with level explanations (batch via Promise.all)
    const validKeys = new Set(synthesis.concepts.map((c) => c.id));
    const concepts = (Array.isArray(result?.concepts) ? result.concepts : [])
      .filter((c) => validKeys.has(c.id));
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
      system: `For each relationship between concepts, explain how they interact using precise engineering terminology. Reference specific files, describe data flow or control flow, and connect to well-known patterns (e.g., dependency injection, event-driven communication, shared state, pub/sub). Respond with ONLY valid JSON, no markdown.`,
      prompt: `Explain these concept relationships:

${edgeDescriptions}

Concept names: ${JSON.stringify(conceptNames)}

Return JSON with an "edges" array where each item has: source, target, explanation.`,
      operation: 'depth_mapping',
      projectId,
      schema: relationshipDepthSchema,
      schemaName: 'relationship_depth',
      maxTokens: 4096,
      model: 'fast',
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

const DEPTH_SYSTEM_PROMPT = `Generate three levels of explanation for an architectural concept, targeting developers joining a new codebase (new hires, open-source contributors, technical reviewers):
- Beginner (Conceptual): Plain-language overview using real-world analogies. Explains "what this does" and "why it exists" without assuming familiarity with the codebase.
- Intermediate (Applied): Connects to design patterns and engineering principles (MVC, observer, dependency injection, separation of concerns). Explains how this concept fits into the system architecture, referencing specific functions and data flows.
- Advanced (Under the Hood): Implementation details — specific libraries, framework internals, performance trade-offs, security considerations, and what an experienced engineer would want to know before modifying this code.
Each level MUST be meaningfully different from the others — not the same idea reworded. Respond with ONLY valid JSON, no markdown.`;

export async function generateDepthForConcept(
  projectId: string,
  conceptKey: string,
  synthesis: ConceptSynthesisResult,
  fileAnalyses: FileAnalysis[],
): Promise<{ beginner: string; intermediate: string; advanced: string } | null> {
  const concept = synthesis.concepts.find((c) => c.id === conceptKey);
  if (!concept) return null;

  const { data: existing } = await supabase
    .from('concepts')
    .select('beginner_explanation')
    .eq('project_id', projectId)
    .eq('concept_key', conceptKey)
    .single();

  if (existing?.beginner_explanation) return null;

  const conceptDescription = `Concept: ${concept.name} (${concept.id})
Description: ${concept.explanation}
Files: ${(Array.isArray(concept.file_ids) ? concept.file_ids : []).join(', ')}
Metaphor: ${concept.metaphor}`;

  const result = await callClaudeStructured<{
    concepts: Array<{
      id: string;
      beginner_explanation: string;
      intermediate_explanation: string;
      advanced_explanation: string;
    }>;
  }>({
    system: DEPTH_SYSTEM_PROMPT,
    prompt: `Generate multi-level explanations for this concept:

${conceptDescription}

Return JSON with a "concepts" array containing one item with: id, beginner_explanation, intermediate_explanation, advanced_explanation.`,
    schema: depthMappingSchema,
    schemaName: 'depth_mapping',
    maxTokens: 2048,
    model: 'fast',
    operation: 'depth_mapping_lazy',
    projectId,
  });

  const generated = result.concepts?.[0];
  if (!generated) return null;

  await supabase
    .from('concepts')
    .update({
      beginner_explanation: generated.beginner_explanation,
      intermediate_explanation: generated.intermediate_explanation,
      advanced_explanation: generated.advanced_explanation,
    })
    .eq('project_id', projectId)
    .eq('concept_key', conceptKey);

  return {
    beginner: generated.beginner_explanation,
    intermediate: generated.intermediate_explanation,
    advanced: generated.advanced_explanation,
  };
}
