// Stage 6: Embedding & Indexing
import { supabase } from '../db/supabase.js';
import { embedBatch } from '../rag/embedder.js';
import { chunkAllFiles, type CodeChunk } from '../rag/chunker.js';
import type { ConceptSynthesisResult } from './conceptSynthesis.js';
import type { FileAnalysis } from './fileAnalysis.js';

export async function runEmbedding(
  projectId: string,
  fileContents: Record<string, string>,
  fileAnalyses: FileAnalysis[],
  synthesis: ConceptSynthesisResult
) {
  // Build analysis map for chunker
  const fileAnalysisMap = new Map<string, { purpose?: string; concept_id?: string; concept_name?: string; role?: string }>();

  for (const analysis of fileAnalyses) {
    // Find which concept this file belongs to
    const concept = synthesis.concepts.find((c) => Array.isArray(c.file_ids) && c.file_ids.includes(analysis.path));
    fileAnalysisMap.set(analysis.path, {
      purpose: analysis.purpose,
      concept_id: concept?.id,
      concept_name: concept?.name,
      role: analysis.role,
    });
  }

  // Chunk all files
  const allChunks = chunkAllFiles(fileContents, fileAnalysisMap);
  console.log(`Generated ${allChunks.length} chunks from ${Object.keys(fileContents).length} files`);

  if (allChunks.length === 0) return;

  // Generate embeddings in batches
  const textsToEmbed = allChunks.map((c) => `${c.contextSummary}\n\n${c.content}`);

  // Batch embed (handle large sets)
  const batchSize = 100;
  const allEmbeddings: number[][] = [];

  for (let i = 0; i < textsToEmbed.length; i += batchSize) {
    const batch = textsToEmbed.slice(i, i + batchSize);
    try {
      const embeddings = await embedBatch(batch);
      allEmbeddings.push(...embeddings);
      console.log(`Embedded batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(textsToEmbed.length / batchSize)}`);
    } catch (err) {
      console.error(`Embedding batch failed at index ${i}:`, err);
      // Fill with null embeddings for failed batch
      for (let j = 0; j < batch.length; j++) {
        allEmbeddings.push([]);
      }
    }
  }

  // Store chunks with embeddings in Supabase
  const insertBatchSize = 20;
  for (let i = 0; i < allChunks.length; i += insertBatchSize) {
    const chunkBatch = allChunks.slice(i, i + insertBatchSize);
    const rows = chunkBatch.map((chunk, idx) => {
      const embIdx = i + idx;
      const embedding = allEmbeddings[embIdx];

      return {
        project_id: projectId,
        file_path: chunk.filePath,
        chunk_index: chunk.chunkIndex,
        content: chunk.content,
        context_summary: chunk.contextSummary,
        metadata: chunk.metadata,
        embedding: embedding && embedding.length > 0 ? JSON.stringify(embedding) : null,
      };
    });

    const { error } = await supabase.from('code_chunks').insert(rows);
    if (error) {
      console.error(`Failed to insert chunk batch at ${i}:`, error);
    }
  }

  console.log(`Stored ${allChunks.length} chunks with embeddings`);
}
