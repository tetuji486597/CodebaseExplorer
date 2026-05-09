import { resolve, basename } from 'path';
import { readLocalRepo } from '../lib/fileReader.js';
import { existsSync } from 'fs';
import { config } from 'dotenv';
import { exec } from 'child_process';
import { login, getToken, getApiBase, getWebBase } from '../lib/auth.js';
import { getProjectForRepo } from '../lib/projects.js';
import React from 'react';
import { render } from 'ink';
import { App } from '../ui/App.js';

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

const subcommand = positional[0];
const repoDir = resolve(flags.dir || '.');
const repoName = basename(repoDir);

if (subcommand === 'login') {
  // Headless login for CI/scripting — still works without TUI
  login()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('\n  Login failed:', err.message);
      process.exit(1);
    });
} else {
  // Everything else goes through the TUI
  const query = positional.join(' ');
  const token = await getToken();
  const cached = flags.new !== 'true' ? getProjectForRepo(repoDir) : null;

  render(
    React.createElement(App, {
      projectId: cached?.projectId || null,
      repoName,
      token: token || '',
      needsAnalysis: !cached,
      repoDir,
      initialQuery: query || undefined,
    })
  );
}

function printHelp() {
  console.log(`
  gui — codebase explorer

  Usage:
    gui                              Launch interactive explorer
    gui "how does auth work?"        Launch and ask a question
    gui login                        Log in via browser (for CI/scripting)

  Options:
    --dir <path>       Repository directory (default: current directory)
    --max-files <n>    Max files to analyze (default: 30)
    --new              Force new analysis
    --open             Open the URL in your browser after analysis
    -h, --help         Show this help message

  Inside the TUI:
    c / n     New chat            o     Open in browser
    s         Share link          p     Switch project
    r         Re-analyze          h     Chat history
    /         Command palette     q     Quit
  `);
}
