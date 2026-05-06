import { resolve, basename } from 'path';
import { readLocalRepo } from '../lib/fileReader.js';
import { existsSync } from 'fs';
import { config } from 'dotenv';
import { exec } from 'child_process';
import { login, getToken, clearCredentials, getApiBase, getWebBase } from '../lib/auth.js';
import { saveProject, getProjectForRepo, listProjects } from '../lib/projects.js';
import { sendChatMessage, interactiveChat, fetchSessions, fetchSessionMessages } from '../lib/chat.js';
import { renderConceptMap, renderAnswer, renderShareLink, renderFollowUpHint, ansi, type ConceptData, type EdgeData } from '../lib/display.js';
import { getLocalFiles, scopeLocalFiles } from '../lib/localContext.js';
import React from 'react';
import { render } from 'ink';
import { App } from '../ui/App.js';

// Load .env silently
for (const dir of [process.cwd(), resolve(process.cwd(), '..')]) {
  const envPath = resolve(dir, '.env');
  if (existsSync(envPath)) { config({ path: envPath, quiet: true }); break; }
}

const args = process.argv.slice(2);
const flags: Record<string, string> = {};
const positional: string[] = [];

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--dir' && args[i + 1]) {
    flags.dir = args[++i];
  } else if (args[i] === '--max-files' && args[i + 1]) {
    flags.maxFiles = args[++i];
  } else if (args[i] === '--new') {
    flags.new = 'true';
  } else if (args[i] === '--open') {
    flags.open = 'true';
  } else if (args[i] === '--help' || args[i] === '-h') {
    printHelp();
    process.exit(0);
  } else if (!args[i].startsWith('--')) {
    positional.push(args[i]);
  }
}

// Handle subcommands
const subcommand = positional[0];

