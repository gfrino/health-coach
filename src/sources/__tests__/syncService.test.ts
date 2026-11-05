/**
 * La sincronizzazione in primo piano finisce appena i dati sono scritti: il controllo proattivo
 * (che la mattina chiede un'analisi all'AI) non deve tenere ferma la rotellina. Il task in
 * background invece lo aspetta, perché iOS sospende l'app appena il task finisce.
 */
import { syncHealthData, useSyncStore } from '../syncService';

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
jest.mock('../appleHealth/sync', () => ({
  syncAppleHealth: jest.fn(async () => ({ upserted: 0, deleted: 0, errors: [] })),
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
});
