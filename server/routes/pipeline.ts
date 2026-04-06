import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { createHash } from 'crypto';
import { supabase } from '../db/supabase.js';
import { runPipeline } from '../pipeline/orchestrator.js';

const app = new Hono();

function computeContentHash(fileContents: Record<string, string>): string {
  const hash = createHash('sha256');
  const sortedKeys = Object.keys(fileContents).sort();
  for (const key of sortedKeys) {
    hash.update(key);
    hash.update(fileContents[key].substring(0, 200));
  }
  return hash.digest('hex');
}

// POST /api/pipeline/start - Kick off ingestion pipeline
app.post('/start', async (c) => {
  const body = await c.req.json();
  const { fileTree, fileContents, importEdges, projectName } = body;

  // Check for cached project with same content
  const contentHash = computeContentHash(fileContents || {});
  const { data: cached } = await supabase
    .from('projects')
    .select('id')
    .eq('content_hash', contentHash)
    .eq('pipeline_status', 'complete')
    .limit(1)
    .single();

  if (cached) {
    console.log(`Cache hit for content hash ${contentHash}, returning project ${cached.id}`);
    return c.json({ projectId: cached.id });
  }

  // Create project row
  const { data: project, error } = await supabase
    .from('projects')
    .insert({
      name: projectName || 'Untitled Project',
      pipeline_status: 'pending',
      file_count: Object.keys(fileContents || {}).length,
      content_hash: contentHash,
    })
    .select()
    .single();

  if (error) {
    console.error('Failed to create project:', error);
    return c.json({ error: 'Failed to create project' }, 500);
  }

  // Start pipeline in background (don't await)
  runPipeline(project.id, { fileTree, fileContents, importEdges }).catch((err) => {
    console.error('Pipeline failed:', err);
  });

  return c.json({ projectId: project.id });
});

// GET /api/pipeline/:id/stream - SSE stream of pipeline progress
app.get('/:id/stream', async (c) => {
  const projectId = c.req.param('id');

  return streamSSE(c, async (stream) => {
    let lastStatus = '';
    let complete = false;

    while (!complete) {
      const { data: project } = await supabase
        .from('projects')
        .select('pipeline_status, pipeline_progress')
        .eq('id', projectId)
        .single();

      if (project) {
        const currentStatus = JSON.stringify(project);
        if (currentStatus !== lastStatus) {
          await stream.writeSSE({
            data: JSON.stringify({
              status: project.pipeline_status,
              progress: project.pipeline_progress,
            }),
            event: 'progress',
          });
          lastStatus = currentStatus;
        }

        if (project.pipeline_status === 'complete' || project.pipeline_status === 'failed') {
          complete = true;
        }
      }

      if (!complete) {
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
  });
});

// GET /api/pipeline/:id/data - Get all project data (concepts, edges, files, insights)
app.get('/:id/data', async (c) => {
  const projectId = c.req.param('id');

  const [projectRes, conceptsRes, edgesRes, filesRes, insightsRes, userStateRes] = await Promise.all([
    supabase.from('projects').select('*').eq('id', projectId).single(),
    supabase.from('concepts').select('*').eq('project_id', projectId),
    supabase.from('concept_edges').select('*').eq('project_id', projectId),
    supabase.from('files').select('id, project_id, path, name, concept_id, role, importance_score, analysis').eq('project_id', projectId),
    supabase.from('insights').select('*').eq('project_id', projectId).order('priority', { ascending: false }),
    supabase.from('user_state').select('*').eq('project_id', projectId).single(),
  ]);

  // Auto-create user_state if it doesn't exist yet
  let userState = userStateRes.data;
  if (!userState && projectRes.data) {
    const { data } = await supabase
      .from('user_state')
      .insert({ project_id: projectId, explored_concepts: [], explored_files: [], time_per_concept: {} })
      .select()
      .single();
    userState = data;
  }

  return c.json({
    project: projectRes.data,
    concepts: conceptsRes.data || [],
    edges: edgesRes.data || [],
    files: filesRes.data || [],
    insights: insightsRes.data || [],
    userState,
  });
});

// GET /api/pipeline/:id/file-content - Get source code for a specific file
app.get('/:id/file-content', async (c) => {
  const projectId = c.req.param('id');
  const filePath = c.req.query('path');

  if (!filePath) {
    return c.json({ error: 'path query parameter required' }, 400);
  }

  const { data, error } = await supabase
    .from('files')
    .select('content')
    .eq('project_id', projectId)
    .eq('path', filePath)
    .single();

  if (error || !data) {
    return c.json({ error: 'File not found' }, 404);
  }

  return c.json({ content: data.content });
});

export default app;
