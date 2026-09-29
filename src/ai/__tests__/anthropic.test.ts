import type Anthropic from '@anthropic-ai/sdk';

import { anthropicProvider, contentForEcho, toAnthropicMessages } from '../providers/anthropic';

type Block = Anthropic.Beta.BetaContentBlock;

describe('Anthropic adapter', () => {
  it('raggruppa i tool_result consecutivi in un unico messaggio user', () => {
    const msgs = toAnthropicMessages(
      [
        { role: 'user', content: 'Ciao' },
        {
          role: 'assistant',
          content: 'Controllo',
          toolCalls: [
            { id: 't1', name: 'get_metric', arguments: {} },
            { id: 't2', name: 'get_journal', arguments: {} },
          ],
        },
        { role: 'tool', toolCallId: 't1', toolName: 'get_metric', content: '[]' },
        { role: 'tool', toolCallId: 't2', toolName: 'get_journal', content: 'x', isError: true },
      ],
      'claude-opus-5-5',
    );
    expect(msgs).toHaveLength(3);
    expect(msgs[2]).toEqual({
      role: 'user',
      content: [
        { type: 'tool_result', tool_use_id: 't1', content: '[]', is_error: undefined },
        { type: 'tool_result', tool_use_id: 't2', content: 'x', is_error: true },
      ],
    });
  });

  it('rinvia invariato il contenuto originale (thinking incluso) sullo stesso modello', () => {
    const raw = [
      { type: 'thinking', thinking: '', signature: 'sig' },
      { type: 'tool_use', id: 't1', name: 'get_metric', input: {} },
    ] as unknown as Block[];
    const msgs = toAnthropicMessages(
      [
        { role: 'user', content: 'Ciao' },
        {
          role: 'assistant',
          content: '',
          raw: { provider: 'anthropic', model: 'claude-opus-5-5', data: raw },
        },
      ],
      'claude-opus-5-5',
    );
    expect(msgs[1]?.content).toEqual(raw);
  });

  it('dopo un fallback omette thinking e tool_use che precedono il blocco fallback', () => {
    const content = [
      { type: 'thinking', thinking: '', signature: 's' },
      { type: 'text', text: 'Parziale' },
      { type: 'tool_use', id: 'x', name: 'a', input: {} },
      { type: 'fallback', from: { model: 'a' }, to: { model: 'b' } },
      { type: 'text', text: 'Continua' },
      { type: 'tool_use', id: 'y', name: 'b', input: {} },
    ] as unknown as Block[];
    expect(contentForEcho(content).map((b) => b.type)).toEqual(['text', 'text', 'tool_use']);
  });

  it('suggerisce claude-opus-5-5 se disponibile', () => {
    expect(
      anthropicProvider.pickDefaultModel([
        { id: 'claude-sonnet-5-5', displayName: '' },
        { id: 'claude-opus-5-5', displayName: '' },
      ]),
    ).toBe('claude-opus-5-5');
  });
});
