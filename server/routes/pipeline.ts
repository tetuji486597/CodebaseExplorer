import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { supabase } from '../db/supabase.js';
import { runPipeline } from '../pipeline/orchestrator.js';
import { computeContentHash, findCachedProject } from '../pipeline/contentHash.js';

const app = new Hono();

// GET /api/projects - List a user's completed projects
app.get('/projects', async (c) => {
  const userId = c.req.query('userId');
  if (!userId) return c.json({ error: 'Missing userId' }, 400);

  const { data, error } = await supabase
    .from('projects')
    .select('id, name, framework, language, file_count, summary, created_at, pipeline_status')
    .eq('user_id', userId)
    .in('pipeline_status', ['complete', 'enriched'])
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) return c.json({ error: error.message }, 500);

  // Attach concept count per project
  const projectIds = (data || []).map(p => p.id);
  const { data: counts } = await supabase
    .from('concepts')
    .select('project_id')
    .in('project_id', projectIds);

  const conceptCounts: Record<string, number> = {};
  (counts || []).forEach(r => {
    conceptCounts[r.project_id] = (conceptCounts[r.project_id] || 0) + 1;
  });

  const result = (data || []).map(p => ({
    ...p,
    concept_count: conceptCounts[p.id] || 0,
  }));

  return c.json(result);
});

// DELETE /api/projects/:id - Delete a project and all its data
app.delete('/projects/:id', async (c) => {
  const projectId = c.req.param('id');
  const userId = c.req.query('userId');
  if (!userId) return c.json({ error: 'Missing userId' }, 400);

  // Verify ownership
  const { data: project } = await supabase
    .from('projects')
    .select('id, user_id')
    .eq('id', projectId)
    .single();

  if (!project || project.user_id !== userId) {
    return c.json({ error: 'Not found or not authorized' }, 404);
  }

  // Delete cascading data (order matters for FK constraints)
  await Promise.all([
    supabase.from('quiz_state').delete().eq('project_id', projectId),
    supabase.from('quiz_questions').delete().eq('project_id', projectId),
    supabase.from('chat_messages').delete().eq('project_id', projectId),
    supabase.from('code_chunks').delete().eq('project_id', projectId),
    supabase.from('concept_universal_map').delete().eq('project_id', projectId),
    supabase.from('user_concept_progress').delete().eq('project_id', projectId),
    supabase.from('sub_concepts').delete().eq('project_id', projectId),
    supabase.from('sub_concept_edges').delete().eq('project_id', projectId),
  ]);
  await Promise.all([
    supabase.from('concept_edges').delete().eq('project_id', projectId),
    supabase.from('insights').delete().eq('project_id', projectId),
    supabase.from('user_state').delete().eq('project_id', projectId),
  ]);
  await supabase.from('files').delete().eq('project_id', projectId);
  await supabase.from('concepts').delete().eq('project_id', projectId);
  await supabase.from('projects').delete().eq('id', projectId);

  return c.json({ success: true });
});

// POST /api/pipeline/start - Kick off ingestion pipeline
app.post('/start', async (c) => {
  const body = await c.req.json();
  const { fileTree, fileContents, importEdges, projectName, userId } = body;

  // Check for cached project with same content
  const contentHash = computeContentHash(fileContents || {});
  const cachedId = await findCachedProject(contentHash);

  if (cachedId) {
    console.log(`Cache hit for content hash ${contentHash}, returning project ${cachedId}`);
    // Associate cached project with current user if not already owned
    if (userId) {
      await supabase
        .from('projects')
        .update({ user_id: userId })
        .eq('id', cachedId)
        .is('user_id', null);
    }
    return c.json({ projectId: cachedId, cached: true });
  }

  // Create project row
  const insertData: Record<string, unknown> = {
    name: projectName || 'Untitled Project',
    pipeline_status: 'pending',
    file_count: Object.keys(fileContents || {}).length,
    content_hash: contentHash,
  };
  if (userId) insertData.user_id = userId;

  const { data: project, error } = await supabase
    .from('projects')
    .insert(insertData)
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

  return c.json({ projectId: project.id, cached: false });
});

// POST /api/pipeline/:id/cancel - Cancel a running pipeline
app.post('/:id/cancel', async (c) => {
  const projectId = c.req.param('id');
  const { data: project } = await supabase
    .from('projects')
    .select('pipeline_status')
    .eq('id', projectId)
    .single();

  if (!project) return c.json({ error: 'Project not found' }, 404);

  const terminal = ['complete', 'failed', 'cancelled', 'enriched'];
  if (terminal.includes(project.pipeline_status)) {
    return c.json({ status: project.pipeline_status, message: 'Pipeline already finished' });
  }

  await supabase
    .from('projects')
    .update({
      pipeline_status: 'cancelled',
      pipeline_progress: { message: 'Cancelled by user' },
    })
    .eq('id', projectId);

  return c.json({ status: 'cancelled' });
});

