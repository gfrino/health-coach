import { pickRealtimeModel } from '../realtime/openaiRealtime';

jest.mock('react-native-webrtc', () => ({}));
jest.mock('audio-route', () => null);

describe('pickRealtimeModel', () => {
  it('sceglie il modello realtime più recente, non mini né datato', () => {
    expect(
      pickRealtimeModel([
        'gpt-realtime',
        'gpt-realtime-mini',
        'gpt-realtime-2',
        'gpt-realtime-2.1',
        'gpt-realtime-2.1-mini',
        'gpt-realtime-2025-08-28',
        'gpt-6.1',
      ]),
    ).toBe('gpt-realtime-2.1');
  });

  it('ripiega su gpt-realtime', () => {
    expect(pickRealtimeModel(['gpt-5.5'])).toBe('gpt-realtime');
  });
});
