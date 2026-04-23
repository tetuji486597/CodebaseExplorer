import { useCallback, useRef } from 'react';
import useStore from '../store/useStore';
import { API_BASE } from '../lib/api';

export default function useChatStream() {
  const abortRef = useRef(null);

  const sendMessage = useCallback(async (text) => {
    const store = useStore.getState();
    const { projectId, selectedNode, chatMessages, concepts, chatSessionId } = store;

    if (!text.trim() || store.chatLoading) return;

    store.addChatMessage({ role: 'user', content: text });
    store.setChatLoading(true);
    store.setChatPanelOpen(true);
    store.setChatStreamingText('');

    if (!projectId) {
      setTimeout(() => {
        store.addChatMessage({
          role: 'assistant',
          content: `This codebase is organized around ${concepts.length} main concepts: ${concepts.slice(0, 4).map(c => c.name).join(', ')}.`,
        });
        store.setChatLoading(false);
      }, 800);
      return;
    }

    // Build history (last 6 messages for multi-turn context)
    const history = chatMessages.slice(-6).map(m => ({
      role: m.role,
      content: m.content,
    }));

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const expansionState = store.getExpansionState();
      // Generate session ID if none exists
      const sessionId = chatSessionId || `${projectId.slice(0, 8)}-${Date.now()}`;
      if (!chatSessionId) store.setChatSessionId(sessionId);

      const response = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, projectId, selectedNode, history, expansionState, sessionId }),
        signal: controller.signal,
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';
      let buffer = '';
      let receivedGraphOps = null;

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
                useStore.getState().setChatStreamingText(accumulated);
              }
              if (data.graph_ops) {
                receivedGraphOps = data.graph_ops;
                useStore.getState().applyGraphOperations(data.graph_ops);
              }
              if (data.done) {
                useStore.getState().addChatMessage({
                  role: 'assistant',
                  content: accumulated,
                  ...(receivedGraphOps ? { graphOps: receivedGraphOps } : {}),
                });
                useStore.getState().setChatStreamingText('');
                useStore.getState().setChatLoading(false);
                return;
              }
              if (data.error) {
                useStore.getState().addChatMessage({ role: 'assistant', content: `Error: ${data.error}` });
                useStore.getState().setChatStreamingText('');
                useStore.getState().setChatLoading(false);
                return;
              }
            } catch {}
          }
        }
      }

      if (accumulated) useStore.getState().addChatMessage({
        role: 'assistant',
        content: accumulated,
        ...(receivedGraphOps ? { graphOps: receivedGraphOps } : {}),
      });
      useStore.getState().setChatStreamingText('');
      useStore.getState().setChatLoading(false);
    } catch (err) {
      if (err.name === 'AbortError') return;
      useStore.getState().addChatMessage({ role: 'assistant', content: `Failed to get response: ${err.message}` });
      useStore.getState().setChatStreamingText('');
      useStore.getState().setChatLoading(false);
    }
  }, []);

  const cancelStream = useCallback(() => {
    if (abortRef.current) abortRef.current.abort();
  }, []);

  return { sendMessage, cancelStream };
}
