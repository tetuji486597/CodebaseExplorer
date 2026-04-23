-- Add columns to projects for CLI unification and sharing
alter table projects add column if not exists source text default 'web';
alter table projects add column if not exists query text;
alter table projects add column if not exists visibility text default 'private';
alter table projects add column if not exists share_slug text;
alter table projects add column if not exists user_id uuid;

-- Unique index on share_slug (only non-null values)
create unique index if not exists projects_share_slug_idx on projects (share_slug) where share_slug is not null;

-- Index for looking up user's projects
create index if not exists projects_user_id_idx on projects (user_id) where user_id is not null;

-- Add user_id to chat_messages for multi-user collaboration
alter table chat_messages add column if not exists user_id uuid;

-- Update content_hash index to also cover 'enriched' status
drop index if exists projects_content_hash_idx;
create index if not exists projects_content_hash_idx on projects (content_hash) where pipeline_status in ('complete', 'enriched');
