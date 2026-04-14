import { useState, useRef, useEffect, useCallback } from 'react';
import useStore from '../store/useStore';
import useChatStream from '../hooks/useChatStream';
import ChatMessage from './ChatMessage';
import SuggestedQuestions from './SuggestedQuestions';
import { X, Send, MessageSquare, Trash2, GripVertical } from 'lucide-react';

const MIN_WIDTH = 320;
const MAX_WIDTH = 720;
const DEFAULT_WIDTH = 400;

export default function ChatPanel() {
  const [input, setInput] = useState('');
  const [panelWidth, setPanelWidth] = useState(() => {
    try {
      const saved = parseInt(localStorage.getItem('cbe_chat_width'), 10);
      if (saved >= MIN_WIDTH && saved <= MAX_WIDTH) return saved;
    } catch {}
    return DEFAULT_WIDTH;
  });
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const panelRef = useRef(null);
  const resizingRef = useRef(false);

  const chatMessages = useStore(s => s.chatMessages);
  const chatLoading = useStore(s => s.chatLoading);
  const chatPanelOpen = useStore(s => s.chatPanelOpen);
  const setChatPanelOpen = useStore(s => s.setChatPanelOpen);
  const clearChat = useStore(s => s.clearChat);
  const streamingText = useStore(s => s.chatStreamingText);

  const { sendMessage } = useChatStream();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, streamingText]);

  // Focus input when panel opens
  useEffect(() => {
    if (chatPanelOpen) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [chatPanelOpen]);

  // Resize handler
  const handleResizeStart = useCallback((e) => {
    if (window.innerWidth < 768) return; // No resize on mobile
    e.preventDefault();
    resizingRef.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const onMove = (ev) => {
      if (!resizingRef.current) return;
      const newWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, window.innerWidth - ev.clientX));
      setPanelWidth(newWidth);
    };

    const onUp = () => {
      resizingRef.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      // Persist width
      try { localStorage.setItem('cbe_chat_width', String(panelRef.current?.offsetWidth || DEFAULT_WIDTH)); } catch {}
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }, []);

  // Mobile: drag to dismiss
  const touchStartY = useRef(null);
  const handleTouchStart = (e) => {
    if (window.innerWidth >= 768) return;
    touchStartY.current = e.touches[0].clientY;
  };
  const handleTouchEnd = (e) => {
    if (window.innerWidth >= 768 || touchStartY.current === null) return;
    const delta = e.changedTouches[0].clientY - touchStartY.current;
    if (delta > 100) setChatPanelOpen(false);
    touchStartY.current = null;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!input.trim() || chatLoading) return;
    sendMessage(input.trim());
    setInput('');
  };

  const handleSuggestion = (question) => {
    sendMessage(question);
  };

  const hasMessages = chatMessages.length > 0 || streamingText;

  // Extract last assistant message for follow-up context
  const lastAssistantMsg = chatMessages.filter(m => m.role === 'assistant').at(-1)?.content || '';

  return (
    <>
      {/* Backdrop — mobile only */}
      {chatPanelOpen && (
        <div
          className="chat-panel-backdrop"
          onClick={() => setChatPanelOpen(false)}
        />
      )}

      <div
        ref={panelRef}
        className={`chat-panel ${chatPanelOpen ? 'chat-panel--open' : ''}`}
        style={{ width: window.innerWidth >= 768 ? panelWidth : undefined }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Resize handle — desktop only */}
        <div
          className="chat-panel-resize-handle"
          onPointerDown={handleResizeStart}
        >
          <div className="chat-panel-resize-grip">
            <GripVertical size={12} strokeWidth={1.5} />
          </div>
        </div>

        {/* Drag handle — mobile */}
        <div className="chat-panel-drag-handle">
          <div style={{
            width: 36,
            height: 4,
            borderRadius: 2,
            background: 'var(--color-border-visible)',
          }} />
        </div>

        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 18px',
          borderBottom: '1px solid var(--color-border-subtle)',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <MessageSquare size={14} strokeWidth={1.75} style={{ color: 'var(--color-accent)' }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)', letterSpacing: '-0.01em' }}>
              Ask anything
            </span>
            {chatMessages.length > 0 && (
              <span style={{
                fontSize: 11,
                color: 'var(--color-text-tertiary)',
                background: 'var(--color-bg-sunken)',
                padding: '2px 7px',
                borderRadius: 10,
              }}>
                {chatMessages.length}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {chatMessages.length > 0 && (
              <button
                onClick={clearChat}
                aria-label="Clear chat"
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 'var(--radius-sm)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--color-text-tertiary)',
                  cursor: 'pointer',
                  transition: 'all 150ms ease-out',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'var(--color-bg-sunken)';
                  e.currentTarget.style.color = 'var(--color-text-secondary)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = 'var(--color-text-tertiary)';
                }}
              >
                <Trash2 size={13} strokeWidth={1.75} />
              </button>
            )}
            <button
              onClick={() => setChatPanelOpen(false)}
              aria-label="Close chat"
              style={{
                width: 30,
                height: 30,
                borderRadius: 'var(--radius-sm)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'transparent',
                border: 'none',
                color: 'var(--color-text-tertiary)',
                cursor: 'pointer',
                transition: 'all 150ms ease-out',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'var(--color-bg-sunken)';
                e.currentTarget.style.color = 'var(--color-text-secondary)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = 'var(--color-text-tertiary)';
              }}
            >
              <X size={14} strokeWidth={1.75} />
            </button>
          </div>
        </div>

        {/* Messages area */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px 18px',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          minHeight: 0,
        }}>
          {!hasMessages && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 20 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  background: 'var(--color-accent-soft)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 12px',
                }}>
                  <MessageSquare size={18} strokeWidth={1.5} style={{ color: 'var(--color-accent)' }} />
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 4 }}>
                  Explore this codebase
                </div>
                <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)', lineHeight: 1.5, maxWidth: 280, margin: '0 auto' }}>
                  Ask about architecture, data flows, file responsibilities, or how any feature works.
                </div>
              </div>
              <SuggestedQuestions onSelect={handleSuggestion} />
            </div>
          )}

          {chatMessages.map((msg, i) => (
            <ChatMessage key={i} message={msg} />
          ))}

          {streamingText && (
            <ChatMessage
              message={{ role: 'assistant', content: streamingText }}
              isStreaming
            />
          )}

          {chatLoading && !streamingText && (
            <div style={{ display: 'flex', gap: 6, padding: '8px 14px' }}>
              <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--color-accent)', animation: 'processing-dot 1.4s infinite' }} />
              <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--color-accent)', animation: 'processing-dot 1.4s infinite 0.2s' }} />
              <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--color-accent)', animation: 'processing-dot 1.4s infinite 0.4s' }} />
            </div>
          )}

          {hasMessages && !chatLoading && (
            <div style={{ marginTop: 4 }}>
              <SuggestedQuestions onSelect={handleSuggestion} compact followUp lastResponse={lastAssistantMsg} />
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input bar */}
        <form
          onSubmit={handleSubmit}
          style={{
            padding: '12px 16px',
            paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))',
            borderTop: '1px solid var(--color-border-subtle)',
            flexShrink: 0,
          }}
        >
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '10px 14px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--color-bg-elevated)',
            border: '1px solid var(--color-border-visible)',
            transition: 'border-color 150ms ease-out',
          }}>
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Ask about this codebase..."
              style={{
                flex: 1,
                background: 'transparent',
                fontSize: 13,
                outline: 'none',
                border: 'none',
                color: 'var(--color-text-primary)',
                minHeight: 24,
              }}
            />
            <button
              type="submit"
              disabled={!input.trim() || chatLoading}
              style={{
                width: 30,
                height: 30,
                borderRadius: 'var(--radius-sm)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: input.trim() ? 'var(--color-accent)' : 'transparent',
                border: 'none',
                color: input.trim() ? 'var(--color-text-inverse)' : 'var(--color-text-tertiary)',
                cursor: input.trim() ? 'pointer' : 'default',
                transition: 'all 150ms ease-out',
                flexShrink: 0,
              }}
            >
              <Send size={13} strokeWidth={1.75} />
            </button>
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: 8,
            gap: 4,
          }}>
            <span style={{ fontSize: 10, color: 'var(--color-text-tertiary)' }}>
              Press
            </span>
            <kbd style={{
              fontSize: 10,
              padding: '1px 5px',
              borderRadius: 4,
              background: 'var(--color-bg-sunken)',
              border: '1px solid var(--color-border-subtle)',
              color: 'var(--color-text-tertiary)',
              fontFamily: 'inherit',
            }}>
              {navigator.platform?.includes('Mac') ? '\u2318' : 'Ctrl'}+K
            </kbd>
            <span style={{ fontSize: 10, color: 'var(--color-text-tertiary)' }}>
              to open anywhere
            </span>
          </div>
        </form>
      </div>
    </>
  );
}
