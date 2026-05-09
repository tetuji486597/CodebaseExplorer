import React, { useState, useEffect, useRef } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import TextInput from 'ink-text-input';
import { colors, symbols } from './theme.js';
import { getApiBase } from '../lib/auth.js';
import { getLocalFiles, scopeLocalFiles } from '../lib/localContext.js';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatViewProps {
  projectId: string;
  repoName: string;
  token: string;
  sessionId: string | null;
  onBack: () => void;
  repoDir?: string;
  initialQuery?: string;
}

function cleanForDisplay(text: string): string {
  let clean = text.replace(/\[\[(concept|file):([^\]]+)\]\]/g, (_, _type, val) => val);
  clean = clean.replace(/^#{1,3}\s+/gm, '');
  clean = clean.replace(/\*\*([^*]+)\*\*/g, '$1');
  return clean;
}

export function ChatView({ projectId, repoName, token, sessionId, onBack, repoDir, initialQuery }: ChatViewProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState('');
  const activeSessionId = useRef(sessionId || `${projectId.slice(0, 8)}-${Date.now()}`);
  const [localFiles, setLocalFiles] = useState<Record<string, string>>({});
  const [filesLoaded, setFilesLoaded] = useState(false);
  const [initialSent, setInitialSent] = useState(false);

  useEffect(() => {
    const dir = repoDir || process.cwd();
    getLocalFiles(dir).then(files => {
      setLocalFiles(files);
      setFilesLoaded(true);
    }).catch(() => { setFilesLoaded(true); });
  }, [repoDir]);

  useEffect(() => {
    if (initialQuery && filesLoaded && !initialSent) {
      setInitialSent(true);
      sendMessage(initialQuery);
    }
  }, [filesLoaded, initialQuery, initialSent]);

  useEffect(() => {
    if (sessionId) {
      loadHistory();
    }
  }, [sessionId]);

  async function loadHistory() {
    const apiBase = getApiBase();
    try {
      const url = sessionId
        ? `${apiBase}/api/cx/chat/${projectId}/history?sessionId=${sessionId}`
        : `${apiBase}/api/cx/chat/${projectId}/history`;
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      const msgs: ChatMessage[] = (data.messages || []).slice(-6).map((m: any) => ({
        role: m.role,
        content: m.content,
      }));
      setMessages(msgs);
    } catch {}
  }

  useInput((_input, key) => {
    if (key.escape && !streaming) {
      onBack();
    }
  });

  async function sendMessage(text: string) {
    if (!text.trim() || streaming) return;

    const userMsg: ChatMessage = { role: 'user', content: text.trim() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setStreaming(true);
    setStreamText('');

    const apiBase = getApiBase();
    try {
      const scopedFiles = Object.keys(localFiles).length > 0
        ? scopeLocalFiles(text.trim(), localFiles, 12)
        : undefined;

      const response = await fetch(`${apiBase}/api/cx/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          projectId,
          message: text.trim(),
          history: [...messages, userMsg].slice(-6),
          sessionId: activeSessionId.current,
          localFiles: scopedFiles,
        }),
      });

      if (!response.ok) throw new Error(`${response.status}`);

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No stream');

      const decoder = new TextDecoder();
      let fullText = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const event = JSON.parse(line.slice(6));
            if (event.text) {
              fullText += event.text;
              setStreamText(fullText);
            }
          } catch {}
        }
      }

      setMessages(prev => [...prev, { role: 'assistant', content: fullText }]);
      setStreamText('');
    } catch (err: any) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${err.message}` }]);
    } finally {
      setStreaming(false);
    }
  }

  const handleSubmit = (value: string) => {
    if (value.trim() === '/quit' || value.trim() === '/q') {
      onBack();
      return;
    }
    sendMessage(value);
  };

  const visibleMessages = messages.slice(-8);

  return (
    <Box flexDirection="column" paddingLeft={1}>
      <Box marginBottom={1}>
        <Text bold color={colors.accent}>gui chat</Text>
        <Text color={colors.textTertiary}>  {repoName}</Text>
        <Box flexGrow={1} />
        <Text color={colors.textTertiary}>[Esc] back</Text>
      </Box>

      <Box flexDirection="column" marginBottom={1}>
        {visibleMessages.map((msg, i) => (
          <Box key={i} flexDirection="column" marginBottom={1}>
            {msg.role === 'user' ? (
              <Box>
                <Text color={colors.cyan} bold>{symbols.cursor} </Text>
                <Text>{msg.content}</Text>
              </Box>
            ) : (
              <Box marginLeft={2}>
                <Text color={colors.textSecondary}>{cleanForDisplay(msg.content)}</Text>
              </Box>
            )}
          </Box>
        ))}

        {streaming && streamText && (
          <Box marginLeft={2} marginBottom={1}>
            <Text color={colors.textSecondary}>{cleanForDisplay(streamText)}</Text>
            <Text color={colors.accent}>▊</Text>
          </Box>
        )}

        {streaming && !streamText && (
          <Box marginLeft={2} marginBottom={1}>
            <Text color={colors.textTertiary}>Thinking...</Text>
          </Box>
        )}
      </Box>

      <Box>
        <Text color={colors.cyan}>{symbols.cursor} </Text>
        <TextInput
          value={input}
          onChange={setInput}
          onSubmit={handleSubmit}
          placeholder="Ask about architecture, data flows, or how anything works..."
        />
      </Box>
    </Box>
  );
}
