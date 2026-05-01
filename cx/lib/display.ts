const isColorSupported = process.stdout.isTTY && !process.env.NO_COLOR;

const ansi = {
  reset: isColorSupported ? '\x1b[0m' : '',
  bold: isColorSupported ? '\x1b[1m' : '',
  dim: isColorSupported ? '\x1b[2m' : '',
  italic: isColorSupported ? '\x1b[3m' : '',
  underline: isColorSupported ? '\x1b[4m' : '',

  black: isColorSupported ? '\x1b[30m' : '',
  white: isColorSupported ? '\x1b[37m' : '',
  gray: isColorSupported ? '\x1b[90m' : '',

  red: isColorSupported ? '\x1b[31m' : '',
  green: isColorSupported ? '\x1b[32m' : '',
  yellow: isColorSupported ? '\x1b[33m' : '',
  blue: isColorSupported ? '\x1b[34m' : '',
  magenta: isColorSupported ? '\x1b[35m' : '',
  cyan: isColorSupported ? '\x1b[36m' : '',

  bgBlue: isColorSupported ? '\x1b[44m' : '',
  bgMagenta: isColorSupported ? '\x1b[45m' : '',
  bgCyan: isColorSupported ? '\x1b[46m' : '',
  bgGreen: isColorSupported ? '\x1b[42m' : '',
  bgYellow: isColorSupported ? '\x1b[43m' : '',
  bgRed: isColorSupported ? '\x1b[41m' : '',
  bgWhite: isColorSupported ? '\x1b[47m' : '',
};

const CONCEPT_COLORS: Record<string, string> = {
  teal: ansi.cyan,
  purple: ansi.magenta,
  coral: ansi.red,
  blue: ansi.blue,
  amber: ansi.yellow,
  pink: ansi.magenta,
  green: ansi.green,
  gray: ansi.gray,
};

const IMPORTANCE_BADGE: Record<string, string> = {
  critical: `${ansi.bold}${ansi.red}critical${ansi.reset}`,
  important: `${ansi.yellow}important${ansi.reset}`,
  supporting: `${ansi.gray}supporting${ansi.reset}`,
};

export interface ConceptData {
  id: string;
  name: string;
  one_liner: string;
  importance: string;
  color: string;
  file_ids: string[];
  explanation: string;
}

export interface EdgeData {
  source: string;
  target: string;
  relationship: string;
}

function colorFor(concept: ConceptData): string {
  return CONCEPT_COLORS[concept.color] || ansi.gray;
}

function wrapText(text: string, maxWidth: number, indent: string): string {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    if (current && (current.length + word.length + 1) > maxWidth) {
      lines.push(current);
      current = word;
    } else {
      current = current ? `${current} ${word}` : word;
    }
  }
  if (current) lines.push(current);

  return lines.join(`\n${indent}`);
}

export function renderConceptMap(concepts: ConceptData[], edges: EdgeData[]): string {
  const lines: string[] = [];
  const w = Math.min(process.stdout.columns || 80, 80);

  // Sort: critical first, then important, then supporting
  const order: Record<string, number> = { critical: 0, important: 1, supporting: 2 };
  const sorted = [...concepts].sort((a, b) => (order[a.importance] ?? 2) - (order[b.importance] ?? 2));

  // Header
  lines.push('');
  lines.push(`  ${ansi.bold}Concept Map${ansi.reset}  ${ansi.dim}${concepts.length} concepts, ${edges.length} connections${ansi.reset}`);
  lines.push(`  ${ansi.dim}${'─'.repeat(w - 4)}${ansi.reset}`);
  lines.push('');

  // Render each concept
  for (const c of sorted) {
    const color = colorFor(c);
    const badge = IMPORTANCE_BADGE[c.importance] || '';
    const fileCount = c.file_ids.length;

    lines.push(`  ${color}${ansi.bold}${c.name}${ansi.reset}  ${badge}  ${ansi.dim}${fileCount} file${fileCount !== 1 ? 's' : ''}${ansi.reset}`);

    if (c.one_liner) {
      lines.push(`  ${ansi.dim}${c.one_liner}${ansi.reset}`);
    }

    // Show edges FROM this concept
    const outgoing = edges.filter(e => e.source === c.id);
    if (outgoing.length > 0) {
      const targets = outgoing.map(e => {
        const target = concepts.find(t => t.id === e.target);
        if (!target) return null;
        const tc = colorFor(target);
        return `${tc}${target.name}${ansi.reset}`;
      }).filter(Boolean);

      if (targets.length > 0) {
        lines.push(`  ${ansi.dim}  -> ${targets.join(', ')}${ansi.reset}`);
      }
    }

    lines.push('');
  }

  return lines.join('\n');
}

export function renderAnswer(text: string): string {
  const w = Math.min(process.stdout.columns || 80, 74);
  const wrapped = wrapText(text.trim(), w, '  ');

  return `\n  ${ansi.bold}Answer${ansi.reset}\n  ${ansi.dim}${'─'.repeat(Math.min(w, 40))}${ansi.reset}\n  ${wrapped}\n`;
}

export function renderShareLink(url: string): string {
  return `\n  ${ansi.dim}Explore the full map:${ansi.reset}\n  ${ansi.bold}${ansi.underline}${url}${ansi.reset}\n`;
}

