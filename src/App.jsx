import { useEffect } from 'react';
import useStore from './store/useStore';
import LandingPage from './components/LandingPage';
import UploadScreen from './components/UploadScreen';
import ProcessingScreen from './components/ProcessingScreen';
import ExplorerView from './components/ExplorerView';

export default function App() {
  const screen = useStore(state => state.screen);

  // Landing page needs to scroll; all other screens are fixed-viewport
  useEffect(() => {
    if (screen === 'landing') {
      document.body.classList.remove('no-scroll');
    } else {
      document.body.classList.add('no-scroll');
    }
    return () => document.body.classList.remove('no-scroll');
  }, [screen]);

  return (
    <div className="w-full h-full" style={{ background: '#0a0a1a', color: '#e2e8f0' }}>
      {screen === 'landing' && <LandingPage />}
      {screen === 'upload' && <UploadScreen />}
      {screen === 'processing' && <ProcessingScreen />}
      {screen === 'explorer' && <ExplorerView />}
    </div>
  );
}
