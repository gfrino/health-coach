import { AIError, classifyHttpError, toAIError } from '../errors';

describe('classifyHttpError', () => {
  it.each([
    [401, '{"error":"invalid x-api-key"}', 'invalid_key'],
    [403, 'forbidden', 'invalid_key'],
    [
      400,
      '{"error":{"message":"Your credit balance is too low to access the Anthropic API"}}',
      'insufficient_credit',
    ],
    [
      429,
      '{"error":{"code":"insufficient_quota","message":"You exceeded your current quota"}}',
      'insufficient_credit',
    ],
    [429, '{"error":"rate limit"}', 'rate_limited'],
    [
      400,
      '{"error":{"status":"INVALID_ARGUMENT","details":[{"reason":"API_KEY_INVALID"}]}}',
      'invalid_key',
    ],
    [404, 'model not found', 'model_not_found'],
    [529, 'overloaded', 'server'],
    [503, 'unavailable', 'server'],
    [400, 'bad request', 'unknown'],
  ])('%i %s → %s', (status, body, code) => {
    expect(classifyHttpError(status, body).code).toBe(code);
  });

  it('solo alcuni errori sono ripetibili', () => {
    expect(new AIError('network').retryable).toBe(true);
    expect(new AIError('invalid_key').retryable).toBe(false);
  });

  it('mappa errori generici', () => {
    expect(toAIError(new TypeError('Network request failed')).code).toBe('network');
    const abort = new Error('aborted');
    abort.name = 'AbortError';
    expect(toAIError(abort).code).toBe('aborted');
  });
});

describe('extractKey', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { extractKey } = require('../registry') as typeof import('../registry');
  it('riconosce i codici di ciascun provider e ignora il resto', () => {
    expect(extractKey('openai', '  sk-proj-abcdefghijklmnopqrstuvwxyz123456\n')).toBe(
      'sk-proj-abcdefghijklmnopqrstuvwxyz123456',
    );
    expect(extractKey('openai', 'sk-ant-api03-abcdefghijklmnopqrstuvwxyz')).toBeNull();
    expect(extractKey('anthropic', 'sk-ant-api03-abcdefghijklmnopqrstuvwxyz')).toBe(
      'sk-ant-api03-abcdefghijklmnopqrstuvwxyz',
    );
    expect(extractKey('gemini', 'AIzaSyA1234567890abcdefghijklmnopqrstu')).toBe(
      'AIzaSyA1234567890abcdefghijklmnopqrstu',
    );
    expect(extractKey('openai', 'ciao mamma')).toBeNull();
    expect(extractKey('device', 'sk-xxxxxxxxxxxxxxxxxxxxxxxx')).toBeNull();
  });
});
