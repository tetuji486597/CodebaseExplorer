import { memo, useState, useMemo } from 'react';
import { resolveColor } from '../../utils/circlePackLayout';

function computeArc(srcNode, tgtNode, edgeIndex, totalBetweenPair) {
  const sx = srcNode.x, sy = srcNode.y, sr = srcNode.r;
  const tx = tgtNode.x, ty = tgtNode.y, tr = tgtNode.r;

  const dx = tx - sx;
  const dy = ty - sy;
  const dist = Math.hypot(dx, dy);
  if (dist < 1) return null;

  const nx = dx / dist;
  const ny = dy / dist;

  const startX = sx + nx * sr;
  const startY = sy + ny * sr;
  const endX = tx - nx * tr;
  const endY = ty - ny * tr;

  const mx = (startX + endX) / 2;
  const my = (startY + endY) / 2;

  const perpX = -ny;
  const perpY = nx;

  const chordLen = Math.hypot(endX - startX, endY - startY);
  const baseBow = chordLen * 0.25;
  const offset = totalBetweenPair > 1
    ? (edgeIndex - (totalBetweenPair - 1) / 2) * chordLen * 0.12
    : 0;
  const bow = baseBow + offset;

  const cx = mx + perpX * bow;
  const cy = my + perpY * bow;

  return {
    startX, startY, endX, endY, cx, cy,
    midX: mx + perpX * (bow * 0.5),
    midY: my + perpY * (bow * 0.5),
  };
}

const EdgeArc = memo(function EdgeArc({
  edge, arc, color, isConnected, isDimmed, scale,
}) {
  const [hovered, setHovered] = useState(false);

  const baseOpacity = isConnected ? 0.45 : isDimmed ? 0.04 : 0.15;
  const opacity = hovered ? 0.7 : baseOpacity;
  const strokeW = (isConnected ? 2 : 1.5) / scale;
  const showLabel = hovered && edge.label && scale > 0.4;

  const labelMaxLen = 36;
  const labelText = edge.label && edge.label.length > labelMaxLen
    ? edge.label.slice(0, labelMaxLen - 1) + '\u2026'
    : edge.label;

  const labelFontSize = Math.max(8, Math.min(11, 11 / scale));
  const pillPadX = 6 / scale;
  const pillPadY = 3 / scale;
  const pillW = labelText ? labelText.length * labelFontSize * 0.52 + pillPadX * 2 : 0;
  const pillH = labelFontSize + pillPadY * 2;

  return (
    <g
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ cursor: hovered ? 'default' : 'auto' }}
    >
      {/* Invisible fat hit area */}
      <path
        d={`M${arc.startX},${arc.startY} Q${arc.cx},${arc.cy} ${arc.endX},${arc.endY}`}
        fill="none"
        stroke="transparent"
        strokeWidth={Math.max(12, 20 / scale)}
        style={{ pointerEvents: 'stroke' }}
      />

      <path
        d={`M${arc.startX},${arc.startY} Q${arc.cx},${arc.cy} ${arc.endX},${arc.endY}`}
        fill="none"
        stroke={color}
        strokeOpacity={opacity}
        strokeWidth={strokeW}
        strokeLinecap="round"
        strokeDasharray={isConnected ? 'none' : `${6 / scale} ${4 / scale}`}
        style={{
          transition: 'stroke-opacity 200ms ease-out, stroke-width 200ms ease-out',
          pointerEvents: 'none',
        }}
      />

      {/* Directional dot at target end */}
      <circle
        cx={arc.endX}
        cy={arc.endY}
        r={Math.max(2, 3 / scale)}
        fill={color}
        fillOpacity={opacity * 0.8}
        style={{ transition: 'fill-opacity 200ms ease-out', pointerEvents: 'none' }}
      />

      {/* Floating label pill on hover */}
      {showLabel && (
        <g style={{ pointerEvents: 'none' }}>
          <rect
            x={arc.midX - pillW / 2}
            y={arc.midY - pillH / 2}
            width={pillW}
            height={pillH}
            rx={pillH / 2}
            fill="var(--color-bg-elevated, #2D3532)"
            fillOpacity={0.92}
            stroke={color}
            strokeOpacity={0.3}
            strokeWidth={0.75 / scale}
          />
          <text
            x={arc.midX}
            y={arc.midY}
            textAnchor="middle"
            dominantBaseline="central"
            fill={color}
            fontSize={labelFontSize}
            fontWeight={500}
            fontFamily="'DM Sans', 'Inter', system-ui, sans-serif"
            style={{ userSelect: 'none' }}
          >
            {labelText}
          </text>
        </g>
      )}
    </g>
  );
});

const EdgeArcs = memo(function EdgeArcs({ edges, selectedId, scale, entranceActive }) {
  const { pairCounts, pairIndices } = useMemo(() => {
    const counts = {};
    const indices = {};
    const running = {};
    for (let i = 0; i < edges.length; i++) {
      const e = edges[i];
      const key = [e.source, e.target].sort().join('::');
      counts[key] = (counts[key] || 0) + 1;
      running[key] = running[key] || 0;
      indices[i] = running[key];
      running[key]++;
    }
    return { pairCounts: counts, pairIndices: indices };
  }, [edges]);

  const connectedToSelected = useMemo(() => {
    if (!selectedId) return null;
    const ids = new Set();
    for (const e of edges) {
      if (e.source === selectedId || e.target === selectedId) {
        ids.add(e.source);
        ids.add(e.target);
      }
    }
    return ids.size > 0 ? ids : null;
  }, [selectedId, edges]);

  if (entranceActive) return null;

  return (
    <g style={{ opacity: 1, animation: 'edge-fade-in 600ms ease-out' }}>
      <style>{`
        @keyframes edge-fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
      {edges.map((e, i) => {
        const pairKey = [e.source, e.target].sort().join('::');
        const total = pairCounts[pairKey] || 1;
        const arc = computeArc(e.srcNode, e.tgtNode, pairIndices[i] || 0, total);
        if (!arc) return null;

        const color = resolveColor(e.srcNode.data.color);
        const isConnected = connectedToSelected
          ? connectedToSelected.has(e.source) && connectedToSelected.has(e.target)
          : false;
        const isDimmed = !!selectedId && !isConnected;

        return (
          <EdgeArc
            key={`${e.source}-${e.target}-${i}`}
            edge={e}
            arc={arc}
            color={color}
            isConnected={isConnected}
            isDimmed={isDimmed}
            scale={scale}
          />
        );
      })}
    </g>
  );
});

export default EdgeArcs;
