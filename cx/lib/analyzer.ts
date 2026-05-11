import { callClaudeStructured } from './ai.js';

export interface FileAnalysis {
  path: string;
  purpose: string;
  concepts: string[];
  key_exports: Array<{ name: string; what_it_does: string }>;
  depends_on: string[];
  complexity: string;
  role: string;
}

export interface Concept {
  id: string;
  name: string;
  color: string;
  metaphor: string;
  one_liner: string;
  explanation: string;
  file_ids: string[];
  importance: string;
}

export interface Edge {
  source: string;
  target: string;
  relationship: string;
  strength: string;
}

export interface AnalysisResult {
  files: FileAnalysis[];
  concepts: Concept[];
  edges: Edge[];
  summary: string;
  suggestedStart: string;
}

const fileAnalysisSchema = {
  type: 'object' as const,
  properties: {
    files: {
      type: 'array' as const,
      items: {
        type: 'object' as const,
        properties: {
          path: { type: 'string' as const },
          purpose: { type: 'string' as const },
          concepts: { type: 'array' as const, items: { type: 'string' as const } },
          key_exports: {
            type: 'array' as const,
            items: {
              type: 'object' as const,
              properties: {
                name: { type: 'string' as const },
                what_it_does: { type: 'string' as const },
              },
              required: ['name', 'what_it_does'],
            },
          },
          depends_on: { type: 'array' as const, items: { type: 'string' as const } },
          complexity: { type: 'string' as const, enum: ['simple', 'moderate', 'complex'] },
          role: { type: 'string' as const, enum: ['entry_point', 'core_logic', 'data', 'ui', 'utility', 'config', 'test', 'types'] },
        },
        required: ['path', 'purpose', 'concepts', 'key_exports', 'depends_on', 'complexity', 'role'],
      },
    },
  },
  required: ['files'],
};

const conceptSynthesisSchema = {
  type: 'object' as const,
  properties: {
    concepts: {
      type: 'array' as const,
      items: {
        type: 'object' as const,
        properties: {
          id: { type: 'string' as const },
          name: { type: 'string' as const },
          color: { type: 'string' as const, enum: ['teal', 'purple', 'coral', 'blue', 'amber', 'pink', 'green', 'gray'] },
          metaphor: { type: 'string' as const },
          one_liner: { type: 'string' as const },
          explanation: { type: 'string' as const },
          file_ids: { type: 'array' as const, items: { type: 'string' as const } },
          importance: { type: 'string' as const, enum: ['critical', 'important', 'supporting'] },
        },
        required: ['id', 'name', 'color', 'metaphor', 'one_liner', 'explanation', 'file_ids', 'importance'],
      },
    },
    edges: {
      type: 'array' as const,
      items: {
        type: 'object' as const,
        properties: {
          source: { type: 'string' as const },
          target: { type: 'string' as const },
          relationship: { type: 'string' as const },
          strength: { type: 'string' as const, enum: ['strong', 'moderate', 'weak'] },
        },
        required: ['source', 'target', 'relationship', 'strength'],
      },
    },
    suggested_starting_concept: { type: 'string' as const },
    codebase_summary: { type: 'string' as const },
  },
  required: ['concepts', 'edges', 'suggested_starting_concept', 'codebase_summary'],
};

export async function analyze(
  fileContents: Record<string, string>,
  framework: string,
  query: string
): Promise<AnalysisResult> {
  // Step 1: File analysis
  const fileDescriptions = Object.entries(fileContents)
    .map(([path, content]) => {
      const truncated = content.substring(0, 1500);
      return `<file path="${path}">\n${truncated}\n</file>`;
    })
    .join('\n\n');

  const fileCount = Object.keys(fileContents).length;

  const fileResult = await callClaudeStructured<{ files: FileAnalysis[] }>({
    system: `You are analyzing code files for a ${framework} project, scoped to answer the query: "${query}". Be concise. For each file return: path, purpose (one short sentence focused on how it relates to the query), concepts (2-3 keywords), key_exports (max 3), depends_on (imported file paths), complexity, role.`,
    prompt: `Analyze these ${fileCount} files. Return a JSON "files" array with one entry per file.\n\n${fileDescriptions}`,
    schema: fileAnalysisSchema,
    schemaName: 'file_analysis',
    maxTokens: Math.min(8192, Math.max(4096, fileCount * 200)),
    model: 'fast',
  });

  const files = (fileResult.files || []).filter(
    (f): f is FileAnalysis => f != null && typeof f.path === 'string'
  );

  // Fill in any missed files
  const returnedPaths = new Set(files.map((f) => f.path));
  for (const path of Object.keys(fileContents)) {
    if (!returnedPaths.has(path)) {
      files.push({
        path,
        purpose: 'Not analyzed',
        concepts: [],
        key_exports: [],
        depends_on: [],
        complexity: 'moderate',
        role: 'source',
      });
    }
  }

  // Step 2: Concept synthesis — query-scoped
  const analysisText = files
    .map((f) => `File: ${f.path}\nPurpose: ${f.purpose}\nConcepts: ${f.concepts.join(', ')}\nExports: ${f.key_exports.map((e) => e.name).join(', ')}\nRole: ${f.role}\nDependencies: ${f.depends_on.join(', ')}`)
    .join('\n\n');

  const allPaths = files.map((f) => f.path);

  const raw = await callClaudeStructured<{
    concepts: Array<{
      id: string; name: string; color: string; metaphor: string;
      one_liner: string; explanation: string; file_ids: string[]; importance: string;
    }>;
    edges: Array<{ source: string; target: string; relationship: string; strength: string }>;
    suggested_starting_concept: string;
    codebase_summary: string;
  }>({
    system: `You are synthesizing an architecture map scoped to a specific query. The user asked: "${query}". Create concepts that explain how this feature/system works, grouping related files. Name concepts using proper software engineering terms. For "metaphor", give a real-world analogy. For "explanation", be precise and technical. Every file must belong to exactly one concept.`,
    prompt: `This is a ${framework} project. The user asked: "${query}"\n\nFile paths: ${allPaths.join(', ')}\n\nFile analyses:\n${analysisText}\n\nCreate a focused concept map with 3-8 concepts that trace how "${query}" works through the codebase. Every file must belong to exactly one concept.`,
    schema: conceptSynthesisSchema,
    schemaName: 'concept_synthesis',
    maxTokens: Math.min(8192, Math.max(4096, fileCount * 200)),
    model: 'fast',
  });

  const concepts: Concept[] = (raw.concepts || []).map((c) => ({
    id: c.id || 'unknown',
    name: c.name || c.id || 'Unnamed',
    color: c.color || 'gray',
    metaphor: c.metaphor || '',
    one_liner: c.one_liner || '',
    explanation: c.explanation || '',
    file_ids: Array.isArray(c.file_ids) ? c.file_ids : [],
    importance: c.importance || 'supporting',
  }));

  const edges: Edge[] = (raw.edges || []).map((e) => ({
    source: e.source || '',
    target: e.target || '',
    relationship: e.relationship || 'related to',
    strength: e.strength || 'moderate',
  }));

  return {
    files,
    concepts,
    edges,
    summary: raw.codebase_summary || '',
    suggestedStart: raw.suggested_starting_concept || concepts[0]?.id || '',
  };
}
