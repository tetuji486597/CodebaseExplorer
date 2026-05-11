import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, relative, extname } from 'path';

const SKIP_DIRS = new Set([
  'node_modules', '.git', '.next', '.nuxt', 'dist', 'build', 'out',
  '.cache', '.turbo', '.vercel', '__pycache__', '.mypy_cache',
  'venv', '.venv', 'env', 'vendor', 'target', 'coverage',
  '.svelte-kit', '.output', '.parcel-cache', '.expo',
]);

const SKIP_FILENAMES = new Set([
  'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml',
  'Cargo.lock', 'poetry.lock', 'Gemfile.lock', 'composer.lock',
  'LICENSE', 'LICENSE.md', 'CHANGELOG', 'CHANGELOG.md',
  '.env', '.env.example', '.env.sample', '.env.local',
  '.DS_Store', 'Thumbs.db',
]);

const SKIP_EXTENSIONS = new Set([
  '.min.js', '.min.css', '.map', '.ico', '.lock',
  '.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.avif',
  '.woff', '.woff2', '.ttf', '.eot', '.otf',
  '.mp3', '.mp4', '.wav', '.ogg', '.webm',
  '.zip', '.tar', '.gz', '.br', '.zst',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx',
  '.pyc', '.pyo', '.class', '.o', '.so', '.dylib', '.dll',
]);

const CODE_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.py', '.rb', '.go', '.rs', '.java', '.kt', '.kts',
  '.cs', '.php', '.swift', '.dart', '.scala', '.clj',
  '.lua', '.zig', '.nim', '.ex', '.exs', '.erl',
  '.vue', '.svelte', '.astro',
  '.css', '.scss', '.less', '.html',
  '.sql', '.graphql', '.gql', '.prisma',
  '.yaml', '.yml', '.toml', '.json', '.jsonc',
  '.md', '.mdx', '.txt', '.sh', '.bash', '.zsh',
  '.dockerfile', '.tf', '.hcl',
]);

const SKIP_CONFIG_PATTERNS = [
  /\.config\.(js|ts|mjs|cjs)$/,
  /^postcss\.config/, /^tailwind\.config/, /^vite\.config/,
  /^eslint\.config/, /^prettier\.config/, /^jest\.config/,
  /^vitest\.config/, /^babel\.config/, /^webpack\.config/,
  /^tsconfig.*\.json$/,
];

const MAX_FILE_SIZE = 100_000; // 100KB

export interface RepoReadResult {
  fileContents: Record<string, string>;
  framework: string;
  language: string;
}

export async function readLocalRepo(dir: string): Promise<RepoReadResult> {
  const fileContents: Record<string, string> = {};

  function walk(currentDir: string) {
    let entries: string[];
    try {
      entries = readdirSync(currentDir);
    } catch {
      return;
    }

    for (const entry of entries) {
      if (SKIP_DIRS.has(entry)) continue;
      if (entry.startsWith('.') && entry !== '.env') continue;

      const fullPath = join(currentDir, entry);
      let stat;
      try {
        stat = statSync(fullPath);
      } catch {
        continue;
      }

      if (stat.isDirectory()) {
        walk(fullPath);
      } else if (stat.isFile()) {
        if (stat.size > MAX_FILE_SIZE) continue;
        if (SKIP_FILENAMES.has(entry)) continue;

        const ext = extname(entry).toLowerCase();
        if (SKIP_EXTENSIONS.has(ext)) continue;

        // Only read known code file types
        const hasCodeExt = CODE_EXTENSIONS.has(ext) || entry === 'Makefile' || entry === 'Dockerfile';
        if (!hasCodeExt) continue;

        try {
          const content = readFileSync(fullPath, 'utf-8');
          const relPath = relative(dir, fullPath).replace(/\\/g, '/');
          fileContents[relPath] = content;
        } catch {
          // skip unreadable files
        }
      }
    }
  }

  walk(dir);

  // Filter out low-value files for analysis
  const filtered = filterForAnalysis(fileContents);
  const framework = detectFramework(fileContents);
  const language = detectLanguage(fileContents);

  return { fileContents: filtered, framework, language };
}

function filterForAnalysis(fileContents: Record<string, string>): Record<string, string> {
  const filtered: Record<string, string> = {};
  for (const [path, content] of Object.entries(fileContents)) {
    const fileName = path.split('/').pop() || '';
    if (SKIP_FILENAMES.has(fileName)) continue;
    if (fileName.endsWith('.d.ts')) continue;
    if (SKIP_CONFIG_PATTERNS.some((p) => p.test(fileName))) continue;
    if (fileName.endsWith('.svg') && content.length > 2000) continue;
    filtered[path] = content;
  }
  return filtered;
}

function detectFramework(fileContents: Record<string, string>): string {
  const paths = Object.keys(fileContents);
  const frameworks: string[] = [];

  const pkgJson = fileContents['package.json'];
  if (pkgJson) {
    try {
      const pkg = JSON.parse(pkgJson);
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      if (deps['next']) frameworks.push('Next.js');
      else if (deps['react']) frameworks.push('React');
      if (deps['vue']) frameworks.push('Vue');
      if (deps['express']) frameworks.push('Express');
      if (deps['hono']) frameworks.push('Hono');
      if (deps['fastify']) frameworks.push('Fastify');
      if (deps['@angular/core']) frameworks.push('Angular');
      if (deps['svelte']) frameworks.push('Svelte');
      if (deps['django']) frameworks.push('Django');
      if (deps['flask']) frameworks.push('Flask');
    } catch {}
  }

  if (paths.some((p) => p.includes('requirements.txt'))) frameworks.push('Python');
  if (paths.some((p) => p.includes('go.mod'))) frameworks.push('Go');
  if (paths.some((p) => p.includes('Cargo.toml'))) frameworks.push('Rust');

  return frameworks.join(' + ') || 'Unknown';
}

function detectLanguage(fileContents: Record<string, string>): string {
  const exts: Record<string, number> = {};
  for (const path of Object.keys(fileContents)) {
    const ext = path.split('.').pop() || '';
    exts[ext] = (exts[ext] || 0) + 1;
  }

  const langMap: Record<string, string> = {
    ts: 'TypeScript', tsx: 'TypeScript', js: 'JavaScript', jsx: 'JavaScript',
    py: 'Python', rb: 'Ruby', go: 'Go', rs: 'Rust', java: 'Java',
    kt: 'Kotlin', php: 'PHP', cs: 'C#', swift: 'Swift', dart: 'Dart',
  };

  const sorted = Object.entries(exts).sort((a, b) => b[1] - a[1]);
  for (const [ext] of sorted) {
    if (langMap[ext]) return langMap[ext];
  }
  return 'Unknown';
}
