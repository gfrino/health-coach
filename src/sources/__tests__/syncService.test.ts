/**
 * La sincronizzazione in primo piano finisce appena i dati sono scritti: il controllo proattivo
 * (che la mattina chiede un'analisi all'AI) non deve tenere ferma la rotellina. Il task in
 * background invece lo aspetta, perché iOS sospende l'app appena il task finisce.
 */
import { SYNC_STALL_MS, syncHealthData, useSyncStore } from '../syncService';

let mockReleaseProactive: () => void = () => undefined;
const mockRunProactiveCheck = jest.fn(
  () => new Promise<null>((resolve) => (mockReleaseProactive = () => resolve(null))),
);

jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
  AppState: { addEventListener: jest.fn() },
}));
jest.mock('@/db', () => ({
  getDb: jest.fn(async () => ({})),
  healthDataRepository: {
    HEART_RATE_RAW_DAYS: 30,
    compactHeartRate: jest.fn(async () => 0),
    clearSource: jest.fn(async () => undefined),
  },
}));
jest.mock('@/proactive/notifier', () => ({
  runProactiveCheck: () => mockRunProactiveCheck(),
}));
jest.mock('@/store/settingsStore', () => ({
  useSettingsStore: { getState: () => ({ settings: { healthSourceConnectedAt: 1 } }) },
}));
jest.mock('../platformHealth', () => ({ platformHealthSource: 'apple_health' }));
jest.mock('../demo/demoData', () => ({ generateDemoData: jest.fn(), SOURCE_DEMO: 'demo' }));
const mockSyncAppleHealth = jest.fn(async () => ({ upserted: 0, deleted: 0, errors: [] }));
jest.mock('../appleHealth/sync', () => ({
  syncAppleHealth: (...args: unknown[]) => (mockSyncAppleHealth as jest.Mock)(...args),
}));

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('syncHealthData', () => {
  beforeEach(() => {
    mockRunProactiveCheck.mockClear();
    useSyncStore.setState({ lastSyncAt: null, syncing: false });
  });

  it('in primo piano non aspetta il controllo proattivo', async () => {
    const report = await syncHealthData({ force: true, manual: true });
    expect(report).toEqual({ upserted: 0, deleted: 0, errors: [] });
    expect(useSyncStore.getState().syncing).toBe(false);
    await flush();
    expect(mockRunProactiveCheck).toHaveBeenCalledTimes(1);
    mockReleaseProactive();
  });

  it('in background aspetta anche il controllo proattivo', async () => {
    let done = false;
    const p = syncHealthData({ force: true, background: true }).then(() => (done = true));
    await flush();
    await flush();
    expect(mockRunProactiveCheck).toHaveBeenCalledTimes(1);
    expect(done).toBe(false);
    mockReleaseProactive();
    await p;
    expect(done).toBe(true);
  });

  it('una sync lunga che avanza non viene interrotta', async () => {
    jest.useFakeTimers();
    try {
      mockSyncAppleHealth.mockImplementationOnce(
        ((_db: unknown, onProgress: (p: { done: number; total: number; label: string }) => void) =>
          new Promise((resolve) => {
            let n = 0;
            const step = () => {
              onProgress({ done: ++n, total: 5, label: 'x' });
              if (n < 5) setTimeout(step, SYNC_STALL_MS - 1000);
              else resolve({ upserted: 5, deleted: 0, errors: [] });
            };
            step();
          })) as never,
      );
      const p = syncHealthData({ force: true, manual: true });
      await jest.advanceTimersByTimeAsync(5 * SYNC_STALL_MS);
      await expect(p).resolves.toEqual({ upserted: 5, deleted: 0, errors: [] });
    } finally {
      jest.useRealTimers();
    }
  });

  it('una sync appesa (HealthKit che non risponde) si chiude da sola e non blocca le successive', async () => {
    jest.useFakeTimers();
    try {
      mockSyncAppleHealth.mockImplementationOnce(() => new Promise(() => undefined));
      const p = syncHealthData({ force: true, manual: true });
      expect(useSyncStore.getState().syncing).toBe(true);
      await jest.advanceTimersByTimeAsync(SYNC_STALL_MS + 1);
      await expect(p).resolves.toBeNull();
      expect(useSyncStore.getState().syncing).toBe(false);
      expect(useSyncStore.getState().error).toBe('sync timeout');

      // La sincronizzazione successiva parte davvero (non si aggancia a quella appesa).
      const next = await syncHealthData({ force: true, manual: true });
      expect(next).toEqual({ upserted: 0, deleted: 0, errors: [] });
    } finally {
      jest.useRealTimers();
    }
  });
});
