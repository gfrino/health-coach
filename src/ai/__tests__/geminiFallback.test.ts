/**
 * Gemini sovraccarico (503 "model is overloaded" anche dopo i nuovi tentativi): l'app riprova in
 * silenzio con il Flash stabile più recente invece di mostrare l'errore all'utente.
 */
import { getFetch, setFetch } from '../http';
import { collectGeminiStream, fallbackModel, geminiProvider } from '../providers/gemini';

const original = getFetch();
afterEach(() => {
  setFetch(original);
  jest.useRealTimers();
});

const sse = (chunks: unknown[]) =>
  new Response(chunks.map((c) => `data: ${JSON.stringify(c)}\n\n`).join(''), { status: 200 });

async function* events(chunks: unknown[]) {
  for (const c of chunks) yield { data: JSON.stringify(c) };
}

describe('Gemini: modello sovraccarico', () => {
  it('sceglie il Flash stabile più recente come riserva', () => {
    const models = [
      { id: 'gemini-3-pro-preview', displayName: '' },
      { id: 'gemini-3-flash-lite', displayName: '' },
      { id: 'gemini-2.5-flash', displayName: '' },
      { id: 'gemini-3-flash', displayName: '' },
      { id: 'gemini-3-flash-preview', displayName: '' },
    ];
    expect(fallbackModel(models, 'gemini-3-pro-preview')).toBe('gemini-3-flash');
    expect(fallbackModel(models, 'gemini-3-flash')).toBe('gemini-2.5-flash');
  });

  it('dopo i 503 riprova con il Flash e restituisce la risposta', async () => {
    jest.useFakeTimers();
    const urls: string[] = [];
    setFetch(async (url) => {
      urls.push(url);
      if (url.includes('/models?')) {
        return new Response(
          JSON.stringify({
            models: [
              { name: 'models/gemini-3-pro', supportedGenerationMethods: ['generateContent'] },
              { name: 'models/gemini-3-flash', supportedGenerationMethods: ['generateContent'] },
            ],
          }),
          { status: 200 },
        );
      }
      if (url.includes('gemini-3-pro:')) {
        return new Response('{"error":{"code":503,"message":"The model is overloaded."}}', {
          status: 503,
        });
      }
      return sse([
        { candidates: [{ content: { parts: [{ text: '{"ok":1}' }] }, finishReason: 'STOP' }] },
      ]);
    });
    const p = geminiProvider.sendMessage({ system: 's' }, [{ role: 'user', content: 'x' }], {
      apiKey: 'k',
      model: 'gemini-3-pro',
    });
    await jest.runAllTimersAsync();
    const res = await p;
    expect(res.text).toBe('{"ok":1}');
    expect(urls.filter((u) => u.includes('gemini-3-pro:'))).toHaveLength(3);
    expect(urls.at(-1)).toContain('gemini-3-flash:streamGenerateContent');
  });

  it('un errore di quota a metà stream non diventa "sovraccarico"', async () => {
    await expect(
      collectGeminiStream(
        events([
          {
            error: {
              code: 429,
              message: 'Resource has been exhausted',
              status: 'RESOURCE_EXHAUSTED',
            },
          },
        ]),
        'gemini-3-pro',
      ),
    ).rejects.toMatchObject({ code: 'rate_limited' });
  });
});
