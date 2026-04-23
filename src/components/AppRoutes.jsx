import { useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router';
import { usePostHog } from '@posthog/react';
import useStore from '../store/useStore';
import { supabase } from '../lib/supabase';
import LandingPage from './LandingPage';

import UploadScreen from './UploadScreen';
import ProcessingScreen from './ProcessingScreen';
import BigPictureScreen from './BigPictureScreen';
import ExplorerView from './ExplorerView';
import ComprehensionProfile from './ComprehensionProfile';
import SettingsScreen from './SettingsScreen';
import MyProjects from './MyProjects';
import SharedViewer from './shared-viewer/SharedViewer';
import CLIAuth from './CLIAuth';
import AdminDashboard from './AdminDashboard';
import DocsPage from './docs/DocsPage';
import TextSelectionToolbar from './TextSelectionToolbar';

function ExplorerRedirect() {
  const pid = useStore(state => state.projectId) || localStorage.getItem('cbe_project_id');
  return pid ? <Navigate to={`/explore/${pid}`} replace /> : <Navigate to="/" replace />;
}

const ADMIN_EMAIL = 'gordonj2016@outlook.com';

function AdminGate({ children }) {
  const user = useStore(state => state.user);
  if (!user || user.email !== ADMIN_EMAIL) return <Navigate to="/" replace />;
  return children;
}

export default function AppRoutes() {
  const navigate = useNavigate();
  const location = useLocation();
  const setUser = useStore(state => state.setUser);
  const setSession = useStore(state => state.setSession);
  const setAuthLoading = useStore(state => state.setAuthLoading);
  const darkMode = useStore(state => state.darkMode);
  const posthog = usePostHog();

  // Sync darkMode to <html data-theme>
  useEffect(() => {
    const el = document.documentElement;
    el.dataset.theme = darkMode ? 'dark' : 'light';
    // Remove legacy 'dark' class from tailwind dark selector
    el.classList.toggle('dark', darkMode);
  }, [darkMode]);

  // Initialize auth session
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setAuthLoading(false);

      if (session?.provider_token) {
        localStorage.setItem('cbe_github_token', session.provider_token);
      }
      if (session?.user) {
        posthog.identify(session.user.id, { email: session.user.email });
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.provider_token) {
        localStorage.setItem('cbe_github_token', session.provider_token);
      }
      if (_event === 'SIGNED_IN' && session?.user) {
        posthog.identify(session.user.id, { email: session.user.email });
        posthog.capture('user_signed_in');
      }
      if (_event === 'SIGNED_OUT') {
        localStorage.removeItem('cbe_github_token');
        posthog.capture('user_signed_out');
        posthog.reset();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Scrollable pages vs fixed-viewport
  useEffect(() => {
    const scrollableRoutes = ['/', '/upload', '/profile', '/overview', '/projects', '/settings', '/admin', '/docs'];
    const isScrollable = scrollableRoutes.includes(location.pathname) && !location.pathname.startsWith('/explore/');
    if (isScrollable) {
      document.body.classList.remove('no-scroll');
    } else {
      document.body.classList.add('no-scroll');
    }
    return () => document.body.classList.remove('no-scroll');
  }, [location.pathname]);

  return (
    <div className="w-full h-full" style={{ background: 'var(--color-bg-base)', color: 'var(--color-text-primary)' }}>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/upload" element={<UploadScreen />} />
        <Route path="/processing" element={<ProcessingScreen />} />
        <Route path="/overview" element={<BigPictureScreen />} />
        <Route path="/explorer" element={<ExplorerRedirect />} />
        <Route path="/explore/:id" element={<ExplorerView />} />
        <Route path="/profile" element={<ComprehensionProfile />} />
        <Route path="/settings" element={<SettingsScreen />} />
        <Route path="/projects" element={<MyProjects />} />
        <Route path="/s/:id" element={<SharedViewer />} />
        <Route path="/cli-auth" element={<CLIAuth />} />
        <Route path="/admin" element={<AdminGate><AdminDashboard /></AdminGate>} />
        <Route path="/docs" element={<DocsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <TextSelectionToolbar />
    </div>
  );
}
