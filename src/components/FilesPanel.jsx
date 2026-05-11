import { useState, useEffect, useRef, useMemo } from 'react';
import useStore from '../store/useStore';
import { Search, X, ChevronRight, FolderTree, FileCode2, Circle } from 'lucide-react';

const ROLE_LABELS = {
  entry: 'Entry',
  config: 'Config',
  utility: 'Utility',
  source: 'Source',
  test: 'Test',
  style: 'Style',
  type: 'Type',
  component: 'Component',
};

const CONCEPT_COLOR_MAP = {
  teal:   { dot: 'var(--color-teal-stroke)',   border: 'var(--color-teal-stroke)',   bg: 'var(--color-teal-fill)' },
  purple: { dot: 'var(--color-purple-stroke)', border: 'var(--color-purple-stroke)', bg: 'var(--color-purple-fill)' },
  coral:  { dot: 'var(--color-coral-stroke)',  border: 'var(--color-coral-stroke)',  bg: 'var(--color-coral-fill)' },
  blue:   { dot: 'var(--color-blue-stroke)',   border: 'var(--color-blue-stroke)',   bg: 'var(--color-blue-fill)' },
  amber:  { dot: 'var(--color-amber-stroke)',  border: 'var(--color-amber-stroke)',  bg: 'var(--color-amber-fill)' },
  pink:   { dot: 'var(--color-pink-stroke)',   border: 'var(--color-pink-stroke)',   bg: 'var(--color-pink-fill)' },
  green:  { dot: 'var(--color-green-stroke)',  border: 'var(--color-green-stroke)',  bg: 'var(--color-green-fill)' },
  gray:   { dot: 'var(--color-gray-stroke)',   border: 'var(--color-gray-stroke)',   bg: 'var(--color-gray-fill)' },
};

function getConceptColors(color) {
  return CONCEPT_COLOR_MAP[color] || CONCEPT_COLOR_MAP.gray;
}

function fuzzyMatch(query, text) {
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  if (t.includes(q)) return true;
  let qi = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) qi++;
  }
  return qi === q.length;
}

function fileName(path) {
  return path.split('/').pop() || path;
}

function fileDir(path) {
  const parts = path.split('/');
  return parts.length > 1 ? parts.slice(0, -1).join('/') : '';
}

