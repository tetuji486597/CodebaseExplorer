import React from 'react';
import { Box, Text } from 'ink';
import { colors } from './theme.js';

interface FooterProps {
  hints: Array<{ key: string; label: string }>;
}

export function Footer({ hints }: FooterProps) {
  return (
    <Box marginTop={1} flexWrap="wrap">
      <Text color={colors.textTertiary}>
        {hints.map(h => `${h.key}:${h.label}`).join('  ')}
      </Text>
    </Box>
  );
}
