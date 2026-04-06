# AI Architecture: Codebase Explorer

## Overview

Codebase Explorer is a proactive, adaptive codebase understanding system. A user uploads a zip, and the app guides them through their codebase without them ever needing to type a question.

The system runs a 7-stage ingestion pipeline that extracts deep codebase structure, stores all code and explanations with vector embeddings for accurate retrieval, tracks user exploration state and understanding via a user model, and uses a proactive engine to drive the UI — deciding what to show next, which nodes to highlight, and what insights to surface — before the user asks. The frontend is built with React + Vite + Zustand + Canvas.

---

## Design Principles

1. **No frameworks.** Uses Anthropic's SDK directly with composable patterns (prompt chaining, parallelization, orchestrator-workers, routing, evaluator-optimizer). No LangChain, no LangGraph.
2. **Structured outputs everywhere.** Every Claude call uses tool-use (`tool_choice: { type: 'tool', name: schemaName }`) for guaranteed valid JSON. No regex parsing, no try/catch on malformed responses.
3. **Stream everything user-facing.** Pipeline progress, chat responses, and proactive insights all stream via SSE. The user never stares at a spinner wondering if something is broken.
4. **Start simple, add complexity only where it improves outcomes.** Each pipeline stage exists because a single call demonstrably cannot produce the same quality output.
5. **Grounded in real code.** Every explanation, insight, and answer references actual files and line numbers from the user's codebase, retrieved via RAG — never from Claude's general training knowledge.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT (React + Vite)                     │
│                                                                   │
│  Upload → Processing UI → Explorer (Graph + Inspector + Chat)    │
│  Zustand store ← SSE streams from backend                        │
└──────────────────────────┬───────────────────────────────────────┘
                           │ HTTPS / SSE
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                     API SERVER (Node.js + Hono, port 3007)       │
│                                                                   │
│  POST /api/pipeline/start     → Kick off ingestion pipeline      │
│  GET  /api/pipeline/:id/stream → SSE stream of pipeline progress │
│  GET  /api/pipeline/:id/data  → Get all project data             │
│  POST /api/chat               → RAG-powered chat (streaming)     │
│  POST /api/proactive          → Get next proactive action        │
│  POST /api/explain            → Explain a specific node          │
│  PATCH /api/user-state        → Update user exploration state    │
│                                                                   │
│  Anthropic SDK (claude-sonnet-4-6 + claude-haiku-4-5)            │
│  Supabase client (database + storage + vectors)                  │
│  OpenAI embedding client (text-embedding-3-small)                │
└──────────────────────────┬───────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                     SUPABASE                                     │
│                                                                   │
│  Tables:                                                         │
│    projects        — one row per uploaded codebase               │
│    files           — every file with content, analysis, metadata │
│    concepts        — extracted concepts with descriptions        │
│    concept_edges   — relationships between concepts              │
│    code_chunks     — chunked code with contextual embeddings     │
│    user_state      — exploration tracking, knowledge model       │
│    insights        — proactive insights queue                    │
│    chat_messages   — conversation history                        │
│                                                                   │
│  pgvector:                                                       │
│    code_chunks.embedding (HNSW index, cosine distance)           │
│                                                                   │
│  Full-text search:                                               │
│    code_chunks.fts (GIN index, tsvector)                         │
│                                                                   │
│  Hybrid search function:                                         │
│    search_code_chunks (70% vector / 30% lexical weighting)       │
└─────────────────────────────────────────────────────────────────┘
```

### Why Hono over Next.js or Cloudflare Workers

The app is Vite + React. Adding Next.js would mean migrating the entire frontend or running two separate frameworks — unnecessary complexity. Cloudflare Workers have execution time limits that complicate multi-minute pipelines.

**Hono** is the right choice:
- Lightweight (~14KB), runs on Node.js alongside the existing Vite dev server
- First-class SSE streaming support via `hono/streaming`
- Can deploy to Cloudflare Workers, Vercel Edge, or plain Node.js later
- No framework lock-in, no frontend migration required
- Lives in the `server/` directory alongside the existing `src/`

In development, Vite proxies `/api/*` to the Hono server. In production, both can run as a single Node.js process or be split into separate services.

---

## Component 1: Ingestion Pipeline

The pipeline transforms a zip file into a rich, queryable knowledge base. It runs as an async background job — the client gets a project ID immediately and subscribes to progress updates via SSE from `/api/pipeline/:id/stream` (polled every 1 second from the server).

### Pipeline Stages

```
ZIP Upload
    │
    ▼
[Stage 1] File Extraction & Classification (client-side, ~2s)
    │
    ▼
[Stage 2] Sequential File Analysis (server, batches of 15 files)
    │    ├── Batch 1: files 1-15  → Claude Haiku
    │    ├── (60s rate-limit wait)
    │    ├── Batch 2: files 16-30 → Claude Haiku
    │    ├── (60s rate-limit wait)
    │    └── Batch N: remaining   → Claude Haiku
    │
    ▼
[Stage 3] Concept Synthesis (server, 1 Claude Sonnet call)
    │    All file analyses → concept graph
    │
    ▼
[Stage 4] Relationship & Depth Mapping (server, 1 Claude call)
    │    Multi-level explanations (beginner/intermediate/advanced)
    │
    ▼
[Stage 5] Insight Generation (server, 1 Claude call)
    │    Senior engineer perspective
    │
    ▼
[Stage 6] Embedding & Indexing (server)
    │    ├── Chunk all files (~800 tokens, 10% overlap)
    │    ├── Generate embeddings (OpenAI text-embedding-3-small)
    │    └── Store in Supabase with pgvector
    │
    ▼
[Stage 7] Proactive Queue Seeding (server, 1 Claude call)
         Generate initial exploration path
```

The UI shows progressive results via SSE — the concept graph appears after Stage 3, and the user can start exploring while Stages 4-7 complete in the background.

### Stage 1: File Extraction & Classification

**Runs on:** Client (`fileParser.js`)
**Input:** ZIP file
**Output:** File tree, file contents, import edges

The client-side parser:
- Extracts the ZIP file and filters out non-code files (ignores `node_modules`, `.git`, `dist`, `build`, etc.)
- Identifies code files by extension
- Extracts imports via regex (ES6 `import`, CommonJS `require`, Python `import`/`from`, Go `import`, Rust `use`)
- Resolves relative import paths to actual file paths
- Sends file tree, contents, and import edges to the server via `POST /api/pipeline/start`

### Stage 2: Sequential File Analysis

**Runs on:** Server (multiple Claude Haiku calls, run sequentially)
**Input:** All code files from the client
**Output:** Per-file analysis objects stored in `files` table

Files are processed in batches of 15. Each file's content is **truncated to 1,500 characters** to stay within token limits. Batches run **sequentially** with a **60-second wait** between each batch to respect Anthropic rate limits.

Each batch returns structured JSON via tool-use with the following per-file schema:

```typescript
interface FileAnalysis {
  path: string;
  purpose: string;           // One sentence, plain English
  concepts: string[];        // 2-3 keyword concepts
  key_exports: Array<{       // Max 3 exports
    name: string;
    what_it_does: string;
  }>;
  depends_on: string[];      // Imported file paths
  complexity: 'simple' | 'moderate' | 'complex';
  role: 'entry_point' | 'core_logic' | 'data' | 'ui' | 'utility' | 'config' | 'test' | 'types';
}
```

Failed batches fall back to minimal stub analyses so the pipeline continues.

### Stage 3: Concept Synthesis

**Runs on:** Server (single Claude Sonnet call)
**Input:** All file analyses from Stage 2, framework detection from Stage 1
**Output:** Concept graph (nodes + edges) stored in `concepts` and `concept_edges` tables

Claude receives all file analyses and identifies natural conceptual groupings. The structured output includes:

- **Concepts** (3-20): Each has an id, name, emoji, color, metaphor, one-liner, explanation, deep explanation, associated file IDs, and importance level (critical/important/supporting)
- **Edges**: Relationships between concepts with labels and strength (strong/moderate/weak)
- **Suggested starting concept**: Where a new user should look first
- **Codebase summary**: 2-3 sentences about the whole project

**At this point, the concept graph renders in the UI.** The user sees nodes appearing and can start exploring while Stages 4-7 complete.

### Stage 4: Relationship & Depth Mapping

**Runs on:** Server (1 Claude call)
**Input:** Concept graph + file analyses
**Output:** Multi-level explanations for each concept

Generates explanations at three levels per concept:
- **Beginner:** Uses only analogies and everyday language. No code terms.
- **Intermediate:** Mentions technical terms but explains them inline.
- **Advanced:** Assumes programming familiarity, references specific patterns and libraries.

These levels power the adaptive explanation system — the user model determines which level to show.

### Stage 5: Insight Generation

**Runs on:** Server (single Claude call)
**Input:** Full analysis from Stages 2-4
**Output:** Proactive insights stored in `insights` table

The prompt asks Claude to think like a senior engineer doing a code review of an unfamiliar codebase. Insights are categorized as:

| Category | Description |
|----------|-------------|
| `architecture` | Structural observations |
| `risk` | Potential problems or vulnerabilities |
| `pattern` | Design patterns detected |
| `praise` | Well-designed aspects |
| `suggestion` | Improvement recommendations |
| `complexity` | Areas of high complexity |

Each insight includes: title, category, summary, detail, related concept IDs, related file paths, priority (1-10), and prerequisite concepts the user should understand first.

### Stage 6: Embedding & Indexing

**Runs on:** Server (OpenAI embedding API + Supabase inserts)
**Input:** All file contents + contextual descriptions from earlier stages
**Output:** Chunked, embedded code stored in `code_chunks` table with HNSW-indexed vectors

**Chunking strategy:**
- Split each file into ~800-token chunks with 10% overlap
- Each chunk includes a contextual prefix: `"This chunk is from {file.path}, which {file.purpose}. It is part of the {concept.name} concept."`
- Track line numbers (start/end) for each chunk

**Embedding model:** OpenAI `text-embedding-3-small` (1536 dimensions), processed in batches of up to 2,048 texts.

**Hybrid search:** The `code_chunks` table includes both vector embeddings and a full-text search (`tsvector`) column. At query time, both are searched via the `search_code_chunks` RPC function and results are fused with a **70/30 weighting** (semantic/lexical). This catches cases where the user asks about a specific function name (lexical match) vs. a conceptual question (semantic match).

### Stage 7: Proactive Queue Seeding

**Runs on:** Server (single Claude call)
**Input:** Concept graph, insights, suggested starting concept
**Output:** Initial exploration path stored in `user_state`

Generates an ordered sequence of exploration steps — what the user should see first, second, third. This isn't a rigid tour; the proactive engine (Component 4) adjusts the path in real-time based on what the user actually does. But having a starting path means the app can guide the user from the moment the graph loads.

---

## Component 2: Semantic Memory (RAG)

### Purpose

Every time the app explains something, it must reference actual code. The RAG system ensures explanations are grounded in the user's codebase, not Claude's training data.

### Database Schema

```sql
-- Enable pgvector
create extension if not exists vector with schema extensions;

-- Projects
create table projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  framework text,
  language text,
  file_count integer,
  summary text,
  pipeline_status text default 'pending',
  pipeline_progress jsonb default '{}',
  created_at timestamptz default now()
);

-- Files (one row per code file)
create table files (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  path text not null,
  name text not null,
  content text,
  analysis jsonb,
  concept_id text,
  role text,
  importance_score float default 0,
  created_at timestamptz default now(),
  unique(project_id, path)
);

-- Concepts
create table concepts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  concept_key text not null,
  name text not null,
  emoji text,
  color text,
  metaphor text,
  one_liner text,
  explanation text,
  deep_explanation text,
  beginner_explanation text,
  intermediate_explanation text,
  advanced_explanation text,
  importance text,
  created_at timestamptz default now(),
  unique(project_id, concept_key)
);

-- Concept Edges
create table concept_edges (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  source_concept_key text not null,
  target_concept_key text not null,
  relationship text not null,
  strength text,
  explanation text,
  created_at timestamptz default now()
);

-- Code Chunks (for RAG)
create table code_chunks (
  id bigint primary key generated always as identity,
  project_id uuid references projects(id) on delete cascade,
  file_path text not null,
  chunk_index integer not null,
  content text not null,
  context_summary text,
  metadata jsonb default '{}',
  embedding extensions.vector(1536),
  created_at timestamptz default now()
);

-- HNSW index for fast similarity search
create index code_chunks_embedding_idx on code_chunks
  using hnsw (embedding vector_cosine_ops);

-- Full-text search for hybrid retrieval
alter table code_chunks add column fts tsvector
  generated always as (to_tsvector('english', content)) stored;
create index code_chunks_fts_idx on code_chunks using gin (fts);

-- Metadata and project indexes
create index code_chunks_metadata_idx on code_chunks using gin (metadata);
create index code_chunks_project_idx on code_chunks (project_id);

-- User State
create table user_state (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  explored_concepts text[] default '{}',
  explored_files text[] default '{}',
  time_per_concept jsonb default '{}',
  understanding_level jsonb default '{}',
  exploration_path text[] default '{}',
  current_position integer default 0,
  insights_seen text[] default '{}',
  total_exploration_time integer default 0,
  last_active_at timestamptz default now(),
  created_at timestamptz default now()
);

-- Insights
create table insights (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  title text not null,
  category text not null,
  summary text not null,
  detail text not null,
  related_concept_keys text[] default '{}',
  related_file_paths text[] default '{}',
  priority integer default 5,
  requires_understanding text[] default '{}',
  created_at timestamptz default now()
);

-- Chat Messages
create table chat_messages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  role text not null,
  content text not null,
  context jsonb default '{}',
  created_at timestamptz default now()
);

-- Hybrid search function
create or replace function search_code_chunks(
  p_project_id uuid,
  query_text text,
  query_embedding extensions.vector(1536),
  match_threshold float default 0.3,
  match_count int default 10,
  filter_concept text default null
)
returns table (
  id bigint,
  file_path text,
  chunk_index integer,
  content text,
  context_summary text,
  metadata jsonb,
  similarity float,
  text_rank float
)
language sql
as $$
  select
    c.id,
    c.file_path,
    c.chunk_index,
    c.content,
    c.context_summary,
    c.metadata,
    1 - (c.embedding <=> query_embedding) as similarity,
    ts_rank(c.fts, websearch_to_tsquery('english', query_text)) as text_rank
  from code_chunks c
  where
    c.project_id = p_project_id
    and (
      c.embedding <=> query_embedding < 1 - match_threshold
      or c.fts @@ websearch_to_tsquery('english', query_text)
    )
    and (
      filter_concept is null
      or c.metadata->>'concept_id' = filter_concept
    )
  order by
    (1 - (c.embedding <=> query_embedding)) * 0.7
    + ts_rank(c.fts, websearch_to_tsquery('english', query_text)) * 0.3
    desc
  limit least(match_count, 50);
$$;
```

### Retrieval Flow

When the app needs to explain something (a concept, a file, a relationship, or answer a question):

1. **Generate query embedding** from the question/topic (OpenAI `text-embedding-3-small`)
2. **Call `search_code_chunks`** RPC via Supabase with the query embedding and optional concept filter
3. **Fallback:** If the RPC call fails, falls back to simple full-text search without embeddings
4. **Format retrieved chunks** as XML-tagged context for Claude
5. **Call Claude** with the retrieved context + the question + the user's understanding level

```typescript
// Actual retrieval implementation (server/rag/retriever.ts)
async function retrieveChunks(
  projectId: string,
  queryText: string,
  queryEmbedding: number[],
  matchCount: number = 10,
  filterConcept?: string
): Promise<RetrievedChunk[]> {
  const { data, error } = await supabase.rpc('search_code_chunks', {
    p_project_id: projectId,
    query_text: queryText,
    query_embedding: JSON.stringify(queryEmbedding),
    match_threshold: 0.3,
    match_count: matchCount,
    filter_concept: filterConcept || null,
  });

  if (error) {
    // Fallback: simple text search without embeddings
    const { data: fallbackData } = await supabase
      .from('code_chunks')
      .select('*')
      .eq('project_id', projectId)
      .textSearch('fts', queryText, { type: 'websearch' })
      .limit(matchCount);
    return (fallbackData || []) as RetrievedChunk[];
  }

  return (data || []) as RetrievedChunk[];
}
```

---

## Component 3: User Model

### What Is Tracked

| Signal | How Collected | What It Tells Us |
|--------|--------------|------------------|
| Concepts viewed | Click/tap on concept node | What they've seen |
| Time per concept | Timer from select to deselect | How much they engaged |
| Files opened | Click on file in inspector | Depth of exploration |
| Insights dismissed vs expanded | Click behavior on insight cards | What interests them |
| Questions asked | Chat input | What they don't understand |

### Understanding Level Estimation

For each concept, the user has an estimated understanding level based on time spent:

| Level | Criteria |
|-------|----------|
| `unseen` | Hasn't looked at it |
| `glanced` | Selected it briefly (<5 seconds) |
| `beginner` | Viewed it, read the explanation (5-30 seconds) |
| `intermediate` | Engaged more deeply (30-120 seconds) |
| `advanced` | Spent significant time (>120 seconds) |

The level determines which explanation variant to show (from Stage 4) and influences the proactive engine's decisions.

```javascript
// From src/hooks/useUserState.js
function estimateUnderstanding(conceptId, timeSpent) {
  if (timeSpent < 5) return 'glanced';
  if (timeSpent < 30) return 'beginner';
  if (timeSpent < 120) return 'intermediate';
  return 'advanced';
}
```

### State Persistence

User state updates are **debounced and sent to Supabase every 5 seconds** via `PATCH /api/user-state`. State is also flushed on component unmount.

---

## Component 4: Proactive Engine

This is the core differentiator. The proactive engine decides what the user should see next and drives the UI directly.

### How It Works

The frontend hook polls `POST /api/proactive` **every 15 seconds**. The server-side engine uses **purely deterministic rules** — no Claude calls — to decide the next UI action based on the user's current exploration state.

### Decision Rules (in priority order)

```
Rule 1: New user → highlight the suggested starting concept
Rule 2: Exploration path exists → suggest next concept in path
Rule 3: Spent 10-30s on current concept → suggest going deeper
Rule 4: On a concept → suggest a connected unseen concept
Rule 5: High-priority insight with prerequisites met → show insight card
Rule 6: Explored >70% of concepts → show progress summary
Default: Return "nothing" — user is engaged, don't interrupt
```

**Key design decision:** All proactive decisions are deterministic. This keeps latency low and costs at zero for this component. Claude is only used during the initial pipeline to generate the exploration path and insights — not at runtime.

### Actions & UI Integration

The proactive engine returns one of these actions, which map directly to Zustand store state:

| Action | UI Effect |
|--------|-----------|
| `highlight_concept` | Pulse a concept node on the graph |
| `show_insight` | Display a floating insight card |
| `suggest_connection` | Highlight an edge between concepts |
| `suggest_file` | Recommend a specific file to look at |
| `show_summary` | Show exploration progress card |
| `deepen_current` | Offer deeper explanation of current concept |
| `nothing` | No change |

```typescript
// Zustand store state driven by proactive engine
interface ProactiveUIState {
  pulsingNodeId: string | null;
  insightCard: InsightCard | null;
  connectionHighlight: string | null;
  suggestionBanner: string | null;
  explorationProgress: number;    // 0-1 completion
}
```

---

## Component 5: Chat (Fallback Layer)

### Design

Chat is secondary — a small input at the bottom-left of the screen, not a prominent chatbot. It has full RAG context and streams responses.

### How It Differs from a Generic Chatbot

1. **Full codebase context.** Every response is grounded in retrieved code chunks via hybrid search.
2. **Awareness of user state.** If the user asks "what does this do?" the chat knows what "this" refers to (the currently selected node).
3. **Adaptive language.** Uses the user's estimated understanding level for the relevant concept.
4. **Graph integration.** Chat responses can reference concepts via `[[concept:key]]` and files via `[[file:path]]`, which the frontend renders as clickable links.

### Chat API Flow

```
User types question
    ↓
Client sends: POST /api/chat { message, selectedNode, projectId }
    ↓
Server:
  1. Embed the question (OpenAI text-embedding-3-small)
  2. Retrieve relevant code chunks via hybrid search
     (filtered by selected concept if applicable)
  3. Build system prompt with:
     - User's understanding levels
     - Retrieved code context (XML-tagged chunks)
     - Current graph state (what's selected, what's explored)
  4. Stream Claude Sonnet response via SSE
    ↓
Client:
  - Renders streaming text in ChatBar
  - Parses [[concept:x]] and [[file:x]] references into clickable links
  - Updates user state (asked a question → deeper engagement)
```

---

## Data Flow: End to End

### Upload → First Visual

```
1. User drops ZIP file
2. Client: Extract files, detect imports, build file tree (~2s)
3. Client: POST /api/pipeline/start with file tree + contents
4. Server: Create project row in Supabase, return project ID
5. Client: Subscribe to SSE stream at /api/pipeline/:id/stream
6. Server: Run Stage 2 (sequential file analysis with 60s waits between batches)
7. Server: Update pipeline_progress → client sees "Analyzing files..."
8. Server: Complete Stage 3 (concept synthesis)
9. Server: Write concepts + edges to Supabase
10. Server: SSE sends "complete" → client fetches data from /api/pipeline/:id/data
11. Client: Load concepts, edges, files, insights → render graph in Explorer view
12. Server: Stages 4-7 continue in background, enriching data
```

### User Explores a Node

```
1. User clicks concept node on GraphCanvas
2. Client: Update Zustand state (selectedNode, start timer)
3. Client: Sync user state to Supabase (debounced, every 5s)
4. Client: Fetch explanation via POST /api/explain with user's understanding level
5. Server: RAG retrieval → Claude Sonnet streaming response → SSE to client
6. Client: Render explanation in InspectorPanel with streaming text
7. Client: InspectorPanel shows 3-level depth selector (beginner/intermediate/advanced)
8. Proactive engine: Next poll evaluates new state → may pulse next node or show insight
```

### User Asks a Question

```
1. User types in ChatBar input
2. Client: POST /api/chat with message + selectedNode + projectId
3. Server: Embed question → hybrid search (70% vector / 30% lexical) → retrieve chunks
4. Server: Stream Claude Sonnet response with full RAG context
5. Client: Render streaming response, parse [[concept:x]] and [[file:x]] as clickable links
6. Client: Update user state (engagement signal)
```

---

## File Structure

```
server/
├── index.ts                    # Hono app entry point (port 3007)
├── routes/
│   ├── pipeline.ts             # POST /start, GET /:id/stream, GET /:id/data
│   ├── chat.ts                 # POST /api/chat (streaming)
│   ├── explain.ts              # POST /api/explain (streaming)
│   ├── proactive.ts            # POST /api/proactive
│   └── user-state.ts           # PATCH /api/user-state
├── pipeline/
│   ├── orchestrator.ts         # Pipeline orchestration (stages 1-7)
│   ├── fileAnalysis.ts         # Stage 2: sequential file analysis (Haiku)
│   ├── conceptSynthesis.ts     # Stage 3: concept graph generation (Sonnet)
│   ├── depthMapping.ts         # Stage 4: multi-level explanations (Sonnet)
│   ├── insightGeneration.ts    # Stage 5: senior engineer insights (Sonnet)
│   ├── embedding.ts            # Stage 6: chunking + OpenAI embedding + indexing
│   └── proactiveSeeding.ts     # Stage 7: initial exploration path (Sonnet)
├── rag/
│   ├── chunker.ts              # Code chunking (~800 tokens, 10% overlap)
│   ├── embedder.ts             # OpenAI text-embedding-3-small client
│   └── retriever.ts            # Hybrid search (vector + full-text via Supabase RPC)
├── ai/
│   ├── claude.ts               # Anthropic SDK wrapper (streaming + structured via tool-use)
│   └── schemas.ts              # All JSON schemas for structured outputs
├── proactive/
│   └── engine.ts               # Deterministic proactive decision rules
└── db/
    └── supabase.ts             # Supabase client

src/                            # Frontend (React + Vite)
├── main.jsx                    # App entry point
├── App.jsx                     # Screen routing (landing → upload → processing → explorer)
├── hooks/
│   ├── useProactive.js         # Polls /api/proactive every 15s
│   ├── useSSE.js               # Generic SSE stream consumption
│   └── useUserState.js         # Track and sync user exploration state (debounced 5s)
├── store/
│   └── useStore.js             # Zustand store (screens, concepts, files, pipeline, proactive UI)
├── utils/
│   ├── claudeApi.js            # API client helpers (analyzeCodebase, explainFile, chatAboutCode)
│   ├── fileParser.js           # ZIP extraction, import detection, path resolution
│   ├── graphLayout.js          # D3 force-directed graph layout
│   └── canvasIcons.js          # Canvas rendering utilities for graph nodes
├── components/
│   ├── LandingPage.jsx         # Marketing landing page
│   ├── UploadScreen.jsx        # ZIP file upload
│   ├── ProcessingScreen.jsx    # 6-step pipeline progress visualization
│   ├── ExplorerView.jsx        # Main explorer layout (graph + panels)
│   ├── GraphCanvas.jsx         # D3 force-directed concept graph (Canvas)
│   ├── InspectorPanel.jsx      # Right sidebar: node details, 3-level explanations, file list
│   ├── ChatBar.jsx             # Bottom-left chat with streaming + clickable references
│   ├── InsightCard.jsx         # Floating insight cards (6 categories, color-coded)
│   ├── ExplorationProgress.jsx # Top banner: exploration % + suggestion text
│   ├── CodePanel.jsx           # Full file code viewer
│   ├── TopBar.jsx              # Navigation bar
│   └── Onboarding.jsx          # First-time user onboarding
├── components/landing/         # Landing page sections
│   ├── HeroSection.jsx
│   ├── FeaturesSection.jsx
│   ├── HowItWorks.jsx
│   ├── Pricing.jsx
│   └── ... (more landing sections)
└── data/
    ├── sampleData.js           # Demo/sample concept data
    └── heroGraphData.js        # Landing page hero graph data
```

---

## Cost Estimates

For a medium codebase (~100 files, ~50K lines):

| Stage | Model | Calls | Est. Cost |
|-------|-------|-------|-----------|
| Stage 2: File Analysis | claude-haiku-4-5 | ~7 batches of 15 | ~$0.10 |
| Stage 3: Concept Synthesis | claude-sonnet-4-6 | 1 | ~$0.09 |
| Stage 4: Depth Mapping | claude-sonnet-4-6 | 1 | ~$0.12 |
| Stage 5: Insights | claude-sonnet-4-6 | 1 | ~$0.06 |
| Stage 6: Embeddings | text-embedding-3-small | ~1 batch | ~$0.001 |
| Stage 7: Proactive seeding | claude-sonnet-4-6 | 1 | ~$0.03 |
| **Total ingestion** | | | **~$0.40** |
| Per chat message | claude-sonnet-4-6 | 1 | ~$0.015 |
| Per explanation | claude-sonnet-4-6 | 1 | ~$0.015 |
| Proactive engine | none (deterministic) | 0 | $0.00 |

---

## What This Does NOT Include (and Why)

- **Authentication.** Not needed for MVP. One user, one project at a time. Add Supabase Auth later when multi-user is needed.
- **File watching / incremental updates.** Re-upload the zip. Incremental analysis adds significant complexity for v1.
- **Collaboration.** Single-user understanding tool. Sharing can come later as a link with read-only view.
- **Custom embedding fine-tuning.** Off-the-shelf embeddings with contextual retrieval are good enough.
- **Caching layer (Redis).** Supabase is the cache. The data is already persisted. Add Redis only if query latency becomes a problem.
- **Supabase Realtime.** Pipeline progress uses SSE polling from the Hono server, not Supabase Realtime subscriptions. Simpler and avoids an extra dependency on the client.

---

## Implementation Order

1. **Database schema** — Supabase tables, pgvector, hybrid search function
2. **Server skeleton** — Hono server with route stubs, Vite proxy config
3. **Pipeline Stages 1-3** — Get the enriched concept graph generating
4. **Pipeline Stages 4-5** — Add depth and insights (runs in background)
5. **RAG (Stage 6)** — Chunking, OpenAI embedding, hybrid search
6. **Explain endpoint** — RAG-powered streaming explanations for nodes
7. **User state tracking** — Client-side hooks + Supabase persistence
8. **Proactive engine** — Deterministic rules + UI integration
9. **Chat** — RAG-powered streaming chat
10. **Pipeline Stage 7** — Proactive seeding (depends on proactive engine)
11. **Polish** — Streaming progress UI, error handling, edge cases
