import { callClaudeStructured } from './claude.js';
import { graphExpansionSchema } from './schemas.js';

interface ConceptSummary {
  id: string;
  name: string;
  importance: string;
  file_count: number;
}

interface EdgeSummary {
  source: string;
  target: string;
  relationship: string;
}

interface ExpansionState {
  expanded_concepts: string[];
  visible_node_count: number;
}

export interface GraphOperation {
  type: 'expand_concept' | 'highlight_path' | 'focus_files' | 'add_edge';
  parent_concept_id?: string;
  sub_concepts?: Array<{
    id: string;
    name: string;
    one_liner: string;
    color: string;
    importance: string;
    file_ids?: string[];
  }>;
  sub_edges?: Array<{
    source: string;
    target: string;
    label: string;
  }>;
  path?: string[];
  path_label?: string;
  file_ids?: string[];
  concept_id?: string;
  source?: string;
  target?: string;
  edge_label?: string;
}

export interface GraphExpansionResult {
  operations: GraphOperation[];
  auto_collapse: string[];
}

const GRAPH_EXPANSION_SYSTEM = `You decide how to update a codebase architecture graph in response to a user's question. The graph shows high-level concepts (architectural groups of files). Your job is to make the graph visually answer the question.

Rules:
- Only use concept IDs from the provided list. Never invent concept IDs.
- Sub-concept IDs must be prefixed with "exp_" followed by the parent concept ID (e.g., "exp_auth_jwt_validation").
- Sub-concepts inherit the parent's color unless there's a strong semantic reason to differ.
- Keep sub-concept count between 2-5 per expansion. More than 5 is too noisy.
- If the question is about relationships between concepts, use highlight_path instead of expand_concept.
- If the question is about specific files, use focus_files.
- Return 1-2 operations maximum. Don't over-expand.
- If the graph already has many visible nodes, recommend collapsing older expansions in auto_collapse.
- If the question is general/vague and doesn't warrant graph changes, return an empty operations array.`;

function buildPrompt(
  question: string,
  answer: string,
  concepts: ConceptSummary[],
  edges: EdgeSummary[],
  expansionState: ExpansionState,
): string {
  const conceptList = concepts
    .map(c => `  - ${c.id}: "${c.name}" (${c.importance}, ${c.file_count} files)`)
    .join('\n');

  const edgeList = edges
    .map(e => `  - ${e.source} → ${e.target}: ${e.relationship}`)
    .join('\n');

  const expandedList = expansionState.expanded_concepts.length > 0
    ? expansionState.expanded_concepts.join(', ')
    : 'none';

  return `The user asked a question about a codebase. Based on the question and the answer, decide how to update the graph.

<question>${question}</question>

<answer_summary>${answer.slice(0, 500)}</answer_summary>

<current_graph>
Concepts:
${conceptList}

Edges:
${edgeList}

Already expanded: ${expandedList}
Visible nodes: ${expansionState.visible_node_count}
Node budget: 35 maximum. Current: ${expansionState.visible_node_count}. ${expansionState.visible_node_count > 25 ? 'CLOSE TO LIMIT — recommend collapsing older expansions.' : ''}
</current_graph>

Return the graph operations that best visually answer this question.`;
}

export async function generateGraphOps(
  question: string,
  answer: string,
  concepts: ConceptSummary[],
  edges: EdgeSummary[],
  expansionState: ExpansionState = { expanded_concepts: [], visible_node_count: 0 },
  projectId?: string,
): Promise<GraphExpansionResult> {
  if (!concepts.length) {
    return { operations: [], auto_collapse: [] };
  }

  const visibleCount = expansionState.visible_node_count || concepts.length;

  try {
    const result = await callClaudeStructured<GraphExpansionResult>({
      system: GRAPH_EXPANSION_SYSTEM,
      prompt: buildPrompt(question, answer, concepts, edges, {
        ...expansionState,
        visible_node_count: visibleCount,
      }),
      schema: graphExpansionSchema,
      schemaName: 'graph_expansion',
      maxTokens: 2048,
      model: 'fast',
      operation: 'graph_expansion',
      projectId,
    });

    for (const op of result.operations) {
      if (op.type === 'expand_concept' && !op.parent_concept_id && (op as any).concept_id) {
        op.parent_concept_id = (op as any).concept_id;
      }
    }

    const validOps = result.operations.filter(op => {
      if (op.type === 'expand_concept' && op.parent_concept_id) {
        return concepts.some(c => c.id === op.parent_concept_id);
      }
      if (op.type === 'highlight_path' && op.path) {
        return op.path.every(id => concepts.some(c => c.id === id));
      }
      if (op.type === 'focus_files' && op.concept_id) {
        return concepts.some(c => c.id === op.concept_id);
      }
      if (op.type === 'add_edge' && op.source && op.target) {
        return concepts.some(c => c.id === op.source) && concepts.some(c => c.id === op.target);
      }
      return false;
    });

    const validCollapse = (result.auto_collapse || []).filter(id =>
      expansionState.expanded_concepts.includes(id)
    );

    return { operations: validOps, auto_collapse: validCollapse };
  } catch (err: unknown) {
    console.error('[graphExpansion] Failed to generate graph ops:', err);
    return { operations: [], auto_collapse: [] };
  }
}
