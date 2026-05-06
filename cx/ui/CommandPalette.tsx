import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { colors, symbols } from './theme.js';

interface Command {
  id: string;
  label: string;
  description: string;
}

const commands: Command[] = [
  { id: 'chat', label: 'chat', description: 'Start a new conversation' },
  { id: 'history', label: 'history', description: 'Browse past conversations' },
  { id: 'analyze', label: 'analyze', description: 'Re-analyze current project' },
  { id: 'quit', label: 'quit', description: 'Exit gui' },
];

interface CommandPaletteProps {
  onSelect: (command: string) => void;
  onClose: () => void;
}

function fuzzyMatch(query: string, text: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  let qi = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) qi++;
  }
  return qi === q.length;
}

export function CommandPalette({ onSelect, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);

  const filtered = commands.filter(c =>
    fuzzyMatch(query, c.label) || fuzzyMatch(query, c.description)
  );

  useInput((input, key) => {
    if (key.escape) {
      onClose();
      return;
    }
    if (key.upArrow) {
      setCursor(c => Math.max(0, c - 1));
    } else if (key.downArrow) {
      setCursor(c => Math.min(filtered.length - 1, c + 1));
    } else if (key.return) {
      if (filtered[cursor]) {
        onSelect(filtered[cursor].id);
      }
    }
  });

  return (
    <Box flexDirection="column" borderStyle="round" borderColor={colors.accent} paddingX={1}>
      <Box marginBottom={1}>
        <Text color={colors.accent} bold>Commands</Text>
        <Box flexGrow={1} />
        <Text color={colors.textTertiary}>[Esc] close</Text>
      </Box>

      <Box>
        <Text color={colors.accent}>{symbols.cursor} </Text>
        <TextInput
          value={query}
          onChange={(val) => { setQuery(val); setCursor(0); }}
          placeholder="Type to filter..."
        />
      </Box>

      <Box flexDirection="column" marginTop={1}>
        {filtered.map((cmd, i) => {
          const isSelected = i === cursor;
          return (
            <Box key={cmd.id}>
              <Text color={isSelected ? colors.accent : colors.textTertiary}>
                {isSelected ? symbols.cursor : ' '}
              </Text>
              <Text color={isSelected ? colors.textPrimary : colors.textSecondary} bold={isSelected}>
                {' '}{cmd.label.padEnd(14)}
              </Text>
              <Text color={colors.textTertiary}>{cmd.description}</Text>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
