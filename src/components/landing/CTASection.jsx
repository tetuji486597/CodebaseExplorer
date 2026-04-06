import { motion } from 'framer-motion';
import AnimatedSection from './AnimatedSection';
import { supabase } from '../../lib/supabase';

const GITHUB_ICON_PATH = 'M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z';

export default function CTASection({ onGetStarted }) {
  return (
    <AnimatedSection style={{
      padding: '6rem 2rem', textAlign: 'center', position: 'relative',
      background: 'linear-gradient(180deg, rgba(6,182,212,.04) 0%, transparent 100%)',
    }}>
      <h2 style={{
        fontSize: 'clamp(1.8rem, 5vw, 2.5rem)', fontWeight: 700,
        marginBottom: '1rem', color: '#f8fafc',
      }}>
        Ready to see how real software is built?
      </h2>
      <p style={{
        color: '#94a3b8', fontSize: '1.05rem', marginBottom: '2.5rem',
        maxWidth: 500, margin: '0 auto 2.5rem',
      }}>
        Join thousands of CS students learning architecture by exploring real codebases.
      </p>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}
      >
        <button onClick={onGetStarted} className="lp-btn-primary">Get started free</button>
        <button onClick={async () => {
          await supabase.auth.signInWithOAuth({
            provider: 'github',
            options: {
              scopes: 'repo read:user',
              redirectTo: window.location.origin,
            },
          });
        }} className="lp-btn-secondary" style={{ cursor: 'pointer' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d={GITHUB_ICON_PATH}/></svg>
          Sign in with GitHub
        </button>
      </motion.div>
    </AnimatedSection>
  );
}
