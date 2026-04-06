import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router';
import useStore from '../store/useStore';
import { API_BASE } from '../lib/api';

const LANGUAGE_COLORS = {
  JavaScript: '#f1e05a', TypeScript: '#3178c6', Python: '#3572A5',
  Go: '#00ADD8', Rust: '#dea584', Java: '#b07219', Ruby: '#701516',
  'C++': '#f34b7d', C: '#555555', 'C#': '#178600', PHP: '#4F5D95',
  Swift: '#F05138', Kotlin: '#A97BFF', Dart: '#00B4AB', Vue: '#41b883',
  HTML: '#e34c26', CSS: '#563d7c', Shell: '#89e051', Lua: '#000080',
};

export default function RepoSelectScreen() {
  const { setProjectId, setProcessingStatus, setPipelineStatus, setPipelineProgress, loadData, session, signOut, user } = useStore();
  const navigate = useNavigate();
  const [repos, setRepos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [analyzing, setAnalyzing] = useState(null); // repo full_name being analyzed
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const fetchRepos = useCallback(async (pageNum = 1) => {
    const token = session?.provider_token;
    if (!token) {
      setError('GitHub token not available. Please sign in again.');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(
        `https://api.github.com/user/repos?sort=updated&per_page=30&page=${pageNum}&type=all`,
        { headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github.v3+json' } }
      );

      if (!res.ok) {
        if (res.status === 401) {
          setError('GitHub token expired. Please sign in again.');
          return;
        }
        throw new Error(`GitHub API error: ${res.status}`);
      }

      const data = await res.json();
      setHasMore(data.length === 30);

      if (pageNum === 1) {
        setRepos(data);
      } else {
        setRepos(prev => [...prev, ...data]);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    fetchRepos(1);
  }, [fetchRepos]);

  const loadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchRepos(nextPage);
  };

  const handleAnalyze = async (repo) => {
    const token = session?.provider_token;
    if (!token) {
      setError('GitHub token not available. Please sign in again.');
      return;
    }

    setAnalyzing(repo.full_name);
    navigate('/processing', { replace: true });
    setProcessingStatus('Downloading repository from GitHub...');

    try {
      const res = await fetch(`${API_BASE}/api/github/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoFullName: repo.full_name, accessToken: token }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Server error: ${res.status}`);
      }

      const { projectId } = await res.json();
      setProjectId(projectId);
      listenToPipeline(projectId);
    } catch (err) {
      console.error('Analysis failed:', err);
      setProcessingStatus('Failed: ' + err.message);
      setAnalyzing(null);
    }
  };

  const listenToPipeline = (projectId) => {
    const eventSource = new EventSource(`${API_BASE}/api/pipeline/${projectId}/stream`);

    eventSource.addEventListener('progress', (e) => {
      const data = JSON.parse(e.data);
      const { status, progress } = data;

      setPipelineStatus(status);
      setPipelineProgress(progress);

      if (progress?.message) {
        setProcessingStatus(progress.message);
      }

      if (status === 'complete') {
        loadProjectData(projectId);
        eventSource.close();
      }

      if (status === 'failed') {
        setProcessingStatus('Pipeline failed. Please try again.');
        eventSource.close();
      }
    });

    eventSource.onerror = () => {
      setTimeout(() => checkAndLoadProject(projectId), 2000);
      eventSource.close();
    };
  };

  const checkAndLoadProject = async (projectId) => {
    try {
      const res = await fetch(`${API_BASE}/api/pipeline/${projectId}/data`);
      const data = await res.json();
      if (data.concepts && data.concepts.length > 0) {
        transformAndLoad(data);
      }
    } catch {}
  };

  const loadProjectData = async (projectId) => {
    try {
      const res = await fetch(`${API_BASE}/api/pipeline/${projectId}/data`);
      const data = await res.json();
      transformAndLoad(data);
    } catch (err) {
      console.error('Failed to load project data:', err);
    }
  };

  const transformAndLoad = (data) => {
    const concepts = (data.concepts || []).map(c => ({
      id: c.concept_key,
      name: c.name,
      emoji: c.emoji,
      color: c.color,
      description: c.explanation,
      metaphor: c.metaphor,
      one_liner: c.one_liner,
      deep_explanation: c.deep_explanation,
      beginner_explanation: c.beginner_explanation,
      intermediate_explanation: c.intermediate_explanation,
      advanced_explanation: c.advanced_explanation,
      importance: c.importance,
      fileIds: (data.files || []).filter(f => f.concept_id === c.concept_key).map(f => f.path),
    }));

    const files = (data.files || []).map(f => ({
      id: f.path,
      name: f.name,
      conceptId: f.concept_id,
      description: f.analysis?.purpose || '',
      exports: (f.analysis?.key_exports || []).map(e => ({
        name: e.name,
        whatItDoes: e.what_it_does || '',
      })),
      codeSnippet: '',
      role: f.role,
    }));

    const conceptEdges = (data.edges || []).map(e => ({
      source: e.source_concept_key,
      target: e.target_concept_key,
      label: e.relationship,
      strength: e.strength,
      explanation: e.explanation,
    }));

    if (data.insights) {
      useStore.getState().setInsights(data.insights);
    }
    if (data.userState) {
      useStore.getState().setUserState(data.userState);
    }

    loadData({ concepts, files, conceptEdges, fileImports: [] });
    navigate('/explorer', { replace: true });
  };

  const filtered = repos.filter(r =>
    r.full_name.toLowerCase().includes(search.toLowerCase()) ||
    (r.description || '').toLowerCase().includes(search.toLowerCase())
  );

  const avatarUrl = user?.user_metadata?.avatar_url;
  const displayName = user?.user_metadata?.user_name || user?.email || 'User';

  return (
    <div className="w-full h-full flex flex-col relative overflow-hidden" style={{ background: '#0F0F0E' }}>
      {/* Header */}
      <div style={{
        padding: '1.5rem 2rem', borderBottom: '1px solid #222',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {avatarUrl && (
            <img src={avatarUrl} alt="" style={{ width: 36, height: 36, borderRadius: '50%', border: '2px solid #333' }} />
          )}
          <div>
            <div style={{ color: '#e2e8f0', fontWeight: 600, fontSize: '1.1rem' }}>Choose a repository</div>
            <div style={{ color: '#666', fontSize: '.85rem' }}>Signed in as {displayName}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '.75rem' }}>
          <button onClick={() => navigate('/upload')} style={{
            background: 'rgba(255,255,255,.05)', color: '#94a3b8',
            border: '1px solid #333', padding: '.5rem 1rem',
            borderRadius: 6, fontSize: '.85rem', cursor: 'pointer',
          }}>Upload zip instead</button>
          <button onClick={() => { signOut(); navigate('/'); }} style={{
            background: 'none', color: '#94a3b8', border: '1px solid #333',
            padding: '.5rem 1rem', borderRadius: 6, fontSize: '.85rem', cursor: 'pointer',
          }}>Sign out</button>
        </div>
      </div>

      {/* Search */}
      <div style={{ padding: '1rem 2rem 0' }}>
        <input
          type="text"
          placeholder="Search repositories..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            width: '100%', maxWidth: 500, padding: '.65rem 1rem',
            background: '#1a1a18', border: '1px solid #333', borderRadius: 8,
            color: '#e2e8f0', fontSize: '.9rem', outline: 'none',
          }}
          onFocus={e => e.target.style.borderColor = '#06b6d4'}
          onBlur={e => e.target.style.borderColor = '#333'}
        />
      </div>

      {/* Repo list */}
      <div style={{ flex: 1, overflow: 'auto', padding: '1rem 2rem 2rem' }}>
        {loading && (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#666' }}>
            Loading your repositories...
          </div>
        )}

        {error && (
          <div style={{
            textAlign: 'center', padding: '2rem', color: '#f87171',
            background: 'rgba(248,113,113,.05)', borderRadius: 8, margin: '1rem 0',
          }}>
            {error}
            <div style={{ marginTop: '.5rem' }}>
              <button onClick={() => { signOut(); navigate('/'); }} style={{
                color: '#06b6d4', background: 'none', border: 'none',
                cursor: 'pointer', textDecoration: 'underline', fontSize: '.9rem',
              }}>Sign in again</button>
            </div>
          </div>
        )}

        {!loading && !error && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '.5rem' }}>
            {filtered.map(repo => (
              <div key={repo.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '1rem 1.25rem', background: '#1a1a18', borderRadius: 10,
                border: '1px solid #222', transition: 'border-color .2s',
                cursor: 'pointer',
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = '#444'}
              onMouseLeave={e => e.currentTarget.style.borderColor = '#222'}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', marginBottom: '.25rem' }}>
                    <span style={{ color: '#e2e8f0', fontWeight: 500, fontSize: '.95rem' }}>
                      {repo.full_name}
                    </span>
                    {repo.private && (
                      <span style={{
                        fontSize: '.7rem', padding: '1px 6px', borderRadius: 4,
                        border: '1px solid #444', color: '#888',
                      }}>private</span>
                    )}
                  </div>
                  {repo.description && (
                    <div style={{ color: '#666', fontSize: '.85rem', marginBottom: '.35rem',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {repo.description}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: '1rem', fontSize: '.8rem', color: '#555' }}>
                    {repo.language && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '.3rem' }}>
                        <span style={{
                          width: 10, height: 10, borderRadius: '50%', display: 'inline-block',
                          background: LANGUAGE_COLORS[repo.language] || '#888',
                        }} />
                        {repo.language}
                      </span>
                    )}
                    {repo.stargazers_count > 0 && <span>{repo.stargazers_count} stars</span>}
                    <span>Updated {new Date(repo.updated_at).toLocaleDateString()}</span>
                  </div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); handleAnalyze(repo); }}
                  disabled={analyzing === repo.full_name}
                  style={{
                    marginLeft: '1rem', padding: '.5rem 1.25rem', borderRadius: 8,
                    background: analyzing === repo.full_name ? '#333' : 'rgba(159, 225, 203, 0.1)',
                    color: analyzing === repo.full_name ? '#666' : '#9FE1CB',
                    border: `1px solid ${analyzing === repo.full_name ? '#333' : 'rgba(159, 225, 203, 0.2)'}`,
                    fontSize: '.85rem', fontWeight: 500, cursor: analyzing === repo.full_name ? 'default' : 'pointer',
                    whiteSpace: 'nowrap', transition: 'all .2s',
                  }}
                >
                  {analyzing === repo.full_name ? 'Starting...' : 'Analyze'}
                </button>
              </div>
            ))}

            {hasMore && !search && (
              <button onClick={loadMore} style={{
                padding: '.75rem', background: 'none', border: '1px solid #333',
                borderRadius: 8, color: '#94a3b8', cursor: 'pointer', fontSize: '.85rem',
                marginTop: '.5rem',
              }}>Load more repositories</button>
            )}

            {filtered.length === 0 && !loading && (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>
                {search ? 'No repositories match your search.' : 'No repositories found.'}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
