import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { supabase } from '../db/supabase.js';
import { streamClaude } from '../ai/claude.js';
import { retrieveChunks } from '../rag/retriever.js';
import { embed } from '../rag/embedder.js';

const app = new Hono();

// Determine register from universal concept confidence
async function getRegisterFromConfidence(
  projectId: string,
  conceptKey: string,
  userId: string = 'anonymous'
): Promise<'beginner' | 'intermediate' | 'advanced'> {
  try {
    // Find universal concepts mapped to this concept key
    const { data: mappings } = await supabase
      .from('concept_universal_map')
      .select('universal_concept_id')
      .or(`project_id.eq.${projectId},curated_codebase_id.not.is.null`)
      .eq('concept_key', conceptKey);

    if (!mappings || mappings.length === 0) return 'beginner';

    const ucIds = mappings.map((m: any) => m.universal_concept_id);

    const { data: progress } = await supabase
      .from('user_concept_progress')
      .select('confidence')
      .eq('user_id', userId)
      .in('concept_id', ucIds);

    if (!progress || progress.length === 0) return 'beginner';

    // Average confidence across mapped universal concepts
    const avgConfidence = progress.reduce((sum: number, p: any) => sum + (p.confidence || 0), 0) / progress.length;

    if (avgConfidence < 0.3) return 'beginner';
    if (avgConfidence < 0.7) return 'intermediate';
    return 'advanced';
  } catch {
    return 'beginner';
  }
}

// POST /api/explain - RAG-powered explanations for nodes
app.post('/', async (c) => {
  const { projectId, conceptKey, filePath, userLevel, userId } = await c.req.json();

  // Determine level: explicit override > confidence-based > fallback
  let level = userLevel || 'beginner';
  if (!userLevel && conceptKey) {
    level = await getRegisterFromConfidence(projectId, conceptKey, userId || 'anonymous');
  }

  let question: string;
  let conceptFilter: string | undefined;
  let filePathFilter: string[] | undefined;

  if (conceptKey) {
    const { data: concept } = await supabase
      .from('concepts')
      .select('*')
      .eq('project_id', projectId)
      .eq('concept_key', conceptKey)
      .single();

    if (concept) {
      // Return pre-generated explanation based on level
      const explanationByLevel: Record<string, string> = {
        beginner: concept.beginner_explanation || concept.explanation,
        intermediate: concept.intermediate_explanation || concept.explanation,
        advanced: concept.advanced_explanation || concept.deep_explanation || concept.explanation,
      };

      const preGenerated = explanationByLevel[level];
      if (preGenerated) {
        return c.json({ explanation: preGenerated, concept });
      }
    }

    if (!concept && conceptKey.startsWith('exp_')) {
      const { data: subConcept } = await supabase
        .from('sub_concepts')
        .select('*')
        .eq('project_id', projectId)
        .eq('sub_concept_key', conceptKey)
        .single();

      if (subConcept) {
        question = `Explain the "${subConcept.name}" sub-component (part of the "${subConcept.parent_concept_key}" concept): ${subConcept.one_liner}`;
        filePathFilter = subConcept.file_ids?.length ? subConcept.file_ids : undefined;
      } else {
        question = `Explain the "${conceptKey}" concept in this codebase`;
        conceptFilter = conceptKey;
      }
    } else {
      question = `Explain the "${conceptKey}" concept in this codebase`;
      conceptFilter = conceptKey;
    }
  } else if (filePath) {
    question = `Explain what the file "${filePath}" does and how it fits into the codebase`;
  } else {
    return c.json({ error: 'Must provide conceptKey or filePath' }, 400);
  }

  // RAG retrieval
  const queryEmbedding = await embed(question);
  const chunks = await retrieveChunks(projectId, question, queryEmbedding, 10, conceptFilter, filePathFilter);

  const formattedChunks = chunks
    .map(
      (ch, i) =>
        `<chunk index="${i + 1}" file="${ch.file_path}">
${ch.context_summary || ''}
${ch.content}
</chunk>`
    )
    .join('\n');

  return streamSSE(c, async (stream) => {
    try {
      const textStream = await streamClaude({
        operation: 'explain',
        projectId,
        system: `You are explaining code to a CS student. Use register ${level === 'beginner' ? '0 (zero assumed knowledge): explain from first principles, no jargon, use analogies to everyday things' : level === 'intermediate' ? '1 (some familiarity): use correct terminology without defining basic concepts, explain how things are implemented here' : '2 (comfortable): go straight to implementation specifics, interesting decisions, and things worth watching out for'}.
Reference specific files from the provided code.
Never make up code that doesn't exist in the codebase.
Be concise.`,
        messages: [
          {
            role: 'user',
            content: `<codebase_context>\n${formattedChunks}\n</codebase_context>\n\n${question}`,
          },
        ],
      });

      for await (const text of textStream) {
        await stream.writeSSE({ data: JSON.stringify({ text }), event: 'text' });
      }
      await stream.writeSSE({ data: JSON.stringify({ done: true }), event: 'done' });
    } catch (err: any) {
      await stream.writeSSE({ data: JSON.stringify({ error: err.message }), event: 'error' });
    }
  });
});

export default app;
