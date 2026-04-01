# AI Architecture: Codebase Explorer

## Overview

This document defines the AI architecture that transforms Codebase Explorer from a single-shot concept generator into a proactive, adaptive codebase understanding system. The goal: a user uploads a zip, and the app guides them through their codebase without them ever needing to type a question.

### Current State

The app makes one Claude API call with ~20 file samples and import edges. It returns a flat concept graph (8-15 nodes) with descriptions. There is no persistence, no retrieval, no user modeling, and no proactive guidance. The frontend (React + Vite + Zustand + Canvas) is mature and well-built.

### Target State

A multi-stage pipeline extracts deep codebase structure. All code and explanations are stored with vector embeddings for accurate retrieval. A user model tracks exploration state and understanding. A proactive engine drives the UI — deciding what to show next, which nodes to highlight, and what insights to surface — before the user asks.

---

## Design Principles

1. **No frameworks.** Use Anthropic's SDK directly with their five composable patterns (prompt chaining, parallelization, orchestrator-workers, routing, evaluator-optimizer). No LangChain, no LangGraph.
2. **Structured outputs everywhere.** Every Claude call uses `output_config.format` with `json_schema` for guaranteed valid JSON. No regex parsing, no try/catch on malformed responses.
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
│  Supabase Realtime subscription for pipeline progress            │
└──────────────────────────┬───────────────────────────────────────┘
                           │ HTTPS / SSE
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                     API SERVER (Node.js + Hono)                  │
│                                                                   │
│  POST /api/pipeline/start     → Kick off ingestion pipeline      │
│  GET  /api/pipeline/:id/stream → SSE stream of pipeline progress │
│  POST /api/chat               → RAG-powered chat (streaming)     │
│  POST /api/proactive          → Get next proactive action        │
│  POST /api/explain            → Explain a specific node          │
│                                                                   │
│  Anthropic SDK (claude-sonnet-4-6)                               │
│  Supabase client (database + storage + vectors)                  │
│  Embedding client (voyage-3 or text-embedding-3-small)           │
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
│  Storage:                                                        │
│    uploaded-zips bucket                                           │
│                                                                   │
│  Realtime:                                                       │
│    Pipeline progress broadcasts                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Why Hono over Next.js or Cloudflare Workers

The existing app is Vite + React. Adding Next.js would mean migrating the entire frontend or running two separate frameworks — unnecessary complexity. Cloudflare Workers have execution time limits that complicate multi-minute pipelines.

**Hono** is the right choice:
- Lightweight (~14KB), runs on Node.js alongside the existing Vite dev server
- First-class SSE streaming support
- Can deploy to Cloudflare Workers, Vercel Edge, or plain Node.js later
- No framework lock-in, no frontend migration required
- Add it as `server/` directory alongside the existing `src/`

In development, Vite proxies `/api/*` to the Hono server. In production, both can run as a single Node.js process or be split into separate services.

---

## Component 1: Ingestion Pipeline

The pipeline transforms a zip file into a rich, queryable knowledge base. It runs as an async job — the client gets a job ID immediately and subscribes to progress updates via Supabase Realtime.

### Pipeline Stages

```
ZIP Upload
    │
    ▼
[Stage 1] File Extraction & Classification (client + server, ~2s)
    │
    ▼
[Stage 2] Parallel File Analysis (server, ~15-30s)
    │    ├── Batch 1: files 1-10  → Claude
    │    ├── Batch 2: files 11-20 → Claude
    │    └── Batch N: files N...  → Claude
    │
    ▼
[Stage 3] Concept Synthesis (server, ~5-10s)
    │    One Claude call with all file analyses
    │
    ▼
[Stage 4] Relationship & Depth Mapping (server, ~5-10s)
    │    ├── Concept relationship analysis  → Claude
    │    └── Multi-level explanations        → Claude (parallel)
    │
    ▼
[Stage 5] Insight Generation (server, ~5s)
    │    Senior engineer perspective → Claude
    │
    ▼
[Stage 6] Embedding & Indexing (server, ~10-20s)
    │    ├── Chunk all files with contextual descriptions
    │    ├── Generate embeddings (batch)
    │    └── Store in pgvector
    │
    ▼
[Stage 7] Proactive Queue Seeding (server, ~3s)
         Generate initial exploration path
```

