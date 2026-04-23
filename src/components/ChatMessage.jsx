import { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import useStore from '../store/useStore';
import { FileCode2, Box, Route, ExternalLink, GitBranch } from 'lucide-react';
import CS_GLOSSARY from '../data/csGlossary';

// ─── Glossary tooltip (reuses KeywordHighlighter pattern) ────────────────────

function GlossaryTerm({ word, definition }) {
  const [hovered, setHovered] = useState(false);
  const [pos, setPos] = useState(null);
  const ref = useRef(null);

  useEffect(() => {
    if (hovered && ref.current) {
      const rect = ref.current.getBoundingClientRect();
      setPos({
        left: Math.max(8, Math.min(rect.left, window.innerWidth - 296)),
        bottom: window.innerHeight - rect.top + 6,
      });
    }
  }, [hovered]);

  return (
    <>
      <span
        ref={ref}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => { setHovered(false); setPos(null); }}
        style={{
          borderBottom: '1px dashed var(--color-text-tertiary)',
          cursor: 'help',
          transition: 'all 150ms ease-out',
          ...(hovered ? { color: 'var(--color-accent-active)', borderBottomColor: 'var(--color-accent)' } : {}),
        }}
      >
        {word}
      </span>
      {hovered && pos && createPortal(
        <div style={{
          position: 'fixed',
          zIndex: 99999,
          pointerEvents: 'none',
          maxWidth: 280,
          padding: '8px 12px',
          borderRadius: 8,
          background: 'var(--color-bg-elevated)',
          border: '1px solid var(--color-border-visible)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          color: 'var(--color-text-primary)',
          fontSize: 12,
          lineHeight: 1.5,
          animation: 'chat-msg-in 150ms ease-out',
          left: pos.left,
          bottom: pos.bottom,
        }}>
          {definition}
        </div>,
        document.body
      )}
    </>
  );
}

// ─── Build glossary map ──────────────────────────────────────────────────────

function buildGlossary(concepts) {
  const glossary = new Map();
  for (const [term, definition] of Object.entries(CS_GLOSSARY)) {
    glossary.set(term.toLowerCase(), { term, definition });
  }
  for (const c of concepts) {
    if (!c.name || !c.one_liner) continue;
    glossary.set(c.name.toLowerCase(), { term: c.name, definition: c.one_liner });
  }
  return glossary;
}

// ─── Auto-detect patterns ────────────────────────────────────────────────────

