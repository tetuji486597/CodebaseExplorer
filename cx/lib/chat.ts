import { createInterface } from 'readline';
import { getApiBase, getToken, getWebBase } from './auth.js';
import { renderChatHeader, renderChatInstructions, renderGraphExpansion, ansi } from './display.js';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

function cleanForTerminal(text: string): string {
  // Strip [[concept:x]] and [[file:x]] markup
  let clean = text.replace(/\[\[(concept|file):([^\]]+)\]\]/g, (_, type, val) => {
    if (type === 'concept') return `${ansi.cyan}${val}${ansi.reset}`;
    return `${ansi.dim}${val}${ansi.reset}`;
  });
  // Strip markdown headers
  clean = clean.replace(/^#{1,3}\s+/gm, '');
  // Strip bold markers
  clean = clean.replace(/\*\*([^*]+)\*\*/g, `${ansi.bold}$1${ansi.reset}`);
  return clean;
}

export async function sendChatMessage(
  projectId: string,
  message: string,
  token: string,
  history: ChatMessage[] = [],
  sessionId?: string,
): Promise<string> {
  const apiBase = getApiBase();
  const response = await fetch(`${apiBase}/api/cx/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ projectId, message, history, sessionId }),
  });

  if (!response.ok) {
    if (response.status === 401) {
      console.error(`\n  ${ansi.red}Session expired. Run gui login to re-authenticate.${ansi.reset}\n`);
      process.exit(1);
    }
    const err = await response.text();
    throw new Error(`Chat error (${response.status}): ${err}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response stream');

  const decoder = new TextDecoder();
  let fullText = '';
  let buffer = '';
  let graphOps: any = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      try {
        const event = JSON.parse(line.slice(6));
        if (event.text) {
          fullText += event.text;
        }
        if (event.graph_ops) {
          graphOps = event.graph_ops;
        }
      } catch {}
    }
  }

  const cleaned = cleanForTerminal(fullText.trim());
  const indented = cleaned.split('\n').map(line => `  ${line}`).join('\n');
  console.log(`\n${indented}\n`);

  if (graphOps?.operations?.length) {
    const conceptNames = await fetchConceptNames(projectId, token);
    console.log(renderGraphExpansion(graphOps, conceptNames));
  }

  return fullText;
}

async function fetchConceptNames(projectId: string, token: string): Promise<Record<string, string>> {
  const apiBase = getApiBase();
  try {
    const res = await fetch(`${apiBase}/api/pipeline/${projectId}/data`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!res.ok) return {};
    const data = await res.json();
    const map: Record<string, string> = {};
    for (const c of data.concepts || []) {
      map[c.id || c.concept_key] = c.name;
    }
    return map;
  } catch {
    return {};
  }
}

export async function fetchChatHistory(
  projectId: string,
  token: string
): Promise<ChatMessage[]> {
  const apiBase = getApiBase();
  const response = await fetch(`${apiBase}/api/cx/chat/${projectId}/history`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });

  if (!response.ok) return [];

  const { messages } = await response.json();
  return (messages || []).map((m: any) => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }));
}

export async function fetchConceptCount(projectId: string, token: string): Promise<number> {
  const apiBase = getApiBase();
  try {
    const res = await fetch(`${apiBase}/api/pipeline/${projectId}/data`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!res.ok) return 0;
    const data = await res.json();
    return data.concepts?.length || 0;
  } catch {
    return 0;
  }
}

interface SessionInfo {
  sessionId: string;
  startedAt: string;
  lastMessageAt: string;
  messageCount: number;
  sources: string[];
  preview: string;
}

interface HistoryMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  source: string;
  session_id: string;
  created_at: string;
}

export async function fetchSessions(projectId: string, token: string): Promise<SessionInfo[]> {
  const apiBase = getApiBase();
  const res = await fetch(`${apiBase}/api/cx/chat/${projectId}/sessions`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.sessions || [];
}

export async function fetchSessionMessages(projectId: string, sessionId: string, token: string): Promise<HistoryMessage[]> {
  const apiBase = getApiBase();
  const res = await fetch(`${apiBase}/api/cx/chat/${projectId}/history?sessionId=${sessionId}`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.messages || [];
}

export async function interactiveChat(projectId: string, token: string, repoName: string): Promise<void> {
  const conceptCount = await fetchConceptCount(projectId, token);
  console.log(renderChatHeader(repoName, conceptCount));

  const mapUrl = `${getWebBase()}/explore/${projectId}`;
  console.log(`  ${ansi.dim}Open in browser:${ansi.reset} ${ansi.underline}${mapUrl}${ansi.reset}\n`);

  const history = await fetchChatHistory(projectId, token);
  const recentHistory = history.slice(-6);

  const sessionId = `${projectId.slice(0, 8)}-${Date.now()}`;

  if (recentHistory.length > 0) {
    console.log(`  ${ansi.dim}Recent conversation${ansi.reset}\n`);
    for (const msg of recentHistory.slice(-4)) {
      if (msg.role === 'user') {
        let text = msg.content;
        if (text.length > 200) {
          text = text.substring(0, 200);
          const lastSpace = text.lastIndexOf(' ');
          if (lastSpace > 150) text = text.substring(0, lastSpace);
          text = text.trimEnd() + '...';
        }
        const lines = text.split('\n');
        for (const line of lines) {
          console.log(`  ${ansi.bold}>${ansi.reset} ${line}`);
        }
      } else {
        let preview = msg.content;
        if (preview.length > 200) {
          preview = preview.substring(0, 200);
          const lastSpace = preview.lastIndexOf(' ');
          if (lastSpace > 150) preview = preview.substring(0, lastSpace);
          preview = preview.trimEnd() + '...';
        }
        const clean = cleanForTerminal(preview);
        const lines = clean.split('\n');
        for (const line of lines) {
          console.log(`  ${ansi.dim}${line}${ansi.reset}`);
        }
      }
      console.log();
    }
    const w = Math.min(process.stdout.columns || 80, 80);
    console.log(`  ${ansi.dim}${'─'.repeat(w - 4)}${ansi.reset}\n`);
  }

  console.log(renderChatInstructions());

  const localHistory: ChatMessage[] = [...recentHistory];

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: `  ${ansi.cyan}>${ansi.reset} `,
  });

  rl.prompt();

  rl.on('line', async (line) => {
    const input = line.trim();
    if (!input) {
      rl.prompt();
      return;
    }

    if (input === '/quit' || input === '/exit' || input === '/q') {
      console.log(`\n  ${ansi.dim}Goodbye.${ansi.reset}\n`);
      rl.close();
      return;
    }

    localHistory.push({ role: 'user', content: input });

    try {
      const response = await sendChatMessage(projectId, input, token, localHistory.slice(-6), sessionId);
      localHistory.push({ role: 'assistant', content: response });
    } catch (err: any) {
      console.error(`\n  ${ansi.red}Error: ${err.message}${ansi.reset}\n`);
    }

    rl.prompt();
  });

  rl.on('close', () => {
    process.exit(0);
  });
}
