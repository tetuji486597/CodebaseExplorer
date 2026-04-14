import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router';
import useStore from '../store/useStore';
import { fetchAndLoadProject } from '../lib/loadProject';
import { CONCEPT_COLORS } from '../data/sampleData';
import { FileText, Code2, Globe, Puzzle, ArrowRight } from 'lucide-react';
import BackBar from './BackBar';

const IMPORTANCE_RANK = { critical: 4, high: 3, important: 3, medium: 2, supporting: 1, low: 1 };

function MiniConstellation({ concepts, edges }) {
  const layout = useMemo(() => {
    if (!concepts.length) return { nodes: [], lines: [] };

    const svgW = 400;
    const svgH = 300;
    const cx = svgW / 2;
    const cy = svgH / 2;

    // Scale radius based on concept count
    const count = concepts.length;
    const rx = Math.min(140, 40 + count * 12);
    const ry = Math.min(100, 30 + count * 8);

    // Seed a deterministic jitter from concept id
    const jitter = (id) => {
      let h = 0;
      for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
      return ((h & 0xff) / 255 - 0.5) * 2; // -1 to 1
    };

    const sorted = [...concepts].sort(
      (a, b) => (IMPORTANCE_RANK[b.importance] || 1) - (IMPORTANCE_RANK[a.importance] || 1)
    );

    const nodes = sorted.map((c, i) => {
      const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
      const jx = jitter(c.id) * 20;
      const jy = jitter(c.id + '_y') * 15;
      const x = cx + rx * Math.cos(angle) + jx;
      const y = cy + ry * Math.sin(angle) + jy;
      const rank = IMPORTANCE_RANK[c.importance] || 1;
      const r = 3 + rank * 2; // 5-11px
      const color = CONCEPT_COLORS[c.color]?.stroke || 'var(--color-accent)';
      const floatDuration = 3 + (i % 3);
      const floatDelay = i * 0.4;
      return { id: c.id, x, y, r, color, name: c.name, floatDuration, floatDelay };
    });

    const posMap = {};
    nodes.forEach((n) => (posMap[n.id] = n));

    const lines = edges
      .map((e) => {
        const s = posMap[e.source];
        const t = posMap[e.target];
        if (!s || !t) return null;
        return { x1: s.x, y1: s.y, x2: t.x, y2: t.y };
      })
      .filter(Boolean);

    return { nodes, lines };
  }, [concepts, edges]);

  if (!layout.nodes.length) return null;

  return (
    <div
      className="relative w-full flex justify-center"
      style={{ animation: 'fade-in 1s ease-out 0.4s both' }}
    >
      {/* Vignette overlay */}
      <div
        className="absolute inset-0 pointer-events-none z-10"
        style={{
          background:
            'radial-gradient(ellipse 60% 50% at 50% 50%, transparent 40%, #0a0a1a 100%)',
        }}
      />

      <svg
        viewBox="0 0 400 300"
        className="w-full"
        style={{ maxWidth: 480, height: 'auto' }}
        role="img"
        aria-label="Architecture constellation preview"
      >
        <g
          style={{
            transformOrigin: '200px 150px',
            animation: 'constellation-rotate 80s linear infinite',
          }}
        >
          {/* Edges */}
          {layout.lines.map((l, i) => (
            <line
              key={`e-${i}`}
              x1={l.x1}
              y1={l.y1}
              x2={l.x2}
              y2={l.y2}
              stroke="var(--color-border-subtle)"
              strokeWidth="0.7"
            />
          ))}

          {/* Glow halos */}
          {layout.nodes.map((n) => (
            <circle
              key={`g-${n.id}`}
              cx={n.x}
              cy={n.y}
              r={n.r * 2.5}
              fill={n.color}
              opacity={0.1}
              style={{ filter: 'blur(4px)' }}
            />
          ))}

          {/* Concept dots */}
          {layout.nodes.map((n) => (
            <circle
              key={`n-${n.id}`}
              cx={n.x}
              cy={n.y}
              r={n.r}
              fill={n.color}
              opacity={0.85}
              style={{
                animation: `float ${n.floatDuration}s ease-in-out infinite ${n.floatDelay}s`,
              }}
            />
          ))}

          {/* Labels for the top 5 */}
          {layout.nodes.slice(0, 5).map((n) => (
            <text
              key={`t-${n.id}`}
              x={n.x}
              y={n.y + n.r + 12}
              textAnchor="middle"
              fill="rgba(226,232,240,0.4)"
              fontSize="8"
              fontFamily="'JetBrains Mono', monospace"
              style={{
                animation: `float ${n.floatDuration}s ease-in-out infinite ${n.floatDelay}s`,
              }}
            >
              {n.name}
            </text>
          ))}
        </g>
      </svg>
    </div>
  );
}

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
      <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
        {concept.one_liner || concept.description}
      </p>
    </div>
  );
}

const DEMO_META = {
  name: 'Instagram Clone',
  summary:
    'A full-stack social media application with user authentication, a personalized feed, post creation with media uploads, real-time notifications, and user profiles with social graph features.',
  framework: 'React',
  language: 'JavaScript',
  file_count: 24,
};

export default function BigPictureScreen() {
  const navigate = useNavigate();
  const concepts = useStore((s) => s.concepts);
  const conceptEdges = useStore((s) => s.conceptEdges);
  const projectId = useStore((s) => s.projectId);
  const projectMeta = useStore((s) => s.projectMeta);
  const [restoring, setRestoring] = useState(false);

  // Restore project data on refresh
  useEffect(() => {
    if (concepts.length > 0) return;
    if (projectId) return;

    const savedId = localStorage.getItem('cbe_project_id');
    if (!savedId) {
      navigate('/', { replace: true });
      return;
    }

    setRestoring(true);
    useStore.getState().setProjectId(savedId);
    fetchAndLoadProject(savedId).then((result) => {
      setRestoring(false);
      if (!result) {
        localStorage.removeItem('cbe_project_id');
        navigate('/', { replace: true });
      }
    });
  }, [concepts.length, projectId, navigate]);

  const meta = projectMeta || DEMO_META;

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
      className="w-full min-h-full overflow-y-auto"
      style={{ background: 'var(--color-bg-base)' }}
    >
      <BackBar to="/upload" label={projectMeta?.name || 'Overview'} />
      <div
        className="mx-auto flex flex-col items-center"
        style={{
          maxWidth: 720,
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

        {/* Mini Constellation */}
        <MiniConstellation concepts={concepts} edges={conceptEdges} />

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
          onClick={() => navigate('/explorer', { replace: true })}
          className="flex items-center gap-2 rounded-xl font-medium transition-all duration-200 active:scale-[0.97] cursor-pointer"
          style={{
            background: 'var(--color-accent)',
            color: '#fff',
            padding: '14px 32px',
            fontSize: '0.95rem',
            animation: 'fade-in 0.6s ease-out 0.8s both, cta-glow 3s ease-in-out infinite 1.4s',
            border: 'none',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--color-accent)';
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
            color: '#3b3b5c',
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
