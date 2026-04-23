import type { SupabaseClient } from '@supabase/supabase-js';

const SESSION_GAP_MS = 30 * 60 * 1000;

export async function resolveSessionId(
  db: SupabaseClient,
  projectId: string,
  providedSessionId?: string,
): Promise<string> {
  if (providedSessionId) return providedSessionId;

  const { data: lastMsg } = await db
    .from('chat_messages')
    .select('session_id, created_at')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (lastMsg?.session_id) {
    const gap = Date.now() - new Date(lastMsg.created_at).getTime();
    if (gap < SESSION_GAP_MS) return lastMsg.session_id;
  }

  return `${projectId.slice(0, 8)}-${Date.now()}`;
}
