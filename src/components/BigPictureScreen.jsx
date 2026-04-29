import { useEffect, useState, useMemo, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router';
import useStore from '../store/useStore';
import { fetchAndLoadProject } from '../lib/loadProject';
import { CONCEPT_COLORS } from '../data/sampleData';
import { FileText, Code2, Globe, Puzzle, ArrowRight } from 'lucide-react';
import BackBar from './BackBar';

const ExplainerPlayer = lazy(() => import('./ExplainerPlayer'));

const IMPORTANCE_RANK = { critical: 4, high: 3, important: 3, medium: 2, supporting: 1, low: 1 };

function StatItem({ icon: Icon, value, label, delay }) {
  return (
    <div
      className="flex flex-col items-center gap-1.5 min-w-[80px]"
      style={{ animation: `fade-in 0.6s ease-out ${delay}s both` }}
    >
      <Icon size={18} style={{ color: 'var(--color-accent)' }} />
      <span
        className="text-lg font-semibold font-mono"
        style={{ color: 'var(--color-text-primary)' }}
      >
        {value}
      </span>
      <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
        {label}
      </span>
    </div>
  );
}

function ConceptCard({ concept, index }) {
  const color = CONCEPT_COLORS[concept.color]?.stroke || 'var(--color-accent)';
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="rounded-xl cursor-default transition-all duration-200"
      style={{
        background: 'var(--color-bg-elevated)',
        border: `1px solid ${hovered ? color + '40' : 'var(--color-border-subtle)'}`,
        borderLeft: `3px solid ${color}`,
        padding: 'clamp(12px, 2vw, 16px)',
        transform: hovered ? 'scale(1.02)' : 'scale(1)',
        boxShadow: hovered ? `0 0 16px ${color}20` : 'none',
        animation: `fade-in 0.5s ease-out ${0.6 + index * 0.1}s both`,
      }}
    >
      <h4
        className="text-sm font-semibold mb-1"
        style={{ color: 'var(--color-text-primary)' }}
      >
        {concept.name}
      </h4>
      <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-secondary)' }} data-quote-source={concept.name}>
        {concept.one_liner || concept.description}
      </p>
    </div>
  );
}

