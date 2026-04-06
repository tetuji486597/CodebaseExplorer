import { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router';
import useStore from '../store/useStore';
import { sampleConcepts, sampleFiles, sampleEdges, sampleFileImports } from '../data/sampleData';
import { parseZipFile, extractImports, resolveImportPaths } from '../utils/fileParser';
import { API_BASE } from '../lib/api';
import { fetchAndLoadProject } from '../lib/loadProject';

export default function UploadScreen() {
  const [isDragging, setIsDragging] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const { loadData, setProcessingStatus, setProjectId } = useStore();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const mountedRef = useRef(false);

  // On mount, check for an in-progress pipeline and resume listening
  useEffect(() => {
    if (mountedRef.current) return;
    mountedRef.current = true;
    const savedProjectId = localStorage.getItem('cbe_active_project');
    if (savedProjectId) {
      navigate('/processing', { replace: true });
      setProcessingStatus('Reconnecting to pipeline...');
      setProjectId(savedProjectId);
      listenToPipeline(savedProjectId);
    }
  }, []);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0 && files[0].name.endsWith('.zip')) {
      handleFileUpload(files[0]);
    }
  }, []);

  const handleFileUpload = async (file) => {
    navigate('/processing', { replace: true });
    setProcessingStatus('Reading your files...');

    try {
      // Parse the zip file
      const { fileTree, fileContents } = await parseZipFile(file);
      setProcessingStatus('Extracting imports...');

      // Extract import relationships
      const imports = extractImports(fileContents);
      const importEdges = resolveImportPaths(imports, fileTree);

      setProcessingStatus('Starting analysis pipeline...');

      // Send to backend pipeline
      const response = await fetch(`${API_BASE}/api/pipeline/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileTree,
          fileContents,
          importEdges,
          projectName: file.name.replace('.zip', ''),
        }),
      });

      const { projectId } = await response.json();
      setProjectId(projectId);
      localStorage.setItem('cbe_active_project', projectId);
      localStorage.removeItem('cbe_curated_id'); // Clear stale curated context

      // Start listening to pipeline progress via SSE
      listenToPipeline(projectId);
    } catch (err) {
      console.error('Upload failed:', err);
      setProcessingStatus('Upload failed: ' + err.message);
    }
  };

  const listenToPipeline = (projectId, retryCount = 0) => {
    const maxRetries = 10;
    const eventSource = new EventSource(`${API_BASE}/api/pipeline/${projectId}/stream`);

    eventSource.addEventListener('progress', (e) => {
      const data = JSON.parse(e.data);
      const { status, progress } = data;

      useStore.getState().setPipelineStatus(status);
      useStore.getState().setPipelineProgress(progress);

      if (progress?.message) {
        setProcessingStatus(progress.message);
      }

      // Only transition when pipeline is fully complete
      if (status === 'complete') {
        localStorage.removeItem('cbe_active_project');
        loadProjectData(projectId);
        eventSource.close();
      }

      if (status === 'failed') {
        localStorage.removeItem('cbe_active_project');
        setProcessingStatus('Pipeline failed. Please try again.');
        eventSource.close();
      }
    });

    eventSource.onerror = () => {
      eventSource.close();
      if (retryCount < maxRetries) {
        const delay = Math.min(2000 * Math.pow(1.5, retryCount), 15000);
        setProcessingStatus('Connection lost, reconnecting...');
        setTimeout(() => listenToPipeline(projectId, retryCount + 1), delay);
      } else {
        // Exhausted retries — try to load final state
        checkAndLoadProject(projectId);
      }
    };
  };

  const checkAndLoadProject = async (projectId) => {
    const result = await fetchAndLoadProject(projectId);
    if (result) navigate('/explorer', { replace: true });
  };

  const loadProjectData = async (projectId) => {
    const result = await fetchAndLoadProject(projectId);
    if (result) {
      navigate('/explorer', { replace: true });
    } else {
      console.error('Failed to load project data');
    }
  };

  const loadDemo = () => {
    navigate('/processing', { replace: true });
    setProcessingStatus('Loading demo...');
    setTimeout(() => setProcessingStatus('Finding the concepts...'), 800);
    setTimeout(() => setProcessingStatus('Building your map...'), 1600);
    setTimeout(() => {
      loadData({
        concepts: sampleConcepts,
        files: sampleFiles,
        conceptEdges: sampleEdges,
        fileImports: sampleFileImports,
      });
      navigate('/explorer', { replace: true });
    }, 2400);
  };

  return (
    <div className="w-full h-full flex flex-col items-center justify-center relative overflow-hidden"
         style={{ background: '#0F0F0E' }}>

      {/* Animated background orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute w-96 h-96 rounded-full opacity-10 blur-3xl"
             style={{
               background: 'radial-gradient(circle, #9FE1CB 0%, transparent 70%)',
               top: '10%', left: '15%',
               animation: 'float 8s ease-in-out infinite',
             }} />
        <div className="absolute w-80 h-80 rounded-full opacity-10 blur-3xl"
             style={{
               background: 'radial-gradient(circle, #CECBF6 0%, transparent 70%)',
               bottom: '15%', right: '20%',
               animation: 'float 10s ease-in-out infinite 2s',
             }} />
        <div className="absolute w-64 h-64 rounded-full opacity-8 blur-3xl"
             style={{
               background: 'radial-gradient(circle, #FAC775 0%, transparent 70%)',
               top: '50%', left: '60%',
               animation: 'float 12s ease-in-out infinite 4s',
             }} />
      </div>

      {/* Logo / Title */}
      <div className="mb-8 text-center z-10" style={{ animation: 'fade-in 0.6s ease-out' }}>
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-3">
          <circle cx="12" cy="12" r="10"/>
          <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>
        </svg>
        <h1 className="text-2xl font-semibold tracking-tight font-heading" style={{ color: '#e2e8f0' }}>
          Codebase Explorer
        </h1>
      </div>

      {/* Upload Card */}
      <div
        className="z-10 w-full max-w-lg mx-4 rounded-2xl p-8 transition-all duration-300"
        style={{
          background: '#1A1A18',
          border: '0.5px solid #333',
          animation: 'fade-in 0.8s ease-out 0.2s both',
        }}
      >
        {/* Drop Zone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onMouseEnter={() => setIsHovering(true)}
          onMouseLeave={() => setIsHovering(false)}
          onClick={() => fileInputRef.current?.click()}
          className="relative rounded-xl p-10 text-center cursor-pointer transition-all duration-300"
          style={{
            border: `2px dashed ${isDragging ? '#9FE1CB' : isHovering ? '#666' : '#333'}`,
            background: isDragging ? 'rgba(159, 225, 203, 0.05)' : 'transparent',
            boxShadow: isDragging ? '0 0 30px rgba(159, 225, 203, 0.1)' : 'none',
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".zip"
            className="hidden"
            onChange={(e) => e.target.files[0] && handleFileUpload(e.target.files[0])}
          />

          <div className="text-5xl mb-4" style={{
            filter: isDragging ? 'none' : 'grayscale(0.3)',
            transition: 'filter 0.3s',
          }}>
            📦
          </div>

          <h2 className="text-xl font-medium mb-2" style={{ color: '#E8E8E6' }}>
            Drop a codebase. See how it's architected.
          </h2>
          <p className="text-sm mb-4" style={{ color: '#888' }}>
            Works with any language or framework. No setup required.
          </p>
          <p className="text-xs" style={{ color: '#555' }}>
            Drop a .zip file or click to browse
          </p>
        </div>

        {/* Divider */}
        <div className="flex items-center my-6">
          <div className="flex-1 h-px" style={{ background: '#333' }} />
          <span className="px-3 text-xs" style={{ color: '#666' }}>or</span>
          <div className="flex-1 h-px" style={{ background: '#333' }} />
        </div>

        {/* Demo Button */}
        <button
          onClick={loadDemo}
          className="w-full py-3 px-4 rounded-xl text-sm font-medium transition-all duration-200 active:scale-[0.98]"
          style={{
            background: 'rgba(159, 225, 203, 0.1)',
            color: '#9FE1CB',
            border: '1px solid rgba(159, 225, 203, 0.2)',
          }}
          onMouseEnter={(e) => {
            e.target.style.background = 'rgba(159, 225, 203, 0.15)';
            e.target.style.borderColor = 'rgba(159, 225, 203, 0.3)';
          }}
          onMouseLeave={(e) => {
            e.target.style.background = 'rgba(159, 225, 203, 0.1)';
            e.target.style.borderColor = 'rgba(159, 225, 203, 0.2)';
          }}
        >
          Try the demo — explore the architecture of an Instagram clone
        </button>
      </div>

      {/* Footer */}
      <p className="mt-8 text-xs z-10" style={{ color: '#444', animation: 'fade-in 1s ease-out 0.4s both' }}>
        Your code is processed securely. Architecture analysis powered by Claude AI.
      </p>
    </div>
  );
}
