import { migrate } from '@/db/migrate';
import { createTestDb } from '@/test/nodeSqliteDb';

import { executeTool } from '../tools';

jest.mock('@/db', () => ({
  healthQueries: jest.requireActual('@/db/repositories/healthQueries'),
  healthDataRepository: jest.requireActual('@/db/repositories/healthDataRepository'),
}));

async function setup() {
  const db = createTestDb();
  await migrate(db);
  const day = (d: string, h = 10) => new Date(`${d}T${String(h).padStart(2, '0')}:00:00`).getTime();
  const ins = (id: string, type: string, value: number, at: number) =>
    db.runAsync(
      "INSERT INTO metrics (id, type, value, unit, start_at, end_at, source, source_id) VALUES (?, ?, ?, 'count', ?, ?, 'apple_health', ?)",
      [id, type, value, at, at, id],
    );
  await ins('a', 'steps', 3000, day('2026-09-27', 9));
  await ins('b', 'steps', 2000, day('2026-09-27', 18));
  await ins('c', 'steps', 8000, day('2026-09-28'));
  await ins('d', 'restingHeartRate', 60, day('2026-09-28', 7));
  await ins('e', 'restingHeartRate', 64, day('2026-09-28', 8));
  return db;
}

describe('executeTool', () => {
  it('get_metric somma i passi per giorno e fa la media dei campionati', async () => {
    const db = await setup();
    const steps = await executeTool(db, {
      id: '1',
      name: 'get_metric',
      arguments: { type: 'steps', from: '2026-09-27', to: '2026-09-28' },
    });
    expect(steps.isError).toBe(false);
    expect(JSON.parse(steps.content).days).toEqual([
      { day: '2026-09-27', value: 5000 },
      { day: '2026-09-28', value: 8000 },
    ]);
    const hr = await executeTool(db, {
      id: '2',
      name: 'get_metric',
      arguments: { type: 'restingHeartRate', from: '2026-09-28', to: '2026-09-28' },
    });
    expect(JSON.parse(hr.content).days).toEqual([{ day: '2026-09-28', value: 62 }]);
  });

  it('restituisce un messaggio esplicito quando non ci sono dati', async () => {
    const db = await setup();
    const res = await executeTool(db, {
      id: '1',
      name: 'get_journal',
      arguments: { from: '2026-09-01', to: '2026-09-02' },
    });
    expect(JSON.parse(res.content)).toEqual({ message: 'No journal entries in the period.' });
  });

  it.each([
    [{ type: 'steps', from: '27/09/2026', to: '2026-09-28' }, 'YYYY-MM-DD'],
    [{ type: 'nope', from: '2026-09-27', to: '2026-09-28' }, 'unknown metric'],
    [{ type: 'steps', from: '2026-09-28', to: '2026-09-01' }, 'must not be before'],
    [{ type: 'steps', from: '2020-01-01', to: '2026-09-28' }, 'longer than'],
  ])('valida gli argomenti %j', async (args, message) => {
    const db = await setup();
    const res = await executeTool(db, { id: '1', name: 'get_metric', arguments: args });
    expect(res.isError).toBe(true);
    expect(JSON.parse(res.content).error).toContain(message);
  });

  it('get_metric "sleep" restituisce una riga per notte con le fasi', async () => {
    const db = await setup();
    const start = new Date('2026-09-27T23:00:00').getTime();
    await db.runAsync(
      "INSERT INTO sleep_sessions (id, start_at, end_at, in_bed_s, asleep_s, stages, source, source_id) VALUES ('s', ?, ?, ?, ?, ?, 'demo', 's1')",
      [
        start,
        start + 8 * 3600000,
        8 * 3600,
        7 * 3600,
        JSON.stringify([{ stage: 4, startAt: start, endAt: start + 3600000 }]),
      ],
    );
    const res = await executeTool(db, {
      id: '1',
      name: 'get_metric',
      arguments: { type: 'sleep', from: '2026-09-27', to: '2026-09-28' },
    });
    expect(JSON.parse(res.content)).toEqual([
      {
        night_ending: '2026-09-28',
        hours_asleep: 7,
        hours_in_bed: 8,
        deep_min: 60,
        rem_min: 0,
        light_min: 0,
        awake_min: 0,
      },
    ]);
  });

  it('segnala uno strumento sconosciuto', async () => {
    const db = await setup();
    const res = await executeTool(db, { id: '1', name: 'rm_rf', arguments: {} });
    expect(res.isError).toBe(true);
  });
});
