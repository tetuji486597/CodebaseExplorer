import { ChevronRight, ArrowLeft, Home } from 'lucide-react';
import useStore from '../../store/useStore';
import { resolveColor } from '../../utils/circlePackLayout';

export default function Breadcrumbs() {
  const focusStack = useStore(s => s.focusStack);
  const concepts = useStore(s => s.concepts);
  const subConceptsCache = useStore(s => s.subConceptsCache);
  const drillToLevel = useStore(s => s.drillToLevel);
  const drillOut = useStore(s => s.drillOut);

  if (focusStack.length <= 1) return null;

  const items = focusStack.map((id, index) => {
    let concept = concepts.find(c => c.id === id);
    if (!concept) {
      for (const cached of Object.values(subConceptsCache)) {
        const found = cached.subConcepts?.find(sc => sc.id === id);
        if (found) { concept = found; break; }
      }
    }
    return {
      id,
      name: concept?.name || id,
      color: concept?.color || 'blue',
      index,
    };
  });

  return (
    <div
      className="graph-breadcrumb-bar glass-pill"
      style={{
        position: 'absolute',
        top: 12,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 20,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '8px 16px',
        borderRadius: 'var(--radius-pill)',
        maxWidth: 'calc(100% - 32px)',
        overflowX: 'auto',
        WebkitOverflowScrolling: 'touch',
      }}
    >
      <button
        onClick={drillOut}
        aria-label="Go back"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 32,
          height: 32,
          borderRadius: 'var(--radius-sm)',
          border: 'none',
          background: 'transparent',
          color: 'var(--color-text-secondary)',
          cursor: 'pointer',
          flexShrink: 0,
          transition: 'background 150ms ease-out, color 150ms ease-out',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.background = 'var(--color-bg-sunken)';
          e.currentTarget.style.color = 'var(--color-text-primary)';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.background = 'transparent';
          e.currentTarget.style.color = 'var(--color-text-secondary)';
        }}
      >
        <ArrowLeft size={16} strokeWidth={2} />
      </button>

      <div style={{
        width: 1,
        height: 18,
        background: 'var(--color-border-subtle)',
        flexShrink: 0,
      }} />

      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        const isUniverse = item.id === '__universe__';

        return (
          <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
            {i > 0 && (
              <ChevronRight
                size={14}
                style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }}
              />
            )}
            <button
              onClick={() => { if (!isLast) drillToLevel(item.index); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 10px',
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                background: isLast ? 'var(--color-bg-sunken)' : 'transparent',
                cursor: isLast ? 'default' : 'pointer',
                transition: 'background 150ms ease-out',
                outline: 'none',
              }}
              onMouseEnter={e => {
                if (!isLast) e.currentTarget.style.background = 'var(--color-bg-sunken)';
              }}
              onMouseLeave={e => {
                if (!isLast) e.currentTarget.style.background = 'transparent';
              }}
            >
              {isUniverse ? (
                <Home
                  size={14}
                  strokeWidth={1.75}
                  style={{ color: 'var(--color-text-secondary)', flexShrink: 0 }}
                />
              ) : (
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: resolveColor(item.color),
                    flexShrink: 0,
                  }}
                />
              )}
              <span
                style={{
                  fontSize: 13,
                  fontWeight: isLast ? 600 : 500,
                  color: isLast
                    ? 'var(--color-text-primary)'
                    : 'var(--color-text-secondary)',
                  whiteSpace: 'nowrap',
                }}
              >
                {isUniverse ? 'Home' : item.name}
              </span>
            </button>
          </div>
        );
      })}
    </div>
  );
}
