import { classifyHttpError } from '../errors';
import { setFetch, getFetch } from '../http';
import { openaiProvider } from '../providers/openai';

const original = getFetch();
afterEach(() => setFetch(original));

describe('OpenAI: organizzazione non verificata', () => {
  it('classifica il 400 di verifica come org_verification', () => {
    const e = classifyHttpError(
      400,
      '{"error":{"message":"Your organization must be verified to stream this model."}}',
    );
    expect(e.code).toBe('org_verification');
  });

  it('ripete la richiesta senza streaming', async () => {
    const bodies: Record<string, unknown>[] = [];
    setFetch(async (_url, init) => {
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      bodies.push(body);
      if (body.stream) {
        return new Response(
          '{"error":{"message":"Your organization must be verified to stream this model."}}',
          {
            status: 400,
          },
        );
      }
      return new Response(
        JSON.stringify({
          status: 'completed',
          output: [{ type: 'message', content: [{ type: 'output_text', text: 'Ciao!' }] }],
          usage: { input_tokens: 10, output_tokens: 2 },
        }),
        { status: 200 },
      );
    });
    const tokens: string[] = [];
    const res = await openaiProvider.sendMessage(
      { system: 's' },
      [{ role: 'user', content: 'ciao' }],
      { apiKey: 'test', model: 'gpt-5.5', onToken: (t) => tokens.push(t) },
    );
    expect(bodies).toHaveLength(2);
    expect(bodies[1]?.stream).toBeUndefined();
    expect(res.text).toBe('Ciao!');
    expect(tokens.join('')).toBe('Ciao!');
    expect(res.stopReason).toBe('end');
  });

  it('non sceglie modelli "pro" come predefinito', () => {
    expect(
      openaiProvider.pickDefaultModel([
        { id: 'gpt-5.5-pro', displayName: '' },
        { id: 'gpt-5.5', displayName: '' },
      ]),
    ).toBe('gpt-5.5');
  });
});
