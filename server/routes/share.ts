import { Hono } from 'hono';
import { supabase } from '../db/supabase.js';

const app = new Hono();

app.get('/:id', async (c) => {
  const id = c.req.param('id');

  // First: check if this is a project ID or share_slug in the projects table
  const { data: project } = await supabase
    .from('projects')
    .select('id, share_slug, visibility')
    .or(`id.eq.${id},share_slug.eq.${id}`)
    .single();

  if (project) {
    // Redirect to the full ExplorerView
    return c.json({ redirect: true, projectId: project.id });
  }

  // Fallback: legacy shared_analyses lookup
  const { data, error } = await supabase
    .from('shared_analyses')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) {
    return c.json({ error: 'Not found' }, 404);
  }

  return c.json(data);
});

export default app;
