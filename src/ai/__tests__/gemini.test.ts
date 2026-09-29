import {
  collectGeminiStream,
  geminiProvider,
  toGeminiContents,
  toGeminiTools,
} from '../providers/gemini';

async function* events(chunks: unknown[]) {
  for (const c of chunks) yield { data: JSON.stringify(c) };
}

describe('Gemini adapter', () => {
  it('ignora i pensieri, raccoglie testo e chiamate con thoughtSignature', async () => {
    const res = await collectGeminiStream(
      events([
        { candidates: [{ content: { parts: [{ text: 'ragiono…', thought: true }] } }] },
        { candidates: [{ content: { parts: [{ text: 'Ecco ' }] } }] },
        {
          candidates: [
            {
              content: {
                parts: [
                  {
                    functionCall: { name: 'get_metric', args: { type: 'steps' } },
                    thoughtSignature: 'sig',
                  },
                ],
              },
              finishReason: 'STOP',
            },
          ],
          usageMetadata: { promptTokenCount: 50, candidatesTokenCount: 10, thoughtsTokenCount: 5 },
        },
      ]),
      'gemini-x',
    );
    expect(res.text).toBe('Ecco ');
    expect(res.stopReason).toBe('tool_use');
    expect(res.toolCalls).toEqual([
      { id: 'gemini-0', name: 'get_metric', arguments: { type: 'steps' } },
    ]);
    expect(res.usage).toEqual({ inputTokens: 50, outputTokens: 15 });
    expect(res.raw?.data).toHaveLength(3);
  });

  it('rinvia le parti originali e raggruppa le risposte delle funzioni', () => {
    const raw = [{ functionCall: { name: 'a', args: {} }, thoughtSignature: 'sig' }];
    const contents = toGeminiContents(
      [
        { role: 'user', content: 'Ciao' },
        { role: 'assistant', content: '', raw: { provider: 'gemini', model: 'm', data: raw } },
        { role: 'tool', toolCallId: 'gemini-0', toolName: 'a', content: '{"x":1}' },
        { role: 'tool', toolCallId: 'gemini-1', toolName: 'b', content: 'err', isError: true },
      ],
      'm',
    );
    expect(contents[1]).toEqual({ role: 'model', parts: raw });
    expect(contents[2]?.parts).toEqual([
      { functionResponse: { id: undefined, name: 'a', response: { result: '{"x":1}' } } },
      { functionResponse: { id: undefined, name: 'b', response: { error: 'err' } } },
    ]);
  });

  it('rimuove additionalProperties dagli schemi degli strumenti', () => {
    const tools = toGeminiTools([
      {
        name: 't',
        description: 'd',
        parameters: {
          type: 'object',
          properties: { a: { type: 'string' } },
          additionalProperties: false,
        },
      },
    ]);
    expect(JSON.stringify(tools)).not.toContain('additionalProperties');
  });

  it('suggerisce il modello pro stabile più recente', () => {
    expect(
      geminiProvider.pickDefaultModel([
        { id: 'gemini-2.5-flash', displayName: '' },
        { id: 'gemini-3-pro-preview', displayName: '' },
        { id: 'gemini-3-pro', displayName: '' },
        { id: 'gemini-3-flash', displayName: '' },
      ]),
    ).toBe('gemini-3-pro');
  });
});
