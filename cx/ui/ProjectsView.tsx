import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { colors, symbols } from './theme.js';
import { listProjects } from '../lib/projects.js';

interface ProjectsViewProps {
  currentProjectId: string | null;
  token: string;
  onBack: () => void;
  onSwitch: (projectId: string, repoName: string) => void;
}

export function ProjectsView({ currentProjectId, onBack, onSwitch }: ProjectsViewProps) {
  const projects = listProjects().reverse();
  const [cursor, setCursor] = useState(0);

  useInput((_input, key) => {
    if (key.escape) {
      onBack();
      return;
    }
    if (key.upArrow) {
      setCursor(c => Math.max(0, c - 1));
    } else if (key.downArrow) {
      setCursor(c => Math.min(projects.length - 1, c + 1));
    } else if (key.return && projects[cursor]) {
      onSwitch(projects[cursor].projectId, projects[cursor].repoName);
    }
  });

  if (projects.length === 0) {
    return (
      <Box flexDirection="column" paddingLeft={1}>
        <Box marginBottom={1}>
          <Text bold color={colors.accent}>Projects</Text>
        </Box>
        <Text color={colors.textSecondary}>No projects yet. Run gui in a repo to analyze it.</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" paddingLeft={1}>
      <Box marginBottom={1}>
        <Text bold color={colors.accent}>Projects</Text>
        <Box flexGrow={1} />
        <Text color={colors.textTertiary}>{projects.length} total</Text>
      </Box>

      <Box flexDirection="column">
        {projects.slice(0, 15).map((project, i) => {
          const isSelected = i === cursor;
          const isCurrent = project.projectId === currentProjectId;
          const date = new Date(project.createdAt).toLocaleDateString();

          return (
            <Box key={project.projectId}>
              <Text color={isSelected ? colors.accent : colors.textTertiary}>
                {isSelected ? symbols.cursor : ' '}{' '}
              </Text>
              <Text color={isSelected ? colors.textPrimary : colors.textSecondary} bold={isSelected}>
                {project.repoName.slice(0, 30).padEnd(32)}
              </Text>
              <Text color={colors.textTertiary}>{date}</Text>
              {isCurrent && (
                <Text color={colors.green}> {symbols.dot} active</Text>
              )}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
