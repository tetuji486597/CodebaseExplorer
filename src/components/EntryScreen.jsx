import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Upload, BookOpen, Sparkles, User, Bot, Users } from 'lucide-react';

const ORIGIN_OPTIONS = [
  { value: 'self_built', label: 'I built it myself', Icon: User, color: 'var(--color-success)' },
  { value: 'ai_built', label: 'AI built most of it', Icon: Bot, color: 'var(--color-accent)' },
  { value: 'someone_else', label: 'Someone else built it', Icon: Users, color: 'var(--color-warning)' },
];

export default function EntryScreen() {
  const navigate = useNavigate();
  const [originContext, setOriginContext] = useState(null);

  return (
    <div
      className="w-full min-h-full flex flex-col items-center justify-center relative overflow-hidden px-4 py-12"
      style={{ background: 'var(--color-bg-base)' }}
    >
      {/* Background orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute w-96 h-96 rounded-full opacity-[0.07] blur-3xl"
          style={{
            background: 'radial-gradient(circle, #6366f1 0%, transparent 70%)',
            top: '5%', left: '10%',
            animation: 'float 8s ease-in-out infinite',
          }}
        />
        <div
          className="absolute w-80 h-80 rounded-full opacity-[0.07] blur-3xl"
          style={{
            background: 'radial-gradient(circle, #10b981 0%, transparent 70%)',
            bottom: '10%', right: '15%',
            animation: 'float 10s ease-in-out infinite 2s',
          }}
        />
      </div>

      {/* Logo */}
      <div className="mb-10 text-center z-10" style={{ animation: 'fade-in 0.6s ease-out' }}>
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-3">
          <circle cx="12" cy="12" r="10"/>
          <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>
        </svg>
        <h1 className="text-2xl font-semibold tracking-tight font-heading" style={{ color: 'var(--color-text-primary)' }}>
          Codebase Explorer
        </h1>
        <p className="text-sm mt-2 max-w-xs mx-auto" style={{ color: 'var(--color-text-tertiary)' }}>
          Understand software architecture by exploring real code
        </p>
      </div>

      {/* Two paths */}
      <div className="z-10 w-full max-w-2xl grid grid-cols-1 md:grid-cols-2 gap-4" style={{ animation: 'fade-in 0.8s ease-out 0.2s both' }}>
        {/* Path 1: Upload */}
        <button
          onClick={() => navigate('/upload', { state: { originContext } })}
          className="group rounded-2xl p-6 text-left transition-all duration-300 active:scale-[0.98]"
          style={{
            background: 'var(--color-bg-surface)',
            border: '1px solid var(--color-border-subtle)',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.borderColor = 'var(--color-border-strong)';
            e.currentTarget.style.boxShadow = '0 0 30px var(--color-accent-soft)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = 'var(--color-border-subtle)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
            style={{ background: 'var(--color-accent-soft)', border: '1px solid var(--color-accent-soft)' }}
          >
            <Upload size={22} style={{ color: 'var(--color-accent)' }} />
          </div>
          <h2 className="text-lg font-semibold mb-1.5 font-heading" style={{ color: 'var(--color-text-primary)' }}>
            Understand my codebase
          </h2>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
            Upload a .zip of your project and get an interactive architecture map with AI-powered explanations
          </p>
        </button>

        {/* Path 2: Learn */}
        <button
          onClick={() => navigate('/library')}
          className="group rounded-2xl p-6 text-left transition-all duration-300 active:scale-[0.98]"
          style={{
            background: 'var(--color-bg-surface)',
            border: '1px solid var(--color-border-subtle)',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.3)';
            e.currentTarget.style.boxShadow = '0 0 30px rgba(16, 185, 129, 0.08)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = 'var(--color-border-subtle)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
            style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.15)' }}
          >
            <BookOpen size={22} style={{ color: 'var(--color-success)' }} />
          </div>
          <h2 className="text-lg font-semibold mb-1.5 font-heading" style={{ color: 'var(--color-text-primary)' }}>
            Learn by exploring
          </h2>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
            Explore curated open-source codebases to learn programming concepts step by step
          </p>
        </button>
      </div>

      {/* Origin context (upload path only) */}
      <div
        className="z-10 w-full max-w-2xl mt-6 rounded-2xl p-5"
        style={{
          background: 'var(--color-bg-surface)',
          border: '1px solid var(--color-border-subtle)',
          animation: 'fade-in 1s ease-out 0.4s both',
        }}
      >
        <p className="text-xs font-medium mb-3" style={{ color: 'var(--color-text-tertiary)' }}>
          For uploads — how did this codebase come to exist?
        </p>
        <div className="flex flex-wrap gap-2">
          {ORIGIN_OPTIONS.map(({ value, label, Icon, color }) => {
            const isActive = originContext === value;
            return (
              <button
                key={value}
                onClick={() => setOriginContext(isActive ? null : value)}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium transition-all duration-200 active:scale-95"
                style={{
                  background: isActive ? `${color}15` : 'var(--color-bg-sunken)',
                  color: isActive ? color : 'var(--color-text-tertiary)',
                  border: `1px solid ${isActive ? `${color}30` : 'var(--color-border-subtle)'}`,
                }}
              >
                <Icon size={14} />
                {label}
              </button>
            );
          })}
        </div>
        <p className="text-[11px] mt-2.5" style={{ color: 'var(--color-text-tertiary)' }}>
          This helps us calibrate explanations. Skip if you prefer.
        </p>
      </div>

      {/* Skill profile link */}
      <div className="z-10 mt-6" style={{ animation: 'fade-in 1.2s ease-out 0.6s both' }}>
        <button
          onClick={() => navigate('/profile')}
          className="flex items-center gap-2 text-xs font-medium transition-all duration-200"
          style={{ color: 'var(--color-text-tertiary)' }}
          onMouseEnter={e => e.currentTarget.style.color = 'var(--color-text-secondary)'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--color-text-tertiary)'}
        >
          <Sparkles size={13} />
          View your skill profile
        </button>
      </div>
    </div>
  );
}
