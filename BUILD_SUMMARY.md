# Build Summary

## What Was Built

A full-stack AI-powered codebase exploration tool that takes a zip file of source code, analyzes it with Claude and OpenAI embeddings, and presents an interactive concept map with RAG-powered explanations, chat, and proactive guidance.

### Architecture

- **Frontend**: React + Vite + Tailwind + Zustand + Canvas (d3-force graph layout)
- **Backend**: Hono (Node.js) server with SSE streaming
- **Database**: Supabase (PostgreSQL + pgvector)
- **AI**: Claude (claude-sonnet-4-6) for analysis/chat, OpenAI text-embedding-3-small for embeddings

### 7-Stage Ingestion Pipeline

1. **File Classification** — Detects framework, language, and file roles (ui, api, config, test, etc.)
2. **Parallel File Analysis** — Claude analyzes each file for purpose, key exports, dependencies, complexity
3. **Concept Synthesis** — Claude groups files into high-level concepts with metaphors, colors, and relationships
4. **Depth Mapping** — Multi-level explanations (beginner/intermediate/advanced) for each concept
5. **Insight Generation** — Architecture patterns, risks, praise, complexity insights
6. **Embedding & Indexing** — Chunks code, generates embeddings, stores for hybrid search (vector 70% + full-text 30%)
7. **Proactive Seeding** — Generates exploration paths and initial insights for guided discovery

### Frontend Features

- **Upload Screen** — Drag-and-drop zip upload with demo mode fallback
- **Processing Screen** — Animated progress through pipeline stages via SSE
- **Explorer View** — Interactive concept map (Canvas-rendered, d3-force layout)
  - Concept nodes (large, colored) and file nodes (small, grouped by concept)
  - Click to inspect concepts/files in the Inspector Panel
  - Pulsing node effects from proactive engine
- **Inspector Panel** — Concept/file details, pre-generated explanations, related connections
- **Code Panel** — Full source code viewer with syntax highlighting + AI walkthrough + in-file chat
- **Chat Bar** — RAG-powered streaming chat with clickable concept/file references
- **Insight Cards** — Floating insight popups from proactive engine
- **Exploration Progress** — Progress bar + suggestion banners
- **Onboarding** — First-time user guided tour

### Backend Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/api/health` | GET | Health check |
| `/api/pipeline/start` | POST | Start ingestion pipeline |
| `/api/pipeline/:id/stream` | GET | SSE stream of pipeline progress |
| `/api/pipeline/:id/data` | GET | Get all project data (concepts, edges, files, insights) |
| `/api/pipeline/:id/file-content` | GET | Get source code for a specific file |
| `/api/explain` | POST | Level-adaptive explanations (pre-generated or RAG streaming) |
| `/api/chat` | POST | RAG-powered streaming chat |
| `/api/proactive` | POST | Get next proactive action |
| `/api/user-state` | PATCH | Update user exploration state |
| `/api/user-state/:projectId` | GET | Get user state |

### Database Tables (8)

`projects`, `files`, `concepts`, `concept_edges`, `code_chunks` (with pgvector), `user_state`, `insights`, `chat_messages`

## What Is Working

- Full pipeline runs end-to-end (tested with 3-file JS project: 3 concepts, 2 edges, 12 insights, status: complete)
- Frontend builds successfully (Vite v8)
- All API endpoints respond correctly
- File content endpoint serves real source code to CodePanel
- User state auto-created on project load
- SSE streaming works for pipeline progress, chat, and explain endpoints
- Demo mode works without backend (sample data)
- Concept graph renders with d3-force layout
- Inspector panel shows pre-generated multi-level explanations
- Chat persists messages to database

## How to Run

```bash
# Prerequisites: Node.js 22+ (use nvm for WSL), Supabase project with migration applied

# Install dependencies
npm install

# Set environment variables in .env:
# ANTHROPIC_API_KEY, OPENAI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY
# VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY

# Run database migration (one-time, via Supabase MCP or SQL editor)
# See server/db/migrations/001_initial.sql

# Start both server and frontend
npm run dev:all

# Or separately:
npm run dev:server  # Hono server on port 3007
npm run dev         # Vite dev server on port 5173 (proxies /api to 3007)
```

