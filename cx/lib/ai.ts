import Anthropic from '@anthropic-ai/sdk';

const MAIN_MODEL = 'claude-sonnet-4-6';
const FAST_MODEL = 'claude-haiku-4-5-20251001';

let _client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!_client) {
    _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  }
  return _client;
}

export interface StructuredCallOptions {
  system: string;
  prompt: string;
  schema: Record<string, unknown>;
  schemaName: string;
  maxTokens?: number;
  model?: 'main' | 'fast';
}

export async function callClaudeStructured<T>(opts: StructuredCallOptions): Promise<T> {
  const model = opts.model === 'fast' ? FAST_MODEL : MAIN_MODEL;
  const maxRetries = 3;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await getClient().messages.create({
        model,
        max_tokens: opts.maxTokens || 4096,
        system: [
          {
            type: 'text' as const,
            text: opts.system,
            cache_control: { type: 'ephemeral' as const },
          },
        ],
        messages: [{ role: 'user', content: opts.prompt }],
        tools: [
          {
            name: opts.schemaName,
            description: `Return structured data matching the ${opts.schemaName} schema`,
            input_schema: opts.schema as Anthropic.Messages.Tool.InputSchema,
          },
        ],
        tool_choice: { type: 'tool', name: opts.schemaName },
      }, {
        timeout: 60_000,
      });

      const toolBlock = response.content.find((b) => b.type === 'tool_use');
      if (!toolBlock || toolBlock.type !== 'tool_use') {
        throw new Error('No tool_use response from Claude');
      }

      return toolBlock.input as T;
    } catch (err: unknown) {
      const e = err as Record<string, unknown>;
      const isRetryable = e?.status === 429
        || e?.code === 'ETIMEDOUT'
        || e?.code === 'ECONNRESET'
        || e?.name === 'TimeoutError';

      if (isRetryable && attempt < maxRetries - 1) {
        const waitTime = Math.min((attempt + 1) * 5000, 30_000);
        await new Promise((r) => setTimeout(r, waitTime));
        continue;
      }
      throw err;
    }
  }

  throw new Error('Max retries exceeded');
}
