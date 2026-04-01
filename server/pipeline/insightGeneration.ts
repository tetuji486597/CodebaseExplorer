// Stage 5: Insight Generation
import { supabase } from '../db/supabase.js';
import { callClaudeStructured } from '../ai/claude.js';
import { insightSchema } from '../ai/schemas.js';
import type { ConceptSynthesisResult } from './conceptSynthesis.js';
import type { FileAnalysis } from './fileAnalysis.js';

export async function runInsightGeneration(
  projectId: string,
  synthesis: ConceptSynthesisResult,
  fileAnalyses: FileAnalysis[]
) {
  const conceptSummary = synthesis.concepts
    .map((c) => `${c.name} (${c.id}): ${c.explanation}`)
    .join('\n');

  const fileSummary = fileAnalyses
    .map((f) => `${f.path}: ${f.purpose} [${f.complexity}] [${f.role}]`)
    .join('\n');

  try {
    const result = await callClaudeStructured<{
      insights: Array<{
        title: string;
        category: string;
        summary: string;
        detail: string;
        related_concept_ids: string[];
        related_file_paths: string[];
        priority: number;
        requires_understanding: string[];
      }>;
    }>({
      system: `You are a senior engineer doing a code review of an unfamiliar codebase.
Generate 10-20 insights about what you notice. Think about:
- What would you notice first?
- What would concern you?
- What's clever or well-designed?
- What's risky or could break?
- What patterns are being used?
- What's unnecessarily complex?
Respond with ONLY valid JSON, no markdown.`,
      prompt: `Review this codebase:

Concepts:
${conceptSummary}

Files:
${fileSummary}

Codebase summary: ${synthesis.codebase_summary}

Return JSON with an "insights" array. Each insight needs: title, category (architecture/risk/pattern/praise/suggestion/complexity), summary (1-2 sentences), detail (full explanation), related_concept_ids, related_file_paths, priority (1-10), requires_understanding (concept keys user should know first).`,
      schema: insightSchema,
      schemaName: 'insights',
      maxTokens: 4096,
    });

    // Store insights
    const insights = result.insights || [];
    console.log(`Generated ${insights.length} insights`);
    for (const insight of insights) {
      await supabase.from('insights').insert({
        project_id: projectId,
        title: insight.title,
        category: insight.category,
        summary: insight.summary,
        detail: insight.detail,
        related_concept_keys: insight.related_concept_ids,
        related_file_paths: insight.related_file_paths,
        priority: insight.priority,
        requires_understanding: insight.requires_understanding,
      });
    }
  } catch (err) {
    console.error('Insight generation failed:', err);
  }
}
