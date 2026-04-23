// Swim-lane layout — concepts organized into labeled horizontal bands by
// architectural layer, with left-to-right reading order within each band.
// Orthogonal edge routing with rounded corners.

export function nodeRadius(c) {
  const byImportance = { critical: 50, important: 42, supporting: 34 };
  const base = byImportance[c.importance] || 38;
  return base + Math.min(8, (c.fileCount || 0) * 0.6);
}

export function layoutSwimLanes(concepts, edges, W, H) {
  const PAD_TOP = 70;
  const PAD_BOT = 60;
  const PAD_L = 160;
  const PAD_R = 80;
  const innerH = H - PAD_TOP - PAD_BOT;
  const innerW = W - PAD_L - PAD_R;

  const byLayer = {};
  concepts.forEach(c => {
    const layer = c.layer ?? 0;
    if (!byLayer[layer]) byLayer[layer] = [];
    byLayer[layer].push(c);
  });
  const layerKeys = Object.keys(byLayer).map(Number).sort((a, b) => a - b);
  layerKeys.forEach(k => byLayer[k].sort((a, b) => (a._order || 0) - (b._order || 0)));

  const laneCount = Math.max(1, layerKeys.length);
  const laneHeight = innerH / laneCount;
  const laneLabels = {
    0: 'Entry Point',
    1: 'Features',
    2: 'Services',
    3: 'Data Layer',
  };

  const nodes = [];
  const lanes = [];
  layerKeys.forEach((k, laneIdx) => {
    const band = byLayer[k];
    const laneY = PAD_TOP + laneHeight * laneIdx;
    const laneCY = laneY + laneHeight / 2;
    lanes.push({
      key: k,
      label: laneLabels[k] || `Layer ${k}`,
      color: band[0]?.color || 'gray',
      y: laneY,
      height: laneHeight,
      centerY: laneCY,
    });
    const cols = band.length;
    band.forEach((c, colIdx) => {
      const x = PAD_L + (cols === 1 ? innerW / 2 : (innerW * colIdx) / (cols - 1));
      nodes.push({
        ...c,
        x,
        y: laneCY,
        r: nodeRadius(c),
        _laneIdx: laneIdx,
      });
    });
  });

  return {
    nodes,
    edges: edges.map(e => ({ ...e })),
    lanes,
    contentBox: { x: 0, y: 0, w: W, h: H },
  };
}

export function routeOrthogonalEdge(a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);

  let sx, sy, tx, ty;
  const verticalDominant = absDy > absDx * 0.8;

  if (verticalDominant) {
    sx = a.x;
    sy = a.y + Math.sign(dy) * a.r;
    tx = b.x;
    ty = b.y - Math.sign(dy) * b.r;
  } else {
    sx = a.x + Math.sign(dx) * a.r;
    sy = a.y;
    tx = b.x - Math.sign(dx) * b.r;
    ty = b.y;
  }

  const midY = (sy + ty) / 2;
  const midX = (sx + tx) / 2;

  if (verticalDominant) {
    return [
      { x: sx, y: sy },
      { x: sx, y: midY },
      { x: tx, y: midY },
      { x: tx, y: ty },
    ];
  }
  return [
    { x: sx, y: sy },
    { x: midX, y: sy },
    { x: midX, y: ty },
    { x: tx, y: ty },
  ];
}

export function pathFromPoints(points, cornerR = 14) {
  if (points.length === 0) return '';
  if (points.length === 1) return `M${points[0].x},${points[0].y}`;
  if (points.length === 2)
    return `M${points[0].x},${points[0].y} L${points[1].x},${points[1].y}`;

  let d = `M${points[0].x},${points[0].y}`;
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1];
    const cur = points[i];
    const next = points[i + 1];

    const d1x = cur.x - prev.x;
    const d1y = cur.y - prev.y;
    const d2x = next.x - cur.x;
    const d2y = next.y - cur.y;
    const l1 = Math.hypot(d1x, d1y);
    const l2 = Math.hypot(d2x, d2y);
    const r = Math.min(cornerR, l1 / 2, l2 / 2);
    if (r < 1) {
      d += ` L${cur.x},${cur.y}`;
      continue;
    }
    const p1 = { x: cur.x - (d1x / l1) * r, y: cur.y - (d1y / l1) * r };
    const p2 = { x: cur.x + (d2x / l2) * r, y: cur.y + (d2y / l2) * r };
    d += ` L${p1.x},${p1.y} Q${cur.x},${cur.y} ${p2.x},${p2.y}`;
  }
  const last = points[points.length - 1];
  d += ` L${last.x},${last.y}`;
  return d;
}
