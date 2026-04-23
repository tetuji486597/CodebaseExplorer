import Anthropic from '@anthropic-ai/sdk';
import 'dotenv/config';
import { supabase } from '../db/supabase.js';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

const MAIN_MODEL = 'claude-sonnet-4-6';
const FAST_MODEL = 'claude-haiku-4-5-20251001';

const PRICING: Record<string, { input: number; output: number }> = {
  [MAIN_MODEL]: { input: 3 / 1_000_000, output: 15 / 1_000_000 },
  [FAST_MODEL]: { input: 0.80 / 1_000_000, output: 4 / 1_000_000 },
};

function logUsage(
  model: string,
  inputTokens: number,
  outputTokens: number,
  operation?: string,
  projectId?: string,
): void {
  const pricing = PRICING[model] || PRICING[MAIN_MODEL];
  const cost = inputTokens * pricing.input + outputTokens * pricing.output;
  supabase
    .from('api_usage')
    .insert({
      project_id: projectId || null,
      model,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cost_usd: cost,
      operation: operation || 'unknown',
    })
    .then(({ error }) => {
      if (error) console.error('[usage] Failed to log:', error.message);
    });
}

export interface StructuredCallOptions {
  system: string;
  prompt: string;
  schema: Record<string, unknown>;
  schemaName: string;
  maxTokens?: number;
  model?: 'main' | 'fast';
  operation?: string;
  projectId?: string;
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
      }, {
        timeout: 60_000, // 60s — fail fast rather than hang for 10min default
      });

      const toolBlock = response.content.find((b) => b.type === 'tool_use');
      if (!toolBlock || toolBlock.type !== 'tool_use') {
        throw new Error('No tool_use response from Claude');
      }

      if (response.usage) {
        logUsage(model, response.usage.input_tokens, response.usage.output_tokens, opts.operation, opts.projectId);
      }

      const input = toolBlock.input as T;
      console.log(`[claude] ${opts.schemaName} response keys: ${Object.keys(input as any || {}).join(', ')}`);
      return input;
    } catch (err: any) {
      const isRetryable = err?.status === 429
        || err?.code === 'ETIMEDOUT'
        || err?.code === 'ECONNRESET'
        || err?.name === 'TimeoutError'
        || (err?.message && err.message.includes('timed out'));

      if (isRetryable && attempt < maxRetries - 1) {
        const retryAfter = typeof err?.headers?.get === 'function'
          ? parseInt(err.headers.get('retry-after') || '5', 10)
          : 5;
        const waitTime = Math.min(retryAfter * 1000, 30_000); // Cap at 30s
        console.log(`[claude] ${err?.status || err?.code || 'timeout'}, waiting ${waitTime / 1000}s before retry ${attempt + 1}/${maxRetries}...`);
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
  operation?: string;
  projectId?: string;
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
      try {
        const finalMessage = await stream.finalMessage();
        if (finalMessage.usage) {
          logUsage(model, finalMessage.usage.input_tokens, finalMessage.usage.output_tokens, opts.operation, opts.projectId);
        }
      } catch {}
    },
  };
}

export { anthropic, MAIN_MODEL, FAST_MODEL };
