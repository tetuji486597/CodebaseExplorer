-- Add file_paths filter to search_code_chunks for sub-concept RAG retrieval
create or replace function search_code_chunks(
  p_project_id uuid,
  query_text text,
  query_embedding extensions.vector(1536),
  match_threshold float default 0.3,
  match_count int default 10,
  filter_concept text default null,
  filter_file_paths text[] default null
)
returns table (
  id bigint,
  file_path text,
  chunk_index integer,
  content text,
  context_summary text,
  metadata jsonb,
  similarity float,
  text_rank float
)
language sql
as $$
  select
    c.id,
    c.file_path,
    c.chunk_index,
    c.content,
    c.context_summary,
    c.metadata,
    1 - (c.embedding <=> query_embedding) as similarity,
    ts_rank(c.fts, websearch_to_tsquery('english', query_text)) as text_rank
  from code_chunks c
  where
    c.project_id = p_project_id
    and (
      c.embedding <=> query_embedding < 1 - match_threshold
      or c.fts @@ websearch_to_tsquery('english', query_text)
    )
    and (
      filter_concept is null
      or c.metadata->>'concept_id' = filter_concept
    )
    and (
      filter_file_paths is null
      or c.file_path = any(filter_file_paths)
    )
  order by
    (1 - (c.embedding <=> query_embedding)) * 0.7
    + ts_rank(c.fts, websearch_to_tsquery('english', query_text)) * 0.3
    desc
  limit least(match_count, 50);
$$;
