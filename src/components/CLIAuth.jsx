import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { motion, AnimatePresence } from 'framer-motion';
import { Terminal, ArrowRight, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

const GithubIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
  </svg>
);

export default function CLIAuth() {
  const [searchParams] = useSearchParams();
  const port = searchParams.get('port');
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    if (!port) {
      setStatus('error');
      setError('Missing port parameter. Run gui login from your terminal to start.');
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        redirectToCLI(session, port);
      } else {
        setStatus('needs_login');
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        redirectToCLI(session, port);
      }
    });

    return () => subscription.unsubscribe();
  }, [port]);

  async function redirectToCLI(session, callbackPort) {
    setStatus('redirecting');
    const params = new URLSearchParams({
      access_token: session.access_token,
      refresh_token: session.refresh_token || '',
      expires_in: String(session.expires_in || 3600),
    });
    try {
      await fetch(`http://localhost:${callbackPort}/callback?${params}`);
      setStatus('done');
    } catch {
      setStatus('done');
    }
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
        @keyframes cli-auth-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes cli-auth-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
        @keyframes cli-auth-pulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.7; }
        }
      `}</style>

      {/* Subtle background grid */}
      <div style={styles.bgGrid} />

      {/* Soft radial glow behind the card */}
      <div style={styles.bgGlow} />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
        style={styles.card}
      >
        {/* Terminal icon badge */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.15, duration: 0.4 }}
          style={styles.iconBadge}
        >
          <Terminal size={24} strokeWidth={1.5} color="var(--color-accent)" />
        </motion.div>

        {/* Title */}
        <motion.h1
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.4 }}
          style={styles.title}
        >
          Authorize <span className="serif" style={styles.titleAccent}>CLI</span>
        </motion.h1>

        <AnimatePresence mode="wait">
          {status === 'loading' && (
            <StatusMessage key="loading" icon={<Loader2 size={16} style={{ animation: 'cli-auth-spin 1s linear infinite' }} />}>
              Checking authentication...
            </StatusMessage>
          )}

          {status === 'needs_login' && (
            <motion.div
              key="login"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3 }}
            >
              <p style={styles.description}>
                Connect your terminal to Codebase Explorer.
              </p>

              <button
                style={{
                  ...styles.button,
                  ...(hovered ? styles.buttonHover : {}),
                }}
                onClick={handleGitHubLogin}
                onMouseEnter={() => setHovered(true)}
                onMouseLeave={() => setHovered(false)}
              >
                <GithubIcon size={18} />
                <span>Continue with GitHub</span>
                <ArrowRight size={16} strokeWidth={2} style={{ opacity: 0.5 }} />
              </button>

              <p style={styles.hint}>
                This will open GitHub to authorize access.
              </p>
            </motion.div>
          )}

          {status === 'logging_in' && (
            <StatusMessage key="logging_in" icon={<Loader2 size={16} style={{ animation: 'cli-auth-spin 1s linear infinite' }} />}>
              Redirecting to GitHub...
            </StatusMessage>
          )}

          {status === 'redirecting' && (
            <StatusMessage key="redirecting" icon={<Loader2 size={16} style={{ animation: 'cli-auth-spin 1s linear infinite' }} />}>
              Sending credentials to terminal...
            </StatusMessage>
          )}

          {status === 'done' && (
            <motion.div
              key="done"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3 }}
              style={{ padding: '20px 0' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 8 }}>
                <CheckCircle size={16} color="var(--color-success)" />
                <span style={{ fontSize: 14, color: 'var(--color-success)' }}>Authenticated successfully</span>
              </div>
              <p style={{ fontSize: 13, color: 'var(--color-text-tertiary)', lineHeight: 1.5 }}>
                You can close this tab and return to your terminal.
              </p>
            </motion.div>
          )}

          {status === 'error' && (
            <StatusMessage key="error" icon={<AlertCircle size={16} color="var(--color-error)" />} color="var(--color-error)">
              {error}
            </StatusMessage>
          )}
        </AnimatePresence>

        {/* Terminal prompt decoration */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.6 }}
          style={styles.terminalHint}
        >
          <span style={{ color: 'var(--color-accent)', fontWeight: 500 }}>$</span>
          <span style={{ color: 'var(--color-text-tertiary)' }}> gui login</span>
          <span style={{ ...styles.cursor, animation: 'cli-auth-pulse 1.2s ease-in-out infinite' }}>_</span>
        </motion.div>
      </motion.div>
    </div>
  );
}

function StatusMessage({ children, icon, color }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.3 }}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: '20px 0',
        fontSize: 14,
        color: color || 'var(--color-text-secondary)',
        lineHeight: 1.6,
      }}
    >
      {icon}
      <span>{children}</span>
    </motion.div>
  );
}

const styles = {
  root: {
    fontFamily: 'var(--font-sans)',
    background: 'var(--color-bg-base)',
    color: 'var(--color-text-primary)',
    height: '100dvh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
    padding: 'clamp(1rem, 4vw, 2rem)',
  },
  bgGrid: {
    position: 'absolute',
    inset: 0,
    backgroundImage: `
      linear-gradient(var(--color-border-subtle) 1px, transparent 1px),
      linear-gradient(90deg, var(--color-border-subtle) 1px, transparent 1px)
    `,
    backgroundSize: '64px 64px',
    opacity: 0.4,
    maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 70%)',
    WebkitMaskImage: 'radial-gradient(ellipse at center, black 30%, transparent 70%)',
  },
  bgGlow: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: 600,
    height: 600,
    borderRadius: '50%',
    background: 'radial-gradient(circle, var(--color-accent-soft) 0%, transparent 70%)',
    opacity: 0.5,
    pointerEvents: 'none',
  },
  card: {
    position: 'relative',
    background: 'var(--color-bg-surface)',
    border: '1px solid var(--color-border-subtle)',
    borderRadius: 'var(--radius-lg)',
    padding: 'clamp(32px, 6vw, 48px) clamp(28px, 5vw, 44px)',
    textAlign: 'center',
    maxWidth: 420,
    width: '100%',
    boxShadow: 'var(--shadow-lg)',
  },
  iconBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 52,
    height: 52,
    borderRadius: 'var(--radius-md)',
    background: 'var(--color-accent-soft)',
    border: '1px solid var(--color-border-subtle)',
    marginBottom: 20,
  },
  title: {
    fontSize: 'clamp(1.25rem, 3vw, 1.5rem)',
    fontWeight: 500,
    letterSpacing: '-0.02em',
    marginBottom: 4,
    color: 'var(--color-text-primary)',
  },
  titleAccent: {
    fontStyle: 'italic',
    fontWeight: 500,
    color: 'var(--color-accent)',
  },
  description: {
    fontSize: 14,
    color: 'var(--color-text-secondary)',
    lineHeight: 1.6,
    marginBottom: 24,
    marginTop: 4,
  },
  button: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    width: '100%',
    background: 'var(--color-accent)',
    color: 'var(--color-text-inverse)',
    border: '1px solid var(--color-accent)',
    borderRadius: 'var(--radius-md)',
    padding: '12px 24px',
    fontSize: 15,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 200ms cubic-bezier(0.2, 0.8, 0.2, 1)',
    boxShadow: 'var(--shadow-sm)',
  },
  buttonHover: {
    background: 'var(--color-accent-hover)',
    boxShadow: 'var(--shadow-md)',
    transform: 'translateY(-1px)',
  },
  hint: {
    fontSize: 12,
    color: 'var(--color-text-tertiary)',
    marginTop: 14,
    lineHeight: 1.5,
  },
  terminalHint: {
    fontFamily: 'var(--font-mono)',
    fontSize: 13,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 0,
    marginTop: 28,
    paddingTop: 20,
    borderTop: '1px solid var(--color-border-subtle)',
  },
  cursor: {
    display: 'inline-block',
    marginLeft: 2,
    color: 'var(--color-accent)',
    fontWeight: 600,
  },
};
