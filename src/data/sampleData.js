// Warm muted concept palette — 8 tones that sit on cream/light backgrounds.
// Each color maps to the same { fill, stroke, text, accent } shape used
// by the canvas drawer. "accent" is used for edges/glows; keep it slightly
// darker than stroke so hover outlines read clearly.
export const CONCEPT_COLORS = {
  teal:   { fill: '#D6E0D3', stroke: '#6E8A6A', text: '#2E3F2C', accent: '#6E8A6A' }, // sage
  purple: { fill: '#E3D5D9', stroke: '#9A6B78', text: '#3E2228', accent: '#9A6B78' }, // dusk rose
  coral:  { fill: '#E8D6CD', stroke: '#A0614F', text: '#43251B', accent: '#A0614F' }, // clay
  blue:   { fill: '#D8DCE2', stroke: '#6B7F8C', text: '#26323A', accent: '#6B7F8C' }, // slate-blue
  amber:  { fill: '#E0DACB', stroke: '#9A8F65', text: '#40381C', accent: '#9A8F65' }, // khaki
  pink:   { fill: '#E3D5D9', stroke: '#9A6B78', text: '#3E2228', accent: '#9A6B78' }, // dusk rose
  green:  { fill: '#D3D8CD', stroke: '#7F8A6E', text: '#2E3326', accent: '#7F8A6E' }, // olive
  gray:   { fill: '#E1DCD2', stroke: '#857D6A', text: '#2F2B22', accent: '#857D6A' }, // neutral
};

export const COLOR_NAMES = Object.keys(CONCEPT_COLORS);
