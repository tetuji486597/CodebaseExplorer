import { callClaudeStructured } from './ai.js';

export interface ScopeResult {
  files: Record<string, string>;
  keywords: string[];
  matchReasons: Record<string, string>;
}

interface ScopeOptions {
  maxFiles: number;
  includePath?: string;
}

const keywordExtractionSchema = {
  type: 'object' as const,
  properties: {
    keywords: {
      type: 'array' as const,
      items: { type: 'string' as const },
    },
    file_patterns: {
      type: 'array' as const,
      items: { type: 'string' as const },
    },
  },
  required: ['keywords', 'file_patterns'],
};

export async function scopeFiles(
  query: string,
  fileContents: Record<string, string>,
  opts: ScopeOptions
): Promise<ScopeResult> {
  const allPaths = Object.keys(fileContents);

  // Step 1: Extract keywords and likely file patterns from the query
  const extraction = await callClaudeStructured<{
    keywords: string[];
    file_patterns: string[];
  }>({
    system: 'You extract search terms from a natural language codebase query. Return keywords (function names, module names, technical terms) and file_patterns (path fragments like "auth/", "login", "middleware"). Be thorough — include synonyms and related terms. For example, "authentication" should also yield "auth", "login", "session", "jwt", "token", "password", "credential".',
    prompt: `Query: "${query}"\n\nAvailable file paths:\n${allPaths.slice(0, 200).join('\n')}\n\nExtract search keywords and file path patterns.`,
    schema: keywordExtractionSchema,
    schemaName: 'keyword_extraction',
    model: 'fast',
  });

  const keywords = extraction.keywords.map((k) => k.toLowerCase());
  const filePatterns = extraction.file_patterns.map((p) => p.toLowerCase());

  // Step 2: Score each file by relevance
  const scored: Array<{ path: string; score: number; reason: string }> = [];

  for (const [path, content] of Object.entries(fileContents)) {
    const pathLower = path.toLowerCase();
    const contentLower = content.toLowerCase();
    let score = 0;
    const reasons: string[] = [];

    // Force-include override
    if (opts.includePath && pathLower.startsWith(opts.includePath.toLowerCase())) {
      score += 100;
      reasons.push('force-included');
    }

    // Path matching
    for (const pattern of filePatterns) {
      if (pathLower.includes(pattern)) {
        score += 15;
        reasons.push(`path matches "${pattern}"`);
      }
    }

    // Keyword matching in content
    let keywordHits = 0;
    for (const keyword of keywords) {
      if (keyword.length < 3) continue;
      const regex = new RegExp(`\\b${escapeRegex(keyword)}\\b`, 'gi');
      const matches = content.match(regex);
      if (matches) {
        keywordHits += matches.length;
        score += Math.min(10, matches.length * 2);
        if (reasons.length < 3) {
          reasons.push(`contains "${keyword}" (${matches.length}x)`);
        }
      }
    }

    // Keyword in filename bonus
    const fileName = path.split('/').pop()?.toLowerCase() || '';
    for (const keyword of keywords) {
      if (keyword.length >= 3 && fileName.includes(keyword)) {
        score += 20;
        reasons.push(`filename matches "${keyword}"`);
      }
    }

    // Entry point bonus
    if (/index\.(ts|js|tsx|jsx)$/.test(path)) score += 3;
    if (/main\.(ts|js|tsx|jsx)$/.test(path)) score += 3;

    // Depth penalty — prefer shallower files
    const depth = path.split('/').length;
    score -= depth * 0.5;

    if (score > 0) {
      scored.push({ path, score, reason: reasons.slice(0, 3).join('; ') });
    }
  }

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  // Take top N files
  let selected = scored.slice(0, opts.maxFiles);

  // Step 3: Trace imports from selected files to find connected files
  const selectedPaths = new Set(selected.map((s) => s.path));
  const importedPaths = new Set<string>();
  const allAvailablePaths = Object.keys(fileContents);

  for (const { path } of selected) {
    const content = fileContents[path];
    const rawImports = extractImports(content, path);
    for (const imp of rawImports) {
      const resolved = resolveImportToFile(imp, allAvailablePaths);
      if (resolved && !selectedPaths.has(resolved) && fileContents[resolved]) {
        importedPaths.add(resolved);
      }
    }
  }

  // Add imported files (up to the limit)
  const remaining = opts.maxFiles - selected.length;
  if (remaining > 0) {
    const importArr = [...importedPaths].slice(0, remaining);
    for (const imp of importArr) {
      selected.push({ path: imp, score: 5, reason: 'imported by matched file' });
    }
  }

  // Build result
  const files: Record<string, string> = {};
  const matchReasons: Record<string, string> = {};

  for (const { path, reason } of selected) {
    files[path] = fileContents[path];
    matchReasons[path] = reason;
  }

  return { files, keywords, matchReasons };
}

function extractImports(content: string, filePath: string): string[] {
  const imports: string[] = [];
  const dir = filePath.split('/').slice(0, -1).join('/');

  // ES import/export
  const esImportRegex = /(?:import|export)\s+.*?from\s+['"]([^'"]+)['"]/g;
  // require()
  const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  // Python import
  const pyImportRegex = /(?:from|import)\s+([\w.]+)/g;

  for (const regex of [esImportRegex, requireRegex]) {
    let match;
    while ((match = regex.exec(content)) !== null) {
      const specifier = match[1];
      if (specifier.startsWith('.')) {
        const resolved = resolveRelativeImport(dir, specifier);
        if (resolved) imports.push(resolved);
      }
    }
  }

  // Python imports
  if (filePath.endsWith('.py')) {
    let match;
    while ((match = pyImportRegex.exec(content)) !== null) {
      const modPath = match[1].replace(/\./g, '/') + '.py';
      imports.push(modPath);
    }
  }

  return imports;
}

function resolveRelativeImport(dir: string, specifier: string): string | null {
  const parts = [...dir.split('/'), ...specifier.split('/')].filter(Boolean);
  const resolved: string[] = [];
  for (const part of parts) {
    if (part === '.') continue;
    if (part === '..') { resolved.pop(); continue; }
    resolved.push(part);
  }
  return resolved.join('/');
}

function resolveImportToFile(basePath: string, availablePaths: string[]): string | null {
  if (availablePaths.includes(basePath)) return basePath;
  const extensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs'];
  for (const ext of extensions) {
    const withExt = basePath + ext;
    if (availablePaths.includes(withExt)) return withExt;
  }
  for (const ext of extensions) {
    const indexPath = basePath + '/index' + ext;
    if (availablePaths.includes(indexPath)) return indexPath;
  }
  return null;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
