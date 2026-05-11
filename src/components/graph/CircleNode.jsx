import { memo, useState, useMemo } from 'react';
import { resolveColor } from '../../utils/circlePackLayout';

function fitLabel(text, maxWidth, charW) {
  if (!text) return { lines: [], fontSize: 10 };
  const words = text.split(/\s+/);

  for (let size = 14; size >= 7; size--) {
    const cw = size * charW;
    const maxChars = Math.floor(maxWidth / cw);

    if (text.length <= maxChars) {
      return { lines: [text], fontSize: size };
    }

    const line1 = [];
    const line2 = [];
    let len1 = 0;
    let onLine2 = false;

    for (const word of words) {
      if (!onLine2 && len1 + word.length + (line1.length ? 1 : 0) <= maxChars) {
        line1.push(word);
        len1 += word.length + (line1.length > 1 ? 1 : 0);
      } else {
        onLine2 = true;
        line2.push(word);
      }
    }

    const l2Text = line2.join(' ');
    if (line1.length > 0 && l2Text.length <= maxChars) {
      return { lines: [line1.join(' '), l2Text], fontSize: size };
    }
    if (line1.length > 0 && size <= 9) {
      const truncated = l2Text.length > maxChars
        ? l2Text.slice(0, maxChars - 1) + '\u2026'
        : l2Text;
      return { lines: [line1.join(' '), truncated], fontSize: size };
    }
  }

  const cw = 7 * charW;
  const maxChars = Math.floor(maxWidth / cw);
  return { lines: [text.slice(0, Math.max(3, maxChars - 1)) + '\u2026'], fontSize: 7 };
}

