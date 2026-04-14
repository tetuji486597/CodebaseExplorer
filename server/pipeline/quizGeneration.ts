// Stage 6.5: Quiz Question Generation (runs in parallel with depth mapping + insights)
import { supabase } from '../db/supabase.js';
import { callClaudeStructured } from '../ai/claude.js';
import { quizGenerationSchema } from '../ai/schemas.js';
import type { ConceptSynthesisResult } from './conceptSynthesis.js';
import type { FileAnalysis } from './fileAnalysis.js';

interface QuizQuestion {
  concept_id: string;
  question_type: 'multiple_choice' | 'matching' | 'ordering' | 'fill_blank';
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  question_text: string;
  code_snippet?: string;
  options: Record<string, unknown>;
  correct_answer: Record<string, unknown>;
  explanation: string;
  related_file_paths?: string[];
}

const BATCH_SIZE = 3;

const QUIZ_SYSTEM_PROMPT = `You are generating quiz questions for a codebase exploration learning tool.
The students are second-year CS students learning about software architecture by exploring real codebases.

Generate 2-3 questions PER concept. Questions MUST reference specific files, functions, patterns, and architectural decisions from THIS codebase -- not generic CS trivia.

Question type distribution (approximate):
- 40% multiple_choice: 4 choices, one correct. Include a code_snippet when relevant.
- 25% matching: 3-4 pairs. Left side = module/concept names, right side = responsibilities/descriptions.
- 20% ordering: 3-5 items to arrange in correct order (data flow, middleware chain, initialization sequence).
- 15% fill_blank: A sentence with one blank (marked as ___) and the answer. Include alternatives array for acceptable answers.

IMPORTANT rules:
- Questions should test understanding of WHY and HOW, not just WHAT.
- Wrong multiple_choice answers must be plausible (related to the codebase, not obviously wrong).
- For matching questions, shuffle the right column so it doesn't trivially match left column order.
- For ordering questions, shuffle the items array. Store the correct order as indices.
- Vary difficulty: some beginner (conceptual), some intermediate (applied), some advanced (architectural reasoning).
- Reference actual file paths and function names from the codebase.

JSON structure for each type:
- multiple_choice options: { "choices": ["text1", "text2", "text3", "text4"] }, correct_answer: { "index": 0 }
- matching options: { "left": ["A", "B", "C"], "right": ["X", "Y", "Z"] }, correct_answer: { "pairs": [[0,2], [1,0], [2,1]] }
- ordering options: { "items": ["step3", "step1", "step2"] }, correct_answer: { "order": [1, 2, 0] }
- fill_blank options: { "sentence": "The ___ pattern is used to...", "hints": ["Starts with O"] }, correct_answer: { "answer": "Observer", "alternatives": ["observer", "Observer pattern"] }`;

export async function runQuizGeneration(
  projectId: string,
  synthesis: ConceptSynthesisResult,
  fileAnalyses: FileAnalysis[]
): Promise<void> {
  if (!synthesis.concepts.length) return;

  const edgeSummary = synthesis.edges
    .map((e) => `  ${e.source} --[${e.relationship}]--> ${e.target} (${e.strength})`)
    .join('\n');

  const fileSummary = fileAnalyses
    .slice(0, 30)
    .map((f) => `- ${f.path}: ${f.purpose} (exports: ${f.key_exports?.map((e) => e.name).join(', ') || 'none'})`)
    .join('\n');

  let totalGenerated = 0;
  let batchesFailed = 0;

  for (let i = 0; i < synthesis.concepts.length; i += BATCH_SIZE) {
    const batch = synthesis.concepts.slice(i, i + BATCH_SIZE);
    const batchIndex = Math.floor(i / BATCH_SIZE);
    const batchConceptIds = batch.map((c) => c.id);

    const conceptSummary = batch
      .map((c) => `- ${c.id}: "${c.name}" (${c.importance}) - ${c.one_liner}\n  Files: ${c.file_ids.join(', ')}`)
      .join('\n');

    try {
      const result = await callClaudeStructured<{ questions: QuizQuestion[] }>({
        system: QUIZ_SYSTEM_PROMPT,
        prompt: `Generate quiz questions for each concept in this codebase:

CONCEPTS:
${conceptSummary}

RELATIONSHIPS (full graph for context):
${edgeSummary}

KEY FILES:
${fileSummary}

Generate 2-3 questions per concept, covering different question types and difficulty levels.`,
        schema: quizGenerationSchema,
        schemaName: 'quiz_generation',
        maxTokens: 4096,
        model: 'fast',
      });

      if (!result.questions?.length) {
        console.error(`[quiz] Batch ${batchIndex} returned empty for concepts: ${batchConceptIds.join(', ')}`);
        batchesFailed++;
        continue;
      }

      const questionRows = result.questions.map((q) => ({
        project_id: projectId,
        concept_key: q.concept_id,
        question_type: q.question_type,
        difficulty: q.difficulty,
        question_text: q.question_text,
        code_snippet: q.code_snippet || null,
        options: q.options,
        correct_answer: q.correct_answer,
        explanation: q.explanation,
        related_file_paths: q.related_file_paths || [],
      }));

      const { error: insertError } = await supabase.from('quiz_questions').insert(questionRows);
      if (insertError) {
        console.error(`[quiz] Insert failed for batch ${batchIndex}:`, insertError.message);
        batchesFailed++;
        continue;
      }

      totalGenerated += result.questions.length;
      console.log(`[quiz] Batch ${batchIndex}: ${result.questions.length} questions for [${batchConceptIds.join(', ')}]`);
    } catch (err) {
      console.error(`[quiz] Batch ${batchIndex} failed for [${batchConceptIds.join(', ')}]:`, err);
      batchesFailed++;
      // Continue with next batch — partial results are better than none
    }
  }

  const totalBatches = Math.ceil(synthesis.concepts.length / BATCH_SIZE);
  if (totalGenerated === 0) {
    console.error(`[quiz] All ${totalBatches} batches failed — 0 questions generated for project ${projectId}`);
  } else if (batchesFailed > 0) {
    console.error(`[quiz] ${batchesFailed}/${totalBatches} batches failed — ${totalGenerated} questions generated (partial) for project ${projectId}`);
  } else {
    console.log(`[quiz] Complete: ${totalGenerated} questions across ${totalBatches} batches for project ${projectId}`);
  }
}
