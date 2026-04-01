import { Hono } from 'hono';
import { supabase } from '../db/supabase.js';
import { getNextAction } from '../proactive/engine.js';

const app = new Hono();

// POST /api/proactive - Get next proactive action
app.post('/', async (c) => {
  const { projectId } = await c.req.json();

  const [projectRes, userStateRes, conceptsRes, edgesRes, insightsRes] = await Promise.all([
    supabase.from('projects').select('*').eq('id', projectId).single(),
    supabase.from('user_state').select('*').eq('project_id', projectId).single(),
    supabase.from('concepts').select('*').eq('project_id', projectId),
    supabase.from('concept_edges').select('*').eq('project_id', projectId),
    supabase.from('insights').select('*').eq('project_id', projectId).order('priority', { ascending: false }),
  ]);

  const project = projectRes.data;
  const userState = userStateRes.data;
  const concepts = conceptsRes.data || [];
  const edges = edgesRes.data || [];
  const insights = insightsRes.data || [];

  if (!project || !userState) {
    return c.json({ action: 'nothing', reason: 'No project or user state', priority: 'low' });
  }

  const action = await getNextAction(userState, project, concepts, edges, insights);
  return c.json(action);
});

export default app;
