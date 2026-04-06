import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import useStore from '../../store/useStore';

const GITHUB_ICON_PATH = 'M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z';

const NAV_LINKS = [
  { label: 'Features', id: 'lp-features' },
  { label: 'How It Works', id: 'lp-how' },
  { label: 'Pricing', id: 'lp-pricing' },
];

const handleGitHubSignIn = async () => {
  await supabase.auth.signInWithOAuth({
    provider: 'github',
    options: {
      scopes: 'repo read:user',
      redirectTo: window.location.origin,
    },
  });
};

export default function NavBar({ onGetStarted, scrolled }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const user = useStore(state => state.user);
  const signOut = useStore(state => state.signOut);
  const navigate = useNavigate();

  const scrollTo = useCallback((id) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
    setMobileOpen(false);
  }, []);

  return (
    <nav style={{
      position: 'fixed', top: 0, left: 0, right: 0, height: 56, zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 2rem',
      backdropFilter: scrolled ? 'blur(16px)' : 'none',
      WebkitBackdropFilter: scrolled ? 'blur(16px)' : 'none',
      background: scrolled ? 'rgba(10,10,15,.7)' : 'transparent',
      borderBottom: scrolled ? '1px solid rgba(255,255,255,.06)' : '1px solid transparent',
      transition: 'all .3s ease',
    }}>
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', fontSize: '1.1rem', fontWeight: 600, color: '#f8fafc' }}>
        <span>🧭</span><span>Codebase Explorer</span>
      </div>

      {/* Desktop links */}
      <div className="lp-nav-desktop" style={{ display: 'flex', gap: '2.5rem', alignItems: 'center' }}>
        {NAV_LINKS.map(link => (
          <a key={link.id} href={`#${link.id}`}
            onClick={e => { e.preventDefault(); scrollTo(link.id); }}
            style={{
              color: '#94a3b8', textDecoration: 'none', fontSize: '.95rem',
              transition: 'color .3s',
            }}
            onMouseEnter={e => e.currentTarget.style.color = '#06b6d4'}
            onMouseLeave={e => e.currentTarget.style.color = '#94a3b8'}
          >{link.label}</a>
        ))}
      </div>

      {/* Right side */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem' }}>
        {user ? (
          <>
            <button onClick={() => navigate('/repos')} style={{
              display: 'flex', alignItems: 'center', gap: '.5rem',
              background: 'rgba(6,182,212,.1)', color: '#06b6d4',
              border: '1px solid rgba(6,182,212,.2)',
              padding: '.5rem 1rem', borderRadius: 6, fontSize: '.9rem',
              fontWeight: 500, cursor: 'pointer', transition: 'all .3s',
            }}>
              <img src={user.user_metadata?.avatar_url} alt="" style={{ width: 20, height: 20, borderRadius: '50%' }} />
              My Repos
            </button>
            <button onClick={() => { signOut(); navigate('/'); }} style={{
              background: 'none', color: '#94a3b8', border: 'none',
              fontSize: '.85rem', cursor: 'pointer', padding: '.5rem',
            }}>Sign out</button>
          </>
        ) : (
          <button onClick={handleGitHubSignIn} style={{
            display: 'flex', alignItems: 'center', gap: '.5rem',
            background: 'rgba(255,255,255,.05)', color: '#f8fafc',
            border: '1px solid rgba(255,255,255,.08)',
            padding: '.5rem 1rem', borderRadius: 6, fontSize: '.9rem',
            fontWeight: 500, cursor: 'pointer', transition: 'all .3s',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = '#06b6d4'; e.currentTarget.style.color = '#06b6d4'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,.08)'; e.currentTarget.style.color = '#f8fafc'; }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d={GITHUB_ICON_PATH}/></svg>
            Sign in
          </button>
        )}

        {/* Hamburger (mobile) */}
        <button className="lp-hamburger" onClick={() => setMobileOpen(!mobileOpen)} style={{
          display: 'none', flexDirection: 'column', gap: 4, cursor: 'pointer',
          background: 'none', border: 'none', padding: 4,
        }}>
          {[0,1,2].map(i => <span key={i} style={{ width: 22, height: 2, background: '#f8fafc', borderRadius: 1 }} />)}
        </button>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            style={{
              position: 'absolute', top: 56, left: 0, right: 0,
              background: 'rgba(10,10,15,.95)', backdropFilter: 'blur(16px)',
              padding: '1rem 2rem', display: 'flex', flexDirection: 'column', gap: '1rem',
              borderBottom: '1px solid rgba(255,255,255,.06)',
            }}
          >
            {NAV_LINKS.map(link => (
              <a key={link.id} href={`#${link.id}`}
                onClick={e => { e.preventDefault(); scrollTo(link.id); }}
                style={{ color: '#94a3b8', textDecoration: 'none', fontSize: '.95rem' }}
              >{link.label}</a>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        @media(max-width:900px){
          .lp-nav-desktop{display:none!important}
          .lp-hamburger{display:flex!important}
        }
      `}</style>
    </nav>
  );
}