**Total estimated time: 45-80 seconds** for a medium codebase (~100 files). The UI shows progressive results — the concept graph appears after Stage 3, and the user can start exploring while Stages 4-7 complete in the background.

### Stage 1: File Extraction & Classification

**Runs on:** Client (existing `fileParser.js`) + light server processing
**Input:** ZIP file
**Output:** File tree, file contents, import edges, language stats

This stage already exists. Enhancements:
- Classify files by role (component, utility, config, test, types, etc.) using filename patterns
- Detect framework (React, Express, Django, etc.) from package.json / requirements.txt / go.mod
- Compute file importance score based on: import count (how many files import it), file size, and role

```typescript
// New: file classification by pattern matching (no Claude call needed)
function classifyFile(path: string, content: string): FileRole {
  if (/\.(test|spec)\.(js|ts|jsx|tsx)$/.test(path)) return 'test';
  if (/\.(config|rc)\.(js|ts|json)$/.test(path)) return 'config';
  if (/(types|interfaces|models)\.(ts|d\.ts)$/.test(path)) return 'types';
  if (/components\//.test(path)) return 'component';
  if (/(utils?|helpers?|lib)\//.test(path)) return 'utility';
  if (/(routes?|api|controllers?)\//.test(path)) return 'api';
  if (/(middleware|hooks)\//.test(path)) return 'middleware';
  // ... more patterns
  return 'source';
}
```

### Stage 2: Parallel File Analysis

**Runs on:** Server (multiple Claude calls in parallel)
**Input:** All code files, classified and ranked by importance
**Output:** Per-file analysis objects stored in `files` table

**Why this stage exists:** The current single-call approach sends 20 file samples. A proper analysis needs to look at every file — but sending 100+ files in one prompt would blow the context window and reduce quality. Instead, we batch files and analyze them in parallel.

**Batching strategy:**
- Group files by concept proximity (files in the same directory or importing each other go together)
- Each batch gets 5-8 files plus the project-level context (framework, directory structure)
- Run up to 5 batches in parallel (stay within Anthropic rate limits)

```typescript
// Structured output schema for file analysis
const fileAnalysisSchema = {
  type: "object",
  properties: {
    files: {
      type: "array",
      items: {
        type: "object",
        properties: {
          path: { type: "string" },
          purpose: { type: "string" },           // One sentence, plain English
          concepts: {                              // What high-level ideas this file implements
            type: "array",
            items: { type: "string" }
          },
          key_exports: {                           // What this file provides to others
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                what_it_does: { type: "string" }   // Plain English
              },
              required: ["name", "what_it_does"]
            }
          },
          depends_on: {                            // Semantic dependencies (not just imports)
            type: "array",
            items: { type: "string" }              // File paths
          },
          complexity: {
            type: "string",
            enum: ["simple", "moderate", "complex"]
          },
          role: {
            type: "string",
            enum: ["entry_point", "core_logic", "data", "ui", "utility", "config", "test", "types"]
          }
        },
        required: ["path", "purpose", "concepts", "key_exports", "depends_on", "complexity", "role"]
      }
    }
  },
  required: ["files"]
};
```

### Stage 3: Concept Synthesis

**Runs on:** Server (single Claude call)
**Input:** All file analyses from Stage 2, file tree structure, framework detection
**Output:** Concept graph (nodes + edges) stored in `concepts` and `concept_edges` tables

**Why this is separate from Stage 2:** Concepts are emergent — they come from seeing all files together and understanding the patterns. The file analysis provides the raw material; synthesis is the creative step.

**Prompt design:** Give Claude all file analyses and ask it to identify the natural conceptual groupings. The prompt emphasizes:
- Concepts should be meaningful to non-technical users (not "utils" or "helpers")
- Each concept should have a clear metaphor or real-world analogy
- The number of concepts should scale with codebase complexity (5-20)
- Every file must belong to exactly one concept

