import { motion } from 'framer-motion';
import AnimatedSection, { staggerContainer, fadeUp } from './AnimatedSection';

const steps = [
  { num: '01', emoji: '📤', title: 'Upload', desc: 'Drop a .zip of any codebase. Or try our demo instantly.' },
  { num: '02', emoji: '✨', title: 'AI Analyzes', desc: 'Claude reads your code and extracts concepts, relationships, and plain-English descriptions.' },
  { num: '03', emoji: '🧭', title: 'Explore', desc: 'Interactive visual map. Tap any bubble. Ask any question. Understand everything.' },
];

export default function HowItWorks() {
  return (
    <AnimatedSection id="lp-how" style={{ padding: '6rem 2rem', maxWidth: 1280, margin: '0 auto' }}>
      <h2 style={{
        fontSize: 'clamp(1.8rem, 5vw, 2.5rem)', fontWeight: 700,
        textAlign: 'center', marginBottom: '3.5rem', color: '#f8fafc',
      }}>
        From zip file to clarity in 3 steps
      </h2>
      <motion.div
        className="lp-steps"
        variants={staggerContainer}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: '-50px' }}
        style={{ display: 'flex', gap: '2rem', maxWidth: 900, margin: '0 auto', position: 'relative' }}
      >
        {steps.map((s, i) => (
          <motion.div key={i} variants={fadeUp} style={{
            flex: 1, background: 'rgba(20,20,24,.6)', borderRadius: 14,
            padding: '2.5rem 2rem', border: '1px solid rgba(255,255,255,.06)',
            textAlign: 'center',
          }}>
            <div style={{
              width: 48, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(6,182,212,.1)', border: '2px solid #06b6d4', borderRadius: '50%',
              fontWeight: 700, color: '#06b6d4', margin: '0 auto 1.5rem', fontSize: '1.1rem',
              boxShadow: '0 0 15px rgba(6,182,212,0.2)',
            }}>{s.num}</div>
            <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>{s.emoji}</div>
            <h3 style={{ fontWeight: 600, marginBottom: '.75rem', fontSize: '1.1rem', color: '#f8fafc' }}>{s.title}</h3>
            <p style={{ color: '#94a3b8', fontSize: '.9rem', lineHeight: 1.6 }}>{s.desc}</p>
          </motion.div>
        ))}
      </motion.div>
      <style>{`@media(max-width:900px){.lp-steps{flex-direction:column!important}}`}</style>
    </AnimatedSection>
  );
}