## What Needs Manual Steps

1. **Database migration** — Run `server/db/migrations/001_initial.sql` against your Supabase project. This was done via the Supabase MCP `execute_sql` tool during development. Tables, indexes, pgvector extension, and hybrid search function all need to exist.

2. **API keys** — Set `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY` in `.env`.

3. **Port conflicts** — If port 3007 is occupied (common in WSL2 with stale Windows Node processes), change the port in `server/index.ts` and `vite.config.js`.

## What Was Stubbed or Skipped

- **Authentication** — No user auth. Single anonymous user per project. user_state is keyed by project_id only.
- **File upload storage** — Uploaded file contents are stored directly in the `files` table. No S3/blob storage.
- **Rate limiting** — No rate limiting on API endpoints.
- **Production deployment** — No Dockerfile, no deployment config. Development-only setup.
- **Import graph visualization** — File import edges are extracted client-side but not used in the graph visualization (concept edges are used instead).
- **Proactive engine Claude fallback** — The 6 deterministic rules handle all cases; the Claude fallback path in the engine exists but is unlikely to be triggered with current rule coverage.

## File Inventory

### Server (18 files)
```
server/index.ts                          — Hono server entry point
server/db/supabase.ts                    — Supabase client
server/db/migrations/001_initial.sql     — Database schema
server/ai/claude.ts                      — Claude API wrapper (structured + streaming)
server/ai/schemas.ts                     — JSON schemas for Claude structured output
server/routes/pipeline.ts                — Pipeline start/stream/data/file-content
server/routes/chat.ts                    — RAG chat with streaming
server/routes/explain.ts                 — Level-adaptive explanations
server/routes/proactive.ts               — Proactive action endpoint
server/routes/user-state.ts              — User state CRUD
server/pipeline/orchestrator.ts          — 7-stage pipeline orchestrator
server/pipeline/fileAnalysis.ts          — Stage 2: parallel file analysis
server/pipeline/conceptSynthesis.ts      — Stage 3: concept synthesis
server/pipeline/depthMapping.ts          — Stage 4: multi-level explanations
server/pipeline/insightGeneration.ts     — Stage 5: insight generation
server/pipeline/embedding.ts             — Stage 6: chunking + embedding
server/pipeline/proactiveSeeding.ts      — Stage 7: exploration path
server/rag/chunker.ts                    — ~800 token code chunker
server/rag/embedder.ts                   — OpenAI embedding wrapper
server/rag/retriever.ts                  — Hybrid search (vector + full-text)
server/proactive/engine.ts               — 6 deterministic rules + Claude fallback
```

### Frontend (15 files)
```
src/App.jsx                              — App root with screen routing
src/store/useStore.js                    — Zustand store (all app state)
src/data/sampleData.js                   — Demo mode sample data
src/utils/fileParser.js                  — Zip parsing + import extraction
src/hooks/useSSE.js                      — Generic SSE stream consumer
src/hooks/useUserState.js                — Exploration tracking with sync
src/hooks/useProactive.js                — Proactive engine polling
src/components/LandingPage.jsx           — Landing page
src/components/UploadScreen.jsx          — Upload + demo launcher
src/components/ProcessingScreen.jsx      — Pipeline progress animation
src/components/ExplorerView.jsx          — Explorer layout container
src/components/GraphCanvas.jsx           — Canvas graph visualization
src/components/InspectorPanel.jsx        — Concept/file detail panel
src/components/CodePanel.jsx             — Code viewer + walkthrough + chat
src/components/ChatBar.jsx               — RAG chat bar
src/components/TopBar.jsx                — Top navigation bar
src/components/Onboarding.jsx            — First-time onboarding
src/components/InsightCard.jsx           — Floating insight popups
src/components/ExplorationProgress.jsx   — Progress bar + suggestions
```