function buildConceptRegex(concepts) {
  if (!concepts.length) return null;
  const names = concepts
    .filter(c => c.name && c.name.length > 2)
    .map(c => c.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .sort((a, b) => b.length - a.length);
  if (!names.length) return null;
  return new RegExp(`\\b(${names.join('|')})\\b`, 'gi');
}

// Matches API routes like POST /api/chat, GET /api/pipeline/:id/data
const API_ROUTE_REGEX = /\b(GET|POST|PUT|DELETE|PATCH)\s+(\/[\w/:.-]+)/g;

// Matches file paths like server/routes/chat.ts, src/components/ChatBar.jsx
const FILE_PATH_REGEX = /\b((?:[\w.-]+\/)+[\w.-]+\.(?:ts|tsx|js|jsx|py|go|rs|css|html|json|md|yaml|yml|toml|sql|sh))\b/g;

// ─── Markdown parser ─────────────────────────────────────────────────────────

// Placeholder values that the LLM might use instead of real IDs
const PLACEHOLDER_IDS = new Set([
  'x', 'y', 'z', 'example', 'concept_key', 'path', 'file_path',
  'name', 'key', 'id', 'concept_name', 'filename', 'your_concept',
]);

function parseMarkdown(content, concepts, glossary, conceptRegex, onConceptClick, onFileClick, onRouteClick) {
  // Step 1: Extract [[concept:x]] and [[file:x]] references
  // Validate that they reference real entities, not placeholders
  const refs = [];
  const withPlaceholders = content.replace(/\[\[(concept|file):([^\]]+)\]\]/g, (match, type, id) => {
    const trimId = id.trim();
    // Skip placeholder values — render them as plain text
    if (PLACEHOLDER_IDS.has(trimId.toLowerCase())) {
      return `\`${type}:${trimId}\``;
    }
    // For concepts, verify it's a real concept key
    if (type === 'concept' && !concepts.find(c => c.id === trimId)) {
      // Not a real concept — render as inline code instead of a broken chip
      return `\`${trimId}\``;
    }
    const idx = refs.length;
    refs.push({ type, id: trimId });
    return `\x00REF_${idx}\x00`;
  });

  // Step 2: Split by fenced code blocks
  const codeBlockRegex = /```(\w*)\n?([\s\S]*?)```/g;
  const segments = [];
  let lastIndex = 0;
  let match;

  while ((match = codeBlockRegex.exec(withPlaceholders)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: 'text', content: withPlaceholders.slice(lastIndex, match.index) });
    }
    segments.push({ type: 'code', lang: match[1], content: match[2].replace(/\n$/, '') });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < withPlaceholders.length) {
    segments.push({ type: 'text', content: withPlaceholders.slice(lastIndex) });
  }

  const ctx = { refs, concepts, glossary, conceptRegex, onConceptClick, onFileClick, onRouteClick };

  return segments.map((seg, si) => {
    if (seg.type === 'code') {
      return (
        <pre key={si} style={{
          padding: '12px 14px',
          borderRadius: 'var(--radius-sm)',
          background: 'var(--color-bg-sunken)',
          border: '1px solid var(--color-border-subtle)',
          fontSize: 12,
          lineHeight: 1.5,
          overflowX: 'auto',
          margin: '8px 0',
          fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
        }}>
          <code>{seg.content}</code>
        </pre>
      );
    }

    const lines = seg.content.split('\n');
    const elements = [];
    let listItems = [];
    let listType = null;
    let tableRows = [];

    const flushList = () => {
      if (!listItems.length) return;
      const Tag = listType === 'ol' ? 'ol' : 'ul';
      elements.push(
        <Tag key={`list-${elements.length}`} style={{ margin: '6px 0', paddingLeft: 20, fontSize: 13, lineHeight: 1.6 }}>
          {listItems.map((li, i) => <li key={i}>{renderInline(li, ctx)}</li>)}
        </Tag>
      );
      listItems = [];
      listType = null;
    };

    const flushTable = () => {
      if (tableRows.length < 2) {
        // Not a real table, render as plain text
        for (const row of tableRows) {
          elements.push(
            <span key={`tr-${elements.length}`} style={{ display: 'block', marginBottom: 2 }}>
              {renderInline(row, ctx)}
            </span>
          );
        }
        tableRows = [];
        return;
      }

      // Parse cells from each row
      const parsedRows = tableRows.map(row =>
        row.split('|').map(cell => cell.trim()).filter((_, idx, arr) => idx > 0 && idx < arr.length)
      );

      // Detect separator row (|---|---|)
      let headerEndIdx = -1;
      for (let r = 0; r < parsedRows.length; r++) {
        if (parsedRows[r].every(cell => /^[-:]+$/.test(cell))) {
          headerEndIdx = r;
          break;
        }
      }

      const headerRows = headerEndIdx > 0 ? parsedRows.slice(0, headerEndIdx) : [];
      const bodyRows = headerEndIdx >= 0 ? parsedRows.slice(headerEndIdx + 1) : parsedRows;

      elements.push(
        <div key={`table-${elements.length}`} style={{
          margin: '8px 0',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--color-border-subtle)',
          overflow: 'hidden',
          fontSize: 12,
        }}>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            tableLayout: 'auto',
          }}>
            {headerRows.length > 0 && (
              <thead>
                {headerRows.map((row, ri) => (
                  <tr key={ri}>
                    {row.map((cell, ci) => (
                      <th key={ci} style={{
                        padding: '8px 12px',
                        textAlign: 'left',
                        fontWeight: 600,
                        fontSize: 11,
                        textTransform: 'uppercase',
                        letterSpacing: '0.03em',
                        color: 'var(--color-text-secondary)',
                        background: 'var(--color-bg-sunken)',
                        borderBottom: '1px solid var(--color-border-subtle)',
                        whiteSpace: 'nowrap',
                      }}>
                        {renderInline(cell, ctx)}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
            )}
            <tbody>
              {bodyRows.map((row, ri) => (
                <tr key={ri}>
                  {row.map((cell, ci) => (
                    <td key={ci} style={{
                      padding: '7px 12px',
                      borderBottom: ri < bodyRows.length - 1 ? '1px solid var(--color-border-subtle)' : 'none',
                      color: 'var(--color-text-primary)',
                      lineHeight: 1.5,
                      verticalAlign: 'top',
                    }}>
                      {renderInline(cell, ctx)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      tableRows = [];
    };

    // Helper: is this a table row?
    const isTableRow = (line) => {
      const t = line.trim();
      return t.startsWith('|') && t.endsWith('|') && t.includes('|');
    };

    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trimStart();

      // Table rows: accumulate consecutive pipe-delimited lines
      if (isTableRow(trimmed)) {
        flushList();
        tableRows.push(trimmed);
        continue;
      } else if (tableRows.length > 0) {
        flushTable();
      }

      // Headings
      if (trimmed.startsWith('#### ')) {
        flushList();
        elements.push(
          <div key={`h4-${i}`} style={{ fontSize: 13, fontWeight: 600, marginTop: 8, marginBottom: 2, color: 'var(--color-text-primary)' }}>
            {renderInline(trimmed.slice(5), ctx)}
          </div>
        );
        continue;
      }
      if (trimmed.startsWith('### ')) {
        flushList();
        elements.push(
          <div key={`h3-${i}`} style={{ fontSize: 13, fontWeight: 600, marginTop: 10, marginBottom: 2, color: 'var(--color-text-primary)' }}>
            {renderInline(trimmed.slice(4), ctx)}
          </div>
        );
        continue;
      }
      if (trimmed.startsWith('## ')) {
        flushList();
        elements.push(
          <div key={`h2-${i}`} style={{ fontSize: 14, fontWeight: 600, marginTop: 12, marginBottom: 3, color: 'var(--color-text-primary)' }}>
            {renderInline(trimmed.slice(3), ctx)}
          </div>
        );
        continue;
      }

      // Horizontal rule
      if (/^[-*_]{3,}\s*$/.test(trimmed)) {
        flushList();
        elements.push(
          <hr key={`hr-${i}`} style={{
            border: 'none',
            borderTop: '1px solid var(--color-border-subtle)',
            margin: '10px 0',
          }} />
        );
        continue;
      }

      // Blockquote
      if (trimmed.startsWith('> ')) {
        flushList();
        elements.push(
          <div key={`bq-${i}`} style={{
            borderLeft: '3px solid var(--color-accent)',
            paddingLeft: 12,
            margin: '6px 0',
            color: 'var(--color-text-secondary)',
            fontStyle: 'italic',
          }}>
            {renderInline(trimmed.slice(2), ctx)}
          </div>
        );
        continue;
      }

      // Unordered list
      if (/^[-*] /.test(trimmed)) {
        if (listType === 'ol') flushList();
        listType = 'ul';
        listItems.push(trimmed.slice(2));
        continue;
      }
      // Ordered list
      if (/^\d+\.\s/.test(trimmed)) {
        if (listType === 'ul') flushList();
        listType = 'ol';
        listItems.push(trimmed.replace(/^\d+\.\s/, ''));
        continue;
      }

      flushList();

      // Empty line
      if (!trimmed) {
        elements.push(<div key={`br-${i}`} style={{ height: 6 }} />);
        continue;
      }

      // Normal paragraph
      elements.push(
        <span key={`p-${i}`} style={{ display: 'block', marginBottom: 2 }}>
          {renderInline(trimmed, ctx)}
        </span>
      );
    }

    // Flush any remaining accumulators
    flushTable();
    flushList();
    return <span key={si}>{elements}</span>;
  });
}

// ─── Inline renderer with auto-detection ─────────────────────────────────────

function renderInline(text, ctx) {
  const { refs, concepts, glossary, conceptRegex, onConceptClick, onFileClick, onRouteClick } = ctx;

  // First pass: split on markdown formatting + explicit ref placeholders
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\x00REF_\d+\x00)/g);

  return parts.map((part, i) => {
    // Explicit reference placeholder
    const refMatch = part.match(/\x00REF_(\d+)\x00/);
    if (refMatch) {
      const ref = refs[parseInt(refMatch[1])];
      if (ref.type === 'concept') return <ConceptChip key={i} id={ref.id} concepts={concepts} onClick={onConceptClick} />;
      if (ref.type === 'file') return <FileChip key={i} path={ref.id} onClick={onFileClick} />;
    }

    // Bold
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} style={{ fontWeight: 600 }}>{enrichPlainText(part.slice(2, -2), ctx, `b${i}`)}</strong>;
    }
    // Italic
    if (part.startsWith('*') && part.endsWith('*') && !part.startsWith('**')) {
      return <em key={i}>{enrichPlainText(part.slice(1, -1), ctx, `i${i}`)}</em>;
    }
    // Inline code
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={i} style={{
          padding: '1px 6px',
          borderRadius: 4,
          fontSize: '0.9em',
          background: 'var(--color-bg-sunken)',
          border: '1px solid var(--color-border-subtle)',
          fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
        }}>
          {part.slice(1, -1)}
        </code>
      );
    }

    // Plain text: enrich with auto-detected patterns
    return <span key={i}>{enrichPlainText(part, ctx, `t${i}`)}</span>;
  });
}

/**
 * Enrich plain text with auto-detected API routes, file paths, concept names, and glossary terms.
 * Returns an array of React elements.
 */
function enrichPlainText(text, ctx, keyPrefix) {
  if (!text) return text;
  const { concepts, glossary, conceptRegex, onConceptClick, onFileClick, onRouteClick } = ctx;

  // Build a unified pattern that captures all detectable elements
  const patterns = [];

  // API routes: POST /api/chat
  patterns.push({ regex: API_ROUTE_REGEX, type: 'route' });
  // File paths: server/routes/chat.ts
  patterns.push({ regex: FILE_PATH_REGEX, type: 'file' });
  // Concept names
  if (conceptRegex) patterns.push({ regex: conceptRegex, type: 'concept' });

  // Collect all matches with positions
  const matches = [];
  for (const { regex, type } of patterns) {
    const re = new RegExp(regex.source, regex.flags);
    let m;
    while ((m = re.exec(text)) !== null) {
      matches.push({ start: m.index, end: m.index + m[0].length, text: m[0], type, groups: m });
    }
  }

  // Sort by position, remove overlaps
  matches.sort((a, b) => a.start - b.start);
  const filtered = [];
  let lastEnd = 0;
  for (const m of matches) {
    if (m.start >= lastEnd) {
      filtered.push(m);
      lastEnd = m.end;
    }
  }

  if (filtered.length === 0) {
    // No auto-detected patterns — apply glossary highlighting
    return applyGlossary(text, glossary, `${keyPrefix}-g`);
  }

  const result = [];
  let pos = 0;
  for (let i = 0; i < filtered.length; i++) {
    const m = filtered[i];
    // Text before this match — apply glossary
    if (m.start > pos) {
      result.push(...applyGlossary(text.slice(pos, m.start), glossary, `${keyPrefix}-pre${i}`));
    }

    if (m.type === 'route') {
      const method = m.groups[1];
      const path = m.groups[2];
      result.push(<RouteChip key={`${keyPrefix}-r${i}`} method={method} path={path} onClick={onRouteClick} />);
    } else if (m.type === 'file') {
      result.push(<FileChip key={`${keyPrefix}-f${i}`} path={m.text} onClick={onFileClick} inline />);
    } else if (m.type === 'concept') {
      const concept = concepts.find(c => c.name.toLowerCase() === m.text.toLowerCase());
      if (concept) {
        result.push(<ConceptChip key={`${keyPrefix}-c${i}`} id={concept.id} concepts={concepts} onClick={onConceptClick} label={m.text} inline />);
      } else {
        result.push(<span key={`${keyPrefix}-ct${i}`}>{m.text}</span>);
      }
    }

    pos = m.end;
  }

  // Remaining text
  if (pos < text.length) {
    result.push(...applyGlossary(text.slice(pos), glossary, `${keyPrefix}-end`));
  }

  return result;
}

/**
 * Apply glossary term highlighting to a plain text string.
 * Returns array of React elements with GlossaryTerm components for matched terms.
 */
function applyGlossary(text, glossary, keyPrefix) {
  if (!text || !glossary || glossary.size === 0) return [text];

  // Build regex from glossary keys (longest first)
  const terms = Array.from(glossary.keys()).sort((a, b) => b.length - a.length);
  // Only match terms 4+ chars to avoid too much noise
  const filtered = terms.filter(t => t.length >= 4);
  if (!filtered.length) return [text];

  const pattern = filtered.map(t => `\\b${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).join('|');
  const regex = new RegExp(`(${pattern})`, 'gi');

  const parts = text.split(regex);
  return parts.map((part, i) => {
    const entry = glossary.get(part.toLowerCase());
    if (entry) {
      return <GlossaryTerm key={`${keyPrefix}-${i}`} word={part} definition={entry.definition} />;
    }
    return <span key={`${keyPrefix}-${i}`}>{part}</span>;
  });
}

// ─── Chip components ─────────────────────────────────────────────────────────

function ConceptChip({ id, concepts, onClick, label, inline }) {
  const concept = concepts.find(c => c.id === id);
  const displayName = label || concept?.name || id;

  return (
    <button
      onClick={() => onClick(id)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: inline ? '1px 8px' : '2px 10px',
        borderRadius: 10,
        fontSize: 12,
        fontWeight: 550,
        background: 'var(--color-accent-soft)',
        color: 'var(--color-accent-active)',
        border: '1px solid var(--color-accent-soft)',
        cursor: 'pointer',
        transition: 'all 150ms ease-out',
        verticalAlign: 'baseline',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = 'var(--color-accent)';
        e.currentTarget.style.color = 'var(--color-text-inverse)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = 'var(--color-accent-soft)';
        e.currentTarget.style.color = 'var(--color-accent-active)';
      }}
    >
      <Box size={11} strokeWidth={2} />
      {displayName}
    </button>
  );
}

function FileChip({ path, onClick, inline }) {
  const filename = path.split('/').pop();

  return (
    <button
      onClick={() => onClick(path)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: inline ? '1px 8px' : '2px 10px',
        borderRadius: 10,
        fontSize: 12,
        fontWeight: 500,
        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
        background: 'var(--color-bg-sunken)',
        color: 'var(--color-text-secondary)',
        border: '1px solid var(--color-border-subtle)',
        cursor: 'pointer',
        transition: 'all 150ms ease-out',
        verticalAlign: 'baseline',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = 'var(--color-accent)';
        e.currentTarget.style.color = 'var(--color-accent-active)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = 'var(--color-border-subtle)';
        e.currentTarget.style.color = 'var(--color-text-secondary)';
      }}
    >
      <FileCode2 size={11} strokeWidth={2} />
      {filename}
    </button>
  );
}

function RouteChip({ method, path, onClick }) {
  const methodColors = {
    GET: '#10b981',
    POST: '#6366f1',
    PUT: '#f59e0b',
    DELETE: '#f43f5e',
    PATCH: '#8b5cf6',
  };
  const color = methodColors[method] || 'var(--color-accent)';

  return (
    <button
      onClick={() => onClick(method, path)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '2px 10px',
        borderRadius: 10,
        fontSize: 12,
        fontWeight: 500,
        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
        background: `${color}15`,
        color: color,
        border: `1px solid ${color}30`,
        cursor: 'pointer',
        transition: 'all 150ms ease-out',
        verticalAlign: 'baseline',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = `${color}25`;
        e.currentTarget.style.borderColor = `${color}50`;
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = `${color}15`;
        e.currentTarget.style.borderColor = `${color}30`;
      }}
    >
      <Route size={11} strokeWidth={2} />
      <span style={{ fontWeight: 600 }}>{method}</span>
      {path}
    </button>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function ChatMessage({ message, isStreaming }) {
  const concepts = useStore(s => s.concepts);
  const files = useStore(s => s.files);

  const glossary = useMemo(() => buildGlossary(concepts), [concepts]);
  const conceptRegex = useMemo(() => buildConceptRegex(concepts), [concepts]);

  const handleConceptClick = useCallback((key) => {
    const store = useStore.getState();
    if (store.viewMode !== 'concepts') store.setViewMode('concepts');
    store.setSelectedNode({ type: 'concept', id: key });
    store.setShowInspector(true);
    if (window.innerWidth < 768) store.setChatPanelOpen(false);
  }, []);

  const handleFileClick = useCallback((path) => {
    const store = useStore.getState();
    // Try to find the file in the store
    const file = store.files.find(f => f.id === path || f.id.endsWith(path) || path.endsWith(f.id));
    if (file) {
      if (store.viewMode !== 'files') store.setViewMode('files');
      store.setSelectedNode({ type: 'file', id: file.id });
      store.setShowInspector(true);
    } else {
      // File not in graph — try to find the concept it might belong to
      const matchingFile = store.files.find(f => f.id.includes(path.split('/').pop().replace(/\.\w+$/, '')));
      if (matchingFile) {
        if (store.viewMode !== 'files') store.setViewMode('files');
        store.setSelectedNode({ type: 'file', id: matchingFile.id });
        store.setShowInspector(true);
      }
    }
    if (window.innerWidth < 768) store.setChatPanelOpen(false);
  }, []);

  const handleRouteClick = useCallback((method, path) => {
    // Try to find a file that handles this route
    const store = useStore.getState();
    const routeSegment = path.split('/').filter(Boolean).find(s => !s.startsWith(':') && s !== 'api');
    if (routeSegment) {
      // Look for a file matching the route name (e.g., /api/chat → chat.ts)
      const matchingFile = store.files.find(f =>
        f.id.toLowerCase().includes(routeSegment.toLowerCase()) &&
        (f.id.includes('route') || f.id.includes('server'))
      );
      if (matchingFile) {
        if (store.viewMode !== 'files') store.setViewMode('files');
        store.setSelectedNode({ type: 'file', id: matchingFile.id });
        store.setShowInspector(true);
        if (window.innerWidth < 768) store.setChatPanelOpen(false);
        return;
      }

      // Try matching a concept
      const matchingConcept = store.concepts.find(c =>
        c.name.toLowerCase().includes(routeSegment.toLowerCase()) ||
        c.id.toLowerCase().includes(routeSegment.toLowerCase())
      );
      if (matchingConcept) {
        if (store.viewMode !== 'concepts') store.setViewMode('concepts');
        store.setSelectedNode({ type: 'concept', id: matchingConcept.id });
        store.setShowInspector(true);
        if (window.innerWidth < 768) store.setChatPanelOpen(false);
      }
    }
  }, []);

  const isUser = message.role === 'user';

  return (
    <div
      data-quote-source={isUser ? undefined : "Chat response"}
      style={{
        padding: isUser ? '10px 14px' : '12px 14px',
        borderRadius: 'var(--radius-md)',
        background: isUser ? 'var(--color-accent-soft)' : 'transparent',
        color: isUser ? 'var(--color-accent-active)' : 'var(--color-text-primary)',
        fontSize: 13,
        lineHeight: 1.6,
        animation: 'chat-msg-in 200ms ease-out both',
        borderLeft: isUser ? 'none' : '2px solid var(--color-border-subtle)',
        paddingLeft: isUser ? 14 : 16,
      }}
    >
      {message.source && (
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 3,
          fontSize: 9,
          fontWeight: 600,
          padding: '1px 5px',
          borderRadius: 3,
          marginBottom: 4,
          background: message.source === 'cli' ? 'rgba(245, 158, 11, 0.12)' : 'rgba(99, 102, 241, 0.12)',
          color: message.source === 'cli' ? '#f59e0b' : '#818cf8',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          float: 'right',
          marginLeft: 8,
        }}>
          {message.source === 'cli' ? 'CLI' : 'WEB'}
        </span>
      )}
      {isUser ? (
        message.content
      ) : (
        <>
          {parseMarkdown(message.content, concepts, glossary, conceptRegex, handleConceptClick, handleFileClick, handleRouteClick)}
          {isStreaming && (
            <span style={{
              display: 'inline-block',
              width: 6,
              height: 14,
              marginLeft: 2,
              borderRadius: 2,
              background: 'var(--color-accent)',
              animation: 'processing-dot 1s infinite',
              verticalAlign: 'text-bottom',
            }} />
          )}
          {message.graphOps && message.graphOps.operations?.length > 0 && (
            <div
              style={{
                marginTop: 8,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 10px',
                borderRadius: 'var(--radius-full)',
                background: 'var(--color-accent-soft)',
                border: '1px solid var(--color-border-subtle)',
                fontSize: 11,
                color: 'var(--color-accent-active)',
                cursor: 'pointer',
                transition: 'background 150ms ease-out',
              }}
              onClick={() => {
                const store = useStore.getState();
                store.applyGraphOperations(message.graphOps);
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--color-accent-hover)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'var(--color-accent-soft)';
              }}
            >
              <GitBranch size={12} strokeWidth={1.5} />
              Graph updated
            </div>
          )}
        </>
      )}
    </div>
  );
}
