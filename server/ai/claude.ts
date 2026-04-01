import Anthropic from '@anthropic-ai/sdk';
import 'dotenv/config';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

const MAIN_MODEL = 'claude-sonnet-4-6';
const FAST_MODEL = 'claude-haiku-4-5-20251001';

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
  const maxRetries = 5;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await anthropic.messages.create({
        model,
        max_tokens: opts.maxTokens || 4096,
        system: opts.system,
        messages: [{ role: 'user', content: opts.prompt }],
        tools: [
          {
            name: opts.schemaName,
            description: `Return structured data matching the ${opts.schemaName} schema`,
            input_schema: opts.schema as Anthropic.Messages.Tool.InputSchema,
          },
        ],
        tool_choice: { type: 'tool', name: opts.schemaName },
      });

      const toolBlock = response.content.find((b) => b.type === 'tool_use');
      if (!toolBlock || toolBlock.type !== 'tool_use') {
        throw new Error('No tool_use response from Claude');
      }

      return toolBlock.input as T;
    } catch (err: any) {
      if (err?.status === 429 && attempt < maxRetries - 1) {
        const retryAfter = parseInt(err?.headers?.get?.('retry-after') || '65', 10);
        const waitTime = Math.max(retryAfter, 65) * 1000;
        console.log(`Rate limited, waiting ${waitTime / 1000}s before retry ${attempt + 1}/${maxRetries}...`);
        await new Promise((r) => setTimeout(r, waitTime));
        continue;
      }
      throw err;
    }
  }

  throw new Error('Max retries exceeded');
}

export async function streamClaude(opts: {
  system: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  maxTokens?: number;
  model?: 'main' | 'fast';
}): Promise<AsyncIterable<string>> {
  const model = opts.model === 'fast' ? FAST_MODEL : MAIN_MODEL;

  const stream = anthropic.messages.stream({
    model,
    max_tokens: opts.maxTokens || 1024,
    system: opts.system,
    messages: opts.messages,
  });

  return {
    async *[Symbol.asyncIterator]() {
      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          yield event.delta.text;
        }
      }
    },
  };
}

export { anthropic, MAIN_MODEL, FAST_MODEL };
