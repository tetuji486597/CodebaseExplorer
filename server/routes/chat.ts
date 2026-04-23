import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { supabase } from '../db/supabase.js';
import { streamClaude } from '../ai/claude.js';
import { retrieveChunks } from '../rag/retriever.js';
import { embed } from '../rag/embedder.js';
import { generateGraphOps } from '../ai/graphExpansionPrompt.js';
import { resolveSessionId } from '../lib/chatSession.js';

const app = new Hono();

// POST /api/chat - RAG-powered streaming chat
app.post('/', async (c) => {
  const { message, projectId, selectedNode, history, expansionState, sessionId: clientSessionId } = await c.req.json();

  // Extract user_id from auth header if present (optional for web, required for collab)
  let userId: string | null = null;
  const authHeader = c.req.header('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const { data } = await supabase.auth.getUser(authHeader.slice(7));
      userId = data?.user?.id || null;
    } catch {}
  }

  // Resolve session
  const sessionId = await resolveSessionId(supabase, projectId, clientSessionId);

  // Save user message
  await supabase.from('chat_messages').insert({
    project_id: projectId,
    role: 'user',
    content: message,
    user_id: userId,
    source: 'web',
    session_id: sessionId,
    context: { selected_node: selectedNode, source: 'web' },
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
        operation: 'chat',
        projectId,
      });

      for await (const text of textStream) {
        fullResponse += text;
        await stream.writeSSE({ data: JSON.stringify({ text }), event: 'text' });
      }

      // Generate graph expansion operations
      let graphOps = { operations: [], auto_collapse: [] };
      try {
        const { data: conceptRows } = await supabase
          .from('concepts')
          .select('concept_key, name, importance')
          .eq('project_id', projectId);

        const { data: edgeRows } = await supabase
          .from('concept_edges')
          .select('source_concept_key, target_concept_key, relationship')
          .eq('project_id', projectId);

        const { data: fileRows } = await supabase
          .from('files')
          .select('concept_id')
          .eq('project_id', projectId);

        if (conceptRows?.length) {
          const fileCounts: Record<string, number> = {};
          for (const f of fileRows || []) {
            fileCounts[f.concept_id] = (fileCounts[f.concept_id] || 0) + 1;
          }

          const conceptSummaries = conceptRows.map(c => ({
            id: c.concept_key,
            name: c.name,
            importance: c.importance,
            file_count: fileCounts[c.concept_key] || 0,
          }));

          const edgeSummaries = (edgeRows || []).map(e => ({
            source: e.source_concept_key,
            target: e.target_concept_key,
            relationship: e.relationship,
          }));

          graphOps = await generateGraphOps(
            message,
            fullResponse,
            conceptSummaries,
            edgeSummaries,
            expansionState || { expanded_concepts: [], visible_node_count: conceptRows.length },
            projectId,
          );
        }
      } catch (graphErr: unknown) {
        console.error('[chat] Graph expansion failed (non-fatal):', graphErr);
      }

      if (graphOps.operations.length > 0) {
        await stream.writeSSE({ data: JSON.stringify({ graph_ops: graphOps }), event: 'graph_ops' });
      }

      // Save assistant message
      await supabase.from('chat_messages').insert({
        project_id: projectId,
        role: 'assistant',
        content: fullResponse,
        user_id: null,
        source: 'web',
        session_id: sessionId,
        context: {
          selected_node: selectedNode,
          chunks_used: chunks.length,
          source: 'web',
          graph_ops: graphOps.operations.length > 0 ? graphOps : undefined,
        },
      });

      await stream.writeSSE({ data: JSON.stringify({ done: true }), event: 'done' });
    } catch (err: any) {
      await stream.writeSSE({ data: JSON.stringify({ error: err.message }), event: 'error' });
    }
  });
});

// GET /api/chat/:projectId/history — Fetch chat messages
app.get('/:projectId/history', async (c) => {
  const projectId = c.req.param('projectId');
  const sessionId = c.req.query('sessionId');
  const limit = parseInt(c.req.query('limit') || '50', 10);

  let query = supabase
    .from('chat_messages')
    .select('id, role, content, source, session_id, created_at')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true });

  if (sessionId) {
    query = query.eq('session_id', sessionId);
  }

  const { data } = await query.limit(limit);
  return c.json({ messages: data || [] });
});

// GET /api/chat/:projectId/sessions — List chat sessions
app.get('/:projectId/sessions', async (c) => {
  const projectId = c.req.param('projectId');

  const { data: messages } = await supabase
    .from('chat_messages')
    .select('session_id, role, content, source, created_at')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true });

  if (!messages?.length) {
    return c.json({ sessions: [] });
  }

  const sessionMap = new Map<string, {
    sessionId: string;
    startedAt: string;
    lastMessageAt: string;
    messageCount: number;
    sources: Set<string>;
    preview: string;
  }>();

  for (const msg of messages) {
    const sid = msg.session_id || 'untracked';
    if (!sessionMap.has(sid)) {
      sessionMap.set(sid, {
        sessionId: sid,
        startedAt: msg.created_at,
        lastMessageAt: msg.created_at,
        messageCount: 0,
        sources: new Set(),
        preview: '',
      });
    }
    const session = sessionMap.get(sid)!;
    session.messageCount++;
    session.lastMessageAt = msg.created_at;
    if (msg.source) session.sources.add(msg.source);
    if (!session.preview && msg.role === 'user') {
      session.preview = msg.content.slice(0, 120);
    }
  }

  const sessions = Array.from(sessionMap.values())
    .map(s => ({ ...s, sources: Array.from(s.sources) }))
    .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());

  return c.json({ sessions });
});

export default app;
