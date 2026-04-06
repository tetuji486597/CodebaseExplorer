import { Hono } from 'hono';
import { supabase } from '../db/supabase.js';

const app = new Hono();

// GET /api/skill-profile - Get user's skill profile (all universal concepts + progress)
app.get('/', async (c) => {
  const userId = c.req.query('userId') || 'anonymous';

  // Get all universal concepts
  const { data: concepts } = await supabase
    .from('universal_concepts')
    .select('*')
    .order('difficulty_order', { ascending: true });

  // Get user progress
  const { data: progress } = await supabase
    .from('user_concept_progress')
    .select('concept_id, confidence, encounters, last_encountered_at, evidence')
    .eq('user_id', userId);

  const progressMap = new Map((progress || []).map((p: any) => [p.concept_id, p]));

  // Merge concepts with progress
  const profile = (concepts || []).map((concept: any) => {
    const p = progressMap.get(concept.id);
    return {
      ...concept,
      confidence: p?.confidence || 0,
      encounters: p?.encounters || 0,
      last_encountered_at: p?.last_encountered_at || null,
      evidence: p?.evidence || [],
    };
  });

  // Get exploration timeline (projects explored by this user)
  const { data: projects } = await supabase
    .from('projects')
    .select('id, name, created_at, curated_codebase_id')
    .order('created_at', { ascending: false })
    .limit(20);

  // Count concepts encountered per project
  const timeline = (projects || []).map((p: any) => ({
    id: p.id,
    name: p.name,
    created_at: p.created_at,
    is_curated: !!p.curated_codebase_id,
  }));

  return c.json({ concepts: profile, timeline });
});

// POST /api/skill-profile/engage - Record concept engagement
app.post('/engage', async (c) => {
  const { userId = 'anonymous', projectId, conceptKey, curatedCodebaseId, engagementType } = await c.req.json();

  // Find universal concepts mapped to this concept key
  const query = supabase
    .from('concept_universal_map')
    .select('universal_concept_id');

  if (curatedCodebaseId) {
    query.eq('curated_codebase_id', curatedCodebaseId);
  } else if (projectId) {
    query.eq('project_id', projectId);
  }
  query.eq('concept_key', conceptKey);

  const { data: mappings } = await query;

  if (!mappings || mappings.length === 0) return c.json({ ok: true, updated: 0 });

  // Confidence increment based on engagement type
  const increments: Record<string, number> = {
    click: 0.05,
    read_explanation: 0.1,
    time_spent: 0.08,
    chat_about: 0.12,
  };
  const increment = increments[engagementType] || 0.05;

  let updated = 0;
  for (const mapping of mappings) {
    const { data: existing } = await supabase
      .from('user_concept_progress')
      .select('id, confidence, encounters, evidence')
      .eq('user_id', userId)
      .eq('concept_id', mapping.universal_concept_id)
      .single();

    const newEvidence = {
      project_id: projectId || null,
      curated_codebase_id: curatedCodebaseId || null,
      concept_key: conceptKey,
      type: engagementType,
      at: new Date().toISOString(),
    };

    if (existing) {
      const newConfidence = Math.min(1, (existing.confidence || 0) + increment);
      const evidence = [...(existing.evidence || []), newEvidence].slice(-20); // Keep last 20
      await supabase
        .from('user_concept_progress')
        .update({
          confidence: newConfidence,
          encounters: (existing.encounters || 0) + 1,
          last_encountered_at: new Date().toISOString(),
          evidence,
        })
        .eq('id', existing.id);
    } else {
      await supabase
        .from('user_concept_progress')
        .insert({
          user_id: userId,
          concept_id: mapping.universal_concept_id,
          confidence: increment,
          encounters: 1,
          last_encountered_at: new Date().toISOString(),
          evidence: [newEvidence],
        });
    }
    updated++;
  }

  return c.json({ ok: true, updated });
});

// GET /api/skill-profile/confidence - Get confidence for specific universal concepts
app.get('/confidence', async (c) => {
  const userId = c.req.query('userId') || 'anonymous';
  const conceptIds = c.req.query('conceptIds')?.split(',') || [];

  if (conceptIds.length === 0) {
    // Return all
    const { data } = await supabase
      .from('user_concept_progress')
      .select('concept_id, confidence')
      .eq('user_id', userId);

    const map: Record<string, number> = {};
    (data || []).forEach((p: any) => { map[p.concept_id] = p.confidence; });
    return c.json(map);
  }

  const { data } = await supabase
    .from('user_concept_progress')
    .select('concept_id, confidence')
    .eq('user_id', userId)
    .in('concept_id', conceptIds);

  const map: Record<string, number> = {};
  (data || []).forEach((p: any) => { map[p.concept_id] = p.confidence; });
  return c.json(map);
});

export default app;
