# Implementation Decisions

## Step 1: Database Schema

**Decision:** Migration SQL executed successfully via Supabase MCP `execute_sql` tool.
**Previous issue:** The Supabase MCP tool returned permission errors in the previous session, but the `execute_sql` function worked correctly in this session. All 8 tables created, pgvector extension enabled, HNSW index and hybrid search function deployed.

## Model Choices
- Main Claude calls: `claude-sonnet-4-6` (changed from `claude-sonnet-4-5-20251001` which does not exist as a valid model ID)
- Cheap/fast calls: `claude-haiku-4-5-20251001`
- Embeddings: OpenAI `text-embedding-3-small` (1536 dimensions)

## Server Port
- Changed from 3001 to 3005 because port 3001 was occupied by a stale Windows Node process from a previous session that couldn't be killed from WSL
- Changed from 3005 to 3007 because 3005 was subsequently occupied by another stale Windows Node process (PID 19344)

## Node.js Environment
- Installed Node.js 22 natively in WSL2 via nvm because the existing node_modules were built for Windows and the Windows Node.js process management was causing port conflicts
- Re-ran `npm install` to get Linux-native binaries (esbuild, etc.)

## Claude Response Normalization
- Claude returns varying field names for structured JSON responses (e.g., `label` instead of `name`, `files` instead of `file_ids`, `from`/`to` instead of `source`/`target`)
- Added a normalization layer in `conceptSynthesis.ts` that accepts multiple field name variants and maps them to the expected schema
- Made all `file_ids` references defensive with `Array.isArray()` checks across pipeline stages
- Added robust JSON extraction in `claude.ts` that handles markdown code blocks and extracts JSON from surrounding text

## Frontend Integration (Steps 6-11)
- Created three new hooks: `useSSE.js` (generic SSE stream consumer), `useUserState.js` (exploration tracking with debounced sync), `useProactive.js` (periodic proactive engine polling)
- Created two new components: `InsightCard.jsx` (floating insight cards), `ExplorationProgress.jsx` (progress bar + suggestion banner)
- Updated `ChatBar.jsx` to use real SSE streaming from `/api/chat` when `projectId` exists, falls back to mock for demo mode
- Updated `InspectorPanel.jsx` to fetch real explanations from `/api/explain` endpoint, supports both pre-generated and SSE-streamed explanations
- Updated `GraphCanvas.jsx` to support pulsing node effect driven by proactive engine
- Updated `ExplorerView.jsx` to mount new hooks and components
- Chat message rendering parses `[[concept:key]]` and `[[file:path]]` references into clickable links
