import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { supabase } from '../db/supabase.js';
import { streamClaude } from '../ai/claude.js';
import { retrieveChunks } from '../rag/retriever.js';
import { embed } from '../rag/embedder.js';

const app = new Hono();

// POST /api/explain - RAG-powered explanations for nodes
app.post('/', async (c) => {
  const { projectId, conceptKey, filePath, userLevel } = await c.req.json();
  const level = userLevel || 'beginner';

  let question: string;
  let conceptFilter: string | undefined;

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

    question = `Explain the "${conceptKey}" concept in this codebase`;
    conceptFilter = conceptKey;
  } else if (filePath) {
    question = `Explain what the file "${filePath}" does and how it fits into the codebase`;
  } else {
    return c.json({ error: 'Must provide conceptKey or filePath' }, 400);
  }

  // RAG retrieval
  const queryEmbedding = await embed(question);
  const chunks = await retrieveChunks(projectId, question, queryEmbedding, 10, conceptFilter);

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
        system: `You are explaining code to someone at a ${level} level.
Reference specific files and line numbers from the provided code.
Never make up code that doesn't exist in the codebase.
Be concise and use plain English.`,
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