export default function FilesPanel() {
  const filesPanelOpen = useStore(s => s.filesPanelOpen);
  const setFilesPanelOpen = useStore(s => s.setFilesPanelOpen);
  const fileSearchQuery = useStore(s => s.fileSearchQuery);
  const setFileSearchQuery = useStore(s => s.setFileSearchQuery);
  const files = useStore(s => s.files);
  const concepts = useStore(s => s.concepts);
  const selectedNode = useStore(s => s.selectedNode);
  const setSelectedNode = useStore(s => s.setSelectedNode);
  const setShowInspector = useStore(s => s.setShowInspector);

  const [collapsedSections, setCollapsedSections] = useState({});
  const searchRef = useRef(null);
  const panelRef = useRef(null);
  const scrollContainerRef = useRef(null);

  useEffect(() => {
    if (filesPanelOpen && searchRef.current) {
      setTimeout(() => searchRef.current?.focus(), 350);
    }
  }, [filesPanelOpen]);

  // Ctrl+P to focus search, Ctrl+B to toggle panel
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
        e.preventDefault();
        setFilesPanelOpen(!filesPanelOpen);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'p') {
        e.preventDefault();
        if (!filesPanelOpen) setFilesPanelOpen(true);
        setTimeout(() => searchRef.current?.focus(), 100);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [filesPanelOpen, setFilesPanelOpen]);

  // Scroll to the selected concept's section when a concept is clicked in the graph
  useEffect(() => {
    if (!selectedNode || !filesPanelOpen || !scrollContainerRef.current) return;
    const conceptKey = selectedNode.type === 'concept' ? selectedNode.id : null;
    if (!conceptKey) return;
    // Expand the section if collapsed
    setCollapsedSections(prev => ({ ...prev, [conceptKey]: false }));
    // Scroll to section header
    setTimeout(() => {
      const header = scrollContainerRef.current?.querySelector(`[data-concept-section="${conceptKey}"]`);
      if (header) header.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  }, [selectedNode, filesPanelOpen]);

  const filesGroupedByConcept = useMemo(() => {
    const nonUniverseConcepts = concepts.filter(c => c.id !== '__universe__');
    const groups = [];

    for (const concept of nonUniverseConcepts) {
      const conceptFiles = files.filter(f => f.conceptId === concept.id);
      if (conceptFiles.length === 0 && !fileSearchQuery) continue;

      const filtered = fileSearchQuery
        ? conceptFiles.filter(f => fuzzyMatch(fileSearchQuery, f.id))
        : conceptFiles;
      if (filtered.length === 0 && fileSearchQuery) continue;

      groups.push({ concept, files: filtered });
    }

    // Unassigned files (concept_id === '__universe__' or no concept)
    const unassigned = files.filter(f =>
      f.conceptId === '__universe__' || !f.conceptId || !concepts.some(c => c.id === f.conceptId)
    );
    const filteredUnassigned = fileSearchQuery
      ? unassigned.filter(f => fuzzyMatch(fileSearchQuery, f.id))
      : unassigned;
    if (filteredUnassigned.length > 0) {
      groups.push({
        concept: { id: '__other__', name: 'Other Files', color: 'gray', one_liner: 'Not assigned to a concept' },
        files: filteredUnassigned,
      });
    }

    return groups;
  }, [concepts, files, fileSearchQuery]);

  const totalFilteredFiles = filesGroupedByConcept.reduce((sum, g) => sum + g.files.length, 0);

  const toggleSection = (conceptId) => {
    setCollapsedSections(prev => ({ ...prev, [conceptId]: !prev[conceptId] }));
  };

  const handleFileClick = (file) => {
    setSelectedNode({ type: 'file', id: file.id });
    setShowInspector(true);
  };

  return (
    <>
      {/* Mobile backdrop */}
      {filesPanelOpen && (
        <div
          className="files-panel-backdrop"
          onClick={() => setFilesPanelOpen(false)}
        />
      )}

      <div
        ref={panelRef}
        className={`files-panel ${filesPanelOpen ? 'files-panel--open' : ''}`}
      >
        {/* Header */}
        <div className="files-panel-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <FolderTree size={14} strokeWidth={1.75} style={{ color: 'var(--color-accent-active)', flexShrink: 0 }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)' }}>
              Files
            </span>
            <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)', fontWeight: 400 }}>
              {totalFilteredFiles}
            </span>
          </div>
          <button
            onClick={() => setFilesPanelOpen(false)}
            className="files-panel-close"
            aria-label="Close files panel"
          >
            <X size={14} strokeWidth={1.75} />
          </button>
        </div>

        {/* Search */}
        <div className="files-panel-search">
          <Search size={13} strokeWidth={1.75} style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }} />
          <input
            ref={searchRef}
            type="text"
            value={fileSearchQuery}
            onChange={(e) => setFileSearchQuery(e.target.value)}
            placeholder="Search files…"
            className="files-panel-search-input"
          />
          {fileSearchQuery && (
            <button
              onClick={() => setFileSearchQuery('')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex' }}
              aria-label="Clear search"
            >
              <X size={12} strokeWidth={1.75} style={{ color: 'var(--color-text-tertiary)' }} />
            </button>
          )}
        </div>

        {/* File tree */}
        <div ref={scrollContainerRef} className="files-panel-tree">
          {filesGroupedByConcept.length === 0 ? (
            <div className="files-panel-empty">
              {fileSearchQuery
                ? `No files matching "${fileSearchQuery}"`
                : 'No files in this project'}
            </div>
          ) : (
            filesGroupedByConcept.map(({ concept, files: groupFiles }) => {
              const colors = getConceptColors(concept.color);
              const collapsed = collapsedSections[concept.id] ?? false;
              return (
                <div key={concept.id} data-concept-section={concept.id} className="files-panel-section">
                  {/* Section header */}
                  <button
                    onClick={() => toggleSection(concept.id)}
                    className="files-panel-section-header"
                    style={{ borderLeftColor: colors.border }}
                  >
                    <ChevronRight
                      size={12}
                      strokeWidth={2}
                      className="files-panel-chevron"
                      style={{
                        transform: collapsed ? 'rotate(0deg)' : 'rotate(90deg)',
                        color: 'var(--color-text-tertiary)',
                      }}
                    />
                    <Circle
                      size={7}
                      fill={colors.dot}
                      stroke={colors.dot}
                      strokeWidth={1}
                    />
                    <span className="files-panel-section-name">{concept.name}</span>
                    <span className="files-panel-section-count">{groupFiles.length}</span>
                  </button>

                  {/* Files list */}
                  {!collapsed && (
                    <div className="files-panel-files">
                      {groupFiles.map((file) => {
                        const name = fileName(file.id);
                        const dir = fileDir(file.id);
                        const isSelected = selectedNode?.id === file.id;
                        const role = ROLE_LABELS[file.role] || null;
                        return (
                          <button
                            key={file.id}
                            onClick={() => handleFileClick(file)}
                            className={`files-panel-file ${isSelected ? 'files-panel-file--selected' : ''}`}
                          >
                            <FileCode2 size={13} strokeWidth={1.5} style={{ color: colors.dot, flexShrink: 0, marginTop: 1 }} />
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div className="files-panel-file-name">
                                {name}
                                {role && <span className="files-panel-role-badge">{role}</span>}
                              </div>
                              {dir && (
                                <div className="files-panel-file-dir">{dir}</div>
                              )}
                              {file.description && !fileSearchQuery && (
                                <div className="files-panel-file-desc">{file.description}</div>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}
