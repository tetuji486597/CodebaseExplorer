import useStore from '../store/useStore';
import { API_BASE } from './api';
import { supabase } from './supabase';
import { buildTourPath } from './tourPath';

function loadQuizStats(quizState) {
  if (!quizState?.length) return;
  const store = useStore.getState();
  const stats = {};
  quizState.forEach(qs => {
    stats[qs.concept_key] = {
      streak: qs.streak,
      mastered: qs.streak >= 3,
      totalAttempts: qs.total_attempts,
      totalCorrect: qs.total_correct,
    };
  });
  store.setQuizStats(stats);
}

async function initQuizState(projectId, explorationPath, currentPosition) {
  if (!projectId || !explorationPath?.length) return;
  try {
    const body = { explorationPath };
    if (typeof currentPosition === 'number') {
      body.currentPosition = currentPosition;
    }
    await fetch(`${API_BASE}/api/quiz/${projectId}/init`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (err) {
    console.error('Failed to init quiz state:', err);
  }
}

function applySubConcepts(store, subConcepts, subConceptEdges) {
  const grouped = {};
  subConcepts.forEach(sc => {
    if (!grouped[sc.parent_concept_key]) grouped[sc.parent_concept_key] = [];
    grouped[sc.parent_concept_key].push({
      id: sc.sub_concept_key, name: sc.name, one_liner: sc.one_liner,
      color: sc.color, importance: sc.importance, file_ids: sc.file_ids || [],
      has_further_depth: sc.has_further_depth !== false,
      display_order: sc.display_order ?? 0,
    });
  });
  const edgesByParent = {};
  (subConceptEdges || []).forEach(se => {
    if (!edgesByParent[se.parent_concept_key]) edgesByParent[se.parent_concept_key] = [];
    edgesByParent[se.parent_concept_key].push({
      source: se.source_sub_key, target: se.target_sub_key, label: se.label,
    });
  });
  const cache = {};
  for (const key of Object.keys(grouped)) {
    cache[key] = { subConcepts: grouped[key], subEdges: edgesByParent[key] || [], ready: true };
  }
  store.setSubConceptsCache(cache);
  store.setSubConceptsReadyKeys(Object.keys(grouped));
}

function pollForSubConcepts(store, projectId) {
  let attempts = 0;
  const maxAttempts = 10;
  const interval = setInterval(async () => {
    attempts++;
    if (attempts > maxAttempts) {
      clearInterval(interval);
      return;
    }
    try {
      const concepts = store.concepts || useStore.getState().concepts;
      if (!concepts.length) return;
      const firstKey = concepts[0].id;
      const res = await fetch(`${API_BASE}/api/pipeline/${projectId}/sub-concepts/${firstKey}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.ready && data.sub_concepts?.length) {
        clearInterval(interval);
        // Sub-concepts are ready — refetch full project data for all of them
        const fullRes = await fetch(`${API_BASE}/api/pipeline/${projectId}/data`);
        if (fullRes.ok) {
          const fullData = await fullRes.json();
          if (fullData.sub_concepts?.length) {
            applySubConcepts(store, fullData.sub_concepts, fullData.sub_concept_edges);
            // Rebuild tour path now that sub-concepts are available
            const { explorationPath, concepts: storeConcepts } = useStore.getState();
            if (explorationPath?.length) {
              const cache = useStore.getState().subConceptsCache;
              const tp = buildTourPath(explorationPath, cache, storeConcepts);
              if (tp) store.setTourPath(tp);
            }
          }
        }
      }
    } catch {}
  }, 3000);
}

/**
 * Fetch project data from the API, transform it into store format, and load it.
 * Returns the transformed concepts array (for callers that need it), or null on failure.
 */
export async function fetchAndLoadProject(projectId) {
  try {
    const headers = {};
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    }

    const res = await fetch(`${API_BASE}/api/pipeline/${projectId}/data`, { headers });
    if (!res.ok) return null;
    const data = await res.json();
    return loadProjectData(data, projectId);
  } catch (err) {
    console.error('Failed to load project data:', err);
    return null;
  }
}

/**
 * Transform raw Supabase data and load it into the Zustand store.
 * Does NOT navigate — callers handle navigation themselves.
 */
export function loadProjectData(data, projectId) {
  const store = useStore.getState();

  // Clean slate before loading — prevents stale state from a previous project
  store.resetProject();

  const concepts = (data.concepts || []).map(c => {
    const key = c.id || c.concept_key;
    return {
      id: key,
      name: c.name,
      color: c.color,
      description: c.explanation,
      metaphor: c.metaphor,
      one_liner: c.one_liner,
      deep_explanation: c.deep_explanation,
      beginner_explanation: c.beginner_explanation,
      intermediate_explanation: c.intermediate_explanation,
      advanced_explanation: c.advanced_explanation,
      importance: c.importance,
      fileIds: (data.files || []).filter(f => f.concept_id === key).map(f => f.path),
      fileCount: (data.files || []).filter(f => f.concept_id === key).length,
    };
  });

  const files = (data.files || []).map(f => ({
    id: f.path,
    name: f.name,
    conceptId: f.concept_id,
    description: f.analysis?.purpose || '',
    exports: (f.analysis?.key_exports || []).map(e => ({
      name: e.name,
      whatItDoes: e.what_it_does || '',
    })),
    codeSnippet: '',
    role: f.role,
  }));

  const conceptEdges = (data.edges || []).map(e => ({
    source: e.source_concept_key,
    target: e.target_concept_key,
    label: e.relationship,
    strength: e.strength,
    explanation: e.explanation,
  }));

  if (data.insights) {
    store.setInsights(data.insights);
  }
  if (data.userState) {
    store.setUserState(data.userState);

    const path = data.userState.exploration_path;
    if (path?.length) {
      const conceptIds = new Set(concepts.map(c => c.id));
      const validPath = path.filter(key => conceptIds.has(key));
      if (validPath.length) {
        store.setExplorationPath(validPath);
        store.setGuidedMode(true);
        store.setGuidedPosition(0);
        store.setTourPosition(0);
        store.setSelectedNode({ type: 'concept', id: validPath[0] });
        store.dismissOnboarding();

        // Build tour path if sub-concepts are already available
        if (data.sub_concepts?.length) {
          const tempCache = {};
          data.sub_concepts.forEach(sc => {
            if (!tempCache[sc.parent_concept_key]) tempCache[sc.parent_concept_key] = { subConcepts: [], subEdges: [], ready: true };
            tempCache[sc.parent_concept_key].subConcepts.push({
              id: sc.sub_concept_key, name: sc.name, one_liner: sc.one_liner,
              color: sc.color, importance: sc.importance, file_ids: sc.file_ids || [],
              has_further_depth: sc.has_further_depth !== false, display_order: sc.display_order ?? 0,
            });
          });
          const tourPath = buildTourPath(validPath, tempCache, concepts);
          if (tourPath) store.setTourPath(tourPath);
        }

        initQuizState(projectId, validPath);
      }
    }
  }

  // Load quiz stats if available
  if (data.quizState) {
    loadQuizStats(data.quizState);
  }

  store.setProjectId(projectId);
  if (data.project) {
    store.setProjectMeta(data.project);
  }
  if (data.sub_concepts?.length) {
    applySubConcepts(store, data.sub_concepts, data.sub_concept_edges);
  } else if (data.project?.pipeline_status === 'complete' || data.project?.pipeline_status === 'enriched') {
    pollForSubConcepts(store, projectId);
  }

  // Synthesize __universe__ on the frontend if the backend hasn't created one
  const hasUniverse = concepts.some(c => c.id === '__universe__');
  if (!hasUniverse) {
    const nonUniverseConcepts = concepts.filter(c => c.id !== '__universe__');
    concepts.unshift({
      id: '__universe__',
      name: data.project?.name || 'Codebase',
      color: 'blue',
      description: data.project?.summary || '',
      one_liner: data.project?.summary?.split('.')[0] || 'Project overview',
      importance: 'critical',
      fileIds: [],
      fileCount: 0,
      _isUniverse: true,
    });
    // Pre-populate subConceptsCache for __universe__ with root concepts as children
    const universeCache = { ...(useStore.getState().subConceptsCache || {}) };
    universeCache['__universe__'] = {
      subConcepts: nonUniverseConcepts.map(c => ({
        id: c.id, name: c.name, one_liner: c.one_liner, color: c.color,
        importance: c.importance, file_ids: c.fileIds || [],
        has_further_depth: true,
      })),
      subEdges: conceptEdges.filter(e => e.label !== 'contains').map(e => ({
        source: e.source, target: e.target, label: e.label,
      })),
      ready: true,
    };
    store.setSubConceptsCache(universeCache);
  } else {
    // Backend created __universe__ — populate its cache with root concepts
    const rootConcepts = concepts.filter(c => c.id !== '__universe__');
    const universeCache = { ...(useStore.getState().subConceptsCache || {}) };
    if (!universeCache['__universe__']) {
      universeCache['__universe__'] = {
        subConcepts: rootConcepts.map(c => ({
          id: c.id, name: c.name, one_liner: c.one_liner, color: c.color,
          importance: c.importance, file_ids: c.fileIds || [],
          has_further_depth: true,
        })),
        subEdges: [],
        ready: true,
      };
      store.setSubConceptsCache(universeCache);
    }
  }

  store.loadData({ concepts, files, conceptEdges, fileImports: [] });

  // Load chat history if available (cross-platform continuity)
  if (data.chatMessages?.length) {
    const mapped = data.chatMessages.map(msg => ({
      role: msg.role,
      content: msg.content,
      source: msg.source || msg.context?.source,
      session_id: msg.session_id,
    }));
    store.setChatMessages(mapped);

    // Reuse most recent session if it's less than 30 min old
    const lastMsg = data.chatMessages[data.chatMessages.length - 1];
    if (lastMsg?.session_id) {
      const gap = Date.now() - new Date(lastMsg.created_at).getTime();
      if (gap < 30 * 60 * 1000) {
        store.setChatSessionId(lastMsg.session_id);
      }
    }
  }

  // Persist so ExplorerView can restore on refresh
  localStorage.setItem('cbe_project_id', projectId);

  return concepts;
}
