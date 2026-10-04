import { createTestDb } from '@/test/nodeSqliteDb';

import { getSchemaVersion, migrate } from '../migrate';
import { migrations } from '../migrations';

const EXPECTED_TABLES = [
  'allergies',
  'conditions',
  'conversation_summaries',
  'conversations',
  'daily_checkins',
  'entitlements',
  'integration_interest',
  'journal_entries',
  'lab_report_files',
  'lab_reports',
  'lab_results',
  'medications',
  'memory_facts',
  'messages',
  'metrics',
  'notification_log',
  'nutrition_entries',
  'profile',
  'program_checks',
  'program_items',
  'programs',
  'recipes',
  'settings',
  'sleep_sessions',
  'sync_state',
  'workouts',
];

describe('migrate', () => {
  it('applica tutte le migrazioni e crea le tabelle attese', async () => {
    const db = createTestDb();
    const version = await migrate(db);
    expect(version).toBe(migrations.length);

    const rows = await db.getAllAsync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
      [],
    );
    expect(rows.map((r) => r.name)).toEqual(EXPECTED_TABLES);
  });

  it('è idempotente', async () => {
    const db = createTestDb();
    await migrate(db);
    await expect(migrate(db)).resolves.toBe(migrations.length);
  });

  it('le versioni sono contigue a partire da 1', () => {
    migrations.forEach((m, i) => expect(m.version).toBe(i + 1));
  });

  it('una migrazione fallita non lascia modifiche a metà', async () => {
    const db = createTestDb();
    const broken = [
      ...migrations,
      {
        version: migrations.length + 1,
        name: 'broken',
        up: 'CREATE TABLE x (id INTEGER); SELECT * FROM nope;',
      },
    ];
    await expect(migrate(db, broken)).rejects.toThrow();
    expect(await getSchemaVersion(db)).toBe(migrations.length);
    const x = await db.getFirstAsync("SELECT name FROM sqlite_master WHERE name = 'x'", []);
    expect(x).toBeNull();
  });

  it("rifiuta un DB con schema più recente dell'app", async () => {
    const db = createTestDb();
    await db.execAsync('PRAGMA user_version = 999');
    await expect(migrate(db)).rejects.toThrow(/più recente/);
  });

  it('deduplica le metriche per (source, source_id)', async () => {
    const db = createTestDb();
    await migrate(db);
    const insert = (id: string) =>
      db.runAsync(
        `INSERT INTO metrics (id, type, value, unit, start_at, end_at, source, source_id)
         VALUES (?, 'steps', 100, 'count', 0, 1, 'apple_health', 'hk-1')
         ON CONFLICT (source, source_id) DO UPDATE SET value = excluded.value`,
        [id],
      );
    await insert('a');
    await insert('b');
    const count = await db.getFirstAsync<{ n: number }>('SELECT count(*) AS n FROM metrics', []);
    expect(count?.n).toBe(1);
  });

  it('applica i vincoli (umore 1–5, profilo a riga singola)', async () => {
    const db = createTestDb();
    await migrate(db);
    await expect(
      db.runAsync(
        'INSERT INTO journal_entries (id, entry_at, mood, created_at, updated_at) VALUES (?, 0, 6, 0, 0)',
        ['j1'],
      ),
    ).rejects.toThrow();
    await expect(
      db.runAsync('INSERT INTO profile (id, updated_at) VALUES (2, 0)', []),
    ).rejects.toThrow();
  });
});
