import { useMemo } from 'react';
import useStore from '../store/useStore';
import { Sparkles, MessageCircle } from 'lucide-react';

/**
 * Extract key topics from the last assistant response to generate follow-ups.
 * Returns an array of { topic, type } objects.
 */
function extractTopics(text, concepts) {
  const topics = [];

  // Find concept references [[concept:x]]
  const conceptRefs = [...text.matchAll(/\[\[concept:([^\]]+)\]\]/g)];
  for (const m of conceptRefs) {
    const c = concepts.find(c => c.id === m[1]);
    if (c) topics.push({ name: c.name, id: c.id, type: 'concept' });
  }

  // Find file references [[file:x]]
  const fileRefs = [...text.matchAll(/\[\[file:([^\]]+)\]\]/g)];
  for (const m of fileRefs) {
    topics.push({ name: m[1].split('/').pop(), path: m[1], type: 'file' });
  }

  // Find API routes mentioned
  const routeRefs = [...text.matchAll(/\b(GET|POST|PUT|DELETE|PATCH)\s+(\/[\w/:.-]+)/g)];
  for (const m of routeRefs) {
    topics.push({ name: `${m[1]} ${m[2]}`, method: m[1], path: m[2], type: 'route' });
  }

  // Find concept names mentioned in plain text
  for (const c of concepts) {
    if (c.name && c.name.length > 3 && text.toLowerCase().includes(c.name.toLowerCase())) {
      if (!topics.some(t => t.id === c.id)) {
        topics.push({ name: c.name, id: c.id, type: 'concept' });
      }
    }
  }

  return topics;
}

/**
 * Generate follow-up questions based on the last assistant response.
 */
function generateFollowUps(lastResponse, concepts, conceptEdges, files) {
  const topics = extractTopics(lastResponse, concepts);
  const qs = [];

  // Detect if the response was about a flow/process
  const isFlowExplanation = /flow|step|stage|pipeline|process|sequence|when.*happens/i.test(lastResponse);
  const isArchExplanation = /architecture|structure|pattern|design|layer/i.test(lastResponse);
  const mentionsError = /error|fail|catch|exception|bug|issue/i.test(lastResponse);

  if (topics.length > 0) {
    const primary = topics[0];

    if (primary.type === 'concept') {
      // Ask about deeper internals or connections
      const neighbors = conceptEdges
        .filter(e => e.source === primary.id || e.target === primary.id)
        .map(e => e.source === primary.id ? e.target : e.source);
      const unexplored = neighbors.find(n => !topics.some(t => t.id === n));
      const neighborConcept = unexplored ? concepts.find(c => c.id === unexplored) : null;

      if (neighborConcept) {
        qs.push(`How does ${primary.name} interact with ${neighborConcept.name}?`);
      }
      qs.push(`What would break if I changed ${primary.name}?`);
    }

    if (primary.type === 'file') {
      qs.push(`Who calls ${primary.name} and when?`);
      qs.push(`What would I need to change in ${primary.name} to add a new feature?`);
    }

    if (primary.type === 'route') {
      qs.push(`What validation happens on ${primary.name}?`);
      qs.push(`What does the error handling look like for ${primary.name}?`);
    }

    // If multiple concepts were mentioned, ask about their relationship
    const conceptTopics = topics.filter(t => t.type === 'concept');
    if (conceptTopics.length >= 2) {
      qs.push(`What data flows between ${conceptTopics[0].name} and ${conceptTopics[1].name}?`);
    }

    // If files were mentioned, ask about the code
    const fileTopics = topics.filter(t => t.type === 'file');
    if (fileTopics.length > 0 && !qs.some(q => q.includes(fileTopics[0].name))) {
      qs.push(`Walk me through the key functions in ${fileTopics[0].name}`);
    }
  }

  // Context-dependent generic follow-ups
  if (isFlowExplanation) {
    qs.push('What happens if something fails during this process?');
    qs.push('Where would I add a new step to this flow?');
  }

  if (isArchExplanation && qs.length < 3) {
    qs.push('What are the trade-offs of this architecture?');
    qs.push('Where would technical debt accumulate here?');
  }

  if (mentionsError && qs.length < 3) {
    qs.push('How does the app recover from this failure?');
  }

  // Fallback: ask to go deeper or broader
  if (qs.length < 2) {
    qs.push('Can you explain that in more detail?');
    qs.push('What else should I know about this area?');
  }

  // Deduplicate and limit
  const unique = [...new Set(qs)];
  return unique.slice(0, 3);
}

