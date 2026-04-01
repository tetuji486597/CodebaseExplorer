import { useState, useRef, useEffect } from 'react';
import useStore from '../store/useStore';
import { Send, ChevronDown, MessageSquare } from 'lucide-react';

export default function ChatBar() {
  const [input, setInput] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const messagesEndRef = useRef(null);
  const {
    chatMessages, chatLoading, addChatMessage, setChatLoading,
    concepts, projectId, selectedNode, showInspector,
  } = useStore();

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
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: userMsg,
            projectId,
            selectedNode,
          }),
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

        if (accumulated) {
          addChatMessage({ role: 'assistant', content: accumulated });
        }
        setStreamingText('');
        setChatLoading(false);
      } catch (err) {
        addChatMessage({ role: 'assistant', content: `Failed to get response: ${err.message}` });
        setStreamingText('');
        setChatLoading(false);
      }
    } else {
      setTimeout(() => {
        const responses = [
          `This codebase is organized around ${concepts.length} main concepts: ${concepts.slice(0, 4).map(c => c.name).join(', ')}. Each concept groups related files together.`,
          `Think of this app like a restaurant. Each concept is a different area \u2014 the kitchen, the dining room, the front desk \u2014 all working together.`,
        ];
        addChatMessage({
          role: 'assistant',
          content: responses[Math.floor(Math.random() * responses.length)],
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
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-xs font-medium"
            style={{ background: 'rgba(99, 102, 241, 0.15)', color: '#a5b4fc' }}
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
            className="inline mono text-xs px-1.5 py-0.5 rounded-md font-medium"
            style={{ background: 'rgba(139, 92, 246, 0.15)', color: '#c4b5fd' }}
          >
            {path.split('/').pop()}
          </button>
        );
      }

      return <span key={i}>{part}</span>;
    });
  };

  return (
    <div
      className="absolute bottom-0 left-0 z-20"
      style={{ right: showInspector ? 'min(400px, 92vw)' : 0 }}
    >
      {/* Messages area (expandable) */}
      {expanded && (chatMessages.length > 0 || streamingText) && (
        <div
          className="mx-4 mb-1 rounded-t-xl overflow-hidden"
          style={{
            background: '#14142b',
            border: '1px solid rgba(255,255,255,0.06)',
            borderBottom: 'none',
            maxHeight: '40vh',
            boxShadow: '0 -4px 24px rgba(0,0,0,0.3)',
          }}
        >
          <div
            className="flex items-center justify-between px-4 py-2.5"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
          >
            <div className="flex items-center gap-2">
              <MessageSquare size={12} style={{ color: '#64748b' }} />
              <span className="text-xs font-medium" style={{ color: '#94a3b8' }}>Chat</span>
            </div>
            <button
              onClick={() => setExpanded(false)}
              className="flex items-center gap-1 text-xs font-medium transition-colors duration-200"
              style={{ color: '#64748b' }}
              onMouseEnter={e => e.currentTarget.style.color = '#94a3b8'}
              onMouseLeave={e => e.currentTarget.style.color = '#64748b'}
            >
              <ChevronDown size={12} />
              Collapse
            </button>
          </div>
          <div className="overflow-auto p-4 space-y-3" style={{ maxHeight: '35vh' }}>
            {chatMessages.map((msg, i) => (
              <div
                key={i}
                className={`text-sm p-3 rounded-xl leading-relaxed ${msg.role === 'user' ? 'ml-12' : 'mr-4'}`}
                style={{
                  background: msg.role === 'user' ? 'rgba(99, 102, 241, 0.1)' : '#1e1e3a',
                  color: msg.role === 'user' ? '#a5b4fc' : '#cbd5e1',
                  border: '1px solid rgba(255,255,255,0.06)',
                }}
              >
                {msg.role === 'assistant' ? renderMessage(msg.content) : msg.content}
              </div>
            ))}
            {streamingText && (
              <div
                className="text-sm p-3 rounded-xl leading-relaxed mr-4"
                style={{ background: '#1e1e3a', color: '#cbd5e1', border: '1px solid rgba(255,255,255,0.06)' }}
              >
                {renderMessage(streamingText)}
                <span className="inline-block w-1.5 h-3 ml-0.5 rounded-sm" style={{ background: '#6366f1', animation: 'processing-dot 1s infinite' }} />
              </div>
            )}
            {chatLoading && !streamingText && (
              <div className="flex gap-1.5 p-3">
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#6366f1', animation: 'processing-dot 1.4s infinite 0s' }} />
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#6366f1', animation: 'processing-dot 1.4s infinite 0.2s' }} />
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#6366f1', animation: 'processing-dot 1.4s infinite 0.4s' }} />
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>
      )}

      {/* Input bar */}
      <div className="p-4">
        <form onSubmit={handleSubmit}>
          <div
            className="flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200"
            style={{
              background: '#14142b',
              border: '1px solid rgba(255,255,255,0.08)',
              boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
            }}
            onClick={() => chatMessages.length > 0 && setExpanded(true)}
          >
            <MessageSquare size={14} style={{ color: '#475569', flexShrink: 0 }} />
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Ask anything about this codebase..."
              className="flex-1 bg-transparent text-sm outline-none placeholder-slate-600"
              style={{ color: '#e2e8f0', fontFamily: "'Inter', sans-serif" }}
            />
            {input.trim() && (
              <button
                type="submit"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 active:scale-95"
                style={{
                  background: 'rgba(99, 102, 241, 0.2)',
                  color: '#a5b4fc',
                  border: '1px solid rgba(99, 102, 241, 0.3)',
                }}
              >
                <Send size={12} />
                Send
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
