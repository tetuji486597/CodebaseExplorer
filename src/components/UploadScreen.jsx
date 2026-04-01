import { useState, useCallback, useRef } from 'react';
import useStore from '../store/useStore';
import { sampleConcepts, sampleFiles, sampleEdges, sampleFileImports } from '../data/sampleData';
import { parseZipFile, extractImports, resolveImportPaths } from '../utils/fileParser';

export default function UploadScreen() {
  const [isDragging, setIsDragging] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const { setScreen, loadData, setProcessingStatus, setProjectId } = useStore();
  const fileInputRef = useRef(null);

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
    setScreen('processing');
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
      const response = await fetch('/api/pipeline/start', {
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

      // Start listening to pipeline progress via SSE
      listenToPipeline(projectId);
    } catch (err) {
      console.error('Upload failed:', err);
      setProcessingStatus('Upload failed: ' + err.message);
    }
  };

  const listenToPipeline = (projectId) => {
    const eventSource = new EventSource(`/api/pipeline/${projectId}/stream`);

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
        loadProjectData(projectId);
        eventSource.close();
      }

      if (status === 'failed') {
        setProcessingStatus('Pipeline failed. Please try again.');
        eventSource.close();
      }
    });

    eventSource.onerror = () => {
      // Poll for final status after SSE closes
      setTimeout(() => checkAndLoadProject(projectId), 2000);
      eventSource.close();
    };
  };

  const checkAndLoadProject = async (projectId) => {
    try {
      const res = await fetch(`/api/pipeline/${projectId}/data`);
      const data = await res.json();
      if (data.concepts && data.concepts.length > 0) {
        transformAndLoad(data);
      }
    } catch {}
  };

  const loadProjectData = async (projectId) => {
    try {
      const res = await fetch(`/api/pipeline/${projectId}/data`);
      const data = await res.json();
      transformAndLoad(data);
    } catch (err) {
      console.error('Failed to load project data:', err);
    }
  };

  const transformAndLoad = (data) => {
    // Transform Supabase data to match existing store format
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
      codeSnippet: '', // Don't send full code to frontend
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

    loadData({
      concepts,
      files,
      conceptEdges,
      fileImports: [],
    });
    setScreen('explorer');
  };

  const loadDemo = () => {
    setScreen('processing');
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
      setScreen('explorer');
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
            Drop your code. We'll make sense of it.
          </h2>
          <p className="text-sm mb-4" style={{ color: '#888' }}>
            Works with any language. No setup. No config.
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
          Try the demo — explore an Instagram clone
        </button>
      </div>

      {/* Footer */}
      <p className="mt-8 text-xs z-10" style={{ color: '#444', animation: 'fade-in 1s ease-out 0.4s both' }}>
        Your code is processed securely. Analysis powered by Claude AI.
      </p>
    </div>
  );
}
