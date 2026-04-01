import { supabase } from '../db/supabase.js';

export interface RetrievedChunk {
  id: number;
  file_path: string;
  chunk_index: number;
  content: string;
  context_summary: string;
  metadata: Record<string, any>;
  similarity: number;
  text_rank: number;
}

export async function retrieveChunks(
  projectId: string,
  queryText: string,
  queryEmbedding: number[],
  matchCount: number = 10,
  filterConcept?: string
): Promise<RetrievedChunk[]> {
  const { data, error } = await supabase.rpc('search_code_chunks', {
    p_project_id: projectId,
    query_text: queryText,
    query_embedding: JSON.stringify(queryEmbedding),
    match_threshold: 0.3,
    match_count: matchCount,
    filter_concept: filterConcept || null,
  });

  if (error) {
    console.error('Retrieval error:', error);
    // Fallback: simple text search without embeddings
    const { data: fallbackData } = await supabase
      .from('code_chunks')
      .select('*')
      .eq('project_id', projectId)
      .textSearch('fts', queryText, { type: 'websearch' })
      .limit(matchCount);

    return (fallbackData || []) as RetrievedChunk[];
  }

  return (data || []) as RetrievedChunk[];
}
