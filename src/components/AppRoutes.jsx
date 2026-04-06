import { useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router';
import useStore from '../store/useStore';
import { supabase } from '../lib/supabase';
import LandingPage from './LandingPage';
import EntryScreen from './EntryScreen';
import UploadScreen from './UploadScreen';
import ProcessingScreen from './ProcessingScreen';
import ExplorerView from './ExplorerView';
import CuratedLibrary from './CuratedLibrary';
import SkillProfile from './SkillProfile';
import RepoSelectScreen from './RepoSelectScreen';

export default function AppRoutes() {
  const navigate = useNavigate();
  const location = useLocation();
  const setUser = useStore(state => state.setUser);
  const setSession = useStore(state => state.setSession);
  const setAuthLoading = useStore(state => state.setAuthLoading);

  // Initialize auth session
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setAuthLoading(false);

      if (session?.provider_token && location.pathname === '/') {
        navigate('/repos', { replace: true });
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.provider_token && location.pathname === '/') {
        navigate('/repos', { replace: true });
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Scrollable pages vs fixed-viewport
  useEffect(() => {
    const scrollableRoutes = ['/', '/landing', '/library', '/profile'];
    if (scrollableRoutes.includes(location.pathname)) {
      document.body.classList.remove('no-scroll');
    } else {
      document.body.classList.add('no-scroll');
    }
    return () => document.body.classList.remove('no-scroll');
  }, [location.pathname]);

  return (
    <div className="w-full h-full" style={{ background: '#0a0a1a', color: '#e2e8f0' }}>
      <Routes>
        <Route path="/" element={<EntryScreen />} />
        <Route path="/landing" element={<LandingPage />} />
        <Route path="/upload" element={<UploadScreen />} />
        <Route path="/processing" element={<ProcessingScreen />} />
        <Route path="/explorer" element={<ExplorerView />} />
        <Route path="/library" element={<CuratedLibrary />} />
        <Route path="/profile" element={<SkillProfile />} />
        <Route path="/repos" element={<RepoSelectScreen />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
