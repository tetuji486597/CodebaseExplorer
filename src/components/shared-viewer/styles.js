export default function getStyles() {
  return `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

.sv-root {
  font-family: 'DM Sans', system-ui, -apple-system, sans-serif;
  background: #0a0a14;
  color: #e2e8f0;
  height: 100dvh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* Loading */
.sv-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100dvh;
  gap: 16px;
  color: #94a3b8;
}
.sv-loading-spinner {
  width: 32px;
  height: 32px;
  border: 2px solid rgba(99,102,241,0.2);
  border-top-color: #6366f1;
  border-radius: 50%;
  animation: sv-spin 0.8s linear infinite;
}
@keyframes sv-spin { to { transform: rotate(360deg); } }

/* Error */
.sv-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100dvh;
  gap: 12px;
  color: #94a3b8;
}
.sv-error-icon {
  font-family: 'JetBrains Mono', monospace;
  font-size: 48px;
  font-weight: 700;
  color: #64748b;
}
.sv-error-link {
  color: #6366f1;
  text-decoration: none;
  margin-top: 8px;
  font-size: 14px;
}
.sv-error-link:hover { text-decoration: underline; }

/* Header */
.sv-header {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 24px;
  background: #12131f;
  border-bottom: 1px solid rgba(255,255,255,0.06);
  flex-shrink: 0;
  z-index: 60;
}
.sv-header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}
.sv-logo {
  font-family: 'JetBrains Mono', monospace;
  font-weight: 700;
  font-size: 18px;
  color: #6366f1;
  background: rgba(99,102,241,0.12);
  padding: 4px 10px;
  border-radius: 6px;
  text-decoration: none;
  transition: background 150ms;
}
.sv-logo:hover {
  background: rgba(99,102,241,0.2);
}
.sv-repo-name {
  font-family: 'JetBrains Mono', monospace;
  font-size: 14px;
  color: #94a3b8;
}
.sv-query {
  flex: 1;
  font-size: 15px;
  font-weight: 500;
  color: #e2e8f0;
  text-align: center;
}
.sv-file-count {
  font-size: 13px;
  color: #64748b;
  white-space: nowrap;
}

/* Main area */
.sv-main {
  flex: 1;
  display: flex;
  position: relative;
  overflow: hidden;
}
.sv-graph-container {
  flex: 1;
  position: relative;
}
.sv-graph-container canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
  touch-action: none;
}

/* Summary bar */
.sv-summary-bar {
  padding: 10px 24px;
  background: #12131f;
  border-top: 1px solid rgba(255,255,255,0.06);
  flex-shrink: 0;
  z-index: 60;
}
.sv-summary-bar p {
  font-size: 13px;
  color: #94a3b8;
  line-height: 1.5;
  max-height: 40px;
  overflow: hidden;
}

/* Tooltip */
.sv-tooltip {
  position: fixed;
  pointer-events: none;
  z-index: 100;
  animation: sv-tooltip-in 150ms ease-out;
}
@keyframes sv-tooltip-in {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}
.sv-tooltip-inner {
  background: #1a1b2e;
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 8px;
  padding: 10px 14px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.4);
  max-width: 260px;
  backdrop-filter: blur(12px);
}
.sv-tooltip-name {
  font-size: 13px;
  font-weight: 600;
  color: #e2e8f0;
  margin-bottom: 4px;
  letter-spacing: -0.01em;
}
.sv-tooltip-summary {
  font-size: 11px;
  color: #94a3b8;
  line-height: 1.5;
}
.sv-tooltip-importance {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin-top: 6px;
}

/* Zoom controls */
.sv-zoom-controls {
  position: absolute;
  bottom: 16px;
  left: 16px;
  display: flex;
  flex-direction: column;
  gap: 1px;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid rgba(255,255,255,0.1);
  box-shadow: 0 4px 16px rgba(0,0,0,0.3);
  z-index: 10;
}
.sv-zoom-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  background: rgba(18,19,31,0.85);
  backdrop-filter: blur(8px);
  border: none;
  border-bottom: 1px solid rgba(255,255,255,0.06);
  color: #94a3b8;
  cursor: pointer;
  transition: background 150ms, color 150ms;
}
.sv-zoom-btn:last-child { border-bottom: none; }
.sv-zoom-btn:hover {
  background: rgba(26,27,46,0.95);
  color: #e2e8f0;
}

/* Floating detail card */
.sv-detail-card {
  background: #12131f;
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 12px;
  box-shadow: 0 12px 48px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04);
  max-height: calc(100dvh - 140px);
  overflow-y: auto;
  overflow-x: hidden;
}
.sv-card-close {
  position: absolute;
  top: 10px;
  right: 10px;
  background: none;
  border: none;
  color: #64748b;
  font-size: 20px;
  cursor: pointer;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  z-index: 1;
  transition: background 150ms, color 150ms;
}
.sv-card-close:hover {
  background: #1a1b2e;
  color: #e2e8f0;
}
.sv-card-body {
  padding: 20px;
}
.sv-card-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
  padding-right: 28px;
}
.sv-card-dot {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  flex-shrink: 0;
}
.sv-card-title {
  font-size: 17px;
  font-weight: 600;
  line-height: 1.3;
  color: #e2e8f0;
}
.sv-card-importance {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding: 3px 8px;
  border-radius: 4px;
  margin-bottom: 14px;
  display: inline-block;
}
.sv-card-metaphor {
  font-size: 13px;
  color: #94a3b8;
  font-style: italic;
  margin-bottom: 16px;
  line-height: 1.6;
  padding: 12px 14px;
  background: rgba(26,27,46,0.6);
  border-radius: 8px;
  border-left: 3px solid;
}
.sv-card-explanation {
  font-size: 13px;
  color: #cbd5e1;
  line-height: 1.7;
  margin-bottom: 20px;
}

/* Section label */
.sv-card-section-label {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #64748b;
  margin-bottom: 8px;
  margin-top: 4px;
}

/* Files */
.sv-card-file-list {
  display: flex;
  flex-direction: column;
  gap: 3px;
  margin-bottom: 20px;
}
.sv-card-file-item {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  color: #94a3b8;
  padding: 7px 10px;
  background: #1a1b2e;
  border-radius: 6px;
  transition: background 150ms;
  display: flex;
  align-items: center;
  gap: 6px;
}
.sv-card-file-item:hover {
  background: #232442;
  color: #e2e8f0;
}
.sv-card-file-expanded {
  background: #232442;
  border-bottom-left-radius: 0;
  border-bottom-right-radius: 0;
}
.sv-card-file-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; }
.sv-card-file-role {
  font-size: 9px;
  color: #64748b;
  background: rgba(100,116,139,0.15);
  padding: 1px 6px;
  border-radius: 3px;
  flex-shrink: 0;
}
.sv-card-file-chevron {
  font-size: 10px;
  color: #64748b;
  flex-shrink: 0;
}
.sv-card-file-details {
  background: #1e1f34;
  padding: 10px 12px;
  border-radius: 0 0 6px 6px;
  margin-bottom: 3px;
  font-size: 12px;
  color: #94a3b8;
  line-height: 1.6;
}
.sv-card-file-purpose {
  margin-bottom: 8px;
  color: #cbd5e1;
}
.sv-card-file-exports {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 8px;
}
.sv-card-export-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.sv-card-export-name {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  color: #6366f1;
}
.sv-card-export-desc {
  font-size: 11px;
  color: #94a3b8;
}
.sv-card-file-deps {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  color: #64748b;
}

/* Edges */
.sv-card-edge-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.sv-card-edge-item {
  font-size: 12px;
  color: #94a3b8;
  padding: 8px 12px;
  background: #1a1b2e;
  border-radius: 6px;
  line-height: 1.5;
  display: flex;
  align-items: baseline;
  gap: 8px;
}
.sv-card-edge-dir {
  color: #64748b;
  flex-shrink: 0;
}
.sv-card-edge-target {
  font-weight: 600;
  color: #e2e8f0;
  flex-shrink: 0;
}
.sv-card-edge-rel {
  color: #64748b;
  font-size: 11px;
}

/* Mobile bottom sheet */
.sv-mobile-sheet {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 60;
  background: #12131f;
  border-top: 1px solid rgba(255,255,255,0.08);
  border-radius: 16px 16px 0 0;
  max-height: 65dvh;
  overflow-y: auto;
  box-shadow: 0 -12px 48px rgba(0,0,0,0.5);
  animation: sv-sheet-up 300ms ease-out;
}
@keyframes sv-sheet-up {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}
.sv-mobile-sheet-inner {
  position: relative;
  padding: 8px 0 0;
}
.sv-mobile-sheet-inner::before {
  content: '';
  display: block;
  width: 36px;
  height: 4px;
  background: rgba(255,255,255,0.15);
  border-radius: 2px;
  margin: 0 auto 12px;
}

@media (max-width: 768px) {
  .sv-header {
    flex-wrap: wrap;
    padding: 10px 16px;
    gap: 8px;
  }
  .sv-query { order: 3; flex-basis: 100%; text-align: left; font-size: 14px; }
  .sv-file-count { font-size: 12px; }
  .sv-summary-bar p { font-size: 12px; }
}
`;
}
