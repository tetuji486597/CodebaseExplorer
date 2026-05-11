import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { supabase } from '../db/supabase.js';
import { streamClaude } from '../ai/claude.js';
import { retrieveChunks } from '../rag/retriever.js';
import { embed } from '../rag/embedder.js';
import { generateDepthFromConceptRow } from '../pipeline/depthMapping.js';

const app = new Hono();

// POST /api/explain - RAG-powered explanations for nodes
app.post('/', async (c) => {
  const { projectId, conceptKey, filePath, userLevel, userId } = await c.req.json();

  const level = userLevel || 'beginner';

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
      const levelField = level === 'beginner' ? 'beginner_explanation'
        : level === 'intermediate' ? 'intermediate_explanation'
        : 'advanced_explanation';

      if (concept[levelField]) {
        return c.json({ explanation: concept[levelField], concept });
      }

      // Lazy generation: level-specific explanation not available
      try {
        const depth = await generateDepthFromConceptRow(projectId, concept);
        if (depth) {
          const lazyExplanation = level === 'advanced' ? depth.advanced
            : level === 'intermediate' ? depth.intermediate
            : depth.beginner;
          return c.json({
            explanation: lazyExplanation,
            concept: { ...concept, beginner_explanation: depth.beginner, intermediate_explanation: depth.intermediate, advanced_explanation: depth.advanced },
          });
        }
      } catch (err) {
        console.error(`[explain] Lazy depth generation failed for ${conceptKey}:`, err);
      }

      // Fallback to generic explanation while level-specific generation is unavailable
      const fallback = level === 'advanced'
        ? (concept.deep_explanation || concept.explanation)
        : concept.explanation;
      if (fallback) {
        return c.json({ explanation: fallback, concept });
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
