import { useState, useEffect } from 'react';
import useStore from '../store/useStore';
import { API_BASE } from '../lib/api';
import { Clock, Plus, MessageSquare, Terminal, Globe, Loader } from 'lucide-react';

function timeAgo(dateStr) {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function groupByDate(sessions) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const weekAgo = new Date(today.getTime() - 7 * 86400000);

  const groups = { Today: [], Yesterday: [], 'This Week': [], Older: [] };
  for (const s of sessions) {
    const d = new Date(s.startedAt);
    if (d >= today) groups.Today.push(s);
    else if (d >= yesterday) groups.Yesterday.push(s);
    else if (d >= weekAgo) groups['This Week'].push(s);
    else groups.Older.push(s);
  }
  return Object.entries(groups).filter(([, items]) => items.length > 0);
}

export default function ChatHistoryPanel({ onSelectSession, onNewConversation }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const projectId = useStore(s => s.projectId);

  useEffect(() => {
    if (!projectId) { setLoading(false); return; }
    setLoading(true);
    fetch(`${API_BASE}/api/chat/${projectId}/sessions`)
      .then(r => r.json())
      .then(data => setSessions(data.sessions || []))
      .catch(() => setSessions([]))
      .finally(() => setLoading(false));
  }, [projectId]);

  if (loading) {
    return (
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--color-text-tertiary)',
      }}>
        <Loader size={16} strokeWidth={1.5} style={{ animation: 'spin 2s linear infinite' }} />
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        padding: 24,
      }}>
        <div style={{
          width: 44,
          height: 44,
          borderRadius: 12,
          background: 'var(--color-bg-elevated, #1a1b2e)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <Clock size={20} strokeWidth={1.5} style={{ color: 'var(--color-text-tertiary)' }} />
        </div>
        <span style={{ fontSize: 13, color: 'var(--color-text-tertiary)' }}>
          No conversations yet
        </span>
        <button
          onClick={onNewConversation}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 16px',
            borderRadius: 8,
            background: 'var(--color-accent, #6366f1)',
            border: 'none',
            color: '#fff',
            fontSize: 12,
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'opacity 150ms ease-out',
          }}
          onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
          onMouseLeave={e => e.currentTarget.style.opacity = '1'}
        >
          <Plus size={14} strokeWidth={1.75} />
          Start a conversation
        </button>
      </div>
    );
  }

  const grouped = groupByDate(sessions);

  return (
    <div style={{
      flex: 1,
      overflowY: 'auto',
      padding: '12px 14px',
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
      minHeight: 0,
    }}>
      {/* New conversation button */}
      <button
        onClick={onNewConversation}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '10px 14px',
          borderRadius: 8,
          background: 'transparent',
          border: '1px dashed var(--color-border-visible, rgba(255,255,255,0.12))',
          color: 'var(--color-text-secondary)',
          fontSize: 12,
          fontWeight: 500,
          cursor: 'pointer',
          transition: 'all 150ms ease-out',
          marginBottom: 8,
          width: '100%',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.borderColor = 'var(--color-accent, #6366f1)';
          e.currentTarget.style.color = 'var(--color-accent, #6366f1)';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.borderColor = 'var(--color-border-visible, rgba(255,255,255,0.12))';
          e.currentTarget.style.color = 'var(--color-text-secondary)';
        }}
      >
        <Plus size={14} strokeWidth={1.75} />
        New conversation
      </button>

      {grouped.map(([label, items]) => (
        <div key={label}>
          <div style={{
            fontSize: 10,
            fontWeight: 600,
            color: 'var(--color-text-tertiary)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            padding: '8px 6px 4px',
          }}>
            {label}
          </div>
          {items.map(session => (
            <SessionCard
              key={session.sessionId}
              session={session}
              onClick={() => onSelectSession(session)}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function SessionCard({ session, onClick }) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        width: '100%',
        padding: '10px 12px',
        borderRadius: 8,
        background: hovered ? 'var(--color-bg-elevated, #1a1b2e)' : 'transparent',
        border: '1px solid',
        borderColor: hovered ? 'var(--color-border-visible, rgba(255,255,255,0.12))' : 'transparent',
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'all 150ms ease-out',
      }}
    >
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        width: '100%',
      }}>
        <MessageSquare size={12} strokeWidth={1.5} style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }} />
        <span style={{
          fontSize: 12,
          color: 'var(--color-text-primary, #e2e8f0)',
          fontWeight: 500,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          flex: 1,
        }}>
          {session.preview || 'Untitled conversation'}
        </span>
      </div>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        paddingLeft: 20,
      }}>
        <span style={{ fontSize: 10, color: 'var(--color-text-tertiary)' }}>
          {timeAgo(session.startedAt)}
        </span>
        <span style={{ fontSize: 10, color: 'var(--color-text-tertiary)' }}>
          {session.messageCount} msg{session.messageCount !== 1 ? 's' : ''}
        </span>
        {session.sources?.map(src => (
          <span
            key={src}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 3,
              fontSize: 9,
              fontWeight: 600,
              padding: '1px 6px',
              borderRadius: 4,
              background: src === 'cli'
                ? 'rgba(245, 158, 11, 0.15)'
                : 'rgba(99, 102, 241, 0.15)',
              color: src === 'cli' ? '#f59e0b' : '#6366f1',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            {src === 'cli' ? <Terminal size={8} strokeWidth={2} /> : <Globe size={8} strokeWidth={2} />}
            {src}
          </span>
        ))}
      </div>
    </button>
  );
}
