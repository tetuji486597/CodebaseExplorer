import { useState } from 'react';
import { useNavigate } from 'react-router';
import posthog from '../lib/posthog';
import useStore from '../store/useStore';
import { Compass, FolderTree, Route, Sun, Moon, Home, Settings, Link, Check, HelpCircle } from 'lucide-react';

export default function TopBar() {
  const [copied, setCopied] = useState(false);
  const filesPanelOpen = useStore(s => s.filesPanelOpen);
  const toggleFilesPanel = useStore(s => s.toggleFilesPanel);
  const concepts = useStore(s => s.concepts);
  const exploredConcepts = useStore(s => s.exploredConcepts);
  const guidedMode = useStore(s => s.guidedMode);
  const explorationPath = useStore(s => s.explorationPath);
  const enterGuidedMode = useStore(s => s.enterGuidedMode);
  const projectMeta = useStore(s => s.projectMeta);
  const darkMode = useStore(s => s.darkMode);
  const toggleDarkMode = useStore(s => s.toggleDarkMode);
  const user = useStore(s => s.user);
  const projectId = useStore(s => s.projectId);

  const navigate = useNavigate();
  const exploredCount = exploredConcepts.size;
  const totalCount = concepts.length;

  return (
    <header
      className="eg-top"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 clamp(0.75rem, 2vw, 1.25rem)',
        background: 'var(--color-bg-elevated)',
        borderBottom: '1px solid var(--color-border-subtle)',
        gap: '0.75rem',
        minWidth: 0,
      }}
    >
      {/* Left: Home button + project name + stats */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0, flex: 1 }}>
        <button
          onClick={() => navigate('/upload')}
          aria-label="Home"
          style={{
            width: 32,
            height: 32,
            borderRadius: 'var(--radius-sm)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'transparent',
            border: '1px solid transparent',
            color: 'var(--color-text-secondary)',
            cursor: 'pointer',
            transition: `all var(--duration-base) var(--ease-out)`,
            flexShrink: 0,
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'var(--color-accent-soft)';
            e.currentTarget.style.color = 'var(--color-accent-active)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = 'var(--color-text-secondary)';
          }}
        >
          <Home size={15} strokeWidth={1.75} />
        </button>

        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, lineHeight: 1.2 }}>
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--color-text-primary)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: '32vw',
              letterSpacing: '-0.01em',
            }}
          >
            {projectMeta?.name || 'Codebase Explorer'}
          </span>
          {totalCount > 0 && (
            <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>
              {totalCount} concepts{exploredCount > 0 ? ` · ${exploredCount} explored` : ''}
            </span>
          )}
        </div>
      </div>

      {/* Center: Concepts label + Files toggle */}
      {!guidedMode && totalCount > 0 && (
        <div
          className="hide-on-mobile"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            flexShrink: 0,
          }}
        >
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 14px',
              fontSize: 12,
              fontWeight: 500,
              color: 'var(--color-accent-active)',
            }}
          >
            <Compass size={13} strokeWidth={1.75} />
            Concepts
          </div>
          <button
            onClick={() => { toggleFilesPanel(); posthog.capture('files_panel_toggled', { open: !filesPanelOpen }); }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 14px',
              fontSize: 12,
              fontWeight: 500,
              borderRadius: 'var(--radius-md)',
              color: filesPanelOpen ? 'var(--color-accent-active)' : 'var(--color-text-tertiary)',
              background: filesPanelOpen ? 'var(--color-accent-soft)' : 'transparent',
              border: `1px solid ${filesPanelOpen ? 'var(--color-accent)' : 'var(--color-border-subtle)'}`,
              cursor: 'pointer',
              transition: `all var(--duration-base) var(--ease-out)`,
            }}
            onMouseEnter={e => {
              if (!filesPanelOpen) {
                e.currentTarget.style.background = 'var(--color-bg-sunken)';
                e.currentTarget.style.color = 'var(--color-text-primary)';
              }
            }}
            onMouseLeave={e => {
              if (!filesPanelOpen) {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = 'var(--color-text-tertiary)';
              }
            }}
          >
            <FolderTree size={13} strokeWidth={1.75} />
            Files
          </button>
        </div>
      )}

      {/* Right: Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
        {projectId && (
          <button
            onClick={() => {
              const shareUrl = `${window.location.origin}/explore/${projectId}`;
              navigator.clipboard.writeText(shareUrl).then(() => {
                setCopied(true);
                posthog.capture('share_link_copied');
                setTimeout(() => setCopied(false), 2000);
              });
              // Also update URL bar if not already on /explore/:id
              if (!window.location.pathname.startsWith('/explore/')) {
                window.history.replaceState(null, '', `/explore/${projectId}`);
              }
            }}
            aria-label="Copy share link"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              borderRadius: 'var(--radius-md)',
              fontSize: 12,
              fontWeight: 500,
              color: copied ? 'var(--color-accent-active)' : 'var(--color-text-secondary)',
              background: copied ? 'var(--color-accent-soft)' : 'transparent',
              border: `1px solid ${copied ? 'var(--color-accent)' : 'var(--color-border-subtle)'}`,
              cursor: 'pointer',
              transition: `all var(--duration-base) var(--ease-out)`,
            }}
            onMouseEnter={e => {
              if (!copied) {
                e.currentTarget.style.background = 'var(--color-bg-sunken)';
                e.currentTarget.style.color = 'var(--color-text-primary)';
              }
            }}
            onMouseLeave={e => {
              if (!copied) {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = 'var(--color-text-secondary)';
              }
            }}
          >
            {copied ? <Check size={13} strokeWidth={1.75} /> : <Link size={13} strokeWidth={1.75} />}
            <span className="hide-on-mobile">{copied ? 'Copied' : 'Share'}</span>
          </button>
        )}

        <button
          onClick={() => navigate('/docs')}
          aria-label="Documentation"
          style={{
            width: 32,
            height: 32,
            borderRadius: 'var(--radius-sm)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'transparent',
            border: '1px solid transparent',
            color: 'var(--color-text-secondary)',
            cursor: 'pointer',
            transition: `all var(--duration-base) var(--ease-out)`,
            flexShrink: 0,
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'var(--color-accent-soft)';
            e.currentTarget.style.color = 'var(--color-accent-active)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = 'var(--color-text-secondary)';
          }}
        >
          <HelpCircle size={15} strokeWidth={1.75} />
        </button>

        <button
          onClick={() => navigate('/settings')}
          aria-label="Settings"
          style={{
            width: 32,
            height: 32,
            borderRadius: 'var(--radius-sm)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'transparent',
            border: '1px solid transparent',
            color: 'var(--color-text-secondary)',
            cursor: 'pointer',
            transition: `all var(--duration-base) var(--ease-out)`,
            flexShrink: 0,
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'var(--color-accent-soft)';
            e.currentTarget.style.color = 'var(--color-accent-active)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = 'var(--color-text-secondary)';
          }}
        >
          <Settings size={15} strokeWidth={1.75} />
        </button>
        {!guidedMode && explorationPath.length > 0 && (
          <button
            onClick={enterGuidedMode}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              borderRadius: 'var(--radius-md)',
              fontSize: 12,
              fontWeight: 500,
              color: 'var(--color-text-inverse)',
              background: 'var(--color-accent)',
              border: '1px solid var(--color-accent)',
              cursor: 'pointer',
              transition: `all var(--duration-base) var(--ease-out)`,
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-accent-hover)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'var(--color-accent)'; }}
          >
            <Route size={13} strokeWidth={1.75} />
            <span className="hide-on-mobile">Resume tour</span>
          </button>
        )}

        <button
          onClick={toggleDarkMode}
          aria-label={darkMode ? 'Switch to light theme' : 'Switch to dark theme'}
          style={{
            width: 32,
            height: 32,
            borderRadius: 'var(--radius-sm)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'transparent',
            border: '1px solid transparent',
            color: 'var(--color-text-secondary)',
            cursor: 'pointer',
            transition: `all var(--duration-base) var(--ease-out)`,
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'var(--color-accent-soft)';
            e.currentTarget.style.color = 'var(--color-accent-active)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = 'var(--color-text-secondary)';
          }}
        >
          {darkMode ? <Sun size={15} strokeWidth={1.75} /> : <Moon size={15} strokeWidth={1.75} />}
        </button>

      </div>

      <style>{`
        @media (max-width: 640px) {
          .hide-on-mobile { display: none !important; }
        }
      `}</style>
    </header>
  );
}