```typescript
const conceptSynthesisSchema = {
  type: "object",
  properties: {
    concepts: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },              // e.g., "User Authentication"
          emoji: { type: "string" },
          color: { type: "string", enum: ["teal", "purple", "coral", "blue", "amber", "pink", "green", "gray"] },
          metaphor: { type: "string" },          // e.g., "Like a bouncer at a club"
          one_liner: { type: "string" },         // 10 words max
          explanation: { type: "string" },       // 2-3 sentences, plain English
          deep_explanation: { type: "string" },  // 2-3 paragraphs, more technical
          file_ids: { type: "array", items: { type: "string" } },
          importance: { type: "string", enum: ["critical", "important", "supporting"] }
        },
        required: ["id", "name", "emoji", "color", "metaphor", "one_liner", "explanation", "deep_explanation", "file_ids", "importance"]
      }
    },
    edges: {
      type: "array",
      items: {
        type: "object",
        properties: {
          source: { type: "string" },
          target: { type: "string" },
          relationship: { type: "string" },      // e.g., "sends user data to"
          strength: { type: "string", enum: ["strong", "moderate", "weak"] }
        },
        required: ["source", "target", "relationship", "strength"]
      }
    },
    suggested_starting_concept: { type: "string" },  // Where a new user should look first
    codebase_summary: { type: "string" }              // 2-3 sentences about the whole project
  },
  required: ["concepts", "edges", "suggested_starting_concept", "codebase_summary"]
};
```

**At this point, the concept graph renders in the UI.** The user sees nodes appearing and can start exploring. Stages 4-7 enrich the data in the background.

### Stage 4: Relationship & Depth Mapping (parallel)

**Runs on:** Server (2 parallel Claude calls)
**Input:** Concept graph + file analyses

**Call A — Relationship deep dive:** For each edge in the concept graph, generate a plain-English explanation of how the concepts interact, with specific file references.

**Call B — Multi-level explanations:** For each concept, generate explanations at three levels:
- **Beginner:** Uses only analogies and everyday language. No code terms.
- **Intermediate:** Mentions technical terms but explains them inline.
- **Advanced:** Assumes programming familiarity, references specific patterns and libraries.

These levels power the adaptive explanation system — the user model determines which level to show.

### Stage 5: Insight Generation

**Runs on:** Server (single Claude call)
**Input:** Full analysis from Stages 2-4
**Output:** 10-20 proactive insights stored in `insights` table

The prompt asks Claude to think like a senior engineer doing a code review of an unfamiliar codebase. What would they notice first? What would concern them? What's clever? What's risky?

```typescript
const insightSchema = {
  type: "object",
  properties: {
    insights: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },             // e.g., "No error handling in API calls"
          category: { type: "string", enum: ["architecture", "risk", "pattern", "praise", "suggestion", "complexity"] },
          summary: { type: "string" },           // 1-2 sentences
          detail: { type: "string" },            // Full explanation
          related_concept_ids: { type: "array", items: { type: "string" } },
          related_file_paths: { type: "array", items: { type: "string" } },
          priority: { type: "integer" },         // 1-10, higher = show sooner
          requires_understanding: {               // Concepts user should see first
            type: "array", items: { type: "string" }
          }
        },
        required: ["title", "category", "summary", "detail", "related_concept_ids", "related_file_paths", "priority", "requires_understanding"]
      }
    }
  },
  required: ["insights"]
};
```

### Stage 6: Embedding & Indexing

**Runs on:** Server (embedding API calls + Supabase inserts)
**Input:** All file contents + contextual descriptions from earlier stages
**Output:** Chunked, embedded code stored in `code_chunks` table with HNSW-indexed vectors

**Chunking strategy:**
- Split each file into ~800-token chunks with 10% overlap
- For each chunk, generate a contextual prefix using the file's analysis from Stage 2: `"This chunk is from {file.path}, which {file.purpose}. It is part of the {concept.name} concept."`
- Embed the contextualized chunks (context prefix + code)

