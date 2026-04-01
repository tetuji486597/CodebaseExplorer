const GITHUB_ICON_PATH = 'M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z';
const X_ICON_PATH = 'M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z';

export default function Footer() {
  return (
    <footer style={{
      padding: '3rem 2rem', borderTop: '1px solid rgba(255,255,255,.06)',
      maxWidth: 1280, margin: '0 auto',
    }}>
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))',
        gap: '2rem', marginBottom: '2rem',
      }}>
        <div>
          <div style={{ fontWeight: 600, marginBottom: '.5rem', color: '#f8fafc' }}>🧭 Codebase Explorer</div>
          <p style={{ color: '#64748b', fontSize: '.85rem' }}>Made for humans who don't speak code.</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '.4rem' }}>
          <div style={{ fontWeight: 600, marginBottom: '.25rem', fontSize: '.9rem', color: '#94a3b8' }}>Product</div>
          {['Features', 'How It Works', 'Pricing', 'Docs'].map(l => (
            <a key={l} href="#" style={{ color: '#64748b', textDecoration: 'none', fontSize: '.85rem', transition: 'color .2s' }}
               onMouseEnter={e => e.currentTarget.style.color = '#06b6d4'}
               onMouseLeave={e => e.currentTarget.style.color = '#64748b'}>{l}</a>
          ))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '.4rem' }}>
          <div style={{ fontWeight: 600, marginBottom: '.25rem', fontSize: '.9rem', color: '#94a3b8' }}>Company</div>
          {['Blog', 'About', 'Contact', 'Careers'].map(l => (
            <a key={l} href="#" style={{ color: '#64748b', textDecoration: 'none', fontSize: '.85rem', transition: 'color .2s' }}
               onMouseEnter={e => e.currentTarget.style.color = '#06b6d4'}
               onMouseLeave={e => e.currentTarget.style.color = '#64748b'}>{l}</a>
          ))}
        </div>
        <div>
          <div style={{ fontWeight: 600, marginBottom: '.5rem', fontSize: '.9rem', color: '#94a3b8' }}>Connect</div>
          <div style={{ display: 'flex', gap: '.75rem' }}>
            <a href="https://github.com" target="_blank" rel="noreferrer" style={{ color: '#64748b', transition: 'color .2s' }}
               onMouseEnter={e => e.currentTarget.style.color = '#f8fafc'} onMouseLeave={e => e.currentTarget.style.color = '#64748b'}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d={GITHUB_ICON_PATH}/></svg>
            </a>
            <a href="https://x.com" target="_blank" rel="noreferrer" style={{ color: '#64748b', transition: 'color .2s' }}
               onMouseEnter={e => e.currentTarget.style.color = '#f8fafc'} onMouseLeave={e => e.currentTarget.style.color = '#64748b'}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d={X_ICON_PATH}/></svg>
            </a>
          </div>
        </div>
      </div>
      <div style={{
        textAlign: 'center', color: '#475569', fontSize: '.8rem',
        paddingTop: '1.5rem', borderTop: '1px solid rgba(255,255,255,.06)',
      }}>
        © 2026 Codebase Explorer. All rights reserved.
      </div>
    </footer>
  );
}
