import React, { useState } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import Spinner from 'ink-spinner';
import { colors, symbols } from './theme.js';
import { login } from '../lib/auth.js';

interface WelcomeViewProps {
  onLoggedIn: () => void;
}

export function WelcomeView({ onLoggedIn }: WelcomeViewProps) {
  const { exit } = useApp();
  const [loggingIn, setLoggingIn] = useState(false);
  const [error, setError] = useState('');

  useInput((_input, key) => {
    if (loggingIn) return;
    if (key.return) {
      setLoggingIn(true);
      login()
        .then(() => onLoggedIn())
        .catch((err) => {
          setError(err.message || 'Login failed');
          setLoggingIn(false);
        });
    }
    if (_input === 'q') {
      exit();
    }
  });

  return (
    <Box flexDirection="column" paddingLeft={1}>
      <Box marginBottom={1}>
        <Text bold color={colors.accent}>gui</Text>
        <Text color={colors.textSecondary}> ~ codebase explorer</Text>
      </Box>

      <Box flexDirection="column" marginLeft={2} marginBottom={1}>
        <Text color={colors.textPrimary}>
          Welcome! gui maps codebases into interactive concept
        </Text>
        <Text color={colors.textPrimary}>
          graphs so you can understand any project in minutes.
        </Text>
      </Box>

      {loggingIn ? (
        <Box marginLeft={2}>
          <Text color={colors.amber}><Spinner type="dots" /></Text>
          <Text color={colors.textSecondary}> Opening browser for login...</Text>
        </Box>
      ) : error ? (
        <Box flexDirection="column" marginLeft={2}>
          <Text color={colors.rose}>Login failed: {error}</Text>
          <Box marginTop={1}>
            <Text color={colors.accent} bold>[Enter]</Text>
            <Text color={colors.textTertiary}> Try again  </Text>
            <Text color={colors.accent} bold>[q]</Text>
            <Text color={colors.textTertiary}> Quit</Text>
          </Box>
        </Box>
      ) : (
        <Box flexDirection="column" marginLeft={2}>
          <Text color={colors.textSecondary}>
            Press Enter to log in via your browser.
          </Text>
          <Box marginTop={1}>
            <Text color={colors.accent} bold>[Enter]</Text>
            <Text color={colors.textTertiary}> Log in  </Text>
            <Text color={colors.accent} bold>[q]</Text>
            <Text color={colors.textTertiary}> Quit</Text>
          </Box>
        </Box>
      )}
    </Box>
  );
}
