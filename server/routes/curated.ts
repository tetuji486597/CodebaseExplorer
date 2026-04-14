import { Hono } from 'hono';
import { supabase } from '../db/supabase.js';
import { runQuizGeneration } from '../pipeline/quizGeneration.js';

const app = new Hono();

function buildSynthesisFromGraph(graph: any, fallbackDescription: string) {
  return {
    concepts: (graph.concepts || []).map((c: any) => ({
      id: c.id,
      name: c.name,
      color: c.color || 'gray',
      metaphor: c.metaphor || '',
      one_liner: c.one_liner || '',
      explanation: c.explanation || '',
      deep_explanation: c.deep_explanation || '',
      file_ids: c.file_ids || [],
      importance: c.importance || 'normal',
    })),
    edges: (graph.edges || []).map((e: any) => ({
      source: e.source,
      target: e.target,
      relationship: e.relationship || '',
      strength: e.strength || 'moderate',
    })),
    suggested_starting_concept: graph.suggested_starting_concept || '',
    codebase_summary: graph.codebase_summary || fallbackDescription || '',
  };
}

// GET /api/curated - List all curated codebases
app.get('/', async (c) => {
  const { data, error } = await supabase
    .from('curated_codebases')
    .select('id, name, description, difficulty, primary_concepts, github_url, app_preview')
    .order('difficulty', { ascending: true });

  if (error) return c.json({ error: error.message }, 500);

  // Return a has_preview flag instead of the full preview data (lighter payload)
  const result = (data || []).map(({ app_preview, ...rest }) => ({
    ...rest,
    has_preview: !!app_preview,
  }));
  return c.json(result);
});

// GET /api/curated/:id/preview - Get preview data for a curated codebase
app.get('/:id/preview', async (c) => {
  const id = c.req.param('id');

  const { data, error } = await supabase
    .from('curated_codebases')
    .select('app_preview')
    .eq('id', id)
    .single();

  if (error || !data?.app_preview) {
    return c.json({ error: 'No preview available' }, 404);
  }

  return c.json(data.app_preview);
});

// GET /api/curated/:id - Get full curated codebase with concept graph
app.get('/:id', async (c) => {
  const id = c.req.param('id');

  const { data: codebase, error } = await supabase
    .from('curated_codebases')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !codebase) return c.json({ error: 'Not found' }, 404);

  // Get universal concept mappings for this codebase
  const { data: mappings } = await supabase
    .from('concept_universal_map')
    .select('concept_key, universal_concept_id, universal_concepts(id, name, category)')
    .eq('curated_codebase_id', id);

  return c.json({ ...codebase, universal_mappings: mappings || [] });
});

// POST /api/curated/:id/load - Load a curated codebase into the explorer (creates a project record)
app.post('/:id/load', async (c) => {
  const id = c.req.param('id');

  const { data: codebase, error: cbError } = await supabase
    .from('curated_codebases')
    .select('*')
    .eq('id', id)
    .single();

  if (cbError || !codebase) return c.json({ error: 'Not found' }, 404);

  // Check if a project already exists for this curated codebase
  const { data: existing } = await supabase
    .from('projects')
    .select('id')
    .eq('curated_codebase_id', id)
    .eq('pipeline_status', 'complete')
    .limit(1)
    .single();

  if (existing) {
    // Check if quiz questions exist; if not, generate them in the background.
    // This handles curated projects created before quiz generation was added.
    const { count } = await supabase
      .from('quiz_questions')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', existing.id);

    if (!count) {
      const graph = codebase.concept_graph as any;
      const synthesis = buildSynthesisFromGraph(graph, codebase.description);
      runQuizGeneration(existing.id, synthesis, []).catch((err) => {
        console.error('Background quiz generation failed for existing curated project:', err);
      });
    }

    return c.json({ projectId: existing.id });
  }

  const graph = codebase.concept_graph as any;

  // Create a project for this curated codebase
  const { data: project, error: projError } = await supabase
    .from('projects')
    .insert({
      name: codebase.name,
      framework: codebase.name,
      language: 'JavaScript/TypeScript',
      file_count: 0,
      summary: graph.codebase_summary || codebase.description,
      pipeline_status: 'complete',
      pipeline_progress: { stage: 7, total_stages: 7, message: 'Curated codebase loaded' },
      curated_codebase_id: id,
    })
    .select()
    .single();

  if (projError || !project) {
    return c.json({ error: 'Failed to create project' }, 500);
  }

  // Insert concepts from the concept graph
  const concepts = (graph.concepts || []).map((concept: any) => ({
    project_id: project.id,
    concept_key: concept.id,
    name: concept.name,
    color: concept.color,
    metaphor: concept.metaphor,
    one_liner: concept.one_liner,
    explanation: concept.explanation,
    deep_explanation: concept.deep_explanation,
    beginner_explanation: concept.beginner_explanation,
    intermediate_explanation: concept.intermediate_explanation,
    advanced_explanation: concept.advanced_explanation,
    importance: concept.importance,
  }));

  if (concepts.length > 0) {
    await supabase.from('concepts').insert(concepts);
  }

  // Insert edges
  const edges = (graph.edges || []).map((edge: any) => ({
    project_id: project.id,
    source_concept_key: edge.source,
    target_concept_key: edge.target,
    relationship: edge.relationship,
    strength: edge.strength,
  }));

  if (edges.length > 0) {
    await supabase.from('concept_edges').insert(edges);
  }

  // Create user state
  const explorationPath = graph.concepts
    ? graph.concepts.map((c: any) => c.id)
    : [];

  await supabase.from('user_state').insert({
    project_id: project.id,
    explored_concepts: [],
    explored_files: [],
    time_per_concept: {},
    exploration_path: explorationPath,
  });

  // Fire-and-forget: generate quiz questions in the background.
  // Curated projects skip the pipeline, so we synthesize the input from concept_graph.
  const synthesis = buildSynthesisFromGraph(graph, codebase.description);

  runQuizGeneration(project.id, synthesis, []).catch((err) => {
    console.error('Background quiz generation failed for curated project:', err);
  });

  return c.json({ projectId: project.id });
});

export default app;
