import { useRef, useEffect, useState, useCallback } from 'react';
import { Circle, Pause, Play, ExternalLink, Compass } from 'lucide-react';

/**
 * RrwebPlayer — wraps rrweb-player in a styled browser chrome frame.
 * Supports two modes:
 *   - 'rrweb': real rrweb recording playback
 *   - 'iframe': embedded deployed app URL (simpler, works immediately)
 *
 * Gracefully handles iframe load failures (X-Frame-Options, timeouts, etc).
 *
 * Props:
 *   mode: 'rrweb' | 'iframe'
 *   events: rrweb event array (for mode='rrweb')
 *   iframeUrl: deployed app URL (for mode='iframe')
 *   appName: display name in browser chrome
 *   appUrl: mock URL shown in address bar
 *   thumbnailUrl: static screenshot for loading state
 *   markers: [{ timestamp_ms, label }] for timeline dots
 *   onTimeUpdate: (currentTimeMs) => void
 *   onReady: () => void
 *   onError: () => void
 *   onSkipToExplorer: () => void
 */
export default function RrwebPlayer({
  mode = 'iframe',
  events = [],
  iframeUrl = '',
  appName = 'App',
  appUrl = 'localhost:3000',
  thumbnailUrl = '',
  markers = [],
  onTimeUpdate,
  onReady,
  onError,
  onSkipToExplorer,
}) {
  const containerRef = useRef(null);
  const playerRef = useRef(null);
  const iframeRef = useRef(null);
  const loadTimeoutRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loadFailed, setLoadFailed] = useState(false);

  // Iframe load timeout — if the iframe never fires onLoad within 10s,
  // assume it's blocked (X-Frame-Options, COEP, network error) and show fallback.
  useEffect(() => {
    if (mode !== 'iframe' || !iframeUrl) return;
    setLoadFailed(false);
    setLoading(true);
    loadTimeoutRef.current = setTimeout(() => {
      setLoadFailed(true);
      setLoading(false);
      onError?.();
    }, 10000);
    return () => {
      if (loadTimeoutRef.current) {
        clearTimeout(loadTimeoutRef.current);
        loadTimeoutRef.current = null;
      }
    };
  }, [mode, iframeUrl, onError]);

  // Initialize rrweb player
  useEffect(() => {
    if (mode !== 'rrweb' || !events.length || !containerRef.current) return;

    let player = null;

    const initPlayer = async () => {
      try {
        const rrwebPlayer = await import('rrweb-player');
        // rrweb-player CSS
        await import('rrweb-player/dist/style.css');

        const Player = rrwebPlayer.default || rrwebPlayer;

        player = new Player({
          target: containerRef.current,
          props: {
            events,
            width: containerRef.current.offsetWidth,
            height: containerRef.current.offsetHeight,
            showController: false,
            autoPlay: false,
            skipInactive: true,
            mouseTail: { strokeStyle: '#6366f1' },
          },
        });

        playerRef.current = player;

        // Get total duration
        const meta = player.getMetaData();
        if (meta) {
          setDuration(meta.totalTime || 0);
        }

        // Listen for time updates
        player.addEventListener('ui-update-current-time', (payload) => {
          const time = payload?.payload || 0;
          setCurrentTime(time);
          onTimeUpdate?.(time);
        });

        player.addEventListener('ui-update-player-state', (payload) => {
          setIsPlaying(payload?.payload === 'playing');
        });

        setLoading(false);
        onReady?.();
      } catch (err) {
        console.error('Failed to initialize rrweb player:', err);
        setLoading(false);
      }
    };

    initPlayer();

    return () => {
      if (player) {
        try { player.$destroy?.(); } catch {}
      }
      playerRef.current = null;
    };
  }, [mode, events]);

  // Handle iframe load
  const handleIframeLoad = useCallback(() => {
    if (loadTimeoutRef.current) {
      clearTimeout(loadTimeoutRef.current);
      loadTimeoutRef.current = null;
    }
    setLoading(false);
    setLoadFailed(false);
    onReady?.();
  }, [onReady]);

  const handleIframeError = useCallback(() => {
    if (loadTimeoutRef.current) {
      clearTimeout(loadTimeoutRef.current);
      loadTimeoutRef.current = null;
    }
    setLoading(false);
    setLoadFailed(true);
    onError?.();
  }, [onError]);

  const togglePlay = useCallback(() => {
    if (mode !== 'rrweb' || !playerRef.current) return;
    if (isPlaying) {
      playerRef.current.pause();
    } else {
      playerRef.current.play();
    }
    setIsPlaying(!isPlaying);
  }, [mode, isPlaying]);

  const formatTime = (ms) => {
    const secs = Math.floor(ms / 1000);
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--color-bg-surface)', borderRadius: 'var(--radius-md)' }}>
      {/* Browser chrome */}
      <div
        className="flex items-center gap-3 px-4 py-2.5 shrink-0"
        style={{
          background: 'var(--color-bg-elevated)',
          borderBottom: '1px solid var(--color-border-subtle)',
          borderRadius: 'var(--radius-md) var(--radius-md) 0 0',
        }}
      >
        {/* Traffic lights (desktop only) */}
        <div className="hidden md:flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#E8A499' }} />
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#E0C488' }} />
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#A8C4A4' }} />
        </div>

        {/* Address bar */}
        <div
          className="flex-1 flex items-center gap-2 px-3 py-1.5 rounded-lg"
          style={{
            background: 'var(--color-bg-sunken)',
            border: '1px solid var(--color-border-subtle)',
          }}
        >
          <Circle size={10} style={{ color: 'var(--color-success)', fill: 'var(--color-success)' }} />
          <span className="mono text-[11px] truncate" style={{ color: 'var(--color-text-tertiary)' }}>
            {appUrl}
          </span>
        </div>
      </div>

      {/* Viewport */}
      <div
        className="relative flex-1 overflow-hidden"
        style={{
          background: 'var(--color-bg-base)',
          borderRadius: '0 0 var(--radius-md) var(--radius-md)',
        }}
        data-test="preview-viewport"
      >
        {/* Loading state with thumbnail */}
        {loading && !loadFailed && (
          <div className="absolute inset-0 flex items-center justify-center z-10" style={{ background: 'var(--color-bg-base)' }}>
            {thumbnailUrl ? (
              <img
                src={thumbnailUrl}
                alt={`${appName} preview`}
                className="w-full h-full object-cover"
                style={{ opacity: 0.4, filter: 'blur(2px)' }}
              />
            ) : null}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex items-center gap-3">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ background: 'var(--color-accent)', animation: 'processing-dot 1.4s infinite' }}
                />
                <span className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                  Loading {appName}...
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Iframe blocked / load failed fallback */}
        {mode === 'iframe' && loadFailed && (
          <div
            className="w-full h-full flex items-center justify-center p-6"
            data-test="preview-fallback"
          >
            <div className="text-center" style={{ maxWidth: 360 }}>
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                style={{
                  background: 'var(--color-accent-soft)',
                  border: '1px solid var(--color-border-strong)',
                }}
              >
                <Compass size={24} strokeWidth={1.5} style={{ color: 'var(--color-accent-active)' }} />
              </div>
              <p className="text-sm font-semibold mb-2" style={{ color: 'var(--color-text-primary)' }}>
                This preview can&apos;t be embedded here
              </p>
              <p className="text-xs mb-5" style={{ color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
                The hosted demo blocks iframe embedding. You can open it in a new tab, or skip straight to the architecture map to see how it&apos;s built.
              </p>
              <div className="flex flex-col gap-2 items-stretch">
                <a
                  href={iframeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-test="open-new-tab"
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium"
                  style={{
                    background: 'var(--color-accent)',
                    color: 'var(--color-text-inverse)',
                    border: '1px solid var(--color-accent)',
                    textDecoration: 'none',
                  }}
                >
                  <ExternalLink size={14} strokeWidth={1.75} />
                  Open demo in new tab
                </a>
                {onSkipToExplorer && (
                  <button
                    onClick={onSkipToExplorer}
                    data-test="skip-to-arch"
                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium"
                    style={{
                      background: 'transparent',
                      color: 'var(--color-text-secondary)',
                      border: '1px solid var(--color-border-visible)',
                      cursor: 'pointer',
                    }}
                  >
                    Skip to architecture
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* rrweb player container */}
        {mode === 'rrweb' && (
          <div ref={containerRef} className="w-full h-full" />
        )}

        {/* iframe embed */}
        {mode === 'iframe' && iframeUrl && !loadFailed && (
          <iframe
            ref={iframeRef}
            src={iframeUrl}
            title={appName}
            className="w-full h-full border-0"
            onLoad={handleIframeLoad}
            onError={handleIframeError}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            style={{ background: '#fff' }}
          />
        )}

        {/* Placeholder for no content */}
        {mode === 'iframe' && !iframeUrl && !loading && !loadFailed && (
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-center">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                style={{ background: 'var(--color-accent-soft)', border: '1px solid var(--color-border-visible)' }}
              >
                <Play size={24} strokeWidth={1.5} style={{ color: 'var(--color-accent)' }} />
              </div>
              <p className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                App preview coming soon
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--color-text-tertiary)' }}>
                A live demo of this app will appear here
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Playback controls (rrweb mode only) */}
      {mode === 'rrweb' && events.length > 0 && (
        <div
          className="flex items-center gap-3 px-4 py-2 shrink-0"
          style={{
            background: '#1a1b2e',
            borderTop: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <button
            onClick={togglePlay}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-150"
            style={{ color: '#e2e8f0', background: 'rgba(255,255,255,0.06)' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(99, 102, 241, 0.2)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
          >
            {isPlaying ? <Pause size={14} /> : <Play size={14} />}
          </button>

          {/* Timeline */}
          <div className="flex-1 relative h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
            <div
              className="absolute top-0 left-0 h-full rounded-full transition-all duration-200"
              style={{
                width: duration > 0 ? `${(currentTime / duration) * 100}%` : '0%',
                background: '#6366f1',
              }}
            />
            {/* Marker dots */}
            {markers.map((marker, i) => (
              <div
                key={i}
                className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full"
                style={{
                  left: duration > 0 ? `${(marker.timestamp_ms / duration) * 100}%` : '0%',
                  background: '#f59e0b',
                  border: '1.5px solid #1a1b2e',
                }}
                title={marker.label}
              />
            ))}
          </div>

          <span className="mono text-[10px] tabular-nums" style={{ color: '#64748b' }}>
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
        </div>
      )}
    </div>
  );
}
