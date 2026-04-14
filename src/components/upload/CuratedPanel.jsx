import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { usePostHog } from '@posthog/react';
import { BookOpen, Zap, Flame, ExternalLink } from 'lucide-react';
import useStore from '../../store/useStore';
import { fetchAndLoadProject } from '../../lib/loadProject';
import { API_BASE } from '../../lib/api';

const DIFFICULTY_CONFIG = {
  beginner: { label: 'Beginner', color: 'var(--color-success)', bg: 'var(--color-success-soft)', Icon: BookOpen },
  intermediate: { label: 'Intermediate', color: 'var(--color-warning)', bg: 'var(--color-warning-soft)', Icon: Zap },
  advanced: { label: 'Advanced', color: 'var(--color-error)', bg: 'var(--color-error-soft)', Icon: Flame },
};

export default function CuratedPanel() {
  const navigate = useNavigate();
  const setProjectId = useStore(s => s.setProjectId);
  const posthog = usePostHog();
  const [codebases, setCodebases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingId, setLoadingId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/api/curated`)
      .then(r => r.json())
      .then(data => { if (!cancelled) { setCodebases(data); setLoading(false); } })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const handleLoad = async (cb) => {
    posthog.capture('repo_uploaded', { source: 'curated' });
    setLoadingId(cb.id);
    try {
      const res = await fetch(`${API_BASE}/api/curated/${cb.id}/load`, { method: 'POST' });
      const { projectId } = await res.json();
      setProjectId(projectId);
      localStorage.setItem('cbe_curated_id', cb.id);
      const ok = await fetchAndLoadProject(projectId);
      if (ok) navigate('/overview', { replace: true });
      else setLoadingId(null);
    } catch (err) {
      console.error('Failed to load curated codebase:', err);
      setLoadingId(null);
    }
  };

  if (loading) {
    return (
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
        gap: 12,
      }}>
        {[...Array(4)].map((_, i) => (
          <div key={i} style={{
            height: 140, borderRadius: 'var(--radius-md)',
            background: 'var(--color-bg-sunken)',
            animation: `pulse 1.5s ease-in-out infinite ${i * 0.1}s`,
          }} />
        ))}
      </div>
    );
  }

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
      gap: 12,
      maxHeight: 'min(460px, 55dvh)',
      overflowY: 'auto',
      scrollbarWidth: 'thin',
      scrollbarColor: 'var(--color-border-visible) transparent',
    }}>
      {codebases.map((cb) => {
        const diff = DIFFICULTY_CONFIG[cb.difficulty] || DIFFICULTY_CONFIG.beginner;
        const isLoading = loadingId === cb.id;
        const DiffIcon = diff.Icon;

        return (
          <button
            key={cb.id}
            onClick={() => !isLoading && handleLoad(cb)}
            disabled={isLoading}
            style={{
              textAlign: 'left',
              padding: 16,
              borderRadius: 'var(--radius-md)',
              background: 'var(--color-bg-elevated)',
              border: '1px solid var(--color-border-subtle)',
              cursor: isLoading ? 'default' : 'pointer',
              opacity: isLoading ? 0.7 : 1,
              transition: `all var(--duration-base) var(--ease-out)`,
              fontFamily: 'inherit',
              color: 'var(--color-text-primary)',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
            onMouseEnter={e => { if (!isLoading) e.currentTarget.style.borderColor = 'var(--color-border-visible)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-border-subtle)'; }}
          >
            {/* Header row */}
            <div style={{ display: 'flex', alignItems: 'start', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.3 }}>{cb.name}</span>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                fontSize: 10, fontWeight: 600, padding: '2px 7px',
                borderRadius: 'var(--radius-xs)',
                background: diff.bg, color: diff.color,
                whiteSpace: 'nowrap', flexShrink: 0, marginLeft: 8,
              }}>
                <DiffIcon size={10} />
                {diff.label}
              </span>
            </div>

            {/* Description */}
            <p style={{
              fontSize: 12, lineHeight: 1.55,
              color: 'var(--color-text-secondary)', margin: 0,
              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
            }}>
              {cb.description}
            </p>

            {/* Concept tags */}
            {cb.primary_concepts?.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {cb.primary_concepts.slice(0, 4).map(c => (
                  <span key={c} style={{
                    fontSize: 10, padding: '2px 7px',
                    borderRadius: 'var(--radius-xs)',
                    background: 'var(--color-bg-sunken)',
                    color: 'var(--color-text-tertiary)',
                  }}>
                    {c}
                  </span>
                ))}
              </div>
            )}

            {/* Footer indicators */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 2 }}>
              {cb.github_url && (
                <span style={{ fontSize: 10, color: 'var(--color-text-tertiary)', display: 'flex', alignItems: 'center', gap: 3 }}>
                  <ExternalLink size={9} />
                  {cb.github_url.replace('https://github.com/', '')}
                </span>
              )}
            </div>

            {isLoading && (
              <span style={{ fontSize: 11, color: diff.color, display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{
                  width: 5, height: 5, borderRadius: '50%',
                  background: diff.color, animation: 'processing-dot 1.4s infinite',
                }} />
                Loading...
              </span>
            )}
          </button>
        );
      })}

      {codebases.length === 0 && !loading && (
        <p style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '2rem', color: 'var(--color-text-tertiary)', fontSize: 13 }}>
          No curated codebases available right now.
        </p>
      )}
    </div>
  );
}
