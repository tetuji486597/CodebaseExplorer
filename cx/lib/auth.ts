import { createServer } from 'http';
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { resolve } from 'path';
import { exec } from 'child_process';

const CONFIG_DIR = resolve(process.env.HOME || process.env.USERPROFILE || '~', '.gui');
const CREDENTIALS_PATH = resolve(CONFIG_DIR, 'credentials.json');

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

export function getToken(): string | null {
  if (!existsSync(CREDENTIALS_PATH)) return null;
  try {
    const creds: Credentials = JSON.parse(readFileSync(CREDENTIALS_PATH, 'utf-8'));
    // Check if token is expired (with 60s buffer)
    if (creds.expires_at && Date.now() > (creds.expires_at - 60_000)) {
      return null; // Expired — caller should re-login
    }
    return creds.access_token;
  } catch {
    return null;
  }
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

          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(buildSuccessPage());

          server.close();
          console.log('\n  Authenticated successfully.\n');
          console.log('  You\'re ready to go. Navigate to a repo and run:\n');
          console.log('    gui "how does authentication work?"\n');
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

function buildSuccessPage(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Authenticated — Codebase Explorer</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Fraunces:ital,opsz,wght@1,9..144,500&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
  *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
  :root {
    --bg-base: #F3EEEA;
    --bg-surface: #EAE3DE;
    --text-primary: #2D3A37;
    --text-secondary: #586F6B;
    --text-tertiary: #8A9691;
    --accent: #7F9183;
    --accent-soft: #DDE3DC;
    --border-subtle: #DDD5D0;
    --shadow: 0 6px 16px rgba(88, 111, 107, 0.08);
    --radius: 16px;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg-base: #1E2423;
      --bg-surface: #242B29;
      --text-primary: #E8E2DD;
      --text-secondary: #B8B8AA;
      --text-tertiary: #7F9183;
      --accent: #A8C4A4;
      --accent-soft: #2F3A37;
      --border-subtle: #3A413F;
      --shadow: 0 6px 16px rgba(0, 0, 0, 0.35);
    }
  }
  body {
    font-family: 'Inter', system-ui, sans-serif;
    background: var(--bg-base);
    color: var(--text-primary);
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100vh;
    -webkit-font-smoothing: antialiased;
  }
  .bg-grid {
    position: fixed;
    inset: 0;
    background-image:
      linear-gradient(var(--border-subtle) 1px, transparent 1px),
      linear-gradient(90deg, var(--border-subtle) 1px, transparent 1px);
    background-size: 64px 64px;
    opacity: 0.4;
    mask-image: radial-gradient(ellipse at center, black 30%, transparent 70%);
    -webkit-mask-image: radial-gradient(ellipse at center, black 30%, transparent 70%);
  }
  .glow {
    position: fixed;
    top: 50%; left: 50%;
    transform: translate(-50%, -50%);
    width: 500px; height: 500px;
    border-radius: 50%;
    background: radial-gradient(circle, var(--accent-soft) 0%, transparent 70%);
    opacity: 0.5;
    pointer-events: none;
  }
  .card {
    position: relative;
    background: var(--bg-surface);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius);
    padding: 48px 44px;
    text-align: center;
    max-width: 420px;
    width: calc(100% - 2rem);
    box-shadow: var(--shadow);
    animation: card-in 0.5s cubic-bezier(0.2, 0.8, 0.2, 1) both;
  }
  @keyframes card-in {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .icon-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 52px; height: 52px;
    border-radius: 10px;
    background: var(--accent-soft);
    border: 1px solid var(--border-subtle);
    margin-bottom: 20px;
    animation: icon-in 0.4s cubic-bezier(0.2, 0.8, 0.2, 1) 0.15s both;
  }
  @keyframes icon-in {
    from { opacity: 0; transform: scale(0.8); }
    to { opacity: 1; transform: scale(1); }
  }
  .icon-badge svg { color: var(--accent); }
  h1 {
    font-family: 'Inter', sans-serif;
    font-size: 1.5rem;
    font-weight: 500;
    letter-spacing: -0.02em;
    margin-bottom: 6px;
    animation: text-in 0.4s ease 0.25s both;
  }
  h1 em {
    font-family: 'Fraunces', Georgia, serif;
    font-style: italic;
    font-weight: 500;
    color: var(--accent);
  }
  .desc {
    font-size: 14px;
    color: var(--text-secondary);
    line-height: 1.6;
    margin-bottom: 0;
    animation: text-in 0.4s ease 0.35s both;
  }
  @keyframes text-in {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .terminal {
    font-family: 'JetBrains Mono', monospace;
    font-size: 13px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0;
    margin-top: 28px;
    padding-top: 20px;
    border-top: 1px solid var(--border-subtle);
    animation: text-in 0.6s ease 0.5s both;
  }
  .terminal .dollar { color: var(--accent); font-weight: 500; }
  .terminal .cmd { color: var(--text-tertiary); }
  .terminal .cursor {
    display: inline-block;
    margin-left: 2px;
    color: var(--accent);
    font-weight: 600;
    animation: blink 1.2s ease-in-out infinite;
  }
  @keyframes blink { 0%, 100% { opacity: 0.4; } 50% { opacity: 0.7; } }
</style>
</head>
<body>
  <div class="bg-grid"></div>
  <div class="glow"></div>
  <div class="card">
    <div class="icon-badge">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <path d="m9 12 2 2 4-4"/>
      </svg>
    </div>
    <h1>You're <em>in</em></h1>
    <p class="desc">Return to your terminal to get started.</p>
    <div class="terminal">
      <span class="dollar">$</span>
      <span class="cmd">&nbsp;gui "how does auth work?"</span>
      <span class="cursor">_</span>
    </div>
  </div>
</body>
</html>`;
}
