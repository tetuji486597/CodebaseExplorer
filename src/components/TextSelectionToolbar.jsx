import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router';
import { MessageSquare } from 'lucide-react';
import useStore from '../store/useStore';

const MAX_QUOTE_LENGTH = 500;
const TOOLBAR_GAP = 8;
const EDGE_PAD = 8;

function isEditableElement(el) {
  if (!el) return false;
  const tag = el.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return true;
  if (el.isContentEditable) return true;
  return false;
}

function findQuoteSource(node) {
  let el = node?.nodeType === 3 ? node.parentElement : node;
  while (el && el !== document.body) {
    const source = el.getAttribute?.('data-quote-source');
    if (source) return source;
    el = el.parentElement;
  }
  return null;
}

function getSelectionInfo() {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || !sel.rangeCount) return null;

  const text = sel.toString().trim();
  if (!text) return null;

  const anchor = sel.anchorNode?.parentElement;
  const focus = sel.focusNode?.parentElement;
  if (isEditableElement(anchor) || isEditableElement(focus)) return null;

  const anchorEl = sel.anchorNode?.nodeType === 3 ? sel.anchorNode.parentElement : sel.anchorNode;
  if (!anchorEl?.closest('.sl-inspector')) return null;

  const range = sel.getRangeAt(0);
  const rect = range.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return null;

  const source = findQuoteSource(sel.anchorNode) || findQuoteSource(sel.focusNode);

  return { text, rect, source };
}

export default function TextSelectionToolbar() {
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [hovered, setHovered] = useState(false);
  const selectedRef = useRef({ text: '', source: null });
  const debounceRef = useRef(null);
  const isTouchDevice = useRef(
    typeof window !== 'undefined' && window.matchMedia('(hover: none)').matches
  );

  const location = useLocation();
  const isExplorer = location.pathname.startsWith('/explore/');

  const projectId = useStore(s => s.projectId);
  const setPendingQuote = useStore(s => s.setPendingQuote);
  const setChatPanelOpen = useStore(s => s.setChatPanelOpen);
  const clearChat = useStore(s => s.clearChat);

  const computePosition = useCallback((rect) => {
    const toolbarW = 130;
    const toolbarH = 32;

    let x = rect.left + rect.width / 2 - toolbarW / 2;
    x = Math.max(EDGE_PAD, Math.min(x, window.innerWidth - toolbarW - EDGE_PAD));

    const above = rect.top > toolbarH + TOOLBAR_GAP + EDGE_PAD;
    const y = above
      ? rect.top - toolbarH - TOOLBAR_GAP
      : rect.bottom + TOOLBAR_GAP;

    return { x, y };
  }, []);

  const handleSelection = useCallback(() => {
    const info = getSelectionInfo();
    if (!info) {
      setVisible(false);
      return;
    }

    const text = info.text.length > MAX_QUOTE_LENGTH
      ? info.text.slice(0, MAX_QUOTE_LENGTH) + '...'
      : info.text;

    selectedRef.current = { text, source: info.source };
    setPos(computePosition(info.rect));
    setVisible(true);
  }, [computePosition]);

  const handleSelectionDebounced = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const delay = isTouchDevice.current ? 300 : 10;
    debounceRef.current = setTimeout(handleSelection, delay);
  }, [handleSelection]);

  const handleQuote = useCallback(() => {
    const { text, source } = selectedRef.current;
    if (!text) return;

    clearChat();
    setPendingQuote({ text, source });
    setChatPanelOpen(true);
    setVisible(false);

    window.getSelection()?.removeAllRanges();
  }, [clearChat, setPendingQuote, setChatPanelOpen]);

  useEffect(() => {
    if (!projectId || !isExplorer) {
      setVisible(false);
      return;
    }

    const onMouseUp = () => handleSelectionDebounced();
    const onSelectionChange = () => handleSelectionDebounced();
    const onScroll = () => setVisible(false);
    const onKeyDown = (e) => { if (e.key === 'Escape') setVisible(false); };

    document.addEventListener('mouseup', onMouseUp);
    document.addEventListener('selectionchange', onSelectionChange);
    window.addEventListener('scroll', onScroll, { capture: true, passive: true });
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('mouseup', onMouseUp);
      document.removeEventListener('selectionchange', onSelectionChange);
      window.removeEventListener('scroll', onScroll, { capture: true });
      document.removeEventListener('keydown', onKeyDown);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [projectId, isExplorer, handleSelectionDebounced]);

  if (!visible || !projectId || !isExplorer) return null;

  return createPortal(
    <div
      onMouseDown={(e) => e.preventDefault()}
      onClick={handleQuote}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'fixed',
        left: pos.x,
        top: pos.y,
        zIndex: 100000,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: isTouchDevice.current ? '8px 14px' : '6px 12px',
        borderRadius: 999,
        background: hovered ? 'var(--color-accent, #6366f1)' : 'var(--color-bg-elevated, #1a1b2e)',
        border: '1px solid var(--color-border-visible, rgba(255,255,255,0.12))',
        boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
        color: hovered ? '#fff' : 'var(--color-text-primary, #e2e8f0)',
        fontSize: isTouchDevice.current ? 13 : 12,
        fontWeight: 500,
        cursor: 'pointer',
        userSelect: 'none',
        transition: 'background 150ms ease-out, color 150ms ease-out',
        animation: 'selection-toolbar-in 150ms ease-out',
        whiteSpace: 'nowrap',
      }}
    >
      <MessageSquare size={13} strokeWidth={1.75} />
      <span>Ask in chat</span>
    </div>,
    document.body
  );
}
