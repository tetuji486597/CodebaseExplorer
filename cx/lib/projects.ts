import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve } from 'path';
import { homedir } from 'os';

interface ProjectEntry {
  projectId: string;
  contentHash: string;
  repoPath: string;
  repoName: string;
  createdAt: string;
}

interface ProjectCache {
  projects: ProjectEntry[];
}

function getCachePath(): string {
  const dir = resolve(homedir(), '.gui');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return resolve(dir, 'projects.json');
}

function readCache(): ProjectCache {
  const path = getCachePath();
  if (!existsSync(path)) return { projects: [] };
  try {
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch {
    return { projects: [] };
  }
}

function writeCache(cache: ProjectCache): void {
  writeFileSync(getCachePath(), JSON.stringify(cache, null, 2), 'utf-8');
}

export function saveProject(repoPath: string, projectId: string, contentHash: string, repoName: string): void {
  const cache = readCache();
  const existing = cache.projects.findIndex(p => p.repoPath === repoPath);
  const entry: ProjectEntry = { projectId, contentHash, repoPath, repoName, createdAt: new Date().toISOString() };

  if (existing >= 0) {
    cache.projects[existing] = entry;
  } else {
    cache.projects.push(entry);
  }

  // Keep last 50 projects
  if (cache.projects.length > 50) {
    cache.projects = cache.projects.slice(-50);
  }

  writeCache(cache);
}

export function getProjectForRepo(repoPath: string): ProjectEntry | null {
  const cache = readCache();
  return cache.projects.find(p => p.repoPath === repoPath) || null;
}

export function listProjects(): ProjectEntry[] {
  return readCache().projects;
}
