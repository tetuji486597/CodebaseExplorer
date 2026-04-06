// Maps codebase-specific concept names to universal concept taxonomy
import { supabase } from '../db/supabase.js';
import { callClaudeStructured } from '../ai/claude.js';

interface ConceptMappingResult {
  mappings: Array<{
    concept_key: string;
    universal_concept_names: string[];
  }>;
}

const conceptMappingSchema = {
  type: 'object',
  properties: {
    mappings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          concept_key: { type: 'string' },
          universal_concept_names: { type: 'array', items: { type: 'string' } },
        },
        required: ['concept_key', 'universal_concept_names'],
      },
    },
  },
  required: ['mappings'],
};

export async function runConceptMapping(projectId: string) {
  // Get the project's concepts
  const { data: projectConcepts } = await supabase
    .from('concepts')
    .select('concept_key, name, explanation')
    .eq('project_id', projectId);

  if (!projectConcepts || projectConcepts.length === 0) return;

  // Get universal concepts
  const { data: universalConcepts } = await supabase
    .from('universal_concepts')
    .select('id, name, description')
    .order('difficulty_order');

  if (!universalConcepts || universalConcepts.length === 0) return;

  const universalList = universalConcepts
    .map((uc) => `- ${uc.name}: ${uc.description}`)
    .join('\n');

  const conceptList = projectConcepts
    .map((c) => `- ${c.concept_key} ("${c.name}"): ${c.explanation?.slice(0, 150) || 'no description'}`)
    .join('\n');

  try {
    const result = await callClaudeStructured<ConceptMappingResult>({
      system: `You are mapping codebase-specific architectural concepts to a universal programming concept taxonomy. Each codebase concept may map to 1-3 universal concepts. Only map to concepts that genuinely apply — do not force mappings. Return the exact universal concept names as they appear in the list.`,
      prompt: `Universal programming concepts:\n${universalList}\n\nCodebase concepts to map:\n${conceptList}\n\nFor each codebase concept, return which universal concepts it maps to.`,
      schema: conceptMappingSchema,
      schemaName: 'concept_mapping',
      model: 'fast',
      maxTokens: 2048,
    });

    // Build a name→id lookup
    const nameToId = new Map(universalConcepts.map((uc) => [uc.name.toLowerCase(), uc.id]));

    // Insert mappings
    const rows: Array<{ project_id: string; concept_key: string; universal_concept_id: string }> = [];

    for (const mapping of result.mappings || []) {
      for (const uName of mapping.universal_concept_names || []) {
        const ucId = nameToId.get(uName.toLowerCase());
        if (ucId) {
          rows.push({
            project_id: projectId,
            concept_key: mapping.concept_key,
            universal_concept_id: ucId,
          });
        }
      }
    }

    if (rows.length > 0) {
      await supabase.from('concept_universal_map').insert(rows);
    }

    console.log(`Mapped ${rows.length} concept→universal relationships for project ${projectId}`);
  } catch (err) {
    console.error('Concept mapping failed:', err);
  }
}