export default function BigPictureScreen() {
  const navigate = useNavigate();
  const concepts = useStore((s) => s.concepts);
  const projectId = useStore((s) => s.projectId);
  const projectMeta = useStore((s) => s.projectMeta);
  const [restoring, setRestoring] = useState(false);

  // Load project data on mount (fresh navigation or page refresh)
  useEffect(() => {
    if (concepts.length > 0) return;

    const id = projectId || localStorage.getItem('cbe_project_id');
    if (!id) {
      navigate('/', { replace: true });
      return;
    }

    setRestoring(true);
    if (!projectId) useStore.getState().setProjectId(id);
    fetchAndLoadProject(id).then((result) => {
      setRestoring(false);
      if (!result) {
        localStorage.removeItem('cbe_project_id');
        navigate('/', { replace: true });
      }
    });
  }, [concepts.length, projectId, navigate]);

  const meta = projectMeta || {};

  const topConcepts = useMemo(() => {
    return [...concepts]
      .sort(
        (a, b) =>
          (IMPORTANCE_RANK[b.importance] || 1) -
          (IMPORTANCE_RANK[a.importance] || 1)
      )
      .slice(0, 5);
  }, [concepts]);

  if (restoring) {
    return (
      <div
        className="w-full h-full flex items-center justify-center"
        style={{ background: 'var(--color-bg-base)' }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-2 h-2 rounded-full"
            style={{
              background: 'var(--color-accent)',
              animation: 'processing-dot 1.4s infinite',
            }}
          />
          <span className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
            Loading overview...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      className="w-full min-h-full overflow-y-auto flex flex-col"
      style={{ background: 'var(--color-bg-base)' }}
    >
      <BackBar label={projectMeta?.name || 'Overview'} />
      <div
        className="w-full flex flex-col items-center"
        style={{
          maxWidth: 720,
          margin: '0 auto',
          padding: 'clamp(32px, 6vw, 64px) clamp(16px, 4vw, 24px)',
          gap: 'clamp(32px, 5vw, 48px)',
        }}
      >
        {/* Hero */}
        <div
          className="text-center w-full"
          style={{ animation: 'fade-in 0.6s ease-out' }}
        >
          <p
            className="text-xs font-medium tracking-widest uppercase mb-4"
            style={{ color: 'var(--color-accent)' }}
          >
            Architecture Overview
          </p>
          <h1
            className="font-heading font-bold tracking-tight mb-4"
            style={{
              color: 'var(--color-text-primary)',
              fontSize: 'clamp(1.5rem, 4vw, 2.25rem)',
              lineHeight: 1.2,
            }}
          >
            {meta.name}
          </h1>
          <p
            className="leading-relaxed mx-auto"
            style={{
              color: 'var(--color-text-secondary)',
              fontSize: 'clamp(0.875rem, 2vw, 1.05rem)',
              maxWidth: 560,
              lineHeight: 1.7,
            }}
            data-quote-source="Project summary"
          >
            {meta.summary}
          </p>
        </div>

        {/* Stats Row */}
        <div
          className="rounded-2xl w-full"
          style={{
            background: 'var(--color-bg-elevated)',
            border: '1px solid var(--color-border-subtle)',
            padding: 'clamp(16px, 3vw, 24px)',
            animation: 'fade-in 0.6s ease-out 0.2s both',
          }}
        >
          <div className="flex flex-wrap justify-center gap-x-8 gap-y-4">
            <StatItem
              icon={FileText}
              value={meta.file_count || concepts.length}
              label="Files"
              delay={0.25}
            />
            <StatItem
              icon={Code2}
              value={meta.framework || 'N/A'}
              label="Framework"
              delay={0.3}
            />
            <StatItem
              icon={Globe}
              value={meta.language || 'N/A'}
              label="Language"
              delay={0.35}
            />
            <StatItem
              icon={Puzzle}
              value={concepts.length}
              label="Concepts"
              delay={0.4}
            />
          </div>
        </div>

        {/* Explainer Video */}
        <Suspense
          fallback={
            <div
              className="w-full rounded-2xl flex items-center justify-center"
              style={{
                background: 'var(--color-bg-elevated)',
                border: '1px solid var(--color-border-subtle)',
                aspectRatio: '16/9',
              }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{
                    background: 'var(--color-accent)',
                    animation: 'processing-dot 1.4s infinite',
                  }}
                />
                <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                  Loading video...
                </span>
              </div>
            </div>
          }
        >
          <ExplainerPlayer />
        </Suspense>

        {/* Key Concepts */}
        {topConcepts.length > 0 && (
          <div className="w-full">
            <h3
              className="text-xs font-medium tracking-widest uppercase mb-4 text-center"
              style={{
                color: 'var(--color-text-tertiary)',
                animation: 'fade-in 0.5s ease-out 0.55s both',
              }}
            >
              Key Architectural Concepts
            </h3>
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {topConcepts.map((c, i) => (
                <ConceptCard key={c.id} concept={c} index={i} />
              ))}
            </div>
          </div>
        )}

        {/* CTA */}
        <button
          onClick={() => {
            const pid = useStore.getState().projectId;
            navigate(pid ? `/explore/${pid}` : '/explorer', { replace: true });
          }}
          className="flex items-center gap-2 rounded-xl font-medium transition-all duration-200 active:scale-[0.97] cursor-pointer"
          style={{
            background: 'var(--color-accent)',
            color: 'var(--color-text-inverse)',
            padding: '14px 32px',
            fontSize: '0.95rem',
            animation: 'fade-in 0.6s ease-out 0.8s both, cta-glow 3s ease-in-out infinite 1.4s',
            border: 'none',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--color-accent-hover)';
            e.currentTarget.style.transform = 'scale(1.03)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'var(--color-accent)';
            e.currentTarget.style.transform = 'scale(1)';
          }}
        >
          Start Exploring
          <ArrowRight size={18} />
        </button>

        {/* Subtle footer note */}
        <p
          className="text-center"
          style={{
            color: 'var(--color-text-tertiary)',
            fontSize: '0.7rem',
            animation: 'fade-in 0.5s ease-out 1s both',
          }}
        >
          Click any concept in the explorer to learn how it works
        </p>
      </div>
    </div>
  );
}
