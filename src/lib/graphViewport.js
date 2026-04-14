// Module-level shared state between GraphCanvas (writer) and
// ConceptPopover (reader). GraphCanvas updates this on every draw frame,
// so the popover can continuously track the selected node's on-screen
// position as the user pans/zooms without going through React re-renders.

export const graphViewport = {
  // Canvas transform (graph-world → canvas-pixels)
  transform: { x: 0, y: 0, scale: 1 },

  // Node array with world-space { id, x, y, radius }
  nodes: [],

  // Canvas DOMRect (updated on resize)
  canvasRect: null,

  /**
   * Compute the viewport-space screen position of a node (center + effective radius).
   * Returns { x, y, radius } in page coordinates (for position:fixed elements),
   * or null if the node isn't currently laid out.
   */
  getScreenPos(nodeId) {
    if (!nodeId || !this.canvasRect) return null;
    const node = this.nodes.find(n => n.id === nodeId);
    if (!node) return null;
    const { x: tx, y: ty, scale } = this.transform;
    // World → canvas local → viewport
    const localX = tx + node.x * scale;
    const localY = ty + node.y * scale;
    return {
      x: this.canvasRect.left + localX,
      y: this.canvasRect.top + localY,
      radius: (node.radius || 36) * scale,
    };
  },
};
