import { create } from 'zustand';
import { supabase } from '../lib/supabase';

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
    set({ user: null, session: null });
  },

  // View mode
  viewMode: 'concepts', // 'concepts' | 'files'
  setViewMode: (viewMode) => set({ viewMode }),

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
  addChatMessage: (message) => set(state => ({
    chatMessages: [...state.chatMessages, message]
  })),
  setChatLoading: (loading) => set({ chatLoading: loading }),
  clearChat: () => set({ chatMessages: [], chatLoading: false }),

  // Processing status
  processingStatus: '',
  setProcessingStatus: (status) => set({ processingStatus: status }),

  // Onboarding
  showOnboarding: true,
  onboardingStep: 0,
  setOnboardingStep: (step) => set({ onboardingStep: step }),
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
  activeDepthLevel: 'beginner',
  setActiveDepthLevel: (level) => set({ activeDepthLevel: level }),

  // Graph layout positions (managed by d3-force, stored here for persistence)
  nodePositions: {},
  setNodePositions: (positions) => set({ nodePositions: positions }),

  // Pipeline state
  projectId: null,
  setProjectId: (id) => set({ projectId: id }),
  pipelineStatus: null, // null | 'pending' | 'processing' | 'stage_N' | 'complete' | 'failed'
  pipelineProgress: null, // { stage, total_stages, message }
  setPipelineStatus: (status) => set({ pipelineStatus: status }),
  setPipelineProgress: (progress) => set({ pipelineProgress: progress }),

  // Proactive UI state
  pulsingNodeId: null,
  setPulsingNodeId: (id) => set({ pulsingNodeId: id }),
  insightCard: null, // { id, title, summary, detail, category }
  setInsightCard: (card) => set({ insightCard: card }),
  connectionHighlight: null,
  setConnectionHighlight: (id) => set({ connectionHighlight: id }),
  suggestionBanner: null,
  setSuggestionBanner: (text) => set({ suggestionBanner: text }),
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

  // User exploration state (synced with backend)
  userState: null,
  setUserState: (state) => set({ userState: state }),

  // Guided tour mode
  guidedMode: false,
  guidedPosition: 0,
  explorationPath: [],
  setGuidedMode: (active) => set({ guidedMode: active }),
  setGuidedPosition: (pos) => set({ guidedPosition: pos }),
  setExplorationPath: (path) => set({ explorationPath: path }),
  advanceGuided: () => {
    const { guidedPosition, explorationPath, markConceptExplored } = get();
    if (guidedPosition >= explorationPath.length - 1) return;
    markConceptExplored(explorationPath[guidedPosition]);
    const next = guidedPosition + 1;
    set({
      guidedPosition: next,
      selectedNode: { type: 'concept', id: explorationPath[next] },
      showInspector: false,
    });
  },
  retreatGuided: () => {
    const { guidedPosition, explorationPath } = get();
    if (guidedPosition <= 0) return;
    const prev = guidedPosition - 1;
    set({
      guidedPosition: prev,
      selectedNode: { type: 'concept', id: explorationPath[prev] },
      showInspector: false,
    });
  },
  exitGuidedMode: () => set({ guidedMode: false }),
  enterGuidedMode: () => {
    const { guidedPosition, explorationPath } = get();
    if (!explorationPath.length) return;
    set({
      guidedMode: true,
      selectedNode: { type: 'concept', id: explorationPath[guidedPosition] },
      showInspector: true,
    });
  },

  // Quiz state
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

  // Insights
  insights: [],
  setInsights: (insights) => set({ insights }),

  // Origin context (how codebase was created)
  originContext: null, // 'self_built' | 'ai_built' | 'someone_else'
  setOriginContext: (ctx) => set({ originContext: ctx }),

  // Curated codebase tracking
  curatedCodebaseId: null,
  setCuratedCodebaseId: (id) => set({ curatedCodebaseId: id }),

  // App-first preview state
  appPreviewData: null,
  setAppPreviewData: (data) => set({ appPreviewData: data }),
  previewBridgeFrom: null, // { conceptKey, narrationTitle, previewId }
  setPreviewBridgeFrom: (ctx) => set({ previewBridgeFrom: ctx }),
  clearPreviewBridge: () => set({ previewBridgeFrom: null }),

  // Reset all project-related state for clean project switching
  resetProject: () => set({
    concepts: [], files: [], conceptEdges: [], fileImports: [],
    projectMeta: null, projectId: null,
    pipelineStatus: null, pipelineProgress: null,
    selectedNode: null, showInspector: false,
    chatMessages: [], chatLoading: false,
    guidedMode: false, guidedPosition: 0, explorationPath: [],
    exploredConcepts: new Set(),
    explorationProgress: 0, userState: null,
    insightCard: null, pulsingNodeId: null, connectionHighlight: null,
    suggestionBanner: null, insights: [],
    quizGateActive: false, quizGateQuestions: [], quizGateType: null,
    quizCurrentIndex: 0, quizAnswers: [], quizStats: {},
    curatedCodebaseId: null, appPreviewData: null,
    previewBridgeFrom: null,
    showCodePanel: false, codePanelFileId: null,
    showOnboarding: true, onboardingStep: 0,
    toast: null,
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
