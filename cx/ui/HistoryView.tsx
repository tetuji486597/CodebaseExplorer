import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { colors, symbols } from './theme.js';
import { fetchSessionsData } from './hooks/useProject.js';

interface Session {
  sessionId: string;
  startedAt: string;
  messageCount: number;
  preview: string;
}

interface HistoryViewProps {
  projectId: string;
  repoName: string;
  token: string;
  onBack: () => void;
  onResumeSession: (sessionId: string) => void;
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function getDateGroup(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const weekAgo = new Date(today.getTime() - 7 * 86400000);

  if (d >= today) return 'Today';
  if (d >= yesterday) return 'Yesterday';
  if (d >= weekAgo) return 'This Week';
  return 'Older';
}

export function HistoryView({ projectId, repoName, token, onBack, onResumeSession }: HistoryViewProps) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [cursor, setCursor] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSessionsData(projectId, token).then(data => {
      setSessions(data);
      setLoading(false);
    });
  }, [projectId, token]);

  useInput((input, key) => {
    if (key.escape) {
      onBack();
      return;
    }
    if (key.upArrow) {
      setCursor(c => Math.max(0, c - 1));
    } else if (key.downArrow) {
      setCursor(c => Math.min(sessions.length - 1, c + 1));
    } else if (key.return && sessions[cursor]) {
      onResumeSession(sessions[cursor].sessionId);
    }
  });

  if (loading) {
    return (
      <Box paddingLeft={1}>
        <Text color={colors.textTertiary}>Loading history...</Text>
      </Box>
    );
  }

  if (sessions.length === 0) {
    return (
      <Box flexDirection="column" paddingLeft={1}>
        <Text color={colors.textSecondary}>No conversations yet for {repoName}.</Text>
        <Box marginTop={1}>
          <Text color={colors.textTertiary}>[Esc] back</Text>
        </Box>
      </Box>
    );
  }

  let lastGroup = '';

  return (
    <Box flexDirection="column" paddingLeft={1}>
      <Box marginBottom={1}>
        <Text bold color={colors.accent}>Conversations</Text>
        <Text color={colors.textTertiary}>  {repoName}</Text>
        <Box flexGrow={1} />
        <Text color={colors.textTertiary}>{sessions.length} total</Text>
      </Box>

      <Box flexDirection="column">
        {sessions.map((session, i) => {
          const group = getDateGroup(session.startedAt);
          const showGroup = group !== lastGroup;
          lastGroup = group;
          const isSelected = i === cursor;
          const preview = (session.preview || 'Untitled').slice(0, 50);
          const time = formatTime(session.startedAt);
          const msgs = `${session.messageCount} msg${session.messageCount !== 1 ? 's' : ''}`;

          return (
            <Box key={session.sessionId} flexDirection="column">
              {showGroup && (
                <Box marginTop={i > 0 ? 1 : 0} marginLeft={1}>
                  <Text color={colors.textTertiary} dimColor>{group}</Text>
                </Box>
              )}
              <Box marginLeft={2}>
                <Text color={isSelected ? colors.accent : colors.textTertiary}>
                  {isSelected ? symbols.cursor : ' '}
                </Text>
                <Text color={isSelected ? colors.textPrimary : colors.textSecondary} bold={isSelected}>
                  {' '}{preview}
                </Text>
                <Box flexGrow={1} />
                <Text color={colors.textTertiary}>
                  {time} {symbols.dot} {msgs}
                </Text>
              </Box>
            </Box>
          );
        })}
      </Box>

      <Box marginTop={1}>
        <Text color={colors.accent} bold>[Enter]</Text>
        <Text color={colors.textTertiary}> Resume  </Text>
        <Text color={colors.accent} bold>[Esc]</Text>
        <Text color={colors.textTertiary}> Back</Text>
      </Box>
    </Box>
  );
}
