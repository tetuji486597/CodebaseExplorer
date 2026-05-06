import { getApiBase } from '../../lib/auth.js';

interface ProjectData {
  conceptCount: number;
  status: string;
}

interface SessionData {
  sessionId: string;
  startedAt: string;
  messageCount: number;
  preview: string;
}

export async function fetchProjectData(projectId: string, token: string): Promise<ProjectData | null> {
  const apiBase = getApiBase();

  try {
    const [statusRes, dataRes] = await Promise.all([
      fetch(`${apiBase}/api/cx/project/status/${projectId}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      }),
      fetch(`${apiBase}/api/pipeline/${projectId}/data`, {
        headers: { 'Authorization': `Bearer ${token}` },
      }),
    ]);

    const status = statusRes.ok ? (await statusRes.json()).pipeline_status || 'ready' : 'unknown';
    const conceptCount = dataRes.ok ? ((await dataRes.json()).concepts?.length || 0) : 0;

    return { status, conceptCount };
  } catch {
    return null;
  }
}

export async function fetchSessionsData(projectId: string, token: string): Promise<SessionData[]> {
  const apiBase = getApiBase();

  try {
    const res = await fetch(`${apiBase}/api/cx/chat/${projectId}/sessions`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.sessions || []).map((s: any) => ({
      sessionId: s.sessionId,
      startedAt: s.startedAt,
      messageCount: s.messageCount,
      preview: s.preview || 'Untitled',
    }));
  } catch {
    return [];
  }
}
