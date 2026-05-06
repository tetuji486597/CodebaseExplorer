import React from 'react';
import { Box, Text } from 'ink';
import { colors } from './theme.js';

interface HeaderProps {
  repoName: string;
  conceptCount?: number;
  status?: string;
}

export function Header({ repoName, conceptCount, status }: HeaderProps) {
  const statusColor = status === 'ready' || status === 'enriched' ? colors.green : status === 'analyzing' ? colors.amber : colors.textSecondary;

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box>
        <Text bold color={colors.accent}>gui</Text>
        <Text color={colors.textTertiary}> ~ </Text>
        <Text bold>{repoName}</Text>
        {conceptCount !== undefined && (
          <Text color={colors.textTertiary}> ({conceptCount} concepts)</Text>
        )}
        {status && (
          <>
            <Text color={colors.textTertiary}> ~ </Text>
            <Text color={statusColor}>{status}</Text>
          </>
        )}
      </Box>
    </Box>
  );
}
