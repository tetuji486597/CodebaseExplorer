import { useState, useRef, useEffect, useCallback } from 'react';
import useStore from '../store/useStore';
import useChatStream from '../hooks/useChatStream';
import ChatMessage from './ChatMessage';
import SuggestedQuestions from './SuggestedQuestions';
import ChatHistoryPanel from './ChatHistoryPanel';
import { API_BASE } from '../lib/api';
import { X, Send, MessageSquare, Trash2, GripVertical, Loader, Clock, Quote } from 'lucide-react';

const MIN_WIDTH = 320;
const MAX_WIDTH = 720;
const DEFAULT_WIDTH = 400;

export default function ChatPanel() {
  const [input, setInput] = useState('');
  const [activeQuote, setActiveQuote] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
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
  const projectMeta = useStore(s => s.projectMeta);
  const projectId = useStore(s => s.projectId);
  const setChatMessages = useStore(s => s.setChatMessages);
  const setChatSessionId = useStore(s => s.setChatSessionId);

  const handleSelectSession = useCallback(async (session) => {
    try {
      const res = await fetch(`${API_BASE}/api/chat/${projectId}/history?sessionId=${session.sessionId}`);
      const data = await res.json();
      const messages = (data.messages || []).map(m => ({
        role: m.role,
        content: m.content,
        source: m.source,
        session_id: m.session_id,
      }));
      setChatMessages(messages);
      setChatSessionId(session.sessionId);
    } catch {}
    setShowHistory(false);
  }, [projectId, setChatMessages, setChatSessionId]);

  const handleNewConversation = useCallback(() => {
    clearChat();
    setShowHistory(false);
  }, [clearChat]);

  const isEnriching = projectMeta && projectMeta.pipeline_status === 'complete';

  const { sendMessage } = useChatStream();

  const scrollContainerRef = useRef(null);
  const isNearBottomRef = useRef(true);

  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const threshold = 80;
    isNearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
  }, []);

  useEffect(() => {
    if (isNearBottomRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, streamingText]);

  // Focus input when panel opens
  useEffect(() => {
    if (chatPanelOpen) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [chatPanelOpen]);

  // Consume pending quote from text selection toolbar
  const pendingQuote = useStore(s => s.pendingQuote);
  const setPendingQuote = useStore(s => s.setPendingQuote);

  const autoResize = useCallback((el) => {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  }, []);

  useEffect(() => {
    if (pendingQuote && chatPanelOpen) {
      setActiveQuote(pendingQuote);
      setInput('');
      setPendingQuote(null);
      setTimeout(() => inputRef.current?.focus(), 350);
    }
  }, [pendingQuote, chatPanelOpen, setPendingQuote]);

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
    if ((!input.trim() && !activeQuote) || chatLoading) return;
    isNearBottomRef.current = true;
    let message = input.trim();
    if (activeQuote) {
      const sourceLabel = activeQuote.source ? ` (from ${activeQuote.source})` : '';
      const prefix = `Regarding this excerpt${sourceLabel}:\n> ${activeQuote.text}\n\n`;
      message = prefix + message;
    }
    sendMessage(message);
    setInput('');
    setActiveQuote(null);
    autoResize(inputRef.current);
  };

  const handleSuggestion = (question) => {
    isNearBottomRef.current = true;
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
            {showHistory ? (
              <Clock size={14} strokeWidth={1.75} style={{ color: 'var(--color-accent)' }} />
            ) : (
              <MessageSquare size={14} strokeWidth={1.75} style={{ color: 'var(--color-accent)' }} />
            )}
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)', letterSpacing: '-0.01em' }}>
              {showHistory ? 'History' : 'Ask anything'}
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
            <button
              onClick={() => setShowHistory(!showHistory)}
              aria-label={showHistory ? 'Back to chat' : 'Chat history'}
              style={{
                width: 30,
                height: 30,
                borderRadius: 'var(--radius-sm)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: showHistory ? 'var(--color-bg-sunken)' : 'transparent',
                border: 'none',
                color: showHistory ? 'var(--color-accent, #6366f1)' : 'var(--color-text-tertiary)',
                cursor: 'pointer',
                transition: 'all 150ms ease-out',
              }}
              onMouseEnter={e => {
                if (!showHistory) {
                  e.currentTarget.style.background = 'var(--color-bg-sunken)';
                  e.currentTarget.style.color = 'var(--color-text-secondary)';
                }
              }}
              onMouseLeave={e => {
                if (!showHistory) {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = 'var(--color-text-tertiary)';
                }
              }}
            >
              <Clock size={13} strokeWidth={1.75} />
            </button>
            {chatMessages.length > 0 && !showHistory && (
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

        {/* Enrichment banner */}
        {isEnriching && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 18px',
            background: 'var(--color-accent-soft)',
            borderBottom: '1px solid var(--color-border-subtle)',
            flexShrink: 0,
          }}>
            <Loader size={12} strokeWidth={1.75} style={{ color: 'var(--color-accent)', animation: 'spin 2s linear infinite' }} />
            <span style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
              Building search index — chat will improve shortly
            </span>
          </div>
        )}

        {/* Messages / History area */}
        {showHistory ? (
          <ChatHistoryPanel
            onSelectSession={handleSelectSession}
            onNewConversation={handleNewConversation}
          />
        ) : (
          <div
            ref={scrollContainerRef}
            onScroll={handleScroll}
            style={{
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
        )}

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
          {activeQuote && (
            <div style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 8,
              padding: '8px 10px',
              marginBottom: 8,
              borderRadius: 'var(--radius-sm, 6px)',
              background: 'var(--color-bg-elevated, #1a1b2e)',
              border: '1px solid var(--color-border-subtle, rgba(255,255,255,0.06))',
              borderLeft: '3px solid var(--color-accent, #6366f1)',
              animation: 'selection-toolbar-in 150ms ease-out',
            }}>
              <Quote size={13} strokeWidth={1.75} style={{ color: 'var(--color-accent, #6366f1)', flexShrink: 0, marginTop: 1 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                {activeQuote.source && (
                  <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--color-accent, #6366f1)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    {activeQuote.source}
                  </div>
                )}
                <div style={{
                  fontSize: 12,
                  color: 'var(--color-text-secondary, #94a3b8)',
                  lineHeight: 1.5,
                  fontStyle: 'italic',
                  overflow: 'hidden',
                  display: '-webkit-box',
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: 'vertical',
                }}>
                  {activeQuote.text}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveQuote(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--color-text-tertiary, #64748b)',
                  cursor: 'pointer',
                  padding: 2,
                  flexShrink: 0,
                  borderRadius: 4,
                  transition: 'color 150ms ease-out',
                }}
                onMouseEnter={e => { e.currentTarget.style.color = 'var(--color-text-primary)'; }}
                onMouseLeave={e => { e.currentTarget.style.color = 'var(--color-text-tertiary)'; }}
              >
                <X size={12} strokeWidth={2} />
              </button>
            </div>
          )}
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
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => { setInput(e.target.value); autoResize(e.target); }}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
              placeholder={activeQuote ? "Ask a question about this excerpt..." : "Ask about this codebase..."}
              rows={1}
              style={{
                flex: 1,
                background: 'transparent',
                fontSize: 13,
                outline: 'none',
                border: 'none',
                color: 'var(--color-text-primary)',
                minHeight: 24,
                maxHeight: 120,
                resize: 'none',
                fontFamily: 'inherit',
                lineHeight: 1.5,
              }}
            />
            <button
              type="submit"
              disabled={(!input.trim() && !activeQuote) || chatLoading}
              style={{
                width: 30,
                height: 30,
                borderRadius: 'var(--radius-sm)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: (input.trim() || activeQuote) ? 'var(--color-accent)' : 'transparent',
                border: 'none',
                color: (input.trim() || activeQuote) ? 'var(--color-text-inverse)' : 'var(--color-text-tertiary)',
                cursor: (input.trim() || activeQuote) ? 'pointer' : 'default',
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
