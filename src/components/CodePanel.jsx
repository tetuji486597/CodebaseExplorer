import { useState, useEffect, useMemo, useRef } from 'react';
import useStore from '../store/useStore';
import { CONCEPT_COLORS } from '../data/sampleData';
import KeywordHighlighter from './KeywordHighlighter';
import { API_BASE } from '../lib/api';


// Simple syntax highlighting
function highlightCode(code) {
  if (!code) return '';
  return code
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/(\/\/.*$)/gm, '<span style="color:#666">$1</span>')
    .replace(/(\/\*[\s\S]*?\*\/)/g, '<span style="color:#666">$1</span>')
    .replace(/('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`)/g, '<span style="color:#9FE1CB">$1</span>')
    .replace(/\b(import|export|from|const|let|var|function|return|if|else|async|await|class|extends|new|this|try|catch|throw|interface|type|enum)\b/g, '<span style="color:#CECBF6">$1</span>')
    .replace(/\b(true|false|null|undefined|void)\b/g, '<span style="color:#FAC775">$1</span>')
    .replace(/\b(\d+)\b/g, '<span style="color:#FAC775">$1</span>')
    .replace(/@(\w+)/g, '<span style="color:#F4C0D1">@$1</span>');
}

export default function CodePanel() {
  const { showCodePanel, codePanelFileId, closeCodePanel, files, concepts, projectId } = useStore();
  const [explanation, setExplanation] = useState(null);
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState([]);
  const [fileContent, setFileContent] = useState(null);

  const file = useMemo(() => files.find(f => f.id === codePanelFileId), [files, codePanelFileId]);
  const concept = useMemo(() => {
    if (!file) return null;
    return concepts.find(c => c.id === file.conceptId);
  }, [file, concepts]);
  const colors = concept ? (CONCEPT_COLORS[concept.color] || CONCEPT_COLORS.gray) : CONCEPT_COLORS.gray;

  useEffect(() => {
    if (!file) return;
    setChatMessages([]);

    // Use real backend if projectId exists
    if (projectId) {
      setExplanation(null);
      (async () => {
        try {
          const res = await fetch(`${API_BASE}/api/explain`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ projectId, filePath: file.id, userLevel: 'beginner' }),
          });
          const contentType = res.headers.get('content-type');
          if (contentType?.includes('application/json')) {
            const data = await res.json();
            setExplanation({ whatItDoes: data.explanation, keyFunctions: [], watchOut: '', connections: '' });
          } else {
            const reader = res.body.getReader();
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
                    if (data.text) accumulated += data.text;
                  } catch {}
                }
              }
            }
            setExplanation({ whatItDoes: accumulated || file.description, keyFunctions: [], watchOut: '', connections: '' });
          }
        } catch {
          setExplanation({ whatItDoes: file.description || 'Unable to load explanation.', keyFunctions: [], watchOut: '', connections: '' });
        }
      })();
    }
  }, [file, concept, projectId]);

  // Fetch actual file content for real projects
  useEffect(() => {
    if (!file || !projectId) {
      setFileContent(null);
      return;
    }
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/pipeline/${projectId}/file-content?path=${encodeURIComponent(file.id)}`);
        if (res.ok) {
          const data = await res.json();
          setFileContent(data.content);
        }
      } catch {}
    })();
  }, [file, projectId]);

  if (!showCodePanel || !file) return null;

  const handleChat = async (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const userMsg = chatInput.trim();
    setChatMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setChatInput('');

    if (projectId) {
      try {
        const response = await fetch(`${API_BASE}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: `Regarding the file ${file.name} (${file.id}): ${userMsg}`,
            projectId,
            selectedNode: { type: 'file', id: file.id },
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
                if (data.text) accumulated += data.text;
                if (data.done || data.error) break;
              } catch {}
            }
          }
        }
        setChatMessages(prev => [...prev, { role: 'assistant', content: accumulated || 'No response received.' }]);
      } catch {
        setChatMessages(prev => [...prev, { role: 'assistant', content: 'Failed to get response.' }]);
      }
    } else {
      setTimeout(() => {
        setChatMessages(prev => [...prev, {
          role: 'assistant',
          content: `That's a great question about ${file.name}! ${file.description || ''} This file is part of the ${concept?.name || 'application'} system and works with related components to deliver its functionality.`,
        }]);
      }, 600);
    }
  };

  const codeLines = (fileContent || file.codeSnippet || '// No code preview available').split('\n');

  return (
    <div className="fixed inset-0 z-50 flex" style={{ background: '#0F0F0E' }}>
      {/* Left: Code */}
      <div className="flex-1 flex flex-col min-w-0" style={{ borderRight: '0.5px solid #282826' }}>
        {/* File header */}
        <div className="flex items-center justify-between px-4 py-3 shrink-0"
             style={{ background: '#1A1A18', borderBottom: '0.5px solid #282826' }}>
          <div className="flex items-center gap-2">
            <button onClick={closeCodePanel}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-sm transition-colors"
                    style={{ color: '#888' }}
                    onMouseEnter={e => e.target.style.background = '#282826'}
                    onMouseLeave={e => e.target.style.background = 'transparent'}>
              ←
            </button>
            <div className="w-2 h-2 rounded-full" style={{ background: colors.stroke }} />
            <span className="mono text-sm" style={{ color: '#E8E8E6' }}>{file.name}</span>
          </div>
          {concept && (
            <span className="text-xs px-2 py-0.5 rounded-full"
                  style={{ background: colors.fill, color: colors.text }}>
              {concept.name}
            </span>
          )}
        </div>

        {/* Code area */}
        <div className="flex-1 overflow-auto p-4">
          <pre className="mono text-sm leading-6">
            {codeLines.map((line, i) => (
              <div key={i} className="flex">
                <span className="inline-block w-10 text-right mr-4 select-none shrink-0"
                      style={{ color: '#444' }}>{i + 1}</span>
                <code dangerouslySetInnerHTML={{ __html: highlightCode(line) || '&nbsp;' }}
                      style={{ color: '#CCC' }} />
              </div>
            ))}
          </pre>
        </div>
      </div>

      {/* Right: Explanation */}
      <div className="flex flex-col" style={{ width: 'min(420px, 40vw)', background: '#1A1A18' }}>
        {/* Header */}
        <div className="px-4 py-3 shrink-0" style={{ borderBottom: '0.5px solid #282826' }}>
          <h3 className="text-sm font-medium" style={{ color: '#E8E8E6' }}>Walkthrough</h3>
        </div>

        {/* Explanation content */}
        <div className="flex-1 overflow-auto p-4 space-y-5">
          {explanation && (
            <>
              <div>
                <div className="text-xs font-medium mb-1.5" style={{ color: '#888' }}>What this file does</div>
                <p className="text-sm leading-relaxed" style={{ color: '#CCC' }}>
                  <KeywordHighlighter text={explanation.whatItDoes} accentColor={colors.stroke} />
                </p>
              </div>

              {explanation.keyFunctions.length > 0 && (
                <div>
                  <div className="text-xs font-medium mb-2" style={{ color: '#888' }}>Key functions</div>
                  <div className="space-y-2">
                    {explanation.keyFunctions.map((fn, i) => (
                      <div key={i} className="p-2.5 rounded-lg" style={{ background: '#131311', border: '0.5px solid #282826' }}>
                        <div className="mono text-xs mb-1" style={{ color: colors.stroke }}>{fn.name}</div>
                        <div className="text-xs" style={{ color: '#999' }}>
                          <KeywordHighlighter text={fn.explanation} accentColor={colors.stroke} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <div className="text-xs font-medium mb-1.5" style={{ color: '#888' }}>What to watch out for</div>
                <p className="text-sm leading-relaxed" style={{ color: '#CCC' }}>
                  <KeywordHighlighter text={explanation.watchOut} accentColor={colors.stroke} />
                </p>
              </div>

              <div>
                <div className="text-xs font-medium mb-1.5" style={{ color: '#888' }}>How it connects</div>
                <p className="text-sm leading-relaxed" style={{ color: '#CCC' }}>
                  <KeywordHighlighter text={explanation.connections} accentColor={colors.stroke} />
                </p>
              </div>
            </>
          )}

          {/* Chat messages */}
          {chatMessages.map((msg, i) => (
            <div key={i} className={`text-sm p-3 rounded-lg ${msg.role === 'user' ? 'ml-8' : 'mr-4'}`}
                 style={{
                   background: msg.role === 'user' ? 'rgba(159,225,203,0.1)' : '#131311',
                   color: msg.role === 'user' ? '#9FE1CB' : '#CCC',
                   border: '0.5px solid #282826',
                 }}>
              {msg.content}
            </div>
          ))}
        </div>

        {/* Chat input */}
        <form onSubmit={handleChat} className="p-3 shrink-0" style={{ borderTop: '0.5px solid #282826' }}>
          <div className="flex gap-2">
            <input
              type="text"
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              placeholder="Ask about this file..."
              className="flex-1 px-3 py-2 rounded-lg text-sm outline-none"
              style={{ background: '#131311', color: '#E8E8E6', border: '0.5px solid #333' }}
            />
            <button type="submit"
                    className="px-3 py-2 rounded-lg text-sm font-medium transition-all active:scale-95"
                    style={{ background: colors.fill, color: colors.text }}>
              Send
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
