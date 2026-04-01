import { motion } from 'framer-motion';
import AnimatedSection, { staggerContainer, fadeUp } from './AnimatedSection';

const stats = [
  { icon: '📈', label: '10K+ codebases mapped' },
  { icon: '🌍', label: '50+ languages supported' },
  { icon: '⚡', label: '< 2 min to first insight' },
  { icon: '🔒', label: '100% browser-based' },
];

export default function TrustBar() {
  return (
    <AnimatedSection style={{
      padding: '3rem 2rem',
      background: 'rgba(15,15,20,.5)',
      borderTop: '1px solid rgba(255,255,255,.06)',
      borderBottom: '1px solid rgba(255,255,255,.06)',
    }}>
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true }}
        className="lp-trust-grid"
        style={{
          display: 'grid', gridTemplateColumns: 'repeat(4,1fr)',
          gap: '2rem', maxWidth: 900, margin: '0 auto', textAlign: 'center',
        }}
      >
        {stats.map((s, i) => (
          <motion.div key={i} variants={fadeUp}>
            <div style={{ fontSize: '1.5rem', marginBottom: '.5rem' }}>{s.icon}</div>
            <div style={{ fontSize: '.85rem', color: '#94a3b8', fontWeight: 500 }}>{s.label}</div>
          </motion.div>
        ))}
      </motion.div>
      <style>{`@media(max-width:640px){.lp-trust-grid{grid-template-columns:1fr 1fr!important}}`}</style>
    </AnimatedSection>
  );
}
