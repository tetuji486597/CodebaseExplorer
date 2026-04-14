// Stage 3: Concept synthesis
import { supabase } from '../db/supabase.js';
import { callClaudeStructured } from '../ai/claude.js';
import { conceptSynthesisSchema } from '../ai/schemas.js';
import type { FileAnalysis } from './fileAnalysis.js';

export interface ConceptSynthesisResult {
  concepts: Array<{
    id: string;
    name: string;
    color: string;
    metaphor: string;
    one_liner: string;
    explanation: string;
    deep_explanation: string;
    file_ids: string[];
    importance: string;
  }>;
  edges: Array<{
    source: string;
    target: string;
    relationship: string;
    strength: string;
  }>;
  suggested_starting_concept: string;
  codebase_summary: string;
}

export async function runConceptSynthesis(
  projectId: string,
  fileAnalyses: FileAnalysis[],
  fileTree: any,
  framework: string
): Promise<ConceptSynthesisResult> {
  const analysisText = fileAnalyses
    .map(
      (f) =>
        `File: ${f.path}
Purpose: ${f.purpose || 'unknown'}
Concepts: ${(f.concepts || []).join(', ')}
Exports: ${(f.key_exports || []).map((e) => e.name).join(', ')}
Role: ${f.role || 'source'}
Complexity: ${f.complexity || 'moderate'}
Dependencies: ${(f.depends_on || []).join(', ')}`
    )
    .join('\n\n');

  console.log(`Concept synthesis input: ${fileAnalyses.length} files, analysisText length: ${analysisText.length}`);

  const allPaths = fileAnalyses.map((f) => f.path);

  const raw = await callClaudeStructured<any>({
    system: `You are synthesizing an architecture map from file analyses for developers joining a new codebase (onboarding engineers, due-diligence reviewers, open-source contributors, legacy-code auditors). Create meaningful architectural concepts that group related files. Name concepts using proper software engineering terminology where applicable (e.g., "Authentication Middleware", "REST API Layer", "State Management", "Data Access Layer") rather than generic labels. For the "metaphor" field, give a concise real-world analogy that helps someone quickly grasp the concept's role (e.g., "Acts as a security checkpoint — every request passes through here before reaching any handler"). For "explanation", use precise technical language for working engineers while still explaining project-specific patterns.

You MUST return a JSON object with EXACTLY these fields:
{
  "concepts": [
    {
      "id": "short_key",
      "name": "Human Readable Name",
      "color": "teal|purple|coral|blue|amber|pink|green|gray",
      "metaphor": "real-world analogy",
      "one_liner": "10 words max",
      "explanation": "2-3 sentences, plain English",
      "deep_explanation": "1 sentence, technical summary for advanced users",
      "file_ids": ["array of file paths"],
      "importance": "critical|important|supporting"
    }
  ],
  "edges": [
    { "source": "concept_id", "target": "concept_id", "relationship": "description", "strength": "strong|moderate|weak" }
  ],
  "suggested_starting_concept": "concept_id",
  "codebase_summary": "2-3 sentences"
}`,
    prompt: `This is a ${framework} project with ${fileAnalyses.length} files.

File paths: ${allPaths.join(', ')}

File analyses:
${analysisText}

Create a concept map with 3-10 concepts (scale with complexity). Every file must belong to exactly one concept. Use the exact JSON field names shown in the system prompt.`,
    schema: conceptSynthesisSchema,
    schemaName: 'concept_synthesis',
    maxTokens: Math.min(8192, Math.max(4096, fileAnalyses.length * 200)),
    model: 'fast',
  });

  console.log(`Concept synthesis raw response keys: ${Object.keys(raw)}, concepts: ${raw.concepts?.length}, edges: ${raw.edges?.length}`);

  // Normalize Claude's response — it sometimes uses different field names
  const normalizeConcept = (c: any) => ({
    id: c.id || c.key || 'unknown',
    name: c.name || c.label || c.title || c.id || 'Unnamed',
    color: c.color || 'gray',
    metaphor: c.metaphor || c.analogy || '',
    one_liner: c.one_liner || c.oneLiner || c.summary || '',
    explanation: c.explanation || c.description || c.detail || '',
    deep_explanation: c.deep_explanation || c.deepExplanation || c.explanation || c.description || '',
    file_ids: Array.isArray(c.file_ids) ? c.file_ids : Array.isArray(c.files) ? c.files : Array.isArray(c.fileIds) ? c.fileIds : [],
    importance: c.importance || c.priority || 'supporting',
  });

  const normalizeEdge = (e: any) => ({
    source: e.source || e.from || '',
    target: e.target || e.to || '',
    relationship: e.relationship || e.label || e.description || 'related to',
    strength: e.strength || e.weight || 'moderate',
  });

  const result: ConceptSynthesisResult = {
    concepts: (raw.concepts || []).map(normalizeConcept),
    edges: (raw.edges || []).map(normalizeEdge),
    suggested_starting_concept: raw.suggested_starting_concept || raw.suggestedStartingConcept || raw.startingConcept || (raw.concepts?.[0]?.id || ''),
    codebase_summary: raw.codebase_summary || raw.codebaseSummary || raw.summary || '',
  };

  // Store concepts (batch insert)
  console.log(`Storing ${result.concepts.length} concepts for project ${projectId}`);
  const conceptRows = result.concepts.map((concept) => ({
    project_id: projectId,
    concept_key: concept.id,
    name: concept.name,
    color: concept.color,
    metaphor: concept.metaphor,
    one_liner: concept.one_liner,
    explanation: concept.explanation,
    deep_explanation: concept.deep_explanation,
    importance: concept.importance,
  }));
  const { error: conceptsError } = await supabase.from('concepts').insert(conceptRows);
  if (conceptsError) {
    console.error('Failed to batch insert concepts:', conceptsError);
  }

  // Update files with concept_id (batch via Promise.all)
  const fileUpdatePromises = result.concepts.flatMap((concept) =>
    concept.file_ids.map((filePath) =>
      supabase
        .from('files')
        .update({ concept_id: concept.id })
        .eq('project_id', projectId)
        .eq('path', filePath)
    )
  );
  await Promise.all(fileUpdatePromises);

  // Store edges (batch insert)
  const edgeRows = result.edges
    .filter((edge) => edge.source && edge.target)
    .map((edge) => ({
      project_id: projectId,
      source_concept_key: edge.source,
      target_concept_key: edge.target,
      relationship: edge.relationship,
      strength: edge.strength,
    }));
  if (edgeRows.length > 0) {
    const { error: edgesError } = await supabase.from('concept_edges').insert(edgeRows);
    if (edgesError) {
      console.error('Failed to batch insert edges:', edgesError);
    }
  }

  // Update project summary
  await supabase
    .from('projects')
    .update({ summary: result.codebase_summary })
    .eq('id', projectId);

  return result;
}
