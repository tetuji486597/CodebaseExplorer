// All JSON schemas for structured Claude outputs

export const fileAnalysisSchema = {
  type: 'object',
  properties: {
    files: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          path: { type: 'string' },
          purpose: { type: 'string' },
          concepts: { type: 'array', items: { type: 'string' } },
          key_exports: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                what_it_does: { type: 'string' },
              },
              required: ['name', 'what_it_does'],
            },
          },
          depends_on: { type: 'array', items: { type: 'string' } },
          complexity: { type: 'string', enum: ['simple', 'moderate', 'complex'] },
          role: {
            type: 'string',
            enum: ['entry_point', 'core_logic', 'data', 'ui', 'utility', 'config', 'test', 'types'],
          },
        },
        required: ['path', 'purpose', 'concepts', 'key_exports', 'depends_on', 'complexity', 'role'],
      },
    },
  },
  required: ['files'],
};

export const conceptSynthesisSchema = {
  type: 'object',
  properties: {
    concepts: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          color: { type: 'string', enum: ['teal', 'purple', 'coral', 'blue', 'amber', 'pink', 'green', 'gray'] },
          metaphor: { type: 'string' },
          one_liner: { type: 'string' },
          explanation: { type: 'string' },
          deep_explanation: { type: 'string' },
          file_ids: { type: 'array', items: { type: 'string' } },
          importance: { type: 'string', enum: ['critical', 'important', 'supporting'] },
        },
        required: ['id', 'name', 'color', 'metaphor', 'one_liner', 'explanation', 'deep_explanation', 'file_ids', 'importance'],
      },
    },
    edges: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          source: { type: 'string' },
          target: { type: 'string' },
          relationship: { type: 'string' },
          strength: { type: 'string', enum: ['strong', 'moderate', 'weak'] },
        },
        required: ['source', 'target', 'relationship', 'strength'],
      },
    },
    suggested_starting_concept: { type: 'string' },
    codebase_summary: { type: 'string' },
  },
  required: ['concepts', 'edges', 'suggested_starting_concept', 'codebase_summary'],
};

export const insightSchema = {
  type: 'object',
  properties: {
    insights: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          category: { type: 'string', enum: ['architecture', 'risk', 'pattern', 'praise', 'suggestion', 'complexity'] },
          summary: { type: 'string' },
          detail: { type: 'string' },
          related_concept_ids: { type: 'array', items: { type: 'string' } },
          related_file_paths: { type: 'array', items: { type: 'string' } },
          priority: { type: 'integer' },
          requires_understanding: { type: 'array', items: { type: 'string' } },
        },
        required: ['title', 'category', 'summary', 'detail', 'related_concept_ids', 'related_file_paths', 'priority', 'requires_understanding'],
      },
    },
  },
  required: ['insights'],
};

export const depthMappingSchema = {
  type: 'object',
  properties: {
    concepts: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          beginner_explanation: { type: 'string' },
          intermediate_explanation: { type: 'string' },
          advanced_explanation: { type: 'string' },
        },
        required: ['id', 'beginner_explanation', 'intermediate_explanation', 'advanced_explanation'],
      },
    },
  },
  required: ['concepts'],
};

export const relationshipDepthSchema = {
  type: 'object',
  properties: {
    edges: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          source: { type: 'string' },
          target: { type: 'string' },
          explanation: { type: 'string' },
        },
        required: ['source', 'target', 'explanation'],
      },
    },
  },
  required: ['edges'],
};

export const quizGenerationSchema = {
  type: 'object',
  properties: {
    questions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          concept_id: { type: 'string' },
          question_type: { type: 'string', enum: ['multiple_choice', 'matching', 'ordering', 'fill_blank'] },
          difficulty: { type: 'string', enum: ['beginner', 'intermediate', 'advanced'] },
          question_text: { type: 'string' },
          code_snippet: { type: 'string' },
          options: { type: 'object' },
          correct_answer: { type: 'object' },
          explanation: { type: 'string' },
          related_file_paths: { type: 'array', items: { type: 'string' } },
        },
        required: ['concept_id', 'question_type', 'difficulty', 'question_text', 'options', 'correct_answer', 'explanation'],
      },
    },
  },
  required: ['questions'],
};

export const graphExpansionSchema = {
  type: 'object',
  properties: {
    operations: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: ['expand_concept', 'highlight_path', 'focus_files', 'add_edge'],
          },
          parent_concept_id: { type: 'string' },
          sub_concepts: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                name: { type: 'string' },
                one_liner: { type: 'string' },
                color: { type: 'string', enum: ['teal', 'purple', 'coral', 'blue', 'amber', 'pink', 'green', 'gray'] },
                importance: { type: 'string', enum: ['critical', 'important', 'supporting'] },
                file_ids: { type: 'array', items: { type: 'string' } },
              },
              required: ['id', 'name', 'one_liner', 'color', 'importance'],
            },
          },
          sub_edges: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                source: { type: 'string' },
                target: { type: 'string' },
                label: { type: 'string' },
              },
              required: ['source', 'target', 'label'],
            },
          },
          path: { type: 'array', items: { type: 'string' } },
          path_label: { type: 'string' },
          file_ids: { type: 'array', items: { type: 'string' } },
          concept_id: { type: 'string' },
          source: { type: 'string' },
          target: { type: 'string' },
          edge_label: { type: 'string' },
        },
        required: ['type'],
      },
    },
    auto_collapse: {
      type: 'array',
      items: { type: 'string' },
    },
  },
  required: ['operations', 'auto_collapse'],
};

export const subConceptGenerationSchema = {
  type: 'object',
  properties: {
    sub_concepts: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          one_liner: { type: 'string' },
          color: { type: 'string', enum: ['teal', 'purple', 'coral', 'blue', 'amber', 'pink', 'green', 'gray'] },
          importance: { type: 'string', enum: ['critical', 'important', 'supporting'] },
          file_ids: { type: 'array', items: { type: 'string' } },
          has_further_depth: { type: 'boolean' },
          display_order: { type: 'number' },
        },
        required: ['id', 'name', 'one_liner', 'color', 'importance', 'has_further_depth', 'display_order'],
      },
    },
    sub_edges: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          source: { type: 'string' },
          target: { type: 'string' },
          label: { type: 'string' },
        },
        required: ['source', 'target', 'label'],
      },
    },
  },
  required: ['sub_concepts', 'sub_edges'],
};

export const proactiveSeedingSchema = {
  type: 'object',
  properties: {
    exploration_path: {
      type: 'array',
      items: { type: 'string' },
    },
    reasoning: { type: 'string' },
  },
  required: ['exploration_path', 'reasoning'],
};
