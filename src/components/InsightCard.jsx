import { useState } from 'react';
import useStore from '../store/useStore';
import { Building2, AlertTriangle, RefreshCw, Sparkles, Lightbulb, Puzzle, X } from 'lucide-react';
import KeywordHighlighter from './KeywordHighlighter';

const CATEGORY_COLORS = {
  architecture: '#6366f1',
  risk: '#ef4444',
  pattern: '#8b5cf6',
  praise: '#10b981',
  suggestion: '#f59e0b',
  complexity: '#ec4899',
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

  const color = CATEGORY_COLORS[insightCard.category] || '#94a3b8';
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
          background: '#14142b',
          border: `1px solid ${color}30`,
          boxShadow: `0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px ${color}10`,
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3"
          style={{ borderBottom: `1px solid ${color}20` }}
        >
          <div className="flex items-center gap-2">
            <Icon size={14} style={{ color }} />
            <span className="text-xs font-medium uppercase tracking-wide" style={{ color: color + 'cc' }}>
              {insightCard.category}
            </span>
          </div>
          <button
            onClick={dismiss}
            className="w-6 h-6 rounded-lg flex items-center justify-center transition-colors duration-200"
            style={{ color: '#475569' }}
            onMouseEnter={e => e.currentTarget.style.color = '#94a3b8'}
            onMouseLeave={e => e.currentTarget.style.color = '#475569'}
          >
            <X size={12} />
          </button>
        </div>

        {/* Content */}
        <div className="px-4 py-3">
          <h3 className="text-sm font-medium mb-1" style={{ color: '#e2e8f0' }}>
            {insightCard.title}
          </h3>
          <p className="text-xs leading-relaxed" style={{ color: '#94a3b8' }}>
            <KeywordHighlighter text={insightCard.summary} accentColor={color} />
          </p>

          {expanded && (
            <p className="text-xs leading-relaxed mt-2" style={{ color: '#cbd5e1', animation: 'fade-in 0.2s ease-out' }}>
              <KeywordHighlighter text={insightCard.detail} accentColor={color} />
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 px-4 py-2.5" style={{ borderTop: `1px solid ${color}10` }}>
          {!expanded && insightCard.detail && (
            <button
              onClick={() => setExpanded(true)}
              className="text-xs font-medium px-2.5 py-1 rounded-lg transition-all duration-200"
              style={{ color, background: color + '15' }}
            >
              Tell me more
            </button>
          )}
          <button
            onClick={dismiss}
            className="text-xs font-medium px-2.5 py-1 rounded-lg transition-all duration-200"
            style={{ color: '#64748b' }}
            onMouseEnter={e => e.currentTarget.style.color = '#94a3b8'}
            onMouseLeave={e => e.currentTarget.style.color = '#64748b'}
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