**Embedding model choice:** `text-embedding-3-small` (1536 dimensions).

Why not Voyage AI:
- One fewer API dependency to manage
- OpenAI's embedding API is battle-tested, fast, and cheap ($0.02/1M tokens)
- The quality difference is marginal when using contextual retrieval (which compensates for embedding weaknesses)
- Voyage AI's advantage is most pronounced without contextual retrieval

**Hybrid search:** The `code_chunks` table includes both vector embeddings and a full-text search (`tsvector`) column. At query time, both are searched and results are fused with a 70/30 weighting (semantic/lexical). This catches cases where the user asks about a specific function name (lexical match) vs. a conceptual question (semantic match).

### Stage 7: Proactive Queue Seeding

**Runs on:** Server (single Claude call)
**Input:** Concept graph, insights, suggested starting concept
**Output:** Initial exploration path stored in `user_state`

Generates an ordered sequence of "exploration steps" — what the user should see first, second, third. This isn't a rigid tour; the proactive engine (Component 4) adjusts the path in real-time based on what the user actually does. But having a starting path means the app can guide the user from the moment the graph loads.

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
  framework text,                              -- e.g., "React + Express"
  language text,                               -- primary language
  file_count integer,
  summary text,                                -- codebase_summary from Stage 3
  pipeline_status text default 'pending',      -- pending, processing, stage_N, complete, failed
  pipeline_progress jsonb default '{}',        -- { stage: 3, total_stages: 7, message: "..." }
  created_at timestamptz default now()
);

-- Files (one row per code file)
create table files (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  path text not null,
  name text not null,
  content text,
  analysis jsonb,                              -- Stage 2 output for this file
  concept_id text,                             -- which concept this file belongs to
  role text,                                   -- entry_point, core_logic, ui, etc.
  importance_score float default 0,
  created_at timestamptz default now(),
  unique(project_id, path)
);

-- Concepts
create table concepts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  concept_key text not null,                   -- short key like "auth"
  name text not null,
  emoji text,
  color text,
  metaphor text,
  one_liner text,
  explanation text,                            -- default level explanation
  deep_explanation text,
  beginner_explanation text,                   -- Stage 4 level explanations
  intermediate_explanation text,
  advanced_explanation text,
  importance text,                             -- critical, important, supporting
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
  explanation text,                            -- Stage 4 deep relationship explanation
  created_at timestamptz default now()
);