export function renderStage(label: string, done?: boolean): string {
  if (done) {
    return `${ansi.green}done${ansi.reset}`;
  }
  return `  ${ansi.dim}${label}${ansi.reset}`;
}

export function renderChatHeader(repoName: string, conceptCount: number): string {
  const w = Math.min(process.stdout.columns || 80, 80);
  const lines: string[] = [];
  lines.push('');
  lines.push(`  ${ansi.bold}gui chat${ansi.reset}  ${ansi.dim}${repoName}  ${conceptCount} concepts mapped${ansi.reset}`);
  lines.push(`  ${ansi.dim}${'─'.repeat(w - 4)}${ansi.reset}`);
  lines.push('');
  return lines.join('\n');
}

export function renderChatInstructions(): string {
  return `  ${ansi.dim}Ask about architecture, data flows, or how anything works. Type /quit to exit.${ansi.reset}\n`;
}

export function renderChatResponse(text: string): string {
  // Strip [[concept:x]] and [[file:x]] markup, keep the label
  const clean = text.replace(/\[\[(concept|file):([^\]]+)\]\]/g, (_, type, val) => {
    if (type === 'concept') return `${ansi.cyan}${val}${ansi.reset}`;
    return `${ansi.dim}${val}${ansi.reset}`;
  });
  return clean;
}

export function renderFollowUpHint(mode: 'analyzed' | 'chat' = 'chat'): string {
  if (mode === 'analyzed') {
    return `\n  ${ansi.dim}Ask a question: gui "how does authentication work?"${ansi.reset}\n  ${ansi.dim}Interactive mode: gui chat${ansi.reset}\n`;
  }
  return `\n  ${ansi.dim}Follow up: gui "your next question" or gui chat for interactive mode${ansi.reset}\n`;
}

interface GraphOperation {
  type: string;
  parent_concept_id?: string;
  sub_concepts?: Array<{ id: string; name: string; one_liner: string; file_ids?: string[] }>;
  sub_edges?: Array<{ source: string; target: string; label: string }>;
  path?: string[];
  path_label?: string;
  concept_id?: string;
  file_ids?: string[];
  source?: string;
  target?: string;
  edge_label?: string;
}

interface GraphExpansionResult {
  operations: GraphOperation[];
  auto_collapse: string[];
}

export function renderGraphExpansion(graphOps: GraphExpansionResult, conceptNames: Record<string, string>): string {
  if (!graphOps.operations.length) return '';

  const lines: string[] = [];
  lines.push(`\n  ${ansi.dim}${'─'.repeat(36)}${ansi.reset}`);
  lines.push(`  ${ansi.bold}Graph Update${ansi.reset}`);

  for (const op of graphOps.operations) {
    if (op.type === 'expand_concept' && op.sub_concepts?.length) {
      const parentName = conceptNames[op.parent_concept_id || ''] || op.parent_concept_id;
      lines.push(`  ${ansi.cyan}▸${ansi.reset} ${ansi.bold}${parentName}${ansi.reset} expanded:`);
      op.sub_concepts.forEach((sc, i) => {
        const isLast = i === op.sub_concepts!.length - 1;
        const prefix = isLast ? '└─' : '├─';
        const fileCount = sc.file_ids?.length || 0;
        const fileStr = fileCount > 0 ? `${ansi.dim}${fileCount} files${ansi.reset}` : '';
        lines.push(`    ${prefix} ${sc.name}  ${fileStr}`);
      });
      if (op.sub_edges?.length) {
        for (const edge of op.sub_edges) {
          const srcName = op.sub_concepts.find(sc => sc.id === edge.source)?.name || edge.source;
          const tgtName = op.sub_concepts.find(sc => sc.id === edge.target)?.name || edge.target;
          lines.push(`    ${ansi.dim}  └→ ${srcName} ${edge.label} ${tgtName}${ansi.reset}`);
        }
      }
    } else if (op.type === 'highlight_path' && op.path?.length) {
      const pathNames = op.path.map(id => conceptNames[id] || id);
      lines.push(`  ${ansi.cyan}▸${ansi.reset} Path: ${pathNames.join(` ${ansi.dim}→${ansi.reset} `)}`);
      if (op.path_label) {
        lines.push(`    ${ansi.dim}"${op.path_label}"${ansi.reset}`);
      }
    } else if (op.type === 'focus_files' && op.file_ids?.length) {
      const conceptName = conceptNames[op.concept_id || ''] || op.concept_id;
      lines.push(`  ${ansi.cyan}▸${ansi.reset} Files in ${ansi.bold}${conceptName}${ansi.reset}:`);
      for (const fid of op.file_ids.slice(0, 5)) {
        lines.push(`    ${ansi.dim}${fid}${ansi.reset}`);
      }
    } else if (op.type === 'add_edge') {
      const srcName = conceptNames[op.source || ''] || op.source;
      const tgtName = conceptNames[op.target || ''] || op.target;
      lines.push(`  ${ansi.cyan}▸${ansi.reset} ${srcName} ${ansi.dim}──[${op.edge_label}]──▸${ansi.reset} ${tgtName}`);
    }
  }

  lines.push('');
  return lines.join('\n');
}

export { ansi };
