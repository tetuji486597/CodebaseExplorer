// Stage 2: File analysis
import { supabase } from '../db/supabase.js';
import { callClaudeStructured } from '../ai/claude.js';
import { fileAnalysisSchema } from '../ai/schemas.js';
import { updateProgress } from './progress.js';

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
  fileTree: any,
): Promise<FileAnalysis[]> {
  const allFiles = Object.entries(fileContents);
  const allAnalyses: FileAnalysis[] = [];

  // Large batches — fewer API calls = faster pipeline
  const batchSize = 50;
  const batches: Array<[string, string][]> = [];

  for (let i = 0; i < allFiles.length; i += batchSize) {
    batches.push(allFiles.slice(i, i + batchSize));
  }

  // Process batches with concurrency limit to avoid rate limits while staying fast
  const CONCURRENCY = 3;
  let completedBatches = 0;

  async function processBatch(batch: [string, string][], batchIndex: number): Promise<FileAnalysis[]> {
    const fileDescriptions = batch
      .map(([path, content]) => {
        const truncated = content.substring(0, 1500);
        return `<file path="${path}">\n${truncated}\n</file>`;
      })
      .join('\n\n');

    try {
      console.log(`Analyzing batch ${batchIndex + 1}/${batches.length} (${batch.length} files)...`);
      const result = await callClaudeStructured<{ files: FileAnalysis[] }>({
        system: `You are analyzing code files for a ${framework} project. Be concise. For each file return: path, purpose (one short sentence), concepts (2-3 keywords), key_exports (max 3, name + brief description), depends_on (imported file paths), complexity (simple/moderate/complex), role (entry_point/core_logic/data/ui/utility/config/test/types).`,
        prompt: `Analyze these ${batch.length} files. Return a JSON "files" array with one entry per file.\n\n${fileDescriptions}`,
        schema: fileAnalysisSchema,
        schemaName: 'file_analysis',
        maxTokens: Math.min(8192, Math.max(4096, batch.length * 200)),
        model: 'fast',
      });
      // Ensure we got valid results — filter out undefined/null entries
      const files = (result.files || []).filter((f): f is FileAnalysis => f != null && typeof f.path === 'string');
      // Fill in any files the model missed
      const returnedPaths = new Set(files.map((f) => f.path));
      for (const [path] of batch) {
        if (!returnedPaths.has(path)) {
          files.push({ path, purpose: 'Not analyzed', concepts: [], key_exports: [], depends_on: [], complexity: 'moderate', role: 'source' });
        }
      }
      return files;
    } catch (err) {
      console.error(`File analysis batch ${batchIndex + 1} failed:`, err);
      return batch.map(([path]) => ({
        path,
        purpose: 'Analysis failed',
        concepts: [],
        key_exports: [],
        depends_on: [],
        complexity: 'moderate' as const,
        role: 'source' as const,
      }));
    } finally {
      completedBatches++;
      await updateProgress(projectId, 2, `Analyzing files (${completedBatches}/${batches.length})...`, undefined, {
        batch: completedBatches,
        totalBatches: batches.length,
      });
    }
  }

  // Run batches in waves of CONCURRENCY
  for (let i = 0; i < batches.length; i += CONCURRENCY) {
    const wave = batches.slice(i, i + CONCURRENCY);
    const waveResults = await Promise.all(
      wave.map((batch, offset) => processBatch(batch, i + offset))
    );
    allAnalyses.push(...waveResults.flat());
  }

  // Store analyses in files table (batch via Promise.all)
  const validAnalyses = allAnalyses.filter((a) => a && typeof a.path === 'string');
  await Promise.all(
    validAnalyses.map((analysis) =>
      supabase
        .from('files')
        .update({ analysis: analysis as any })
        .eq('project_id', projectId)
        .eq('path', analysis.path)
    )
  );

  return allAnalyses;
}
