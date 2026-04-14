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
import CuratedLibrary from './CuratedLibrary';
import AppPreviewScreen from './AppPreviewScreen';
import ComprehensionProfile from './ComprehensionProfile';
import RepoSelectScreen from './RepoSelectScreen';
import MyProjects from './MyProjects';

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

      if (session?.user) {
        posthog.identify(session.user.id, { email: session.user.email });
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (_event === 'SIGNED_IN' && session?.user) {
        posthog.identify(session.user.id, { email: session.user.email });
        posthog.capture('user_signed_in');
      }
      if (_event === 'SIGNED_OUT') {
        posthog.capture('user_signed_out');
        posthog.reset();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Scrollable pages vs fixed-viewport
  useEffect(() => {
    const scrollableRoutes = ['/', '/upload', '/library', '/profile', '/overview', '/projects'];
    if (scrollableRoutes.includes(location.pathname)) {
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
        <Route path="/explorer" element={<ExplorerView />} />
        <Route path="/library" element={<CuratedLibrary />} />
        <Route path="/library/:id/preview" element={<AppPreviewScreen />} />
        <Route path="/profile" element={<ComprehensionProfile />} />
        <Route path="/repos" element={<RepoSelectScreen />} />
        <Route path="/projects" element={<MyProjects />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
