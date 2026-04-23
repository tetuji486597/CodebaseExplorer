import { streamClaude } from './claude.js';

export async function generateTerminalAnswer(
  query: string,
  synthesis: {
    concepts: Array<{ id: string; name: string; explanation: string; importance: string; file_ids: string[] }>;
    edges: Array<{ source: string; target: string; relationship: string }>;
  },
  summary: string,
  projectId?: string,
): Promise<AsyncIterable<string>> {
  const conceptList = synthesis.concepts
    .map(c => `- ${c.name} (${c.importance}): ${c.explanation}`)
    .join('\n');

  return streamClaude({
    system: `You are answering a developer's question about a codebase. Give a direct answer in 2-3 sentences. Be specific — name the key files and concepts involved. No markdown, no headers, no bullets. Plain text only. The concept map is shown separately, so don't list concepts — just answer the question.`,
    messages: [{
      role: 'user',
      content: `Question: "${query}"

Summary: ${summary}

Concepts:
${conceptList}

Answer in 2-3 plain sentences.`,
    }],
    maxTokens: 256,
    model: 'fast',
    operation: 'terminal_answer',
    projectId,
  });
}
