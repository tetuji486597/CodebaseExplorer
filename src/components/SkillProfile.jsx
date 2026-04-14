import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { ArrowLeft, Circle, Layers, Server, Database, Settings } from 'lucide-react';
import { API_BASE } from '../lib/api';

const CATEGORY_CONFIG = {
  frontend: { label: 'Frontend', Icon: Layers, color: 'var(--color-accent)' },
  backend: { label: 'Backend', Icon: Server, color: 'var(--color-success)' },
  database: { label: 'Database', Icon: Database, color: 'var(--color-warning)' },
  general: { label: 'General', Icon: Settings, color: 'var(--color-text-secondary)' },
};

function ConfidenceDots({ confidence }) {
  const dots = 5;
  const filled = Math.round(confidence * dots);

  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: dots }).map((_, i) => (
        <div
          key={i}
          className="w-1.5 h-1.5 rounded-full transition-all duration-500"
          style={{
            background: i < filled
              ? confidence > 0.7 ? 'var(--color-success)' : confidence > 0.3 ? 'var(--color-warning)' : 'var(--color-accent)'
              : 'var(--color-border-visible)',
            boxShadow: i < filled ? `0 0 4px ${confidence > 0.7 ? 'var(--color-success)' : confidence > 0.3 ? 'var(--color-warning)' : 'var(--color-accent)'}40` : 'none',
          }}
        />
      ))}
    </div>
  );
}

function ConceptCard({ concept }) {
  const hasProgress = concept.encounters > 0;

  return (
    <div
      className="rounded-xl p-3.5 transition-all duration-200"
      style={{
        background: hasProgress ? 'var(--color-bg-surface)' : 'var(--color-bg-surface)',
        border: `1px solid ${hasProgress ? 'var(--color-border-visible)' : 'var(--color-bg-sunken)'}`,
        opacity: hasProgress ? 1 : 0.6,
      }}
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <span className="text-[13px] font-medium" style={{ color: hasProgress ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)' }}>
          {concept.name}
        </span>
        <ConfidenceDots confidence={concept.confidence} />
      </div>
      <p className="text-[11px] leading-relaxed" style={{ color: 'var(--color-text-tertiary)' }}>
        {concept.description}
      </p>
      {concept.encounters > 0 && (
        <div className="flex items-center gap-3 mt-2">
          <span className="text-[10px]" style={{ color: 'var(--color-text-tertiary)' }}>
            {concept.encounters} encounter{concept.encounters !== 1 ? 's' : ''}
          </span>
          {concept.last_encountered_at && (
            <span className="text-[10px]" style={{ color: 'var(--color-text-tertiary)' }}>
              Last: {new Date(concept.last_encountered_at).toLocaleDateString()}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export default function SkillProfile() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/api/skill-profile?userId=anonymous`)
      .then(res => res.json())
      .then(data => {
        setProfile(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const conceptsByCategory = profile?.concepts?.reduce((acc, concept) => {
    if (!acc[concept.category]) acc[concept.category] = [];
    acc[concept.category].push(concept);
    return acc;
  }, {}) || {};

  const totalEncountered = profile?.concepts?.filter(c => c.encounters > 0).length || 0;
  const totalConcepts = profile?.concepts?.length || 0;

  return (
    <div className="w-full min-h-full overflow-y-auto" style={{ background: 'var(--color-bg-base)' }}>
      {/* Header */}
      <div
        className="sticky top-0 z-20 flex items-center gap-3 px-5 py-3.5"
        style={{
          background: 'var(--color-bg-elevated)',
          backdropFilter: 'blur(16px)',
          borderBottom: '1px solid var(--color-border-subtle)',
        }}
      >
        <button
          onClick={() => navigate(-1)}
          className="w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200"
          style={{ color: 'var(--color-text-tertiary)', background: 'var(--color-bg-sunken)' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-border-visible)'; e.currentTarget.style.color = 'var(--color-text-secondary)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'var(--color-bg-sunken)'; e.currentTarget.style.color = 'var(--color-text-tertiary)'; }}
        >
          <ArrowLeft size={16} />
        </button>
        <span className="font-heading text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
          Comprehension Profile
        </span>
        {totalConcepts > 0 && (
          <span className="text-[11px] font-medium px-2 py-0.5 rounded-full ml-2" style={{
            background: 'var(--color-accent-soft)',
            color: 'var(--color-accent-active)',
            border: '1px solid var(--color-border-strong)',
          }}>
            {totalEncountered}/{totalConcepts} concepts encountered
          </span>
        )}
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-5 py-8">
        {loading ? (
          <div className="space-y-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="space-y-3">
                <div className="w-24 h-4 rounded-lg" style={{ background: 'var(--color-bg-surface)' }} />
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {[...Array(3)].map((_, j) => (
                    <div
                      key={j}
                      className="h-20 rounded-xl"
                      style={{ background: 'var(--color-bg-surface)', animation: `pulse 1.5s ease-in-out infinite ${(i * 3 + j) * 0.1}s` }}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <>
            {/* Progress overview */}
            <div
              className="rounded-2xl p-5 mb-8"
              style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-subtle)' }}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                  Your understanding
                </h3>
                <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                  {totalEncountered} of {totalConcepts} concepts
                </span>
              </div>
              {/* Progress bar */}
              <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: 'var(--color-bg-sunken)' }}>
                <div
                  className="h-full rounded-full transition-all duration-700 ease-out"
                  style={{
                    width: `${totalConcepts > 0 ? (totalEncountered / totalConcepts) * 100 : 0}%`,
                    background: 'linear-gradient(90deg, #6366f1, #10b981)',
                    minWidth: totalEncountered > 0 ? '8px' : '0',
                  }}
                />
              </div>
            </div>

            {/* Concepts by category */}
            <div className="space-y-8">
              {['frontend', 'backend', 'database', 'general'].map(category => {
                const config = CATEGORY_CONFIG[category];
                const concepts = conceptsByCategory[category] || [];
                if (concepts.length === 0) return null;

                return (
                  <div key={category}>
                    <div className="flex items-center gap-2 mb-3">
                      <config.Icon size={15} style={{ color: config.color }} />
                      <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: config.color }}>
                        {config.label}
                      </span>
                      <span className="text-[10px] ml-1" style={{ color: 'var(--color-text-tertiary)' }}>
                        {concepts.filter(c => c.encounters > 0).length}/{concepts.length}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {concepts.map(concept => (
                        <ConceptCard key={concept.id} concept={concept} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Exploration timeline */}
            {profile?.timeline?.length > 0 && (
              <div className="mt-10">
                <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>
                  Exploration timeline
                </h3>
                <div className="space-y-2">
                  {profile.timeline.map(project => (
                    <div
                      key={project.id}
                      className="flex items-center gap-3 rounded-xl px-4 py-3"
                      style={{
                        background: 'var(--color-bg-surface)',
                        border: '1px solid var(--color-bg-sunken)',
                      }}
                    >
                      <Circle
                        size={8}
                        fill={project.is_curated ? 'var(--color-success)' : 'var(--color-accent)'}
                        stroke="none"
                      />
                      <span className="text-[13px] font-medium flex-1" style={{ color: 'var(--color-text-primary)' }}>
                        {project.name}
                      </span>
                      <span className="text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>
                        {project.is_curated ? 'Curated' : 'Upload'}
                      </span>
                      <span className="text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>
                        {new Date(project.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
