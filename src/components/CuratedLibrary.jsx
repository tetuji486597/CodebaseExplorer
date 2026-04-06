import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import useStore from '../store/useStore';
import { fetchAndLoadProject } from '../lib/loadProject';
import { ArrowLeft, ExternalLink, BookOpen, Zap, Flame } from 'lucide-react';

const DIFFICULTY_CONFIG = {
  beginner: {
    label: 'Beginner',
    color: '#10b981',
    bg: 'rgba(16, 185, 129, 0.1)',
    border: 'rgba(16, 185, 129, 0.2)',
    Icon: BookOpen,
  },
  intermediate: {
    label: 'Intermediate',
    color: '#f59e0b',
    bg: 'rgba(245, 158, 11, 0.1)',
    border: 'rgba(245, 158, 11, 0.2)',
    Icon: Zap,
  },
  advanced: {
    label: 'Advanced',
    color: '#f43f5e',
    bg: 'rgba(244, 63, 94, 0.1)',
    border: 'rgba(244, 63, 94, 0.2)',
    Icon: Flame,
  },
};

export default function CuratedLibrary() {
  const navigate = useNavigate();
  const [codebases, setCodebases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingId, setLoadingId] = useState(null);
  const setProjectId = useStore(s => s.setProjectId);

  useEffect(() => {
    fetch('/api/curated')
      .then(res => res.json())
      .then(data => {
        setCodebases(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleLoadCodebase = async (codebase) => {
    setLoadingId(codebase.id);

    try {
      // Load the curated codebase (creates a project record)
      const loadRes = await fetch(`/api/curated/${codebase.id}/load`, { method: 'POST' });
      const { projectId } = await loadRes.json();
      // Store curated codebase ID for engagement tracking
      localStorage.setItem('cbe_curated_id', codebase.id);

      const result = await fetchAndLoadProject(projectId);
      if (result) {
        navigate('/explorer', { replace: true });
      } else {
        setLoadingId(null);
      }
    } catch (err) {
      console.error('Failed to load curated codebase:', err);
      setLoadingId(null);
    }
  };

  return (
    <div className="w-full min-h-full overflow-y-auto" style={{ background: '#0a0a14' }}>
      {/* Header */}
      <div
        className="sticky top-0 z-20 flex items-center gap-3 px-5 py-3.5"
        style={{
          background: 'rgba(10, 10, 20, 0.92)',
          backdropFilter: 'blur(16px)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <button
          onClick={() => navigate('/')}
          className="w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200"
          style={{ color: '#64748b', background: 'rgba(255,255,255,0.04)' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#94a3b8'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = '#64748b'; }}
        >
          <ArrowLeft size={16} />
        </button>
        <span className="font-heading text-sm font-semibold" style={{ color: '#e2e8f0' }}>
          Curated Library
        </span>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-5 py-8">
        <div className="mb-8">
          <h2 className="text-xl font-semibold font-heading mb-2" style={{ color: '#e2e8f0' }}>
            Learn by exploring real codebases
          </h2>
          <p className="text-sm" style={{ color: '#64748b' }}>
            Each codebase teaches different programming concepts. Start with beginner projects and work your way up.
          </p>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="rounded-2xl h-52"
                style={{
                  background: '#12131f',
                  border: '1px solid rgba(255,255,255,0.04)',
                  animation: `pulse 1.5s ease-in-out infinite ${i * 0.1}s`,
                }}
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {codebases.map((cb) => {
              const diff = DIFFICULTY_CONFIG[cb.difficulty] || DIFFICULTY_CONFIG.beginner;
              const isLoading = loadingId === cb.id;

              return (
                <button
                  key={cb.id}
                  onClick={() => !isLoading && handleLoadCodebase(cb)}
                  disabled={isLoading}
                  className="rounded-2xl p-5 text-left transition-all duration-300 active:scale-[0.98]"
                  style={{
                    background: '#12131f',
                    border: '1px solid rgba(255,255,255,0.06)',
                    opacity: isLoading ? 0.7 : 1,
                  }}
                  onMouseEnter={e => {
                    if (!isLoading) {
                      e.currentTarget.style.borderColor = `${diff.color}30`;
                      e.currentTarget.style.boxShadow = `0 0 24px ${diff.color}08`;
                    }
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  {/* Header */}
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="text-base font-semibold font-heading" style={{ color: '#e2e8f0' }}>
                      {cb.name}
                    </h3>
                    <span
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium shrink-0 ml-3"
                      style={{ background: diff.bg, color: diff.color, border: `1px solid ${diff.border}` }}
                    >
                      <diff.Icon size={11} />
                      {diff.label}
                    </span>
                  </div>

                  {/* Description */}
                  <p className="text-[13px] leading-relaxed mb-4" style={{ color: '#94a3b8' }}>
                    {cb.description}
                  </p>

                  {/* Concept tags */}
                  <div className="flex flex-wrap gap-1.5">
                    {(cb.primary_concepts || []).map((concept) => (
                      <span
                        key={concept}
                        className="text-[11px] px-2.5 py-1 rounded-lg font-medium"
                        style={{
                          background: 'rgba(255,255,255,0.04)',
                          color: '#94a3b8',
                          border: '1px solid rgba(255,255,255,0.06)',
                        }}
                      >
                        {concept}
                      </span>
                    ))}
                  </div>

                  {/* Loading state */}
                  {isLoading && (
                    <div className="flex items-center gap-2 mt-4 text-xs" style={{ color: diff.color }}>
                      <div
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ background: diff.color, animation: 'processing-dot 1.4s infinite' }}
                      />
                      Loading codebase...
                    </div>
                  )}

                  {/* GitHub link */}
                  {cb.github_url && (
                    <div className="flex items-center gap-1.5 mt-4 text-[11px]" style={{ color: '#475569' }}>
                      <ExternalLink size={11} />
                      {cb.github_url.replace('https://github.com/', '')}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
