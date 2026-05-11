#!/usr/bin/env node
import { spawnSync } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const tsFile = resolve(__dirname, 'cx.ts');

// On Windows, spawn needs the .cmd shim; using 'npx' with shell avoids that
const result = spawnSync('npx', ['tsx', tsFile, ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: process.env,
  cwd: resolve(__dirname, '..'),
  shell: true,
});

process.exit(result.status || 0);
