import { create } from 'zustand';

const useStore = create((set, get) => ({
  // App state
  screen: 'landing', // 'landing' | 'upload' | 'processing' | 'explorer'
  setScreen: (screen) => set({ screen }),

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

  // Dark mode (default true)
  darkMode: true,
  toggleDarkMode: () => set(state => ({ darkMode: !state.darkMode })),

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

  // Insights
  insights: [],
  setInsights: (insights) => set({ insights }),

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
