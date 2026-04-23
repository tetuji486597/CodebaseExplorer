-- API usage tracking for cost visibility
create table if not exists api_usage (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete set null,
  model text not null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  cost_usd numeric(10,6) not null default 0,
  operation text not null,
  created_at timestamptz default now()
);

create index if not exists api_usage_project_idx on api_usage (project_id);
create index if not exists api_usage_created_idx on api_usage (created_at);
