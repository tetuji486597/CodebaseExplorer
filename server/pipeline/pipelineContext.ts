import { supabase } from '../db/supabase.js';
import type { ConceptSynthesisResult } from './conceptSynthesis.js';
import type { FileAnalysis } from './fileAnalysis.js';

const BUCKET = 'file-contents';

export interface PipelineContext {
  synthesis: ConceptSynthesisResult;
  fileAnalyses: FileAnalysis[];
}

export async function storePipelineContext(
  projectId: string,
  synthesis: ConceptSynthesisResult,
  fileAnalyses: FileAnalysis[],
): Promise<void> {
  const payload = JSON.stringify({ synthesis, fileAnalyses });
  const path = `${projectId}/pipeline-context.json`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, payload, {
      contentType: 'application/json',
      upsert: true,
    });

  if (error) throw error;
  console.log(`[pipeline-context] Stored for project ${projectId} (${(payload.length / 1024).toFixed(1)}KB)`);
}

export async function loadPipelineContext(projectId: string): Promise<PipelineContext | null> {
  const path = `${projectId}/pipeline-context.json`;

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .download(path);

  if (error || !data) return null;

  try {
    const text = await data.text();
    return JSON.parse(text) as PipelineContext;
  } catch {
    return null;
  }
}