-- Code Chunks (for RAG)
create table code_chunks (
  id bigint primary key generated always as identity,
  project_id uuid references projects(id) on delete cascade,
  file_path text not null,
  chunk_index integer not null,                -- position within file
  content text not null,                       -- raw code chunk
  context_summary text,                        -- contextual prefix
  metadata jsonb default '{}',                 -- { concept_id, file_role, language, line_start, line_end }
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

-- Metadata index for filtered queries (e.g., search within a concept)
create index code_chunks_metadata_idx on code_chunks using gin (metadata);
create index code_chunks_project_idx on code_chunks (project_id);

-- User State
create table user_state (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  explored_concepts text[] default '{}',       -- concept keys the user has viewed
  explored_files text[] default '{}',          -- file paths the user has viewed
  time_per_concept jsonb default '{}',         -- { "auth": 45, "database": 12 } seconds
  understanding_level jsonb default '{}',      -- { "auth": "intermediate", "database": "beginner" }
  exploration_path text[] default '{}',        -- ordered concept keys to explore
  current_position integer default 0,          -- index in exploration_path
  insights_seen text[] default '{}',           -- insight IDs already shown
  total_exploration_time integer default 0,    -- seconds
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
  requires_understanding text[] default '{}',  -- concepts user should know first
  created_at timestamptz default now()
);

-- Chat Messages
create table chat_messages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  role text not null,                          -- user, assistant
  content text not null,
  context jsonb default '{}',                  -- { selected_node, retrieved_chunks }
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

1. **Generate query embedding** from the question/topic
2. **Call `search_code_chunks`** with the query embedding and optional concept filter
3. **Format retrieved chunks** as XML-tagged context for Claude
4. **Call Claude** with the retrieved context + the question + the user's understanding level

```typescript
async function explainWithRAG(
  projectId: string,
  question: string,
  userLevel: 'beginner' | 'intermediate' | 'advanced',
  conceptFilter?: string
): Promise<ReadableStream> {
  // 1. Embed the question
  const queryEmbedding = await embed(question);

  // 2. Retrieve relevant code chunks
  const { data: chunks } = await supabase.rpc('search_code_chunks', {
    p_project_id: projectId,
    query_text: question,
    query_embedding: queryEmbedding,
    match_count: 10,
    filter_concept: conceptFilter
  });

  // 3. Build context
  const context = chunks.map((c, i) =>
    `<chunk index="${i + 1}" file="${c.file_path}" lines="${c.metadata.line_start}-${c.metadata.line_end}">
${c.context_summary}

${c.content}
</chunk>`
  ).join('\n');

  // 4. Stream Claude response
  return anthropic.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: `You are explaining code to someone at a ${userLevel} level.
Reference specific files and line numbers from the provided code.
Never make up code that doesn't exist in the codebase.
Be concise and use plain English.`,
    messages: [{
      role: 'user',
      content: `<codebase_context>\n${context}\n</codebase_context>\n\n${question}`
    }]
  });
}
```

---

## Component 3: User Model

### What We Track

| Signal | How Collected | What It Tells Us |
|--------|--------------|------------------|
| Concepts viewed | Click/tap on concept node | What they've seen |
| Time per concept | Timer from select to deselect | How much they engaged |
| Files opened | Click on file in inspector | Depth of exploration |
| Code panel time | Timer while code panel is open | Whether they read code or just glanced |
| Insights dismissed vs expanded | Click behavior on insight cards | What interests them |
| Questions asked | Chat input | What they don't understand |
| Explanation level requested | "Explain simpler" / "More detail" buttons | Their comfort level |

### Understanding Level Estimation

For each concept, the user has an estimated understanding level:

- **unseen** — hasn't looked at it
- **glanced** — selected it briefly (<5 seconds)
- **beginner** — viewed it, read the explanation (5-30 seconds)
- **intermediate** — explored files within it, or asked questions about it
- **advanced** — spent significant time, viewed code, explored connections

The level determines which explanation variant to show (from Stage 4) and influences the proactive engine's decisions.

```typescript
function estimateUnderstanding(
  concept: string,
  state: UserState
): 'unseen' | 'glanced' | 'beginner' | 'intermediate' | 'advanced' {
  if (!state.explored_concepts.includes(concept)) return 'unseen';

  const timeSpent = state.time_per_concept[concept] || 0;
  const filesViewed = state.explored_files.filter(f =>
    getFileConcept(f) === concept
  ).length;
  const totalFiles = getConceptFileCount(concept);
  const fileRatio = filesViewed / totalFiles;

  if (timeSpent < 5) return 'glanced';
  if (timeSpent < 30 && fileRatio < 0.2) return 'beginner';
  if (timeSpent < 120 || fileRatio < 0.5) return 'intermediate';
  return 'advanced';
}
```

### State Updates

User state updates are batched and sent to Supabase every 5 seconds (or on navigation). This avoids flooding the database with writes on every mouse move.

```typescript
// Client-side: debounced state sync
const syncUserState = debounce(async (state: Partial<UserState>) => {
  await fetch('/api/user-state', {
    method: 'PATCH',
    body: JSON.stringify(state)
  });
}, 5000);
```

---

## Component 4: Proactive Engine

This is the core differentiator. The proactive engine decides what the user should see next and drives the UI directly.

### How It Works

The proactive engine runs a Claude call every time the user's context changes meaningfully (selects a new concept, finishes reading an explanation, dismisses an insight). It takes the full user state and returns a UI action.

```typescript
const proactiveActionSchema = {
  type: "object",
  properties: {
    action: {
      type: "string",
      enum: [
        "highlight_concept",    // Pulse a concept node on the graph
        "show_insight",         // Display an insight card
        "suggest_connection",   // Highlight an edge and explain it
        "suggest_file",         // Recommend a specific file to look at
        "show_summary",         // Show a progress/summary card
        "deepen_current",       // Offer deeper explanation of current concept
        "nothing"               // User is engaged, don't interrupt
      ]
    },
    target_id: { type: "string" },             // concept key, file path, edge id, or insight id
    reason: { type: "string" },                // Why this action (for debugging, not shown to user)
    message: { type: "string" },               // What to show the user (if applicable)
    priority: { type: "string", enum: ["low", "medium", "high"] }
  },
  required: ["action", "reason", "priority"]
};
```

### Decision Logic

The proactive engine does NOT use Claude for every decision. Most decisions are deterministic:

```typescript
function getNextAction(state: UserState, project: Project): ProactiveAction {
  // Rule 1: If user just arrived, guide them to the starting concept
  if (state.explored_concepts.length === 0) {
    return {
      action: 'highlight_concept',
      target_id: project.suggested_starting_concept,
      message: `Start here — this is the heart of the app`,
      priority: 'high'
    };
  }

  // Rule 2: If user has been on one concept for a while, suggest going deeper
  if (currentConceptTime > 30 && currentLevel === 'beginner') {
    return {
      action: 'deepen_current',
      target_id: currentConcept,
      message: `Want to see the actual files that make this work?`,
      priority: 'medium'
    };
  }

  // Rule 3: If user has explored a concept, suggest a connected one they haven't seen
  const unseenConnections = getConnectedConcepts(currentConcept)
    .filter(c => !state.explored_concepts.includes(c));
  if (unseenConnections.length > 0) {
    return {
      action: 'suggest_connection',
      target_id: unseenConnections[0],
      message: `This connects to ${getConceptName(unseenConnections[0])} — ${getEdgeLabel(currentConcept, unseenConnections[0])}`,
      priority: 'medium'
    };
  }

  // Rule 4: If there's a high-priority insight whose prerequisites are met
  const readyInsight = getNextInsight(state);
  if (readyInsight) {
    return {
      action: 'show_insight',
      target_id: readyInsight.id,
      message: readyInsight.summary,
      priority: readyInsight.priority > 7 ? 'high' : 'medium'
    };
  }

  // Rule 5: If most concepts explored, show progress summary
  const explorationPercent = state.explored_concepts.length / project.concepts.length;
  if (explorationPercent > 0.7 && !state.insights_seen.includes('progress_summary')) {
    return {
      action: 'show_summary',
      message: `You've explored ${Math.round(explorationPercent * 100)}% of the codebase`,
      priority: 'low'
    };
  }

  // Rule 6: Use Claude for complex decisions (fallback)
  // This only fires when the deterministic rules don't have a clear answer
  return await getClaudeProactiveDecision(state, project);
}
```

**Key design decision:** Deterministic rules handle 80% of cases. Claude is only called for genuinely ambiguous situations (e.g., "the user has explored auth and database but skipped the API layer — should I nudge them toward it or let them continue?"). This keeps latency low and costs manageable.

### UI Integration

The proactive engine's output maps directly to UI actions in the Zustand store:

```typescript
// Store actions driven by proactive engine
interface ProactiveUIState {
  pulsingNodeId: string | null;          // Which node glows/pulses
  insightCard: InsightCard | null;       // Floating insight card
  connectionHighlight: string | null;    // Highlighted edge
  suggestionBanner: string | null;       // Bottom suggestion text
  explorationProgress: number;           // 0-1 completion
}
```

The `GraphCanvas` already supports visual effects (glow, pulse, color changes). The proactive engine simply sets which node should pulse, and the canvas responds.

---

## Component 5: Chat (Fallback Layer)

### Design

Chat is secondary — a small input at the bottom of the screen, not a prominent chatbot. It has full RAG context and streams responses.

### How It Differs from a Generic Chatbot

1. **Full codebase context.** Every response is grounded in retrieved code chunks.
2. **Awareness of user state.** If the user asks "what does this do?" the chat knows what "this" refers to (the currently selected node).
3. **Adaptive language.** Uses the user's estimated understanding level for the relevant concept.
4. **Graph integration.** If the chat mentions a concept or file, it can highlight it on the graph.

### Chat API Flow

```
User types question
    ↓
