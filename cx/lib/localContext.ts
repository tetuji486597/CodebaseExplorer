import { readLocalRepo } from './fileReader.js';

let cachedFiles: Record<string, string> | null = null;
let cachedDir: string | null = null;

export async function getLocalFiles(repoDir: string): Promise<Record<string, string>> {
  if (cachedDir === repoDir && cachedFiles) return cachedFiles;
  const { fileContents } = await readLocalRepo(repoDir);
  cachedFiles = fileContents;
  cachedDir = repoDir;
  return fileContents;
}

export function scopeLocalFiles(
  query: string,
  allFiles: Record<string, string>,
  maxFiles = 12,
): Record<string, string> {
  const queryLower = query.toLowerCase();
  const queryWords = queryLower
    .split(/\s+/)
    .filter(w => w.length > 2)
    .filter(w => !['how', 'does', 'the', 'what', 'where', 'when', 'why', 'can', 'you', 'this', 'that', 'with', 'from', 'have', 'are', 'for', 'and', 'not'].includes(w));

  const scored: Array<{ path: string; score: number }> = [];

  for (const [path, content] of Object.entries(allFiles)) {
    const pathLower = path.toLowerCase();
    const contentLower = content.toLowerCase();
    let score = 0;

    for (const word of queryWords) {
      if (pathLower.includes(word)) score += 20;

      const fileName = path.split('/').pop()?.toLowerCase() || '';
      if (fileName.includes(word)) score += 30;

      const occurrences = countOccurrences(contentLower, word);
      if (occurrences > 0) {
        score += Math.min(15, occurrences * 3);
      }
    }

    if (/index\.(ts|js|tsx|jsx)$/.test(path)) score += 2;

    const depth = path.split('/').length;
    score -= depth * 0.3;

    if (score > 0) scored.push({ path, score });
  }

  scored.sort((a, b) => b.score - a.score);

  const result: Record<string, string> = {};
  for (const { path } of scored.slice(0, maxFiles)) {
    const content = allFiles[path];
    result[path] = content.length > 4000 ? content.substring(0, 4000) : content;
  }

  return result;
}

function countOccurrences(text: string, word: string): number {
  let count = 0;
  let pos = 0;
  while ((pos = text.indexOf(word, pos)) !== -1) {
    count++;
    pos += word.length;
  }
  return count;
}