const CircleNode = memo(function CircleNode({
  node,
  screenRadius,
  isSelected,
  isHero = false,
  isFocused,
  isLoading,
  onClick,
  onDoubleClick,
  childCount,
  entranceDelay = 0,
}) {
  const [hovered, setHovered] = useState(false);
  const color = resolveColor(node.data.color);
  const hasChildren = node.data.hasChildren;
  const showLabel = screenRadius > 12;
  const showOneLiner = screenRadius > 60 && !isHero;
  const showChildBadge = !isHero && hasChildren && childCount > 0 && screenRadius > 35;
  const showExpandIcon = !isHero && hasChildren && !node.children && screenRadius > 18;

  const fillOpacity = isHero ? (hovered ? 0.25 : 0.18) : (hovered ? 0.22 : 0.12);
  const strokeOpacity = hovered ? 0.6 : isSelected ? 0.8 : (isHero ? 0.5 : 0.35);
  const strokeWidth = isSelected ? 2.5 : 1.5;

  const maxTextWidth = node.r * 1.7;
  const charW = 0.55;

  const label = useMemo(
    () => fitLabel(node.data.name, maxTextWidth, charW),
    [node.data.name, maxTextWidth],
  );

  const oneLiner = useMemo(() => {
    if (!showOneLiner || !node.data.one_liner) return null;
    const size = Math.max(7, Math.min(10, maxTextWidth / (node.data.one_liner.length * charW)));
    const maxChars = Math.floor(maxTextWidth / (size * charW));
    const text = node.data.one_liner.length <= maxChars
      ? node.data.one_liner
      : node.data.one_liner.slice(0, maxChars - 1) + '\u2026';
    return { text, fontSize: size };
  }, [showOneLiner, node.data.one_liner, maxTextWidth]);

  const labelHeight = label.lines.length * label.fontSize * 1.2;
  const oneLinerHeight = oneLiner ? oneLiner.fontSize * 1.2 : 0;
  const totalTextHeight = labelHeight + oneLinerHeight;
  const labelStartY = node.y - totalTextHeight / 2 + label.fontSize * 0.6;

  // Expand indicator position: bottom of the node
  const expandIconY = node.y + node.r * 0.62;
  const expandIconSize = Math.max(4, Math.min(7, node.r * 0.08));

  return (
    <g
      data-node-id={node.data.id}
      style={{
        cursor: 'pointer',
        opacity: entranceDelay > 0 ? 0 : 1,
        transform: entranceDelay > 0 ? `scale(0.7)` : 'scale(1)',
        transformOrigin: `${node.x}px ${node.y}px`,
        animation: entranceDelay > 0
          ? `node-entrance 400ms ${entranceDelay}ms ease-out forwards`
          : 'none',
        transition: entranceDelay > 0 ? 'none' : 'opacity 300ms ease-out',
      }}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Hero pulse glow */}
      {isHero && !isSelected && (
        <circle
          cx={node.x} cy={node.y} r={node.r + 8}
          fill="none" stroke={color} strokeWidth={6}
          style={{ animation: 'hero-pulse 3s ease-in-out infinite' }}
        />
      )}

      {isSelected && (
        <>
          <circle cx={node.x} cy={node.y} r={node.r + 6} fill="none" stroke={color} strokeOpacity={0.15} strokeWidth={8} />
          <circle cx={node.x} cy={node.y} r={node.r + 3} fill="none" stroke={color} strokeOpacity={0.3} strokeWidth={3} />
        </>
      )}

      {hovered && !isSelected && !isHero && (
        <circle cx={node.x} cy={node.y} r={node.r + 4} fill="none" stroke={color} strokeOpacity={0.2} strokeWidth={4} />
      )}

      <circle
        cx={node.x}
        cy={node.y}
        r={node.r}
        fill={color}
        fillOpacity={fillOpacity}
        stroke={color}
        strokeOpacity={strokeOpacity}
        strokeWidth={strokeWidth}
        style={{ transition: 'fill-opacity 150ms, stroke-opacity 150ms' }}
      />

      {/* Dashed inner ring for expandable nodes */}
      {hasChildren && !node.children && screenRadius > 20 && (
        <circle
          cx={node.x}
          cy={node.y}
          r={node.r * 0.75}
          fill="none"
          stroke={color}
          strokeOpacity={hovered ? 0.5 : 0.2}
          strokeWidth={1.5}
          strokeDasharray={`${Math.max(3, node.r * 0.12)} ${Math.max(3, node.r * 0.08)}`}
          style={{
            transition: 'stroke-opacity 150ms',
            animation: hovered ? 'none' : 'ring-breathe 3s ease-in-out infinite',
          }}
        />
      )}

      {isLoading && (
        <circle
          cx={node.x}
          cy={node.y}
          r={node.r * 0.75}
          fill="none"
          stroke={color}
          strokeOpacity={0.5}
          strokeWidth={2}
          strokeDasharray={`${node.r * 0.5} ${node.r * 1.5}`}
          style={{ transformOrigin: `${node.x}px ${node.y}px`, animation: 'spin 1.5s linear infinite' }}
        />
      )}

      {showLabel && label.lines.map((line, i) => (
        <text
          key={i}
          x={node.x}
          y={labelStartY + i * label.fontSize * 1.2}
          textAnchor="middle"
          dominantBaseline="central"
          fill="var(--color-text-primary, #e2e8f0)"
          fontSize={label.fontSize}
          fontWeight={600}
          fontFamily="'DM Sans', 'Inter', system-ui, sans-serif"
          style={{ pointerEvents: 'none', userSelect: 'none' }}
        >
          {line}
        </text>
      ))}

      {oneLiner && (
        <text
          x={node.x}
          y={labelStartY + label.lines.length * label.fontSize * 1.2}
          textAnchor="middle"
          dominantBaseline="central"
          fill="var(--color-text-secondary, #94a3b8)"
          fontSize={oneLiner.fontSize}
          fontWeight={400}
          fontFamily="'DM Sans', 'Inter', system-ui, sans-serif"
          style={{ pointerEvents: 'none', userSelect: 'none' }}
        >
          {oneLiner.text}
        </text>
      )}


      {/* Always-visible expand indicator for nodes with children */}
      {showExpandIcon && (
        <g style={{ pointerEvents: 'none', opacity: hovered ? 1 : 0.6, transition: 'opacity 200ms ease-out' }}>
          <rect
            x={node.x - expandIconSize * 1.8}
            y={expandIconY - expandIconSize * 0.9}
            width={expandIconSize * 3.6}
            height={expandIconSize * 1.8}
            rx={expandIconSize * 0.9}
            fill="var(--color-bg-elevated, #2D3532)"
            fillOpacity={0.85}
            stroke={color}
            strokeOpacity={0.3}
            strokeWidth={0.75}
          />
          <rect x={node.x - expandIconSize * 0.9} y={expandIconY - expandIconSize * 0.3} width={expandIconSize * 1.8} height={expandIconSize * 0.18} rx={1} fill={color} fillOpacity={0.8} />
          <rect x={node.x - expandIconSize * 0.65} y={expandIconY + expandIconSize * 0.15} width={expandIconSize * 1.3} height={expandIconSize * 0.18} rx={1} fill={color} fillOpacity={0.5} />
        </g>
      )}

      {/* Child count badge on hover */}
      {showChildBadge && (
        <g>
          <rect
            x={node.x - 14}
            y={node.y + node.r * 0.45 - 9}
            width={28}
            height={18}
            rx={9}
            fill="var(--color-bg-elevated, #2D3532)"
            fillOpacity={0.85}
            stroke={color}
            strokeOpacity={0.4}
            strokeWidth={1}
          />
          <text
            x={node.x}
            y={node.y + node.r * 0.45}
            textAnchor="middle"
            dominantBaseline="central"
            fill="var(--color-text-secondary, #94a3b8)"
            fontSize={10}
            fontWeight={600}
            style={{ pointerEvents: 'none' }}
          >
            {childCount}
          </text>
        </g>
      )}
    </g>
  );
});

export default CircleNode;
