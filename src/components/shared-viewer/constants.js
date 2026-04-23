export const COLOR_MAP = {
  teal:   { bg: '#0d9488', text: '#ccfbf1', glow: 'rgba(13,148,136,0.4)' },
  purple: { bg: '#7c3aed', text: '#ede9fe', glow: 'rgba(124,58,237,0.4)' },
  coral:  { bg: '#f43f5e', text: '#ffe4e6', glow: 'rgba(244,63,94,0.4)' },
  blue:   { bg: '#3b82f6', text: '#dbeafe', glow: 'rgba(59,130,246,0.4)' },
  amber:  { bg: '#f59e0b', text: '#fef3c7', glow: 'rgba(245,158,11,0.4)' },
  pink:   { bg: '#ec4899', text: '#fce7f3', glow: 'rgba(236,72,153,0.4)' },
  green:  { bg: '#10b981', text: '#d1fae5', glow: 'rgba(16,185,129,0.4)' },
  gray:   { bg: '#64748b', text: '#e2e8f0', glow: 'rgba(100,116,139,0.4)' },
};

export const IMPORTANCE_COLORS = {
  critical: '#f43f5e',
  important: '#f59e0b',
  supporting: '#64748b',
};

export function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

/** Parse 'rgba(r,g,b,a)' into [r,g,b] */
export function parseGlowRGB(glow) {
  const m = glow.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!m) return [100, 116, 139];
  return [parseInt(m[1]), parseInt(m[2]), parseInt(m[3])];
}
