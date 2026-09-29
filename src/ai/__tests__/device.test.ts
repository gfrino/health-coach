// jest.mock viene spostato in cima da babel: gli import ricevono già il modulo finto.
import { AIError } from '../errors';
import { buildDevicePrompt, deviceProvider } from '../providers/device';

jest.mock('on-device-ai', () => {
  const listeners: ((e: { requestId: string; text: string }) => void)[] = [];
  const native = {
    listeners,
    getAvailability: jest.fn(async () => ({ status: 'available', engine: 'apple' })),
    download: jest.fn(),
    cancel: jest.fn(),
    generate: jest.fn(async (requestId: string) => {
      for (const text of ['Ciao', 'Ciao, come', 'Ciao, come stai?'])
        listeners.forEach((l) => l({ requestId, text }));
      return 'Ciao, come stai?';
    }),
    addListener: jest.fn((_: string, l: (e: { requestId: string; text: string }) => void) => {
      listeners.push(l);
      return { remove: () => listeners.splice(listeners.indexOf(l), 1) };
    }),
  };
  return { __esModule: true, default: native };
});

const mockNative = jest.requireMock<{
  default: {
    listeners: unknown[];
    generate: jest.Mock;
    getAvailability: jest.Mock;
  };
}>('on-device-ai').default;
const mockListeners = mockNative.listeners;

describe('deviceProvider', () => {
  it('trasmette solo i nuovi pezzi di testo e restituisce il testo finale senza costi', async () => {
    const deltas: string[] = [];
    const res = await deviceProvider.sendMessage(
      { system: 'SYS' },
      [{ role: 'user', content: 'Ciao' }],
      {
        apiKey: '',
        model: 'on-device',
        onToken: (d) => deltas.push(d),
      },
    );
    expect(deltas).toEqual(['Ciao', ', come', ' stai?']);
    expect(res).toMatchObject({
      text: 'Ciao, come stai?',
      toolCalls: [],
      usage: { inputTokens: 0, outputTokens: 0 },
    });
    expect(mockNative.generate).toHaveBeenCalledWith(
      expect.any(String),
      'SYS',
      'User: Ciao\nCoach:',
    );
    expect(mockListeners).toHaveLength(0);
  });

  it('traduce gli errori nativi nei codici comuni', async () => {
    mockNative.generate.mockRejectedValueOnce(
      Object.assign(new Error('blocked'), { code: 'guardrail' }),
    );
    await expect(
      deviceProvider.sendMessage({ system: '' }, [{ role: 'user', content: 'x' }], {
        apiKey: '',
        model: 'on-device',
      }),
    ).rejects.toMatchObject({ code: 'refused' });
  });

  it('il test di connessione fallisce se il modello non è pronto', async () => {
    mockNative.getAvailability.mockResolvedValueOnce({ status: 'unavailable', engine: 'apple' });
    await expect(deviceProvider.testConnection('', 'on-device')).rejects.toBeInstanceOf(AIError);
  });

  it('non usa strumenti né immagini', () => {
    expect(deviceProvider.supportsTools('on-device')).toBe(false);
    expect(deviceProvider.supportsVision('on-device')).toBe(false);
  });
});

describe('buildDevicePrompt', () => {
  it('trascrive la conversazione, ignora i messaggi di tool e rispetta il budget', () => {
    const long = 'x'.repeat(5000);
    const prompt = buildDevicePrompt([
      { role: 'user', content: long },
      { role: 'assistant', content: 'Risposta vecchia' },
      { role: 'tool', toolCallId: 't', toolName: 'a', content: '{}' },
      { role: 'user', content: 'Domanda precedente' },
      { role: 'assistant', content: 'Risposta recente' },
      { role: 'user', content: 'Ultima domanda' },
    ]);
    expect(prompt).toContain('Coach: Risposta recente');
    expect(prompt).toContain('User: Domanda precedente');
    expect(prompt).not.toContain(long);
    expect(prompt.endsWith('User: Ultima domanda\nCoach:')).toBe(true);
  });
});
