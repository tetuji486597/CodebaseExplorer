import useStore from '../store/useStore';
import { API_BASE } from './api';

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

/**
 * Fetch project data from the API, transform it into store format, and load it.
 * Returns the transformed concepts array (for callers that need it), or null on failure.
 */
export async function fetchAndLoadProject(projectId) {
  try {
    const res = await fetch(`${API_BASE}/api/pipeline/${projectId}/data`);
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

  const concepts = (data.concepts || []).map(c => ({
    id: c.concept_key,
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
    fileIds: (data.files || []).filter(f => f.concept_id === c.concept_key).map(f => f.path),
  }));

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
        store.setSelectedNode({ type: 'concept', id: validPath[0] });
        store.dismissOnboarding();

        // Initialize quiz state for the exploration path (fire-and-forget)
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
  store.loadData({ concepts, files, conceptEdges, fileImports: [] });

  // Persist so ExplorerView can restore on refresh
  localStorage.setItem('cbe_project_id', projectId);

  return concepts;
}
