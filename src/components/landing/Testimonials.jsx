import { motion } from 'framer-motion';
import AnimatedSection, { staggerContainer, fadeUp } from './AnimatedSection';

const testimonials = [
  { q: "My data structures class taught me linked lists, but I had no idea how a real app organizes its code. This tool connected the dots between what I learned in class and how production software actually works.", name: 'Jason M.', role: 'CS Junior, UC San Diego', initials: 'JM', bg: '#06b6d4' },
  { q: "I use this with my Software Engineering students. They upload their group projects and can immediately see architectural issues I'd normally spend office hours explaining.", name: 'Dr. Amara L.', role: 'CS Professor', initials: 'AL', bg: '#8b5cf6' },
  { q: "I was trying to contribute to an open-source project but the codebase was huge. This showed me the overall architecture and I found where to make my first PR in like 15 minutes.", name: 'Kevin P.', role: 'CS Sophomore, Georgia Tech', initials: 'KP', bg: '#f59e0b' },
];

export default function Testimonials() {
  return (
    <AnimatedSection style={{ padding: '6rem 2rem', maxWidth: 1280, margin: '0 auto' }}>
      <h2 style={{
        fontSize: 'clamp(1.8rem, 5vw, 2.5rem)', fontWeight: 700,
        textAlign: 'center', marginBottom: '3.5rem', color: '#f8fafc',
      }}>
        What students and professors are saying
      </h2>
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: '-50px' }}
        style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))',
          gap: '1.5rem', maxWidth: 1000, margin: '0 auto',
        }}
      >
        {testimonials.map((t, i) => (
          <motion.div
            key={i}
            variants={fadeUp}
            whileHover={{ borderColor: 'rgba(6,182,212,0.3)', y: -2 }}
            transition={{ duration: 0.2 }}
            style={{
              background: 'rgba(20,20,24,.5)', backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255,255,255,.06)', borderRadius: 12, padding: '2rem',
            }}
          >
            <p style={{ fontStyle: 'italic', color: '#e2e8f0', lineHeight: 1.7, marginBottom: '1.5rem', fontSize: '.95rem' }}>
              &ldquo;{t.q}&rdquo;
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{
                width: 40, height: 40, borderRadius: '50%', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                fontWeight: 700, color: '#fff', fontSize: '.8rem', background: t.bg,
              }}>{t.initials}</div>
              <div>
                <div style={{ fontWeight: 600, fontSize: '.9rem', color: '#f8fafc' }}>{t.name}</div>
                <div style={{ color: '#64748b', fontSize: '.8rem' }}>{t.role}</div>
              </div>
            </div>
          </motion.div>
        ))}
      </motion.div>
    </AnimatedSection>
  );
}
