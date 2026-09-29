import { collectOpenAIStream, openaiProvider, toOpenAIMessages } from '../providers/openai';

async function* events(chunks: unknown[]) {
  for (const c of chunks) yield { data: typeof c === 'string' ? c : JSON.stringify(c) };
}

describe('OpenAI adapter', () => {
  it('accumula testo, tool call a pezzi e usage', async () => {
    const tokens: string[] = [];
    const res = await collectOpenAIStream(
      events([
        { choices: [{ delta: { content: 'Ciao' } }] },
        { choices: [{ delta: { content: '!' } }] },
        {
          choices: [
            {
              delta: {
                tool_calls: [
                  {
                    index: 0,
                    id: 'call_1',
                    function: { name: 'get_metric', arguments: '{"type":' },
                  },
                ],
              },
            },
          ],
        },
        {
          choices: [
            {
              delta: { tool_calls: [{ index: 0, function: { arguments: '"steps"}' } }] },
              finish_reason: 'tool_calls',
            },
          ],
        },
        { choices: [], usage: { prompt_tokens: 120, completion_tokens: 30 } },
        '[DONE]',
      ]),
      (d) => tokens.push(d),
    );
    expect(tokens.join('')).toBe('Ciao!');
    expect(res.text).toBe('Ciao!');
    expect(res.toolCalls).toEqual([
      { id: 'call_1', name: 'get_metric', arguments: { type: 'steps' } },
    ]);
    expect(res.stopReason).toBe('tool_use');
    expect(res.usage).toEqual({ inputTokens: 120, outputTokens: 30 });
  });

  it('traduce la conversazione neutra nel formato Chat Completions', () => {
    const msgs = toOpenAIMessages('SYS', [
      { role: 'user', content: 'Ciao', images: [{ mimeType: 'image/png', base64: 'AAA' }] },
      {
        role: 'assistant',
        content: '',
        toolCalls: [{ id: 'c1', name: 'get_journal', arguments: { from: '2026-01-01' } }],
      },
      { role: 'tool', toolCallId: 'c1', toolName: 'get_journal', content: '[]' },
    ]);
    expect(msgs[0]).toEqual({ role: 'system', content: 'SYS' });
    expect(msgs[1]).toMatchObject({
      role: 'user',
      content: [{ type: 'image_url' }, { type: 'text', text: 'Ciao' }],
    });
    expect(msgs[2]).toMatchObject({
      role: 'assistant',
      content: null,
      tool_calls: [
        {
          id: 'c1',
          type: 'function',
          function: { name: 'get_journal', arguments: '{"from":"2026-01-01"}' },
        },
      ],
    });
    expect(msgs[3]).toEqual({ role: 'tool', tool_call_id: 'c1', content: '[]' });
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
