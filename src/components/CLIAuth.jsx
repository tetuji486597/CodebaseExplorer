import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { supabase } from '../lib/supabase';

export default function CLIAuth() {
  const [searchParams] = useSearchParams();
  const port = searchParams.get('port');
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!port) {
      setStatus('error');
      setError('Missing port parameter. Please use gui login from the terminal.');
      return;
    }

    // Check if user is already logged in
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        // Already authenticated — redirect to CLI callback
        redirectToCLI(session, port);
      } else {
        setStatus('needs_login');
      }
    });

    // Listen for auth state changes (user completes OAuth)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        redirectToCLI(session, port);
      }
    });

    return () => subscription.unsubscribe();
  }, [port]);

  function redirectToCLI(session, callbackPort) {
    setStatus('redirecting');
    const params = new URLSearchParams({
      access_token: session.access_token,
      refresh_token: session.refresh_token || '',
      expires_in: String(session.expires_in || 3600),
    });
    window.location.href = `http://localhost:${callbackPort}/callback?${params}`;
  }

  async function handleGitHubLogin() {
    setStatus('logging_in');
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: window.location.href,
      },
    });
    if (error) {
      setStatus('error');
      setError(error.message);
    }
  }

  return (
    <div style={styles.root}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
      `}</style>

      <div style={styles.card}>
        <div style={styles.logo}>gui</div>
        <h1 style={styles.title}>Authorize CLI</h1>

        {status === 'loading' && (
          <p style={styles.text}>Checking authentication...</p>
        )}

        {status === 'needs_login' && (
          <>
            <p style={styles.text}>
              Log in to connect your terminal to Codebase Explorer.
            </p>
            <button style={styles.button} onClick={handleGitHubLogin}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" style={{ marginRight: 8 }}>
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
              </svg>
              Continue with GitHub
            </button>
          </>
        )}

        {status === 'logging_in' && (
          <p style={styles.text}>Redirecting to GitHub...</p>
        )}

        {status === 'redirecting' && (
          <p style={styles.text}>Authenticated. Returning to terminal...</p>
        )}

        {status === 'error' && (
          <p style={styles.error}>{error}</p>
        )}
      </div>
    </div>
  );
}

const styles = {
  root: {
    fontFamily: "'DM Sans', system-ui, sans-serif",
    background: '#0a0a14',
    color: '#e2e8f0',
    height: '100dvh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    background: '#12131f',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 16,
    padding: '48px 40px',
    textAlign: 'center',
    maxWidth: 400,
    width: '100%',
    boxShadow: '0 12px 48px rgba(0,0,0,0.5)',
  },
  logo: {
    fontFamily: "'JetBrains Mono', monospace",
    fontWeight: 700,
    fontSize: 28,
    color: '#6366f1',
    background: 'rgba(99,102,241,0.12)',
    display: 'inline-block',
    padding: '8px 16px',
    borderRadius: 8,
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: 600,
    marginBottom: 12,
    color: '#e2e8f0',
  },
  text: {
    fontSize: 14,
    color: '#94a3b8',
    lineHeight: 1.6,
    marginBottom: 24,
  },
  button: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#e2e8f0',
    color: '#0a0a14',
    border: 'none',
    borderRadius: 8,
    padding: '12px 24px',
    fontSize: 15,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'background 150ms',
    width: '100%',
  },
  error: {
    fontSize: 14,
    color: '#f43f5e',
    lineHeight: 1.6,
  },
};
