import { Hono } from 'hono';
import { supabase } from '../db/supabase.js';

const app = new Hono();

// PATCH /api/user-state - Update user exploration state
app.patch('/', async (c) => {
  const body = await c.req.json();
  const { projectId, ...updates } = body;

  if (!projectId) {
    return c.json({ error: 'projectId required' }, 400);
  }

  // Upsert user state
  const { data: existing } = await supabase
    .from('user_state')
    .select('id')
    .eq('project_id', projectId)
    .single();

  if (existing) {
    const { error } = await supabase
      .from('user_state')
      .update({ ...updates, last_active_at: new Date().toISOString() })
      .eq('project_id', projectId);

    if (error) return c.json({ error: error.message }, 500);
  } else {
    const { error } = await supabase
      .from('user_state')
      .insert({ project_id: projectId, ...updates });

    if (error) return c.json({ error: error.message }, 500);
  }

  return c.json({ ok: true });
});

// GET /api/user-state/:projectId
app.get('/:projectId', async (c) => {
  const projectId = c.req.param('projectId');

  const { data, error } = await supabase
    .from('user_state')
    .select('*')
    .eq('project_id', projectId)
    .single();

  if (error) return c.json({ error: error.message }, 404);
  return c.json(data);
});

export default app;