Client sends: { message, selectedNode, projectId }
    ↓
Server:
  1. Embed the question
  2. Retrieve relevant code chunks (filtered by selected concept if applicable)
  3. Build system prompt with:
     - User's understanding levels
     - Retrieved code context
     - Current graph state (what's selected, what's explored)
  4. Stream Claude response via SSE
    ↓
Client:
  - Renders streaming text in chat panel
  - Parses any file/concept references and makes them clickable
  - Updates user state (asked a question → deeper engagement)
```

### System Prompt Structure

```typescript
const chatSystemPrompt = `You are a guide helping someone understand their codebase.

<user_context>
Understanding levels: ${JSON.stringify(userState.understanding_level)}
Currently viewing: ${selectedNode?.name || 'overview'}
Concepts explored: ${userState.explored_concepts.join(', ')}
</user_context>

<codebase_context>
${formattedChunks}
</codebase_context>

Rules:
- Reference specific files and line numbers from the codebase context
- Match your language to the user's understanding level for the relevant concept
- If they ask about something you don't have code context for, say so
- Keep responses under 200 words unless they ask for more detail
- When mentioning a concept, wrap it in [[concept:concept_key]] for the UI to make clickable
- When mentioning a file, wrap it in [[file:path]] for the UI to make clickable`;
```

---

## Data Flow: End to End

### Upload → First Visual (target: <10 seconds to first concept node)

```
1. User drops ZIP file
2. Client: Extract files, classify, detect framework (~2s)
3. Client: POST /api/pipeline/start with file tree + contents
4. Server: Create project row, return project ID
5. Client: Subscribe to Supabase Realtime on projects table
6. Server: Start Stage 2 (parallel file analysis)
7. Server: Update pipeline_progress → client sees "Analyzing files..."
8. Server: Complete Stage 3 (concept synthesis)
9. Server: Write concepts + edges to Supabase
10. Client: Realtime update triggers → load concepts from Supabase → render graph
    (User sees the concept graph ~30-40s after upload)
