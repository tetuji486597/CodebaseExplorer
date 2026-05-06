import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { requireAuth } from '../middleware/auth.js';
import { supabase } from '../db/supabase.js';
import { downloadFileContent } from '../db/fileStorage.js';
import { runCorePipeline, runEnrichment } from '../pipeline/orchestrator.js';
import { computeContentHash, findCachedProject } from '../pipeline/contentHash.js';
import { generateTerminalAnswer } from '../ai/terminalAnswer.js';
import { streamClaude } from '../ai/claude.js';
import { retrieveChunks } from '../rag/retriever.js';
import { embed } from '../rag/embedder.js';
import { generateGraphOps } from '../ai/graphExpansionPrompt.js';
import { resolveSessionId } from '../lib/chatSession.js';
import crypto from 'crypto';

type Env = { Variables: { userId: string } };
const app = new Hono<Env>();

function nanoid(size = 10): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = crypto.getRandomValues(new Uint8Array(size));
  return Array.from(bytes, (b: number) => alphabet[b % 62]).join('');
}

// ---- POST /pipeline — Create a real project from CLI ----

app.post('/pipeline', requireAuth, async (c) => {
  const body = await c.req.json();
  const { query, files, framework, language, repoName, maxFiles } = body;

  if (!files || typeof files !== 'object') {
    return c.json({ error: 'Missing files' }, 400);
  }

  const fileCount = Object.keys(files).length;
  if (fileCount === 0) {
    return c.json({ error: 'No files provided' }, 400);
  }

  const userId = c.get('userId') as string;

  return streamSSE(c, async (stream) => {
    try {
      // Check content hash for cached project
      const contentHash = computeContentHash(files);
      const cachedId = await findCachedProject(contentHash);

      if (cachedId) {
        // Return cached project — get its share_slug
        const { data: cached } = await supabase
          .from('projects')
          .select('id, share_slug')
          .eq('id', cachedId)
          .single();

        if (cached) {
          const slug = cached.share_slug || nanoid();
          if (!cached.share_slug) {
            await supabase.from('projects').update({ share_slug: slug }).eq('id', cachedId);
          }

          const shareUrl = `https://codebase-explorer-five.vercel.app/explore/${cachedId}`;
          await stream.writeSSE({ data: JSON.stringify({
            stage: 'complete',
            shareUrl,
            projectId: cachedId,
            cached: true,
            message: 'Found cached analysis',
          }) });
          return;
        }
      }

      // Create project
      const shareSlug = nanoid();
      const { data: project, error: createError } = await supabase
        .from('projects')
        .insert({
          name: repoName || 'CLI Project',
          source: 'cli',
          query: query || null,
          content_hash: contentHash,
          user_id: userId,
          visibility: 'shared',
          share_slug: shareSlug,
          framework: framework || null,
          language: language || null,
        })
        .select('id')
        .single();

      if (createError || !project) {
        await stream.writeSSE({ data: JSON.stringify({
          stage: 'error',
          message: `Failed to create project: ${createError?.message || 'unknown'}`,
        }) });
        return;
      }

      const projectId = project.id;

      await stream.writeSSE({ data: JSON.stringify({
        stage: 'created',
        message: `Project created`,
        projectId,
      }) });

      // Run core pipeline (stages 1-3) with progress streaming
      const coreResult = await runCorePipeline(projectId, {
        fileTree: null,
        fileContents: files,
        importEdges: [],
      }, {
        onProgress: (stage, message, detail) => {
          stream.writeSSE({ data: JSON.stringify({ stage, message, ...detail }) }).catch(() => {});
        },
      });

      if (!coreResult) {
        const shareUrl = `https://codebase-explorer-five.vercel.app/explore/${projectId}`;
        await stream.writeSSE({ data: JSON.stringify({
          stage: 'complete',
          shareUrl,
          projectId,
          message: 'No analyzable files found',
        }) });
        return;
      }

      const { synthesis, fileAnalyses } = coreResult;
      const shareUrl = `https://codebase-explorer-five.vercel.app/explore/${projectId}`;

      await stream.writeSSE({ data: JSON.stringify({
        stage: 'synthesized',
        message: `${synthesis.concepts.length} concepts, ${synthesis.edges.length} edges`,
        shareUrl,
        projectId,
        concepts: synthesis.concepts.map((c: any) => ({
          id: c.id,
          name: c.name,
          one_liner: c.one_liner || '',
          importance: c.importance || 'supporting',
          color: c.color || 'gray',
          file_ids: c.file_ids || [],
          explanation: c.explanation || '',
        })),
        edges: synthesis.edges.map((e: any) => ({
          source: e.source,
          target: e.target,
          relationship: e.relationship || '',
        })),
      }) });

      // Generate terminal answer (only when a query was provided)
      if (query) {
        await stream.writeSSE({ data: JSON.stringify({ stage: 'answering', message: 'Generating answer...' }) });

        const answerStream = await generateTerminalAnswer(
          query,
          synthesis,
          synthesis.codebase_summary || '',
          projectId,
        );

        for await (const text of answerStream) {
          await stream.writeSSE({ data: JSON.stringify({ stage: 'answer_chunk', text }) });
        }
      }

      // Complete
      await stream.writeSSE({ data: JSON.stringify({
        stage: 'complete',
        shareUrl,
        projectId,
      }) });

      // Fire-and-forget enrichment
      runEnrichment(projectId, files, synthesis, fileAnalyses);

    } catch (err: any) {
      await stream.writeSSE({ data: JSON.stringify({
        stage: 'error',
        message: err.message || 'Pipeline failed',
      }) });
    }
  });
});

