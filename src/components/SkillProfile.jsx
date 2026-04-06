import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { ArrowLeft, Circle, Layers, Server, Database, Settings } from 'lucide-react';
import { API_BASE } from '../lib/api';

const CATEGORY_CONFIG = {
  frontend: { label: 'Frontend', Icon: Layers, color: '#6366f1' },
  backend: { label: 'Backend', Icon: Server, color: '#10b981' },
  database: { label: 'Database', Icon: Database, color: '#f59e0b' },
  general: { label: 'General', Icon: Settings, color: '#94a3b8' },
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
              ? confidence > 0.7 ? '#10b981' : confidence > 0.3 ? '#f59e0b' : '#6366f1'
              : 'rgba(255,255,255,0.08)',
            boxShadow: i < filled ? `0 0 4px ${confidence > 0.7 ? '#10b981' : confidence > 0.3 ? '#f59e0b' : '#6366f1'}40` : 'none',
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
        background: hasProgress ? '#1a1b2e' : '#12131f',
        border: `1px solid ${hasProgress ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)'}`,
        opacity: hasProgress ? 1 : 0.6,
      }}
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <span className="text-[13px] font-medium" style={{ color: hasProgress ? '#e2e8f0' : '#64748b' }}>
          {concept.name}
        </span>
        <ConfidenceDots confidence={concept.confidence} />
      </div>
      <p className="text-[11px] leading-relaxed" style={{ color: '#64748b' }}>
        {concept.description}
      </p>
      {concept.encounters > 0 && (
        <div className="flex items-center gap-3 mt-2">
          <span className="text-[10px]" style={{ color: '#475569' }}>
            {concept.encounters} encounter{concept.encounters !== 1 ? 's' : ''}
          </span>
          {concept.last_encountered_at && (
            <span className="text-[10px]" style={{ color: '#475569' }}>
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
          onClick={() => navigate(-1)}
          className="w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200"
          style={{ color: '#64748b', background: 'rgba(255,255,255,0.04)' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#94a3b8'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = '#64748b'; }}
        >
          <ArrowLeft size={16} />
        </button>
        <span className="font-heading text-sm font-semibold" style={{ color: '#e2e8f0' }}>
          Skill Profile
        </span>
        {totalConcepts > 0 && (
          <span className="text-[11px] font-medium px-2 py-0.5 rounded-full ml-2" style={{
            background: 'rgba(99, 102, 241, 0.15)',
            color: '#a5b4fc',
            border: '1px solid rgba(99, 102, 241, 0.2)',
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
                <div className="w-24 h-4 rounded-lg" style={{ background: '#1a1b2e' }} />
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {[...Array(3)].map((_, j) => (
                    <div
                      key={j}
                      className="h-20 rounded-xl"
                      style={{ background: '#12131f', animation: `pulse 1.5s ease-in-out infinite ${(i * 3 + j) * 0.1}s` }}
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
              style={{ background: '#12131f', border: '1px solid rgba(255,255,255,0.06)' }}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold" style={{ color: '#e2e8f0' }}>
                  Your understanding
                </h3>
                <span className="text-xs" style={{ color: '#64748b' }}>
                  {totalEncountered} of {totalConcepts} concepts
                </span>
              </div>
              {/* Progress bar */}
              <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)' }}>
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
                      <span className="text-[10px] ml-1" style={{ color: '#475569' }}>
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
                <h3 className="text-sm font-semibold mb-4" style={{ color: '#e2e8f0' }}>
                  Exploration timeline
                </h3>
                <div className="space-y-2">
                  {profile.timeline.map(project => (
                    <div
                      key={project.id}
                      className="flex items-center gap-3 rounded-xl px-4 py-3"
                      style={{
                        background: '#12131f',
                        border: '1px solid rgba(255,255,255,0.04)',
                      }}
                    >
                      <Circle
                        size={8}
                        fill={project.is_curated ? '#10b981' : '#6366f1'}
                        stroke="none"
                      />
                      <span className="text-[13px] font-medium flex-1" style={{ color: '#e2e8f0' }}>
                        {project.name}
                      </span>
                      <span className="text-[11px]" style={{ color: '#475569' }}>
                        {project.is_curated ? 'Curated' : 'Upload'}
                      </span>
                      <span className="text-[11px]" style={{ color: '#475569' }}>
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
