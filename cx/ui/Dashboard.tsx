import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { Header } from './Header.js';

import { ConversationList } from './ConversationList.js';
import { colors } from './theme.js';
import { fetchProjectData, fetchSessionsData } from './hooks/useProject.js';

interface DashboardProps {
  projectId: string;
  repoName: string;
  token: string;
  onStartChat: () => void;
  onResumeSession: (sessionId: string) => void;
}

interface Session {
  sessionId: string;
  startedAt: string;
  messageCount: number;
  preview: string;
}

export function Dashboard({ projectId, repoName, token, onStartChat, onResumeSession }: DashboardProps) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [conceptCount, setConceptCount] = useState<number | undefined>(undefined);
  const [status, setStatus] = useState<string>('loading');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [projectData, sessionsData] = await Promise.all([
          fetchProjectData(projectId, token),
          fetchSessionsData(projectId, token),
        ]);

        if (cancelled) return;

        if (projectData) {
          setConceptCount(projectData.conceptCount);
          setStatus(projectData.status);
        }
        setSessions(sessionsData);
      } catch {
        if (!cancelled) setStatus('error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [projectId, token]);

  useInput((input, key) => {
    if (key.return) {
      onStartChat();
    }
  });

  return (
    <Box flexDirection="column" paddingLeft={1}>
      <Header
        repoName={repoName}
        conceptCount={conceptCount}
        status={loading ? 'loading' : status}
      />

      {loading ? (
        <Box marginLeft={2}>
          <Text color={colors.textTertiary}>Loading...</Text>
        </Box>
      ) : (
        <>
          <ConversationList
            sessions={sessions}
            isActive={true}
            onSelect={onResumeSession}
            onNewChat={onStartChat}
          />

        </>
      )}
    </Box>
  );
}
