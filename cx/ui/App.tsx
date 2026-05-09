import React, { useState, useEffect } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import { Dashboard } from './Dashboard.js';
import { ChatView } from './ChatView.js';
import { HistoryView } from './HistoryView.js';
import { ProjectsView } from './ProjectsView.js';
import { CommandPalette } from './CommandPalette.js';
import { WelcomeView } from './WelcomeView.js';
import { AnalyzeView } from './AnalyzeView.js';
import { Footer } from './Footer.js';
import { getToken, getWebBase, clearCredentials } from '../lib/auth.js';
import { exec } from 'child_process';

export type View = 'dashboard' | 'chat' | 'history' | 'projects' | 'welcome' | 'analyze';

interface AppProps {
  projectId: string | null;
  repoName: string;
  token: string;
  needsAnalysis: boolean;
  repoDir: string;
  initialQuery?: string;
}

function openBrowser(url: string) {
  const cmd = process.platform === 'win32' ? `start "" "${url}"` : process.platform === 'darwin' ? `open "${url}"` : `xdg-open "${url}"`;
  exec(cmd);
}

export function App({ projectId, repoName, token, needsAnalysis, repoDir, initialQuery }: AppProps) {
  const { exit } = useApp();
  const [view, setView] = useState<View>(
    !token ? 'welcome' : !projectId && needsAnalysis ? 'analyze' : projectId ? 'dashboard' : 'welcome'
  );
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [currentProjectId, setCurrentProjectId] = useState(projectId);
  const [currentRepoName, setCurrentRepoName] = useState(repoName);
  const [currentToken, setCurrentToken] = useState(token);
  const [resumeSessionId, setResumeSessionId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Auto-start chat if initialQuery was provided
  useEffect(() => {
    if (initialQuery && currentProjectId && view === 'dashboard') {
      setResumeSessionId(null);
      setView('chat');
    }
  }, [currentProjectId]);

  useInput((input, key) => {
    if (showCommandPalette) return;
    if (view === 'chat') return;
    if (view === 'welcome') return;
    if (view === 'projects') return;

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
      openBrowser(url);
      showToast(`Opened in browser`);
      return;
    }
    if (input === 's' && currentProjectId) {
      const url = `${getWebBase()}/explore/${currentProjectId}`;
      showToast(`Share: ${url}`);
      return;
    }
    if (input === 'h' && currentProjectId) {
      setView('history');
      return;
    }
    if (input === 'p') {
      setView('projects');
      return;
    }
    if (input === 'r' && currentProjectId) {
      setView('analyze');
      return;
    }
    if (key.escape && view !== 'dashboard') {
      setView('dashboard');
      return;
    }
  });

  function showToast(message: string) {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  }

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
      case 'projects': setView('projects'); break;
      case 'open':
        if (currentProjectId) {
          openBrowser(`${getWebBase()}/explore/${currentProjectId}`);
          showToast('Opened in browser');
        }
        break;
      case 'share':
        if (currentProjectId) {
          showToast(`Share: ${getWebBase()}/explore/${currentProjectId}`);
        }
        break;
      case 'logout':
        clearCredentials();
        setCurrentToken('');
        setCurrentProjectId(null);
        setView('welcome');
        break;
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

  const handleSwitchProject = (newProjectId: string, newRepoName: string) => {
    setCurrentProjectId(newProjectId);
    setCurrentRepoName(newRepoName);
    setView('dashboard');
  };

  const footerHints = getFooterHints(view);

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
          repoName={currentRepoName}
          token={currentToken}
          onComplete={handleAnalyzeComplete}
        />
      )}

      {!showCommandPalette && view === 'dashboard' && currentProjectId && (
        <Dashboard
          projectId={currentProjectId}
          repoName={currentRepoName}
          token={currentToken}
          onStartChat={() => { setResumeSessionId(null); setView('chat'); }}
          onResumeSession={handleResumeSession}
          toast={toast}
        />
      )}

      {!showCommandPalette && view === 'chat' && currentProjectId && (
        <ChatView
          projectId={currentProjectId}
          repoName={currentRepoName}
          token={currentToken}
          sessionId={resumeSessionId}
          onBack={() => setView('dashboard')}
          repoDir={repoDir}
          initialQuery={!resumeSessionId ? initialQuery : undefined}
        />
      )}

      {!showCommandPalette && view === 'history' && currentProjectId && (
        <HistoryView
          projectId={currentProjectId}
          repoName={currentRepoName}
          token={currentToken}
          onBack={() => setView('dashboard')}
          onResumeSession={handleResumeSession}
        />
      )}

      {!showCommandPalette && view === 'projects' && (
        <ProjectsView
          currentProjectId={currentProjectId}
          token={currentToken}
          onBack={() => setView('dashboard')}
          onSwitch={handleSwitchProject}
        />
      )}

      {!showCommandPalette && view !== 'welcome' && view !== 'analyze' && (
        <Footer hints={footerHints} />
      )}
    </Box>
  );
}

function getFooterHints(view: View): Array<{ key: string; label: string }> {
  switch (view) {
    case 'dashboard':
      return [
        { key: 'c', label: 'chat' },
        { key: 'o', label: 'open' },
        { key: 's', label: 'share' },
        { key: 'p', label: 'projects' },
        { key: 'r', label: 'rerun' },
        { key: 'h', label: 'history' },
        { key: '/', label: 'commands' },
        { key: 'q', label: 'quit' },
      ];
    case 'chat':
      return [
        { key: 'Esc', label: 'back' },
      ];
    case 'history':
      return [
        { key: 'Enter', label: 'resume' },
        { key: 'Esc', label: 'back' },
      ];
    case 'projects':
      return [
        { key: 'Enter', label: 'switch' },
        { key: 'Esc', label: 'back' },
      ];
    default:
      return [];
  }
}
