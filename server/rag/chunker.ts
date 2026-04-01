// Chunk code files with contextual descriptions

export interface CodeChunk {
  filePath: string;
  chunkIndex: number;
  content: string;
  contextSummary: string;
  metadata: {
    concept_id?: string;
    file_role?: string;
    language?: string;
    line_start: number;
    line_end: number;
  };
}

const TARGET_CHUNK_SIZE = 800; // tokens (~4 chars per token)
const OVERLAP_RATIO = 0.1;

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function chunkFile(
  filePath: string,
  content: string,
  contextInfo: {
    purpose?: string;
    conceptName?: string;
    conceptId?: string;
    role?: string;
  }
): CodeChunk[] {
  const lines = content.split('\n');
  const chunks: CodeChunk[] = [];
  const charsPerChunk = TARGET_CHUNK_SIZE * 4; // ~800 tokens
  const overlapChars = Math.floor(charsPerChunk * OVERLAP_RATIO);

  // Detect language from extension
  const ext = filePath.split('.').pop() || '';
  const langMap: Record<string, string> = {
    js: 'javascript', jsx: 'javascript', ts: 'typescript', tsx: 'typescript',
    py: 'python', rb: 'ruby', go: 'go', rs: 'rust', java: 'java',
    kt: 'kotlin', php: 'php', cs: 'csharp', swift: 'swift', dart: 'dart',
    vue: 'vue', svelte: 'svelte', css: 'css', html: 'html', json: 'json',
  };
  const language = langMap[ext] || 'unknown';

  // Build context prefix
  const contextParts = [];
  if (contextInfo.purpose) contextParts.push(`which ${contextInfo.purpose}`);
  if (contextInfo.conceptName) contextParts.push(`part of the "${contextInfo.conceptName}" concept`);
  const contextSummary = `This chunk is from ${filePath}${contextParts.length ? ', ' + contextParts.join('. It is ') : ''}.`;

  // Simple chunking by character count with line boundaries
  let currentChunkLines: string[] = [];
  let currentChunkChars = 0;
  let chunkStartLine = 1;
  let chunkIndex = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    currentChunkLines.push(line);
    currentChunkChars += line.length + 1; // +1 for newline

    if (currentChunkChars >= charsPerChunk || i === lines.length - 1) {
      chunks.push({
        filePath,
        chunkIndex,
        content: currentChunkLines.join('\n'),
        contextSummary,
        metadata: {
          concept_id: contextInfo.conceptId,
          file_role: contextInfo.role,
          language,
          line_start: chunkStartLine,
          line_end: chunkStartLine + currentChunkLines.length - 1,
        },
      });

      // Calculate overlap (keep last ~10% of lines)
      const overlapLines = Math.max(1, Math.floor(currentChunkLines.length * OVERLAP_RATIO));
      const kept = currentChunkLines.slice(-overlapLines);
      chunkStartLine = chunkStartLine + currentChunkLines.length - overlapLines;
      currentChunkLines = [...kept];
      currentChunkChars = kept.join('\n').length;
      chunkIndex++;
    }
  }

  return chunks;
}

export function chunkAllFiles(
  fileContents: Record<string, string>,
  fileAnalyses: Map<string, { purpose?: string; concept_id?: string; concept_name?: string; role?: string }>
): CodeChunk[] {
  const allChunks: CodeChunk[] = [];

  for (const [path, content] of Object.entries(fileContents)) {
    const analysis = fileAnalyses.get(path);
    const chunks = chunkFile(path, content, {
      purpose: analysis?.purpose,
      conceptId: analysis?.concept_id,
      conceptName: analysis?.concept_name,
      role: analysis?.role,
    });
    allChunks.push(...chunks);
  }

  return allChunks;
}