if (subcommand === 'login') {
  login()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('\n  Login failed:', err.message);
      process.exit(1);
    });
} else if (subcommand === 'logout') {
  clearCredentials();
  console.log('\n  Logged out.\n');
  process.exit(0);
} else if (subcommand === 'chat') {
  requireToken((token) => {
    const repoDir = resolve(flags.dir || '.');
    const cached = getProjectForRepo(repoDir);
    if (!cached) {
      console.error('\n  No project found for this directory. Run `gui` first to analyze.\n');
      process.exit(1);
    }
    interactiveChat(cached.projectId, token, cached.repoName, repoDir);
  });
} else if (subcommand === 'projects') {
  const projects = listProjects();
  if (projects.length === 0) {
    console.log('\n  No projects yet. Run `gui` in a repo to analyze it.\n');
  } else {
    console.log('\n  Your projects:\n');
    for (const p of projects.reverse()) {
      const date = new Date(p.createdAt).toLocaleDateString();
      console.log(`  ${p.repoName.padEnd(30)} ${date}  ${p.projectId}`);
    }
    console.log();
  }
  process.exit(0);
} else if (subcommand === 'open') {
  const repoDir = resolve(flags.dir || '.');
  const cached = getProjectForRepo(repoDir);
  if (!cached) {
    console.error('\n  No project found for this directory.\n');
    process.exit(1);
  }
  const url = `${getWebBase()}/explore/${cached.projectId}`;
  console.log(`\n  ${url}\n`);
  openBrowser(url);
  process.exit(0);
} else if (subcommand === 'share') {
  requireToken(async (token) => {
    const repoDir = resolve(flags.dir || '.');
    const cached = getProjectForRepo(repoDir);
    if (!cached) {
      console.error('\n  No project found for this directory.\n');
      process.exit(1);
    }
    const url = `${getWebBase()}/explore/${cached.projectId}`;
    console.log(`\n  Share link: ${url}\n`);
    process.exit(0);
  });
} else if (subcommand === 'status') {
  requireToken(async (token) => {
    const repoDir = resolve(flags.dir || '.');
    const cached = getProjectForRepo(repoDir);
    if (!cached) {
      console.error('\n  No project found for this directory.\n');
      process.exit(1);
    }
    const apiBase = getApiBase();
    const res = await fetch(`${apiBase}/api/cx/project/status/${cached.projectId}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!res.ok) {
      console.error('\n  Could not fetch status.\n');
      process.exit(1);
    }
    const data = await res.json();
    console.log(`\n  Project: ${cached.repoName}`);
    console.log(`  Status:  ${data.pipeline_status}`);
    console.log(`  ID:      ${cached.projectId}\n`);
    process.exit(0);
  });
} else if (subcommand === 'history') {
  requireToken(async (token) => {
    const repoDir = resolve(flags.dir || '.');
    const cached = getProjectForRepo(repoDir);
    if (!cached) {
      console.error('\n  No project found for this directory. Run `gui` first to analyze.\n');
      process.exit(1);
    }

    const sessions = await fetchSessions(cached.projectId, token);
    if (sessions.length === 0) {
      console.log('\n  No chat history for this project.\n');
      process.exit(0);
    }

    const sessionIndex = positional[1] ? parseInt(positional[1], 10) : null;

    if (sessionIndex !== null && sessionIndex >= 1 && sessionIndex <= sessions.length) {
      const session = sessions[sessionIndex - 1];
      const messages = await fetchSessionMessages(cached.projectId, session.sessionId, token);
      console.log(`\n  ${ansi.bold}${cached.repoName}${ansi.reset} — session ${sessionIndex}\n`);
      for (const msg of messages) {
        const time = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const sourceTag = msg.source === 'cli' ? ansi.dim + ' [cli]' + ansi.reset : msg.source === 'web' ? ansi.dim + ' [web]' + ansi.reset : '';
        if (msg.role === 'user') {
          console.log(`  ${ansi.cyan}You${ansi.reset}${sourceTag} ${ansi.dim}${time}${ansi.reset}`);
          console.log(`  ${msg.content}\n`);
        } else {
          console.log(`  ${ansi.green}Assistant${ansi.reset}${sourceTag} ${ansi.dim}${time}${ansi.reset}`);
          const lines = msg.content.split('\n');
          for (const line of lines) {
            console.log(`  ${line}`);
          }
          console.log();
        }
      }
    } else {
      console.log(`\n  ${ansi.bold}Chat History${ansi.reset} — ${cached.repoName}\n`);
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const yesterday = new Date(today.getTime() - 86400000);
      const weekAgo = new Date(today.getTime() - 7 * 86400000);

      let lastGroup = '';
      sessions.forEach((s, i) => {
        const d = new Date(s.startedAt);
        let group = 'Older';
        if (d >= today) group = 'Today';
        else if (d >= yesterday) group = 'Yesterday';
        else if (d >= weekAgo) group = 'This Week';

        if (group !== lastGroup) {
          console.log(`  ${ansi.dim}${group}${ansi.reset}`);
          lastGroup = group;
        }

        const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const preview = (s.preview || 'Untitled').slice(0, 50).padEnd(52);
        const count = `${s.messageCount} msg${s.messageCount !== 1 ? 's' : ''}`;
        const sources = s.sources.join(',');
        console.log(`    ${ansi.bold}${String(i + 1).padStart(2)}.${ansi.reset} ${preview} ${ansi.dim}${time}  ·  ${count}  ·  ${sources}${ansi.reset}`);
      });
      console.log(`\n  ${ansi.dim}Run \`gui history <n>\` to view a session${ansi.reset}\n`);
    }
    process.exit(0);
  });
} else {
  // Default: analyze or chat
  const query = positional.join(' ');
  const repoDir = resolve(flags.dir || '.');
  const cached = flags.new !== 'true' ? getProjectForRepo(repoDir) : null;

  const handleError = (err: any) => {
    console.error('\n  Error:', err.message || err);
    process.exit(1);
  };

  if (query && cached) {
    // Known codebase + question → one-shot chat (non-interactive)
    await requireToken((token) => { followUpChat(cached, query, repoDir, token).catch(handleError); });
  } else if (query && !cached) {
    // New codebase + question → analyze first, then chat
    await requireToken((token) => { analyzeAndChat(repoDir, query, token).catch(handleError); });
  } else {
    // No query → launch interactive TUI
    const token = await getToken();
    const repoName = basename(repoDir);
    render(
      React.createElement(App, {
        projectId: cached?.projectId || null,
        repoName,
        token: token || '',
        needsAnalysis: !cached,
        repoDir,
      })
    );
  }
}

