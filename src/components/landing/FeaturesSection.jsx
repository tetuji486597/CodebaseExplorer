import { motion } from 'framer-motion';
import AnimatedSection, { staggerContainer, fadeUp } from './AnimatedSection';

const features = [
  { emoji: '🎨', title: 'Concept Map', desc: 'AI extracts 8-15 human-readable concepts from your codebase. Each becomes an interactive bubble with an emoji, plain-English label, and connections.', span: true, color: '#06b6d4' },
  { emoji: '📋', title: 'Files View', desc: 'Toggle to see every file, grouped by concept in soft colored clusters. See imports on tap.', color: '#8b5cf6' },
  { emoji: '💬', title: 'Ask Claude Anything', desc: 'Chat bar at the bottom. Ask any question about the codebase in plain English.', color: '#60a5fa' },
  { emoji: '🚶', title: 'Code Walkthrough', desc: "Tap 'Walk me through this file' for a split-screen with syntax highlighting + plain-English explanation.", color: '#f59e0b' },
  { emoji: '⚡', title: 'Zero Config', desc: "Drop a .zip. That's it. No CLI. No setup. Works with any language.", color: '#10b981' },
  { emoji: '🔐', title: 'Private & Secure', desc: 'Your code never leaves your browser unless you choose to analyze it with AI.', color: '#ec4899' },
];

export default function FeaturesSection() {
  return (
    <AnimatedSection id="lp-features" style={{ padding: '6rem 2rem', maxWidth: 1280, margin: '0 auto' }}>
      <h2 style={{
        fontSize: 'clamp(1.8rem, 5vw, 2.5rem)', fontWeight: 700,
        textAlign: 'center', marginBottom: '3rem', color: '#f8fafc',
      }}>
        Everything you need to understand code
      </h2>
      <motion.div
        className="lp-bento"
        variants={staggerContainer}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: '-50px' }}
        style={{
          display: 'grid', gridTemplateColumns: 'repeat(2,1fr)',
          gap: '1.25rem', maxWidth: 900, margin: '0 auto',
        }}
      >
        {features.map((f, i) => (
          <motion.div
            key={i}
            variants={fadeUp}
            whileHover={{
              y: -4,
              borderColor: f.color + '50',
              boxShadow: `0 8px 30px rgba(0,0,0,.3), 0 0 20px ${f.color}15`,
            }}
            transition={{ duration: 0.2 }}
            style={{
              background: 'rgba(20,20,24,.6)', borderRadius: 14, padding: '2rem',
              border: '1px solid rgba(255,255,255,.06)',
              gridColumn: f.span ? '1 / -1' : undefined,
              cursor: 'default',
            }}
          >
            <div style={{ fontSize: '1.8rem', marginBottom: '.75rem' }}>{f.emoji}</div>
            <h3 style={{ fontWeight: 600, marginBottom: '.5rem', fontSize: '1.05rem', color: '#f8fafc' }}>{f.title}</h3>
            <p style={{ color: '#94a3b8', fontSize: '.9rem', lineHeight: 1.6 }}>{f.desc}</p>
          </motion.div>
        ))}
      </motion.div>
      <style>{`@media(max-width:900px){.lp-bento{grid-template-columns:1fr!important}}`}</style>
    </AnimatedSection>
  );
}
