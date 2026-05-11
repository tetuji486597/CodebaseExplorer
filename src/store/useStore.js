import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { API_BASE } from '../lib/api';

function navigateDrillToStop(targetStop, getState) {
  const state = getState();
  if (targetStop.type === 'chapter_intro') {
    if (state.focusStack.length > 1) {
      // Drill all the way out to universe
      while (getState().focusStack.length > 1) {
        getState().drillOut();
      }
    } else if (!state.childrenRevealed) {
      getState().revealChildren();
    }
  } else if (targetStop.type === 'section') {
    const parentKey = targetStop.conceptKey;
    const cur = getState();
    if (cur.focusNodeId !== parentKey) {
      // If we're inside a different parent, drill out first
      if (cur.focusStack.length > 1) {
        while (getState().focusStack.length > 1) {
          getState().drillOut();
        }
      }
      // Ensure children are revealed at universe level
      if (!getState().childrenRevealed) {
        getState().revealChildren();
      }
      // Drill into the target parent
      getState().drillInto(parentKey);
    }
  }
}

const useStore = create((set, get) => ({
  // Auth state
  user: null,
  session: null,
  authLoading: true,
  setUser: (user) => set({ user }),
  setSession: (session) => set({ session }),
  setAuthLoading: (loading) => set({ authLoading: loading }),
  signOut: async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('cbe_github_token');
    set({ user: null, session: null });
  },
  getGithubToken: () => {
    const session = get().session;
    return session?.provider_token || localStorage.getItem('cbe_github_token');
  },

  // Cached project list for "My Projects" panel
  cachedProjects: null,
  cachedProjectsAt: 0,
  setCachedProjects: (projects) => set({ cachedProjects: projects, cachedProjectsAt: Date.now() }),

  // View mode
  viewMode: 'concepts', // 'concepts' | 'files'
  setViewMode: (viewMode) => set({ viewMode }),

  // Files panel
  filesPanelOpen: false,
  toggleFilesPanel: () => set(s => ({ filesPanelOpen: !s.filesPanelOpen })),
  setFilesPanelOpen: (open) => set({ filesPanelOpen: open }),
  fileSearchQuery: '',
  setFileSearchQuery: (q) => set({ fileSearchQuery: q }),

  // Data
  concepts: [],
  files: [],
  conceptEdges: [],
  fileImports: [],
  setConcepts: (concepts) => set({ concepts }),
  setFiles: (files) => set({ files }),
  setConceptEdges: (conceptEdges) => set({ conceptEdges }),
  setFileImports: (fileImports) => set({ fileImports }),

  // Project metadata (name, summary, framework, language, file_count)
  projectMeta: null,
  setProjectMeta: (meta) => set({ projectMeta: meta }),

  // Load all data at once
  loadData: ({ concepts, files, conceptEdges, fileImports }) => set({
    concepts,
    files,
    conceptEdges,
    fileImports,
  }),

  // Selection
  selectedNode: null, // { type: 'concept' | 'file', id: string }
  setSelectedNode: (selectedNode) => set({ selectedNode }),
  clearSelection: () => set({ selectedNode: null }),

  // Inspector/Detail panel
  showInspector: false,
  setShowInspector: (show) => set({ showInspector: show }),

  // Code walkthrough panel
  showCodePanel: false,
  codePanelFileId: null,
  openCodePanel: (fileId) => set({ showCodePanel: true, codePanelFileId: fileId }),
  closeCodePanel: () => set({ showCodePanel: false, codePanelFileId: null }),

  // Chat
  chatMessages: [],
  chatLoading: false,
  chatPanelOpen: false,
  commandPaletteOpen: false,
  chatStreamingText: '',
  chatSessionId: null,
  addChatMessage: (message) => set(state => ({
    chatMessages: [...state.chatMessages, message]
  })),
  setChatMessages: (messages) => set({ chatMessages: messages }),
  setChatLoading: (loading) => set({ chatLoading: loading }),
  setChatPanelOpen: (open) => set({ chatPanelOpen: open }),
  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
  setChatStreamingText: (text) => set({ chatStreamingText: text }),
  setChatSessionId: (id) => set({ chatSessionId: id }),
  pendingQuote: null,
  setPendingQuote: (text) => set({ pendingQuote: text }),
  clearChat: () => set({
    chatMessages: [],
    chatLoading: false,
    chatStreamingText: '',
    chatSessionId: null,
    pendingQuote: null,
  }),

  // Processing status
  processingStatus: '',
  setProcessingStatus: (status) => set({ processingStatus: status }),
  processingError: null,
  setProcessingError: (err) => set({ processingError: err }),

  // Onboarding
  showOnboarding: true,
  dismissOnboarding: () => set({ showOnboarding: false }),

  // Upload feature flag
  uploadEnabled: true,

  // Dark mode (default false — warm light theme)
  darkMode: (() => {
    if (typeof window === 'undefined') return false;
    const saved = window.localStorage?.getItem('cbe_theme');
    if (saved === 'dark') return true;
    if (saved === 'light') return false;
    return false;
  })(),
  toggleDarkMode: () => set(state => {
    const next = !state.darkMode;
    try { window.localStorage?.setItem('cbe_theme', next ? 'dark' : 'light'); } catch {}
    return { darkMode: next };
  }),

  // Persona (pivot 1: 'oss' | 'onboarding' | 'dd_legacy' | null)
  persona: (() => {
    if (typeof window === 'undefined') return null;
    try { return window.localStorage?.getItem('cbe_persona') || null; } catch { return null; }
  })(),
  setPersona: (persona) => {
    try { window.localStorage?.setItem('cbe_persona', persona || ''); } catch {}
    set({ persona });
  },

  // Shared depth level across Inspector + GuidedOverlay
  // ('beginner' | 'intermediate' | 'advanced')
  activeDepthLevel: (() => {
    if (typeof window === 'undefined') return 'beginner';
    try { return window.localStorage?.getItem('cbe_depth_level') || 'beginner'; } catch { return 'beginner'; }
  })(),
  setActiveDepthLevel: (level) => {
    try { window.localStorage?.setItem('cbe_depth_level', level); } catch {}
    set({ activeDepthLevel: level });
  },

  // Graph layout positions (managed by d3-force, stored here for persistence)
  nodePositions: {},
  setNodePositions: (positions) => set({ nodePositions: positions }),

  // Pipeline state
  projectId: null,
  setProjectId: (id) => set({ projectId: id }),
  pipelineStatus: null, // null | 'pending' | 'processing' | 'stage_N' | 'complete' | 'failed' | 'cancelled'
  pipelineProgress: null, // { stage, total_stages, message }
  setPipelineStatus: (status) => set({ pipelineStatus: status }),
  setPipelineProgress: (progress) => set({ pipelineProgress: progress }),

  // SSE cleanup (set by usePipelineListener)
  _sseCleanup: null,
  setSseCleanup: (fn) => set({ _sseCleanup: fn }),

  // Cancel an in-progress pipeline
  cancelPipeline: async () => {
    const { projectId, _sseCleanup } = get();
    if (_sseCleanup) _sseCleanup();
    if (projectId) {
      try {
        await fetch(`${API_BASE}/api/pipeline/${projectId}/cancel`, { method: 'POST' });
      } catch (e) { console.error('Cancel failed:', e); }
    }
    localStorage.removeItem('cbe_active_project');
    get().resetProject();
  },

  // Re-run pipeline on current project using stored files
  rerunPipeline: async () => {
    const { projectId, user } = get();
    if (!projectId) return false;
    set({
      processingError: null,
      processingStatus: 'Preparing to re-analyze...',
      pipelineStatus: 'pending',
      pipelineProgress: null,
      concepts: [],
      files: [],
      conceptEdges: [],
      insights: [],
    });
    try {
      const res = await fetch(`${API_BASE}/api/pipeline/${projectId}/rerun`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user?.id }),
      });
      if (!res.ok) {
        const err = await res.json();
        set({ processingError: { message: err.error || 'Rerun failed' }, pipelineStatus: 'failed' });
        return false;
      }
      localStorage.setItem('cbe_active_project', projectId);
      return true;
    } catch (err) {
      set({ processingError: { message: err.message || 'Network error' }, pipelineStatus: 'failed' });
      return false;
    }
  },

  insightCard: null,
  setInsightCard: (card) => set({ insightCard: card }),
  explorationProgress: 0,
  setExplorationProgress: (progress) => set({ explorationProgress: progress }),

  // Explored concepts tracking (local)
  exploredConcepts: new Set(),
  markConceptExplored: (id) => set(state => {
    const next = new Set(state.exploredConcepts);
    next.add(id);
    return { exploredConcepts: next };
  }),

  // Toast notifications
  toast: null,
  showToast: (message, duration = 2000) => {
    set({ toast: message });
    setTimeout(() => set({ toast: null }), duration);
  },

  // Guided tour mode
  guidedMode: false,
  guidedPosition: 0,
  explorationPath: [],
  tourPath: null,
  tourPosition: 0,
  setGuidedMode: (active) => set({ guidedMode: active }),
  setGuidedPosition: (pos) => set({ guidedPosition: pos }),
  setExplorationPath: (path) => set({ explorationPath: path }),
  setTourPath: (path) => set({ tourPath: path }),
  setTourPosition: (pos) => set({ tourPosition: pos }),
  advanceGuided: () => {
    const state = get();
    const { tourPath, tourPosition, markConceptExplored } = state;
    if (!tourPath?.stops?.length) {
      const { guidedPosition, explorationPath } = state;
      if (guidedPosition >= explorationPath.length - 1) return;
      markConceptExplored(explorationPath[guidedPosition]);
      const next = guidedPosition + 1;
      set({ guidedPosition: next, selectedNode: { type: 'concept', id: explorationPath[next] }, showInspector: false });
      return;
    }
    if (tourPosition >= tourPath.stops.length - 1) return;
    const currentStop = tourPath.stops[tourPosition];
    const nextStop = tourPath.stops[tourPosition + 1];

    if (currentStop.type === 'section' && nextStop.type === 'chapter_intro') {
      markConceptExplored(currentStop.conceptKey);
    }

    const nextPos = tourPosition + 1;
    set({
      tourPosition: nextPos,
      guidedPosition: nextPos,
      selectedNode: { type: 'concept', id: nextStop.id },
      showInspector: true,
    });
    navigateDrillToStop(nextStop, get);
  },
  retreatGuided: () => {
    const state = get();
    const { tourPath, tourPosition } = state;
    if (!tourPath?.stops?.length) {
      const { guidedPosition, explorationPath } = state;
      if (guidedPosition <= 0) return;
      const prev = guidedPosition - 1;
      set({ guidedPosition: prev, selectedNode: { type: 'concept', id: explorationPath[prev] }, showInspector: false });
      return;
    }
    if (tourPosition <= 0) return;
    const prevStop = tourPath.stops[tourPosition - 1];
    const prevPos = tourPosition - 1;
    set({
      tourPosition: prevPos,
      guidedPosition: prevPos,
      selectedNode: { type: 'concept', id: prevStop.id },
      showInspector: true,
    });
    navigateDrillToStop(prevStop, get);
  },
  skipToNextChapter: () => {
    const { tourPath, tourPosition, markConceptExplored } = get();
    if (!tourPath?.stops?.length) return;
    const currentStop = tourPath.stops[tourPosition];
    markConceptExplored(currentStop.conceptKey);
    for (let i = tourPosition + 1; i < tourPath.stops.length; i++) {
      if (tourPath.stops[i].type === 'chapter_intro') {
        set({
          tourPosition: i,
          guidedPosition: i,
          selectedNode: { type: 'concept', id: tourPath.stops[i].id },
          showInspector: true,
        });
        navigateDrillToStop(tourPath.stops[i], get);
        return;
      }
    }
  },
  jumpToChapter: (chapterIndex) => {
    const { tourPath } = get();
    if (!tourPath?.stops?.length) return;
    const stopIdx = tourPath.stops.findIndex(
      s => s.type === 'chapter_intro' && s.chapterIndex === chapterIndex
    );
    if (stopIdx === -1) return;
    set({
      tourPosition: stopIdx,
      guidedPosition: stopIdx,
      selectedNode: { type: 'concept', id: tourPath.stops[stopIdx].id },
      showInspector: true,
    });
    navigateDrillToStop(tourPath.stops[stopIdx], get);
  },
  exitGuidedMode: () => set({ guidedMode: false }),
  enterGuidedMode: () => {
    const { tourPosition, tourPath, guidedPosition, explorationPath } = get();
    if (tourPath?.stops?.length) {
      const stop = tourPath.stops[tourPosition];
      set({
        guidedMode: true,
        selectedNode: { type: 'concept', id: stop.id },
        showInspector: true,
      });
      navigateDrillToStop(stop, get);
    } else if (explorationPath.length) {
      set({
        guidedMode: true,
        selectedNode: { type: 'concept', id: explorationPath[guidedPosition] },
        showInspector: true,
      });
    }
  },

  // Quiz state
  quizDisabled: JSON.parse(localStorage.getItem('cbe_quiz_disabled') || 'false'),
  setQuizDisabled: (disabled) => {
    localStorage.setItem('cbe_quiz_disabled', JSON.stringify(disabled));
    set({ quizDisabled: disabled });
  },
  quizGateActive: false,
  quizGateQuestions: [],
  quizGateType: null,
  quizCurrentIndex: 0,
  quizAnswers: [],
  quizLoading: false,
  quizStats: {},
  setQuizGateActive: (active) => set({ quizGateActive: active }),
  setQuizGateQuestions: (questions) => set({ quizGateQuestions: questions }),
  setQuizGateType: (type) => set({ quizGateType: type }),
  setQuizCurrentIndex: (index) => set({ quizCurrentIndex: index }),
  addQuizAnswer: (answer) => set(state => ({ quizAnswers: [...state.quizAnswers, answer] })),
  resetQuizGate: () => set({
    quizGateActive: false, quizGateQuestions: [], quizGateType: null,
    quizCurrentIndex: 0, quizAnswers: [],
  }),
  setQuizLoading: (loading) => set({ quizLoading: loading }),
  setQuizStats: (stats) => set({ quizStats: stats }),

  // Universe bubble mode (initial zoom-in experience)
  universeMode: true,
  setUniverseMode: (active) => set({ universeMode: active }),

  // Circle-pack navigation state
  focusStack: ['__universe__'],
  focusNodeId: '__universe__',
  childrenRevealed: false,
  visibleDepth: 1,
  drillTransition: null,

  revealChildren: () => {
    const state = get();
    if (state.childrenRevealed) return;
    set({ childrenRevealed: true, universeMode: false });
    if (!state.subConceptsCache[state.focusNodeId] && !state.subConceptsLoading.has(state.focusNodeId)) {
      get().fetchSubConcepts(state.focusNodeId);
    }
  },

  drillInto: (nodeId) => {
    const state = get();
    if (nodeId === state.focusNodeId) {
      get().revealChildren();
      return;
    }
    set({
      focusStack: [...state.focusStack, nodeId],
      focusNodeId: nodeId,
      childrenRevealed: true,
      drillTransition: { type: 'in', targetId: nodeId, startedAt: Date.now() },
      universeMode: false,
    });
    if (!state.subConceptsCache[nodeId] && !state.subConceptsLoading.has(nodeId)) {
      get().fetchSubConcepts(nodeId);
    }
  },

  drillOut: () => {
    const state = get();
    // At universe level with children shown: collapse to hero
    if (state.childrenRevealed && state.focusStack.length <= 1) {
      set({ childrenRevealed: false, universeMode: true });
      return;
    }
    // At a deeper level: go back to parent (show parent's children)
    if (state.focusStack.length <= 1) return;
    const nextStack = state.focusStack.slice(0, -1);
    const parentId = nextStack[nextStack.length - 1];
    set({
      focusStack: nextStack,
      focusNodeId: parentId,
      childrenRevealed: true,
      drillTransition: { type: 'out', targetId: parentId, startedAt: Date.now() },
      universeMode: false,
    });
  },

  drillToLevel: (index) => {
    const state = get();
    if (index < 0 || index >= state.focusStack.length) return;
    const nextStack = state.focusStack.slice(0, index + 1);
    const targetId = nextStack[nextStack.length - 1];
    set({
      focusStack: nextStack,
      focusNodeId: targetId,
      childrenRevealed: true,
      drillTransition: { type: 'out', targetId, startedAt: Date.now() },
      universeMode: false,
    });
  },

  setVisibleDepth: (depth) => set({ visibleDepth: depth }),
  clearDrillTransition: () => set({ drillTransition: null }),

  // Code element expansion state (Level 3 semantic zoom)
  codeElementExpansions: {},   // { [subConceptId]: { elements: [...], expandedAt } }

  expandCodeElements: (subConceptId) => {
    const state = get();
    if (state.codeElementExpansions[subConceptId]) return;

    const subConcept = state.concepts.find(c => c.id === subConceptId && c._isExpansion);
    if (!subConcept) return;

    const subFileIds = subConcept.fileIds || [];
    const relevantFiles = state.files.filter(f => subFileIds.includes(f.id));

    const elements = [];
    for (const file of relevantFiles) {
      if (!file.exports?.length) continue;
      for (const exp of file.exports) {
        elements.push({
          id: `${file.id}::${exp.name}`,
          name: exp.name,
          whatItDoes: exp.whatItDoes || '',
          _fileName: file.name,
          _filePath: file.id,
          _subConceptId: subConceptId,
          _isCodeElement: true,
        });
        if (elements.length >= 12) break;
      }
      if (elements.length >= 12) break;
    }

    if (!elements.length) return;

    set(s => ({
      codeElementExpansions: {
        ...s.codeElementExpansions,
        [subConceptId]: { elements, expandedAt: Date.now() },
      },
    }));
  },

  collapseCodeElements: (subConceptId) => {
    set(s => {
      const next = { ...s.codeElementExpansions };
      delete next[subConceptId];
      return { codeElementExpansions: next };
    });
  },

  // Sub-concept zoom state
  subConceptsCache: {},
  subConceptsLoading: new Set(),
  subConceptsReadyKeys: new Set(),
  subConceptExpandable: new Set(),
  setSubConceptsReadyKeys: (keys) => set({ subConceptsReadyKeys: new Set(keys) }),
  setSubConceptsCache: (cache) => set({ subConceptsCache: cache }),

  fetchSubConcepts: async (conceptKey) => {
    const state = get();
    if (state.subConceptsLoading.has(conceptKey)) return;
    if (state.expansions[conceptKey]) return;

    const cached = state.subConceptsCache[conceptKey];
    if (cached?.ready && cached.subConcepts?.length) {
      get().expandConcept(conceptKey, cached.subConcepts, cached.subEdges || []);
      return;
    }

    const loading = new Set(state.subConceptsLoading);
    loading.add(conceptKey);
    set({ subConceptsLoading: loading });

    try {
      const res = await fetch(`${API_BASE}/api/pipeline/${state.projectId}/sub-concepts/${conceptKey}`);
      const data = await res.json();

      set(s => {
        const nextLoading = new Set(s.subConceptsLoading);
        nextLoading.delete(conceptKey);
        return {
          subConceptsCache: {
            ...s.subConceptsCache,
            [conceptKey]: { subConcepts: data.sub_concepts || [], subEdges: data.sub_edges || [], ready: data.ready },
          },
          subConceptsLoading: nextLoading,
        };
      });

      if (data.ready && data.sub_concepts?.length) {
        get().expandConcept(conceptKey, data.sub_concepts, data.sub_edges || []);
      }
    } catch {
      const nextLoading = new Set(get().subConceptsLoading);
      nextLoading.delete(conceptKey);
      set({ subConceptsLoading: nextLoading });
    }
  },

  // Graph expansion state
  expansions: {},
  expansionHistory: [],
  highlightedPath: null,

  applyGraphOperations: (graphOps) => {
    const state = get();
    const { operations, auto_collapse } = graphOps;

    // Auto-collapse old expansions first
    if (auto_collapse?.length) {
      for (const conceptId of auto_collapse) {
        if (state.expansions[conceptId]) {
          get().collapseConcept(conceptId);
        }
      }
    }

    for (const op of operations) {
      if (op.type === 'expand_concept' && op.parent_concept_id && op.sub_concepts?.length) {
        const parentExists = get().concepts.some(c => c.id === op.parent_concept_id);
        if (!parentExists) continue;
        if (get().expansions[op.parent_concept_id]) continue;
        get().expandConcept(op.parent_concept_id, op.sub_concepts, op.sub_edges || []);
      } else if (op.type === 'highlight_path' && op.path?.length >= 2) {
        get().highlightPathNodes(op.path, op.path_label || '');
      } else if (op.type === 'focus_files' && op.concept_id && op.file_ids?.length) {
        set({ viewMode: 'files', selectedNode: { type: 'concept', id: op.concept_id } });
      } else if (op.type === 'add_edge' && op.source && op.target) {
        const sourceExists = get().concepts.some(c => c.id === op.source);
        const targetExists = get().concepts.some(c => c.id === op.target);
        if (sourceExists && targetExists) {
          set(s => ({
            conceptEdges: [...s.conceptEdges, {
              source: op.source,
              target: op.target,
              label: op.edge_label || '',
              strength: 'moderate',
              _temporary: true,
            }],
          }));
        }
      }
    }

    // Sprawl check: auto-collapse oldest if too many expansions
    const expansionCount = Object.keys(get().expansions).length;
    if (expansionCount > 5) {
      const history = get().expansionHistory;
      if (history.length > 0) {
        const oldest = history[0];
        get().collapseConcept(oldest.conceptId);
        get().showToast(`Collapsed ${oldest.name} to keep graph readable`);
      }
    }
  },

  expandConcept: (parentId, subConcepts, subEdges) => {
    const state = get();
    let parent = state.concepts.find(c => c.id === parentId);
    if (!parent) {
      for (const exp of Object.values(state.expansions)) {
        parent = exp.subConcepts.find(sc => sc.id === parentId);
        if (parent) break;
      }
    }
    if (!parent) return;

    const subConceptNodes = subConcepts.map(sc => ({
      id: sc.id,
      name: sc.name,
      one_liner: sc.one_liner,
      color: sc.color || parent.color,
      importance: sc.importance || 'supporting',
      fileIds: sc.file_ids || [],
      fileCount: sc.file_ids?.length || 0,
      _isExpansion: true,
      _parentId: parentId,
    }));

    const nextExpandable = new Set(state.subConceptExpandable);
    for (const sc of subConceptNodes) {
      if (sc.fileIds.length >= 2) nextExpandable.add(sc.id);
    }

    set(s => ({
      expansions: {
        ...s.expansions,
        [parentId]: {
          subConcepts: subConceptNodes,
          subEdges: subEdges || [],
          expandedAt: Date.now(),
        },
      },
      expansionHistory: [
        ...s.expansionHistory,
        { conceptId: parentId, name: parent.name, expandedAt: Date.now() },
      ],
      subConceptExpandable: nextExpandable,
    }));
  },

  collapseConcept: (parentId) => {
    const state = get();
    const expansion = state.expansions[parentId];
    if (!expansion) return;

    for (const sc of expansion.subConcepts) {
      if (state.expansions[sc.id]) {
        get().collapseConcept(sc.id);
      }
    }

    const freshState = get();
    const childIds = new Set(expansion.subConcepts.map(sc => sc.id));

    const nextCodeExpansions = { ...freshState.codeElementExpansions };
    childIds.forEach(id => { delete nextCodeExpansions[id]; });

    const nextExpansions = { ...freshState.expansions };
    delete nextExpansions[parentId];

    set({
      expansions: nextExpansions,
      expansionHistory: freshState.expansionHistory.filter(h => h.conceptId !== parentId),
      codeElementExpansions: nextCodeExpansions,
    });
  },

  collapseAll: () => {
    set({
      expansions: {},
      expansionHistory: [],
      highlightedPath: null,
      codeElementExpansions: {},
    });
  },

  highlightPathNodes: (nodeIds, label) => {
    set({ highlightedPath: { nodeIds, label } });
    setTimeout(() => {
      if (get().highlightedPath?.nodeIds === nodeIds) {
        set({ highlightedPath: null });
      }
    }, 8000);
  },

  clearHighlights: () => set({ highlightedPath: null }),

  getExpansionState: () => {
    const state = get();
    return {
      expanded_concepts: Object.keys(state.expansions),
      visible_node_count: state.concepts.length,
    };
  },

  // Insights
  insights: [],
  setInsights: (insights) => set({ insights }),

  // Origin context (how codebase was created)
  originContext: null, // 'self_built' | 'ai_built' | 'someone_else'
  setOriginContext: (ctx) => set({ originContext: ctx }),

  // Curated codebase tracking
  curatedCodebaseId: null,
  setCuratedCodebaseId: (id) => set({ curatedCodebaseId: id }),

  // Reset all project-related state for clean project switching
  resetProject: () => set({
    concepts: [], files: [], conceptEdges: [], fileImports: [],
    projectMeta: null, projectId: null,
    pipelineStatus: null, pipelineProgress: null, processingError: null,
    selectedNode: null, showInspector: false,
    chatMessages: [], chatLoading: false, chatPanelOpen: false, commandPaletteOpen: false, chatStreamingText: '',
    guidedMode: false, guidedPosition: 0, explorationPath: [], tourPath: null, tourPosition: 0,
    exploredConcepts: new Set(),
    explorationProgress: 0,
    insightCard: null, insights: [],
    quizGateActive: false, quizGateQuestions: [], quizGateType: null,
    quizCurrentIndex: 0, quizAnswers: [], quizStats: {},
    curatedCodebaseId: null,
    showCodePanel: false, codePanelFileId: null,
    showOnboarding: true,
    toast: null,
    expansions: {}, expandedNodeIds: new Set(), expansionHistory: [],
    highlightedPath: null, codeElementExpansions: {},
    universeMode: true,
    focusStack: ['__universe__'], focusNodeId: '__universe__', childrenRevealed: false, visibleDepth: 1, drillTransition: null,
    subConceptsCache: {}, subConceptsLoading: new Set(), subConceptsReadyKeys: new Set(), subConceptExpandable: new Set(),
  }),

  // Helpers
  getConceptById: (id) => get().concepts.find(c => c.id === id),
  getFileById: (id) => get().files.find(f => f.id === id),
  getFilesByConcept: (conceptId) => get().files.filter(f => f.conceptId === conceptId),
  getConnectedConcepts: (conceptId) => {
    const edges = get().conceptEdges;
    const connected = new Set();
    edges.forEach(e => {
      if (e.source === conceptId) connected.add(e.target);
      if (e.target === conceptId) connected.add(e.source);
    });
    return Array.from(connected);
  },
}));

export default useStore;
