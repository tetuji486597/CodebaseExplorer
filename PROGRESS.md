# Build Progress

## Step 1 complete — Database schema
What was built: Full SQL migration with 8 tables (projects, files, concepts, concept_edges, code_chunks, user_state, insights, chat_messages), pgvector extension, HNSW index, full-text search, and hybrid search function.
Files created or modified: `server/db/migrations/001_initial.sql`
Decisions made: Migration executed successfully via Supabase MCP execute_sql tool.
What step 2 needs to know: All 8 tables exist and are ready.

## Step 2 complete — Server skeleton
What was built: Hono server with all route stubs (pipeline, chat, explain, proactive, user-state), Supabase client, Claude AI wrapper (structured + streaming), all JSON schemas, RAG modules (chunker, embedder, retriever), proactive engine, pipeline orchestrator with all 7 stages, Vite proxy config.
Files created or modified: 18 files in server/, vite.config.js updated with /api proxy, package.json updated with dev:server and dev:all scripts.
Decisions made: Used tsx for TypeScript execution in dev. concurrently for running Vite + Hono together. All pipeline stages have real implementations (not just stubs).
What step 3 needs to know: Server runs on port 3005, health check works. All pipeline stages are implemented.

## Step 3 complete — Pipeline Stages 1-3
What was built: Full pipeline working end-to-end. Stage 1 (file classification), Stage 2 (parallel file analysis with Claude), Stage 3 (concept synthesis) all operational. Fixed model ID (claude-sonnet-4-6), fixed response normalization (Claude returns varying field names), added defensive array handling.
Files created or modified: `server/ai/claude.ts` (model fix, robust JSON extraction), `server/pipeline/conceptSynthesis.ts` (field name normalization), `server/pipeline/depthMapping.ts` (defensive array), `server/pipeline/embedding.ts` (defensive array)
Decisions made: Used claude-sonnet-4-6 for main model (claude-sonnet-4-5-20251001 doesn't exist). Added response normalization layer to handle Claude's varying JSON field names (label vs name, files vs file_ids, from/to vs source/target).
What step 4 needs to know: Pipeline completes all 7 stages. Test: 3 concepts, 2 edges, 12 insights generated for a 3-file JS project. Frontend UploadScreen already wired to pipeline endpoint.

## Step 4 complete — Pipeline Stages 4-5
What was built: Stages 4 (depth mapping - multi-level explanations + relationship explanations) and 5 (insight generation) already implemented in Step 2 and verified working in Step 3's end-to-end test. 12 insights generated, multi-level explanations stored.
Files created or modified: No new changes needed — already working.
Decisions made: Stages 4-5 run in parallel via Promise.all in the orchestrator.
What step 5 needs to know: All pipeline data (concepts, edges, insights, explanations) are in Supabase and retrievable via /api/pipeline/:id/data.

## Step 5 complete — RAG (Stage 6)
What was built: Chunking, embedding via OpenAI text-embedding-3-small, and hybrid search (vector + full-text) already implemented and verified working. Chunks stored in code_chunks table with embeddings. Hybrid search function search_code_chunks created in database.
Files created or modified: No new changes needed — already working.
Decisions made: Used text-embedding-3-small with 1536 dimensions as specified.
What step 6 needs to know: RAG retrieval is operational. The explain and chat routes already use it.

## Step 6 complete — Explain endpoint
What was built: POST /api/explain serves level-adaptive explanations. For concepts: returns pre-generated beginner/intermediate/advanced explanations from depth mapping. Falls back to RAG-powered streaming via SSE if no pre-generated explanation exists. For files: always uses RAG + Claude streaming. Frontend InspectorPanel and CodePanel both consume this endpoint, handling both JSON and SSE responses.
Files created or modified: `server/routes/explain.ts` (already working from Step 2), `src/components/InspectorPanel.jsx` (real backend integration), `src/components/CodePanel.jsx` (real backend + file content fetch)
Decisions made: Pre-generated explanations served as JSON for instant display; RAG fallback uses SSE streaming for longer Claude responses.
What step 7 needs to know: Explain endpoint fully operational for both concepts and files.

## Step 7 complete — User state tracking
What was built: `src/hooks/useUserState.js` tracks concept view time, explored concepts/files, and syncs to backend every 5 seconds via PATCH /api/user-state. Server route does upsert (creates user_state row on first sync, updates thereafter). `estimateLevel()` function returns unseen/glanced/beginner/intermediate/advanced based on time spent on a concept. Auto-creates user_state row when loading project data.
Files created or modified: `src/hooks/useUserState.js` (new), `server/routes/user-state.ts` (already working from Step 2), `server/routes/pipeline.ts` (auto-create user_state in /data endpoint)
Decisions made: 5-second sync interval. Understanding levels based on time thresholds: <5s=glanced, <30s=beginner, <120s=intermediate, >=120s=advanced.
What step 8 needs to know: User state is tracked and available via useStore().userState.

## Step 8 complete — Proactive engine
What was built: `src/hooks/useProactive.js` polls POST /api/proactive every 15 seconds and on node selection changes. Maps server actions to UI: highlight_concept → pulsing node glow, show_insight → InsightCard popup, suggest_connection → connection highlight, deepen_current/show_summary → suggestion banner. Server engine uses 6 deterministic rules (80% of decisions) with Claude fallback. `src/components/InsightCard.jsx` shows floating insight cards with category colors. `src/components/ExplorationProgress.jsx` shows progress bar and suggestion banners. GraphCanvas supports pulsing node animation.
Files created or modified: `src/hooks/useProactive.js` (new), `src/components/InsightCard.jsx` (new), `src/components/ExplorationProgress.jsx` (new), `src/components/GraphCanvas.jsx` (pulsing effect), `server/routes/proactive.ts` (already working), `server/proactive/engine.ts` (already working)
Decisions made: 15-second poll interval. Initial check after 3 seconds. 1-second debounced re-check on node selection.
What step 9 needs to know: Proactive UI is wired. InsightCard and ExplorationProgress render from store state.

## Step 9 complete — Chat
What was built: ChatBar rewritten to use real SSE streaming from POST /api/chat when projectId exists. Backend does RAG retrieval, injects user context (understanding levels, explored concepts), and streams Claude response. Messages parse `[[concept:key]]` and `[[file:path]]` references into clickable buttons. CodePanel chat also uses real backend. Chat messages persisted to Supabase chat_messages table.
Files created or modified: `src/components/ChatBar.jsx` (full rewrite), `src/components/CodePanel.jsx` (real chat integration), `server/routes/chat.ts` (already working)
Decisions made: Stream responses via SSE for real-time feel. Keep demo mode fallback for when projectId is null.
What step 10 needs to know: Chat is fully wired end-to-end.

## Step 10 complete — Pipeline Stage 7
What was built: Proactive seeding (Stage 7) already implemented and working since Step 3. Generates exploration path with suggested order, starting concept, and initial insights to show. Pipeline test confirmed 12 insights generated.
Files created or modified: No new changes needed — already working from Step 2.
Decisions made: Run as final pipeline stage. Seeds initial exploration path data for proactive engine.
What step 11 needs to know: Full pipeline (all 7 stages) completes successfully.

## Step 11 complete — Polish
What was built: Added file content endpoint (GET /api/pipeline/:id/file-content) so CodePanel shows actual source code instead of empty placeholder. CodePanel now fetches file content on demand when opened. Auto-creates user_state row when loading project data (prevents proactive engine from returning "nothing" on first load). Changed server port from 3005 to 3007 due to stale Windows process.
Files created or modified: `server/routes/pipeline.ts` (file-content endpoint + user_state auto-create), `src/components/CodePanel.jsx` (file content fetch + real chat), `server/index.ts` (port 3007), `vite.config.js` (proxy to 3007)
Decisions made: Fetch file content on-demand rather than bundling in initial data load (avoids sending all source to frontend at once). Port 3007 to avoid stale Windows Node.js processes.
Verified: Frontend build passes. Server health check returns OK. File-content endpoint returns real code. Pipeline data endpoint returns user_state.
