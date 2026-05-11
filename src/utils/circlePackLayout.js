import { hierarchy, pack } from 'd3-hierarchy';

const COLOR_MAP = {
  teal: '#14b8a6',
  purple: '#8b5cf6',
  coral: '#f43f5e',
  blue: '#6366f1',
  amber: '#f59e0b',
  pink: '#ec4899',
  green: '#10b981',
  gray: '#64748b',
};

export function resolveColor(colorName) {
  return COLOR_MAP[colorName] || COLOR_MAP.gray;
}

export function buildHierarchy(universeConcept, rootConcepts, subConceptsCache) {
  const universeNode = {
    id: universeConcept.id,
    name: universeConcept.name,
    color: universeConcept.color,
    importance: 'critical',
    one_liner: universeConcept.one_liner || universeConcept.description || '',
    hasChildren: rootConcepts.length > 0,
    _isUniverse: true,
    children: rootConcepts.map(c => buildConceptNode(c, subConceptsCache)),
  };

  return hierarchy(universeNode)
    .sum(d => d.children?.length ? 0 : Math.max(1, d.fileCount || 1))
    .sort((a, b) => (b.value || 0) - (a.value || 0));
}

function buildConceptNode(concept, subConceptsCache) {
  const cached = subConceptsCache[concept.id];
  const subConcepts = cached?.ready ? (cached.subConcepts || []) : [];
  const hasChildren = concept.hasChildren ??
    (subConcepts.length > 0 ||
    (concept.fileCount >= 2 && concept.has_further_depth !== false));

  const node = {
    id: concept.id,
    name: concept.name,
    color: concept.color,
    importance: concept.importance || 'supporting',
    one_liner: concept.one_liner || '',
    fileCount: concept.fileCount || concept.fileIds?.length || concept.file_ids?.length || 0,
    hasChildren,
    _isExpansion: concept._isExpansion || false,
    _parentId: concept._parentId,
  };

  if (subConcepts.length > 0) {
    node.children = subConcepts.map(sc => buildConceptNode(sc, subConceptsCache));
  }

  return node;
}

export function computePackLayout(hierarchyRoot, width, height) {
  const size = Math.min(width, height);
  const packLayout = pack()
    .size([size, size])
    .padding(d => {
      if (d.depth === 0) return size * 0.04;
      if (d.depth === 1) return 20;
      return 12;
    });

  packLayout(hierarchyRoot);

  const offsetX = (width - size) / 2;
  const offsetY = (height - size) / 2;

  hierarchyRoot.each(node => {
    node.x += offsetX;
    node.y += offsetY;
  });

  return hierarchyRoot;
}

export function computeZoomTarget(focusNode, viewWidth, viewHeight) {
  const diameter = focusNode.r * 2;
  const k = Math.min(viewWidth, viewHeight) / diameter * 0.9;
  return {
    x: viewWidth / 2 - focusNode.x * k,
    y: viewHeight / 2 - focusNode.y * k,
    k,
  };
}

export function findNodeById(root, id) {
  let found = null;
  root.each(node => {
    if (node.data.id === id) found = node;
  });
  return found;
}

export function getVisibleNodes(root, focusId, maxDepth = 2) {
  const focusNode = findNodeById(root, focusId);
  if (!focusNode) return [];

  const nodes = [];
  const focusDepth = focusNode.depth;

  focusNode.each(descendant => {
    const relativeDepth = descendant.depth - focusDepth;
    if (relativeDepth >= 0 && relativeDepth <= maxDepth) {
      nodes.push(descendant);
    }
  });

  return nodes;
}
