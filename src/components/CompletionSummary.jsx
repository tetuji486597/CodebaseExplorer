import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import useStore from '../store/useStore';
import { CheckCircle2, ArrowRight, Sparkles, Compass } from 'lucide-react';

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
        const cbRes = await fetch(`/api/curated/${curatedId}`);
        const codebase = await cbRes.json();

        // Get skill profile to find new concepts
        const profileRes = await fetch('/api/skill-profile?userId=anonymous');
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
        const allRes = await fetch('/api/curated');
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
      style={{ background: 'rgba(10, 10, 20, 0.85)', backdropFilter: 'blur(8px)' }}
    >
      <div
        className="w-full max-w-md mx-4 rounded-2xl p-7"
        style={{
          background: '#14142b',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 8px 48px rgba(0,0,0,0.5)',
          animation: 'fade-in 0.4s ease-out',
        }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.2)' }}
          >
            <CheckCircle2 size={20} style={{ color: '#10b981' }} />
          </div>
          <div>
            <h2 className="text-base font-semibold font-heading" style={{ color: '#e2e8f0' }}>
              Nice work exploring
            </h2>
            <p className="text-xs" style={{ color: '#64748b' }}>
              {summary.codebaseName}
            </p>
          </div>
        </div>

        {/* New concepts */}
        {summary.newConcepts.length > 0 && (
          <div className="mb-5">
            <p className="text-xs font-medium mb-2.5" style={{ color: '#94a3b8' }}>
              Concepts you encountered:
            </p>
            <div className="flex flex-wrap gap-1.5">
              {summary.newConcepts.map(name => (
                <span
                  key={name}
                  className="text-[11px] px-2.5 py-1 rounded-lg font-medium"
                  style={{
                    background: 'rgba(16, 185, 129, 0.1)',
                    color: '#6ee7b7',
                    border: '1px solid rgba(16, 185, 129, 0.2)',
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
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
          >
            <div className="flex items-center gap-2 mb-2">
              <Sparkles size={13} style={{ color: '#f59e0b' }} />
              <span className="text-[11px] font-medium" style={{ color: '#f59e0b' }}>
                Recommended next
              </span>
            </div>
            <p className="text-[13px] font-medium mb-1" style={{ color: '#e2e8f0' }}>
              {nextCodebase.name}
            </p>
            <p className="text-[11px] leading-relaxed" style={{ color: '#64748b' }}>
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
              background: 'rgba(99, 102, 241, 0.15)',
              color: '#a5b4fc',
              border: '1px solid rgba(99, 102, 241, 0.2)',
            }}
          >
            <Compass size={14} />
            Keep exploring this codebase
          </button>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setSummary(null);
                navigate('/library');
              }}
              className="flex-1 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-200 active:scale-[0.98]"
              style={{
                background: 'rgba(255,255,255,0.04)',
                color: '#94a3b8',
                border: '1px solid rgba(255,255,255,0.06)',
              }}
            >
              Back to library
            </button>
            <button
              onClick={() => {
                setSummary(null);
                navigate('/profile');
              }}
              className="flex-1 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-200 active:scale-[0.98] flex items-center justify-center gap-1.5"
              style={{
                background: 'rgba(255,255,255,0.04)',
                color: '#94a3b8',
                border: '1px solid rgba(255,255,255,0.06)',
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
