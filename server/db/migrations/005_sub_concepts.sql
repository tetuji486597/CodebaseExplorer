-- Sub-concepts: pre-generated lower-level concept decompositions
create table if not exists sub_concepts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  parent_concept_key text not null,
  sub_concept_key text not null,
  name text not null,
  one_liner text,
  color text,
  importance text default 'supporting',
  file_ids text[] default '{}',
  created_at timestamptz default now(),
  unique(project_id, sub_concept_key)
);

create table if not exists sub_concept_edges (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  parent_concept_key text not null,
  source_sub_key text not null,
  target_sub_key text not null,
  label text not null,
  created_at timestamptz default now()
);

create index if not exists sub_concepts_project_parent_idx
  on sub_concepts (project_id, parent_concept_key);
create index if not exists sub_concept_edges_project_parent_idx
  on sub_concept_edges (project_id, parent_concept_key);
