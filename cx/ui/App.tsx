import React, { useState } from 'react';
import { Box, useApp, useInput } from 'ink';
import { Dashboard } from './Dashboard.js';
import { ChatView } from './ChatView.js';
import { HistoryView } from './HistoryView.js';
import { CommandPalette } from './CommandPalette.js';
import { WelcomeView } from './WelcomeView.js';
import { AnalyzeView } from './AnalyzeView.js';
import { getToken, getWebBase } from '../lib/auth.js';
import { exec } from 'child_process';

export type View = 'dashboard' | 'chat' | 'history' | 'welcome' | 'analyze';

interface AppProps {
  projectId: string | null;
  repoName: string;
  token: string;
  needsAnalysis: boolean;
  repoDir: string;
}

export function App({ projectId, repoName, token, needsAnalysis, repoDir }: AppProps) {
  const { exit } = useApp();
  const [view, setView] = useState<View>(
    !token ? 'welcome' : !projectId && needsAnalysis ? 'analyze' : projectId ? 'dashboard' : 'welcome'
  );
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [currentProjectId, setCurrentProjectId] = useState(projectId);
  const [currentToken, setCurrentToken] = useState(token);
  const [resumeSessionId, setResumeSessionId] = useState<string | null>(null);

  useInput((input, key) => {
    if (showCommandPalette) return;
    if (view === 'chat') return;
    if (view === 'welcome') return;

    if (input === 'q') {
      exit();
      return;
    }
    if (input === '/') {
      setShowCommandPalette(true);
      return;
    }
    if ((input === 'c' || input === 'n') && currentProjectId) {
      setResumeSessionId(null);
      setView('chat');
      return;
    }
    if (input === 'o' && currentProjectId) {
      const url = `${getWebBase()}/explore/${currentProjectId}`;
      const cmd = process.platform === 'win32' ? `start "" "${url}"` : process.platform === 'darwin' ? `open "${url}"` : `xdg-open "${url}"`;
      exec(cmd);
      return;
    }
    if (input === 'h' && currentProjectId) {
      setView('history');
      return;
    }
    if (key.escape && view !== 'dashboard') {
      setView('dashboard');
      return;
    }
  });

  const handleLoggedIn = async () => {
    const newToken = await getToken();
    if (newToken) {
      setCurrentToken(newToken);
      setView(needsAnalysis ? 'analyze' : 'dashboard');
    }
  };

  const handleCommand = (cmd: string) => {
    setShowCommandPalette(false);
    switch (cmd) {
      case 'chat': setResumeSessionId(null); setView('chat'); break;
      case 'history': setView('history'); break;
      case 'analyze': setView('analyze'); break;
      case 'quit': exit(); break;
      default: break;
    }
  };

  const handleAnalyzeComplete = (newProjectId: string) => {
    setCurrentProjectId(newProjectId);
    setView('dashboard');
  };

  const handleResumeSession = (sessionId: string) => {
    setResumeSessionId(sessionId);
    setView('chat');
  };

  return (
    <Box flexDirection="column">
      {showCommandPalette && (
        <CommandPalette
          onSelect={handleCommand}
          onClose={() => setShowCommandPalette(false)}
        />
      )}

      {!showCommandPalette && view === 'welcome' && (
        <WelcomeView onLoggedIn={handleLoggedIn} />
      )}

      {!showCommandPalette && view === 'analyze' && (
        <AnalyzeView
          repoDir={repoDir}
          repoName={repoName}
          token={currentToken}
          onComplete={handleAnalyzeComplete}
        />
      )}

      {!showCommandPalette && view === 'dashboard' && currentProjectId && (
        <Dashboard
          projectId={currentProjectId}
          repoName={repoName}
          token={currentToken}
          onStartChat={() => { setResumeSessionId(null); setView('chat'); }}
          onResumeSession={handleResumeSession}
        />
      )}

      {!showCommandPalette && view === 'chat' && currentProjectId && (
        <ChatView
          projectId={currentProjectId}
          repoName={repoName}
          token={currentToken}
          sessionId={resumeSessionId}
          onBack={() => setView('dashboard')}
          repoDir={repoDir}
        />
      )}

      {!showCommandPalette && view === 'history' && currentProjectId && (
        <HistoryView
          projectId={currentProjectId}
          repoName={repoName}
          token={currentToken}
          onBack={() => setView('dashboard')}
          onResumeSession={handleResumeSession}
        />
      )}
    </Box>
  );
}
