import { supabase } from '../db/supabase.js';
import { callClaudeStructured } from '../ai/claude.js';
import { subConceptGenerationSchema } from '../ai/schemas.js';
import type { ConceptSynthesisResult } from './conceptSynthesis.js';
import type { FileAnalysis } from './fileAnalysis.js';

const SYSTEM_PROMPT = `Decompose a single architectural concept into 3-5 sub-components that represent a lower level of abstraction. Each sub-component should represent a distinct responsibility or mechanism within the parent concept.

Rules:
- Sub-concept IDs MUST use the prefix provided (exp_{parent_id}_)
- 3-5 sub-concepts per parent, no more
- Each sub-concept gets a short, specific name and a one-liner (max 10 words)
- Assign file_ids only from the parent's file list
- Sub-edges describe how sub-concepts interact within the parent
- Colors should be from: teal, purple, coral, blue, amber, pink, green, gray
- For each sub-concept, set has_further_depth to true if it could meaningfully be decomposed further (has multiple distinct responsibilities or mechanisms), or false if it is atomic/leaf-level
- Set display_order (0-indexed) to define the learning sequence: start with the most foundational sub-concept (the one needed to understand the others), then build up in complexity. Think about what a student needs to learn first to understand the rest.
- Return ONLY valid JSON, no markdown`;

interface SubConceptResult {
  sub_concepts: Array<{
    id: string;
    name: string;
    one_liner: string;
    color: string;
    importance: string;
    file_ids?: string[];
    has_further_depth?: boolean;
    display_order?: number;
  }>;
  sub_edges: Array<{
    source: string;
    target: string;
    label: string;
  }>;
}

async function generateForConcept(
  concept: any,
  fileAnalyses: FileAnalysis[],
  projectId?: string,
): Promise<SubConceptResult | null> {
  const relevantFiles = fileAnalyses.filter(
    (f) => concept.file_ids?.includes(f.path)
  );

  if (relevantFiles.length === 0) return null;

  const fileDescriptions = relevantFiles
    .map(
      (f) =>
        `  ${f.path}: ${f.purpose || 'unknown'} (${f.role || 'source'}, exports: ${(f.key_exports || []).map((e) => e.name).join(', ')})`
    )
    .join('\n');

  try {
    const result = await callClaudeStructured<SubConceptResult>({
      system: SYSTEM_PROMPT,
      prompt: `Parent concept: "${concept.name}" (id: ${concept.id})
Description: ${concept.explanation}
Metaphor: ${concept.metaphor}
Importance: ${concept.importance}

Files in this concept:
${fileDescriptions}

Decompose into 3-5 sub-components. Use ID prefix: exp_${concept.id}_
Assign each file to the most relevant sub-concept.`,
      schema: subConceptGenerationSchema,
      schemaName: 'sub_concept_generation',
      maxTokens: 2048,
      model: 'fast',
      operation: 'sub_concept_generation',
      projectId,
    });

    return result;
  } catch (err) {
    console.error(`Sub-concept generation failed for ${concept.id}:`, err);
    return null;
  }
}

const MAX_DEPTH = 7;

function getDepth(conceptKey: string): number {
  const matches = conceptKey.match(/exp_/g);
  return matches ? matches.length : 0;
}

export async function generateSubConceptsOnDemand(
  projectId: string,
  conceptKey: string,
): Promise<SubConceptResult | null> {
  if (getDepth(conceptKey) >= MAX_DEPTH) return null;

  const { data: scRow } = await supabase
    .from('sub_concepts')
    .select('*')
    .eq('project_id', projectId)
    .eq('sub_concept_key', conceptKey)
    .single();

  if (!scRow || !scRow.file_ids?.length || scRow.file_ids.length < 2) return null;
  if (scRow.has_further_depth === false) return null;

  const { data: fileRows } = await supabase
    .from('files')
    .select('path, analysis')
    .eq('project_id', projectId)
    .in('path', scRow.file_ids);

  const fileAnalyses: FileAnalysis[] = (fileRows || [])
    .filter((f: any) => f.analysis)
    .map((f: any) => ({ path: f.path, ...f.analysis }));

  if (fileAnalyses.length === 0) return null;

  const concept = {
    id: conceptKey,
    name: scRow.name,
    explanation: scRow.one_liner || '',
    metaphor: '',
    importance: scRow.importance || 'supporting',
    file_ids: scRow.file_ids,
  };

  const result = await generateForConcept(concept, fileAnalyses, projectId);
  if (!result || !result.sub_concepts.length) return null;

  const subConceptRows: any[] = [];
  const subEdgeRows: any[] = [];

  for (const [i, sc] of result.sub_concepts.entries()) {
    subConceptRows.push({
      project_id: projectId,
      parent_concept_key: conceptKey,
      sub_concept_key: sc.id,
      name: sc.name,
      one_liner: sc.one_liner,
      color: sc.color,
      importance: sc.importance || 'supporting',
      file_ids: sc.file_ids || [],
      has_further_depth: sc.has_further_depth !== false,
      display_order: sc.display_order ?? i,
    });
  }
  for (const se of result.sub_edges) {
    subEdgeRows.push({
      project_id: projectId,
      parent_concept_key: conceptKey,
      source_sub_key: se.source,
      target_sub_key: se.target,
      label: se.label,
    });
  }

  if (subConceptRows.length > 0) {
    await supabase.from('sub_concepts').insert(subConceptRows);
  }
  if (subEdgeRows.length > 0) {
    await supabase.from('sub_concept_edges').insert(subEdgeRows);
  }

  return result;
}

export async function runSubConceptGeneration(
  projectId: string,
  synthesis: ConceptSynthesisResult,
  fileAnalyses: FileAnalysis[]
): Promise<void> {
  if (!synthesis.concepts.length) return;

  const stageStart = Date.now();
  const concurrency = 3;
  const results: Array<{ conceptKey: string; result: SubConceptResult }> = [];

  for (let i = 0; i < synthesis.concepts.length; i += concurrency) {
    const batch = synthesis.concepts.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map(async (concept) => {
        const result = await generateForConcept(concept, fileAnalyses, projectId);
        return { conceptKey: concept.id, result };
      })
    );
    for (const br of batchResults) {
      if (br.result) results.push(br as { conceptKey: string; result: SubConceptResult });
    }
  }

  if (results.length === 0) return;

  const subConceptRows: any[] = [];
  const subEdgeRows: any[] = [];

  for (const { conceptKey, result } of results) {
    for (const [i, sc] of result.sub_concepts.entries()) {
      subConceptRows.push({
        project_id: projectId,
        parent_concept_key: conceptKey,
        sub_concept_key: sc.id,
        name: sc.name,
        one_liner: sc.one_liner,
        color: sc.color,
        importance: sc.importance || 'supporting',
        file_ids: sc.file_ids || [],
        has_further_depth: sc.has_further_depth !== false,
        display_order: sc.display_order ?? i,
      });
    }
    for (const se of result.sub_edges) {
      subEdgeRows.push({
        project_id: projectId,
        parent_concept_key: conceptKey,
        source_sub_key: se.source,
        target_sub_key: se.target,
        label: se.label,
      });
    }
  }

  if (subConceptRows.length > 0) {
    await supabase.from('sub_concepts').insert(subConceptRows);
  }
  if (subEdgeRows.length > 0) {
    await supabase.from('sub_concept_edges').insert(subEdgeRows);
  }

  console.log(
    `[timing] Sub-concept generation: ${((Date.now() - stageStart) / 1000).toFixed(1)}s (${subConceptRows.length} sub-concepts for ${results.length} concepts)`
  );
}
