import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import useStore from '../store/useStore';
import { CheckCircle2, ArrowRight, Sparkles, Compass } from 'lucide-react';
import { API_BASE } from '../lib/api';

export default function CompletionSummary() {
  const navigate = useNavigate();
  const { concepts, exploredConcepts, projectId, guidedMode } = useStore();
  const [summary, setSummary] = useState(null);
  const [nextCodebase, setNextCodebase] = useState(null);
  const [dismissed, setDismissed] = useState(false);

  const curatedId = localStorage.getItem('cbe_curated_id');
  const exploredPercent = concepts.length > 0 ? exploredConcepts.size / concepts.length : 0;

  // Only show for curated codebases, after guided tour ends, and at 70%+ explored
  const show = exploredPercent >= 0.7 && !dismissed && !guidedMode && !!curatedId;

  useEffect(() => {
    if (!show) return;
    if (!curatedId) return;

    const fetchSummary = async () => {
      try {
        // Get the curated codebase name
        const cbRes = await fetch(`${API_BASE}/api/curated/${curatedId}`);
        const codebase = await cbRes.json();

        // Get skill profile to find new concepts
        const profileRes = await fetch(`${API_BASE}/api/skill-profile?userId=anonymous`);
        const profile = await profileRes.json();

        // Find concepts with few encounters (likely new from this session)
        const recentConcepts = (profile.concepts || [])
          .filter(c => c.encounters > 0 && c.encounters <= 3)
          .map(c => c.name);

        setSummary({
          codebaseName: codebase.name || 'this codebase',
          newConcepts: recentConcepts.slice(0, 5),
        });

        // Find next recommended codebase
        const allRes = await fetch(`${API_BASE}/api/curated`);
        const allCodebases = await allRes.json();

        // Find lowest-confidence universal concepts
        const lowConfidence = (profile.concepts || [])
          .filter(c => c.confidence < 0.5)
          .map(c => c.name);

        // Score each codebase by how many low-confidence concepts it teaches
        const scored = allCodebases
          .filter(cb => cb.id !== curatedId)
          .map(cb => ({
            ...cb,
            score: (cb.primary_concepts || []).filter(pc =>
              lowConfidence.some(lc => lc.toLowerCase().includes(pc.toLowerCase()) || pc.toLowerCase().includes(lc.toLowerCase()))
            ).length,
          }))
          .sort((a, b) => b.score - a.score);

        if (scored.length > 0) {
          setNextCodebase(scored[0]);
        }
      } catch (err) {
        console.error('Failed to fetch completion summary:', err);
      }
    };

    fetchSummary();
  }, [show]);

  if (!show || !summary) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0, 0, 0, 0.4)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
    >
      <div
        className="w-full max-w-md mx-4 rounded-2xl p-7"
        style={{
          background: 'var(--color-bg-elevated)',
          border: '1px solid var(--color-border-visible)',
          boxShadow: 'var(--shadow-lg)',
          animation: 'fade-in 0.4s ease-out',
        }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: 'var(--color-success-soft)', border: '1px solid color-mix(in srgb, var(--color-success) 20%, transparent)' }}
          >
            <CheckCircle2 size={20} style={{ color: 'var(--color-success)' }} />
          </div>
          <div>
            <h2 className="text-base font-semibold font-heading" style={{ color: 'var(--color-text-primary)' }}>
              Nice work exploring
            </h2>
            <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
              {summary.codebaseName}
            </p>
          </div>
        </div>

        {/* New concepts */}
        {summary.newConcepts.length > 0 && (
          <div className="mb-5">
            <p className="text-xs font-medium mb-2.5" style={{ color: 'var(--color-text-secondary)' }}>
              Concepts you encountered:
            </p>
            <div className="flex flex-wrap gap-1.5">
              {summary.newConcepts.map(name => (
                <span
                  key={name}
                  className="text-[11px] px-2.5 py-1 rounded-lg font-medium"
                  style={{
                    background: 'var(--color-success-soft)',
                    color: 'var(--color-success)',
                    border: '1px solid color-mix(in srgb, var(--color-success) 20%, transparent)',
                  }}
                >
                  {name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Next codebase suggestion */}
        {nextCodebase && (
          <div
            className="rounded-xl p-4 mb-5"
            style={{ background: 'var(--color-bg-sunken)', border: '1px solid var(--color-border-subtle)' }}
          >
            <div className="flex items-center gap-2 mb-2">
              <Sparkles size={13} style={{ color: 'var(--color-warning)' }} />
              <span className="text-[11px] font-medium" style={{ color: 'var(--color-warning)' }}>
                Recommended next
              </span>
            </div>
            <p className="text-[13px] font-medium mb-1" style={{ color: 'var(--color-text-primary)' }}>
              {nextCodebase.name}
            </p>
            <p className="text-[11px] leading-relaxed" style={{ color: 'var(--color-text-tertiary)' }}>
              {nextCodebase.description}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="space-y-2">
          <button
            onClick={() => {
              setDismissed(true);
              setSummary(null);
            }}
            className="w-full py-2.5 rounded-xl text-[13px] font-semibold transition-all duration-200 active:scale-[0.98] flex items-center justify-center gap-1.5"
            style={{
              background: 'var(--color-accent-soft)',
              color: 'var(--color-accent-active)',
              border: '1px solid var(--color-border-strong)',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-accent)'; e.currentTarget.style.color = 'var(--color-text-inverse)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'var(--color-accent-soft)'; e.currentTarget.style.color = 'var(--color-accent-active)'; }}
          >
            <Compass size={14} />
            Keep exploring this codebase
          </button>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setSummary(null);
                navigate('/upload');
              }}
              className="flex-1 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-200 active:scale-[0.98]"
              style={{
                background: 'var(--color-bg-sunken)',
                color: 'var(--color-text-secondary)',
                border: '1px solid var(--color-border-subtle)',
              }}
            >
              Explore another codebase
            </button>
            <button
              onClick={() => {
                setSummary(null);
                navigate('/profile');
              }}
              className="flex-1 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-200 active:scale-[0.98] flex items-center justify-center gap-1.5"
              style={{
                background: 'var(--color-bg-sunken)',
                color: 'var(--color-text-secondary)',
                border: '1px solid var(--color-border-subtle)',
              }}
            >
              View progress <ArrowRight size={13} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