// GET /api/pipeline/:id/stream - SSE stream of pipeline progress
app.get('/:id/stream', async (c) => {
  const projectId = c.req.param('id');
  const STALE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

  return streamSSE(c, async (stream) => {
    let lastStatus = '';
    let complete = false;
    let ticks = 0;

    while (!complete) {
      const { data: project } = await supabase
        .from('projects')
        .select('pipeline_status, pipeline_progress')
        .eq('id', projectId)
        .single();

      if (project) {
        // Detect stale/orphaned pipelines
        const isActive = !['complete', 'failed', 'cancelled', 'enriched', 'pending'].includes(project.pipeline_status);
        if (isActive && project.pipeline_progress?.updated_at) {
          const lastUpdate = new Date(project.pipeline_progress.updated_at).getTime();
          const elapsed = Date.now() - lastUpdate;
          if (elapsed > STALE_THRESHOLD_MS) {
            await supabase
              .from('projects')
              .update({
                pipeline_status: 'failed',
                pipeline_progress: { stage: 0, total_stages: 7, message: 'Pipeline timed out — please retry' },
              })
              .eq('id', projectId);
            project.pipeline_status = 'failed';
            project.pipeline_progress = { stage: 0, total_stages: 7, message: 'Pipeline timed out — please retry' };
          }
        }

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

        if (['complete', 'failed', 'cancelled'].includes(project.pipeline_status)) {
          complete = true;
        }
      }

      if (!complete) {
        // Heartbeat every ~15s so proxies (Render/Cloudflare) don't kill the
        // connection during long silent phases, and so backgrounded browser
        // tabs see traffic and keep the EventSource alive.
        ticks++;
        if (ticks % 15 === 0) {
          await stream.writeSSE({ data: '', event: 'ping' });
        }
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
  });
});

// GET /api/pipeline/:id/status - Lightweight status check (used by enrichment poller)
app.get('/:id/status', async (c) => {
  const projectId = c.req.param('id');
  const { data } = await supabase
    .from('projects')
    .select('pipeline_status')
    .eq('id', projectId)
    .single();
  return c.json({ status: data?.pipeline_status || 'unknown' });
});

// GET /api/pipeline/:id/data - Get all project data (concepts, edges, files, insights)
app.get('/:id/data', async (c) => {
  const projectId = c.req.param('id');

  // Check project visibility
  const { data: projectMeta } = await supabase
    .from('projects')
    .select('visibility, user_id')
    .eq('id', projectId)
    .single();

  if (!projectMeta) {
    return c.json({ error: 'Project not found' }, 404);
  }

  // Private projects require the owner's auth
  if (projectMeta.visibility === 'private') {
    const authHeader = c.req.header('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return c.json({ error: 'Authentication required' }, 401);
    }
    try {
      const { data } = await supabase.auth.getUser(authHeader.slice(7));
      if (!data?.user || data.user.id !== projectMeta.user_id) {
        return c.json({ error: 'Access denied' }, 403);
      }
    } catch {
      return c.json({ error: 'Invalid token' }, 401);
    }
  }

  const [projectRes, conceptsRes, edgesRes, filesRes, insightsRes, userStateRes, quizStateRes, chatRes, subConceptsRes, subEdgesRes] = await Promise.all([
    supabase.from('projects').select('*').eq('id', projectId).single(),
    supabase.from('concepts').select('*').eq('project_id', projectId),
    supabase.from('concept_edges').select('*').eq('project_id', projectId),
    supabase.from('files').select('id, project_id, path, name, concept_id, role, importance_score, analysis').eq('project_id', projectId),
    supabase.from('insights').select('*').eq('project_id', projectId).order('priority', { ascending: false }),
    supabase.from('user_state').select('*').eq('project_id', projectId).single(),
    supabase.from('quiz_state').select('concept_key, streak, total_attempts, total_correct, next_review_position').eq('project_id', projectId),
    supabase.from('chat_messages').select('role, content, context, source, session_id, created_at, user_id').eq('project_id', projectId).order('created_at', { ascending: true }).limit(50),
    supabase.from('sub_concepts').select('*').eq('project_id', projectId),
    supabase.from('sub_concept_edges').select('*').eq('project_id', projectId),
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
    quizState: quizStateRes.data || [],
    chatMessages: chatRes.data || [],
    sub_concepts: subConceptsRes.data || [],
    sub_concept_edges: subEdgesRes.data || [],
  });
});

// GET /api/pipeline/:id/sub-concepts/:conceptKey - Get pre-generated sub-concepts
app.get('/:id/sub-concepts/:conceptKey', async (c) => {
  const projectId = c.req.param('id');
  const conceptKey = c.req.param('conceptKey');

  const [subConceptsRes, subEdgesRes] = await Promise.all([
    supabase
      .from('sub_concepts')
      .select('*')
      .eq('project_id', projectId)
      .eq('parent_concept_key', conceptKey),
    supabase
      .from('sub_concept_edges')
      .select('*')
      .eq('project_id', projectId)
      .eq('parent_concept_key', conceptKey),
  ]);

  const subConcepts = (subConceptsRes.data || []).map(sc => ({
    id: sc.sub_concept_key,
    name: sc.name,
    one_liner: sc.one_liner,
    color: sc.color,
    importance: sc.importance,
    file_ids: sc.file_ids || [],
  }));

  const subEdges = (subEdgesRes.data || []).map(se => ({
    source: se.source_sub_key,
    target: se.target_sub_key,
    label: se.label,
  }));

  return c.json({
    ready: subConcepts.length > 0,
    sub_concepts: subConcepts,
    sub_edges: subEdges,
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
