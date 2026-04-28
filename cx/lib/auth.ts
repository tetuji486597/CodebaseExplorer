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
  return process.env.CX_API_URL || 'https://codebase-explorer-five.vercel.app';
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
          res.end(`
            <html>
            <head><style>
              body { font-family: 'DM Sans', system-ui, sans-serif; background: #0a0a14; color: #e2e8f0;
                     display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
              .card { text-align: center; }
              h1 { color: #6366f1; font-size: 24px; margin-bottom: 8px; }
              p { color: #94a3b8; font-size: 14px; }
            </style></head>
            <body><div class="card">
              <h1>You're in</h1>
              <p>Return to your terminal and run a query to get started.</p>
            </div></body>
            </html>
          `);

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
      const authUrl = `${getApiBase()}/cli-auth?port=${port}`;

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
