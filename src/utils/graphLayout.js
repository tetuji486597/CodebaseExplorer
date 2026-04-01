import { forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide, forceX, forceY } from 'd3-force';

const IMPORTANCE_SCALE = {
  critical: 1.0,
  important: 0.7,
  supporting: 0.45,
};

export function createConceptLayout(concepts, edges, width, height) {
  const nodes = concepts.map(c => {
    const importanceFactor = IMPORTANCE_SCALE[c.importance] || 0.5;
    const fileCount = c.fileCount || 3;
    // Scale radius: 40px min, 90px max, based on importance and file count
    const baseRadius = 40 + importanceFactor * 35 + Math.min(15, fileCount * 2);
    return {
      id: c.id,
      ...c,
      radius: Math.min(90, Math.max(40, baseRadius)),
      x: width / 2 + (Math.random() - 0.5) * 200,
      y: height / 2 + (Math.random() - 0.5) * 200,
    };
  });

  const links = edges.map(e => ({
    source: e.source,
    target: e.target,
    label: e.label,
  }));

  const simulation = forceSimulation(nodes)
    .force('link', forceLink(links).id(d => d.id).distance(220).strength(0.3))
    .force('charge', forceManyBody().strength(-800))
    .force('center', forceCenter(width / 2, height / 2))
    .force('collide', forceCollide().radius(d => d.radius + 40).strength(0.8))
    .force('x', forceX(width / 2).strength(0.04))
    .force('y', forceY(height / 2).strength(0.04))
    .stop();

  // Run simulation synchronously
  for (let i = 0; i < 300; i++) simulation.tick();

  return { nodes, links };
}

export function createFileLayout(files, concepts, fileImports, width, height) {
  // First get concept positions
  const conceptPositions = {};
  concepts.forEach(c => {
    conceptPositions[c.id] = { x: c.x || width / 2, y: c.y || height / 2 };
  });

  const nodes = files.map(f => {
    const conceptPos = conceptPositions[f.conceptId] || { x: width / 2, y: height / 2 };
    return {
      id: f.id,
      ...f,
      radius: 7 + Math.random() * 5,
      x: conceptPos.x + (Math.random() - 0.5) * 100,
      y: conceptPos.y + (Math.random() - 0.5) * 100,
    };
  });

  const links = fileImports.map(e => ({
    source: e.source,
    target: e.target,
  }));

  const simulation = forceSimulation(nodes)
    .force('link', forceLink(links).id(d => d.id).distance(60).strength(0.2))
    .force('charge', forceManyBody().strength(-100))
    .force('collide', forceCollide().radius(d => d.radius + 8).strength(0.7))
    .force('x', forceX(d => {
      const cp = conceptPositions[d.conceptId];
      return cp ? cp.x : width / 2;
    }).strength(0.3))
    .force('y', forceY(d => {
      const cp = conceptPositions[d.conceptId];
      return cp ? cp.y : height / 2;
    }).strength(0.3))
    .stop();

  for (let i = 0; i < 300; i++) simulation.tick();

  return { nodes, links };
}