export default function SuggestedQuestions({ onSelect, compact, followUp, lastResponse }) {
  const selectedNode = useStore(s => s.selectedNode);
  const concepts = useStore(s => s.concepts);
  const conceptEdges = useStore(s => s.conceptEdges);
  const projectMeta = useStore(s => s.projectMeta);
  const insights = useStore(s => s.insights);
  const files = useStore(s => s.files);

  const questions = useMemo(() => {
    // Follow-up mode: generate questions based on last response
    if (followUp && lastResponse) {
      return generateFollowUps(lastResponse, concepts, conceptEdges, files);
    }

    // Initial mode: context-based starter questions
    const qs = [];

    if (selectedNode?.type === 'concept') {
      const concept = concepts.find(c => c.id === selectedNode.id);
      const name = concept?.name || selectedNode.id;

      qs.push(`How does ${name} work under the hood?`);
      qs.push(`What files implement ${name}?`);

      const neighbors = conceptEdges
        .filter(e => e.source === selectedNode.id || e.target === selectedNode.id)
        .map(e => e.source === selectedNode.id ? e.target : e.source);
      if (neighbors.length > 0) {
        const neighborConcept = concepts.find(c => c.id === neighbors[0]);
        if (neighborConcept) {
          qs.push(`How does ${name} connect to ${neighborConcept.name}?`);
        }
      }

      qs.push(`What are the key data flows through ${name}?`);
    } else if (selectedNode?.type === 'file') {
      const filename = selectedNode.id.split('/').pop();
      qs.push(`Explain what ${filename} does`);
      qs.push(`What concept does ${filename} belong to?`);
      const file = files.find(f => f.id === selectedNode.id);
      if (file?.exports?.length > 0) {
        qs.push(`What does ${file.exports[0].name} do in ${filename}?`);
      }
    } else {
      const framework = projectMeta?.framework;
      qs.push('Walk me through the architecture of this project');
      if (framework) {
        qs.push(`What are the main ${framework} patterns used here?`);
      }
      if (concepts.length > 0) {
        qs.push('Which concepts are most tightly coupled?');
      }
      if (insights?.length > 0) {
        qs.push('What are the potential risks or code smells?');
      }
      if (concepts.length > 2) {
        qs.push(`What happens when a user interacts with ${concepts[0]?.name}?`);
      }
    }

    return qs.slice(0, compact ? 3 : 5);
  }, [selectedNode, concepts, conceptEdges, projectMeta, insights, files, compact, followUp, lastResponse]);

  if (questions.length === 0) return null;

  const isFollowUp = followUp && lastResponse;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
        {isFollowUp ? (
          <MessageCircle size={12} strokeWidth={1.75} style={{ color: 'var(--color-text-tertiary)' }} />
        ) : (
          <Sparkles size={12} strokeWidth={1.75} style={{ color: 'var(--color-text-tertiary)' }} />
        )}
        <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          {isFollowUp ? 'Follow up' : 'Suggested'}
        </span>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {questions.map((q, i) => (
          <button
            key={q}
            onClick={() => onSelect(q)}
            style={{
              padding: '7px 14px',
              borderRadius: 20,
              fontSize: 12,
              fontWeight: 450,
              lineHeight: 1.3,
              color: 'var(--color-text-secondary)',
              background: 'var(--color-bg-elevated)',
              border: '1px solid var(--color-border-subtle)',
              cursor: 'pointer',
              transition: 'all 150ms ease-out',
              textAlign: 'left',
              animation: `chat-msg-in 200ms ease-out ${i * 60}ms both`,
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = 'var(--color-accent)';
              e.currentTarget.style.color = 'var(--color-accent-active)';
              e.currentTarget.style.background = 'var(--color-accent-soft)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = 'var(--color-border-subtle)';
              e.currentTarget.style.color = 'var(--color-text-secondary)';
              e.currentTarget.style.background = 'var(--color-bg-elevated)';
            }}
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}
