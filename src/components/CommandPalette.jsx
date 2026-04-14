import { useState, useRef, useEffect } from 'react';
import useStore from '../store/useStore';
import useChatStream from '../hooks/useChatStream';
import SuggestedQuestions from './SuggestedQuestions';
import { Search, CornerDownLeft } from 'lucide-react';

export default function CommandPalette() {
  const [input, setInput] = useState('');
  const inputRef = useRef(null);
  const commandPaletteOpen = useStore(s => s.commandPaletteOpen);
  const setCommandPaletteOpen = useStore(s => s.setCommandPaletteOpen);
  const chatLoading = useStore(s => s.chatLoading);
  const { sendMessage } = useChatStream();

  // Focus input when opening
  useEffect(() => {
    if (commandPaletteOpen) {
      setInput('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [commandPaletteOpen]);

  // Close on escape
  useEffect(() => {
    if (!commandPaletteOpen) return;
    const handleKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setCommandPaletteOpen(false);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [commandPaletteOpen, setCommandPaletteOpen]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!input.trim() || chatLoading) return;
    sendMessage(input.trim());
    setInput('');
    setCommandPaletteOpen(false);
  };

  const handleSuggestion = (question) => {
    sendMessage(question);
    setCommandPaletteOpen(false);
  };

  if (!commandPaletteOpen) return null;

  return (
    <div
      className="command-palette-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) setCommandPaletteOpen(false);
      }}
    >
      <div className="command-palette" onClick={e => e.stopPropagation()}>
        {/* Input */}
        <form onSubmit={handleSubmit}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '14px 18px',
            borderBottom: '1px solid var(--color-border-subtle)',
          }}>
            <Search size={16} strokeWidth={1.75} style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }} />
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Ask anything about this codebase..."
              style={{
                flex: 1,
                background: 'transparent',
                fontSize: 15,
                fontWeight: 400,
                outline: 'none',
                border: 'none',
                color: 'var(--color-text-primary)',
              }}
            />
            {input.trim() && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                <kbd style={{
                  fontSize: 11,
                  padding: '3px 7px',
                  borderRadius: 5,
                  background: 'var(--color-accent)',
                  color: 'var(--color-text-inverse)',
                  fontFamily: 'inherit',
                  fontWeight: 500,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 3,
                }}>
                  <CornerDownLeft size={11} strokeWidth={2} />
                  Send
                </kbd>
              </div>
            )}
          </div>
        </form>

        {/* Suggestions */}
        <div style={{ padding: '14px 18px' }}>
          <SuggestedQuestions onSelect={handleSuggestion} />
        </div>
      </div>
    </div>
  );
}
