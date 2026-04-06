import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router';
import NavBar from './NavBar';
import HeroSection from './HeroSection';
import TrustBar from './TrustBar';
import FeaturesSection from './FeaturesSection';
import HowItWorks from './HowItWorks';
import Testimonials from './Testimonials';
import Pricing from './Pricing';
import CTASection from './CTASection';
import Footer from './Footer';

export default function LandingPage() {
  const navigate = useNavigate();
  const containerRef = useRef(null);
  const [navScrolled, setNavScrolled] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);

  const goToApp = useCallback(() => navigate('/upload'), [navigate]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onScroll = () => {
      setNavScrolled(el.scrollTop > 10);
      setScrollProgress(Math.min(el.scrollTop / window.innerHeight, 1));
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%', height: '100%', overflowY: 'auto', overflowX: 'hidden',
        background: 'linear-gradient(180deg, #0a0a0f 0%, #0d1117 50%, #0a0a0f 100%)',
        color: '#f8fafc',
        fontFamily: "'JetBrains Mono','Fira Code',monospace",
        lineHeight: 1.6,
      }}
    >
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />

      {/* Global button styles */}
      <style>{`
        .lp-btn-primary {
          padding: .875rem 2rem; border-radius: 50px; font-weight: 600; font-size: .95rem;
          border: none; cursor: pointer; display: inline-flex; align-items: center; gap: .5rem;
          font-family: inherit; background: linear-gradient(135deg, #06b6d4, #0891b2);
          color: #0a0a0f; transition: all .3s ease; box-shadow: 0 0 20px rgba(6,182,212,0.2);
        }
        .lp-btn-primary:hover { box-shadow: 0 0 30px rgba(6,182,212,0.4); transform: translateY(-1px); }
        .lp-btn-primary:active { transform: scale(.97); }
        .lp-btn-secondary {
          padding: .875rem 2rem; border-radius: 50px; font-weight: 600; font-size: .95rem;
          border: 1.5px solid rgba(255,255,255,.1); cursor: pointer; display: inline-flex;
          align-items: center; gap: .5rem; font-family: inherit; background: transparent;
          color: #f8fafc; transition: all .3s ease;
        }
        .lp-btn-secondary:hover { border-color: rgba(6,182,212,.4); color: #06b6d4; }
        .lp-btn-secondary:active { transform: scale(.97); }
      `}</style>

      <NavBar onGetStarted={goToApp} scrolled={navScrolled} />
      <HeroSection onGetStarted={goToApp} scrollProgress={scrollProgress} />
      <TrustBar />
      <FeaturesSection />
      <HowItWorks />
      <Testimonials />
      <Pricing onGetStarted={goToApp} />
      <CTASection onGetStarted={goToApp} />
      <Footer />
    </div>
  );
}