// ---- POST /chat — Terminal chat with RAG or fallback ----

app.post('/chat', requireAuth, async (c) => {
  const { projectId, message, history, sessionId: clientSessionId, localFiles } = await c.req.json();
  const userId = c.get('userId') as string;

  if (!projectId || !message) {
    return c.json({ error: 'Missing projectId or message' }, 400);
  }

  // Verify project exists and user has access
  const { data: project } = await supabase
    .from('projects')
    .select('id, summary, pipeline_status, visibility, user_id')
    .eq('id', projectId)
    .single();

  if (!project) {
    return c.json({ error: 'Project not found' }, 404);
  }

  if (project.visibility === 'private' && project.user_id !== userId) {
    return c.json({ error: 'Access denied' }, 403);
  }

  // Resolve session
  const sessionId = await resolveSessionId(supabase, projectId, clientSessionId);

  // Save user message
  await supabase.from('chat_messages').insert({
    project_id: projectId,
    role: 'user',
    content: message,
    user_id: userId,
    source: 'cli',
    session_id: sessionId,
    context: { source: 'cli' },
  });

  // Get user state
  const { data: userState } = await supabase
    .from('user_state')
    .select('*')
    .eq('project_id', projectId)
    .single();

  // Determine retrieval strategy
  const isEnriched = project.pipeline_status === 'enriched';
  let formattedContext = '';

  if (localFiles && typeof localFiles === 'object' && Object.keys(localFiles).length > 0) {
    // CLI provided local file context — use it directly (fastest, most relevant)
    formattedContext = Object.entries(localFiles)
      .map(([path, content]: [string, any], i: number) => {
        const truncated = typeof content === 'string' ? content.substring(0, 4000) : '';
        return `<file index="${i + 1}" path="${path}">\n${truncated}\n</file>`;
      })
      .join('\n');
  } else if (isEnriched) {
    // Full RAG: embed query + retrieve chunks
    const queryEmbedding = await embed(message);
    const chunks = await retrieveChunks(projectId, message, queryEmbedding, 10);

    formattedContext = chunks
      .map((ch: any, i: number) =>
        `<chunk index="${i + 1}" file="${ch.file_path}" lines="${ch.metadata?.line_start || '?'}-${ch.metadata?.line_end || '?'}">
${ch.context_summary || ''}

${ch.content}
</chunk>`)
      .join('\n');
  } else {
    // Fallback: stuff relevant file content directly
    const { data: files } = await supabase
      .from('files')
      .select('path, analysis, concept_id')
      .eq('project_id', projectId)
      .limit(30);

    if (files) {
      const queryWords = message.toLowerCase().split(/\s+/).filter((w: string) => w.length > 2);
      const scored = files.map((f: any) => {
        const text = `${f.path} ${f.analysis?.purpose || ''}`.toLowerCase();
        const hits = queryWords.filter((w: string) => text.includes(w)).length;
        return { ...f, score: hits };
      }).sort((a: any, b: any) => b.score - a.score).slice(0, 10);

      const withContent = await Promise.all(
        scored.map(async (f: any) => {
          const content = await downloadFileContent(projectId, f.path);
          return { ...f, content };
        })
      );

      formattedContext = withContent
        .filter((f: any) => f.content)
        .map((f: any, i: number) => {
          const truncated = f.content.substring(0, 3000);
          return `<file index="${i + 1}" path="${f.path}" purpose="${f.analysis?.purpose || 'unknown'}">
${truncated}
</file>`;
        })
        .join('\n');
    }
  }

  const systemPrompt = `You are a guide helping someone understand their codebase.

<project_summary>
${project.summary || 'No summary available.'}
</project_summary>

<codebase_context>
${formattedContext}
</codebase_context>

Rules:
- Reference specific files and line numbers from the provided code
- Keep responses concise — aim for 3-5 short paragraphs max
- When mentioning a file, wrap it in [[file:path]] using a REAL file path
- When mentioning a concept, wrap it in [[concept:key]] using a REAL concept key
- CRITICAL: This is terminal output. Do NOT use markdown formatting of any kind — no #headers, no **bold**, no \`code\`, no - bullet lists, no numbered lists. Write in plain flowing prose with line breaks between paragraphs.`;

  // Build conversation history
  const chatMessages: Array<{ role: 'user' | 'assistant'; content: string }> = [];
  if (history && Array.isArray(history)) {
    for (const msg of history.slice(-6)) {
      if (msg.role === 'user' || msg.role === 'assistant') {
        chatMessages.push({ role: msg.role, content: msg.content });
      }
    }
  }
  chatMessages.push({ role: 'user', content: message });

  // Stream response
  return streamSSE(c, async (stream) => {
    let fullResponse = '';
    try {
      const textStream = await streamClaude({
        system: systemPrompt,
        messages: chatMessages,
        operation: 'cx_chat',
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

          const conceptSummaries = conceptRows.map((cr: any) => ({
            id: cr.concept_key,
            name: cr.name,
            importance: cr.importance,
            file_count: fileCounts[cr.concept_key] || 0,
          }));

          const edgeSummaries = (edgeRows || []).map((e: any) => ({
            source: e.source_concept_key,
            target: e.target_concept_key,
            relationship: e.relationship,
          }));

          graphOps = await generateGraphOps(
            message,
            fullResponse,
            conceptSummaries,
            edgeSummaries,
            { expanded_concepts: [], visible_node_count: conceptRows.length },
            projectId,
          );
        }
      } catch (graphErr: unknown) {
        console.error('[cx/chat] Graph expansion failed (non-fatal):', graphErr);
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
        source: 'cli',
        session_id: sessionId,
        context: {
          source: 'cli',
          retrieval: isEnriched ? 'rag' : 'fallback',
          graph_ops: graphOps.operations.length > 0 ? graphOps : undefined,
        },
      });

      await stream.writeSSE({ data: JSON.stringify({ done: true }), event: 'done' });
    } catch (err: any) {
      await stream.writeSSE({ data: JSON.stringify({ error: err.message }), event: 'error' });
    }
  });
});

