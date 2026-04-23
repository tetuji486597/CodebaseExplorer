import { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { IMPORTANCE_COLORS } from './constants.js';

const CARD_W = 360;
const CARD_GAP = 24;
const EDGE_PAD = 16;

function escapeHTML(s) {
  if (!s) return '';
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

export default function SharedDetailCard({ node, data, getNodeScreenPos, onClose }) {
  const [anchor, setAnchor] = useState({ x: 0, y: 0, side: 'right', nodeX: 0, nodeY: 0, visible: false });
  const [expandedFile, setExpandedFile] = useState(null);
  const cardRef = useRef(null);
  const rafRef = useRef(null);

  const concept = node.concept;
  const color = node.color;

  const connectedEdges = data.edges.filter(
    e => e.source === concept.id || e.target === concept.id
  );
  const fileAnalyses = data.files.filter(
    f => concept.file_ids && concept.file_ids.includes(f.path)
  );

  // Track node position on every frame
  useLayoutEffect(() => {
    let mounted = true;

    function track() {
      if (!mounted) return;
      const pos = getNodeScreenPos(node.id);
      if (!pos) { rafRef.current = requestAnimationFrame(track); return; }

      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const cardH = cardRef.current?.offsetHeight || 400;

      // Prefer right side
      let side = 'right';
      let x = pos.x + pos.radius + CARD_GAP;
      if (x + CARD_W + EDGE_PAD > vw) {
        side = 'left';
        x = pos.x - pos.radius - CARD_GAP - CARD_W;
      }
      x = Math.max(EDGE_PAD, Math.min(vw - CARD_W - EDGE_PAD, x));

      let y = pos.y - cardH / 2;
      y = Math.max(EDGE_PAD + 52, Math.min(vh - cardH - EDGE_PAD - 44, y)); // account for header/summary

      setAnchor({ x, y, side, nodeX: pos.x, nodeY: pos.y, visible: true });
      rafRef.current = requestAnimationFrame(track);
    }

    rafRef.current = requestAnimationFrame(track);
    return () => { mounted = false; cancelAnimationFrame(rafRef.current); };
  }, [node.id, getNodeScreenPos]);

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  if (isMobile) {
    return (
      <div className="sv-mobile-sheet">
        <div className="sv-mobile-sheet-inner">
          <button className="sv-card-close" onClick={onClose}>&times;</button>
          <CardContent
            concept={concept}
            color={color}
            fileAnalyses={fileAnalyses}
            connectedEdges={connectedEdges}
            data={data}
            expandedFile={expandedFile}
            setExpandedFile={setExpandedFile}
          />
        </div>
      </div>
    );
  }

  return (
    <>
      {/* SVG connector line */}
      {anchor.visible && (
        <svg
          className="sv-connector-svg"
          style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 49 }}
        >
          <line
            x1={anchor.nodeX}
            y1={anchor.nodeY}
            x2={anchor.side === 'right' ? anchor.x : anchor.x + CARD_W}
            y2={anchor.y + (cardRef.current?.offsetHeight || 200) / 2}
            stroke={color.bg + '50'}
            strokeWidth="1.5"
            strokeDasharray="4 4"
          />
          <circle
            cx={anchor.nodeX}
            cy={anchor.nodeY}
            r="4"
            fill={color.bg}
            stroke={color.bg + '60'}
            strokeWidth="2"
          />
        </svg>
      )}

      {/* Floating card */}
      <div
        ref={cardRef}
        className="sv-detail-card"
        style={{
          position: 'fixed',
          left: anchor.x,
          top: anchor.y,
          width: CARD_W,
          opacity: anchor.visible ? 1 : 0,
          transform: anchor.visible ? 'translateY(0) scale(1)' : 'translateY(8px) scale(0.97)',
          transition: 'opacity 200ms ease-out, transform 200ms ease-out',
          zIndex: 50,
        }}
      >
        <button className="sv-card-close" onClick={onClose}>&times;</button>
        <CardContent
          concept={concept}
          color={color}
          fileAnalyses={fileAnalyses}
          connectedEdges={connectedEdges}
          data={data}
          expandedFile={expandedFile}
          setExpandedFile={setExpandedFile}
        />
      </div>
    </>
  );
}

function CardContent({ concept, color, fileAnalyses, connectedEdges, data, expandedFile, setExpandedFile }) {
  const importanceColor = IMPORTANCE_COLORS[concept.importance] || IMPORTANCE_COLORS.supporting;

  return (
    <div className="sv-card-body">
      {/* Header */}
      <div className="sv-card-header">
        <div className="sv-card-dot" style={{ background: color.bg, boxShadow: `0 0 12px ${color.glow}` }} />
        <div className="sv-card-title">{concept.name}</div>
      </div>

      {/* Importance */}
      <div
        className="sv-card-importance"
        style={{ background: importanceColor + '18', color: importanceColor }}
      >
        {concept.importance}
      </div>

      {/* Metaphor */}
      {concept.metaphor && (
        <div className="sv-card-metaphor" style={{ borderColor: color.bg }}>
          {concept.metaphor}
        </div>
      )}

      {/* Explanation */}
      <div className="sv-card-explanation">{concept.explanation}</div>

      {/* Files */}
      {fileAnalyses.length > 0 && (
        <>
          <div className="sv-card-section-label">Files ({fileAnalyses.length})</div>
          <div className="sv-card-file-list">
            {fileAnalyses.map(f => (
              <div key={f.path}>
                <div
                  className={`sv-card-file-item ${expandedFile === f.path ? 'sv-card-file-expanded' : ''}`}
                  onClick={() => setExpandedFile(expandedFile === f.path ? null : f.path)}
                  style={{ cursor: 'pointer' }}
                >
                  <span className="sv-card-file-name">{f.path}</span>
                  {f.role && f.role !== 'source' && (
                    <span className="sv-card-file-role">{f.role}</span>
                  )}
                  <span className="sv-card-file-chevron">{expandedFile === f.path ? '\u25B4' : '\u25BE'}</span>
                </div>
                {expandedFile === f.path && (
                  <div className="sv-card-file-details">
                    {f.purpose && <div className="sv-card-file-purpose">{f.purpose}</div>}
                    {f.key_exports?.length > 0 && (
                      <div className="sv-card-file-exports">
                        {f.key_exports.map((exp, i) => (
                          <div key={i} className="sv-card-export-item">
                            <span className="sv-card-export-name">{typeof exp === 'string' ? exp : exp.name}</span>
                            {typeof exp === 'object' && exp.what_it_does && (
                              <span className="sv-card-export-desc">{exp.what_it_does}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    {f.depends_on?.length > 0 && (
                      <div className="sv-card-file-deps">
                        Depends on: {f.depends_on.join(', ')}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Connections */}
      {connectedEdges.length > 0 && (
        <>
          <div className="sv-card-section-label">Connections</div>
          <div className="sv-card-edge-list">
            {connectedEdges.map((e, i) => {
              const isSource = e.source === concept.id;
              const otherId = isSource ? e.target : e.source;
              const other = data.concepts.find(c => c.id === otherId);
              if (!other) return null;
              return (
                <div key={i} className="sv-card-edge-item">
                  <span className="sv-card-edge-dir">{isSource ? '\u2192' : '\u2190'}</span>
                  <span className="sv-card-edge-target">{other.name}</span>
                  <span className="sv-card-edge-rel">{e.relationship}</span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
