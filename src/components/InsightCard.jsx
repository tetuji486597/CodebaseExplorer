import { useState } from 'react';
import useStore from '../store/useStore';
import { Building2, AlertTriangle, RefreshCw, Sparkles, Lightbulb, Puzzle, X } from 'lucide-react';
import KeywordHighlighter from './KeywordHighlighter';

const CATEGORY_COLORS = {
  architecture: 'var(--color-accent)',
  risk: 'var(--color-error)',
  pattern: 'var(--color-accent)',
  praise: 'var(--color-success)',
  suggestion: 'var(--color-warning)',
  complexity: 'var(--color-info)',
};

const CATEGORY_ICONS = {
  architecture: Building2,
  risk: AlertTriangle,
  pattern: RefreshCw,
  praise: Sparkles,
  suggestion: Lightbulb,
  complexity: Puzzle,
};

export default function InsightCard() {
  const { insightCard, setInsightCard } = useStore();
  const [expanded, setExpanded] = useState(false);

  if (!insightCard) return null;

  const color = CATEGORY_COLORS[insightCard.category] || 'var(--color-text-secondary)';
  const Icon = CATEGORY_ICONS[insightCard.category] || Lightbulb;

  const dismiss = () => {
    setInsightCard(null);
    setExpanded(false);
  };

  return (
    <div
      className="absolute bottom-20 left-1/2 -translate-x-1/2 z-30 w-full max-w-md mx-4"
      style={{ animation: 'fade-in 0.3s ease-out' }}
    >
      <div
        className="rounded-xl overflow-hidden"
        style={{
          background: 'var(--color-bg-elevated)',
          border: `1px solid color-mix(in srgb, ${color} 20%, transparent)`,
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3"
          style={{ borderBottom: `1px solid color-mix(in srgb, ${color} 12%, transparent)` }}
        >
          <div className="flex items-center gap-2">
            <Icon size={14} style={{ color }} />
            <span className="text-xs font-medium uppercase tracking-wide" style={{ color }}>
              {insightCard.category}
            </span>
          </div>
          <button
            onClick={dismiss}
            className="w-6 h-6 rounded-lg flex items-center justify-center transition-colors duration-200"
            style={{ color: 'var(--color-text-tertiary)' }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--color-text-secondary)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--color-text-tertiary)'}
          >
            <X size={12} />
          </button>
        </div>

        {/* Content */}
        <div className="px-4 py-3">
          <h3 className="text-sm font-medium mb-1" style={{ color: 'var(--color-text-primary)' }}>
            {insightCard.title}
          </h3>
          <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
            <KeywordHighlighter text={insightCard.summary} accentColor={color} />
          </p>

          {expanded && (
            <p className="text-xs leading-relaxed mt-2" style={{ color: 'var(--color-text-primary)', animation: 'fade-in 0.2s ease-out' }}>
              <KeywordHighlighter text={insightCard.detail} accentColor={color} />
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 px-4 py-2.5" style={{ borderTop: `1px solid color-mix(in srgb, ${color} 6%, transparent)` }}>
          {!expanded && insightCard.detail && (
            <button
              onClick={() => setExpanded(true)}
              className="text-xs font-medium px-2.5 py-1 rounded-lg transition-all duration-200"
              style={{ color, background: `color-mix(in srgb, ${color} 10%, transparent)` }}
            >
              Tell me more
            </button>
          )}
          <button
            onClick={dismiss}
            className="text-xs font-medium px-2.5 py-1 rounded-lg transition-all duration-200"
            style={{ color: 'var(--color-text-tertiary)' }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--color-text-secondary)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--color-text-tertiary)'}
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