// ---- GET /chat/:projectId/history — Fetch chat history ----

app.get('/chat/:projectId/history', requireAuth, async (c) => {
  const projectId = c.req.param('projectId');
  const userId = c.get('userId') as string;
  const sessionIdFilter = c.req.query('sessionId');

  // Verify access
  const { data: project } = await supabase
    .from('projects')
    .select('visibility, user_id')
    .eq('id', projectId)
    .single();

  if (!project) {
    return c.json({ error: 'Project not found' }, 404);
  }

  if (project.visibility === 'private' && project.user_id !== userId) {
    return c.json({ error: 'Access denied' }, 403);
  }

  let query = supabase
    .from('chat_messages')
    .select('id, role, content, source, session_id, created_at')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true });

  if (sessionIdFilter) {
    query = query.eq('session_id', sessionIdFilter);
  }

  const { data: messages } = await query.limit(50);
  return c.json({ messages: messages || [] });
});

// GET /chat/:projectId/sessions — List chat sessions (CLI)
app.get('/chat/:projectId/sessions', requireAuth, async (c) => {
  const projectId = c.req.param('projectId');
  const userId = c.get('userId') as string;

  const { data: project } = await supabase
    .from('projects')
    .select('visibility, user_id')
    .eq('id', projectId)
    .single();

  if (!project) return c.json({ error: 'Project not found' }, 404);
  if (project.visibility === 'private' && project.user_id !== userId) {
    return c.json({ error: 'Access denied' }, 403);
  }

  const { data: messages } = await supabase
    .from('chat_messages')
    .select('session_id, role, content, source, created_at')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true });

  if (!messages?.length) return c.json({ sessions: [] });

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

// ---- GET /project/status/:id — Quick status check for CLI ----

app.get('/project/status/:id', requireAuth, async (c) => {
  const projectId = c.req.param('id');

  const { data } = await supabase
    .from('projects')
    .select('id, pipeline_status, share_slug')
    .eq('id', projectId)
    .single();

  if (!data) {
    return c.json({ error: 'Not found' }, 404);
  }

  return c.json(data);
});

export default app;
