import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { supabase } from '../db/supabase.js';
import { streamClaude } from '../ai/claude.js';
import { retrieveChunks } from '../rag/retriever.js';
import { embed } from '../rag/embedder.js';

const app = new Hono();

// POST /api/chat - RAG-powered streaming chat
app.post('/', async (c) => {
  const { message, projectId, selectedNode, history } = await c.req.json();

  // Save user message
  await supabase.from('chat_messages').insert({
    project_id: projectId,
    role: 'user',
    content: message,
    context: { selected_node: selectedNode },
  });

  // Get user state for understanding levels
  const { data: userState } = await supabase
    .from('user_state')
    .select('*')
    .eq('project_id', projectId)
    .single();

  // Get project summary
  const { data: project } = await supabase
    .from('projects')
    .select('summary')
    .eq('id', projectId)
    .single();

  // Retrieve relevant code chunks via RAG
  const queryEmbedding = await embed(message);
  const conceptFilter = selectedNode?.type === 'concept' ? selectedNode.id : undefined;
  const chunks = await retrieveChunks(projectId, message, queryEmbedding, 10, conceptFilter);

  const formattedChunks = chunks
    .map(
      (c, i) =>
        `<chunk index="${i + 1}" file="${c.file_path}" lines="${c.metadata?.line_start || '?'}-${c.metadata?.line_end || '?'}">
${c.context_summary || ''}

${c.content}
</chunk>`
    )
    .join('\n');

  const systemPrompt = `You are a guide helping someone understand their codebase.

<project_summary>
${project?.summary || 'No summary available.'}
</project_summary>

<user_context>
Understanding levels: ${JSON.stringify(userState?.understanding_level || {})}
Currently viewing: ${selectedNode?.name || 'overview'}
Concepts explored: ${(userState?.explored_concepts || []).join(', ') || 'none yet'}
</user_context>

<codebase_context>
${formattedChunks}
</codebase_context>

Rules:
- Reference specific files and line numbers from the provided code
- Match your language to the user's understanding level for the relevant concept
- If they ask about something you don't have code context for, say so
- Keep responses under 200 words unless they ask for more detail
- When mentioning a concept, wrap it in [[concept:concept_key]] using a REAL concept key from the project (e.g. [[concept:auth]], [[concept:database]]). NEVER use placeholder values like [[concept:x]] or [[concept:example]]
- When mentioning a file, wrap it in [[file:path]] using a REAL file path from the code context (e.g. [[file:server/routes/chat.ts]]). NEVER use placeholder paths like [[file:x]] or [[file:path]]
- NEVER show the [[concept:...]] or [[file:...]] syntax as an example or explanation to the user. If you need to describe the reference system, say "clickable concept and file links" instead of showing the raw syntax
- Format responses with markdown: use ## for section headers, **bold** for emphasis, \`code\` for identifiers, - for bullet lists, and fenced code blocks with language tags for code snippets`;

  return streamSSE(c, async (stream) => {
    let fullResponse = '';
    try {
      // Build messages with conversation history for multi-turn context
      const chatMessages: Array<{ role: 'user' | 'assistant'; content: string }> = [];
      if (history && Array.isArray(history)) {
        for (const msg of history.slice(-6)) {
          if (msg.role === 'user' || msg.role === 'assistant') {
            chatMessages.push({ role: msg.role, content: msg.content });
          }
        }
      }
      chatMessages.push({ role: 'user', content: message });

      const textStream = await streamClaude({
        system: systemPrompt,
        messages: chatMessages,
      });

      for await (const text of textStream) {
        fullResponse += text;
        await stream.writeSSE({ data: JSON.stringify({ text }), event: 'text' });
      }

      // Save assistant message
      await supabase.from('chat_messages').insert({
        project_id: projectId,
        role: 'assistant',
        content: fullResponse,
        context: { selected_node: selectedNode, chunks_used: chunks.length },
      });

      await stream.writeSSE({ data: JSON.stringify({ done: true }), event: 'done' });
    } catch (err: any) {
      await stream.writeSSE({ data: JSON.stringify({ error: err.message }), event: 'error' });
    }
  });
});

export default app;
