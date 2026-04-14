// Stage 2: File analysis
import { supabase } from '../db/supabase.js';
import { callClaudeStructured } from '../ai/claude.js';
import { fileAnalysisSchema } from '../ai/schemas.js';

export interface FileAnalysis {
  path: string;
  purpose: string;
  concepts: string[];
  key_exports: Array<{ name: string; what_it_does: string }>;
  depends_on: string[];
  complexity: string;
  role: string;
}

export async function runFileAnalysis(
  projectId: string,
  fileContents: Record<string, string>,
  framework: string,
  fileTree: any
): Promise<FileAnalysis[]> {
  const allFiles = Object.entries(fileContents);
  const allAnalyses: FileAnalysis[] = [];

  // Large batches — send all files in one call when possible
  const batchSize = 30;
  const batches: Array<[string, string][]> = [];

  for (let i = 0; i < allFiles.length; i += batchSize) {
    batches.push(allFiles.slice(i, i + batchSize));
  }

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const fileDescriptions = batch
      .map(([path, content]) => {
        const truncated = content.substring(0, 1500);
        return `<file path="${path}">\n${truncated}\n</file>`;
      })
      .join('\n\n');

    try {
      console.log(`Analyzing batch ${i + 1}/${batches.length} (${batch.length} files)...`);
      const result = await callClaudeStructured<{ files: FileAnalysis[] }>({
        system: `You are analyzing code files for a ${framework} project. Be concise. For each file return: path, purpose (one short sentence), concepts (2-3 keywords), key_exports (max 3, name + brief description), depends_on (imported file paths), complexity (simple/moderate/complex), role (entry_point/core_logic/data/ui/utility/config/test/types).`,
        prompt: `Analyze these ${batch.length} files. Return a JSON "files" array with one entry per file.\n\n${fileDescriptions}`,
        schema: fileAnalysisSchema,
        schemaName: 'file_analysis',
        maxTokens: Math.min(8192, Math.max(4096, batch.length * 200)),
        model: 'fast',
      });

      allAnalyses.push(...result.files);
    } catch (err) {
      console.error(`File analysis batch ${i + 1} failed:`, err);
      // Return minimal analysis for failed batch
      allAnalyses.push(
        ...batch.map(([path]) => ({
          path,
          purpose: 'Analysis failed',
          concepts: [],
          key_exports: [],
          depends_on: [],
          complexity: 'moderate' as const,
          role: 'source' as const,
        }))
      );
    }

    // Small delay between batches to avoid burst rate limits
    if (i < batches.length - 1) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  // Store analyses in files table (batch via Promise.all)
  await Promise.all(
    allAnalyses.map((analysis) =>
      supabase
        .from('files')
        .update({ analysis: analysis as any })
        .eq('project_id', projectId)
        .eq('path', analysis.path)
    )
  );

  return allAnalyses;
}
