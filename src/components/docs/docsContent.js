import {
  Rocket, Compass, MessageSquare, Route, Keyboard, Terminal, Share2,
  Upload, GitBranch, FileArchive, BookOpen, MousePointer, ZoomIn,
  Move, Maximize2, Eye, Layers, PanelRight, Command, Clock,
  GitFork, ArrowRight, HelpCircle, CheckSquare, BarChart3, Quote,
} from 'lucide-react';

export const DOC_SECTIONS = [
  {
    id: 'getting-started',
    title: 'Getting Started',
    icon: Rocket,
    subsections: [
      {
        title: 'Upload a codebase',
        type: 'feature-cards',
        items: [
          { icon: Upload, title: 'Paste a URL', description: 'Paste any public GitHub or GitLab repository URL to analyze it instantly.' },
          { icon: GitBranch, title: 'GitHub repos', description: 'Sign in with GitHub to browse and select from your own repositories.' },
          { icon: FileArchive, title: 'Upload a .zip', description: 'Drag and drop a zip file of any codebase. Works with any language.' },
          { icon: BookOpen, title: 'Open source examples', description: 'Browse pre-analyzed open source projects to explore right away.' },
        ],
      },
      {
        title: 'What are concepts?',
        type: 'prose',
        content: 'Codebase Explorer maps your code to high-level architectural concepts \u2014 groups of related files that serve a common purpose. For example, an "Authentication" concept might contain your login routes, JWT middleware, and user model. Concepts are sized by importance and colored by category, giving you an instant visual map of how a codebase is structured.',
      },
      {
        title: 'The analysis pipeline',
        type: 'prose',
        content: 'After uploading, the pipeline reads your files, analyzes their structure and dependencies, then synthesizes architectural concepts and relationships using AI. This typically takes 15\u201345 seconds depending on codebase size. You can watch the progress in real time on the processing screen.',
      },
    ],
  },
  {
    id: 'explorer',
    title: 'Explorer',
    icon: Compass,
    subsections: [
      {
        title: 'Universe mode',
        type: 'prose',
        content: 'When you first enter the explorer, you see a single glowing bubble with your project name. Click anywhere on it to zoom in and reveal the concept graph. This "universe mode" gives you a dramatic entry point into the architecture.',
      },
      {
        title: 'Graph interactions',
        type: 'interaction-list',
        items: [
          { action: 'Click', target: 'concept node', result: 'Select it and open the inspector panel with details', demo: 'click' },
          { action: 'Double-click', target: 'concept node', result: 'Zoom into the concept; close zoom expands ready sub-concepts', demo: 'expand' },
          { action: 'Scroll wheel', target: 'canvas', result: 'Zoom in and out of the graph', demo: 'zoom' },
          { action: 'Click + drag', target: 'canvas background', result: 'Pan around the graph', demo: 'pan' },
          { action: 'Hover', target: 'concept node', result: 'See a tooltip with name, summary, and importance' },
          { action: 'Zoom in close', target: 'concept node', result: 'Auto-loads sub-concepts when node fills >120px' },
          { action: 'Zoom out far', target: 'expanded concept', result: 'Auto-collapses when node shrinks below 40px' },
        ],
      },
      {
        title: 'View modes',
        type: 'feature-cards',
        items: [
          { icon: Layers, title: 'Concepts view', description: 'See high-level architectural concepts as bubbles connected by relationship edges.' },
          { icon: Eye, title: 'Files view', description: 'See individual files clustered around their parent concept, with import edges between them.' },
        ],
      },
      {
        title: 'Inspector panel',
        type: 'prose',
        content: 'Click any concept to open a floating detail panel. It shows the concept\u2019s description at three depth levels \u2014 Conceptual (beginner), Applied (intermediate), and Under the Hood (advanced). You\u2019ll also see connected concepts, related files, and importance rating. Click a file to view its source code in a split panel.',
      },
    ],
  },
  {
    id: 'chat-ai',
    title: 'Chat & AI',
    icon: MessageSquare,
    subsections: [
      {
        title: 'Command palette',
        type: 'prose',
        content: 'Press Ctrl+K (or Cmd+K on Mac) anywhere in the explorer to open the command palette. Type a question about the codebase and press Enter. The palette closes and your question appears in the chat panel with a streamed AI response.',
      },
      {
        title: 'Chat panel',
        type: 'feature-cards',
        items: [
          { icon: MessageSquare, title: 'Ask questions', description: 'Open chat via the floating button (bottom-right) or Ctrl+K. Ask about architecture, data flows, or how any feature works.' },
          { icon: ArrowRight, title: 'Follow-up questions', description: 'After each response, suggested follow-up questions appear. Click any to continue the conversation.' },
          { icon: GitFork, title: 'Graph expansion', description: 'When you ask about a concept, the graph updates with new sub-concept nodes. A "Graph updated" badge appears in the chat.' },
          { icon: Clock, title: 'Chat history', description: 'Click the clock icon in the chat header to view past conversations. Sessions persist across web and CLI.' },
          { icon: Quote, title: 'Quote to chat', description: 'Highlight any text in the inspector panel, overview page, or chat responses. A toolbar appears to send the excerpt to chat as a quoted reference with source context.' },
        ],
      },
    ],
  },
  {
    id: 'guided-tours',
    title: 'Guided Tours & Quizzes',
    icon: Route,
    subsections: [
      {
        title: 'Starting a tour',
        type: 'prose',
        content: 'Guided tours walk you through concepts in a recommended order. They activate automatically from your comprehension profile recommendations, or you can start one manually from the top bar. The tour highlights each concept in sequence with a progress indicator.',
      },
      {
        title: 'Tour navigation',
        type: 'interaction-list',
        items: [
          { action: 'Arrow Right / Down', target: 'during tour', result: 'Advance to the next concept' },
          { action: 'Arrow Left / Up', target: 'during tour', result: 'Go back to the previous concept' },
          { action: 'Escape', target: 'during tour', result: 'Exit the guided tour' },
          { action: 'Next / Back buttons', target: 'inspector panel', result: 'Navigate between tour stops' },
        ],
      },
      {
        title: 'Quiz checkpoints',
        type: 'prose',
        content: 'During guided tours, quiz gates may appear to test your understanding. Select answers using keys 1\u20136 or by clicking. Press Enter to submit. You can skip questions with Escape, or disable quizzes entirely in Settings under "Quiz checkpoints".',
      },
    ],
  },
  {
    id: 'shortcuts',
    title: 'Keyboard Shortcuts',
    icon: Keyboard,
    subsections: [
      {
        type: 'shortcut-table',
        groups: [
          {
            name: 'General',
            shortcuts: [
              { keys: ['Ctrl', 'K'], description: 'Open command palette' },
              { keys: ['Esc'], description: 'Deselect node / close panel / exit mode' },
            ],
          },
          {
            name: 'Explorer',
            shortcuts: [
              { keys: ['Scroll'], description: 'Zoom in and out' },
              { keys: ['Click'], description: 'Select a concept or file' },
              { keys: ['Double-click'], description: 'Zoom into a concept; close zoom expands ready sub-concepts' },
              { keys: ['Click + Drag'], description: 'Pan the graph view' },
            ],
          },
          {
            name: 'Guided Tour',
            shortcuts: [
              { keys: ['\u2192', '\u2193'], description: 'Next concept' },
              { keys: ['\u2190', '\u2191'], description: 'Previous concept' },
              { keys: ['Esc'], description: 'Exit guided tour' },
            ],
          },
          {
            name: 'Quiz',
            shortcuts: [
              { keys: ['1', '\u2013', '6'], description: 'Select an answer option' },
              { keys: ['Enter'], description: 'Submit answer / continue' },
              { keys: ['Esc'], description: 'Skip question' },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'cli',
    title: 'CLI Tool',
    icon: Terminal,
    subsections: [
      {
        title: 'Installation',
        type: 'prose',
        content: 'Install the CLI globally with npm:',
        codeBlock: 'npm install -g @tetuji486597/gui',
      },
      {
        type: 'cli-reference',
        commands: [
          { command: 'gui', description: 'Analyze the current directory (first time) or start interactive chat (if already analyzed)' },
          { command: 'gui "question"', description: 'Ask a question about the codebase (analyzes first if needed)' },
          { command: 'gui chat', description: 'Start an interactive multi-turn chat session about the project' },
          { command: 'gui projects', description: 'List all previously analyzed projects' },
          { command: 'gui open', description: 'Open the current project in the web browser' },
          { command: 'gui share', description: 'Get a shareable link for the current project' },
          { command: 'gui status', description: 'Check the pipeline processing status' },
          { command: 'gui history', description: 'View past chat sessions (add a number to view a specific session)' },
          { command: 'gui login', description: 'Authenticate via browser (GitHub OAuth)' },
          { command: 'gui logout', description: 'Clear stored authentication credentials' },
        ],
        flags: [
          { flag: '--dir <path>', description: 'Analyze a different directory instead of the current one' },
          { flag: '--max-files <n>', description: 'Limit the number of files to analyze (default: 30)' },
          { flag: '--new', description: 'Force a fresh analysis, ignoring cached results' },
          { flag: '--open', description: 'Automatically open the results in your browser' },
        ],
      },
      {
        title: 'Examples',
        type: 'prose',
        codeBlock: `# Analyze current directory
gui

# Analyze a specific repo
gui --dir ~/projects/myapp

# Ask a question (analyzes first if new)
gui "how does authentication work?"

# Start interactive chat
gui chat

# Force re-analysis
gui --new

# View past conversations
gui history
gui history 2`,
      },
    ],
  },
  {
    id: 'sharing',
    title: 'Sharing',
    icon: Share2,
    subsections: [
      {
        title: 'Sharing your analysis',
        type: 'feature-cards',
        items: [
          { icon: Share2, title: 'Share link', description: 'Click the Share button in the top bar to copy a read-only link. Anyone with the link can explore the graph and read concept details.' },
          { icon: PanelRight, title: 'Shared viewer', description: 'Shared links open a read-only view with the full graph, zoom controls, and detail cards \u2014 no account required.' },
          { icon: Terminal, title: 'CLI sharing', description: 'Run gui share to get a shareable link, or gui open to open the project in your browser.' },
        ],
      },
    ],
  },
];
