import { motion } from 'framer-motion';
import HeroGraph from './HeroGraph';

export default function HeroSection({ onGetStarted, scrollProgress }) {
  return (
    <section style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center',
      alignItems: 'center', position: 'relative', overflow: 'hidden', padding: '7rem 2rem 5rem',
    }}>
      {/* Interactive graph background */}
      <div style={{ position: 'absolute', inset: 0 }}>
        <HeroGraph scrollProgress={scrollProgress} />
      </div>

      {/* Dark gradient overlay for text readability */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse at center, rgba(10,10,15,0.3) 0%, rgba(10,10,15,0.7) 60%, rgba(10,10,15,0.92) 100%)',
      }} />

      {/* Bottom fade */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: '30%', pointerEvents: 'none',
        background: 'linear-gradient(to top, #0a0a0f 0%, transparent 100%)',
      }} />

      {/* Hero content */}
      <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', maxWidth: 850 }}>
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '.5rem',
            background: 'rgba(6,182,212,.08)', color: '#06b6d4',
            padding: '.5rem 1.25rem', borderRadius: 20, fontSize: '.85rem', fontWeight: 500,
            marginBottom: '2rem', border: '1px solid rgba(6,182,212,.2)',
          }}
        >
          <span style={{
            width: 8, height: 8, background: '#06b6d4', borderRadius: '50%',
            animation: 'pulse-scale 2s ease-in-out infinite',
          }} />
          Now in public beta
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.7 }}
          style={{
            fontSize: 'clamp(2.5rem, 8vw, 4.5rem)', fontWeight: 700, lineHeight: 1.08,
            marginBottom: '1.5rem', letterSpacing: '-.03em', color: '#f8fafc',
          }}
        >
          Understand any codebase{' '}
          <span style={{
            background: 'linear-gradient(135deg, #06b6d4, #8b5cf6)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>in minutes</span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.6 }}
          style={{ fontSize: '1.15rem', color: '#94a3b8', lineHeight: 1.7, marginBottom: '2.5rem' }}
        >
          Drop a zip file. Get a beautiful visual map of every concept, file, and connection.
          <br />Built for people who've never read a line of code.
        </motion.p>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.65, duration: 0.6 }}
          style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginBottom: '2rem', flexWrap: 'wrap' }}
        >
          <button onClick={onGetStarted} className="lp-btn-primary">
            Get started free
          </button>
          <button onClick={onGetStarted} className="lp-btn-secondary">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
            Watch demo
          </button>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8, duration: 0.6 }}
          style={{ fontSize: '.85rem', color: '#64748b' }}
        >
          No credit card required · Works with any language · <strong style={{ color: '#94a3b8' }}>Your code stays private</strong>
        </motion.p>
      </div>
    </section>
  );
}
