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
  if (!synthesis.concepts.length) return;

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
      system: `You are a software architecture mentor helping a CS student understand a codebase they're seeing for the first time.
Generate ${fileAnalyses.length <= 5 ? '3-5' : '10-20'} insights that would help them learn. Think about:
- What architectural patterns are being used, and how do they connect to CS concepts the student has learned?
- What design decisions are worth understanding — why was this approach chosen over alternatives?
- What are good examples of software engineering principles in action (separation of concerns, single responsibility, DRY)?
- What's risky or fragile, and what would a more robust approach look like?
- What's unnecessarily complex, and how could it be simplified?
- What would be a good starting point for someone wanting to contribute to or modify this code?
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
      maxTokens: fileAnalyses.length <= 5 ? 2048 : 4096,
      model: 'fast',
    });

    // Store insights (batch insert)
    console.log(`Insight generation raw result type: ${typeof result}, keys: ${Object.keys(result || {})}`);
    // Handle case where Claude returns the array directly or wraps it
    const insights = Array.isArray(result) ? result : (result.insights || []);
    console.log(`Generated ${insights.length} insights`);
    if (insights.length > 0) {
      const insightRows = insights.map((insight) => ({
        project_id: projectId,
        title: insight.title,
        category: insight.category,
        summary: insight.summary,
        detail: insight.detail,
        related_concept_keys: insight.related_concept_ids,
        related_file_paths: insight.related_file_paths,
        priority: insight.priority,
        requires_understanding: insight.requires_understanding,
      }));
      const { error } = await supabase.from('insights').insert(insightRows);
      if (error) {
        console.error('Failed to batch insert insights:', error);
      }
    }
  } catch (err) {
    console.error('Insight generation failed:', err);
  }
}
