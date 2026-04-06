import { supabase } from '../db/supabase.js';
import { runFileAnalysis } from './fileAnalysis.js';
import { runConceptSynthesis } from './conceptSynthesis.js';
import { runDepthMapping } from './depthMapping.js';
import { runInsightGeneration } from './insightGeneration.js';
import { runEmbedding } from './embedding.js';
import { runProactiveSeeding } from './proactiveSeeding.js';
import { runConceptMapping } from './conceptMapping.js';

export interface PipelineInput {
  fileTree: any;
  fileContents: Record<string, string>;
  importEdges: Array<{ source: string; target: string }>;
}

async function updateProgress(projectId: string, stage: number, message: string, status?: string) {
  await supabase
    .from('projects')
    .update({
      pipeline_status: status || `stage_${stage}`,
      pipeline_progress: { stage, total_stages: 7, message },
    })
    .eq('id', projectId);
}

export async function runPipeline(projectId: string, input: PipelineInput) {
  try {
    await updateProgress(projectId, 0, 'Starting pipeline...', 'processing');

    // Stage 1: File classification (happens client-side, we just store files)
    await updateProgress(projectId, 1, 'Classifying files...');
    const fileEntries = Object.entries(input.fileContents);

    // Detect framework
    const framework = detectFramework(input.fileContents);
    const language = detectLanguage(input.fileContents);

    await supabase
      .from('projects')
      .update({ framework, language, file_count: fileEntries.length })
      .eq('id', projectId);

    // Store files
    const fileRows = fileEntries.map(([path, content]) => ({
      project_id: projectId,
      path,
      name: path.split('/').pop() || path,
      content,
      role: classifyFile(path, content),
      importance_score: 0,
    }));

    // Insert in batches to avoid size limits
    for (let i = 0; i < fileRows.length; i += 50) {
      await supabase.from('files').insert(fileRows.slice(i, i + 50));
    }

    // Filter out low-value files from AI analysis (still stored in DB above)
    const analysisContents = filterForAnalysis(input.fileContents);
    console.log(`Filtered ${Object.keys(input.fileContents).length} files to ${Object.keys(analysisContents).length} for analysis`);

    // Stage 2: Parallel file analysis
    await updateProgress(projectId, 2, 'Analyzing file structure and dependencies...');
    const fileAnalyses = await runFileAnalysis(projectId, analysisContents, framework, input.fileTree);

    // Stage 3: Concept synthesis
    await updateProgress(projectId, 3, 'Identifying architectural concepts...');
    const synthesis = await runConceptSynthesis(projectId, fileAnalyses, input.fileTree, framework);

    // Stage 4: Depth mapping (runs first to avoid rate limit contention)
    await updateProgress(projectId, 4, 'Generating multi-level explanations...');
    await runDepthMapping(projectId, synthesis, fileAnalyses);

    // Stage 5: Insight generation (sequential to avoid rate limits)
    await updateProgress(projectId, 5, 'Generating architecture insights...');
    await runInsightGeneration(projectId, synthesis, fileAnalyses);

    // Stage 6: Proactive seeding (moved before embedding so UI loads sooner)
    await updateProgress(projectId, 6, 'Building your learning path...');
    await runProactiveSeeding(projectId, synthesis);

    // Stage 6.5: Map concepts to universal taxonomy (fast, non-blocking)
    await runConceptMapping(projectId).catch((err) => {
      console.error(`Concept mapping failed for project ${projectId}:`, err);
    });

    // Mark pipeline complete — UI can load now
    await updateProgress(projectId, 6, 'Pipeline complete!', 'complete');
    console.log(`Pipeline complete for project ${projectId}`);

    // Stage 7: Embedding & indexing (runs in background, not blocking UI)
    runEmbedding(projectId, input.fileContents, fileAnalyses, synthesis).catch((err) => {
      console.error(`Background embedding failed for project ${projectId}:`, err);
    });
  } catch (err) {
    console.error(`Pipeline failed for project ${projectId}:`, err);
    await supabase
      .from('projects')
      .update({
        pipeline_status: 'failed',
        pipeline_progress: { error: (err as Error).message },
      })
      .eq('id', projectId);
  }
}

function classifyFile(path: string, content: string): string {
  if (/\.(test|spec)\.(js|ts|jsx|tsx)$/.test(path)) return 'test';
  if (/\.(config|rc)\.(js|ts|json)$/.test(path)) return 'config';
  if (/(types|interfaces|models)\.(ts|d\.ts)$/.test(path)) return 'types';
  if (/components\//.test(path)) return 'ui';
  if (/(utils?|helpers?|lib)\//.test(path)) return 'utility';
  if (/(routes?|api|controllers?)\//.test(path)) return 'api';
  if (/(middleware|hooks)\//.test(path)) return 'middleware';
  if (/package\.json|tsconfig|\.env/.test(path)) return 'config';
  return 'source';
}

function detectFramework(fileContents: Record<string, string>): string {
  const paths = Object.keys(fileContents);
  const frameworks: string[] = [];

  // Check for package.json
  const pkgJson = fileContents['package.json'] || fileContents['./package.json'];
  if (pkgJson) {
    try {
      const pkg = JSON.parse(pkgJson);
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      if (deps['react']) frameworks.push('React');
      if (deps['next']) frameworks.push('Next.js');
      if (deps['vue']) frameworks.push('Vue');
      if (deps['express']) frameworks.push('Express');
      if (deps['hono']) frameworks.push('Hono');
      if (deps['fastify']) frameworks.push('Fastify');
      if (deps['@angular/core']) frameworks.push('Angular');
      if (deps['svelte']) frameworks.push('Svelte');
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

const SKIP_FILENAMES = new Set([
  'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml',
  'Cargo.lock', 'poetry.lock', 'Gemfile.lock', 'composer.lock',
  'LICENSE', 'LICENSE.md', 'CHANGELOG', 'CHANGELOG.md',
  '.env.example', '.env.sample',
  'index.html',
]);

const SKIP_EXTENSIONS = [
  '.min.js', '.min.css', '.map', '.ico', '.lock',
];

const SKIP_CONFIG_PATTERNS = [
  /\.config\.(js|ts|mjs|cjs)$/,
  /\.config\.(json)$/,
  /^postcss\.config/,
  /^tailwind\.config/,
  /^vite\.config/,
  /^eslint\.config/,
  /^prettier\.config/,
  /^jest\.config/,
  /^vitest\.config/,
  /^babel\.config/,
  /^webpack\.config/,
  /^tsconfig.*\.json$/,
];

function filterForAnalysis(fileContents: Record<string, string>): Record<string, string> {
  const filtered: Record<string, string> = {};
  for (const [path, content] of Object.entries(fileContents)) {
    const fileName = path.split('/').pop() || '';
    if (SKIP_FILENAMES.has(fileName)) continue;
    if (SKIP_EXTENSIONS.some((ext) => fileName.endsWith(ext))) continue;
    if (fileName.endsWith('.d.ts')) continue;
    if (SKIP_CONFIG_PATTERNS.some((pattern) => pattern.test(fileName))) continue;
    // Skip very long SVGs (likely generated/icons)
    if (fileName.endsWith('.svg') && content.length > 2000) continue;
    filtered[path] = content;
  }
  return filtered;
}
