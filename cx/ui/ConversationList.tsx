import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { colors, symbols } from './theme.js';

interface Session {
  sessionId: string;
  startedAt: string;
  messageCount: number;
  preview: string;
}

interface ConversationListProps {
  sessions: Session[];
  isActive: boolean;
  onSelect: (sessionId: string) => void;
  onNewChat: () => void;
}

function formatRelativeTime(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);

  if (d >= today) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else if (d >= yesterday) {
    return 'Yesterday';
  } else {
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }
}

export function ConversationList({ sessions, isActive, onSelect, onNewChat }: ConversationListProps) {
  const [cursor, setCursor] = useState(0);

  useInput((input, key) => {
    if (!isActive) return;

    if (key.upArrow) {
      setCursor(c => Math.max(0, c - 1));
    } else if (key.downArrow) {
      setCursor(c => Math.min(sessions.length - 1, c + 1));
    } else if (key.return) {
      if (sessions[cursor]) {
        onSelect(sessions[cursor].sessionId);
      }
    } else if (input === 'n') {
      onNewChat();
    }
  });

  if (sessions.length === 0) {
    return (
      <Box flexDirection="column">
        <Text color={colors.textTertiary}>No conversations yet.</Text>
        <Box marginTop={1}>
          <Text color={colors.accent}>n</Text>
          <Text color={colors.textTertiary}> new chat  </Text>
          <Text color={colors.accent}>/</Text>
          <Text color={colors.textTertiary}> commands  </Text>
          <Text color={colors.accent}>q</Text>
          <Text color={colors.textTertiary}> quit</Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      {sessions.slice(0, 8).map((session, i) => {
        const isSelected = isActive && i === cursor;
        const preview = (session.preview || 'Untitled').slice(0, 40);
        const time = formatRelativeTime(session.startedAt);
        const msgs = `${session.messageCount}msg`;

        return (
          <Box key={session.sessionId}>
            <Text color={isSelected ? colors.accent : colors.textTertiary}>
              {isSelected ? symbols.cursor : ' '}{' '}
            </Text>
            <Text color={isSelected ? colors.textPrimary : colors.textSecondary} bold={isSelected}>
              {preview}
            </Text>
            <Text color={colors.textTertiary}> {time} {msgs}</Text>
          </Box>
        );
      })}
      <Box marginTop={1}>
        <Text color={colors.accent}>enter</Text>
        <Text color={colors.textTertiary}> resume  </Text>
        <Text color={colors.accent}>n</Text>
        <Text color={colors.textTertiary}> new chat  </Text>
        <Text color={colors.accent}>↑↓</Text>
        <Text color={colors.textTertiary}> browse  </Text>
        <Text color={colors.accent}>q</Text>
        <Text color={colors.textTertiary}> quit</Text>
      </Box>
    </Box>
  );
}
