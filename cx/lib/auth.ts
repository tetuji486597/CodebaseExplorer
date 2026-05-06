import { createServer } from 'http';
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { resolve } from 'path';
import { exec } from 'child_process';

const CONFIG_DIR = resolve(process.env.HOME || process.env.USERPROFILE || '~', '.gui');
const CREDENTIALS_PATH = resolve(CONFIG_DIR, 'credentials.json');

const SUPABASE_URL = 'https://fpmnuoglufvdmjtsarqx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZwbW51b2dsdWZ2ZG1qdHNhcnF4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwMTM1ODQsImV4cCI6MjA5MDU4OTU4NH0.bLEyDaVi8kuiRMZ0pLsf7mEBhtm6o4PqktMb_9MdfHs';

interface Credentials {
  access_token: string;
  refresh_token: string;
  expires_at: number;
}

export function getApiBase(): string {
  return process.env.CX_API_URL || 'https://codebaseexplorer.onrender.com';
}

export function getWebBase(): string {
  return process.env.CX_WEB_URL || 'https://codebase-explorer-five.vercel.app';
}

export function isLoggedIn(): boolean {
  return existsSync(CREDENTIALS_PATH);
}

function loadCredentials(): Credentials | null {
  if (!existsSync(CREDENTIALS_PATH)) return null;
  try {
    return JSON.parse(readFileSync(CREDENTIALS_PATH, 'utf-8'));
  } catch {
    return null;
  }
}

async function refreshSession(refreshToken: string): Promise<Credentials | null> {
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.access_token || !data.refresh_token) return null;
    const creds: Credentials = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: Date.now() + (data.expires_in || 3600) * 1000,
    };
    saveCredentials(creds);
    return creds;
  } catch {
    return null;
  }
}

export async function getToken(): Promise<string | null> {
  const creds = loadCredentials();
  if (!creds) return null;

  // Token still valid (with 60s buffer)
  if (creds.expires_at && Date.now() < (creds.expires_at - 60_000)) {
    return creds.access_token;
  }

  // Expired — try refresh
  if (creds.refresh_token) {
    const refreshed = await refreshSession(creds.refresh_token);
    if (refreshed) return refreshed.access_token;
  }

  return null;
}

export function clearCredentials(): void {
  if (existsSync(CREDENTIALS_PATH)) {
    writeFileSync(CREDENTIALS_PATH, '', 'utf-8');
    const { unlinkSync } = require('fs');
    unlinkSync(CREDENTIALS_PATH);
  }
}

function saveCredentials(creds: Credentials): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
  writeFileSync(CREDENTIALS_PATH, JSON.stringify(creds, null, 2), 'utf-8');
}

function openBrowser(url: string): void {
  const cmd = process.platform === 'win32' ? `start "" "${url}"`
    : process.platform === 'darwin' ? `open "${url}"`
    : `xdg-open "${url}"`;
  exec(cmd);
}

/**
 * Browser-based login flow:
 * 1. Start a localhost HTTP server on a random port
 * 2. Open browser to the auth page with redirect to localhost
 * 3. Wait for the callback with the token
 * 4. Save credentials and shut down the server
 */
export function login(): Promise<void> {
  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url || '/', `http://localhost`);

      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }

      if (url.pathname === '/callback') {
        const accessToken = url.searchParams.get('access_token');
        const refreshToken = url.searchParams.get('refresh_token');
        const expiresIn = parseInt(url.searchParams.get('expires_in') || '3600', 10);

        if (accessToken) {
          saveCredentials({
            access_token: accessToken,
            refresh_token: refreshToken || '',
            expires_at: Date.now() + expiresIn * 1000,
          });

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true }));

          server.close();
          console.log('\n  Authenticated successfully.\n');
          console.log('  Navigate to a repo and run:\n');
          console.log('    gui              Analyze your codebase');
          console.log('    gui "question"   Ask about architecture, data flows, etc.\n');
          resolve();
        } else {
          res.writeHead(400, { 'Content-Type': 'text/plain' });
          res.end('Missing token');
          server.close();
          reject(new Error('No token received'));
        }
        return;
      }

      res.writeHead(404);
      res.end('Not found');
    });

    server.listen(0, () => {
      const addr = server.address();
      if (!addr || typeof addr === 'string') {
        reject(new Error('Failed to start auth server'));
        return;
      }
      const port = addr.port;
      const authUrl = `${getWebBase()}/cli-auth?port=${port}`;

      console.log(`\n  Opening browser to log in...`);
      console.log(`  If it doesn't open, visit: ${authUrl}\n`);
      openBrowser(authUrl);
    });

    // Timeout after 2 minutes
    setTimeout(() => {
      server.close();
      reject(new Error('Login timed out'));
    }, 120_000);
  });
}

