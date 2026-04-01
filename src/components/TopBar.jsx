import useStore from '../store/useStore';
import { Compass, FolderTree } from 'lucide-react';

export default function TopBar() {
  const { viewMode, setViewMode, concepts, exploredConcepts } = useStore();
  const exploredCount = exploredConcepts.size;
  const totalCount = concepts.length;

  return (
    <div
      className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-5 py-3"
      style={{
        background: 'rgba(10, 10, 26, 0.88)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
      }}
    >
      {/* Left: Title + Progress */}
      <div className="flex items-center gap-3">
        <span className="font-heading text-sm font-semibold tracking-tight" style={{ color: '#e2e8f0' }}>
          Codebase Explorer
        </span>
        {totalCount > 0 && (
          <div className="flex items-center gap-2">
            <span
              className="text-[11px] font-medium px-2 py-0.5 rounded-full"
              style={{
                background: 'rgba(99, 102, 241, 0.15)',
                color: '#a5b4fc',
                border: '1px solid rgba(99, 102, 241, 0.2)',
              }}
            >
              {totalCount} concepts
            </span>
            {exploredCount > 0 && (
              <span
                className="text-[11px] font-medium px-2 py-0.5 rounded-full flex items-center gap-1.5"
                style={{
                  background: 'rgba(16, 185, 129, 0.12)',
                  color: '#6ee7b7',
                  border: '1px solid rgba(16, 185, 129, 0.2)',
                }}
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M2 5L4.5 7.5L8 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                {exploredCount}/{totalCount} explored
              </span>
            )}
          </div>
        )}
      </div>

      {/* Center: Segmented Control */}
      <div
        className="flex rounded-xl overflow-hidden relative"
        style={{
          background: '#14142b',
          border: '1px solid rgba(255,255,255,0.06)',
          padding: '3px',
        }}
      >
        {/* Sliding highlight */}
        <div
          className="absolute top-[3px] rounded-lg transition-all duration-200 ease-out"
          style={{
            width: 'calc(50% - 3px)',
            height: 'calc(100% - 6px)',
            left: viewMode === 'concepts' ? '3px' : 'calc(50%)',
            background: 'rgba(99, 102, 241, 0.15)',
            border: '1px solid rgba(99, 102, 241, 0.2)',
          }}
        />
        <button
          onClick={() => setViewMode('concepts')}
          className="relative z-10 flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium transition-colors duration-200"
          style={{
            color: viewMode === 'concepts' ? '#a5b4fc' : '#64748b',
          }}
        >
          <Compass size={13} />
          Concepts
        </button>
        <button
          onClick={() => setViewMode('files')}
          className="relative z-10 flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium transition-colors duration-200"
          style={{
            color: viewMode === 'files' ? '#a5b4fc' : '#64748b',
          }}
        >
          <FolderTree size={13} />
          Files
        </button>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => useStore.getState().setScreen('upload')}
          className="text-xs font-medium px-3 py-1.5 rounded-lg transition-all duration-200 active:scale-95"
          style={{
            color: '#94a3b8',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.06)',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
            e.currentTarget.style.color = '#e2e8f0';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
            e.currentTarget.style.color = '#94a3b8';
          }}
        >
          New
        </button>
      </div>
    </div>
  );
}
