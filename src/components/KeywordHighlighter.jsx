import { useMemo, useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import useStore from '../store/useStore';
import CS_GLOSSARY from '../data/csGlossary';

/**
 * Builds a merged glossary from static CS terms + dynamic concept names.
 * Concept names take priority (more project-specific definitions).
 */
function buildGlossary(concepts) {
  const glossary = new Map();

  // Static CS terms (lowercase key → { term, definition })
  for (const [term, definition] of Object.entries(CS_GLOSSARY)) {
    glossary.set(term.toLowerCase(), { term, definition });
  }

  // Dynamic: concept names → one_liner or short description
  for (const c of concepts) {
    if (!c.name || !c.one_liner) continue;
    const key = c.name.toLowerCase();
    glossary.set(key, {
      term: c.name,
      definition: c.one_liner,
    });
  }

  return glossary;
}

/**
 * Escapes special regex characters in a string.
 */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * A single highlighted keyword span with hover tooltip.
 * Tooltip is rendered via a portal to document.body so it is never
 * clipped by parent overflow: hidden / mask-image containers.
 */
function HighlightedKeyword({ word, definition, accentColor }) {
  const [hovered, setHovered] = useState(false);
  const [pos, setPos] = useState(null);
  const ref = useRef(null);

  const handleMouseEnter = useCallback(() => setHovered(true), []);
  const handleMouseLeave = useCallback(() => {
    setHovered(false);
    setPos(null);
  }, []);

  // Recompute position whenever hovered becomes true
  useEffect(() => {
    if (hovered && ref.current) {
      const rect = ref.current.getBoundingClientRect();
      setPos({
        left: Math.max(8, Math.min(rect.left, window.innerWidth - 296)),
        bottom: window.innerHeight - rect.top + 6,
      });
    }
  }, [hovered]);

  const accent = accentColor || '#6366f1';

  return (
    <>
      <span
        ref={ref}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className="keyword-highlight"
        style={{
          color: accent,
          borderBottom: `1px dashed ${accent}50`,
          cursor: 'help',
          transition: 'color 0.15s ease-out, border-color 0.15s ease-out',
          ...(hovered ? {
            color: '#e2e8f0',
            borderBottomColor: accent,
          } : {}),
        }}
      >
        {word}
      </span>
      {hovered && pos && createPortal(
        <div
          style={{
            position: 'fixed',
            zIndex: 99999,
            pointerEvents: 'none',
            maxWidth: 280,
            padding: '8px 12px',
            borderRadius: 8,
            background: '#1a1b2e',
            border: '1px solid rgba(255,255,255,0.12)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            color: '#e2e8f0',
            fontSize: 12,
            lineHeight: 1.5,
            animation: 'keyword-tooltip-in 0.15s ease-out',
            left: pos.left,
            bottom: pos.bottom,
          }}
        >
          {definition}
        </div>,
        document.body
      )}
    </>
  );
}

/**
 * KeywordHighlighter
 *
 * Renders text with technical keywords highlighted. Hovering a keyword
 * shows a brief definition tooltip.
 *
 * Props:
 * - text: string to render
 * - accentColor: optional color for highlights (defaults to indigo)
 * - className / style: passed to wrapper span
 */
export default function KeywordHighlighter({ text, accentColor, className, style }) {
  const concepts = useStore(s => s.concepts);

  const glossary = useMemo(() => buildGlossary(concepts), [concepts]);

  // Build a regex that matches any glossary term (longest first, word boundaries)
  const { regex, termMap } = useMemo(() => {
    const terms = Array.from(glossary.keys())
      .sort((a, b) => b.length - a.length); // longest first

    if (terms.length === 0) return { regex: null, termMap: glossary };

    // Build alternation with word boundaries
    const pattern = terms.map(t => `\\b${escapeRegex(t)}\\b`).join('|');
    return {
      regex: new RegExp(`(${pattern})`, 'gi'),
      termMap: glossary,
    };
  }, [glossary]);

  // Split text into segments: plain text and keyword matches
  const segments = useMemo(() => {
    if (!text || !regex) return [{ type: 'text', value: text || '' }];

    const parts = [];
    let lastIndex = 0;
    const matched = new Set(); // track which terms we've already highlighted (first occurrence only? no, all)

    let match;
    regex.lastIndex = 0;
    while ((match = regex.exec(text)) !== null) {
      // Add text before this match
      if (match.index > lastIndex) {
        parts.push({ type: 'text', value: text.slice(lastIndex, match.index) });
      }

      const matchedText = match[0];
      const entry = termMap.get(matchedText.toLowerCase());

      if (entry) {
        parts.push({
          type: 'keyword',
          value: matchedText,
          definition: entry.definition,
        });
      } else {
        parts.push({ type: 'text', value: matchedText });
      }

      lastIndex = match.index + matchedText.length;
    }

    // Add remaining text
    if (lastIndex < text.length) {
      parts.push({ type: 'text', value: text.slice(lastIndex) });
    }

    return parts;
  }, [text, regex, termMap]);

  if (!text) return null;

  return (
    <span className={className} style={style}>
      {segments.map((seg, i) =>
        seg.type === 'keyword' ? (
          <HighlightedKeyword
            key={`${i}-${seg.value}`}
            word={seg.value}
            definition={seg.definition}
            accentColor={accentColor}
          />
        ) : (
          <span key={i}>{seg.value}</span>
        )
      )}
    </span>
  );
}
