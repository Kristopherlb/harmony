/**
 * packages/apps/console/server/services/openai-agent-service.otel.test.ts
 * TDD: OTel spans are emitted for the chat blueprint generation flow.
 */
import { describe, expect, it, vi } from 'vitest';

const capturedSpans = vi.hoisted(() => [] as Array<{ name: string; ctx: any; span: any }>);

vi.mock('@ai-sdk/openai', () => {
  return {
    openai: (model: string) => ({ model }),
  };
});

vi.mock('ai', () => {
  const streamText = (opts: any) => {
    if (typeof opts?.onFinish === 'function') {
      opts.onFinish({
        usage: { promptTokens: 10, completionTokens: 20 },
      });
    }
    return {
      toUIMessageStream: () => ({ __kind: 'ui-stream' }),
      response: Promise.resolve({ messages: [] }),
    };
  };

  return {
    // Only the pieces used by openai-agent-service.ts
    convertToModelMessages: async (_messages: unknown) => [{ role: 'user', content: 'hi' }],
    createUIMessageStream: ({ execute }: any) => {
      const writer = {
        write: vi.fn(),
        merge: vi.fn(),
      };
      void execute({ writer });
      return { __kind: 'ui-message-stream', writer };
    },
    streamText,
    tool: (def: any) => def,
  };
});

vi.mock('@golden/core', async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    withGoldenSpan: vi.fn(async (name: string, ctx: any, _componentType: any, fn: (span: any) => Promise<any>) => {
      const span = {
        setAttribute: vi.fn(),
        setStatus: vi.fn(),
        recordException: vi.fn(),
        end: vi.fn(),
      };
      capturedSpans.push({ name, ctx, span });
      return await fn(span);
    }),
  };
});

describe('OpenAIAgentService OTel instrumentation', () => {
  it('creates root + step spans and records LLM usage attributes', async () => {
    vi.resetModules();
    const { OpenAIAgentService } = await import('./openai-agent-service');

    await OpenAIAgentService.generateBlueprint({
      messages: [{ id: 'u1', role: 'user', content: 'hello' }],
      tools: [],
      budgetKey: 'user:123',
    });
    // The service executes inside the stream; allow microtasks to flush.
    await new Promise((r) => setTimeout(r, 0));

    const names = capturedSpans.map((s) => s.name);
    expect(names).toEqual(
      expect.arrayContaining([
        'console.chat.generate_blueprint',
        'console.chat.llm.planning',
        'console.chat.llm.summary',
      ])
    );

    const planning = capturedSpans.find((s) => s.name === 'console.chat.llm.planning');
    expect(planning?.ctx?.app_id).toBe('console');
    expect(planning?.ctx?.initiator_id).toBe('user:123');
    expect(planning?.span?.setAttribute).toHaveBeenCalledWith('ai.usage.input_tokens', 10);
    expect(planning?.span?.setAttribute).toHaveBeenCalledWith('ai.usage.output_tokens', 20);
  });
});