11. Server: Continues Stages 4-7 in background
12. Client: Concepts enrich as Stages 4-5 complete (explanations deepen, insights appear)
```

### User Explores a Node

```
1. User clicks concept node
2. Client: Update Zustand state (selectedNode, start timer)
3. Client: Sync user state to Supabase (debounced)
4. Client: Fetch explanation via /api/explain with user's understanding level
5. Server: RAG retrieval → Claude streaming response → SSE to client
6. Client: Render explanation in InspectorPanel with streaming text
7. Proactive engine: Evaluate next action based on new state
8. Client: Apply proactive action (pulse next node, show insight, etc.)
```

### User Asks a Question

```
1. User types in chat input
2. Client: POST /api/chat with message + context
3. Server: Embed question → hybrid search → retrieve chunks
4. Server: Stream Claude response with full context
5. Client: Render streaming response, parse [[concept:x]] and [[file:x]] references
6. Client: Update user state (engagement signal)
```

---

## File Structure (New)

```
server/
├── index.ts                    # Hono app entry point
├── routes/
│   ├── pipeline.ts             # POST /start, GET /:id/stream
│   ├── chat.ts                 # POST /api/chat
│   ├── explain.ts              # POST /api/explain
│   ├── proactive.ts            # POST /api/proactive
│   └── user-state.ts           # PATCH /api/user-state
├── pipeline/
│   ├── orchestrator.ts         # Pipeline orchestration (stages 1-7)
│   ├── fileAnalysis.ts         # Stage 2: parallel file analysis
│   ├── conceptSynthesis.ts     # Stage 3: concept graph generation
│   ├── depthMapping.ts         # Stage 4: relationships + multi-level explanations
│   ├── insightGeneration.ts    # Stage 5: senior engineer insights
│   ├── embedding.ts            # Stage 6: chunking + embedding + indexing
│   └── proactiveSeeding.ts     # Stage 7: initial exploration path
├── rag/
│   ├── chunker.ts              # Code chunking with contextual descriptions
│   ├── embedder.ts             # Embedding API client
│   └── retriever.ts            # Hybrid search (vector + full-text)
├── ai/
│   ├── claude.ts               # Anthropic SDK wrapper (streaming + structured)
│   └── schemas.ts              # All JSON schemas for structured outputs
├── proactive/
│   ├── engine.ts               # Proactive decision engine
│   └── rules.ts                # Deterministic rules (80% of decisions)
├── db/
│   ├── supabase.ts             # Supabase client
│   └── migrations/
│       └── 001_initial.sql     # Full schema from this document
└── utils/
    └── sse.ts                  # SSE helper for Hono streaming

