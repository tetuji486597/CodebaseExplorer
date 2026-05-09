import React from 'react';
import { Box, Text } from 'ink';
import { colors } from './theme.js';

interface FooterProps {
  hints: Array<{ key: string; label: string }>;
}

export function Footer({ hints }: FooterProps) {
  if (hints.length === 0) return null;

  return (
    <Box marginTop={1} paddingLeft={1}>
      {hints.map((h, i) => (
        <Box key={h.key} marginRight={2}>
          <Text color={colors.accent}>{h.key}</Text>
          <Text color={colors.textTertiary}> {h.label}</Text>
        </Box>
      ))}
    </Box>
  );
}
