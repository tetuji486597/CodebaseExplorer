# Build Summary

## What Was Built

A full-stack AI-powered codebase exploration tool that takes a zip file of source code, analyzes it with Claude and OpenAI embeddings, and presents an interactive concept map with RAG-powered explanations, chat, and proactive guidance.

### Educational Layer Extension (New)

An educational layer adding two modes that share the same AI infrastructure:

**Mode 1 (existing):** Upload your own codebase → pipeline analyzes it → interactive concept graph + chat.

**Mode 2 (new):** Browse a curated library of 6 real open-source codebases → instant concept graph → learn programming concepts with adaptive explanations.

Both modes contribute to a **universal skill profile** that persists across all sessions.

---

## New Database Tables

| Table | Purpose |
|-------|---------|
| `universal_concepts` | 25 technology-agnostic programming concepts (taxonomy) |
| `curated_codebases` | 6 pre-built concept graphs for real open-source projects |
| `user_concept_progress` | Per-user confidence tracking for each universal concept |
| `concept_universal_map` | Links codebase-specific concepts → universal taxonomy |

New columns on `projects`: `origin_context`, `curated_codebase_id`.

## New Server Files

| File | Purpose |
|------|---------|
| `server/routes/curated.ts` | GET /api/curated, GET /:id, POST /:id/load |
| `server/routes/skill-profile.ts` | GET /api/skill-profile, POST /engage, GET /confidence |
| `server/pipeline/conceptMapping.ts` | AI-powered mapping of codebase concepts → universal taxonomy |

## Modified Server Files

| File | Change |
|------|--------|
| `server/index.ts` | Mounted curated + skill-profile routes |
| `server/pipeline/orchestrator.ts` | Added concept mapping step |
| `server/proactive/engine.ts` | Gap-filling node selection for curated codebases |
| `server/routes/explain.ts` | Adaptive register from universal concept confidence |

## New Frontend Components

| Component | Route | Purpose |
|-----------|-------|---------|
| `EntryScreen.jsx` | `/` | Two-path entry point (upload vs learn) + origin context |
| `CuratedLibrary.jsx` | `/library` | 6 codebase cards with difficulty badges |
| `SkillProfile.jsx` | `/profile` | 25-concept grid with confidence indicators + timeline |
| `CompletionSummary.jsx` | (overlay) | Shows when 70%+ concepts explored, suggests next codebase |

## Modified Frontend Files

| File | Change |
|------|--------|
| `AppRoutes.jsx` | Added /library, /profile routes; EntryScreen as / |
| `ExplorerView.jsx` | Added CompletionSummary component |
| `TopBar.jsx` | Added "Skills" button linking to /profile |
| `InspectorPanel.jsx` | Fires read_explanation engagement signal |
| `useUserState.js` | Fires engagement signals (click, time_spent, read_explanation) |
| `useStore.js` | Added originContext, curatedCodebaseId state |

## Architecture

```
User arrives at EntryScreen (/)
  ├── "Understand my codebase" → /upload → pipeline → /explorer
  │     └── Pipeline now includes concept mapping step
  │         (maps codebase concepts → universal taxonomy)
  │
  └── "Learn by exploring" → /library → pick codebase → /explorer
        └── Curated codebase loaded from pre-built concept graph
            (no pipeline needed — instant)

Both modes:
  ├── Explorer view identical (same graph, inspector, chat)
  ├── Engagement signals fire → user_concept_progress updated
  ├── Proactive engine uses gap-filling for curated codebases
  ├── Explain endpoint uses adaptive register from confidence
  └── CompletionSummary shows at 70%+ exploration

/profile → Skill profile screen
  ├── 25 universal concepts organized by category
  ├── Confidence dots per concept
  └── Exploration timeline (uploads + curated)
```

## Data Flow for Engagement Tracking

```
User clicks concept node in GraphCanvas
  → useUserState fires "click" engagement
  → POST /api/skill-profile/engage
  → Looks up concept_universal_map for this concept_key
  → Updates user_concept_progress (confidence += 0.05)

User expands "Read more" in InspectorPanel
  → fires "read_explanation" engagement (confidence += 0.10)

User spends 20+ seconds on a concept
  → fires "time_spent" engagement (confidence += 0.08)

Next time explain endpoint is called for a related concept:
  → Checks user_concept_progress for mapped universal concepts
  → Selects register: <0.3 = beginner, 0.3-0.7 = intermediate, >0.7 = advanced
  → Returns appropriate pre-generated explanation
```

## Cost Profile

| Component | Model | Cost |
|-----------|-------|------|
| Curated codebase load | None (pre-built) | $0.00 |
| Concept mapping (per upload) | Claude Haiku | ~$0.02 |
| Engagement tracking | Database only | $0.00 |
| Register selection | Database only | $0.00 |
| All other pipeline stages | Same as before | ~$0.40/upload |