src/                            # Existing frontend (minimal changes)
├── hooks/
│   ├── useProactive.js         # Subscribe to proactive engine actions
│   ├── useSSE.js               # Generic SSE consumption hook
│   └── useUserState.js         # Track and sync user exploration state
├── store/
│   └── useStore.js             # Add: proactive UI state, pipeline state
└── components/
    ├── InsightCard.jsx         # New: floating insight cards
    ├── ExplorationProgress.jsx # New: progress indicator
    └── (existing components — enhanced, not replaced)
```

---

## Cost Estimates

For a medium codebase (~100 files, ~50K lines):

| Stage | Claude Calls | Est. Tokens | Est. Cost |
|-------|-------------|-------------|-----------|
| Stage 2: File Analysis | 10-15 (parallel) | ~200K total | ~$0.60 |
| Stage 3: Concept Synthesis | 1 | ~30K | ~$0.09 |
| Stage 4: Depth Mapping | 2 (parallel) | ~40K total | ~$0.12 |
| Stage 5: Insights | 1 | ~20K | ~$0.06 |
| Stage 6: Contextual descriptions | 10-15 (Haiku) | ~100K total | ~$0.03 |
| Stage 6: Embeddings | 1 batch | ~50K tokens | ~$0.001 |
| Stage 7: Proactive seeding | 1 | ~10K | ~$0.03 |
| **Total ingestion** | | | **~$0.93** |
| Per chat message | 1 | ~5K | ~$0.015 |
| Per explanation | 1 | ~5K | ~$0.015 |
| Per proactive Claude call | 1 | ~3K | ~$0.009 |

Using `claude-sonnet-4-6` for all main calls, `claude-haiku-4-5` for contextual chunk descriptions.

---

## What This Does NOT Include (and Why)

- **Authentication.** Not needed for MVP. One user, one project at a time. Add Supabase Auth later when multi-user is needed.
- **File watching / incremental updates.** Re-upload the zip. Incremental analysis is a real feature but adds significant complexity for v1.
- **Collaboration.** Single-user understanding tool. Sharing can come later as a link with read-only view.
- **Custom embedding fine-tuning.** Off-the-shelf embeddings with contextual retrieval are good enough. Fine-tuning is a premature optimization.
- **Caching layer (Redis).** Supabase is the cache. The data is already persisted. Add Redis only if query latency becomes a problem.

---

## Implementation Order

1. **Database schema** — Set up Supabase tables and functions
2. **Server skeleton** — Hono server with route stubs, Vite proxy config
3. **Pipeline Stages 1-3** — Get the enriched concept graph generating
4. **Pipeline Stages 4-5** — Add depth and insights (runs in background)
5. **RAG (Stage 6)** — Chunking, embedding, hybrid search
6. **Explain endpoint** — RAG-powered explanations for nodes
7. **User state tracking** — Client-side hooks + Supabase persistence
8. **Proactive engine** — Deterministic rules + UI integration
9. **Chat** — RAG-powered streaming chat
10. **Pipeline Stage 7** — Proactive seeding (depends on proactive engine)
11. **Polish** — Streaming progress UI, error handling, edge cases
