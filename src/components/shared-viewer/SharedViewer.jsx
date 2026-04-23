import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { API_BASE } from '../../lib/api';
import useSharedGraph from './useSharedGraph';
import SharedDetailCard from './SharedDetailCard';
import SharedZoomControls from './SharedZoomControls';
import { IMPORTANCE_COLORS } from './constants';
import getStyles from './styles';

export default function SharedViewer() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/api/share/${id}`)
      .then(r => {
        if (!r.ok) throw new Error('Not found');
        return r.json();
      })
      .then(d => {
        // New projects redirect to the full ExplorerView
        if (d.redirect && d.projectId) {
          navigate(`/explore/${d.projectId}`, { replace: true });
          return;
        }
        setData(d.analysis);
        setLoading(false);
      })
      .catch(() => {
        setError('This shared analysis was not found.');
        setLoading(false);
      });
  }, [id, navigate]);

  const graph = useSharedGraph(data);

  if (loading) {
    return (
      <div className="sv-root">
        <style>{getStyles()}</style>
        <div className="sv-loading">
          <div className="sv-loading-spinner" />
          <p>Loading shared analysis...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="sv-root">
        <style>{getStyles()}</style>
        <div className="sv-error">
          <div className="sv-error-icon">404</div>
          <p>{error}</p>
          <a href="/" className="sv-error-link">Go to homepage</a>
        </div>
      </div>
    );
  }

  const selectedGraphNode = graph.selectedNode;

  return (
    <div className="sv-root">
      <style>{getStyles()}</style>

      <header className="sv-header">
        <div className="sv-header-left">
          <a href="/" className="sv-logo">gui</a>
          <span className="sv-repo-name">{data.repoName}</span>
        </div>
        <div className="sv-query">"{data.query}"</div>
        <div className="sv-file-count">
          {data.files.length} files &middot; {data.concepts.length} concepts
        </div>
      </header>

      <div className="sv-main">
        <div className="sv-graph-container" ref={graph.containerRef}>
          <canvas
            ref={graph.canvasRef}
            onMouseDown={graph.handlePointerDown}
            onMouseMove={graph.handlePointerMove}
            onMouseUp={graph.handlePointerUp}
            onMouseLeave={() => {
              graph.setTooltip(null);
            }}
            onTouchStart={graph.handlePointerDown}
            onTouchMove={graph.handlePointerMove}
            onTouchEnd={graph.handlePointerUp}
          />
        </div>

        {/* Tooltip — hide when a node is selected */}
        {graph.tooltip && !selectedGraphNode && (
          <div className="sv-tooltip" style={{ left: graph.tooltip.x + 16, top: graph.tooltip.y - 8 }}>
            <div className="sv-tooltip-inner">
              <div className="sv-tooltip-name">{graph.tooltip.name}</div>
              {graph.tooltip.oneLiner && (
                <div className="sv-tooltip-summary">{graph.tooltip.oneLiner}</div>
              )}
              {graph.tooltip.importance && (
                <div
                  className="sv-tooltip-importance"
                  style={{ color: IMPORTANCE_COLORS[graph.tooltip.importance] || '#64748b' }}
                >
                  {graph.tooltip.importance}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Zoom controls */}
        <SharedZoomControls
          onZoomIn={graph.zoomIn}
          onZoomOut={graph.zoomOut}
          onFitToView={graph.fitToView}
        />

        {/* Detail card */}
        {selectedGraphNode && (
          <SharedDetailCard
            node={selectedGraphNode}
            data={data}
            getNodeScreenPos={graph.getNodeScreenPos}
            onClose={graph.closeSelection}
          />
        )}
      </div>

      <div className="sv-summary-bar">
        <p>{data.summary}</p>
      </div>
    </div>
  );
}
