-- Enable pgvector
create extension if not exists vector with schema extensions;

-- Projects
create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  framework text,
  language text,
  file_count integer,
  summary text,
  pipeline_status text default 'pending',
  pipeline_progress jsonb default '{}',
  created_at timestamptz default now()
);

-- Files (one row per code file)
create table if not exists files (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  path text not null,
  name text not null,
  content text,
  analysis jsonb,
  concept_id text,
  role text,
  importance_score float default 0,
  created_at timestamptz default now(),
  unique(project_id, path)
);

-- Concepts
create table if not exists concepts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  concept_key text not null,
  name text not null,
  emoji text,
  color text,
  metaphor text,
  one_liner text,
  explanation text,
  deep_explanation text,
  beginner_explanation text,
  intermediate_explanation text,
  advanced_explanation text,
  importance text,
  created_at timestamptz default now(),
  unique(project_id, concept_key)
);

-- Concept Edges
create table if not exists concept_edges (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  source_concept_key text not null,
  target_concept_key text not null,
  relationship text not null,
  strength text,
  explanation text,
  created_at timestamptz default now()
);

-- Code Chunks (for RAG)
create table if not exists code_chunks (
  id bigint primary key generated always as identity,
  project_id uuid references projects(id) on delete cascade,
  file_path text not null,
  chunk_index integer not null,
  content text not null,
  context_summary text,
  metadata jsonb default '{}',
  embedding extensions.vector(1536),
  created_at timestamptz default now()
);

-- HNSW index for fast similarity search
create index if not exists code_chunks_embedding_idx on code_chunks
  using hnsw (embedding vector_cosine_ops);

-- Full-text search for hybrid retrieval
alter table code_chunks add column if not exists fts tsvector
  generated always as (to_tsvector('english', content)) stored;
create index if not exists code_chunks_fts_idx on code_chunks using gin (fts);

-- Metadata index for filtered queries
create index if not exists code_chunks_metadata_idx on code_chunks using gin (metadata);
create index if not exists code_chunks_project_idx on code_chunks (project_id);

-- User State
create table if not exists user_state (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  explored_concepts text[] default '{}',
  explored_files text[] default '{}',
  time_per_concept jsonb default '{}',
  understanding_level jsonb default '{}',
  exploration_path text[] default '{}',
  current_position integer default 0,
  insights_seen text[] default '{}',
  total_exploration_time integer default 0,
  last_active_at timestamptz default now(),
  created_at timestamptz default now()
);

-- Insights
create table if not exists insights (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  title text not null,
  category text not null,
  summary text not null,
  detail text not null,
  related_concept_keys text[] default '{}',
  related_file_paths text[] default '{}',
  priority integer default 5,
  requires_understanding text[] default '{}',
  created_at timestamptz default now()
);

-- Chat Messages
create table if not exists chat_messages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  role text not null,
  content text not null,
  context jsonb default '{}',
  created_at timestamptz default now()
);

-- Hybrid search function
create or replace function search_code_chunks(
  p_project_id uuid,
  query_text text,
  query_embedding extensions.vector(1536),
  match_threshold float default 0.3,
  match_count int default 10,
  filter_concept text default null
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
  order by
    (1 - (c.embedding <=> query_embedding)) * 0.7
    + ts_rank(c.fts, websearch_to_tsquery('english', query_text)) * 0.3
    desc
  limit least(match_count, 50);
$$;
