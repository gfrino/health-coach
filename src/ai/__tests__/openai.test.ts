import {
  collectOpenAIStream,
  isReasoningModel,
  openaiProvider,
  toOpenAIInput,
} from '../providers/openai';

async function* events(chunks: unknown[]) {
  for (const c of chunks) yield { data: typeof c === 'string' ? c : JSON.stringify(c) };
}

describe('OpenAI adapter (Responses API)', () => {
  it('accumula testo in streaming, tool call e usage', async () => {
    const tokens: string[] = [];
    const reasoning = { type: 'reasoning', id: 'rs_1', encrypted_content: 'ENC', summary: [] };
    const call = {
      type: 'function_call',
      id: 'fc_1',
      call_id: 'call_1',
      name: 'get_metric',
      arguments: '{"type":"steps"}',
      status: 'completed',
    };
    const res = await collectOpenAIStream(
      events([
        { type: 'response.output_text.delta', delta: 'Ciao' },
        { type: 'response.output_text.delta', delta: '!' },
        { type: 'response.output_item.done', item: reasoning },
        { type: 'response.output_item.done', item: call },
        {
          type: 'response.completed',
          response: {
            status: 'completed',
            output: [
              reasoning,
              { type: 'message', content: [{ type: 'output_text', text: 'Ciao!' }] },
              call,
            ],
            usage: { input_tokens: 120, output_tokens: 30 },
          },
        },
      ]),
      'gpt-6.1',
      (d) => tokens.push(d),
    );
    expect(tokens.join('')).toBe('Ciao!');
    expect(res.text).toBe('Ciao!');
    expect(res.toolCalls).toEqual([
      { id: 'call_1', name: 'get_metric', arguments: { type: 'steps' } },
    ]);
    expect(res.stopReason).toBe('tool_use');
    expect(res.usage).toEqual({ inputTokens: 120, outputTokens: 30 });
    expect(res.raw?.provider).toBe('openai');
  });

  it('segnala il troncamento per max_output_tokens', async () => {
    const res = await collectOpenAIStream(
      events([
        { type: 'response.output_text.delta', delta: 'Parz' },
        {
          type: 'response.incomplete',
          response: {
            status: 'incomplete',
            incomplete_details: { reason: 'max_output_tokens' },
            output: [],
          },
        },
      ]),
      'gpt-6.1',
    );
    expect(res.text).toBe('Parz');
    expect(res.stopReason).toBe('max_tokens');
  });

  it('traduce la conversazione e rinvia gli item originali senza id', () => {
    const input = toOpenAIInput([
      { role: 'user', content: 'Ciao', images: [{ mimeType: 'image/png', base64: 'AAA' }] },
      {
        role: 'assistant',
        content: '',
        toolCalls: [{ id: 'c1', name: 'get_journal', arguments: { from: '2026-01-01' } }],
        raw: {
          provider: 'openai',
          model: 'gpt-6.1',
          data: [
            { type: 'reasoning', id: 'rs_1', encrypted_content: 'ENC', summary: [] },
            {
              type: 'function_call',
              id: 'fc_1',
              call_id: 'c1',
              name: 'get_journal',
              arguments: '{"from":"2026-01-01"}',
              status: 'completed',
            },
          ],
        },
      },
      { role: 'tool', toolCallId: 'c1', toolName: 'get_journal', content: '[]' },
      { role: 'assistant', content: 'Fatto.' },
    ]);
    expect(input[0]).toMatchObject({
      role: 'user',
      content: [
        { type: 'input_image', image_url: 'data:image/png;base64,AAA' },
        { type: 'input_text', text: 'Ciao' },
      ],
    });
    expect(input[1]).toEqual({ type: 'reasoning', encrypted_content: 'ENC', summary: [] });
    expect(input[2]).toEqual({
      type: 'function_call',
      call_id: 'c1',
      name: 'get_journal',
      arguments: '{"from":"2026-01-01"}',
    });
    expect(input[3]).toEqual({ type: 'function_call_output', call_id: 'c1', output: '[]' });
    expect(input[4]).toEqual({
      role: 'assistant',
      content: [{ type: 'output_text', text: 'Fatto.' }],
    });
  });

  it('riconosce i modelli con ragionamento', () => {
    expect(isReasoningModel('gpt-6.1-sol')).toBe(true);
    expect(isReasoningModel('gpt-5.2')).toBe(true);
    expect(isReasoningModel('o3')).toBe(true);
    expect(isReasoningModel('gpt-4.1')).toBe(false);
  });

  it('suggerisce il modello di punta più recente, non mini', () => {
    const pick = openaiProvider.pickDefaultModel([
      { id: 'gpt-4o', displayName: '' },
      { id: 'gpt-5-mini', displayName: '' },
      { id: 'gpt-5.2-2026-01-01', displayName: '' },
      { id: 'gpt-5.2', displayName: '' },
    ]);
    expect(pick).toBe('gpt-5.2');
  });
});
