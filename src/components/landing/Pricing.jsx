import { motion } from 'framer-motion';
import AnimatedSection from './AnimatedSection';

const tiers = [
  {
    name: 'Student', tagline: 'For class projects and learning', price: 'Free', priceNote: null,
    features: ['5 codebases/month', 'Concept map + files view', 'Ask Claude (10 questions/day)', 'Community support'],
    cta: 'Get started free', primary: false,
  },
  {
    name: 'Pro', tagline: 'For power learners and TAs', price: '$12', priceNote: '/month',
    features: ['Unlimited codebases', 'Full AI analysis', 'Unlimited Claude chat', 'Priority support', 'Team sharing (coming soon)'],
    cta: 'Start free trial', primary: true,
  },
];

export default function Pricing({ onGetStarted }) {
  return (
    <AnimatedSection id="lp-pricing" style={{ padding: '6rem 2rem', maxWidth: 1280, margin: '0 auto' }}>
      <h2 style={{
        fontSize: 'clamp(1.8rem, 5vw, 2.5rem)', fontWeight: 700,
        textAlign: 'center', marginBottom: '3.5rem', color: '#f8fafc',
      }}>
        Simple pricing
      </h2>
      <div className="lp-pricing-grid" style={{
        display: 'grid', gridTemplateColumns: 'repeat(2,1fr)',
        gap: '1.5rem', maxWidth: 700, margin: '0 auto',
      }}>
        {tiers.map((tier, i) => (
          <motion.div
            key={i}
            whileHover={{ y: -4 }}
            transition={{ duration: 0.2 }}
            style={{
              background: 'rgba(20,20,24,.6)', borderRadius: 16, padding: '2.5rem',
              border: tier.primary ? '1.5px solid rgba(6,182,212,.3)' : '1px solid rgba(255,255,255,.06)',
              display: 'flex', flexDirection: 'column',
              boxShadow: tier.primary ? '0 0 40px rgba(6,182,212,.1)' : 'none',
            }}
          >
            <div style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '.25rem', color: '#f8fafc' }}>{tier.name}</div>
            <div style={{ color: '#64748b', fontSize: '.85rem', marginBottom: '1.5rem' }}>{tier.tagline}</div>
            <div style={{ fontSize: '2.5rem', fontWeight: 700, marginBottom: '2rem', color: '#f8fafc' }}>
              {tier.price}
              {tier.priceNote && <span style={{ fontSize: '.9rem', fontWeight: 400, color: '#64748b' }}>{tier.priceNote}</span>}
            </div>
            <ul style={{ listStyle: 'none', padding: 0, flex: 1, marginBottom: '2rem' }}>
              {tier.features.map((f, j) => (
                <li key={j} style={{
                  color: '#94a3b8', fontSize: '.9rem', padding: '.5rem 0',
                  borderBottom: '1px solid rgba(255,255,255,.06)',
                  display: 'flex', alignItems: 'center', gap: '.5rem',
                }}>
                  <span style={{ color: '#06b6d4' }}>✓</span> {f}
                </li>
              ))}
            </ul>
            <button onClick={onGetStarted} className={tier.primary ? 'lp-btn-primary' : 'lp-btn-secondary'}
              style={{ width: '100%', justifyContent: 'center' }}>
              {tier.cta}
            </button>
          </motion.div>
        ))}
      </div>
      <style>{`@media(max-width:900px){.lp-pricing-grid{grid-template-columns:1fr!important}}`}</style>
    </AnimatedSection>
  );
}
