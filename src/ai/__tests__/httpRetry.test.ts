import { getFetch, request, setFetch } from '../http';

const original = getFetch();
afterEach(() => {
  setFetch(original);
  jest.useRealTimers();
});

describe('request: nuovi tentativi', () => {
  it('riprova dopo un 503 e restituisce la risposta riuscita', async () => {
    jest.useFakeTimers();
    let calls = 0;
    setFetch(async () => {
      calls++;
      return calls === 1
        ? new Response('{"error":{"message":"The model is overloaded"}}', { status: 503 })
        : new Response('ok', { status: 200 });
    });
    const p = request('https://x', { method: 'GET' });
    await jest.advanceTimersByTimeAsync(1500);
    expect((await p).status).toBe(200);
    expect(calls).toBe(2);
  });

  it('non riprova sugli errori della chiave', async () => {
    let calls = 0;
    setFetch(async () => {
      calls++;
      return new Response('{"error":"invalid api key"}', { status: 401 });
    });
    await expect(request('https://x', { method: 'GET' })).rejects.toMatchObject({
      code: 'invalid_key',
    });
    expect(calls).toBe(1);
  });
});