async function requireToken(fn: (token: string) => void) {
  const token = await getToken();
  if (!token) {
    console.error('\n  Not logged in. Run `gui login` first.\n');
    process.exit(1);
  }
  fn(token);
}

async function followUpChat(
  cached: { projectId: string; repoName: string },
  query: string,
  repoDir: string,
  token: string,
) {
  const repoName = basename(repoDir);
  const apiBase = getApiBase();

  // Verify project is still valid on the server
  try {
    const res = await fetch(`${apiBase}/api/cx/project/status/${cached.projectId}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!res.ok) throw new Error('gone');
  } catch {
    // Project no longer exists — re-analyze then chat
    return analyzeAndChat(repoDir, query, token);
  }

  console.log(`\n  ${ansi.bold}gui${ansi.reset}  ${ansi.dim}following up on ${repoName}${ansi.reset}`);
  const allFiles = await getLocalFiles(repoDir);
  const scopedFiles = scopeLocalFiles(query, allFiles, 12);
  await sendChatMessage(cached.projectId, query, token, [], undefined, scopedFiles);
  const mapUrl = `${getWebBase()}/explore/${cached.projectId}`;
  console.log(renderShareLink(mapUrl));
  console.log(renderFollowUpHint());
}

async function analyzePipeline(repoDir: string, token: string): Promise<string> {
  const repoName = basename(repoDir);
  const maxFiles = parseInt(flags.maxFiles || '30', 10);

  console.log(`\n  ${ansi.bold}gui${ansi.reset}  ${ansi.dim}codebase explorer${ansi.reset}\n`);
  console.log(`  ${ansi.dim}Repo${ansi.reset}   ${repoName}\n`);

  process.stdout.write(`  ${ansi.dim}Reading files...${ansi.reset}`);
  const { fileContents, framework, language } = await readLocalRepo(repoDir);
  const totalFiles = Object.keys(fileContents).length;
  console.log(` ${ansi.green}${totalFiles} files${ansi.reset} ${ansi.dim}(${framework}, ${language})${ansi.reset}`);

  const apiBase = getApiBase();
  const response = await fetch(`${apiBase}/api/cx/pipeline`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      files: fileContents,
      framework,
      language,
      repoName,
      maxFiles,
    }),
  });

  if (!response.ok) {
    if (response.status === 401) {
      console.error('\n  Session expired. Run `gui login` to re-authenticate.\n');
      process.exit(1);
    }
    const err = await response.text();
    throw new Error(`Server error (${response.status}): ${err}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response stream');

  const decoder = new TextDecoder();
  let shareUrl = '';
  let projectId = '';
  let answerText = '';
  let concepts: ConceptData[] = [];
  let edges: EdgeData[] = [];
  let buffer = '';
  const start = Date.now();

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

        if (event.stage === 'classifying') {
          renderProgress('Classifying', 0, event.total || 0);
        } else if (event.stage === 'analyzing') {
          clearProgress();
          renderProgress('Analyzing', 0, event.total || 0);
        } else if (event.stage === 'analyzing_progress') {
          renderProgress('Analyzing', event.current || 0, event.total || 0, event.file);
        } else if (event.stage === 'synthesizing') {
          clearProgress();
          renderProgress('Synthesizing', 0, 1);
        } else if (event.stage === 'synthesized') {
          clearProgress();
          console.log(`  ${ansi.green}\u2713${ansi.reset} ${ansi.dim}Analysis complete${ansi.reset}`);
          shareUrl = event.shareUrl || shareUrl;
          projectId = event.projectId || projectId;
          if (event.concepts) concepts = event.concepts;
          if (event.edges) edges = event.edges;
        } else if (event.stage === 'answering') {
          renderProgress('Generating answer', 0, 1);
        } else if (event.stage === 'answer_chunk') {
          answerText += event.text;
        } else if (event.stage === 'complete') {
          clearProgress();
          shareUrl = event.shareUrl || shareUrl;
          projectId = event.projectId || projectId;
          if (event.cached) {
            console.log(`  ${ansi.dim}Using cached analysis.${ansi.reset}`);
          }
        } else if (event.stage === 'error') {
          clearProgress();
          throw new Error(event.message);
        }
      } catch (e: any) {
        if (e.message && !e.message.includes('JSON')) throw e;
      }
    }
  }

  if (concepts.length > 0) {
    console.log(renderConceptMap(concepts, edges));
  }

  if (answerText) {
    console.log(renderAnswer(answerText));
  }

  if (!shareUrl && projectId) {
    shareUrl = `${getWebBase()}/explore/${projectId}`;
  }

  if (projectId) {
    saveProject(repoDir, projectId, '', repoName);
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);

  if (shareUrl) {
    console.log(renderShareLink(shareUrl));
  }

  console.log(`  ${ansi.dim}Completed in ${elapsed}s${ansi.reset}`);
  console.log(renderFollowUpHint('analyzed'));

  if (shareUrl && flags.open === 'true') {
    openBrowser(shareUrl);
  }

  return projectId;
}

