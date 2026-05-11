-- Add display_order and has_further_depth columns to sub_concepts
alter table sub_concepts add column if not exists display_order integer default 0;
alter table sub_concepts add column if not exists has_further_depth boolean default true;
