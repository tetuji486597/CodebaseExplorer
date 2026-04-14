import { useState, useRef, useEffect } from 'react';
import useStore from '../store/useStore';
import { Send, ChevronDown, ChevronUp, MessageSquare } from 'lucide-react';
import { API_BASE } from '../lib/api';

export default function ChatBar() {
  const [input, setInput] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const messagesEndRef = useRef(null);
  const chatMessages = useStore(s => s.chatMessages);
  const chatLoading = useStore(s => s.chatLoading);
  const addChatMessage = useStore(s => s.addChatMessage);
  const setChatLoading = useStore(s => s.setChatLoading);
  const concepts = useStore(s => s.concepts);
  const projectId = useStore(s => s.projectId);
  const selectedNode = useStore(s => s.selectedNode);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, streamingText]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim() || chatLoading) return;

    const userMsg = input.trim();
    addChatMessage({ role: 'user', content: userMsg });
    setInput('');
    setChatLoading(true);
    setExpanded(true);
    setStreamingText('');

    if (projectId) {
      try {
        const response = await fetch(`${API_BASE}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: userMsg, projectId, selectedNode }),
        });

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let accumulated = '';
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.text) {
                  accumulated += data.text;
                  setStreamingText(accumulated);
                }
                if (data.done) {
                  addChatMessage({ role: 'assistant', content: accumulated });
                  setStreamingText('');
                  setChatLoading(false);
                  return;
                }
                if (data.error) {
                  addChatMessage({ role: 'assistant', content: `Error: ${data.error}` });
                  setStreamingText('');
                  setChatLoading(false);
                  return;
                }
              } catch {}
            }
          }
        }

        if (accumulated) addChatMessage({ role: 'assistant', content: accumulated });
        setStreamingText('');
        setChatLoading(false);
      } catch (err) {
        addChatMessage({ role: 'assistant', content: `Failed to get response: ${err.message}` });
        setStreamingText('');
        setChatLoading(false);
      }
    } else {
      setTimeout(() => {
        addChatMessage({
          role: 'assistant',
          content: `This codebase is organized around ${concepts.length} main concepts: ${concepts.slice(0, 4).map(c => c.name).join(', ')}.`,
        });
        setChatLoading(false);
      }, 800);
    }
  };

  const renderMessage = (content) => {
    const parts = content.split(/(\[\[(?:concept|file):[^\]]+\]\])/g);
    return parts.map((part, i) => {
      const conceptMatch = part.match(/\[\[concept:([^\]]+)\]\]/);
      const fileMatch = part.match(/\[\[file:([^\]]+)\]\]/);

      if (conceptMatch) {
        const key = conceptMatch[1];
        const concept = concepts.find(c => c.id === key);
        return (
          <button
            key={i}
            onClick={() => {
              useStore.getState().setSelectedNode({ type: 'concept', id: key });
              useStore.getState().setShowInspector(true);
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '1px 8px',
              borderRadius: 'var(--radius-sm)',
              fontSize: 12,
              fontWeight: 500,
              background: 'var(--color-accent-soft)',
              color: 'var(--color-accent-active)',
              border: '1px solid var(--color-border-strong)',
              cursor: 'pointer',
            }}
          >
            {concept?.name || key}
          </button>
        );
      }

      if (fileMatch) {
        const path = fileMatch[1];
        return (
          <button
            key={i}
            onClick={() => {
              useStore.getState().setSelectedNode({ type: 'file', id: path });
              useStore.getState().setShowInspector(true);
            }}
            className="mono"
            style={{
              display: 'inline-flex',
              fontSize: 12,
              padding: '1px 8px',
              borderRadius: 'var(--radius-sm)',
              fontWeight: 500,
              background: 'var(--color-bg-sunken)',
              color: 'var(--color-text-secondary)',
              border: '1px solid var(--color-border-subtle)',
              cursor: 'pointer',
            }}
          >
            {path.split('/').pop()}
          </button>
        );
      }

      return <span key={i}>{part}</span>;
    });
  };

  return (
    <div className="eg-chat">
      {/* Messages area (expandable) */}
      {expanded && (chatMessages.length > 0 || streamingText) && (
        <div
          style={{
            maxHeight: 'min(40dvh, 420px)',
            display: 'flex',
            flexDirection: 'column',
            borderBottom: '1px solid var(--color-border-subtle)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px clamp(0.75rem, 3vw, 1rem)',
              borderBottom: '1px solid var(--color-border-subtle)',
              flexShrink: 0,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <MessageSquare size={12} strokeWidth={1.75} style={{ color: 'var(--color-text-tertiary)' }} />
              <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-secondary)' }}>Chat</span>
            </div>
            <button
              onClick={() => setExpanded(false)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                fontSize: 12,
                fontWeight: 500,
                color: 'var(--color-text-tertiary)',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <ChevronDown size={12} strokeWidth={1.75} />
              Collapse
            </button>
          </div>
          <div
            style={{
              overflowY: 'auto',
              padding: 'clamp(0.75rem, 3vw, 1rem)',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              flex: 1,
              minHeight: 0,
            }}
          >
            {chatMessages.map((msg, i) => (
              <div
                key={i}
                style={{
                  fontSize: 13,
                  lineHeight: 1.6,
                  padding: 12,
                  borderRadius: 'var(--radius-md)',
                  marginLeft: msg.role === 'user' ? 48 : 0,
                  marginRight: msg.role === 'user' ? 0 : 16,
                  background: msg.role === 'user' ? 'var(--color-accent-soft)' : 'var(--color-bg-elevated)',
                  color: msg.role === 'user' ? 'var(--color-accent-active)' : 'var(--color-text-primary)',
                  border: '1px solid var(--color-border-subtle)',
                }}
              >
                {msg.role === 'assistant' ? renderMessage(msg.content) : msg.content}
              </div>
            ))}
            {streamingText && (
              <div
                style={{
                  fontSize: 13,
                  lineHeight: 1.6,
                  padding: 12,
                  borderRadius: 'var(--radius-md)',
                  marginRight: 16,
                  background: 'var(--color-bg-elevated)',
                  color: 'var(--color-text-primary)',
                  border: '1px solid var(--color-border-subtle)',
                }}
              >
                {renderMessage(streamingText)}
                <span style={{ display: 'inline-block', width: 6, height: 12, marginLeft: 2, borderRadius: 2, background: 'var(--color-accent)', animation: 'processing-dot 1s infinite' }} />
              </div>
            )}
            {chatLoading && !streamingText && (
              <div style={{ display: 'flex', gap: 6, padding: 12 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-accent)', animation: 'processing-dot 1.4s infinite' }} />
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-accent)', animation: 'processing-dot 1.4s infinite 0.2s' }} />
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-accent)', animation: 'processing-dot 1.4s infinite 0.4s' }} />
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>
      )}

      {/* Collapsed expand indicator */}
      {!expanded && chatMessages.length > 0 && (
        <button
          onClick={() => setExpanded(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            width: '100%',
            padding: '8px 16px',
            background: 'transparent',
            border: 'none',
            borderBottom: '1px solid var(--color-border-subtle)',
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: 500,
            color: 'var(--color-text-tertiary)',
            transition: 'color 150ms ease-out',
          }}
          onMouseEnter={e => e.currentTarget.style.color = 'var(--color-text-secondary)'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--color-text-tertiary)'}
        >
          <ChevronUp size={12} strokeWidth={1.75} />
          {chatMessages.length} {chatMessages.length === 1 ? 'message' : 'messages'}
        </button>
      )}

      {/* Input bar */}
      <form onSubmit={handleSubmit} style={{ padding: 'clamp(0.75rem, 2.5vw, 1rem)' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '12px 16px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--color-bg-elevated)',
            border: '1px solid var(--color-border-visible)',
            boxShadow: 'var(--shadow-xs)',
            transition: `all var(--duration-base) var(--ease-out)`,
            minHeight: 44,
          }}
          onClick={() => chatMessages.length > 0 && setExpanded(true)}
        >
          <MessageSquare size={14} strokeWidth={1.75} style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }} />
          <input
            type="text"
            data-test="chat-input"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Ask about this code"
            style={{
              flex: 1,
              background: 'transparent',
              fontSize: 13,
              outline: 'none',
              border: 'none',
              color: 'var(--color-text-primary)',
            }}
          />
          {input.trim() && (
            <button
              type="submit"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 14px',
                borderRadius: 'var(--radius-sm)',
                fontSize: 12,
                fontWeight: 600,
                background: 'var(--color-accent)',
                color: 'var(--color-text-inverse)',
                border: '1px solid var(--color-accent)',
                cursor: 'pointer',
                transition: `all var(--duration-base) var(--ease-out)`,
              }}
            >
              <Send size={12} strokeWidth={1.75} />
              Send
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