async function analyzeAndChat(repoDir: string, query: string, token: string) {
  const projectId = await analyzePipeline(repoDir, token);
  if (!projectId) {
    console.error('\n  Analysis failed — cannot send question.\n');
    process.exit(1);
  }

  console.log(`\n  ${ansi.dim}Asking: ${query}${ansi.reset}\n`);
  await sendChatMessage(projectId, query, token);
  console.log(renderFollowUpHint());
}

function renderProgress(label: string, current: number, total: number, file?: string) {
  const width = 24;
  const pct = total > 0 ? Math.min(current / total, 1) : 0;
  const filled = Math.round(pct * width);
  const bar = ansi.green + '\u2588'.repeat(filled) + ansi.reset + ansi.dim + '\u2591'.repeat(width - filled) + ansi.reset;
  const pctStr = total > 0 ? ` ${Math.round(pct * 100)}%` : '';
  const detail = current > 0 && total > 0 ? ` ${ansi.dim}(${current}/${total})${ansi.reset}` : '';
  const fileHint = file ? ` ${ansi.dim}${file}${ansi.reset}` : '';
  process.stdout.write(`\r  ${label} ${bar}${pctStr}${detail}${fileHint}${''.padEnd(20)}`);
}

function clearProgress() {
  process.stdout.write(`\r${''.padEnd(100)}\r`);
}

function openBrowser(url: string) {
  const cmd = process.platform === 'win32' ? `start "" "${url}"`
    : process.platform === 'darwin' ? `open "${url}"`
    : `xdg-open "${url}"`;
  exec(cmd);
}

function printHelp() {
  console.log(`
  gui — codebase explorer

  Usage:
    gui                               Analyze current repo (or chat if already analyzed)
    gui "how does auth work?"         Ask a question about the codebase
    gui --new                         Force re-analysis of current repo

  Subcommands:
    gui login                         Log in to your account
    gui logout                        Clear stored credentials
    gui chat                          Interactive chat about current repo
    gui history                       Browse chat history for current repo
    gui history <n>                   View messages in session n
    gui projects                      List your analyzed projects
    gui open                          Open current repo in browser
    gui share                         Get share link for current repo
    gui status                        Show pipeline status for current repo

  Options:
    --dir <path>       Repository directory (default: current directory)
    --max-files <n>    Max files to analyze (default: 30)
    --new              Force new analysis
    --open             Open the URL in your browser
    -h, --help         Show this help message
  `);
}
