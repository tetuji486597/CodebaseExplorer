import { supabase } from '../db/supabase.js';
import { runFileAnalysis } from './fileAnalysis.js';
import { runConceptSynthesis } from './conceptSynthesis.js';
import { runDepthMapping } from './depthMapping.js';
import { runInsightGeneration } from './insightGeneration.js';
import { runEmbedding } from './embedding.js';
import { runProactiveSeeding } from './proactiveSeeding.js';

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

    // Stage 2: Parallel file analysis
    await updateProgress(projectId, 2, 'Analyzing files...');
    const fileAnalyses = await runFileAnalysis(projectId, input.fileContents, framework, input.fileTree);

    // Stage 3: Concept synthesis
    await updateProgress(projectId, 3, 'Synthesizing concepts...');
    const synthesis = await runConceptSynthesis(projectId, fileAnalyses, input.fileTree, framework);

    // Stage 4 & 5 run in parallel (background enrichment)
    await updateProgress(projectId, 4, 'Adding depth and insights...');
    await Promise.all([
      runDepthMapping(projectId, synthesis, fileAnalyses),
      runInsightGeneration(projectId, synthesis, fileAnalyses),
    ]);

    // Stage 6: Embedding & indexing
    await updateProgress(projectId, 6, 'Indexing for search...');
    await runEmbedding(projectId, input.fileContents, fileAnalyses, synthesis);

    // Stage 7: Proactive seeding
    await updateProgress(projectId, 7, 'Generating exploration path...');
    await runProactiveSeeding(projectId, synthesis);

    await updateProgress(projectId, 7, 'Pipeline complete!', 'complete');
    console.log(`Pipeline complete for project ${projectId}`);
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
