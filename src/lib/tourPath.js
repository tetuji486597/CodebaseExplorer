const IMPORTANCE_ORDER = { critical: 0, important: 1, supporting: 2 };

export function buildTourPath(explorationPath, subConceptsCache, concepts) {
  if (!explorationPath?.length) return null;

  const stops = [];
  const chapters = [];

  explorationPath.forEach((conceptKey, chapterIndex) => {
    const concept = concepts.find(c => c.id === conceptKey);
    const cached = subConceptsCache?.[conceptKey];
    const sections = cached?.subConcepts || [];

    const sortedSections = [...sections].sort((a, b) => {
      if (a.display_order != null && b.display_order != null) {
        return a.display_order - b.display_order;
      }
      const impDiff = (IMPORTANCE_ORDER[a.importance] ?? 2) - (IMPORTANCE_ORDER[b.importance] ?? 2);
      if (impDiff !== 0) return impDiff;
      return (b.file_ids?.length || 0) - (a.file_ids?.length || 0);
    });

    stops.push({
      id: conceptKey,
      type: 'chapter_intro',
      chapterIndex,
      sectionIndex: null,
      conceptKey,
      name: concept?.name || conceptKey,
    });

    sortedSections.forEach((sc, sectionIndex) => {
      stops.push({
        id: sc.id,
        type: 'section',
        chapterIndex,
        sectionIndex,
        conceptKey,
        name: sc.name,
      });
    });

    chapters.push({
      conceptKey,
      name: concept?.name || conceptKey,
      color: concept?.color || 'blue',
      sectionCount: sortedSections.length,
    });
  });

  return { stops, chapters };
}

export function getStopNavigationContext(tourPath, tourPosition, direction) {
  if (!tourPath?.stops?.length) return null;
  const stops = tourPath.stops;

  if (direction === 'next') {
    if (tourPosition >= stops.length - 1) return { label: 'Finish tour', willDrill: null };
    const current = stops[tourPosition];
    const next = stops[tourPosition + 1];
    const nextChapter = tourPath.chapters[next.chapterIndex];

    if (current.type === 'chapter_intro' && next.type === 'section' && next.conceptKey === current.conceptKey) {
      return { label: `Enter ${current.name}`, willDrill: 'in' };
    }
    if (current.type === 'section' && next.type === 'chapter_intro') {
      return { label: `Next: ${next.name}`, willDrill: 'out' };
    }
    if (current.type === 'section' && next.type === 'section' && next.conceptKey === current.conceptKey) {
      return { label: `Next: ${next.name}`, willDrill: null };
    }
    if (current.type === 'section' && next.type === 'section' && next.conceptKey !== current.conceptKey) {
      return { label: `Enter ${nextChapter?.name || next.conceptKey}`, willDrill: 'in' };
    }
    if (current.type === 'chapter_intro' && next.type === 'chapter_intro') {
      return { label: `Next: ${next.name}`, willDrill: null };
    }
    return { label: `Next: ${next.name}`, willDrill: null };
  }

  if (direction === 'prev') {
    if (tourPosition <= 0) return null;
    const current = stops[tourPosition];
    const prev = stops[tourPosition - 1];

    if (current.type === 'section' && prev.type === 'chapter_intro' && prev.conceptKey === current.conceptKey) {
      return { label: 'Back to overview', willDrill: 'out' };
    }
    if (current.type === 'section' && prev.type === 'section' && prev.conceptKey !== current.conceptKey) {
      const prevChapter = tourPath.chapters[prev.chapterIndex];
      return { label: `Back to ${prevChapter?.name || prev.conceptKey}`, willDrill: 'out' };
    }
    if (current.type === 'chapter_intro' && prev.type === 'section') {
      const prevChapter = tourPath.chapters[prev.chapterIndex];
      return { label: `Back to ${prevChapter?.name || prev.conceptKey}`, willDrill: 'in' };
    }
    if (current.type === 'section' && prev.type === 'section' && prev.conceptKey === current.conceptKey) {
      return { label: 'Previous', willDrill: null };
    }
    return { label: 'Previous', willDrill: null };
  }

  return null;
}

export function getTourChapterProgress(tourPath, tourPosition) {
  if (!tourPath?.stops?.length) return null;
  const stop = tourPath.stops[tourPosition] ?? tourPath.stops[0];
  const chapter = tourPath.chapters[stop.chapterIndex];
  return {
    chapterIndex: stop.chapterIndex,
    chapterName: chapter?.name || '',
    chapterColor: chapter?.color || 'blue',
    totalChapters: tourPath.chapters.length,
    sectionIndex: stop.sectionIndex,
    totalSections: chapter?.sectionCount || 0,
    isChapterIntro: stop.type === 'chapter_intro',
    totalStops: tourPath.stops.length,
    currentStop: tourPosition,
  };
}
