import { aiErrorKey } from '../errorText';

jest.mock('@/store/settingsStore', () => ({ useSettingsStore: jest.fn() }));

describe('testo degli errori AI', () => {
  it('credito esaurito con OpenAI: spiega che ChatGPT non include le API', () => {
    expect(aiErrorKey('insufficient_credit', 'openai')).toBe(
      'ai.errors.insufficient_credit_openai',
    );
    expect(aiErrorKey('insufficient_credit', 'anthropic')).toBe('ai.errors.insufficient_credit');
    expect(aiErrorKey('network', 'openai')).toBe('ai.errors.network');
  });
});
