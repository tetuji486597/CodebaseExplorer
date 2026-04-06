# Build Progress

## Steps 1-11: Original Build (Complete)
Full pipeline (7 stages), RAG, chat, explain, proactive engine, user state tracking — all working.

---

## Educational Layer Extension

### Step 1: Database Schema ✅
- Created tables: universal_concepts, curated_codebases, user_concept_progress, concept_universal_map
- Added columns: projects.origin_context, projects.curated_codebase_id
- Applied migration via Supabase MCP

### Step 2: Concept Taxonomy ✅
- 25 universal programming concepts seeded across 4 categories (frontend, backend, database, general)
- Ordered by difficulty progression from Client-Server Architecture to Security Fundamentals

### Step 3: Curated Codebase Content ✅
- 6 codebases with hand-crafted concept graphs (5-7 concepts each with all 3 explanation levels)
- Universal concept mappings seeded for all 6 codebases

### Step 4: Universal Concept Mapping ✅
- Created server/pipeline/conceptMapping.ts — uses Claude Haiku to map codebase concept keys → universal taxonomy
- Integrated into orchestrator (runs after proactive seeding, before marking complete)
- Backend route: GET /api/curated returns all curated codebases, POST /api/curated/:id/load creates project from curated data

### Step 5: User Concept Progress Tracking ✅
- Backend: POST /api/skill-profile/engage records engagement (click, read_explanation, time_spent, chat_about)
- Backend: GET /api/skill-profile returns all universal concepts with user progress
- Frontend: useUserState hook fires engagement signals on node click, read more, 20+ seconds spent
- InspectorPanel fires read_explanation engagement when user expands full explanation

### Step 6: Adaptive Language Register ✅
- Explain route determines register from universal concept confidence (0-0.3: beginner, 0.3-0.7: intermediate, 0.7-1: advanced)
- System prompt uses register-specific instructions for Claude
- Falls back to explicit userLevel if provided

### Step 7: Onboarding Screen ✅
- EntryScreen replaces landing page as / route
- Two paths: "Understand my codebase" → /upload, "Learn by exploring" → /library
- Optional origin context selector (self-built, AI-built, someone else)
- Skill profile link at bottom

### Step 8: Curated Library UI ✅
- CuratedLibrary component at /library
- 6 codebase cards with name, description, difficulty badge (beginner/intermediate/advanced), concept tags
- Loading states with skeleton cards
- Click to load creates project and navigates to explorer

### Step 9: Skill Profile Screen ✅
- SkillProfile component at /profile
- 25 universal concepts organized by category (frontend, backend, database, general)
- Confidence dots (5-dot indicator), encounter count, last encountered date
- Progress bar showing total concepts encountered
- Exploration timeline showing all explored codebases

### Step 10: Proactive Guidance Update ✅
- Gap-filling: proactive engine finds concept with lowest universal concept confidence for curated codebases
- Rule 1 (new user) and Rule 2 (next suggestion) both prefer gap-filling for curated codebases
- CompletionSummary component shows when 70%+ concepts explored: lists new concepts encountered, suggests next codebase
- TopBar updated with "Skills" button linking to /profile
