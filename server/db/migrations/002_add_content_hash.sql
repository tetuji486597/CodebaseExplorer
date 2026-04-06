-- Add content_hash column for caching duplicate uploads
alter table projects add column if not exists content_hash text;
create index if not exists projects_content_hash_idx on projects (content_hash) where pipeline_status = 'complete';
