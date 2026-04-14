import { createHash } from 'crypto';
import { supabase } from '../db/supabase.js';

export function computeContentHash(fileContents: Record<string, string>): string {
  const hash = createHash('sha256');
  const sortedKeys = Object.keys(fileContents).sort();
  for (const key of sortedKeys) {
    hash.update(key);
    hash.update(fileContents[key].substring(0, 200));
    hash.update(String(fileContents[key].length));
  }
  return hash.digest('hex');
}

export async function findCachedProject(contentHash: string): Promise<string | null> {
  const { data } = await supabase
    .from('projects')
    .select('id')
    .eq('content_hash', contentHash)
    .in('pipeline_status', ['complete', 'enriched'])
    .limit(1)
    .single();

  return data?.id ?? null;
}
