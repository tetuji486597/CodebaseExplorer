import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import { colors, symbols } from './theme.js';
import { readLocalRepo } from '../lib/fileReader.js';
import { getApiBase } from '../lib/auth.js';
import { saveProject } from '../lib/projects.js';
import { basename } from 'path';

interface AnalyzeViewProps {
  repoDir: string;
  repoName: string;
  token: string;
  onComplete: (projectId: string) => void;
}

type Stage = 'reading' | 'classifying' | 'analyzing' | 'synthesizing' | 'complete' | 'error';

export function AnalyzeView({ repoDir, repoName, token, onComplete }: AnalyzeViewProps) {
  const [stage, setStage] = useState<Stage>('reading');
  const [progress, setProgress] = useState({ current: 0, total: 0, file: '' });
  const [fileCount, setFileCount] = useState(0);
  const [framework, setFramework] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    runPipeline();
  }, []);

  async function runPipeline() {
    try {
      const { fileContents, framework: fw, language } = await readLocalRepo(repoDir);
      const total = Object.keys(fileContents).length;
      setFileCount(total);
      setFramework(`${fw}, ${language}`);
      setStage('classifying');

      const apiBase = getApiBase();
      const response = await fetch(`${apiBase}/api/cx/pipeline`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          files: fileContents,
          framework: fw,
          language,
          repoName: basename(repoDir),
          maxFiles: 30,
        }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          setError('Session expired. Run `gui login` to re-authenticate.');
          setStage('error');
          return;
        }
        throw new Error(`Server error (${response.status})`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No stream');

      const decoder = new TextDecoder();
      let buffer = '';
      let projectId = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const event = JSON.parse(line.slice(6));

            if (event.stage === 'classifying') {
              setStage('classifying');
            } else if (event.stage === 'analyzing') {
              setStage('analyzing');
              setProgress({ current: 0, total: event.total || 0, file: '' });
            } else if (event.stage === 'analyzing_progress') {
              setProgress({ current: event.current || 0, total: event.total || 0, file: event.file || '' });
            } else if (event.stage === 'synthesizing') {
              setStage('synthesizing');
            } else if (event.stage === 'synthesized' || event.stage === 'complete') {
              projectId = event.projectId || projectId;
              if (event.stage === 'complete' && projectId) {
                saveProject(repoDir, projectId, '', repoName);
                setStage('complete');
                setTimeout(() => onComplete(projectId), 500);
              }
            } else if (event.stage === 'error') {
              throw new Error(event.message);
            }
          } catch (e: any) {
            if (e.message && !e.message.includes('JSON')) throw e;
          }
        }
      }

      if (projectId && stage !== 'complete') {
        saveProject(repoDir, projectId, '', repoName);
        setStage('complete');
        setTimeout(() => onComplete(projectId), 500);
      }
    } catch (err: any) {
      setError(err.message || 'Unknown error');
      setStage('error');
    }
  }

  const progressBar = () => {
    if (progress.total === 0) return '';
    const width = 20;
    const pct = Math.min(progress.current / progress.total, 1);
    const filled = Math.round(pct * width);
    return `${'█'.repeat(filled)}${'░'.repeat(width - filled)} ${Math.round(pct * 100)}%`;
  };

  return (
    <Box flexDirection="column" paddingLeft={1}>
      <Box marginBottom={1}>
        <Text bold color={colors.accent}>gui</Text>
        <Text color={colors.textSecondary}>  analyzing {repoName}</Text>
      </Box>

      {fileCount > 0 && (
        <Box marginLeft={2} marginBottom={1}>
          <Text color={colors.textTertiary}>{fileCount} files ({framework})</Text>
        </Box>
      )}

      <Box flexDirection="column" marginLeft={2}>
        <Box>
          <Text color={stage === 'reading' ? colors.amber : colors.green}>
            {stage === 'reading' ? '○' : symbols.check}
          </Text>
          <Text color={colors.textSecondary}> Reading files</Text>
          {stage === 'reading' && <Text color={colors.amber}> <Spinner type="dots" /></Text>}
        </Box>

        <Box>
          <Text color={stage === 'classifying' ? colors.amber : stage === 'reading' ? colors.textTertiary : colors.green}>
            {['analyzing', 'synthesizing', 'complete'].includes(stage) ? symbols.check : '○'}
          </Text>
          <Text color={colors.textSecondary}> Classifying</Text>
          {stage === 'classifying' && <Text color={colors.amber}> <Spinner type="dots" /></Text>}
        </Box>

        <Box flexDirection="column">
          <Box>
            <Text color={stage === 'analyzing' ? colors.amber : ['synthesizing', 'complete'].includes(stage) ? colors.green : colors.textTertiary}>
              {['synthesizing', 'complete'].includes(stage) ? symbols.check : '○'}
            </Text>
            <Text color={colors.textSecondary}> Analyzing</Text>
            {stage === 'analyzing' && <Text color={colors.amber}> <Spinner type="dots" /></Text>}
          </Box>
          {stage === 'analyzing' && progress.total > 0 && (
            <Box marginLeft={4}>
              <Text color={colors.textTertiary}>
                {progressBar()} ({progress.current}/{progress.total})
                {progress.file ? ` ${progress.file}` : ''}
              </Text>
            </Box>
          )}
        </Box>

        <Box>
          <Text color={stage === 'synthesizing' ? colors.amber : stage === 'complete' ? colors.green : colors.textTertiary}>
            {stage === 'complete' ? symbols.check : '○'}
          </Text>
          <Text color={colors.textSecondary}> Synthesizing</Text>
          {stage === 'synthesizing' && <Text color={colors.amber}> <Spinner type="dots" /></Text>}
        </Box>

        {stage === 'complete' && (
          <Box marginTop={1}>
            <Text color={colors.green} bold>{symbols.check} Analysis complete</Text>
          </Box>
        )}

        {stage === 'error' && (
          <Box marginTop={1}>
            <Text color={colors.rose}>Error: {error}</Text>
          </Box>
        )}
      </Box>
    </Box>
  );
}
